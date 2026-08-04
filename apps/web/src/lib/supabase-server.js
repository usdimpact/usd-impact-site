import { PAID_PRODUCT_ID, authorizePaidAccess } from './paid-access.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS_TOKEN_PATTERN = /^[\x21-\x7E]{20,16384}$/;
const JSON_HEADERS = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
});
const SUPPORT_SUBJECTS = Object.freeze({
  payment_confirmation: 'Payment confirmation or access',
  duplicate_charge: 'Possible duplicate charge',
  refund: 'Refund question',
  invoice: 'Invoice or receipt question',
  other_billing: 'Other billing question',
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

function purchaseIntentPath(accountId, productId) {
  return `/rest/v1/purchase_intents?account_id=eq.${encodeURIComponent(accountId)}&product_id=eq.${encodeURIComponent(productId)}&select=id,status,provider_checkout_id,expires_at,created_at,updated_at&order=created_at.desc&limit=1`;
}

function requireAccountId(accountId) {
  if (!UUID_PATTERN.test(accountId || '')) {
    throw new SupabaseRequestError('A valid account is required.', {
      status: 400,
      code: 'INVALID_ACCOUNT_ID',
    });
  }
  return accountId;
}

function requireGuidedContentId(contentId) {
  const normalized = typeof contentId === 'string' ? contentId.trim() : '';
  if (!/^guided-edition:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new SupabaseRequestError('A valid Guided Edition chapter is required.', {
      status: 400,
      code: 'INVALID_GUIDED_CONTENT',
    });
  }
  return normalized;
}

function requireGuidedSlug(slug) {
  const normalized = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(normalized)) {
    throw new SupabaseRequestError('A valid Guided Edition chapter is required.', {
      status: 400,
      code: 'INVALID_GUIDED_CONTENT',
    });
  }
  return normalized;
}

function learningProgressPath(accountId, contentId) {
  return `/rest/v1/learning_progress?account_id=eq.${encodeURIComponent(accountId)}&content_id=eq.${encodeURIComponent(contentId)}&select=account_id,content_id,status,progress_percent,resume_position,mastery_score,attempt_count,completed_at,data,updated_at&limit=1`;
}

const GUIDED_CONTENT_RELEASE_SELECT = 'content_id,version,chapter_number,slug,status,source_sha256,reader_sha256,payload';

function guidedContentReleasePath({ contentId, slug }) {
  const identity = contentId
    ? `content_id=eq.${encodeURIComponent(contentId)}`
    : `slug=eq.${encodeURIComponent(slug)}`;
  return `/rest/v1/guided_content_releases?${identity}&status=eq.published&select=${GUIDED_CONTENT_RELEASE_SELECT}&limit=1`;
}

function guidedContentCatalogPath() {
  return `/rest/v1/guided_content_releases?status=eq.published&select=${GUIDED_CONTENT_RELEASE_SELECT}&order=chapter_number.asc`;
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

  const [profiles, entitlements, purchaseIntents] = await Promise.all([
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
    supabaseFetch({
      config: resolvedConfig,
      path: purchaseIntentPath(user.id, productId),
      accessToken,
      fetchImpl,
    }),
  ]);

  const profile = firstRow(profiles);
  const entitlementRow = firstRow(entitlements);
  const purchaseIntentRow = firstRow(purchaseIntents);
  const checkout = purchaseIntentRow
    ? Object.freeze({
        id: purchaseIntentRow.id,
        status: purchaseIntentRow.status,
        transactionId: purchaseIntentRow.provider_checkout_id,
        expiresAt: purchaseIntentRow.expires_at,
        createdAt: purchaseIntentRow.created_at,
        updatedAt: purchaseIntentRow.updated_at,
      })
    : null;
  if (!profile || profile.account_id !== user.id) {
    return Object.freeze({ user, profile: null, entitlement: null, checkout, allowed: false, reason: 'missing-profile' });
  }
  if (profile.status !== 'active') {
    return Object.freeze({ user, profile, entitlement: entitlementRow, checkout, allowed: false, reason: profile.status });
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
    checkout,
    allowed: authorization.allowed,
    reason: authorization.reason,
  });
}

export async function readGuidedLearningProgress({
  accessToken,
  accountId,
  contentId,
  environment,
  config,
  fetchImpl,
}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const validAccountId = requireAccountId(accountId);
  const validContentId = requireGuidedContentId(contentId);
  const rows = await supabaseFetch({
    config: resolvedConfig,
    path: learningProgressPath(validAccountId, validContentId),
    accessToken,
    fetchImpl,
  });
  return firstRow(rows);
}

export async function readGuidedContentRelease({
  contentId,
  slug,
  environment,
  config,
  fetchImpl,
}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  if (Boolean(contentId) === Boolean(slug)) {
    throw new SupabaseRequestError('Choose exactly one Guided Edition chapter identity.', {
      status: 400,
      code: 'INVALID_GUIDED_CONTENT',
    });
  }
  const identity = contentId
    ? { contentId: requireGuidedContentId(contentId), slug: null }
    : { contentId: null, slug: requireGuidedSlug(slug) };
  const rows = await supabaseFetch({
    config: resolvedConfig,
    path: guidedContentReleasePath(identity),
    useSecret: true,
    fetchImpl,
  });
  return firstRow(rows);
}

export async function readGuidedContentCatalog({
  environment,
  config,
  fetchImpl,
} = {}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const rows = await supabaseFetch({
    config: resolvedConfig,
    path: guidedContentCatalogPath(),
    useSecret: true,
    fetchImpl,
  });
  return Array.isArray(rows) ? rows : [];
}

export async function recordGuidedLearningProgress({
  accountId,
  contentId,
  progressPercent,
  resumePosition,
  contentVersion,
  masteryScore = null,
  attemptIncrement = 0,
  masteryPassed = false,
  environment,
  config,
  fetchImpl,
}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const validAccountId = requireAccountId(accountId);
  const validContentId = requireGuidedContentId(contentId);
  const payload = await supabaseFetch({
    config: resolvedConfig,
    path: '/rest/v1/rpc/record_guided_learning_progress',
    method: 'POST',
    useSecret: true,
    body: {
      p_account_id: validAccountId,
      p_content_id: validContentId,
      p_progress_percent: progressPercent,
      p_resume_position: resumePosition,
      p_content_version: contentVersion,
      p_mastery_score: masteryScore,
      p_attempt_increment: attemptIncrement,
      p_mastery_passed: masteryPassed,
    },
    fetchImpl,
  });
  const recorded = Array.isArray(payload) ? firstRow(payload) : payload;
  if (!recorded || typeof recorded !== 'object') {
    throw new SupabaseRequestError('Learning progress could not be recorded.', {
      status: 502,
      code: 'LEARNING_PROGRESS_NOT_RECORDED',
    });
  }
  return recorded;
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

export async function createOwnSupportRequest({
  accessToken,
  category,
  message,
  environment,
  config,
  fetchImpl,
}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const user = await getVerifiedSupabaseUser(accessToken, { config: resolvedConfig, fetchImpl });
  const normalizedCategory = typeof category === 'string' ? category.trim().toLowerCase() : '';
  const subject = SUPPORT_SUBJECTS[normalizedCategory];
  if (!subject) {
    throw new SupabaseRequestError('Choose a valid billing-support category.', {
      status: 400,
      code: 'INVALID_SUPPORT_CATEGORY',
    });
  }

  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  if (normalizedMessage.length < 20 || normalizedMessage.length > 2000) {
    throw new SupabaseRequestError('Support message must be between 20 and 2,000 characters.', {
      status: 400,
      code: 'INVALID_SUPPORT_MESSAGE',
    });
  }

  const createdRows = await supabaseFetch({
    config: resolvedConfig,
    path: '/rest/v1/support_requests?select=id,category,subject,status,created_at',
    method: 'POST',
    accessToken,
    body: {
      account_id: user.id,
      email: user.email,
      category: normalizedCategory,
      subject,
      message: normalizedMessage,
    },
    headers: { Prefer: 'return=representation' },
    fetchImpl,
  });
  const created = firstRow(createdRows);
  if (!created?.id) {
    throw new SupabaseRequestError('Support request could not be created.', {
      status: 502,
      code: 'SUPPORT_REQUEST_NOT_CREATED',
    });
  }
  return Object.freeze({
    id: created.id,
    category: created.category,
    subject: created.subject,
    status: created.status,
    createdAt: created.created_at,
  });
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
