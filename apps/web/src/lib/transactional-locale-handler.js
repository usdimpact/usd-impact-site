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
const LOCALE_TABLE = 'account_transactional_locale_preferences';
const SELECT_FIELDS = 'account_id,preferred_locale,selection_provenance,revision,updated_at';
const LOCALE_OPTIONS = Object.freeze(['en', 'es']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uiEnabled(environment) {
  return environment.ACCOUNT_TRANSACTIONAL_LOCALE_UI_ENABLED === 'true'
    && ['preview', 'development'].includes(String(environment.VERCEL_ENV || '').toLowerCase());
}
function writeEnabled(environment) {
  return uiEnabled(environment)
    && environment.ACCOUNT_TRANSACTIONAL_LOCALE_WRITE_ENABLED === 'true';
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
    throw fail(415, 'TRANSACTIONAL_LOCALE_JSON_REQUIRED', 'Use application/json.');
  }
  const raw = request.body;
  let value;
  if (Buffer.isBuffer(raw) || typeof raw === 'string') {
    const text = String(raw);
    if (text.length > 512) {
      throw fail(413, 'TRANSACTIONAL_LOCALE_REQUEST_TOO_LARGE', 'The request is too large.');
    }
    try { value = JSON.parse(text); }
    catch { throw fail(400, 'TRANSACTIONAL_LOCALE_INVALID_REQUEST', 'Invalid request body.'); }
  } else {
    value = raw;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 1
    || !Object.prototype.hasOwnProperty.call(value, 'locale')
    || !LOCALE_OPTIONS.includes(value.locale)) {
    throw fail(400, 'TRANSACTIONAL_LOCALE_INVALID_SELECTION', 'Choose English or Spanish.');
  }
  return value.locale;
}
function normalizeRow(row, accountId) {
  if (!row || typeof row !== 'object' || row.account_id !== accountId
    || !LOCALE_OPTIONS.includes(row.preferred_locale)
    || row.selection_provenance !== 'authenticated_account'
    || !Number.isInteger(row.revision) || row.revision < 1
    || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))) {
    throw fail(503, 'TRANSACTIONAL_LOCALE_RECORD_UNVERIFIED', 'Language preference is unavailable.');
  }
  return Object.freeze({
    locale: row.preferred_locale,
    source: 'verified_account',
    revision: row.revision,
    updatedAt: row.updated_at,
  });
}
function checkDatabaseConfig(config) {
  let url;
  try { url = new URL(config.url); } catch {
    throw fail(503, 'TRANSACTIONAL_LOCALE_DEV_PROJECT_HOLD', 'Language preference is unavailable.');
  }
  if (url.protocol !== 'https:' || url.hostname !== DEV_PROJECT_HOST
    || url.pathname !== '/' || url.search || url.hash
    || typeof config.publishableKey !== 'string'
    || !config.publishableKey.startsWith('sb_publishable_')
    || config.secretKey) {
    throw fail(503, 'TRANSACTIONAL_LOCALE_DEV_PROJECT_HOLD', 'Language preference is unavailable.');
  }
}
async function requestPreference({ config, accessToken, accountId, locale, fetchImpl }) {
  const accountFilter = 'account_id=eq.' + encodeURIComponent(accountId);
  const base = config.url + '/rest/v1/' + LOCALE_TABLE;
  // A generic PostgREST UPSERT can include account_id in its UPDATE
  // columns, but authenticated roles intentionally have UPDATE privilege
  // only for preferred_locale. Do not broaden those grants. Read the
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
    ? { preferred_locale: locale }
    : { account_id: accountId, preferred_locale: locale };
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
    throw fail(503, 'TRANSACTIONAL_LOCALE_REST_UNAVAILABLE', 'Language preference is unavailable.');
  }
  if (!response?.ok) {
    // A concurrent insert/update race may return a conflict. Do not attempt
    // a privileged retry, user-selected account ID, or an outbox action.
    throw fail(503, 'TRANSACTIONAL_LOCALE_REST_DENIED', 'Language preference is unavailable.');
  }
  let payload;
  try { payload = await response.json(); }
  catch { throw fail(503, 'TRANSACTIONAL_LOCALE_REST_INVALID', 'Language preference is unavailable.'); }
  if (!Array.isArray(payload) || payload.length > 1
    || (locale !== undefined && payload.length !== 1)) {
    throw fail(503, 'TRANSACTIONAL_LOCALE_REST_INVALID', 'Language preference is unavailable.');
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
    throw fail(503, 'TRANSACTIONAL_LOCALE_WRITE_NOT_VERIFIED', 'Language preference was not confirmed.');
  }
  return record;
}

export async function handleTransactionalLocaleRequest(
  request, response, dependencies = {},
) {
  const environment = dependencies.environment || process.env;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  // Never expose this route in Production, even if someone mistakenly
  // configures the feature flags there. Disabled means 404, no Auth/DB call.
  if (!uiEnabled(environment)) {
    return deny(response, 404, 'TRANSACTIONAL_LOCALE_UI_DISABLED', 'Account language settings are unavailable.');
  }
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return deny(response, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  }
  if (request.method === 'POST' && !writeEnabled(environment)) {
    return deny(response, 403, 'TRANSACTIONAL_LOCALE_WRITE_DISABLED', 'Language changes are not enabled.');
  }
  if (request.method === 'POST' && !validSameOriginWrite(request)) {
    return deny(response, 403, 'TRANSACTIONAL_LOCALE_SAME_ORIGIN_REQUIRED', 'Same-origin verification is required.');
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
      return deny(response, 403, 'TRANSACTIONAL_LOCALE_ACCOUNT_INACTIVE', 'An active verified account is required.');
    }
    const saved = await requestPreference({
      config, accessToken: session.accessToken,
      accountId, locale, fetchImpl,
    });
    return sendJson(response, 200, {
      enabled: true,
      writable: writeEnabled(environment),
      ...saved,
      // Transactional email is not marketing consent, and the choice will
      // not retroactively edit any already-frozen notification snapshot.
      marketingConsentChanged: false,
      notificationsEnabled: false,
    });
  } catch (error) {
    return errorResponse(response, error);
  }
}
