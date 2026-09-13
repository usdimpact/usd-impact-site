import {
  createConsentEventRecord,
  normalizeEmail,
} from './email-readiness-contracts.js';
import {
  MARKETING_OPT_IN_DEVELOPMENT_PROJECT_REF,
  MARKETING_OPT_IN_PRODUCTION_PROJECT_REF,
} from './marketing-opt-in-readiness.js';
import {
  MARKETING_EMAIL_PURPOSES,
  verifyMarketingEmailUnsubscribeToken,
} from './marketing-email-preference-token.js';
import { readSupabaseServerConfig } from './supabase-server.js';

export const MARKETING_EMAIL_PREFERENCES_FORM_VERSION = 'email-preferences-v1';
const PURPOSE_SET = new Set(MARKETING_EMAIL_PURPOSES);
const MAX_EVENTS_PER_PURPOSE = 100;

export class MarketingEmailPreferencesError extends Error {
  constructor(message, code = 'MARKETING_EMAIL_PREFERENCES_FAILED', status = 400) {
    super(message);
    this.name = 'MarketingEmailPreferencesError';
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

function readConfig(environment, { write = false } = {}) {
  if (environment.EMAIL_READINESS_LEDGER_ENABLED !== 'true') {
    throw new MarketingEmailPreferencesError(
      'Email preference ledger is not enabled.',
      'EMAIL_LEDGER_DISABLED',
      503,
    );
  }

  let config;
  try {
    config = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch {
    throw new MarketingEmailPreferencesError(
      'Email preference database configuration is unavailable.',
      'EMAIL_PREFERENCES_DATABASE_CONFIGURATION_ERROR',
      503,
    );
  }

  const projectRef = projectRefFromUrl(config.url);
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  if (vercelEnvironment === 'production') {
    if (projectRef !== MARKETING_OPT_IN_PRODUCTION_PROJECT_REF) {
      throw new MarketingEmailPreferencesError(
        'Production email preferences target is not the canonical Production project.',
        'UNEXPECTED_SUPABASE_PROJECT',
        503,
      );
    }
    if (write && environment.EMAIL_PREFERENCES_PRODUCTION_APPROVED !== 'true') {
      throw new MarketingEmailPreferencesError(
        'Production email preference writes are not approved.',
        'PRODUCTION_EMAIL_PREFERENCES_NOT_APPROVED',
        503,
      );
    }
    return config;
  }

  if (projectRef !== MARKETING_OPT_IN_DEVELOPMENT_PROJECT_REF) {
    throw new MarketingEmailPreferencesError(
      'Non-production email preferences must target the canonical Development project.',
      'UNEXPECTED_SUPABASE_PROJECT',
      503,
    );
  }
  return config;
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

async function serviceRequest({ config, path, method = 'GET', body, prefer, fetchImpl = fetch }) {
  const response = await fetchImpl(`${config.url}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new MarketingEmailPreferencesError(
      `Email preference database request failed with status ${response.status}.`,
      'EMAIL_PREFERENCES_DATABASE_REQUEST_FAILED',
      503,
    );
  }
  return payload;
}

function requirePurpose(value) {
  const purpose = String(value ?? '').trim().toLowerCase();
  if (!PURPOSE_SET.has(purpose)) {
    throw new MarketingEmailPreferencesError(
      'Email preference purpose is not approved.',
      'INVALID_MARKETING_EMAIL_PURPOSE',
      400,
    );
  }
  return purpose;
}

function activeGrantFromEvents(events) {
  const withdrawals = new Set(
    events
      .filter((event) => event.status === 'withdrawn' && event.related_grant_id)
      .map((event) => event.related_grant_id),
  );
  return events.find((event) => event.status === 'granted' && !withdrawals.has(event.id)) || null;
}

async function loadPurposeEvents({ config, email, purpose, fetchImpl }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPurpose = requirePurpose(purpose);
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?email_normalized=eq.${encodeURIComponent(normalizedEmail)}&purpose=eq.${encodeURIComponent(normalizedPurpose)}&select=id,idempotency_key,email_normalized,user_id,purpose,status,consent_text_version,privacy_notice_version,source,provider_contact_ref,captured_at,related_grant_id,withdrawn_at&order=captured_at.desc&limit=${MAX_EVENTS_PER_PURPOSE}`,
    fetchImpl,
  });
  if (!Array.isArray(rows)) {
    throw new MarketingEmailPreferencesError(
      'Email preference lookup returned an invalid response.',
      'INVALID_EMAIL_PREFERENCE_RESPONSE',
      503,
    );
  }
  return rows;
}

export async function readMarketingEmailPreferences({
  email,
  environment = process.env,
  fetchImpl = fetch,
} = {}) {
  const config = readConfig(environment, { write: false });
  const normalizedEmail = normalizeEmail(email);
  const [weeklyEvents, progressEvents] = await Promise.all([
    loadPurposeEvents({
      config,
      email: normalizedEmail,
      purpose: 'weekly_newsletter',
      fetchImpl,
    }),
    loadPurposeEvents({
      config,
      email: normalizedEmail,
      purpose: 'learning_progress_updates',
      fetchImpl,
    }),
  ]);
  const weeklyGrant = activeGrantFromEvents(weeklyEvents);
  const progressGrant = activeGrantFromEvents(progressEvents);
  return Object.freeze({
    email: normalizedEmail,
    weeklyNewsletter: Object.freeze({
      active: Boolean(weeklyGrant),
      grant: weeklyGrant ? Object.freeze({ ...weeklyGrant }) : null,
    }),
    learningProgressUpdates: Object.freeze({
      active: Boolean(progressGrant),
      grant: progressGrant ? Object.freeze({ ...progressGrant }) : null,
    }),
  });
}

async function loadGrantByIdempotencyKey({
  config,
  consentIdempotencyKey,
  purpose,
  fetchImpl,
}) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?idempotency_key=eq.${encodeURIComponent(consentIdempotencyKey)}&select=id,idempotency_key,email_normalized,user_id,purpose,status,consent_text_version,privacy_notice_version,provider_contact_ref,captured_at&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new MarketingEmailPreferencesError(
      'Consent grant was not found.',
      'CONSENT_GRANT_NOT_FOUND',
      400,
    );
  }
  const grant = rows[0];
  if (grant.status !== 'granted' || grant.purpose !== purpose) {
    throw new MarketingEmailPreferencesError(
      'Consent grant is not eligible for this preference change.',
      'INVALID_CONSENT_GRANT',
      400,
    );
  }
  return grant;
}

async function loadWithdrawal({ config, grantId, fetchImpl }) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?status=eq.withdrawn&related_grant_id=eq.${encodeURIComponent(grantId)}&select=id,status,related_grant_id,withdrawn_at&order=created_at.asc&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length > 1) {
    throw new MarketingEmailPreferencesError(
      'Withdrawal evidence is invalid.',
      'INVALID_WITHDRAWAL_EVIDENCE',
      503,
    );
  }
  return rows[0] || null;
}

export async function inspectMarketingEmailUnsubscribe({
  token,
  environment = process.env,
  fetchImpl = fetch,
} = {}) {
  const config = readConfig(environment, { write: false });
  const verified = verifyMarketingEmailUnsubscribeToken({
    token,
    secret: environment.MARKETING_OPT_IN_SECRET,
  });
  const grant = await loadGrantByIdempotencyKey({
    config,
    consentIdempotencyKey: verified.consentIdempotencyKey,
    purpose: verified.purpose,
    fetchImpl,
  });
  const existingWithdrawal = await loadWithdrawal({ config, grantId: grant.id, fetchImpl });
  return Object.freeze({
    purpose: verified.purpose,
    active: !existingWithdrawal,
    grant: Object.freeze({ ...grant }),
    withdrawal: existingWithdrawal ? Object.freeze({ ...existingWithdrawal }) : null,
  });
}

export async function withdrawMarketingEmailPurpose({
  token,
  environment = process.env,
  fetchImpl = fetch,
  withdrawnAt = new Date().toISOString(),
} = {}) {
  const config = readConfig(environment, { write: true });
  const verified = verifyMarketingEmailUnsubscribeToken({
    token,
    secret: environment.MARKETING_OPT_IN_SECRET,
  });
  const grant = await loadGrantByIdempotencyKey({
    config,
    consentIdempotencyKey: verified.consentIdempotencyKey,
    purpose: verified.purpose,
    fetchImpl,
  });
  const existing = await loadWithdrawal({ config, grantId: grant.id, fetchImpl });
  if (existing) {
    return Object.freeze({
      created: false,
      purpose: verified.purpose,
      grant: Object.freeze({ ...grant }),
      withdrawal: Object.freeze({ ...existing }),
    });
  }

  const record = createConsentEventRecord({
    sourceEventId: `marketing.unsubscribe:${verified.purpose}:${grant.id}`,
    email: grant.email_normalized,
    userId: grant.user_id ?? null,
    purpose: verified.purpose,
    status: 'withdrawn',
    consentTextVersion: grant.consent_text_version,
    privacyNoticeVersion: grant.privacy_notice_version,
    source: 'email_unsubscribe',
    capturedAt: withdrawnAt,
    withdrawnAt,
    withdrawalSource: 'email_unsubscribe',
    relatedGrantId: grant.id,
    providerContactRef: grant.provider_contact_ref,
    evidenceContext: {
      formVersion: MARKETING_EMAIL_PREFERENCES_FORM_VERSION,
    },
  });
  const rows = await serviceRequest({
    config,
    path: '/rest/v1/marketing_consent_events?on_conflict=idempotency_key',
    method: 'POST',
    body: record,
    prefer: 'resolution=ignore-duplicates,return=representation',
    fetchImpl,
  });
  const withdrawal = Array.isArray(rows) && rows[0]
    ? rows[0]
    : await loadWithdrawal({ config, grantId: grant.id, fetchImpl });
  if (!withdrawal) {
    throw new MarketingEmailPreferencesError(
      'Email preference withdrawal could not be persisted.',
      'WITHDRAWAL_NOT_PERSISTED',
      503,
    );
  }
  return Object.freeze({
    created: true,
    purpose: verified.purpose,
    grant: Object.freeze({ ...grant }),
    withdrawal: Object.freeze({ ...withdrawal }),
  });
}
