import {
  SupabaseRequestError,
  readSupabaseServerConfig,
} from './supabase-server.js';

const TOKEN_HASH_PATTERN = /^[A-Za-z0-9._~-]{20,2048}$/;
const EMAIL_VERIFICATION_TYPE = 'email';

async function readJsonBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

export async function verifyPasswordlessTokenHash({
  tokenHash,
  environment,
  config,
  fetchImpl = fetch,
}) {
  const normalizedTokenHash = String(tokenHash ?? '').trim();

  if (!TOKEN_HASH_PATTERN.test(normalizedTokenHash)) {
    throw new SupabaseRequestError('The sign-in link is invalid or expired.', {
      status: 400,
      code: 'INVALID_SIGN_IN_LINK',
    });
  }

  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const response = await fetchImpl(`${resolvedConfig.url}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: resolvedConfig.publishableKey,
      Authorization: `Bearer ${resolvedConfig.publishableKey}`,
    },
    body: JSON.stringify({
      token_hash: normalizedTokenHash,
      type: EMAIL_VERIFICATION_TYPE,
    }),
  });
  const payload = await readJsonBody(response);

  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.msg || payload?.message || payload?.error_description || payload?.error || 'Authentication request failed.',
      {
        status: response.status,
        code: payload?.code || payload?.error_code || 'AUTH_REQUEST_FAILED',
        details: payload,
      },
    );
  }

  return payload;
}
