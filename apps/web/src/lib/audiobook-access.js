import { issueSignedToken, presignUrl } from '@vercel/blob';

export const AUDIOBOOK_SIGNED_URL_TTL_MS = 60 * 60 * 1000;

const PRIVATE_BLOB_HOST_SUFFIX = '.private.blob.vercel-storage.com';
const PRIVATE_STORE_ID_PATTERN = /^store_[A-Za-z0-9]+$/;
const READ_WRITE_TOKEN_PREFIX = 'vercel_blob_rw_';
const ALLOWED_METHODS = new Map([
  ['GET', 'get'],
  ['HEAD', 'head'],
]);

export class AudiobookDeliveryError extends Error {
  constructor(message, code = 'AUDIOBOOK_DELIVERY_UNAVAILABLE') {
    super(message);
    this.name = 'AudiobookDeliveryError';
    this.code = code;
  }
}

function requirePrivateBlobConfig(environment = process.env) {
  const storeId = String(environment?.AUDIOBOOK_BLOB_STORE_ID || '').trim();
  const token = String(environment?.AUDIOBOOK_BLOB_READ_WRITE_TOKEN || '').trim();
  if (!PRIVATE_STORE_ID_PATTERN.test(storeId)) {
    throw new AudiobookDeliveryError(
      'The private audiobook store ID was missing or invalid.',
      'INVALID_AUDIOBOOK_STORE_ID',
    );
  }
  if (!token.startsWith(READ_WRITE_TOKEN_PREFIX) || token.length < READ_WRITE_TOKEN_PREFIX.length + 16) {
    throw new AudiobookDeliveryError(
      'The private audiobook store token was missing or invalid.',
      'INVALID_AUDIOBOOK_STORE_TOKEN',
    );
  }

  const normalizedStoreId = storeId.slice('store_'.length).toLowerCase();
  const tokenStoreId = token.split('_')[3]?.toLowerCase();
  if (!tokenStoreId || tokenStoreId !== normalizedStoreId) {
    throw new AudiobookDeliveryError(
      'The private audiobook store credentials did not match.',
      'AUDIOBOOK_STORE_MISMATCH',
    );
  }
  return Object.freeze({
    storeId,
    token,
    hostname: `${normalizedStoreId}${PRIVATE_BLOB_HOST_SUFFIX}`,
  });
}

function requirePrivateBlobUrl(value, expectedHostname) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new AudiobookDeliveryError('The signed audiobook URL was invalid.');
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.hostname !== expectedHostname
  ) {
    throw new AudiobookDeliveryError('The signed audiobook URL did not use private Blob storage.');
  }
  return parsed.toString();
}

export async function createPrivateAudiobookUrl({
  pathname,
  method = 'GET',
  nowMs = Date.now(),
  environment = process.env,
  issueToken = issueSignedToken,
  presign = presignUrl,
}) {
  const normalizedPathname = String(pathname || '').trim();
  const operation = ALLOWED_METHODS.get(String(method || '').toUpperCase());
  if (!normalizedPathname || normalizedPathname.startsWith('/') || normalizedPathname.includes('..')) {
    throw new AudiobookDeliveryError('The audiobook pathname was invalid.', 'INVALID_AUDIOBOOK_PATH');
  }
  if (!operation) {
    throw new AudiobookDeliveryError('The audiobook request method was invalid.', 'INVALID_AUDIOBOOK_METHOD');
  }
  if (!Number.isFinite(nowMs)) {
    throw new AudiobookDeliveryError('The audiobook request time was invalid.', 'INVALID_AUDIOBOOK_TIME');
  }

  const privateStore = requirePrivateBlobConfig(environment);
  const validUntil = Math.floor(nowMs) + AUDIOBOOK_SIGNED_URL_TTL_MS;
  const signedToken = await issueToken({
    pathname: normalizedPathname,
    operations: [operation],
    validUntil,
    token: privateStore.token,
  });
  const signed = await presign(signedToken, {
    access: 'private',
    operation,
    pathname: normalizedPathname,
    validUntil,
  });

  return Object.freeze({
    url: requirePrivateBlobUrl(signed?.presignedUrl, privateStore.hostname),
    validUntil,
  });
}
