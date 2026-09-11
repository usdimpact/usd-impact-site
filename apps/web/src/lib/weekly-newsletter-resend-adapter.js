const RESEND_EMAIL_API = 'https://api.resend.com/emails';
const API_KEY_PATTERN = /^re_[A-Za-z0-9._-]{16,}$/;
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const IDEMPOTENCY_KEY_PATTERN = /^weekly-newsletter\/[0-9a-f]{64}$/;
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,80}$/;
const MAX_FIELD_LENGTH = 1_000_000;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429]);
const FORBIDDEN_MESSAGE_HEADERS = new Set([
  'authorization',
  'bcc',
  'cc',
  'from',
  'idempotency-key',
  'subject',
  'to',
]);

export class WeeklyNewsletterResendConfigurationError extends Error {
  constructor(message, code = 'WEEKLY_NEWSLETTER_RESEND_CONFIGURATION_ERROR') {
    super(message);
    this.name = 'WeeklyNewsletterResendConfigurationError';
    this.code = code;
  }
}

export class WeeklyNewsletterResendRequestError extends Error {
  constructor(message, {
    code = 'WEEKLY_NEWSLETTER_RESEND_REQUEST_FAILED',
    status = null,
    providerState = 'failed',
    retryable = false,
  } = {}) {
    super(message);
    this.name = 'WeeklyNewsletterResendRequestError';
    this.code = code;
    this.status = Number.isInteger(status) ? status : null;
    this.providerState = providerState;
    this.retryable = retryable === true;
  }
}

function normalizeEmail(value, fieldName = 'email') {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    throw new WeeklyNewsletterResendConfigurationError(`${fieldName} is invalid.`, 'RESEND_EMAIL_INVALID');
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
    throw new WeeklyNewsletterResendConfigurationError(
      `${fieldName} must be a valid sender.`,
      'RESEND_SENDER_INVALID',
    );
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
    throw new WeeklyNewsletterResendConfigurationError(
      'RESEND_API_KEY is missing or invalid.',
      'RESEND_API_KEY_INVALID',
    );
  }
  return key;
}

function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_FIELD_LENGTH) {
    throw new WeeklyNewsletterResendRequestError(
      `${fieldName} is missing or outside the approved size boundary.`,
      { code: 'RESEND_MESSAGE_INVALID', retryable: false },
    );
  }
  return value;
}

function parseQaRecipients(value) {
  const entries = String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const recipients = new Set(entries.map((entry) => normalizeEmail(entry, 'WEEKLY_NEWSLETTER_QA_RECIPIENTS')));
  if (recipients.size === 0) {
    throw new WeeklyNewsletterResendConfigurationError(
      'WEEKLY_NEWSLETTER_QA_RECIPIENTS must contain at least one approved Development recipient.',
      'QA_RECIPIENT_ALLOWLIST_MISSING',
    );
  }
  return recipients;
}

function normalizeHeaders(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    throw new WeeklyNewsletterResendRequestError('Weekly Newsletter headers are required.', {
      code: 'RESEND_HEADERS_INVALID',
      retryable: false,
    });
  }
  const normalized = {};
  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = String(rawName ?? '').trim();
    const lower = name.toLowerCase();
    const value = String(rawValue ?? '');
    if (
      !HEADER_NAME_PATTERN.test(name)
      || FORBIDDEN_MESSAGE_HEADERS.has(lower)
      || value.length > 8_192
      || /[\r\n]/.test(value)
    ) {
      throw new WeeklyNewsletterResendRequestError('Weekly Newsletter headers are outside the approved boundary.', {
        code: 'RESEND_HEADERS_INVALID',
        retryable: false,
      });
    }
    normalized[name] = value;
  }
  if (
    typeof normalized['List-Unsubscribe'] !== 'string'
    || typeof normalized['List-Unsubscribe-Post'] !== 'string'
    || normalized['List-Unsubscribe-Post'] !== 'List-Unsubscribe=One-Click'
  ) {
    throw new WeeklyNewsletterResendRequestError('Required one-click unsubscribe headers are missing.', {
      code: 'RESEND_UNSUBSCRIBE_HEADERS_REQUIRED',
      retryable: false,
    });
  }
  return normalized;
}

function assertDevelopmentDelivery(environment) {
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  if (vercelEnvironment === 'production') {
    throw new WeeklyNewsletterResendConfigurationError(
      'Weekly Newsletter delivery is hard-disabled in Production for this implementation slice.',
      'PRODUCTION_WEEKLY_NEWSLETTER_DELIVERY_BLOCKED',
    );
  }
  if (!['preview', 'development'].includes(vercelEnvironment)) {
    throw new WeeklyNewsletterResendConfigurationError(
      'Weekly Newsletter delivery requires an explicit Development or Preview environment.',
      'UNAPPROVED_DELIVERY_ENVIRONMENT',
    );
  }
  if (environment.WEEKLY_NEWSLETTER_DELIVERY_ENABLED !== 'true') {
    throw new WeeklyNewsletterResendConfigurationError(
      'Weekly Newsletter delivery is disabled.',
      'WEEKLY_NEWSLETTER_DELIVERY_DISABLED',
    );
  }
  return parseQaRecipients(environment.WEEKLY_NEWSLETTER_QA_RECIPIENTS);
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
  if (!message || typeof message !== 'object' || message.provider !== 'resend') {
    throw new WeeklyNewsletterResendRequestError('A Weekly Newsletter Resend message is required.', {
      code: 'RESEND_MESSAGE_INVALID',
    });
  }
  if (!Array.isArray(message.to) || message.to.length !== 1) {
    throw new WeeklyNewsletterResendRequestError('Weekly Newsletter delivery is limited to one recipient.', {
      code: 'RESEND_RECIPIENT_BOUNDARY',
    });
  }
  const recipient = normalizeEmail(message.to[0], 'recipient');
  if (!qaRecipients.has(recipient)) {
    throw new WeeklyNewsletterResendRequestError('Recipient is outside the Weekly Newsletter QA allowlist.', {
      code: 'QA_RECIPIENT_NOT_ALLOWED',
      retryable: false,
    });
  }
  const idempotencyKey = String(message.idempotencyKey ?? '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey) || idempotencyKey.length > 256) {
    throw new WeeklyNewsletterResendRequestError('Weekly Newsletter idempotency key is invalid.', {
      code: 'RESEND_IDEMPOTENCY_KEY_INVALID',
    });
  }
  return Object.freeze({
    recipient,
    idempotencyKey,
    subject: requireText(message.subject, 'subject'),
    text: requireText(message.text, 'text'),
    html: requireText(message.html, 'html'),
    headers: normalizeHeaders(message.headers),
  });
}

export function createWeeklyNewsletterResendAdapter({
  environment = process.env,
  fetchImpl = fetch,
  now = () => new Date(),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new WeeklyNewsletterResendConfigurationError('A fetch implementation is required.');
  }
  if (typeof now !== 'function') {
    throw new WeeklyNewsletterResendConfigurationError('A clock implementation is required.');
  }

  const qaRecipients = assertDevelopmentDelivery(environment);
  const apiKey = requireApiKey(environment.RESEND_API_KEY);
  const from = requireSender(environment.RESEND_FROM_EMAIL, 'RESEND_FROM_EMAIL');
  const replyTo = optionalReplyTo(environment.RESEND_REPLY_TO);

  return Object.freeze({
    id: 'resend-weekly-newsletter-development',
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
            headers: normalized.headers,
            ...(replyTo ? { reply_to: replyTo } : {}),
          }),
        });
      } catch {
        throw new WeeklyNewsletterResendRequestError(
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
        throw new WeeklyNewsletterResendRequestError('Resend did not accept the Weekly Newsletter email.', {
          status: response.status,
          ...classifyProviderError(response.status, payload),
        });
      }

      const messageRef = String(payload?.id ?? '').trim();
      if (!messageRef || messageRef.length > 255) {
        throw new WeeklyNewsletterResendRequestError(
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
        throw new WeeklyNewsletterResendConfigurationError('Weekly Newsletter adapter clock returned an invalid date.');
      }
      return Object.freeze({
        state: 'accepted',
        messageRef,
        occurredAt: occurredAt.toISOString(),
      });
    },
  });
}
