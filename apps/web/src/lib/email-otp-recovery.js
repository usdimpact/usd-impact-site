import {
  readSupabaseServerConfig,
  SupabaseRequestError,
} from './supabase-server.js';

const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;

export function emailOtpRecoveryEnabled(environment = process.env) {
  return String(environment.EMAIL_OTP_FALLBACK_ENABLED ?? '').trim().toLowerCase() === 'true';
}

function requireEnabled(environment) {
  if (!emailOtpRecoveryEnabled(environment)) {
    throw new SupabaseRequestError('Email code sign-in is disabled.', {
      status: 404,
      code: 'EMAIL_OTP_FALLBACK_DISABLED',
    });
  }
}

function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new SupabaseRequestError('The email code is invalid or expired.', {
      status: 400,
      code: 'INVALID_EMAIL_OTP',
    });
  }
  return email;
}

function normalizeToken(value) {
  const token = String(value ?? '').trim();
  if (!OTP_PATTERN.test(token)) {
    throw new SupabaseRequestError('The email code is invalid or expired.', {
      status: 400,
      code: 'INVALID_EMAIL_OTP',
    });
  }
  return token;
}

async function readJsonBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

export async function verifyEmailOtpRecovery({
  email,
  token,
  environment = process.env,
  config,
  fetchImpl = fetch,
}) {
  requireEnabled(environment);
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const normalizedEmail = normalizeEmail(email);
  const normalizedToken = normalizeToken(token);

  const response = await fetchImpl(`${resolvedConfig.url}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: resolvedConfig.publishableKey,
      Authorization: `Bearer ${resolvedConfig.publishableKey}`,
    },
    body: JSON.stringify({
      email: normalizedEmail,
      token: normalizedToken,
      type: 'email',
    }),
  });
  const payload = await readJsonBody(response);

  if (!response.ok) {
    if (response.status >= 500) {
      throw new SupabaseRequestError('Email code verification is temporarily unavailable.', {
        status: response.status,
        code: 'EMAIL_OTP_VERIFY_FAILED',
        details: payload,
      });
    }
    throw new SupabaseRequestError('The email code is invalid or expired.', {
      status: 400,
      code: 'INVALID_EMAIL_OTP',
    });
  }

  return payload;
}
