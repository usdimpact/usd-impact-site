import { createHash } from 'node:crypto';
import { createPurchaseAccessReadyEmailIntent } from './purchase-access-ready-email.js';
import { PURCHASE_ACCESS_READY_EMAIL_TEMPLATE_VERSION } from './launch-email-templates.js';
import { ACCESS_READY_SPANISH_DRAFT_VERSION } from './purchase-access-ready-locale-preview.js';

// PURE REVIEW ONLY. No network, persistence, payment replay, or Resend send.
const SHA = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = s => createHash('sha256').update(s).digest('hex');
const uuid = s => typeof s === 'string' && UUID.test(s) ? s.toLowerCase() : null;
function fail(code) { const e = new TypeError(code); e.code = code; throw e; }

export function verifyPurchaseAccessReadyAtomicPair({ accessResult, outbox, snapshot } = {}) {
  const { intent } = createPurchaseAccessReadyEmailIntent({ accessResult });
  const expected = intent.outboxRecord;
  if (!outbox || !snapshot || typeof outbox !== 'object' || typeof snapshot !== 'object'
    || !uuid(outbox.id) || !uuid(snapshot.outbox_id)) fail('MISSING_ATOMIC_PAIR');
  for (const field of [
    'idempotency_key','event_id','message_id','classification','business_object_type',
    'business_object_id','state_version','recipient_email_normalized','template_id',
    'template_version','provider','consent_required','consent_record_id',
    'consent_purpose','consent_checked_at',
  ]) {
    if ((outbox[field] ?? null) !== (expected[field] ?? null)) fail('ATOMIC_OUTBOX_MISMATCH');
  }
  if (JSON.stringify(outbox.payload) !== JSON.stringify(expected.payload)) fail('ATOMIC_PAYLOAD_MISMATCH');
  const accountId = uuid(accessResult.profile.account_id);
  const purchaseId = uuid(accessResult.purchase.id);
  if (uuid(snapshot.outbox_id) !== uuid(outbox.id)
    || uuid(snapshot.account_id) !== accountId
    || uuid(snapshot.purchase_id) !== purchaseId) fail('ATOMIC_LINK_MISMATCH');
  const locale = snapshot.render_locale, source = snapshot.locale_source;
  const revision = snapshot.preference_revision ?? null;
  if (locale !== 'en' && locale !== 'es') fail('ATOMIC_LOCALE_UNAPPROVED');
  if (source === 'english_fallback') {
    if (locale !== 'en' || revision !== null) fail('ATOMIC_PROVENANCE_MISMATCH');
  } else if (source === 'verified_account') {
    if (!Number.isInteger(revision) || revision < 1 || revision > 2147483647) {
      fail('ATOMIC_PROVENANCE_MISMATCH');
    }
  } else fail('ATOMIC_PROVENANCE_MISMATCH');
  const templateVersion = locale === 'es'
    ? ACCESS_READY_SPANISH_DRAFT_VERSION
    : PURCHASE_ACCESS_READY_EMAIL_TEMPLATE_VERSION;
  if (snapshot.template_version !== templateVersion
    || outbox.template_version !== templateVersion) fail('ATOMIC_TEMPLATE_MISMATCH');
  const recipientSha256 = hash(outbox.recipient_email_normalized);
  if (!SHA.test(snapshot.recipient_sha256)
    || snapshot.recipient_sha256 !== recipientSha256) fail('ATOMIC_RECIPIENT_MISMATCH');
  const snapshotIdentity = hash(JSON.stringify({
    accountId,purchaseId,outboxKey:outbox.idempotency_key,
    recipientSha256,locale,source,preferenceRevision:revision,templateVersion,
  }));
  if (!SHA.test(snapshot.snapshot_identity)
    || snapshot.snapshot_identity !== snapshotIdentity) fail('ATOMIC_SNAPSHOT_MISMATCH');
  return Object.freeze({
    state: 'MATCHED_REVIEW_ONLY',locale,
    canWrite: false,canDispatch: false,
    requiresAtomicWriter: true,requiresIndependentAuthCheck: true,
  });
}
