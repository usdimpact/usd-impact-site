const ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/i;
const VIDEO_UID_PATTERN = /^[a-f0-9]{32}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export class CloudflareStreamConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CloudflareStreamConfigurationError';
    this.code = 'CLOUDFLARE_STREAM_CONFIGURATION_ERROR';
  }
}

export class CloudflareStreamRequestError extends Error {
  constructor(message, { status = 502, code = 'CLOUDFLARE_STREAM_REQUEST_FAILED' } = {}) {
    super(message);
    this.name = 'CloudflareStreamRequestError';
    this.status = status;
    this.code = code;
  }
}

function requireAccountId(value) {
  const accountId = String(value || '').trim();
  if (!ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new CloudflareStreamConfigurationError('CLOUDFLARE_ACCOUNT_ID is missing or invalid.');
  }
  return accountId;
}

function requireApiToken(value) {
  const token = String(value || '').trim();
  if (token.length < 20 || token.length > 512 || /\s/.test(token)) {
    throw new CloudflareStreamConfigurationError('CLOUDFLARE_STREAM_API_TOKEN is missing or invalid.');
  }
  return token;
}

function requireVideoUid(value) {
  const uid = String(value || '').trim();
  if (!VIDEO_UID_PATTERN.test(uid)) {
    throw new TypeError('A valid Cloudflare Stream video UID is required.');
  }
  return uid;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function createCloudflareStreamToken({
  videoUid,
  environment = process.env,
  fetchImpl = fetch,
}) {
  const accountId = requireAccountId(environment.CLOUDFLARE_ACCOUNT_ID);
  const apiToken = requireApiToken(environment.CLOUDFLARE_STREAM_API_TOKEN);
  const uid = requireVideoUid(videoUid);
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/token`;

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      cache: 'no-store',
    });
  } catch {
    throw new CloudflareStreamRequestError('Secure video delivery is temporarily unavailable.');
  }

  const payload = await readJson(response);
  const token = payload?.result?.token;
  if (!response.ok || payload?.success !== true || typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    throw new CloudflareStreamRequestError('Secure video delivery is temporarily unavailable.', {
      status: response.status >= 400 && response.status < 600 ? response.status : 502,
      code: 'CLOUDFLARE_STREAM_TOKEN_FAILED',
    });
  }

  return token;
}

export function safeCloudflareStreamError(error) {
  if (error instanceof CloudflareStreamConfigurationError) {
    console.error(error.message);
    return { status: 503, code: error.code };
  }
  if (error instanceof CloudflareStreamRequestError) {
    console.error('Cloudflare Stream token request failed.', {
      status: error.status,
      code: error.code,
    });
    return { status: 503, code: error.code };
  }
  console.error(error);
  return { status: 503, code: 'CLOUDFLARE_STREAM_UNAVAILABLE' };
}
