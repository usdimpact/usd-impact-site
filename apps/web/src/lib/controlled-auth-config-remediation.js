import { createHash, timingSafeEqual } from 'node:crypto';

const PROOF_TOKEN_SHA256 = '4febc1bc3015c39a37e8e2db5e9ebe76dd3f918ecdd8eb8ce8c5341a87e6e3da';
const PROOF_EXPIRES_AT = Date.parse('2026-08-20T22:00:00.000Z');
const PROJECT_REF = 'gjzetjugmnwanvjkchux';
const MANAGEMENT_API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
const CANONICAL_SITE_URL = 'https://www.usd-impact.com';
const CANONICAL_CALLBACK = 'https://www.usd-impact.com/auth/confirm/';
const AUTH_SENDER_EMAIL = 'no-reply@updates.usd-impact.com';
const AUTH_SENDER_NAME = 'USD Impact';
const AUTH_SUBJECT = 'Your secure USD Impact sign-in link';
const AUTH_TEMPLATE = `
<h2>Sign in to USD Impact</h2>
<p>Use the secure, one-time link below to access your USD Impact account.</p>
<p><a href="{{ .ConfirmationURL }}">Sign in to USD Impact</a></p>
<p>This link expires shortly and can only be used once.</p>
<p>If you did not request this email, you can safely ignore it.</p>
`.trim();

const MANAGEMENT_TOKEN_NAMES = Object.freeze([
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_MANAGEMENT_ACCESS_TOKEN',
  'SUPABASE_PERSONAL_ACCESS_TOKEN',
]);
const RESEND_KEY_NAMES = Object.freeze(['RESEND_API_KEY']);

class ControlledRemediationError extends Error {
  constructor(message, code, status = 502) {
    super(message);
    this.name = 'ControlledRemediationError';
    this.code = code;
    this.status = status;
  }
}

function sendJson(response, status, body, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

function requestUrl(request) {
  return new URL(request.url || '/', 'https://usd-impact.invalid');
}

function validProofToken(value) {
  if (typeof value !== 'string' || value.length < 32 || value.length > 128) return false;
  const actual = Buffer.from(createHash('sha256').update(value).digest('hex'), 'utf8');
  const expected = Buffer.from(PROOF_TOKEN_SHA256, 'utf8');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function firstEnvironmentValue(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return { name, value: value.trim() };
  }
  return null;
}

function boundedCode(error) {
  const normalized = String(error?.code || 'CONTROLLED_AUTH_REMEDIATION_FAILED')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 80);
  return /^[A-Z][A-Z0-9_]{1,79}$/.test(normalized)
    ? normalized
    : 'CONTROLLED_AUTH_REMEDIATION_FAILED';
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

function safeInteger(value) {
  return Number.isInteger(value) ? value : null;
}

function safeString(value, maxLength = 500) {
  return typeof value === 'string' && value.length <= maxLength ? value : null;
}

function templateFingerprint(value) {
  return typeof value === 'string'
    ? createHash('sha256').update(value).digest('hex')
    : null;
}

function redirectList(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^https:\/\//.test(entry) && entry.length <= 500)
    .slice(0, 50);
}

function safeConfig(config) {
  const template = config?.mailer_templates_magic_link_content;
  return {
    siteUrl: safeString(config?.site_url),
    redirectUrls: redirectList(config?.uri_allow_list),
    emailEnabled: config?.external_email_enabled === true,
    signupDisabled: config?.disable_signup === true,
    anonymousUsersEnabled: config?.external_anonymous_users_enabled === true,
    customSmtpConfigured: Boolean(config?.smtp_host),
    smtp: {
      adminEmail: safeString(config?.smtp_admin_email, 254),
      host: safeString(config?.smtp_host, 254),
      port: safeString(String(config?.smtp_port ?? ''), 12),
      user: safeString(config?.smtp_user, 100),
      senderName: safeString(config?.smtp_sender_name, 100),
      maxFrequencySeconds: safeInteger(config?.smtp_max_frequency),
    },
    mailer: {
      autoconfirm: config?.mailer_autoconfirm === true,
      secureEmailChange: config?.mailer_secure_email_change_enabled === true,
      magicLinkSubject: safeString(config?.mailer_subjects_magic_link, 200),
      magicLinkTemplateSha256: templateFingerprint(template),
      templateUsesConfirmationUrl: typeof template === 'string'
        && template.includes('{{ .ConfirmationURL }}'),
      templateContainsOptOut: typeof template === 'string'
        && /opt[ -]?out|unsubscribe/i.test(template),
      otpExpirySeconds: safeInteger(config?.mailer_otp_exp),
      otpLength: safeInteger(config?.mailer_otp_length),
    },
    abuseControls: {
      captchaEnabled: config?.security_captcha_enabled === true,
      captchaProvider: safeString(config?.security_captcha_provider, 50),
      forwardedForEnabled: config?.security_sb_forwarded_for_enabled === true,
      rateLimitEmailSent: safeInteger(config?.rate_limit_email_sent),
      rateLimitOtp: safeInteger(config?.rate_limit_otp),
      rateLimitVerify: safeInteger(config?.rate_limit_verify),
      rateLimitTokenRefresh: safeInteger(config?.rate_limit_token_refresh),
      rateLimitAnonymousUsers: safeInteger(config?.rate_limit_anonymous_users),
    },
  };
}

async function managementRequest(token, { method = 'GET', body } = {}) {
  const providerResponse = await fetch(MANAGEMENT_API, {
    method,
    redirect: 'manual',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonSafely(providerResponse);
  if (!providerResponse.ok) {
    throw new ControlledRemediationError(
      `Supabase Management API returned ${providerResponse.status}.`,
      `SUPABASE_MANAGEMENT_HTTP_${providerResponse.status}`,
      providerResponse.status === 401 || providerResponse.status === 403 ? 409 : 502,
    );
  }
  return payload || {};
}

function requireManagementToken() {
  const credential = firstEnvironmentValue(MANAGEMENT_TOKEN_NAMES);
  if (!credential) {
    throw new ControlledRemediationError(
      'A Supabase Management API token is not available in Preview.',
      'SUPABASE_MANAGEMENT_TOKEN_UNAVAILABLE',
      409,
    );
  }
  return credential;
}

function requireResendKey() {
  const credential = firstEnvironmentValue(RESEND_KEY_NAMES);
  if (!credential) {
    throw new ControlledRemediationError(
      'The Resend SMTP credential is not available in Preview.',
      'RESEND_SMTP_CREDENTIAL_UNAVAILABLE',
      409,
    );
  }
  return credential;
}

function mergedRedirectAllowList(currentValue) {
  const entries = new Set(redirectList(currentValue));
  entries.add(CANONICAL_CALLBACK);
  return [...entries].sort().join(',');
}

async function handlePresence(response) {
  return sendJson(response, 200, {
    ok: true,
    mode: 'presence',
    projectRef: PROJECT_REF,
    managementTokenAvailable: Boolean(firstEnvironmentValue(MANAGEMENT_TOKEN_NAMES)),
    resendSmtpCredentialAvailable: Boolean(firstEnvironmentValue(RESEND_KEY_NAMES)),
    expiresAt: new Date(PROOF_EXPIRES_AT).toISOString(),
  });
}

async function handleRead(response) {
  const management = requireManagementToken();
  const config = await managementRequest(management.value);
  return sendJson(response, 200, {
    ok: true,
    mode: 'read',
    projectRef: PROJECT_REF,
    config: safeConfig(config),
  });
}

async function handleApply(response) {
  const management = requireManagementToken();
  const resend = requireResendKey();
  const before = await managementRequest(management.value);

  await managementRequest(management.value, {
    method: 'PATCH',
    body: {
      site_url: CANONICAL_SITE_URL,
      uri_allow_list: mergedRedirectAllowList(before?.uri_allow_list),
      external_email_enabled: true,
      mailer_autoconfirm: false,
      mailer_secure_email_change_enabled: true,
      smtp_admin_email: AUTH_SENDER_EMAIL,
      smtp_host: 'smtp.resend.com',
      smtp_port: '465',
      smtp_user: 'resend',
      smtp_pass: resend.value,
      smtp_sender_name: AUTH_SENDER_NAME,
    },
  });

  await managementRequest(management.value, {
    method: 'PATCH',
    body: {
      mailer_subjects_magic_link: AUTH_SUBJECT,
      mailer_templates_magic_link_content: AUTH_TEMPLATE,
    },
  });

  const after = await managementRequest(management.value);
  const safeAfter = safeConfig(after);
  const applied = safeAfter.siteUrl === CANONICAL_SITE_URL
    && safeAfter.redirectUrls.includes(CANONICAL_CALLBACK)
    && safeAfter.smtp.adminEmail === AUTH_SENDER_EMAIL
    && safeAfter.smtp.host === 'smtp.resend.com'
    && safeAfter.smtp.port === '465'
    && safeAfter.smtp.user === 'resend'
    && safeAfter.smtp.senderName === AUTH_SENDER_NAME
    && safeAfter.mailer.magicLinkSubject === AUTH_SUBJECT
    && safeAfter.mailer.magicLinkTemplateSha256 === templateFingerprint(AUTH_TEMPLATE)
    && safeAfter.mailer.templateUsesConfirmationUrl
    && !safeAfter.mailer.templateContainsOptOut;

  if (!applied) {
    throw new ControlledRemediationError(
      'Production Auth configuration did not converge to the approved state.',
      'AUTH_CONFIGURATION_VERIFICATION_FAILED',
      502,
    );
  }

  return sendJson(response, 200, {
    ok: true,
    mode: 'apply',
    projectRef: PROJECT_REF,
    before: safeConfig(before),
    after: safeAfter,
  });
}

export async function handleControlledAuthConfigRemediation(request, response) {
  if (request.method !== 'GET') {
    return sendJson(
      response,
      405,
      { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' },
      { Allow: 'GET' },
    );
  }
  if (String(process.env.VERCEL_ENV || '').toLowerCase() === 'production') {
    return sendJson(response, 404, { error: 'Not found.', code: 'NOT_FOUND' });
  }
  if (Date.now() > PROOF_EXPIRES_AT) {
    return sendJson(
      response,
      410,
      { error: 'Controlled remediation expired.', code: 'CONTROLLED_REMEDIATION_EXPIRED' },
    );
  }

  const url = requestUrl(request);
  const proofToken = url.searchParams.get('proof') || '';
  if (!validProofToken(proofToken)) {
    return sendJson(response, 404, { error: 'Not found.', code: 'NOT_FOUND' });
  }

  try {
    const mode = url.searchParams.get('mode') || '';
    if (mode === 'presence') return await handlePresence(response);
    if (mode === 'read') return await handleRead(response);
    if (mode === 'apply') return await handleApply(response);
    return sendJson(response, 400, { error: 'Invalid mode.', code: 'INVALID_MODE' });
  } catch (error) {
    const code = boundedCode(error);
    console.error('Controlled Production Auth remediation failed.', { code });
    return sendJson(response, Number.isInteger(error?.status) ? error.status : 502, {
      ok: false,
      error: 'Controlled Production Auth remediation failed.',
      code,
    });
  }
}
