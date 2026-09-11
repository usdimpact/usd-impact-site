import { PAID_PRODUCT_ID, authorizePaidAccess } from './paid-access.js';
import { buildLearningJourney } from './learning-journey.js';
import { readMarketingEmailPreferences } from './marketing-email-preferences.js';
import {
  MARKETING_OPT_IN_DEVELOPMENT_PROJECT_REF,
  MARKETING_OPT_IN_PRODUCTION_PROJECT_REF,
} from './marketing-opt-in-readiness.js';
import {
  buildProgressEmailPayload,
  evaluateProgressEmailEligibility,
} from './progress-email-contract.js';
import { readSupabaseServerConfig } from './supabase-server.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const HISTORY_LIMIT = 50;
const TERMINAL_SUPPRESSION_STATUSES = new Set(['hard_bounced', 'complained', 'suppressed']);
const COMPLETED_SEND_STATUSES = new Set(['accepted', 'delivered']);

export class ProgressEmailReadinessError extends Error {
  constructor(message, code = 'PROGRESS_EMAIL_READINESS_FAILED', status = 503) {
    super(message);
    this.name = 'ProgressEmailReadinessError';
    this.code = code;
    this.status = status;
  }
}

function projectRefFromUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const suffix = '.supabase.co';
    if (!hostname.endsWith(suffix)) return null;
    return hostname.slice(0, -suffix.length) || null;
  } catch {
    return null;
  }
}

function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new ProgressEmailReadinessError(
      'Progress email account has an invalid address.',
      'INVALID_PROGRESS_EMAIL_ACCOUNT',
    );
  }
  return email;
}

function requireAccountId(value) {
  const accountId = String(value ?? '').trim().toLowerCase();
  if (!UUID_PATTERN.test(accountId)) {
    throw new ProgressEmailReadinessError(
      'A valid account ID is required.',
      'INVALID_PROGRESS_EMAIL_ACCOUNT',
      400,
    );
  }
  return accountId;
}

function requireTimestamp(value, field) {
  const parsed = Date.parse(String(value ?? ''));
  if (!Number.isFinite(parsed)) {
    throw new ProgressEmailReadinessError(
      `${field} must be a valid timestamp.`,
      'INVALID_PROGRESS_EMAIL_ACCOUNT',
    );
  }
  return new Date(parsed).toISOString();
}

function readConfig(environment) {
  if (environment.PROGRESS_EMAIL_READINESS_ENABLED !== 'true') {
    return Object.freeze({ enabled: false });
  }
  if (environment.EMAIL_READINESS_LEDGER_ENABLED !== 'true') {
    throw new ProgressEmailReadinessError(
      'Progress email readiness requires the durable email ledger.',
      'EMAIL_LEDGER_DISABLED',
    );
  }

  let supabase;
  try {
    supabase = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch {
    throw new ProgressEmailReadinessError(
      'Progress email database configuration is unavailable.',
      'PROGRESS_EMAIL_DATABASE_CONFIGURATION_ERROR',
    );
  }
  const projectRef = projectRefFromUrl(supabase.url);
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  if (vercelEnvironment === 'production' || projectRef === MARKETING_OPT_IN_PRODUCTION_PROJECT_REF) {
    throw new ProgressEmailReadinessError(
      'Production progress email readiness is not enabled in this implementation slice.',
      'PROGRESS_EMAIL_PRODUCTION_BLOCKED',
    );
  }
  if (projectRef !== MARKETING_OPT_IN_DEVELOPMENT_PROJECT_REF) {
    throw new ProgressEmailReadinessError(
      'Non-production progress email readiness must target canonical Development.',
      'UNEXPECTED_SUPABASE_PROJECT',
    );
  }
  return Object.freeze({ enabled: true, supabase, projectRef });
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function serviceRequest({ config, path, fetchImpl = fetch }) {
  const response = await fetchImpl(`${config.supabase.url}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: config.supabase.secretKey,
      Authorization: `Bearer ${config.supabase.secretKey}`,
    },
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new ProgressEmailReadinessError(
      `Progress email source request failed with status ${response.status}.`,
      'PROGRESS_EMAIL_SOURCE_REQUEST_FAILED',
    );
  }
  return payload;
}

function firstRow(payload) {
  return Array.isArray(payload) && payload.length > 0 ? payload[0] : null;
}

function normalizeAuthUser(payload, accountId) {
  const id = String(payload?.id ?? '').toLowerCase();
  const email = normalizeEmail(payload?.email);
  const lastSignInAt = requireTimestamp(payload?.last_sign_in_at, 'last_sign_in_at');
  const confirmedAt = payload?.email_confirmed_at || payload?.confirmed_at;
  if (
    id !== accountId
    || payload?.is_anonymous === true
    || !confirmedAt
  ) {
    throw new ProgressEmailReadinessError(
      'Progress email requires a confirmed non-anonymous account.',
      'PROGRESS_EMAIL_ACCOUNT_NOT_ELIGIBLE',
    );
  }
  return Object.freeze({ id, email, lastSignInAt });
}

function normalizeEntitlement(row) {
  if (!row) return null;
  return {
    id: row.id,
    accountId: row.account_id,
    productId: row.product_id,
    state: row.state,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

function latestSendAt(rows) {
  let latest = null;
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!COMPLETED_SEND_STATUSES.has(row.status)) continue;
    const candidate = row.delivered_at || row.accepted_at;
    const parsed = Date.parse(String(candidate ?? ''));
    if (!Number.isFinite(parsed)) continue;
    if (latest === null || parsed > latest) latest = parsed;
  }
  return latest === null ? null : new Date(latest).toISOString();
}

function providerSuppressed(rows) {
  return (Array.isArray(rows) ? rows : []).some((row) => TERMINAL_SUPPRESSION_STATUSES.has(row.status));
}

function consentMatchesAccount(preferences, accountId, email) {
  const state = preferences?.learningProgressUpdates;
  const grant = state?.grant;
  if (!state?.active || !grant) return { active: false, grant: null };
  if (
    grant.purpose !== 'learning_progress_updates'
    || grant.status !== 'granted'
    || grant.email_normalized !== email
    || String(grant.user_id ?? '').toLowerCase() !== accountId
  ) {
    return { active: false, grant: null };
  }
  return { active: true, grant: Object.freeze({ ...grant }) };
}

export async function readProgressEmailAccountState({
  accountId,
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const normalizedAccountId = requireAccountId(accountId);
  const config = readConfig(environment);
  if (!config.enabled) return Object.freeze({ enabled: false });
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) {
    throw new ProgressEmailReadinessError('Progress email clock is invalid.', 'INVALID_PROGRESS_EMAIL_CLOCK');
  }

  const authPayload = await serviceRequest({
    config,
    path: `/auth/v1/admin/users/${encodeURIComponent(normalizedAccountId)}`,
    fetchImpl,
  });
  const user = normalizeAuthUser(authPayload, normalizedAccountId);

  const [profiles, entitlements, progressRows, preferences, progressHistory, weeklyHistory, suppressionHistory] = await Promise.all([
    serviceRequest({
      config,
      path: `/rest/v1/profiles?account_id=eq.${encodeURIComponent(normalizedAccountId)}&select=account_id,email,status&limit=1`,
      fetchImpl,
    }),
    serviceRequest({
      config,
      path: `/rest/v1/entitlements?account_id=eq.${encodeURIComponent(normalizedAccountId)}&product_id=eq.${encodeURIComponent(PAID_PRODUCT_ID)}&select=id,account_id,product_id,state,starts_at,ends_at,version,updated_at&order=version.desc&limit=1`,
      fetchImpl,
    }),
    serviceRequest({
      config,
      path: `/rest/v1/learning_progress?account_id=eq.${encodeURIComponent(normalizedAccountId)}&select=content_id,status,progress_percent,resume_position,completed_at,updated_at&order=updated_at.desc&limit=500`,
      fetchImpl,
    }),
    readMarketingEmailPreferences({ email: user.email, environment, fetchImpl }),
    serviceRequest({
      config,
      path: `/rest/v1/notification_outbox?recipient_email_normalized=eq.${encodeURIComponent(user.email)}&message_id=eq.learning_progress_update&select=status,accepted_at,delivered_at,updated_at&order=updated_at.desc&limit=${HISTORY_LIMIT}`,
      fetchImpl,
    }),
    serviceRequest({
      config,
      path: `/rest/v1/notification_outbox?recipient_email_normalized=eq.${encodeURIComponent(user.email)}&message_id=eq.weekly_newsletter&select=status,accepted_at,delivered_at,updated_at&order=updated_at.desc&limit=${HISTORY_LIMIT}`,
      fetchImpl,
    }),
    serviceRequest({
      config,
      path: `/rest/v1/notification_outbox?recipient_email_normalized=eq.${encodeURIComponent(user.email)}&status=in.(hard_bounced,complained,suppressed)&select=status,updated_at&order=updated_at.desc&limit=${HISTORY_LIMIT}`,
      fetchImpl,
    }),
  ]);

  const profile = firstRow(profiles);
  const profileEmail = profile?.email ? normalizeEmail(profile.email) : null;
  const entitlement = normalizeEntitlement(firstRow(entitlements));
  const access = authorizePaidAccess(entitlement, PAID_PRODUCT_ID, nowMs);
  const accountEligible = Boolean(
    profile
    && String(profile.account_id ?? '').toLowerCase() === normalizedAccountId
    && profile.status === 'active'
    && profileEmail === user.email
    && access.allowed
  );
  const consent = consentMatchesAccount(preferences, normalizedAccountId, user.email);
  const learningJourney = buildLearningJourney({
    hasPaidAccess: access.allowed,
    progressAvailable: Array.isArray(progressRows),
    rows: Array.isArray(progressRows) ? progressRows : [],
  });

  return Object.freeze({
    enabled: true,
    accountId: normalizedAccountId,
    email: user.email,
    lastSignInAt: user.lastSignInAt,
    accountEligible,
    consentActive: consent.active,
    consentGrant: consent.grant,
    providerSuppressed: providerSuppressed(suppressionHistory),
    lastProgressEmailAt: latestSendAt(progressHistory),
    lastWeeklyNewsletterAt: latestSendAt(weeklyHistory),
    learningJourney,
  });
}

export async function resolveProgressEmailCandidate({
  accountId,
  meaningfulChanges,
  weeklyReport,
  locale = 'en',
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const state = await readProgressEmailAccountState({ accountId, environment, fetchImpl, now });
  if (!state.enabled) return Object.freeze({ enabled: false });

  const nowIso = new Date(now).toISOString();
  const eligibility = evaluateProgressEmailEligibility({
    now: nowIso,
    lastSignInAt: state.lastSignInAt,
    lastProgressEmailAt: state.lastProgressEmailAt,
    lastWeeklyNewsletterAt: state.lastWeeklyNewsletterAt,
    accountEligible: state.accountEligible,
    consentActive: state.consentActive,
    providerSuppressed: state.providerSuppressed,
    meaningfulChanges,
  });
  if (!eligibility.eligible) {
    return Object.freeze({
      enabled: true,
      eligible: false,
      reason: eligibility.reason,
      eligibility,
    });
  }
  if (!state.consentGrant) {
    throw new ProgressEmailReadinessError(
      'Eligible progress email candidate is missing its authoritative consent grant.',
      'PROGRESS_EMAIL_CONSENT_STATE_INVALID',
    );
  }

  const payload = buildProgressEmailPayload({
    eligibility,
    learningJourney: state.learningJourney,
    weeklyReport,
    locale,
  });
  return Object.freeze({
    enabled: true,
    eligible: true,
    accountId: state.accountId,
    email: state.email,
    lastSignInAt: state.lastSignInAt,
    consentGrant: state.consentGrant,
    eligibility,
    payload,
  });
}
