import assert from 'node:assert/strict';
import {
  PUBLICATION_GUARD_PRODUCTION_READER_SCOPE,
  PublicationGuardProductionReaderDatabaseError,
  assertPublicationGuardProductionReaderContext,
  createPublicationGuardProductionReaderDatabase,
  validatePublicationGuardProductionDatabaseUrl,
} from '../src/lib/publication-production-reader-database.js';

let groups = 0;
const pass = () => { groups += 1; };
const secret = 'p'.repeat(64);
const ref = PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.projectRef;
const readerUrl = `postgresql://fx558_reader_login.${ref}:${secret}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`;
const readerCa = `-----BEGIN CERTIFICATE-----\n${'A'.repeat(256)}\n-----END CERTIFICATE-----`;
const commitSha = 'a'.repeat(40);
const baseEnvironment = Object.freeze({
  VERCEL: '1',
  VERCEL_ENV: 'production',
  VERCEL_TARGET_ENV: 'production',
  VERCEL_PROJECT_ID: PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.approvedProjectId,
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'usdimpact',
  VERCEL_GIT_REPO_SLUG: 'usd-impact-site',
  VERCEL_GIT_COMMIT_REF: 'main',
  VERCEL_GIT_COMMIT_SHA: commitSha,
  PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_URL: readerUrl,
  PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_CA_CERT: readerCa,
});

const goodIdentity = Object.freeze({
  role: 'fx558_reader_login',
  database: 'postgres',
  readSnapshot: true,
  authorizeRelease: false,
  prepareAdmission: false,
  recordVerifiedReceipt: false,
  revokeRelease: false,
  revokeAdmission: false,
});

class FakePool {
  static identity = goodIdentity;
  static failure = null;
  static instances = [];

  constructor(config) {
    this.config = config;
    this.calls = [];
    this.ended = false;
    FakePool.instances.push(this);
  }

  async query(config) {
    this.calls.push(config);
    assert.equal(Object.hasOwn(config, 'name'), false, 'transaction-pool queries must remain unnamed');
    assert.equal(typeof config.text, 'string');
    assert.equal(Array.isArray(config.values), true);
    if (FakePool.failure) throw FakePool.failure;
    if (config.text.includes("'readSnapshot', has_function_privilege")) {
      return { rows: [{ value: FakePool.identity }] };
    }
    if (config.text === 'select publication_guard_api.read_snapshot($1, $2::jsonb) as value') {
      return { rows: [{ value: { revision: config.values[0], records: [] } }] };
    }
    throw new Error('unexpected query');
  }

  async end() { this.ended = true; }
}

function hold(work, code) {
  assert.throws(
    work,
    (error) => error instanceof PublicationGuardProductionReaderDatabaseError && error.code === code,
  );
  pass();
}

async function asyncHold(work, code) {
  await assert.rejects(work, (error) => error?.code === code && error?.message === code);
  pass();
}

assert.equal(ref, 'edkdqncrreouzmxqeypm');
assert.deepEqual(PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.blockedProjectRefs, [
  'xakayexlzyrazuunqlxe',
  'ycstrcvshdluovtuasjc',
  'gjzetjugmnwanvjkchux',
]);
assert.equal(PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.approvedBranch, 'main');
assert.equal(PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.publicationAuthorized, false);
assert.equal(PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.enforcementActive, false);
pass();

const validated = validatePublicationGuardProductionDatabaseUrl(readerUrl);
assert.deepEqual(validated, {
  role: 'reader',
  projectRef: ref,
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  username: `fx558_reader_login.${ref}`,
  sslRequired: true,
});
assert.equal(JSON.stringify(validated).includes(secret), false);
pass();

hold(() => validatePublicationGuardProductionDatabaseUrl(''), 'HOLD_PRODUCTION_DATABASE_URL');
hold(() => validatePublicationGuardProductionDatabaseUrl(readerUrl.replace('postgresql:', 'https:')), 'HOLD_PRODUCTION_DATABASE_PROTOCOL');
hold(() => validatePublicationGuardProductionDatabaseUrl(readerUrl.replace('aws-0-eu-central-1.pooler.supabase.com:6543', `db.${ref}.supabase.co:5432`)), 'HOLD_PRODUCTION_DATABASE_POOLER');
hold(() => validatePublicationGuardProductionDatabaseUrl(readerUrl.replace('/postgres?', '/template1?')), 'HOLD_PRODUCTION_DATABASE_NAME');
hold(() => validatePublicationGuardProductionDatabaseUrl(readerUrl.replace(`fx558_reader_login.${ref}`, `fx558_controller_login.${ref}`)), 'HOLD_PRODUCTION_DATABASE_ROLE');
hold(() => validatePublicationGuardProductionDatabaseUrl(readerUrl.replace('?sslmode=require', '?sslmode=disable')), 'HOLD_PRODUCTION_DATABASE_OPTIONS');
hold(() => validatePublicationGuardProductionDatabaseUrl(readerUrl.replace('?sslmode=require', '?sslmode=require&application_name=x')), 'HOLD_PRODUCTION_DATABASE_OPTIONS');
for (const blocked of PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.blockedProjectRefs) {
  hold(() => validatePublicationGuardProductionDatabaseUrl(readerUrl.replace(ref, blocked)), 'HOLD_PRODUCTION_DATABASE_PROJECT');
}

const runtime = assertPublicationGuardProductionReaderContext(baseEnvironment);
assert.deepEqual(runtime, {
  environment: 'production',
  projectId: PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.approvedProjectId,
  repository: 'usdimpact/usd-impact-site',
  branch: 'main',
  commitSha,
});
pass();

hold(() => assertPublicationGuardProductionReaderContext({ ...baseEnvironment, VERCEL_ENV: 'preview' }), 'HOLD_PRODUCTION_READER_ENVIRONMENT');
hold(() => assertPublicationGuardProductionReaderContext({ ...baseEnvironment, VERCEL_GIT_COMMIT_REF: 'publishing/558-calendar-validation' }), 'HOLD_PRODUCTION_READER_BRANCH');
hold(() => assertPublicationGuardProductionReaderContext({ ...baseEnvironment, VERCEL_GIT_COMMIT_SHA: 'bad' }), 'HOLD_PRODUCTION_READER_COMMIT');
hold(() => assertPublicationGuardProductionReaderContext({ ...baseEnvironment, VERCEL_GIT_REPO_OWNER: 'other' }), 'HOLD_PRODUCTION_READER_REPOSITORY');
hold(() => assertPublicationGuardProductionReaderContext({ ...baseEnvironment, VERCEL_PROJECT_ID: 'prj_other' }), 'HOLD_PRODUCTION_READER_PROJECT');

hold(() => createPublicationGuardProductionReaderDatabase({ environment: { ...baseEnvironment, PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_CA_CERT: '' }, PoolClass: FakePool }), 'HOLD_PRODUCTION_READER_DATABASE_CA');
hold(() => createPublicationGuardProductionReaderDatabase({ environment: baseEnvironment, PoolClass: {} }), 'HOLD_PRODUCTION_READER_POOL');

FakePool.identity = goodIdentity;
FakePool.failure = null;
const database = createPublicationGuardProductionReaderDatabase({ environment: baseEnvironment, PoolClass: FakePool });
const pool = FakePool.instances.at(-1);
assert.equal(Object.hasOwn(pool.config, 'connectionString'), false);
assert.equal(pool.config.host, 'aws-0-eu-central-1.pooler.supabase.com');
assert.equal(pool.config.port, 6543);
assert.equal(pool.config.database, 'postgres');
assert.equal(pool.config.user, `fx558_reader_login.${ref}`);
assert.equal(pool.config.password, secret);
assert.deepEqual(pool.config.ssl, { ca: readerCa, rejectUnauthorized: true });
assert.equal(pool.config.max, 1);
assert.equal(database.publicationAuthorized, false);
assert.equal(database.enforcementActive, false);
assert.equal(JSON.stringify(database).includes(secret), false);
assert.equal(JSON.stringify(database).includes(readerCa), false);
pass();

const identity = await database.verifyIdentityAndPrivileges();
assert.deepEqual(identity, {
  role: 'fx558_reader_login',
  database: 'postgres',
  ssl: true,
  readSnapshot: true,
  writePrivileges: false,
  projectRef: ref,
});
pass();

const snapshot = await database.readSnapshot({ revision: '0', entries: [] });
assert.deepEqual(snapshot, { revision: '0', records: [] });
assert.deepEqual(pool.calls.at(-1).values, ['0', '[]']);
pass();

await database.close();
assert.equal(pool.ended, true);
pass();

FakePool.identity = { ...goodIdentity, authorizeRelease: true };
const privilegeDrift = createPublicationGuardProductionReaderDatabase({ environment: baseEnvironment, PoolClass: FakePool });
await asyncHold(() => privilegeDrift.verifyIdentityAndPrivileges(), 'HOLD_PRODUCTION_READER_PRIVILEGE');
await privilegeDrift.close();

FakePool.identity = goodIdentity;
FakePool.failure = Object.assign(new Error(`password authentication failed ${secret}`), { code: '28P01' });
const backendFailure = createPublicationGuardProductionReaderDatabase({ environment: baseEnvironment, PoolClass: FakePool });
await asyncHold(() => backendFailure.verifyIdentityAndPrivileges(), 'HOLD_READER_DATABASE_AUTH_28P01');
await backendFailure.close();
FakePool.failure = null;

console.log(`publication production reader database tests pass (${groups} groups; offline fake pool only)`);
