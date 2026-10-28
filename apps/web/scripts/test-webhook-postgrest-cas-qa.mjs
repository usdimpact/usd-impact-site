import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  DEV_ORIGIN, DEV_PROJECT, FIXTURE_TYPE, makeFixture, assertSafeEnvironment,
  assertRows, exerciseCas,
} from './webhook-postgrest-cas-qa.mjs';

const id = '70707070-7070-4707-8707-707070707070';
const fixture = makeFixture(id);
const sha = 'a'.repeat(40);
const fakeEnv = Object.freeze({
  GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REPOSITORY: 'usdimpact/usd-impact-site', GITHUB_SHA: sha,
  CAS_REVIEWED_SHA: sha, GITHUB_RUN_ID: '1234567',
  CAS_APPROVED_RUN: 'DEV_ONLY_NO_SEND',
  CAS_PROJECT_ID: DEV_PROJECT, CAS_RUN_ENVIRONMENT: 'development-webhook-cas',
  DEV_PGHOST: 'db.' + DEV_PROJECT + '.supabase.co',
  DEV_PGPORT: '5432', DEV_PGUSER: 'postgres',
  DEV_PGDATABASE: 'postgres', DEV_PGPASSWORD: 'offline-only-not-a-password',
  DEV_PGROOTCERT_PEM: '-----BEGIN CERTIFICATE-----\nOFFLINE-TEST-ONLY\n-----END CERTIFICATE-----',
  DEV_POSTGREST_SECRET_KEY: 'sb_secret_offline_fixture_not_a_real_key',
});

test('fixtures are deterministic, non-deliverable and scoped to the QA object type', () => {
  assert.equal(DEV_ORIGIN, 'https://ycstrcvshdluovtuasjc.supabase.co');
  assert.equal(FIXTURE_TYPE, 'webhook_http_cas_qa');
  assert.equal(fixture.email.endsWith('@example.invalid'), true);
  assert.match(fixture.idempotencyKey, /^notification:v1:[0-9a-f]{64}$/);
  assert.equal(makeFixture(id).providerRef, fixture.providerRef);
  assert.throws(() => makeFixture('production-customer-id'));
});

test('every run is manual, exact-head, Development-only and credential-gated', () => {
  assert.doesNotThrow(() => assertSafeEnvironment(fakeEnv));
  for (const [key, value] of [
    ['GITHUB_ACTIONS', 'false'], ['GITHUB_EVENT_NAME', 'pull_request'],
    ['GITHUB_REPOSITORY', 'attacker/foreign-repo'],
    ['CAS_APPROVED_RUN', 'NO'], ['CAS_PROJECT_ID', 'gjzetjugmnwanvjkchux'],
    ['CAS_RUN_ENVIRONMENT', 'production'], ['CAS_REVIEWED_SHA', 'b'.repeat(40)],
    ['GITHUB_RUN_ID', '../bad'], ['DEV_PGPORT', '6543'],
    ['DEV_PGHOST', 'db.gjzetjugmnwanvjkchux.supabase.co'],
    ['DEV_PGUSER', 'postgres.gjzetjugmnwanvjkchux'],
    ['DEV_PGPASSWORD', ''], ['DEV_PGROOTCERT_PEM', ''],
    ['DEV_POSTGREST_SECRET_KEY', ''],
    ['VERCEL_ENV', 'production'],
  ]) {
    assert.throws(() => assertSafeEnvironment({ ...fakeEnv, [key]: value }),
      undefined, 'must reject ' + key + '=' + value);
  }
  assert.doesNotThrow(() => assertSafeEnvironment({
    ...fakeEnv, DEV_PGHOST: 'aws-0-eu-central-1.pooler.supabase.com',
    DEV_PGUSER: 'postgres.' + DEV_PROJECT,
  }, 'cleanup'));
});

test('only one row with the exact fixture identity is accepted', () => {
  const ok = { id: fixture.id, provider_message_ref: fixture.providerRef, status: 'delivered' };
  assert.deepEqual(assertRows([ok], fixture, 'delivered'), [ok]);
  assert.deepEqual(assertRows([], fixture, 'delivered'), []);
  assert.throws(() => assertRows([ok, ok], fixture, 'delivered'));
  assert.throws(() => assertRows([{ ...ok, id: 'bad' }], fixture, 'delivered'));
  assert.throws(() => assertRows([{ ...ok, provider_message_ref: 'foreign' }], fixture));
  assert.throws(() => assertRows([{ ...ok, status: 'complained' }], fixture, 'delivered'));
});

function memoryHttpRace(firstWinner) {
  let row = { id: fixture.id, provider_message_ref: fixture.providerRef, status: 'accepted' };
  let calls = 0;
  const patch = async (before, after) => {
    calls += 1;
    // Simulate two independent HTTP requests arriving with opposite order.
    await new Promise((resolve) =>
      setTimeout(resolve, before === 'accepted' && after === firstWinner ? 0 : 2));
    if (row.status !== before) return [];
    row = { ...row, status: after };
    return [{ ...row }];
  };
  return {
    patch,
    read: async () => [{ ...row }],
    state: () => ({ row, calls }),
  };
}
for (const winner of ['complained', 'delivered']) {
  test('simulated HTTP CAS accepts one winner and preserves terminal complaint (' + winner + ')', async () => {
    const db = memoryHttpRace(winner);
    const outcome = await exerciseCas({ fixture, patch: db.patch, read: db.read });
    assert.equal(outcome.result, 'PASS');
    assert.equal(outcome.raceWinner, winner);
    assert.equal(db.state().row.status, 'complained');
    assert.equal(db.state().calls, winner === 'delivered' ? 4 : 3);
  });
}

test('non-atomic PostgREST behavior is caught even if both PATCHes report 200', async () => {
  const patch = async (from, to) => [{
    id: fixture.id, provider_message_ref: fixture.providerRef, status: to,
  }];
  await assert.rejects(
    exerciseCas({ fixture, patch, read: async () => [] }),
    /CAS_ONE_WINNER_ONE_LOSER_REQUIRED/,
  );
});

test('a stale delivery which overwrites complaint causes acceptance failure', async () => {
  let row = { id: fixture.id, provider_message_ref: fixture.providerRef, status: 'accepted' };
  const patch = async (from, to) => {
    if (from === 'accepted' && to === 'delivered' && row.status !== 'accepted') {
      row = { ...row, status: 'delivered' };
      return [{ ...row }];
    }
    if (row.status !== from) return [];
    row = { ...row, status: to };
    return [{ ...row }];
  };
  await assert.rejects(
    exerciseCas({ fixture, patch, read: async () => [{ ...row }] }),
    /STALE_DELIVERY_OVERWROTE_TERMINAL_STATE|CAS_ONE_WINNER_ONE_LOSER_REQUIRED/,
  );
});

test('orphan fixture check cannot silently proceed or delete historical QA rows', () => {
  const runner = readFileSync(new URL('./webhook-postgrest-cas-qa.mjs', import.meta.url), 'utf8');
  assert.match(runner, /PREEXISTING_QA_FIXTURE_REQUIRES_RECONCILIATION/);
  assert.match(runner, /WHERE business_object_type = 'webhook_http_cas_qa'/);
  assert.match(runner, /recipient_email_normalized LIKE 'cas\+%@example.invalid'/);
});

test('workflow is manual for live secrets and never runs live tests on pull requests', () => {
  const workflow = readFileSync(
    new URL('../../../.github/workflows/dev-webhook-postgrest-cas-qa.yml', import.meta.url), 'utf8');
  assert.match(workflow, /^  workflow_dispatch:\s*$/m);
  assert.match(workflow, /environment: development-webhook-cas/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /github\.event_name == 'pull_request'/);
  assert.match(workflow, /permissions:\s*\n  contents: read/);
  assert.doesNotMatch(workflow, /schedule:|on:\s*\n\s+push:/);
  assert.doesNotMatch(workflow, /VERCEL_TOKEN|RESEND_API_KEY|PRODUCTION_.*SECRET/i);
});
