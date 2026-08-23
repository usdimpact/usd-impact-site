import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  createConsentEventRecord,
  normalizeEmail,
} from './email-readiness-contracts.js';
import {
  LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF,
  LAUNCH_EMAIL_PRODUCTION_PROJECT_REF,
  projectRefFromUrl,
} from './launch-email-dispatch-common.js';
import { readSupabaseServerConfig } from './supabase-server.js';

export const DAILY_LEARNING_CONSENT_PURPOSE = 'daily_learning';
export const DAILY_LEARNING_CONSENT_TEXT_VERSION = 'daily-learning-email-v1';
export const DAILY_LEARNING_PRIVACY_NOTICE_VERSION = 'privacy-2026-08-23';
export const DAILY_LEARNING_FORM_VERSION = 'daily-learning-form-v1';
export const DAILY_LEARNING_UNSUBSCRIBE_VERSION = 'du1';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONSENT_KEY_PATTERN = /^consent:v1:([0-9a-f]{64})$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SECRET_PATTERN = /^wus_[A-Za-z0-9_-]{43,}$/;
const TOKEN_MAX_LENGTH = 170;
const MAX_CONSENT_EVENTS = 500;

export class DailyLearningConsentError extends Error {
  constructor(message, code = 'DAILY_LEARNING_CONSENT_FAILED', status = 400) {
    super(message);
    this.name = 'DailyLearningConsentError';
    this.code = code;
    this.status = status;
  }
}

function requireSubmissionId(value) {
  const id = String(value || '').trim().toLowerCase();
  if (!UUID_PATTERN.test(id)) {
    throw new DailyLearningConsentError(
      'A valid subscription identifier is required.',
      'INVALID_SUBSCRIPTION_ID',
      400,
    );
  }
  return id;
}

function requireSecret(value) {
  const secret = String(value || '').trim();
  if (!SECRET_PATTERN.test(secret)) {
    throw new DailyLearningConsentError(
      'Unsubscribe signing is not configured.',
      'DAILY_LEARNING_UNSUBSCRIBE_CONFIGURATION_ERROR',
      503,
    );
  }
  return secret;
}

function assertExpectedProject(config, environment) {
  const projectRef = projectRefFromUrl(config.url);
  const vercelEnvironment = String(environment.VERCEL_ENV || '').trim().toLowerCase();

  if (vercelEnvironment === 'production') {
    if (environment.EMAIL_READINESS_PRODUCTION_APPROVED !== 'true') {
      throw new DailyLearningConsentError(
        'Production consent writes are not approved.',
        'PRODUCTION_LEDGER_NOT_APPROVED',
        503,
      );
    }
    if (projectRef !== LAUNCH_EMAIL_PRODUCTION_PROJECT_REF) {
      throw new DailyLearningConsentError(
        'Production consent target is not the canonical Production project.',
        'UNEXPECTED_SUPABASE_PROJECT',
        503,
      );
    }
    return projectRef;
  }

  if (projectRef !== LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF) {
    throw new DailyLearningConsentError(
      'Non-production consent writes must target the canonical Development project.',
      'UNEXPECTED_SUPABASE_PROJECT',
      503,
    );
  }
  return projectRef;
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
    throw new DailyLearningConsentError(
      `Consent database request failed with status ${response.status}.`,
      'DAILY_LEARNING_DATABASE_REQUEST_FAILED',
      503,
    );
  }
  return payload;
}

function readConfig(environment) {
  if (environment.EMAIL_READINESS_LEDGER_ENABLED !== 'true') {
    throw new DailyLearningConsentError(
      'Consent ledger is not enabled.',
      'DAILY_LEARNING_LEDGER_DISABLED',
      503,
    );
  }
  let config;
  try {
    config = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch {
    throw new DailyLearningConsentError(
      'Consent database configuration is unavailable.',
      'DAILY_LEARNING_DATABASE_CONFIGURATION_ERROR',
      503,
    );
  }
  assertExpectedProject(config, environment);
  return config;
}

function activeGrantFromEvents(events) {
  const withdrawals = new Set(
    events
      .filter((event) => event.status === 'withdrawn' && event.related_grant_id)
      .map((event) => event.related_grant_id),
  );
  return events.find((event) => event.status === 'granted' && !withdrawals.has(event.id)) || null;
}

async function loadRecipientEvents({ config, email, fetchImpl }) {
  const normalizedEmail = normalizeEmail(email);
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?email_normalized=eq.${encodeURIComponent(normalizedEmail)}&purpose=eq.${DAILY_LEARNING_CONSENT_PURPOSE}&select=id,idempotency_key,email_normalized,purpose,status,consent_text_version,privacy_notice_version,provider_contact_ref,captured_at,related_grant_id,withdrawn_at&order=captured_at.desc&limit=50`,
    fetchImpl,
  });
  if (!Array.isArray(rows)) {
    throw new DailyLearningConsentError('Consent lookup returned an invalid response.', 'INVALID_CONSENT_RESPONSE', 503);
  }
  return rows;
}

export function createDailyLearningConsentRecord({ email, submissionId, capturedAt }) {
  const normalizedSubmissionId = requireSubmissionId(submissionId);
  const normalizedEmail = normalizeEmail(email);
  return createConsentEventRecord({
    sourceEventId: `daily-learning.subscribe:${normalizedSubmissionId}`,
    email: normalizedEmail,
    purpose: DAILY_LEARNING_CONSENT_PURPOSE,
    status: 'granted',
    consentTextVersion: DAILY_LEARNING_CONSENT_TEXT_VERSION,
    privacyNoticeVersion: DAILY_LEARNING_PRIVACY_NOTICE_VERSION,
    source: 'daily_learning_form',
    capturedAt,
    evidenceContext: {
      consentCheckbox: true,
      formVersion: DAILY_LEARNING_FORM_VERSION,
    },
  });
}

export async function subscribeDailyLearning({
  email,
  submissionId,
  capturedAt = new Date().toISOString(),
  environment = process.env,
  fetchImpl = fetch,
}) {
  const config = readConfig(environment);
  const normalizedEmail = normalizeEmail(email);
  const events = await loadRecipientEvents({ config, email: normalizedEmail, fetchImpl });
  const existing = activeGrantFromEvents(events);
  if (existing) {
    return Object.freeze({ created: false, grant: Object.freeze({ ...existing }) });
  }

  const record = createDailyLearningConsentRecord({ email: normalizedEmail, submissionId, capturedAt });
  const rows = await serviceRequest({
    config,
    path: '/rest/v1/marketing_consent_events?on_conflict=idempotency_key',
    method: 'POST',
    body: record,
    prefer: 'resolution=ignore-duplicates,return=representation',
    fetchImpl,
  });
  if (Array.isArray(rows) && rows.length === 1) {
    return Object.freeze({ created: true, grant: Object.freeze({ ...rows[0] }) });
  }

  const after = await loadRecipientEvents({ config, email: normalizedEmail, fetchImpl });
  const grant = activeGrantFromEvents(after);
  if (!grant) {
    throw new DailyLearningConsentError(
      'Subscription consent could not be persisted.',
      'DAILY_LEARNING_CONSENT_NOT_PERSISTED',
      503,
    );
  }
  return Object.freeze({ created: false, grant: Object.freeze({ ...grant }) });
}

function tokenPayload(hash) {
  return `${DAILY_LEARNING_UNSUBSCRIBE_VERSION}.${hash}.${DAILY_LEARNING_CONSENT_PURPOSE}`;
}

function signHash(hash, secret) {
  return createHmac('sha256', requireSecret(secret))
    .update(tokenPayload(hash))
    .digest('base64url');
}

export function createDailyLearningUnsubscribeToken({ consentIdempotencyKey, secret }) {
  const match = String(consentIdempotencyKey || '').trim().toLowerCase().match(CONSENT_KEY_PATTERN);
  if (!match) {
    throw new DailyLearningConsentError('Consent identity is invalid.', 'INVALID_CONSENT_IDENTITY', 400);
  }
  return `${DAILY_LEARNING_UNSUBSCRIBE_VERSION}.${match[1]}.${signHash(match[1], secret)}`;
}

export function verifyDailyLearningUnsubscribeToken({ token, secret }) {
  const normalized = String(token || '').trim();
  if (!normalized || normalized.length > TOKEN_MAX_LENGTH) {
    throw new DailyLearningConsentError('Unsubscribe token is invalid.', 'INVALID_UNSUBSCRIBE_TOKEN', 400);
  }
  const [version, hash, signature, extra] = normalized.split('.');
  if (
    extra !== undefined
    || version !== DAILY_LEARNING_UNSUBSCRIBE_VERSION
    || !HASH_PATTERN.test(hash || '')
    || !SIGNATURE_PATTERN.test(signature || '')
  ) {
    throw new DailyLearningConsentError('Unsubscribe token is invalid.', 'INVALID_UNSUBSCRIBE_TOKEN', 400);
  }
  const expected = Buffer.from(signHash(hash, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new DailyLearningConsentError('Unsubscribe token is invalid.', 'INVALID_UNSUBSCRIBE_TOKEN', 400);
  }
  return Object.freeze({ consentIdempotencyKey: `consent:v1:${hash}`, token: normalized });
}

export function createDailyLearningUnsubscribeUrl({ grant, secret, baseUrl = 'https://www.usd-impact.com' }) {
  if (!grant?.idempotency_key) {
    throw new DailyLearningConsentError('Consent grant is missing.', 'CONSENT_GRANT_MISSING', 500);
  }
  const token = createDailyLearningUnsubscribeToken({
    consentIdempotencyKey: grant.idempotency_key,
    secret,
  });
  const url = new URL('/learn/email/unsubscribe', baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

async function loadGrantByIdempotencyKey({ config, consentIdempotencyKey, fetchImpl }) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?idempotency_key=eq.${encodeURIComponent(consentIdempotencyKey)}&select=id,idempotency_key,email_normalized,purpose,status,consent_text_version,privacy_notice_version,provider_contact_ref,captured_at&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new DailyLearningConsentError('Consent grant was not found.', 'CONSENT_GRANT_NOT_FOUND', 400);
  }
  const grant = rows[0];
  if (grant.status !== 'granted' || grant.purpose !== DAILY_LEARNING_CONSENT_PURPOSE) {
    throw new DailyLearningConsentError('Consent grant is not eligible for withdrawal.', 'INVALID_CONSENT_GRANT', 400);
  }
  return grant;
}

async function loadWithdrawal({ config, grantId, fetchImpl }) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?status=eq.withdrawn&related_grant_id=eq.${encodeURIComponent(grantId)}&select=id,status,related_grant_id,withdrawn_at&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length > 1) {
    throw new DailyLearningConsentError('Withdrawal evidence is invalid.', 'INVALID_WITHDRAWAL_EVIDENCE', 503);
  }
  return rows[0] || null;
}

export async function withdrawDailyLearning({
  token,
  environment = process.env,
  fetchImpl = fetch,
  withdrawnAt = new Date().toISOString(),
}) {
  const config = readConfig(environment);
  const verified = verifyDailyLearningUnsubscribeToken({
    token,
    secret: environment.WAITLIST_UNSUBSCRIBE_SECRET,
  });
  const grant = await loadGrantByIdempotencyKey({
    config,
    consentIdempotencyKey: verified.consentIdempotencyKey,
    fetchImpl,
  });
  const existing = await loadWithdrawal({ config, grantId: grant.id, fetchImpl });
  if (existing) return Object.freeze({ created: false, grant, withdrawal: existing });

  const record = createConsentEventRecord({
    sourceEventId: `daily-learning.unsubscribe:${grant.id}`,
    email: grant.email_normalized,
    purpose: DAILY_LEARNING_CONSENT_PURPOSE,
    status: 'withdrawn',
    consentTextVersion: grant.consent_text_version,
    privacyNoticeVersion: grant.privacy_notice_version,
    source: 'unsubscribe_link',
    capturedAt: withdrawnAt,
    withdrawnAt,
    withdrawalSource: 'unsubscribe_link',
    relatedGrantId: grant.id,
    providerContactRef: grant.provider_contact_ref,
    evidenceContext: {
      formVersion: DAILY_LEARNING_FORM_VERSION,
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
    throw new DailyLearningConsentError('Withdrawal could not be persisted.', 'WITHDRAWAL_NOT_PERSISTED', 503);
  }
  return Object.freeze({ created: true, grant, withdrawal });
}

export async function isDailyLearningGrantActive({ grant, environment = process.env, fetchImpl = fetch }) {
  if (!grant?.id) return false;
  const config = readConfig(environment);
  const withdrawal = await loadWithdrawal({ config, grantId: grant.id, fetchImpl });
  return withdrawal == null;
}

export async function listActiveDailyLearningGrants({ environment = process.env, fetchImpl = fetch }) {
  const config = readConfig(environment);
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?purpose=eq.${DAILY_LEARNING_CONSENT_PURPOSE}&select=id,idempotency_key,email_normalized,purpose,status,consent_text_version,privacy_notice_version,provider_contact_ref,captured_at,related_grant_id,withdrawn_at&order=captured_at.asc&limit=${MAX_CONSENT_EVENTS}`,
    fetchImpl,
  });
  if (!Array.isArray(rows)) {
    throw new DailyLearningConsentError('Consent inventory returned an invalid response.', 'INVALID_CONSENT_RESPONSE', 503);
  }
  if (rows.length >= MAX_CONSENT_EVENTS) {
    throw new DailyLearningConsentError(
      'Consent inventory exceeds the bounded dispatch reader.',
      'DAILY_LEARNING_CONSENT_INVENTORY_LIMIT',
      503,
    );
  }
  const withdrawals = new Set(
    rows.filter((row) => row.status === 'withdrawn' && row.related_grant_id).map((row) => row.related_grant_id),
  );
  return Object.freeze(
    rows
      .filter((row) => row.status === 'granted' && !withdrawals.has(row.id))
      .map((row) => Object.freeze({ ...row })),
  );
}
