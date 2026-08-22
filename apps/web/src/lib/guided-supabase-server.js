import {
  SupabaseRequestError,
  readSupabaseServerConfig,
} from './supabase-server.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GUIDED_CONTENT_ID_PATTERN = /^guided-edition:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GUIDED_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const JSON_HEADERS = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

function firstRow(payload) {
  return Array.isArray(payload) && payload.length > 0 ? payload[0] : null;
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

async function guidedSupabaseFetch({
  config,
  path,
  method = 'GET',
  accessToken = null,
  useSecret = false,
  body,
  headers = {},
  fetchImpl = fetch,
}) {
  const apiKey = useSecret ? config.secretKey : config.publishableKey;
  if (!apiKey) {
    throw new SupabaseRequestError('Guided Edition data access is not configured.', {
      status: 503,
      code: 'GUIDED_SUPABASE_CONFIGURATION_ERROR',
    });
  }
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
      payload?.message || payload?.error_description || payload?.error || 'Guided Edition data request failed.',
      {
        status: response.status,
        code: payload?.code || payload?.error_code || 'GUIDED_SUPABASE_REQUEST_FAILED',
        details: payload,
      },
    );
  }
  return payload;
}

function requireAccountId(value) {
  const accountId = String(value || '').trim();
  if (!UUID_PATTERN.test(accountId)) {
    throw new SupabaseRequestError('A valid account is required.', {
      status: 400,
      code: 'INVALID_ACCOUNT_ID',
    });
  }
  return accountId;
}

function requireContentId(value) {
  const contentId = String(value || '').trim();
  if (!GUIDED_CONTENT_ID_PATTERN.test(contentId)) {
    throw new SupabaseRequestError('A valid Guided Edition chapter is required.', {
      status: 400,
      code: 'INVALID_GUIDED_CONTENT',
    });
  }
  return contentId;
}

function requireSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  if (!GUIDED_SLUG_PATTERN.test(slug)) {
    throw new SupabaseRequestError('A valid Guided Edition page is required.', {
      status: 400,
      code: 'INVALID_GUIDED_CONTENT',
    });
  }
  return slug;
}

function learningProgressPath(accountId, contentId) {
  return `/rest/v1/learning_progress?account_id=eq.${encodeURIComponent(accountId)}&content_id=eq.${encodeURIComponent(contentId)}&select=account_id,content_id,status,progress_percent,resume_position,mastery_score,attempt_count,completed_at,data,updated_at&limit=1`;
}

const GUIDED_CONTENT_RELEASE_SELECT = 'content_id,version,chapter_number,slug,status,source_sha256,reader_sha256,payload';
const GUIDED_SUPPLEMENT_RELEASE_SELECT = 'content_id,version,slug,supplement_type,sort_order,status,source_sha256,reader_sha256,payload';

function guidedContentReleasePath({ contentId, slug }) {
  const identity = contentId
    ? `content_id=eq.${encodeURIComponent(contentId)}`
    : `slug=eq.${encodeURIComponent(slug)}`;
  return `/rest/v1/guided_content_releases?${identity}&status=eq.published&select=${GUIDED_CONTENT_RELEASE_SELECT}&limit=1`;
}

function guidedContentCatalogPath() {
  return `/rest/v1/guided_content_releases?status=eq.published&select=${GUIDED_CONTENT_RELEASE_SELECT}&order=chapter_number.asc`;
}

function guidedSupplementReleasePath(slug) {
  return `/rest/v1/guided_supplement_releases?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=${GUIDED_SUPPLEMENT_RELEASE_SELECT}&limit=1`;
}

function guidedSupplementCatalogPath() {
  return `/rest/v1/guided_supplement_releases?status=eq.published&select=${GUIDED_SUPPLEMENT_RELEASE_SELECT}&order=sort_order.asc`;
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
  const rows = await guidedSupabaseFetch({
    config: resolvedConfig,
    path: learningProgressPath(requireAccountId(accountId), requireContentId(contentId)),
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
    ? { contentId: requireContentId(contentId), slug: null }
    : { contentId: null, slug: requireSlug(slug) };
  const rows = await guidedSupabaseFetch({
    config: resolvedConfig,
    path: guidedContentReleasePath(identity),
    useSecret: true,
    fetchImpl,
  });
  return firstRow(rows);
}

export async function readGuidedContentCatalog({ environment, config, fetchImpl } = {}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const rows = await guidedSupabaseFetch({
    config: resolvedConfig,
    path: guidedContentCatalogPath(),
    useSecret: true,
    fetchImpl,
  });
  return Array.isArray(rows) ? rows : [];
}

export async function readGuidedSupplementRelease({ slug, environment, config, fetchImpl }) {
  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const rows = await guidedSupabaseFetch({
    config: resolvedConfig,
    path: guidedSupplementReleasePath(requireSlug(slug)),
    useSecret: true,
    fetchImpl,
  });
  return firstRow(rows);
}

export async function readGuidedSupplementCatalog({ environment, config, fetchImpl } = {}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const rows = await guidedSupabaseFetch({
    config: resolvedConfig,
    path: guidedSupplementCatalogPath(),
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
  const payload = await guidedSupabaseFetch({
    config: resolvedConfig,
    path: '/rest/v1/rpc/record_guided_learning_progress',
    method: 'POST',
    useSecret: true,
    body: {
      p_account_id: requireAccountId(accountId),
      p_content_id: requireContentId(contentId),
      p_progress_percent: progressPercent,
      p_resume_position: resumePosition,
      p_content_version: contentVersion,
      p_mastery_score: masteryScore,
      p_attempt_increment: attemptIncrement,
      p_mastery_passed: masteryPassed,
    },
    fetchImpl,
  });
  return Array.isArray(payload) ? firstRow(payload) : payload;
}
