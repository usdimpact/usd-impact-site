import { readSupabaseServerConfig } from './supabase-server.js';

export const BOOK_MEMBER_PATH = '/guided-edition/book/';
export const BOOK_DOWNLOAD_PATH = '/guided-edition/book/download/';
export const PRIVATE_BOOK_BUCKET = 'library-pass-books';
export const PRIVATE_BOOK_PREFIX = 'book/read-the-dollar-first/edition-1.3';
export const BOOK_SIGNED_URL_TTL_SECONDS = 300;

export const privateBookDocument = Object.freeze({
  title: 'Read the Dollar First',
  edition: '1.3',
  build: 'v5.95 Phase 2C Scoped Candidate 2',
  file: 'USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf',
  size: 2281645,
  sha256: 'b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666',
  accessibility: 'This private digital-reader PDF is untagged and is not PDF/UA-conformant. This limitation is accepted for private Library Pass delivery. The PDF must not be represented as PDF/UA-conformant.',
  objectPath: `${PRIVATE_BOOK_PREFIX}/USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf`,
});

function privateBookError(message, { code, status = 503 } = {}) {
  const error = new Error(message);
  error.name = 'PrivateBookError';
  error.code = code || 'PRIVATE_BOOK_UNAVAILABLE';
  error.status = status;
  return error;
}

function encodeStoragePath(value) {
  return String(value).split('/').map(encodeURIComponent).join('/');
}

function requireSignedUrl(payload, config) {
  const raw = payload?.signedURL || payload?.signedUrl;
  if (typeof raw !== 'string' || !raw.trim()) {
    throw privateBookError('The private book URL could not be created.', { code: 'INVALID_SIGNED_URL' });
  }

  const expectedPath = `/storage/v1/object/sign/${encodeStoragePath(PRIVATE_BOOK_BUCKET)}/${encodeStoragePath(privateBookDocument.objectPath)}`;
  const candidate = raw.startsWith('/object/sign/')
    ? `${config.url}/storage/v1${raw}`
    : new URL(raw, `${config.url}/`).toString();
  const signedUrl = new URL(candidate);
  if (
    signedUrl.origin !== config.url
    || signedUrl.pathname !== expectedPath
    || !signedUrl.searchParams.get('token')
  ) {
    throw privateBookError('The private book URL failed validation.', { code: 'INVALID_SIGNED_URL' });
  }
  return signedUrl.toString();
}

export async function createSignedBookUrl({
  environment = process.env,
  config,
  fetchImpl = fetch,
  expiresIn = BOOK_SIGNED_URL_TTL_SECONDS,
} = {}) {
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 900) {
    throw privateBookError('The private book expiry is invalid.', { code: 'INVALID_SIGNED_URL_EXPIRY', status: 500 });
  }

  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const endpoint = `${resolvedConfig.url}/storage/v1/object/sign/${encodeStoragePath(PRIVATE_BOOK_BUCKET)}/${encodeStoragePath(privateBookDocument.objectPath)}`;
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        apikey: resolvedConfig.secretKey,
        Authorization: `Bearer ${resolvedConfig.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn }),
    });
  } catch {
    throw privateBookError('The private book is temporarily unavailable.', { code: 'BOOK_STORAGE_UNAVAILABLE' });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // A missing or malformed response remains a fail-closed storage error.
  }
  if (!response.ok) {
    throw privateBookError('The private book is temporarily unavailable.', {
      code: 'BOOK_SIGNING_FAILED',
      status: response.status >= 500 ? 503 : 502,
    });
  }
  return requireSignedUrl(payload, resolvedConfig);
}
