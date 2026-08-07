import { createHash } from 'node:crypto';
import { readSupabaseServerConfig } from './supabase-server.js';

export const WEEKLY_SCORE_MEMBER_PATH = '/guided-edition/weekly-score/';
export const WEEKLY_SCORE_DOWNLOAD_PATH = '/guided-edition/weekly-score/download/';
export const WEEKLY_SCORE_DOWNLOAD_NAME = 'USD_Impact_Weekly_Score_v1.1_Paid_Member_Package.zip';
export const WEEKLY_SCORE_ASSET_SHA256 = '10fb9a407a31e6ae0faef9b1f7dc4cdc74b38b353655e56e495eb88084be0b18';

const WEEKLY_SCORE_STORAGE_BUCKET = 'paid-member-assets';
const WEEKLY_SCORE_STORAGE_OBJECT = `weekly-score/v1.1/${WEEKLY_SCORE_DOWNLOAD_NAME}`;
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

export class PrivatePaidAssetError extends Error {
  constructor(message, { status = 502, code = 'PRIVATE_PAID_ASSET_FAILED' } = {}) {
    super(message);
    this.name = 'PrivatePaidAssetError';
    this.status = status;
    this.code = code;
  }
}

function encodeStoragePath(pathname) {
  return pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function assertExpectedAsset(bytes, expectedSha256) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_ASSET_BYTES) {
    throw new PrivatePaidAssetError('The private member asset was invalid.', {
      code: 'PRIVATE_PAID_ASSET_INVALID',
    });
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== expectedSha256) {
    throw new PrivatePaidAssetError('The private member asset did not match the frozen release.', {
      code: 'PRIVATE_PAID_ASSET_INTEGRITY_FAILED',
    });
  }

  return Object.freeze({ bytes, sha256, size: bytes.length });
}

export async function downloadWeeklyScoreMemberPackage({
  environment,
  config,
  fetchImpl = fetch,
  expectedSha256 = WEEKLY_SCORE_ASSET_SHA256,
} = {}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const storagePath = `${encodeURIComponent(WEEKLY_SCORE_STORAGE_BUCKET)}/${encodeStoragePath(WEEKLY_SCORE_STORAGE_OBJECT)}`;
  const response = await fetchImpl(`${resolvedConfig.url}/storage/v1/object/authenticated/${storagePath}`, {
    method: 'GET',
    headers: {
      Accept: 'application/zip',
      apikey: resolvedConfig.secretKey,
      Authorization: `Bearer ${resolvedConfig.secretKey}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new PrivatePaidAssetError('The private member asset is not currently available.', {
      status: response.status === 404 ? 503 : 502,
      code: response.status === 404 ? 'PRIVATE_PAID_ASSET_NOT_READY' : 'PRIVATE_PAID_ASSET_REQUEST_FAILED',
    });
  }

  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ASSET_BYTES) {
    throw new PrivatePaidAssetError('The private member asset exceeded the allowed size.', {
      code: 'PRIVATE_PAID_ASSET_TOO_LARGE',
    });
  }

  return assertExpectedAsset(Buffer.from(await response.arrayBuffer()), expectedSha256);
}
