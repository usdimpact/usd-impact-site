const RESEND_EMAIL_API = 'https://api.resend.com/emails';
const API_KEY_PATTERN = /^re_[A-Za-z0-9._-]{16,}$/;
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const IDEMPOTENCY_KEY_PATTERN = /^launch-email\/[0-9a-f]{64}$/;
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

export class ResendLaunchEmailConfigurationError extends Error {
  constructor(message, code = 'RESEND_LAUNCH_CONFIGURATION_ERROR') {
    super(message);
    this.name = 'ResendLaunchEmailConfigurationError';
    this.code = code;
  }
}

export class ResendLaunchEmailRequestError extends Error {
  constructor(message, {
    code = 'RESEND_LAUNCH_REQUEST_FAILED',
    status = null,
    providerState = 'failed',
    retryable = false,
  } = {}) {
    super(message);
    this.name = 'ResendLaunchEmailRequestError';
    this.code = code;
    this.status = Number.isInteger(status) ? status : null;
    this.providerState = providerState;
    this.retryable = retryable === true;
  }
}

function requireApiKey(value) {
  const key = String(value || '').trim();
  if (!API_KEY_PATTERN.test(key)) {
    throw new ResendLaunchEmailConfigurationError(
      'RESEND_API_KEY is missing or invalid for lifecycle delivery.',
      'RESEND_API_KEY_INVALID',
    );
  }
  return key;
}

function mailboxFromSender(value) {
  const sender = String(value || '').trim();
  if (!sender || sender.length > 320 || /[\r\n]/.test(sender)) return null;
  const bracketed = sender.match(/<([^<>]+)>$/);
  return (bracketed ? bracketed[1] : sender).trim().toLowerCase();
}

function requireSender(value, fieldName) {
  const sender = String(value || '').trim();
  const mailbox = mailboxFromSender(sender);
  if (!mailbox || !EMAIL_PATTERN.test(mailbox)) {
    throw new ResendLaunchEmailConfigurationError(
      `${fieldName} must be an explicit valid sender address.`,
      'RESEND_SENDER_INVALID',
    );
  }
  return sender;
}

function optionalReplyTo(value) {
  if (value == null || String(value).trim() === '') return null;
  return requireSender(value, 'LAUNCH_EMAIL_REPLY_TO');
}

function requireText(value, fieldName, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || value.length > MAX_FIELD_LENGTH || (!allowEmpty && value.length === 0)) {
    throw new ResendLaunchEmailRequestError(
      `${fieldName} is missing or outside the approved size boundary.`,
      { code: 'RESEND_MESSAGE_INVALID', retryable: false },
    );
  }
  return value;
}

function normalizeHeaders(headers) {
  if (headers == null) return null;
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    throw new ResendLaunchEmailRequestError('Message headers are invalid.', {
      code: 'RESEND_HEADERS_INVALID',
      retryable: false,
    });
  }
  const normalized = {};
  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = String(rawName || '').trim();
    const lower = name.toLowerCase();
    const value = String(rawValue ?? '');
    if (
      !HEADER_NAME_PATTERN.test(name)
      || FORBIDDEN_MESSAGE_HEADERS.has(lower)
      || value.length > 8_192
      || /[\r\n]/.test(value)
    ) {
      throw new ResendLaunchEmailRequestError('Message headers are outside the approved boundary.', {
        code: 'RESEND_HEADERS_INVALID',
        retryable: false,
      });
    }
    normalized[name] = value;
  }
  return Object.keys(normalized).length ? normalized : null;
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
    return {
      code: 'RESEND_PROVIDER_SUPPRESSED',
      providerState: 'suppressed',
      retryable: false,
    };
  }
  if (status === 409 && providerCode === 'concurrent_idempotent_requests') {
    return {
      code: 'RESEND_IDEMPOTENCY_IN_PROGRESS',
      providerState: 'failed',
      retryable: true,
    };
  }
  if (status === 409 && providerCode === 'invalid_idempotent_request') {
    return {
      code: 'RESEND_IDEMPOTENCY_CONFLICT',
      providerState: 'accepted_ambiguous',
      retryable: false,
    };
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

function validateMessage(message) {
  if (!message || typeof message !== 'object' || message.provider !== 'resend') {
    throw new ResendLaunchEmailRequestError('A Resend lifecycle message is required.', {
      code: 'RESEND_MESSAGE_INVALID',
      retryable: false,
    });
  }
  if (!Array.isArray(message.to) || message.to.length !== 1) {
    throw new ResendLaunchEmailRequestError('Lifecycle delivery is limited to exactly one recipient.', {
      code: 'RESEND_RECIPIENT_BOUNDARY',
      retryable: false,
    });
  }
  const recipient = String(message.to[0] || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(recipient)) {
    throw new ResendLaunchEmailRequestError('Lifecycle recipient is invalid.', {
      code: 'RESEND_RECIPIENT_INVALID',
      retryable: false,
    });
  }
  const idempotencyKey = String(message.idempotencyKey || '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey) || idempotencyKey.length > 256) {
    throw new ResendLaunchEmailRequestError('Lifecycle idempotency key is invalid.', {
      code: 'RESEND_IDEMPOTENCY_KEY_INVALID',
      retryable: false,
    });
  }
  return Object.freeze({
    to: [recipient],
    idempotencyKey,
    subject: requireText(message.subject, 'subject'),
    text: requireText(message.text, 'text', { allowEmpty: true }),
    html: requireText(message.html, 'html', { allowEmpty: true }),
    headers: normalizeHeaders(message.headers),
  });
}

export function createResendLaunchEmailAdapter({
  environment = process.env,
  fetchImpl = fetch,
  now = () => new Date(),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new ResendLaunchEmailConfigurationError('A fetch implementation is required.');
  }
  if (typeof now !== 'function') {
    throw new ResendLaunchEmailConfigurationError('A clock function is required.');
  }

  const apiKey = requireApiKey(environment.RESEND_API_KEY);
  const from = requireSender(environment.LAUNCH_EMAIL_FROM_EMAIL, 'LAUNCH_EMAIL_FROM_EMAIL');
  const replyTo = optionalReplyTo(environment.LAUNCH_EMAIL_REPLY_TO);

  return Object.freeze({
    id: 'resend',
    async send(message) {
      const normalized = validateMessage(message);
      const body = {
        from,
        to: normalized.to,
        subject: normalized.subject,
        text: normalized.text,
        html: normalized.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(normalized.headers ? { headers: normalized.headers } : {}),
      };

      let response;
      try {
        response = await fetchImpl(RESEND_EMAIL_API, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': normalized.idempotencyKey,
          },
          body: JSON.stringify(body),
        });
      } catch {
        throw new ResendLaunchEmailRequestError(
          'Resend request outcome is ambiguous and requires reconciliation.',
          {
            code: 'RESEND_REQUEST_AMBIGUOUS',
            providerState: 'accepted_ambiguous',
            retryable: false,
          },
        );
      }

      const payload = await readJsonSafely(response);
      if (!response.ok) {
        const classification = classifyProviderError(response.status, payload);
        throw new ResendLaunchEmailRequestError('Resend lifecycle delivery was not accepted.', {
          status: response.status,
          ...classification,
        });
      }

      const messageRef = String(payload?.id || '').trim();
      if (!messageRef || messageRef.length > 255) {
        throw new ResendLaunchEmailRequestError(
          'Resend accepted the request without a usable message reference.',
          {
            code: 'RESEND_ACCEPTANCE_AMBIGUOUS',
            status: response.status,
            providerState: 'accepted_ambiguous',
            retryable: false,
          },
        );
      }

      const occurredAt = now();
      if (!(occurredAt instanceof Date) || !Number.isFinite(occurredAt.getTime())) {
        throw new ResendLaunchEmailConfigurationError('Lifecycle adapter clock returned an invalid date.');
      }
      return Object.freeze({
        state: 'accepted',
        messageRef,
        occurredAt: occurredAt.toISOString(),
      });
    },
  });
}
