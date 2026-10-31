import {
  readAccountAccessState,
  readSupabaseServerConfig,
  requestHeader,
  safeSupabaseError,
  sendJson,
  SupabaseRequestError,
} from './supabase-server.js';
import { resolveSessionWithRefresh } from './supabase-auth.js';

const DEV_PROJECT_HOST = 'ycstrcvshdluovtuasjc.supabase.co';
const LOCALE_TABLE = 'account_media_locale_preferences';
const SELECT_FIELDS = 'account_id,preferred_media_locale,selection_provenance,revision,updated_at';
const LOCALE_OPTIONS = Object.freeze(['en', 'es']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uiEnabled(environment) {
  return environment.ACCOUNT_MEDIA_LOCALE_UI_ENABLED === 'true'
    && environment.VERCEL_ENV === 'preview'
    && environment.VERCEL_GIT_COMMIT_REF === 'draft/media-language-es-captions-preview-20261031';
}
function writeEnabled(environment) {
  return uiEnabled(environment)
    && environment.ACCOUNT_MEDIA_LOCALE_WRITE_ENABLED === 'true';
}
function fail(status, code, message) {
  return new SupabaseRequestError(message, { status, code });
}
function errorResponse(response, error) {
  const safe = safeSupabaseError(error);
  return sendJson(response, safe.status, safe.payload);
}
function deny(response, status, code, message) {
  return sendJson(response, status, { error: message, code });
}
function validSameOriginWrite(request) {
  const site = requestHeader(request, 'sec-fetch-site').trim().toLowerCase();
  if (site !== 'same-origin') return false;
  const origin = requestHeader(request, 'origin').trim();
  const host = requestHeader(request, 'host').trim().toLowerCase();
  if (!host || !origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host.toLowerCase() === host
      && (parsed.protocol === 'https:'
        || (parsed.protocol === 'http:' && /^localhost(?::\d+)?$/.test(host)));
  } catch {
    return false;
  }
}
function parseLocaleRequest(request) {
  const contentType = requestHeader(request, 'content-type').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw fail(415, 'MEDIA_LOCALE_JSON_REQUIRED', 'Use application/json.');
  }
  const raw = request.body;
  let value;
  if (Buffer.isBuffer(raw) || typeof raw === 'string') {
    const text = String(raw);
    if (text.length > 512) {
      throw fail(413, 'MEDIA_LOCALE_REQUEST_TOO_LARGE', 'The request is too large.');
    }
    try { value = JSON.parse(text); }
    catch { throw fail(400, 'MEDIA_LOCALE_INVALID_REQUEST', 'Invalid request body.'); }
  } else {
    value = raw;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 1
    || !Object.prototype.hasOwnProperty.call(value, 'locale')
    || !LOCALE_OPTIONS.includes(value.locale)) {
    throw fail(400, 'MEDIA_LOCALE_INVALID_SELECTION', 'Choose English or Spanish media.');
  }
  return value.locale;
}
function normalizeRow(row, accountId) {
  if (!row || typeof row !== 'object' || row.account_id !== accountId
    || !LOCALE_OPTIONS.includes(row.preferred_media_locale)
    || row.selection_provenance !== 'authenticated_media_account'
    || !Number.isInteger(row.revision) || row.revision < 1
    || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))) {
    throw fail(503, 'MEDIA_LOCALE_RECORD_UNVERIFIED', 'Media language preference is unavailable.');
  }
  return Object.freeze({
    locale: row.preferred_media_locale,
    source: 'verified_account',
    revision: row.revision,
    updatedAt: row.updated_at,
  });
}
function checkDatabaseConfig(config) {
  let url;
  try { url = new URL(config.url); } catch {
    throw fail(503, 'MEDIA_LOCALE_DEV_PROJECT_HOLD', 'Media language preference is unavailable.');
  }
  if (url.protocol !== 'https:' || url.hostname !== DEV_PROJECT_HOST
    || url.pathname !== '/' || url.search || url.hash
    || typeof config.publishableKey !== 'string'
    || !config.publishableKey.startsWith('sb_publishable_')
    || config.secretKey) {
    throw fail(503, 'MEDIA_LOCALE_DEV_PROJECT_HOLD', 'Media language preference is unavailable.');
  }
}
async function requestPreference({ config, accessToken, accountId, locale, fetchImpl }) {
  const accountFilter = 'account_id=eq.' + encodeURIComponent(accountId);
  const base = config.url + '/rest/v1/' + LOCALE_TABLE;
  // A generic PostgREST UPSERT can include account_id in its UPDATE
  // columns, but authenticated roles intentionally have UPDATE privilege
  // only for preferred_media_locale. Do not broaden those grants. Read the
  // current row and then use INSERT or PATCH with the minimum required
  // columns, both still checked by RLS on auth.uid().
  const existing = locale === undefined ? null : await requestPreference({
    config, accessToken, accountId, fetchImpl,
  });
  if (locale !== undefined && existing.source === 'verified_account' && existing.locale === locale) {
    return existing;
  }
  const updating = locale !== undefined && existing.source === 'verified_account';
  const method = locale === undefined ? 'GET' : updating ? 'PATCH' : 'POST';
  const query = locale === undefined
    ? '?' + accountFilter + '&select=' + SELECT_FIELDS + '&limit=2'
    : updating
      ? '?' + accountFilter + '&select=' + SELECT_FIELDS
      : '?select=' + SELECT_FIELDS;
  const writeBody = updating
    ? { preferred_media_locale: locale }
    : { account_id: accountId, preferred_media_locale: locale };
  let response;
  try {
    response = await fetchImpl(base + query, {
      method,
      headers: {
        Accept: 'application/json',
        apikey: config.publishableKey,
        Authorization: 'Bearer ' + accessToken,
        ...(locale === undefined ? {} : {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
      },
      ...(locale === undefined ? {} : { body: JSON.stringify(writeBody) }),
    });
  } catch {
    throw fail(503, 'MEDIA_LOCALE_REST_UNAVAILABLE', 'Media language preference is unavailable.');
  }
  if (!response?.ok) {
    // A concurrent insert/update race may return a conflict. Do not attempt
    // a privileged retry, user-selected account ID, or an outbox action.
    throw fail(503, 'MEDIA_LOCALE_REST_DENIED', 'Media language preference is unavailable.');
  }
  let payload;
  try { payload = await response.json(); }
  catch { throw fail(503, 'MEDIA_LOCALE_REST_INVALID', 'Media language preference is unavailable.'); }
  if (!Array.isArray(payload) || payload.length > 1
    || (locale !== undefined && payload.length !== 1)) {
    throw fail(503, 'MEDIA_LOCALE_REST_INVALID', 'Media language preference is unavailable.');
  }
  if (payload.length === 0) {
    return Object.freeze({
      locale: 'en',
      source: 'english_fallback',
      revision: null,
      updatedAt: null,
    });
  }
  const record = normalizeRow(payload[0], accountId);
  if (locale !== undefined && record.locale !== locale) {
    throw fail(503, 'MEDIA_LOCALE_WRITE_NOT_VERIFIED', 'Media language preference was not confirmed.');
  }
  return record;
}

export async function handleMediaLocaleRequest(
  request, response, dependencies = {},
) {
  const environment = dependencies.environment || process.env;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  // Never expose this route in Production, even if someone mistakenly
  // configures the feature flags there. Disabled means 404, no Auth/DB call.
  if (!uiEnabled(environment)) {
    return deny(response, 404, 'MEDIA_LOCALE_UI_DISABLED', 'Media language settings are unavailable.');
  }
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return deny(response, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  }
  if (request.method === 'POST' && !writeEnabled(environment)) {
    return deny(response, 403, 'MEDIA_LOCALE_WRITE_DISABLED', 'Media language changes are not enabled.');
  }
  if (request.method === 'POST' && !validSameOriginWrite(request)) {
    return deny(response, 403, 'MEDIA_LOCALE_SAME_ORIGIN_REQUIRED', 'Same-origin verification is required.');
  }

  let locale;
  if (request.method === 'POST') {
    try { locale = parseLocaleRequest(request); }
    catch (error) { return errorResponse(response, error); }
  }

  try {
    const config = dependencies.config || readSupabaseServerConfig(environment);
    checkDatabaseConfig(config);
    const resolveSession = dependencies.resolveSessionWithRefresh || resolveSessionWithRefresh;
    const readAccess = dependencies.readAccountAccessState || readAccountAccessState;
    const fetchImpl = dependencies.fetchImpl || fetch;
    const session = await resolveSession({
      request,
      response,
      environment,
      config,
      fetchImpl,
      verifyAccessToken: (accessToken) => readAccess({
        accessToken, environment, config, fetchImpl,
      }),
    });
    if (!session) {
      return deny(response, 401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    }
    const state = session.value;
    const accountId = state?.user?.id;
    if (typeof accountId !== 'string' || !UUID_PATTERN.test(accountId)
      || state?.profile?.account_id !== accountId || state.profile.status !== 'active'
      || typeof session.accessToken !== 'string' || session.accessToken.length < 20
      || !state.user?.emailConfirmedAt) {
      return deny(response, 403, 'MEDIA_LOCALE_ACCOUNT_INACTIVE', 'An active verified account is required.');
    }
    const saved = await requestPreference({
      config, accessToken: session.accessToken,
      accountId, locale, fetchImpl,
    });
    return sendJson(response, 200, {
      enabled: true,
      writable: writeEnabled(environment),
      ...saved,
      // Media choice never edits purchase-access notices, checkout receipts,
      // marketing consent or any prior notification snapshot.
      marketingConsentChanged: false,
      notificationsEnabled: false,
      mediaPreferenceOnly: true,
      spanishNarrationReleased: false,
      existingFilmSpokenLanguage: 'en',
    });
  } catch (error) {
    return errorResponse(response, error);
  }
}


// Server-only subtitle selection after paid entitlement and session verification.
// This never signs a video or grants access. Failure falls back to English in
// the protected video handler, which preserves the existing release behavior.
export async function readMediaCaptionLocaleForPreview({
  environment = process.env,
  config,
  accessToken,
  accountId,
  fetchImpl = fetch,
}) {
  if (!uiEnabled(environment)) return 'en';
  if (!UUID_PATTERN.test(accountId || '') || typeof accessToken !== 'string'
    || accessToken.length < 20) return 'en';
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  checkDatabaseConfig(resolvedConfig);
  const record = await requestPreference({
    config: resolvedConfig, accessToken, accountId, fetchImpl,
  });
  return record.source === 'verified_account' && record.locale === 'es' ? 'es' : 'en';
}
