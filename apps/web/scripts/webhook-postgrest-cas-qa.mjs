// Issue #620: manual Development PostgREST HTTP CAS acceptance; never a site route.
// Creates only one synthetic accepted outbox row, issues conditional PATCH requests,
// and deletes/verifies that same row. No provider calls, emails or Production access.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEV_PROJECT = 'ycstrcvshdluovtuasjc';
export const DEV_ORIGIN = 'https://' + DEV_PROJECT + '.supabase.co';
export const FIXTURE_TYPE = 'webhook_http_cas_qa';
const APPROVAL = 'DEV_ONLY_NO_SEND';
const REPOSITORY = 'usdimpact/usd-impact-site';
const STATUS_CHOICES = new Set(['accepted', 'delivered', 'complained']);

export function makeFixture(id = randomUUID()) {
  assert.match(id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
  const compact = id.replace(/-/g, '');
  return Object.freeze({
    id,
    providerRef: 'qa-cas-' + id,
    email: 'cas+' + compact + '@example.invalid',
    messageId: 'qa.http.cas:' + compact,
    idempotencyKey: 'notification:v1:' + createHash('sha256').update('dev-http-cas:' + id).digest('hex'),
  });
}

export function assertSafeEnvironment(env, mode = 'live') {
  assert.equal(env.GITHUB_ACTIONS, 'true', 'RUNNER_MUST_BE_GITHUB_ACTIONS');
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'MANUAL_DISPATCH_ONLY');
  assert.equal(env.GITHUB_REPOSITORY, REPOSITORY, 'UNEXPECTED_REPOSITORY');
  assert.equal(env.GITHUB_REF, 'refs/heads/main', 'PROTECTED_DEFAULT_BRANCH_REQUIRED');
  assert.equal(env.CAS_APPROVED_RUN, APPROVAL, 'NO_EXPLICIT_DEV_APPROVAL');
  assert.equal(env.CAS_PROJECT_ID, DEV_PROJECT, 'WRONG_SUPABASE_PROJECT');
  assert.equal(env.CAS_RUN_ENVIRONMENT, 'development-webhook-cas', 'WRONG_RUNNER_ENVIRONMENT');
  assert.match(env.GITHUB_SHA || '', /^[0-9a-f]{40}$/, 'MISSING_CHECKED_OUT_SHA');
  assert.equal(env.CAS_REVIEWED_SHA, env.GITHUB_SHA, 'REVIEWED_SHA_MISMATCH');
  assert.equal(env.VERCEL_ENV === 'production', false, 'PRODUCTION_ENV_FORBIDDEN');
  assert.match(env.GITHUB_RUN_ID || '', /^[0-9]{1,24}$/, 'MISSING_GITHUB_RUN_ID');
  assert.match(env.DEV_PGHOST || '', /^[a-z0-9.-]+$/, 'INVALID_PGHOST');
  assert.equal(env.DEV_PGPORT, '5432', 'NON_SESSION_PGPORT_FORBIDDEN');
  assert.equal(env.DEV_PGDATABASE, 'postgres', 'UNEXPECTED_DATABASE');
  const direct = env.DEV_PGHOST === 'db.' + DEV_PROJECT + '.supabase.co'
    && env.DEV_PGUSER === 'postgres';
  const pooler = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pooler\.supabase\.com$/.test(env.DEV_PGHOST)
    && env.DEV_PGUSER === 'postgres.' + DEV_PROJECT;
  assert.ok(direct || pooler, 'DEV_DATABASE_HOST_OR_ROLE_MISMATCH');
  assert.ok(typeof env.DEV_PGPASSWORD === 'string' && env.DEV_PGPASSWORD.length >= 16,
    'MISSING_DEVELOPMENT_DB_CREDENTIAL');
  assert.ok(typeof env.DEV_PGROOTCERT_PEM === 'string'
    && env.DEV_PGROOTCERT_PEM.startsWith('-----BEGIN CERTIFICATE-----')
    && env.DEV_PGROOTCERT_PEM.trimEnd().endsWith('-----END CERTIFICATE-----')
    && env.DEV_PGROOTCERT_PEM.length <= 16000,
    'MISSING_VERIFIED_DEVELOPMENT_CA_CERTIFICATE');
  if (mode === 'live') {
    assert.ok(typeof env.DEV_POSTGREST_SECRET_KEY === 'string'
      && (env.DEV_POSTGREST_SECRET_KEY.startsWith('sb_secret_')
        || env.DEV_POSTGREST_SECRET_KEY.startsWith('eyJ'))
      && env.DEV_POSTGREST_SECRET_KEY.length > 26,
    'MISSING_DEVELOPMENT_POSTGREST_CREDENTIAL');
  }
}

function manifestPath(env) {
  return join(env.RUNNER_TEMP || tmpdir(), 'usd-impact-webhook-cas-' + env.GITHUB_RUN_ID + '.json');
}

function assertManifest(value) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  const fixture = makeFixture(value.id);
  assert.equal(value.providerRef, fixture.providerRef, 'MANIFEST_REF_MISMATCH');
  assert.equal(value.email, fixture.email, 'MANIFEST_EMAIL_MISMATCH');
  return fixture;
}

// O_EXCL-backed 'wx' atomically refuses existing manifests, including a
// pre-existing symlink. Never unlink or overwrite an interrupted run's file.
// The caller must separately reconcile any existing QA database fixture.
export function reserveFreshManifest(path, fixture) {
  const manifest = JSON.stringify({
    id: fixture.id, providerRef: fixture.providerRef, email: fixture.email,
  });
  try {
    writeFileSync(path, manifest, { mode: 0o600, flag: 'wx' });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('STALE_FIXTURE_REQUIRES_CLEANUP');
    throw error;
  }
}

function sqlClient(env, statement, fixture) {
  const args = ['-X', '-q', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1',
    '-v', 'fixture_id=' + fixture.id, '-v', 'provider_ref=' + fixture.providerRef,
    '-v', 'fixture_email=' + fixture.email, '-v', 'message_id=' + fixture.messageId,
    '-v', 'idempotency_key=' + fixture.idempotencyKey];
  // Supabase verifies the server hostname using the Development CA downloaded
  // from its Database SSL settings. The public certificate is ephemeral here;
  // the database password stays exclusively in process environment.
  const certPath = join(env.RUNNER_TEMP || tmpdir(),
    'usd-impact-webhook-cas-ca-' + env.GITHUB_RUN_ID + '.crt');
  writeFileSync(certPath, env.DEV_PGROOTCERT_PEM, { mode: 0o600, flag: 'w' });
  let result;
  try {
    const pgEnv = {
      // Do not inherit unrelated GitHub/API secrets into the psql child.
      PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG,
      PGHOST: env.DEV_PGHOST, PGUSER: env.DEV_PGUSER,
      PGDATABASE: env.DEV_PGDATABASE, PGPORT: env.DEV_PGPORT,
      PGPASSWORD: env.DEV_PGPASSWORD, PGSSLMODE: 'verify-full',
      PGSSLROOTCERT: certPath, PGCONNECT_TIMEOUT: '6',
    };
    result = spawnSync('psql', args, { input: statement, encoding: 'utf8',
      env: pgEnv, timeout: 15000, maxBuffer: 8192, stdio: ['pipe', 'pipe', 'pipe'] });
  } finally {
    if (existsSync(certPath)) unlinkSync(certPath);
  }
  if (result.error || result.status !== 0) throw new Error('DEVELOPMENT_SQL_OPERATION_FAILED');
  return (result.stdout || '').trim().split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

const INSERT_SQL = String.raw `BEGIN;
SET LOCAL statement_timeout = '8s';
SET LOCAL lock_timeout = '3s';
INSERT INTO public.notification_outbox (
  id,idempotency_key,event_id,message_id,classification,business_object_type,
  business_object_id,state_version,recipient_email_normalized,template_id,
  template_version,provider,consent_required,payload,status,provider_message_ref
) VALUES (
  :'fixture_id'::uuid, :'idempotency_key', 'qa-dev-webhook-cas-v1', :'message_id',
  'operational', 'webhook_http_cas_qa', :'fixture_id', 1, :'fixture_email',
  'support_case_received', 'qa-v1', 'resend', FALSE, '{}'::jsonb,
  'accepted', :'provider_ref'
)
RETURNING id,status;
COMMIT;`;

const ORPHAN_CHECK_SQL = String.raw `SELECT 'preexisting:' || count(*)
FROM public.notification_outbox
WHERE business_object_type = 'webhook_http_cas_qa'
  AND recipient_email_normalized LIKE 'cas+%@example.invalid';`;

const CLEANUP_SQL = String.raw `BEGIN;
SET LOCAL statement_timeout = '8s';
SET LOCAL lock_timeout = '3s';
WITH removed AS (
  DELETE FROM public.notification_outbox
  WHERE id = :'fixture_id'::uuid
    AND business_object_type = 'webhook_http_cas_qa'
    AND provider = 'resend'
    AND provider_message_ref = :'provider_ref'
    AND recipient_email_normalized = :'fixture_email'
  RETURNING id
)
SELECT 'deleted:' || count(*) FROM removed;
SELECT 'remaining:' || count(*) FROM public.notification_outbox
WHERE id = :'fixture_id'::uuid;
COMMIT;`;

function cleanup(env) {
  const path = manifestPath(env);
  if (!existsSync(path)) return Object.freeze({ cleanup: 'no-manifest' });
  const fixture = assertManifest(JSON.parse(readFileSync(path, 'utf8')));
  const rows = sqlClient(env, CLEANUP_SQL, fixture);
  assert.ok(rows.some((line) => line === 'remaining:0'), 'CLEANUP_NOT_PROVEN_ZERO');
  unlinkSync(path);
  return Object.freeze({ cleanup: 'verified-zero-rows' });
}

export function assertRows(rows, fixture, targetStatus) {
  assert.ok(Array.isArray(rows) && rows.length <= 1, 'INVALID_POSTGREST_ROW_COUNT');
  for (const row of rows) {
    assert.ok(row && typeof row === 'object' && !Array.isArray(row), 'INVALID_POSTGREST_ROW');
    assert.equal(row.id, fixture.id, 'UNEXPECTED_OUTBOX_ID');
    assert.equal(row.provider_message_ref, fixture.providerRef, 'UNEXPECTED_PROVIDER_REF');
    if (targetStatus) assert.equal(row.status, targetStatus, 'UNEXPECTED_ROW_STATUS');
  }
  return rows;
}

export async function exerciseCas({ fixture, patch, read }) {
  // Both HTTP requests are started before either promise is awaited.
  const [delivered, complained] = await Promise.all([
    patch('accepted', 'delivered'),
    patch('accepted', 'complained'),
  ]);
  assertRows(delivered, fixture, 'delivered');
  assertRows(complained, fixture, 'complained');
  assert.equal(delivered.length + complained.length, 1, 'CAS_ONE_WINNER_ONE_LOSER_REQUIRED');
  const winner = delivered.length ? 'delivered' : 'complained';
  let current = assertRows(await read(), fixture)[0];
  assert.ok(current && current.status === winner, 'CAS_AUTHORITATIVE_REREAD_MISMATCH');
  if (winner === 'delivered') {
    assert.equal(assertRows(await patch('delivered', 'complained'), fixture, 'complained').length,
      1, 'COMPLAINT_MUST_SUPERSEDE_DELIVERY');
  }
  current = assertRows(await read(), fixture)[0];
  assert.ok(current && current.status === 'complained', 'COMPLAINT_NOT_TERMINAL');
  // A delayed delivery that read the original accepted state must not regress it.
  assert.equal(assertRows(await patch('accepted', 'delivered'), fixture, 'delivered').length,
    0, 'STALE_DELIVERY_OVERWROTE_TERMINAL_STATE');
  current = assertRows(await read(), fixture)[0];
  assert.ok(current && current.status === 'complained', 'TERMINAL_STATE_REGRESSED');
  return Object.freeze({ result: 'PASS', raceWinner: winner, finalStatus: current.status });
}

// Opaque sb_secret_ keys are not JWTs. Supplying one as Authorization: Bearer
// causes PostgREST to reject it, even if apikey matches. A legacy service_role
// JWT may be used as both headers. This is a server-only test runner.
export function makeRestHeaders(key) {
  assert.ok(typeof key === 'string' && key.length > 26
    && (key.startsWith('sb_secret_') || key.startsWith('eyJ')), 'INVALID_DEV_REST_KEY');
  return Object.freeze({
    apikey: key,
    ...(key.startsWith('eyJ') ? { Authorization: 'Bearer ' + key } : {}),
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  });
}

function createRestClient(env, fixture) {
  const endpoint = DEV_ORIGIN + '/rest/v1/notification_outbox';
  const headers = makeRestHeaders(env.DEV_POSTGREST_SECRET_KEY);
  let inFlight = 0;
  let overlapped = false;
  async function send(method, params, body) {
    const uri = new URL(endpoint);
    for (const [name, value] of Object.entries(params)) uri.searchParams.set(name, value);
    assert.equal(uri.origin, DEV_ORIGIN, 'UNEXPECTED_HTTP_TARGET');
    inFlight += 1;
    if (inFlight > 1) overlapped = true;
    try {
      const response = await fetch(uri, {
        method, headers, redirect: 'error', cache: 'no-store',
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error('POSTGREST_HTTP_STATUS_' + response.status);
      return assertRows(await response.json(), fixture);
    } finally {
      inFlight -= 1;
    }
  }
  const base = { id: 'eq.' + fixture.id, provider: 'eq.resend',
    provider_message_ref: 'eq.' + fixture.providerRef,
    select: 'id,status,provider_message_ref' };
  return Object.freeze({
    patch: (from, to) => {
      assert.ok(STATUS_CHOICES.has(from) && STATUS_CHOICES.has(to), 'FORBIDDEN_STATUS');
      return send('PATCH', { ...base, status: 'eq.' + from }, { status: to });
    },
    read: () => send('GET', base),
    get overlapObserved() { return overlapped; },
  });
}

function output(data) {
  // Fixed, non-sensitive output fields only: never print secrets or response bodies.
  process.stdout.write(JSON.stringify(data) + '\n');
}

async function live() {
  const env = process.env;
  assertSafeEnvironment(env, 'live');
  const fixture = makeFixture();
  const path = manifestPath(env);
  // Reserve the manifest with exclusive creation below, not check-then-write.
  // Never silently overwrite or delete leftovers from an interrupted run.
  // Only a read-only count is needed; manual recovery remains separately gated.
  assert.ok(sqlClient(env, ORPHAN_CHECK_SQL, fixture).includes('preexisting:0'),
    'PREEXISTING_QA_FIXTURE_REQUIRES_RECONCILIATION');
  reserveFreshManifest(path, fixture);
  let outcome;
  let cleanupFailed = false;
  try {
    assert.ok(sqlClient(env, INSERT_SQL, fixture).includes(fixture.id + '|accepted'),
      'FIXTURE_INSERT_NOT_VERIFIED');
    const client = createRestClient(env, fixture);
    outcome = await exerciseCas({ fixture, patch: client.patch, read: client.read });
    assert.equal(client.overlapObserved, true, 'HTTP_REQUESTS_NOT_OVERLAPPED');
  } finally {
    try { cleanup(env); } catch { cleanupFailed = true; }
  }
  if (cleanupFailed) throw new Error('SYNTHETIC_FIXTURE_CLEANUP_FAILED');
  output({ test: 'development-postgrest-http-cas', ...outcome,
    cleanup: 'verified-zero-rows', project: DEV_PROJECT });
}

export async function cli(args = process.argv.slice(2)) {
  try {
    if (args.length !== 1 || !['--live', '--cleanup'].includes(args[0])) {
      throw new Error('EXPLICIT_LIVE_OR_CLEANUP_REQUIRED');
    }
    if (args[0] === '--live') await live();
    else {
      assertSafeEnvironment(process.env, 'cleanup');
      output({ test: 'development-postgrest-http-cas',
        ...cleanup(process.env), project: DEV_PROJECT });
    }
  } catch (error) {
    output({ test: 'development-postgrest-http-cas', result: 'FAIL',
      code: /^[A-Z][A-Z0-9_]+$/.test(error?.message || '')
        ? error.message : 'GUARD_OR_HTTP_TEST_FAILED', project: DEV_PROJECT });
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await cli();
}
