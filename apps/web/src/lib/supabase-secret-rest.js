import {
  SupabaseConfigurationError,
  SupabaseRequestError,
} from './supabase-server.js';

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

export async function supabaseSecretRest({
  config,
  path,
  method = 'GET',
  body,
  prefer,
  fetchImpl = fetch,
  errorCode = 'SUPABASE_SECRET_REQUEST_FAILED',
  errorMessage = 'Supabase server request failed.',
}) {
  if (!config?.secretKey) {
    throw new SupabaseConfigurationError('SUPABASE_SECRET_KEY is required for this server operation.');
  }
  if (typeof path !== 'string' || !path.startsWith('/rest/v1/')) {
    throw new TypeError('A Supabase REST path is required.');
  }

  const response = await fetchImpl(`${config.url}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: config.secretKey,
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.message || payload?.error || errorMessage,
      {
        status: response.status,
        code: payload?.code || errorCode,
        details: payload,
      },
    );
  }
  return payload;
}
