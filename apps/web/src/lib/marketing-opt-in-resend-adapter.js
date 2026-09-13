const RESEND_EMAIL_API = 'https://api.resend.com/emails';
const API_KEY_PATTERN = /^re_[A-Za-z0-9._-]{16,}$/;
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const IDEMPOTENCY_KEY_PATTERN = /^marketing-opt-in\/[0-9a-f]{64}$/;
const MAX_FIELD_LENGTH = 1_000_000;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429]);

export class MarketingOptInResendConfigurationError extends Error {
  constructor(message, code = 'MARKETING_OPT_IN_RESEND_CONFIGURATION_ERROR') {
    super(message);
    this.name = 'MarketingOptInResendConfigurationError';
    this.code = code;
  }
}

export class MarketingOptInResendRequestError extends Error {
  constructor(message, {
    code = 'MARKETING_OPT_IN_RESEND_REQUEST_FAILED',
    status = null,
    providerState = 'failed',
    retryable = false,
  } = {}) {
    super(message);
    this.name = 'MarketingOptInResendRequestError';
    this.code = code;
    this.status = Number.isInteger(status) ? status : null;
    this.providerState = providerState;
    this.retryable = retryable === true;
  }
}

function normalizeEmail(value, fieldName = 'email') {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    throw new MarketingOptInResendConfigurationError(`${fieldName} is invalid.`, 'RESEND_EMAIL_INVALID');
  }
  return email;
}

function mailboxFromSender(value) {
  const sender = String(value ?? '').trim();
  if (!sender || sender.length > 320 || /[\r\n]/.test(sender)) return null;
  const bracketed = sender.match(/<([^<>]+)>$/);
  return (bracketed ? bracketed[1] : sender).trim().toLowerCase();
}

function requireSender(value, fieldName) {
  const sender = String(value ?? '').trim();
  const mailbox = mailboxFromSender(sender);
  if (!mailbox || !EMAIL_PATTERN.test(mailbox)) {
    throw new MarketingOptInResendConfigurationError(`${fieldName} must be a valid sender.`, 'RESEND_SENDER_INVALID');
  }
  return sender;
}

function optionalReplyTo(value) {
  if (value == null || String(value).trim() === '') return null;
  return requireSender(value, 'RESEND_REPLY_TO');
}

function requireApiKey(value) {
  const key = String(value ?? '').trim();
  if (!API_KEY_PATTERN.test(key)) {
    throw new MarketingOptInResendConfigurationError('RESEND_API_KEY is missing or invalid.', 'RESEND_API_KEY_INVALID');
  }
  return key;
}

function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_FIELD_LENGTH) {
    throw new MarketingOptInResendRequestError(`${fieldName} is missing or outside the approved size boundary.`, {
      code: 'RESEND_MESSAGE_INVALID',
      retryable: false,
    });
  }
  return value;
}

function parseQaRecipients(value) {
  const entries = String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const normalized = new Set(entries.map((entry) => normalizeEmail(entry, 'EMAIL_OPT_IN_QA_RECIPIENTS')));
  if (normalized.size === 0) {
    throw new MarketingOptInResendConfigurationError(
      'EMAIL_OPT_IN_QA_RECIPIENTS must contain at least one approved Development recipient.',
      'QA_RECIPIENT_ALLOWLIST_MISSING',
    );
  }
  return normalized;
}

function assertDevelopmentDelivery(environment) {
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  if (vercelEnvironment === 'production') {
    throw new MarketingOptInResendConfigurationError(
      'Marketing opt-in email delivery is hard-disabled in Production for this implementation slice.',
      'PRODUCTION_OPT_IN_DELIVERY_BLOCKED',
    );
  }
  if (environment.EMAIL_OPT_IN_DELIVERY_ENABLED !== 'true') {
    throw new MarketingOptInResendConfigurationError(
      'Marketing opt-in email delivery is disabled.',
      'OPT_IN_DELIVERY_DISABLED',
    );
  }
  if (!['preview', 'development'].includes(vercelEnvironment)) {
    throw new MarketingOptInResendConfigurationError(
      'Marketing opt-in delivery requires an explicit Development or Preview environment.',
      'UNAPPROVED_DELIVERY_ENVIRONMENT',
    );
  }
  return parseQaRecipients(environment.EMAIL_OPT_IN_QA_RECIPIENTS);
}

function normalizeProviderCode(payload) {
  const candidate = payload?.name || payload?.code || payload?.error || '';
  return String(candidate)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function classifyProviderError(status, payload) {
  const providerCode = normalizeProviderCode(payload);
  if (providerCode.includes('suppress')) {
    return { code: 'RESEND_PROVIDER_SUPPRESSED', providerState: 'suppressed', retryable: false };
  }
  if (status === 409 && providerCode === 'concurrent_idempotent_requests') {
    return { code: 'RESEND_IDEMPOTENCY_IN_PROGRESS', providerState: 'failed', retryable: true };
  }
  if (status === 409 && providerCode === 'invalid_idempotent_request') {
    return { code: 'RESEND_IDEMPOTENCY_CONFLICT', providerState: 'accepted_ambiguous', retryable: false };
  }
  if (RETRYABLE_STATUS_CODES.has(status) || status >= 500) {
    return {
      code: status === 429 ? 'RESEND_RATE_LIMITED' : `RESEND_RETRYABLE_HTTP_${status}`,
      providerState: 'failed',
      retryable: true,
    };
  }
  return {
    code: providerCode ? `RESEND_${providerCode.toUpperCase()}`.slice(0, 80) : `RESEND_HTTP_${status}`,
    providerState: 'failed',
    retryable: false,
  };
}

function validateMessage(message, qaRecipients) {
  if (!message || typeof message !== 'object') {
    throw new MarketingOptInResendRequestError('A marketing opt-in message is required.', {
      code: 'RESEND_MESSAGE_INVALID',
    });
  }
  const recipient = normalizeEmail(message.to, 'recipient');
  if (!qaRecipients.has(recipient)) {
    throw new MarketingOptInResendRequestError('Recipient is outside the Development QA allowlist.', {
      code: 'QA_RECIPIENT_NOT_ALLOWED',
      retryable: false,
    });
  }
  const idempotencyKey = String(message.idempotencyKey ?? '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey) || idempotencyKey.length > 256) {
    throw new MarketingOptInResendRequestError('Provider idempotency key is invalid.', {
      code: 'RESEND_IDEMPOTENCY_KEY_INVALID',
      retryable: false,
    });
  }
  return Object.freeze({
    recipient,
    idempotencyKey,
    subject: requireText(message.subject, 'subject'),
    text: requireText(message.text, 'text'),
    html: requireText(message.html, 'html'),
  });
}

export function createMarketingOptInResendAdapter({
  environment = process.env,
  fetchImpl = fetch,
  now = () => new Date(),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new MarketingOptInResendConfigurationError('A fetch implementation is required.');
  }
  if (typeof now !== 'function') {
    throw new MarketingOptInResendConfigurationError('A clock implementation is required.');
  }

  const qaRecipients = assertDevelopmentDelivery(environment);
  const apiKey = requireApiKey(environment.RESEND_API_KEY);
  const from = requireSender(environment.RESEND_FROM_EMAIL, 'RESEND_FROM_EMAIL');
  const replyTo = optionalReplyTo(environment.RESEND_REPLY_TO);

  return Object.freeze({
    id: 'resend-development-opt-in',
    async send(message) {
      const normalized = validateMessage(message, qaRecipients);
      let response;
      try {
        response = await fetchImpl(RESEND_EMAIL_API, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': normalized.idempotencyKey,
          },
          body: JSON.stringify({
            from,
            to: [normalized.recipient],
            subject: normalized.subject,
            text: normalized.text,
            html: normalized.html,
            ...(replyTo ? { reply_to: replyTo } : {}),
          }),
        });
      } catch {
        throw new MarketingOptInResendRequestError(
          'Resend request outcome is ambiguous and must be reconciled with the same idempotency key.',
          {
            code: 'RESEND_REQUEST_AMBIGUOUS',
            providerState: 'accepted_ambiguous',
            retryable: true,
          },
        );
      }

      const payload = await readJsonSafely(response);
      if (!response.ok) {
        throw new MarketingOptInResendRequestError('Resend did not accept the opt-in confirmation email.', {
          status: response.status,
          ...classifyProviderError(response.status, payload),
        });
      }

      const messageRef = String(payload?.id ?? '').trim();
      if (!messageRef || messageRef.length > 255) {
        throw new MarketingOptInResendRequestError(
          'Resend accepted the request without a usable message reference.',
          {
            code: 'RESEND_ACCEPTANCE_AMBIGUOUS',
            status: response.status,
            providerState: 'accepted_ambiguous',
            retryable: true,
          },
        );
      }

      const occurredAt = now();
      if (!(occurredAt instanceof Date) || !Number.isFinite(occurredAt.getTime())) {
        throw new MarketingOptInResendConfigurationError('Adapter clock returned an invalid date.');
      }
      return Object.freeze({
        state: 'accepted',
        messageRef,
        occurredAt: occurredAt.toISOString(),
      });
    },
  });
}
