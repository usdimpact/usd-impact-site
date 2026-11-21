import { createHash } from 'node:crypto';
import { createPurchaseAccessReadyEmailIntent } from './purchase-access-ready-email.js';
import { PURCHASE_ACCESS_READY_EMAIL_TEMPLATE_VERSION } from './launch-email-templates.js';
import { ACCESS_READY_SPANISH_DRAFT_VERSION } from './purchase-access-ready-locale-preview.js';

// Design-only immutable rendering contract. Neither commerce, the outbox
// adapter, the email provider nor a scheduler imports this module.
// No network operations, database writes or sends are possible here.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REVISION = 2_147_483_647;

export class AccessReadyLocaleContractError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AccessReadyLocaleContractError';
    this.code = code;
  }
}
function reject(code) { throw new AccessReadyLocaleContractError(code); }
function utc(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) {
    reject(field + '_INVALID');
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) reject(field + '_INVALID');
  return parsed;
}
function isUuid(value) { return typeof value === 'string' && UUID_RE.test(value); }
function hexSha256(value) { return createHash('sha256').update(value).digest('hex'); }
function immutable(value) { return Object.freeze(value); }

// A preference row is verified by account authentication and RLS, NOT by a
// Resend newsletter segment, browser Accept-Language or user_metadata.
// The row has a monotonic DB revision so a later user change cannot mutate
// an earlier purchase notification's locale or rendered template.
export function prepareAccessReadyLocaleSnapshot({
  accessResult,
  accountPreference = null,
  snapshotAt,
}) {
  const prepared = createPurchaseAccessReadyEmailIntent({ accessResult });
  const accountId = accessResult.profile.account_id.toLowerCase();
  const purchaseId = accessResult.purchase.id.toLowerCase();
  const snapshotMs = utc(snapshotAt, 'SNAPSHOT_AT');
  const purchaseMs = utc(new Date(accessResult.purchase.completed_at).toISOString(), 'COMPLETED_AT');
  if (snapshotMs < purchaseMs) reject('SNAPSHOT_BEFORE_PURCHASE');

  let locale = 'en';
  let source = 'english_fallback';
  let preferenceRevision = null;
  if (accountPreference !== null) {
    if (!accountPreference || typeof accountPreference !== 'object' || Array.isArray(accountPreference)) {
      reject('PREFERENCE_RECORD_INVALID');
    }
    if (!isUuid(accountPreference.account_id)
      || accountPreference.account_id.toLowerCase() !== accountId
      || accountPreference.selection_provenance !== 'authenticated_account') {
      reject('UNVERIFIED_ACCOUNT_PREFERENCE');
    }
    if (accountPreference.preferred_locale !== 'en' && accountPreference.preferred_locale !== 'es') {
      reject('UNSUPPORTED_ACCOUNT_PREFERENCE_LOCALE');
    }
    if (!Number.isSafeInteger(accountPreference.revision)
      || accountPreference.revision < 1 || accountPreference.revision > MAX_REVISION) {
      reject('PREFERENCE_REVISION_INVALID');
    }
    const updatedMs = utc(accountPreference.updated_at, 'PREFERENCE_UPDATED_AT');
    if (updatedMs > snapshotMs) reject('PREFERENCE_FROM_FUTURE');
    locale = accountPreference.preferred_locale;
    source = 'verified_account';
    preferenceRevision = accountPreference.revision;
  }

  const templateVersion = locale === 'es'
    ? ACCESS_READY_SPANISH_DRAFT_VERSION
    : PURCHASE_ACCESS_READY_EMAIL_TEMPLATE_VERSION;
  const outbox = prepared.intent.outboxRecord;
  const matchesCurrentOutbox = templateVersion === outbox.template_version;
  const recipientSha256 = hexSha256(outbox.recipient_email_normalized);
  const snapshotIdentity = hexSha256(JSON.stringify({
    accountId, purchaseId,
    outboxKey: outbox.idempotency_key,
    recipientSha256, locale, source,
    preferenceRevision, templateVersion,
  }));
  return immutable({
    previewOnly: true,
    canDispatch: false,
    canWrite: false,
    accountId,
    purchaseId,
    outboxIdempotencyKey: outbox.idempotency_key,
    recipientSha256,
    locale,
    localeSource: source,
    preferenceRevision,
    templateVersion,
    snapshotIdentity,
    compatibleWithCurrentOutbox: matchesCurrentOutbox,
    disposition: matchesCurrentOutbox
      ? 'IMMUTABLE_SNAPSHOT_DESIGN_ONLY'
      : 'HOLD_OUTBOX_TEMPLATE_VERSION_MISMATCH',
  });
}

// A retry or manual reconciliation must validate against the original
// persisted snapshot before rendering; current account preferences can
// change without altering a previously frozen notification.
export function assertUnchangedAccessReadyLocaleSnapshot(expected, persisted) {
  if (!expected || !persisted || typeof expected !== 'object' || typeof persisted !== 'object') {
    reject('LOCALE_SNAPSHOT_MISSING');
  }
  for (const field of [
    'accountId', 'purchaseId', 'outboxIdempotencyKey', 'recipientSha256',
    'locale', 'localeSource', 'preferenceRevision', 'templateVersion', 'snapshotIdentity',
  ]) {
    if ((expected[field] ?? null) !== (persisted[field] ?? null)) reject('LOCALE_SNAPSHOT_IDENTITY_MISMATCH');
  }
  return immutable({ verified: true, canDispatch: false });
}
