import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrationDirectory = new URL('../../../supabase/migrations/', import.meta.url);
const foundationMigration = await readFile(
  new URL('20260819215648_email_consent_outbox_contracts.sql', migrationDirectory),
  'utf8',
);
const launchMigrationNames = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith('_expand_launch_email_outbox_contracts.sql'));
assert.equal(launchMigrationNames.length, 1);
const launchMigration = await readFile(new URL(launchMigrationNames[0], migrationDirectory), 'utf8');

const database = new PGlite();
const now = new Date().toISOString();
const recipient = 'reader@example.com';
const consentKey = `consent:v1:${'a'.repeat(64)}`;
let notificationCounter = 0;

function nextNotificationKey() {
  notificationCounter += 1;
  return `notification:v1:${notificationCounter.toString(16).padStart(64, '0')}`;
}

function consentEvidence() {
  return JSON.stringify({
    captured_at: now,
    consent_text_version: 'waitlist-purchase-link-v1',
    context: { consentCheckbox: true, formVersion: 'waitlist-v1' },
    privacy_notice_version: 'privacy-2026-08-18',
    purpose: 'book_availability',
    source: 'waitlist_form',
    source_event_id: 'waitlist.submit:123e4567-e89b-42d3-a456-426614174000',
    status: 'granted',
    withdrawal_source: null,
    withdrawn_at: null,
  });
}

async function asRole(role, operation) {
  await database.exec(`set role ${role};`);
  try {
    return await operation();
  } finally {
    await database.exec('reset role;');
  }
}

async function expectSqlError(operation, expected) {
  try {
    await operation();
    assert.fail(`Expected SQL error matching ${expected}.`);
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    assert.match(String(error?.message ?? error), expected);
  }
}

async function insertOutbox({
  templateId,
  classification,
  consentId = null,
  consentPurpose = null,
  payload = {},
}) {
  const consentRequired = consentId !== null;
  const consentCheckedAt = consentRequired ? now : null;
  return asRole('service_role', () => database.query(`
    insert into public.notification_outbox (
      idempotency_key,
      event_id,
      message_id,
      classification,
      business_object_type,
      business_object_id,
      state_version,
      recipient_email_normalized,
      template_id,
      template_version,
      provider,
      consent_required,
      consent_record_id,
      consent_purpose,
      consent_checked_at,
      payload,
      next_attempt_at
    ) values (
      $1, $2, $3, $4, 'library_pass_event', $5, 1, $6, $3,
      '2026-08-20.v1', 'resend', $7, $8, $9, $10, $11::jsonb, $12
    )
    returning template_id, classification, consent_required, consent_record_id,
      consent_purpose, payload;
  `, [
    nextNotificationKey(),
    `${templateId}.event:${notificationCounter}:v1`,
    templateId,
    classification,
    `${templateId}_${notificationCounter}`,
    recipient,
    consentRequired,
    consentId,
    consentPurpose,
    consentCheckedAt,
    JSON.stringify(payload),
    now,
  ]));
}

try {
  await database.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);

    create function public.set_updated_at()
    returns trigger
    language plpgsql
    security invoker
    set search_path = public
    as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$;
  `);
  await database.exec(foundationMigration);
  await database.exec(launchMigration);

  const grant = await asRole('service_role', () => database.query(`
    insert into public.marketing_consent_events (
      idempotency_key,
      source_event_id,
      email_normalized,
      purpose,
      status,
      consent_text_version,
      privacy_notice_version,
      source,
      captured_at,
      evidence,
      evidence_checksum
    ) values (
      $1,
      'waitlist.submit:123e4567-e89b-42d3-a456-426614174000',
      $2,
      'book_availability',
      'granted',
      'waitlist-purchase-link-v1',
      'privacy-2026-08-18',
      'waitlist_form',
      $3,
      $4::jsonb,
      $5
    ) returning id;
  `, [consentKey, recipient, now, consentEvidence(), 'b'.repeat(64)]));
  const consentId = grant.rows[0].id;

  const requiredTemplates = {
    purchase_pending: 'transactional_operational',
    purchase_access_ready: 'transactional',
    purchase_failed: 'transactional_operational',
    refund_approved: 'transactional',
    dispute_warning: 'transactional_operational',
    chargeback_revoked: 'transactional',
    dispute_reversal_restored: 'transactional',
    privacy_export_acknowledgement: 'transactional_operational',
    account_deletion_requested: 'transactional_operational',
    account_deletion_completed: 'transactional_operational',
    support_case_received: 'operational',
  };

  for (const [templateId, classification] of Object.entries(requiredTemplates)) {
    const inserted = await insertOutbox({ templateId, classification });
    assert.deepEqual(inserted.rows[0], {
      template_id: templateId,
      classification,
      consent_required: false,
      consent_record_id: null,
      consent_purpose: null,
      payload: {},
    });
  }

  for (const [templateId, classification] of [
    ['waitlist_confirmation', 'operational'],
    ['book_availability', 'marketing'],
  ]) {
    const inserted = await insertOutbox({
      templateId,
      classification,
      consentId,
      consentPurpose: 'book_availability',
    });
    assert.equal(inserted.rows[0].consent_required, true);
    assert.equal(inserted.rows[0].consent_record_id, consentId);
    assert.equal(inserted.rows[0].consent_purpose, 'book_availability');
  }

  await insertOutbox({
    templateId: 'market_update',
    classification: 'marketing',
    consentId,
    consentPurpose: 'book_availability',
    payload: { editionId: 'daily_2026_08_20' },
  });
  await insertOutbox({
    templateId: 'purchase_receipt',
    classification: 'transactional',
    payload: { amountCents: 3900, currency: 'USD' },
  });

  await expectSqlError(
    () => insertOutbox({ templateId: 'waitlist_confirmation', classification: 'operational' }),
    /notification_outbox_(?:consent_reference_complete|payload_contract)/i,
  );
  await expectSqlError(
    () => insertOutbox({
      templateId: 'waitlist_confirmation',
      classification: 'operational',
      consentId,
      consentPurpose: 'market_updates',
    }),
    /notification_outbox_payload_contract/i,
  );
  await expectSqlError(
    () => insertOutbox({
      templateId: 'purchase_access_ready',
      classification: 'transactional',
      consentId,
      consentPurpose: 'book_availability',
    }),
    /notification_outbox_payload_contract/i,
  );
  await expectSqlError(
    () => insertOutbox({
      templateId: 'purchase_access_ready',
      classification: 'transactional',
      payload: { token: 'not-allowed' },
    }),
    /notification_outbox_payload_contract/i,
  );
  await expectSqlError(
    () => insertOutbox({
      templateId: 'auth_sign_in',
      classification: 'transactional_security',
    }),
    /notification_outbox_payload_contract/i,
  );

  const constraint = await database.query(`
    select pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid = 'public.notification_outbox'::regclass
      and conname = 'notification_outbox_payload_contract';
  `);
  assert.equal(constraint.rows.length, 1);
  assert.match(constraint.rows[0].definition, /book_availability/);
  assert.match(constraint.rows[0].definition, /purchase_access_ready/);
  assert.doesNotMatch(constraint.rows[0].definition, /auth_sign_in/);

  console.log('Launch email outbox database integration tests passed.');
} finally {
  await database.close();
}
