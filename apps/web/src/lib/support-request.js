import {
  SupabaseRequestError,
  getVerifiedSupabaseUser,
  readSupabaseServerConfig,
} from './supabase-server.js';

export const SUPPORT_REQUEST_CATEGORIES = Object.freeze([
  'access',
  'commerce',
  'privacy',
  'security',
  'product',
  'general',
]);

const CATEGORY_SET = new Set(SUPPORT_REQUEST_CATEGORIES);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBJECT_MAX_LENGTH = 160;
const MESSAGE_MAX_LENGTH = 5_000;

function normalizeText(value, fieldName, { minimum, maximum, multiline = false }) {
  if (typeof value !== 'string') {
    throw new SupabaseRequestError(`${fieldName} is required.`, {
      status: 400,
      code: 'INVALID_SUPPORT_REQUEST',
    });
  }
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
  if (
    normalized.length < minimum
    || normalized.length > maximum
    || (!multiline && normalized.includes('\n'))
  ) {
    throw new SupabaseRequestError(`${fieldName} is invalid.`, {
      status: 400,
      code: 'INVALID_SUPPORT_REQUEST',
    });
  }
  return normalized;
}

function normalizeCategory(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!CATEGORY_SET.has(normalized)) {
    throw new SupabaseRequestError('Select a valid support category.', {
      status: 400,
      code: 'INVALID_SUPPORT_CATEGORY',
    });
  }
  return normalized;
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

function normalizePersistedRequest(payload, user, category) {
  const row = Array.isArray(payload) && payload.length > 0 ? payload[0] : null;
  if (
    !row
    || !UUID_PATTERN.test(row.id || '')
    || row.account_id !== user.id
    || String(row.email || '').trim().toLowerCase() !== user.email
    || row.category !== category
    || row.status !== 'open'
    || !Number.isFinite(Date.parse(row.created_at || ''))
  ) {
    throw new SupabaseRequestError('The support request could not be verified after creation.', {
      status: 502,
      code: 'SUPPORT_REQUEST_VERIFICATION_FAILED',
    });
  }
  return Object.freeze({
    id: row.id,
    account_id: row.account_id,
    email: String(row.email).trim().toLowerCase(),
    category: row.category,
    status: row.status,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: Number.isFinite(Date.parse(row.updated_at || ''))
      ? new Date(row.updated_at).toISOString()
      : new Date(row.created_at).toISOString(),
  });
}

export async function createOwnSupportRequest({
  accessToken,
  category,
  subject,
  message,
  environment,
  config,
  fetchImpl = fetch,
}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const user = await getVerifiedSupabaseUser(accessToken, {
    config: resolvedConfig,
    fetchImpl,
  });
  const normalizedCategory = normalizeCategory(category);
  const normalizedSubject = normalizeText(subject, 'Subject', {
    minimum: 3,
    maximum: SUBJECT_MAX_LENGTH,
  });
  const normalizedMessage = normalizeText(message, 'Message', {
    minimum: 10,
    maximum: MESSAGE_MAX_LENGTH,
    multiline: true,
  });

  const providerResponse = await fetchImpl(
    `${resolvedConfig.url}/rest/v1/support_requests?select=id,account_id,email,category,status,created_at,updated_at`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        apikey: resolvedConfig.publishableKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        account_id: user.id,
        email: user.email,
        category: normalizedCategory,
        subject: normalizedSubject,
        message: normalizedMessage,
      }),
    },
  );
  const payload = await readJsonSafely(providerResponse);
  if (!providerResponse.ok) {
    throw new SupabaseRequestError(
      payload?.message || payload?.error || 'The support request could not be recorded.',
      {
        status: providerResponse.status,
        code: payload?.code || 'SUPPORT_REQUEST_FAILED',
        details: payload,
      },
    );
  }

  return Object.freeze({
    user,
    request: normalizePersistedRequest(payload, user, normalizedCategory),
  });
}
