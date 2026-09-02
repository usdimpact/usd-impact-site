import { PAID_PRODUCT_ID, authorizePaidAccess } from './paid-access.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS_TOKEN_PATTERN = /^[\x21-\x7E]{20,16384}$/;
const JSON_HEADERS = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

export class SupabaseConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SupabaseConfigurationError';
    this.code = 'SUPABASE_CONFIGURATION_ERROR';
  }
}

export class SupabaseRequestError extends Error {
  constructor(message, { status = 500, code = 'SUPABASE_REQUEST_FAILED', details = null } = {}) {
    super(message);
    this.name = 'SupabaseRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function requireUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new SupabaseConfigurationError('SUPABASE_URL is missing.');
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new SupabaseConfigurationError('SUPABASE_URL is invalid.');
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new SupabaseConfigurationError('SUPABASE_URL must use HTTPS outside localhost.');
  }
  return parsed.origin;
}

function requireKey(value, name, prefix) {
  if (typeof value !== 'string' || !value.startsWith(prefix) || value.length < prefix.length + 16) {
    throw new SupabaseConfigurationError(`${name} is missing or invalid.`);
  }
  return value;
}

export function readSupabaseServerConfig(
  environment = process.env,
  { requireSecret = false } = {},
) {
  return Object.freeze({
    url: requireUrl(environment.SUPABASE_URL),
    publishableKey: requireKey(
      environment.SUPABASE_PUBLISHABLE_KEY,
      'SUPABASE_PUBLISHABLE_KEY',
      'sb_publishable_',
    ),
    secretKey: requireSecret
      ? requireKey(environment.SUPABASE_SECRET_KEY, 'SUPABASE_SECRET_KEY', 'sb_secret_')
      : null,
  });
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) return value[0] ?? '';
  return typeof value === 'string' ? value : '';
}

export function requestHeader(request, name) {
  const headers = request?.headers;
  if (headers && typeof headers.get === 'function') return headers.get(name) ?? '';
  return normalizeHeaderValue(headers?.[name.toLowerCase()] ?? headers?.[name]);
}

export function readBearerToken(request) {
  const authorization = requestHeader(request, 'authorization').trim();
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !ACCESS_TOKEN_PATTERN.test(match[1])) return null;
  return match[1];
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function supabaseFetch({
  config,
  path,
  method = 'GET',
  accessToken = null,
  useSecret = false,
  body,
  headers = {},
  fetchImpl = fetch,
}) {
  if (useSecret && !config.secretKey) {
    throw new SupabaseConfigurationError('SUPABASE_SECRET_KEY is required for this operation.');
  }
  const apiKey = useSecret ? config.secretKey : config.publishableKey;
  const response = await fetchImpl(`${config.url}${path}`, {
    method,
    headers: {
      ...JSON_HEADERS,
      apikey: apiKey,
      Authorization: `Bearer ${accessToken || apiKey}`,
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.message || payload?.error_description || payload?.error || 'Supabase request failed.',
      {
        status: response.status,
        code: payload?.code || payload?.error_code || 'SUPABASE_REQUEST_FAILED',
        details: payload,
      },
    );
  }
  return payload;
}

function normalizeVerifiedUser(payload) {
  const id = payload?.id;
  const email = payload?.email;
  const emailConfirmedAt = payload?.email_confirmed_at || payload?.confirmed_at;
  if (!UUID_PATTERN.test(id || '') || typeof email !== 'string' || !emailConfirmedAt) {
    throw new SupabaseRequestError('A verified account is required.', {
      status: 401,
      code: 'VERIFIED_ACCOUNT_REQUIRED',
    });
  }
  return Object.freeze({
    id,
    email: email.trim().toLowerCase(),
    emailConfirmedAt,
  });
}

export async function getVerifiedSupabaseUser(accessToken, options = {}) {
  if (typeof accessToken !== 'string' || !ACCESS_TOKEN_PATTERN.test(accessToken)) {
    throw new SupabaseRequestError('Authentication is required.', {
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
  }
  const config = options.config || readSupabaseServerConfig(options.environment);
  const payload = await supabaseFetch({
    config,
    path: '/auth/v1/user',
    accessToken,
    fetchImpl: options.fetchImpl,
  });
  return normalizeVerifiedUser(payload);
}

function firstRow(payload) {
  return Array.isArray(payload) && payload.length > 0 ? payload[0] : null;
}

function profilePath(accountId) {
  return `/rest/v1/profiles?account_id=eq.${encodeURIComponent(accountId)}&select=account_id,email,status,deletion_requested_at,deletion_due_at,deleted_at,created_at,updated_at&limit=1`;
}

function entitlementPath(accountId, productId) {
  return `/rest/v1/entitlements?account_id=eq.${encodeURIComponent(accountId)}&product_id=eq.${encodeURIComponent(productId)}&select=id,account_id,product_id,state,starts_at,ends_at,version,updated_at&limit=1`;
}

export async function readAccountAccessState({
  accessToken,
  productId = PAID_PRODUCT_ID,
  environment,
  config,
  fetchImpl,
  nowMs = Date.now(),
}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const user = await getVerifiedSupabaseUser(accessToken, { config: resolvedConfig, fetchImpl });

  const [profiles, entitlements] = await Promise.all([
    supabaseFetch({
      config: resolvedConfig,
      path: profilePath(user.id),
      accessToken,
      fetchImpl,
    }),
    supabaseFetch({
      config: resolvedConfig,
      path: entitlementPath(user.id, productId),
      accessToken,
      fetchImpl,
    }),
  ]);

  const profile = firstRow(profiles);
  const entitlementRow = firstRow(entitlements);
  if (!profile || profile.account_id !== user.id) {
    return Object.freeze({ user, profile: null, entitlement: null, allowed: false, reason: 'missing-profile' });
  }
  if (profile.status !== 'active') {
    return Object.freeze({ user, profile, entitlement: entitlementRow, allowed: false, reason: profile.status });
  }

  const entitlement = entitlementRow
    ? {
        id: entitlementRow.id,
        accountId: entitlementRow.account_id,
        productId: entitlementRow.product_id,
        state: entitlementRow.state,
        startsAt: entitlementRow.starts_at,
        endsAt: entitlementRow.ends_at,
        version: entitlementRow.version,
        updatedAt: entitlementRow.updated_at,
      }
    : null;
  const authorization = authorizePaidAccess(entitlement, productId, nowMs);

  return Object.freeze({
    user,
    profile,
    entitlement,
    allowed: authorization.allowed,
    reason: authorization.reason,
  });
}

const VIDEO_CONTENT_ID_PATTERN = /^video:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VIDEO_PROGRESS_STATUSES = new Set(['started', 'in_progress', 'completed']);

function requireAccountId(value) {
  const accountId = String(value || '').trim();
  if (!UUID_PATTERN.test(accountId)) throw new TypeError('A valid account ID is required.');
  return accountId;
}

function requireVideoContentId(value) {
  const contentId = String(value || '').trim();
  if (!VIDEO_CONTENT_ID_PATTERN.test(contentId)) throw new TypeError('A valid video content ID is required.');
  return contentId;
}

function ownVideoProgressPath(accountId, contentId = null) {
  const base = `/rest/v1/learning_progress?account_id=eq.${encodeURIComponent(accountId)}`;
  const filter = contentId
    ? `&content_id=eq.${encodeURIComponent(contentId)}`
    : '&content_id=like.video:*';
  return `${base}${filter}&select=account_id,content_id,status,progress_percent,resume_position,attempt_count,completed_at,data,created_at,updated_at&order=content_id.asc`;
}

export async function readOwnVideoProgress({
  accessToken,
  accountId,
  contentId = null,
  environment,
  config,
  fetchImpl,
}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const normalizedAccountId = requireAccountId(accountId);
  const normalizedContentId = contentId ? requireVideoContentId(contentId) : null;
  const rows = await supabaseFetch({
    config: resolvedConfig,
    path: ownVideoProgressPath(normalizedAccountId, normalizedContentId),
    accessToken,
    fetchImpl,
  });
  return Object.freeze(Array.isArray(rows) ? rows.map((row) => Object.freeze({ ...row })) : []);
}

function ownLearningProgressPath(accountId) {
  return `/rest/v1/learning_progress?account_id=eq.${encodeURIComponent(accountId)}&select=content_id,status,progress_percent,resume_position,completed_at,updated_at&order=updated_at.desc&limit=500`;
}

export async function readOwnLearningProgress({
  accessToken,
  accountId,
  environment,
  config,
  fetchImpl,
}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const normalizedAccountId = requireAccountId(accountId);
  const rows = await supabaseFetch({
    config: resolvedConfig,
    path: ownLearningProgressPath(normalizedAccountId),
    accessToken,
    fetchImpl,
  });
  return Object.freeze(Array.isArray(rows) ? rows.map((row) => Object.freeze({ ...row })) : []);
}

export async function upsertOwnVideoProgress({
  accessToken,
  accountId,
  contentId,
  status,
  progressPercent,
  resumePositionSeconds,
  durationSeconds,
  environment,
  config,
  fetchImpl,
  now = new Date(),
}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const normalizedAccountId = requireAccountId(accountId);
  const normalizedContentId = requireVideoContentId(contentId);
  if (!VIDEO_PROGRESS_STATUSES.has(status)) throw new TypeError('Video progress status is invalid.');
  const position = Number(resumePositionSeconds);
  const duration = Number(durationSeconds);
  const percent = Number(progressPercent);
  if (!Number.isFinite(position) || position < 0 || position > 86_400) throw new TypeError('Video resume position is invalid.');
  if (!Number.isFinite(duration) || duration <= 0 || duration > 86_400) throw new TypeError('Video duration is invalid.');
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new TypeError('Video progress percentage is invalid.');

  const existingRows = await readOwnVideoProgress({
    accessToken,
    accountId: normalizedAccountId,
    contentId: normalizedContentId,
    config: resolvedConfig,
    fetchImpl,
  });
  const existing = existingRows[0] || null;
  const remainsCompleted = existing?.status === 'completed';
  const resolvedStatus = remainsCompleted ? 'completed' : status;
  const resolvedPercent = resolvedStatus === 'completed' ? 100 : percent;
  const body = {
    account_id: normalizedAccountId,
    content_id: normalizedContentId,
    status: resolvedStatus,
    progress_percent: resolvedPercent,
    resume_position: position.toFixed(1),
    data: {
      contentType: 'video',
      durationSeconds: Number(duration.toFixed(3)),
    },
    ...(resolvedStatus === 'completed'
      ? { completed_at: existing?.completed_at || now.toISOString() }
      : {}),
  };
  const rows = await supabaseFetch({
    config: resolvedConfig,
    path: '/rest/v1/learning_progress?on_conflict=account_id,content_id',
    method: 'POST',
    accessToken,
    body,
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    fetchImpl,
  });
  return Object.freeze({ ...(firstRow(rows) || body) });
}

export async function exportOwnAccount({ accessToken, environment, config, fetchImpl }) {
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const user = await getVerifiedSupabaseUser(accessToken, { config: resolvedConfig, fetchImpl });
  const payload = await supabaseFetch({
    config: resolvedConfig,
    path: '/rest/v1/rpc/account_export',
    method: 'POST',
    accessToken,
    body: { export_account_id: user.id },
    fetchImpl,
  });
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    accountId: user.id,
    data: payload,
  });
}

export async function requestOwnAccountDeletion({ accessToken, environment, config, fetchImpl }) {
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const user = await getVerifiedSupabaseUser(accessToken, { config: resolvedConfig, fetchImpl });
  const profile = await supabaseFetch({
    config: resolvedConfig,
    path: '/rest/v1/rpc/request_account_deletion',
    method: 'POST',
    accessToken,
    body: {},
    fetchImpl,
  });
  return Object.freeze({ user, profile });
}

export function sendJson(response, status, payload, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(payload));
}

export function safeSupabaseError(error) {
  if (error instanceof SupabaseRequestError) {
    return {
      status: error.status >= 400 && error.status < 600 ? error.status : 500,
      payload: { error: error.message, code: error.code },
    };
  }
  if (error instanceof SupabaseConfigurationError) {
    console.error(error.message);
    return {
      status: 503,
      payload: { error: 'Account services are temporarily unavailable.', code: error.code },
    };
  }
  console.error(error);
  return {
    status: 500,
    payload: { error: 'Account services are temporarily unavailable.', code: 'INTERNAL_ERROR' },
  };
}
