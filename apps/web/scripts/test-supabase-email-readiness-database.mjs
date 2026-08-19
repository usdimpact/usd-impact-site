import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260819215648_email_consent_outbox_contracts.sql',
  import.meta.url,
);
const migration = await readFile(migrationUrl, 'utf8');
const database = new PGlite();

async function expectSqlError(operation, expectedMessage) {
  try {
    await operation();
    assert.fail(`Expected SQL error matching ${expectedMessage}.`);
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    assert.match(String(error?.message ?? error), expectedMessage);
  }
}

async function asRole(role, operation) {
  await database.exec(`set role ${role};`);
  try {
    return await operation();
  } finally {
    await database.exec('reset role;');
  }
}

const now = new Date().toISOString();
const outOfWindow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const consentKey = (character) => `consent:v1:${character.repeat(64)}`;
const notificationKey = (character) => `notification:v1:${character.repeat(64)}`;
const consentEvidence = ({
  purpose = 'book_availability',
  status = 'granted',
  source = 'waitlist_form',
  sourceEventId = 'waitlist-submit-123',
  capturedAt = now,
  withdrawnAt = null,
  withdrawalSource = null,
  context = {},
} = {}) => JSON.stringify({
  captured_at: capturedAt,
  consent_text_version: 'waitlist-v2',
  context,
  privacy_notice_version: 'privacy-2026-08-19',
  purpose,
  source,
  source_event_id: sourceEventId,
  status,
  withdrawal_source: withdrawalSource,
  withdrawn_at: withdrawnAt,
});

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
  await database.exec(migration);

  const securityState = await database.query(`
    select relname, relrowsecurity
    from pg_class
    where oid in (
      'public.marketing_consent_events'::regclass,
      'public.notification_outbox'::regclass
    )
    order by relname;
  `);
  assert.deepEqual(
    securityState.rows,
    [
      { relname: 'marketing_consent_events', relrowsecurity: true },
      { relname: 'notification_outbox', relrowsecurity: true },
    ],
  );

  const policyCount = await database.query(`
    select count(*)::integer as count
    from pg_policy
    where polrelid in (
      'public.marketing_consent_events'::regclass,
      'public.notification_outbox'::regclass
    );
  `);
  assert.equal(policyCount.rows[0].count, 0);

  await asRole('anon', async () => {
    await expectSqlError(
      () => database.query('select * from public.marketing_consent_events;'),
      /permission denied/i,
    );
  });
  await asRole('authenticated', async () => {
    await expectSqlError(
      () => database.query('select * from public.notification_outbox;'),
      /permission denied/i,
    );
  });

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
      $1, 'waitlist-submit-123', 'reader@example.com', 'book_availability',
      'granted', 'waitlist-v2', 'privacy-2026-08-19', 'waitlist_form', $2,
      $3::jsonb, $4
    )
    returning id;
  `, [
    consentKey('a'),
    now,
    consentEvidence({ context: { consentCheckbox: true, request: { country: 'US', locale: 'en' } } }),
    'b'.repeat(64),
  ]));
  const grantId = grant.rows[0].id;

  await asRole('service_role', async () => {
    await expectSqlError(
      () => database.query(`
        insert into public.marketing_consent_events (
          idempotency_key, source_event_id, email_normalized, purpose, status,
          consent_text_version, privacy_notice_version, source, captured_at,
          evidence, evidence_checksum
        ) values (
          $1, 'waitlist-submit-sensitive', 'reader@example.com',
          'book_availability', 'granted', 'waitlist-v2',
          'privacy-2026-08-19', 'waitlist_form', $2, $3::jsonb, $4
        );
      `, [
        consentKey('9'),
        now,
        consentEvidence({
          sourceEventId: 'waitlist-submit-sensitive',
          context: { recipient: 'reader@example.com' },
        }),
        'a'.repeat(64),
      ]),
      /marketing_consent_events_evidence_contract/i,
    );
    await expectSqlError(
      () => database.query(`
        insert into public.marketing_consent_events (
          idempotency_key, source_event_id, email_normalized, purpose, status,
          consent_text_version, privacy_notice_version, source, captured_at,
          evidence, evidence_checksum, created_at
        ) values (
          $1, 'forged-server-time', 'reader@example.com', 'book_availability',
          'granted', 'waitlist-v2', 'privacy-2026-08-19', 'waitlist_form', $2,
          '{}'::jsonb, $3, $2
        );
      `, [consentKey('c'), now, 'd'.repeat(64)]),
      /permission denied/i,
    );
    await expectSqlError(
      () => database.query(`
        insert into public.marketing_consent_events (
          idempotency_key, source_event_id, email_normalized, purpose, status,
          consent_text_version, privacy_notice_version, source, captured_at,
          withdrawn_at, withdrawal_source, related_grant_id, evidence,
          evidence_checksum
        ) values (
          $1, 'unsubscribe-mismatch', 'other@example.com', 'book_availability',
          'withdrawn', 'waitlist-v2', 'privacy-2026-08-19', 'unsubscribe_link',
          $2, $2, 'unsubscribe_link', $3, '{}'::jsonb, $4
        );
      `, [consentKey('e'), now, grantId, 'f'.repeat(64)]),
      /withdrawal must reference a matching consent grant/i,
    );
  });

  const outbox = await asRole('service_role', () => database.query(`
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
      $1, 'marketing.send:campaign_123:v1', 'market_update', 'marketing',
      'campaign', 'campaign_123', 1, 'reader@example.com', 'market_update',
      '2026-08-19', 'resend', true, $2, 'book_availability', $3,
      '{"editionId":"daily_2026_08_19"}'::jsonb, $3
    )
    returning id;
  `, [notificationKey('1'), grantId, now]));
  const outboxId = outbox.rows[0].id;

  await asRole('service_role', async () => {
    await expectSqlError(
      () => database.query(`
        insert into public.notification_outbox (
          idempotency_key, event_id, message_id, classification,
          business_object_type, business_object_id, state_version,
          recipient_email_normalized, template_id, template_version, provider,
          consent_required, consent_record_id, consent_purpose,
          consent_checked_at, payload, next_attempt_at
        ) values (
          $1, 'marketing.send:campaign_127:v1', 'market_update', 'marketing',
          'campaign', 'campaign_127', 1, 'reader@example.com', 'market_update',
          '2026-08-19', 'resend', true, $2, 'book_availability', $3,
          '{"editionId":"daily_2026_08_19","token":"sensitive-token-value"}'::jsonb,
          $3
        );
      `, [notificationKey('5'), grantId, now]),
      /notification_outbox_payload_contract/i,
    );
    await expectSqlError(
      () => database.query(`
        insert into public.notification_outbox (
          idempotency_key, event_id, message_id, classification,
          business_object_type, business_object_id, state_version,
          recipient_email_normalized, template_id, template_version, provider,
          consent_required, consent_record_id, consent_purpose,
          consent_checked_at, payload, next_attempt_at
        ) values (
          $1, 'marketing.send:campaign_124:v1', 'market_update', 'marketing',
          'campaign', 'campaign_124', 1, 'other@example.com', 'market_update',
          '2026-08-19', 'resend', true, $2, 'book_availability', $3,
          '{"editionId":"daily_2026_08_19"}'::jsonb, $3
        );
      `, [notificationKey('2'), grantId, now]),
      /notification must reference an active matching consent grant/i,
    );
    await expectSqlError(
      () => database.query(`
        insert into public.notification_outbox (
          idempotency_key, event_id, message_id, classification,
          business_object_type, business_object_id, state_version,
          recipient_email_normalized, template_id, template_version, provider,
          consent_required, consent_record_id, consent_purpose,
          consent_checked_at, payload, next_attempt_at
        ) values (
          $1, 'marketing.send:campaign_125:v1', 'market_update', 'marketing',
          'campaign', 'campaign_125', 1, 'reader@example.com', 'market_update',
          '2026-08-19', 'resend', true, $2, 'book_availability', $3,
          '{"editionId":"daily_2026_08_19"}'::jsonb, $4
        );
      `, [notificationKey('3'), grantId, outOfWindow, now]),
      /notification_outbox_consent_checked_fresh/i,
    );
    await expectSqlError(
      () => database.query(`
        update public.notification_outbox
        set recipient_email_normalized = 'other@example.com'
        where id = $1;
      `, [outboxId]),
      /permission denied/i,
    );
    const deliveryUpdate = await database.query(`
      update public.notification_outbox
      set status = 'sending', attempt_count = 1
      where id = $1
      returning status, attempt_count;
    `, [outboxId]);
    assert.deepEqual(deliveryUpdate.rows[0], { status: 'sending', attempt_count: 1 });
    await expectSqlError(
      () => database.query(`
        update public.marketing_consent_events
        set status = 'withdrawn'
        where id = $1;
      `, [grantId]),
      /permission denied/i,
    );
  });

  await asRole('service_role', () => database.query(`
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
      withdrawn_at,
      withdrawal_source,
      related_grant_id,
      evidence,
      evidence_checksum
    ) values (
      $1, 'unsubscribe-456', 'reader@example.com', 'book_availability',
      'withdrawn', 'waitlist-v2', 'privacy-2026-08-19', 'unsubscribe_link', $2,
      $2, 'unsubscribe_link', $3, $4::jsonb, $5
    );
  `, [
    consentKey('7'),
    now,
    grantId,
    consentEvidence({
      status: 'withdrawn',
      source: 'unsubscribe_link',
      sourceEventId: 'unsubscribe-456',
      withdrawnAt: now,
      withdrawalSource: 'unsubscribe_link',
    }),
    '8'.repeat(64),
  ]));

  await asRole('service_role', async () => {
    await expectSqlError(
      () => database.query(`
        insert into public.notification_outbox (
          idempotency_key, event_id, message_id, classification,
          business_object_type, business_object_id, state_version,
          recipient_email_normalized, template_id, template_version, provider,
          consent_required, consent_record_id, consent_purpose,
          consent_checked_at, payload, next_attempt_at
        ) values (
          $1, 'marketing.send:campaign_126:v1', 'market_update', 'marketing',
          'campaign', 'campaign_126', 1, 'reader@example.com', 'market_update',
          '2026-08-19', 'resend', true, $2, 'book_availability', $3,
          '{"editionId":"daily_2026_08_19"}'::jsonb, $3
        );
      `, [notificationKey('4'), grantId, now]),
      /notification must reference an active matching consent grant/i,
    );
  });

  const functionSecurity = await database.query(`
    select proname, prosecdef,
      has_function_privilege('anon', p.oid, 'execute') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
      has_function_privilege('service_role', p.oid, 'execute') as service_execute
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and proname in (
        'validate_marketing_consent_event_reference',
        'validate_notification_outbox_consent_reference'
      )
    order by proname;
  `);
  assert.equal(functionSecurity.rows.length, 2);
  for (const row of functionSecurity.rows) {
    assert.equal(row.prosecdef, false);
    assert.equal(row.anon_execute, false);
    assert.equal(row.authenticated_execute, false);
    assert.equal(row.service_execute, false);
  }

  console.log('Supabase email readiness database integration tests passed.');
} finally {
  await database.close();
}
