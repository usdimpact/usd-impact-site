import assert from 'node:assert/strict';
import {
  PUBLICATION_GUARD_READER_RUNTIME_SCOPE,
  PublicationGuardReaderDatabaseError,
  assertPublicationGuardReaderPreviewContext,
  createPublicationGuardReaderDatabase,
} from '../src/lib/publication-guard-reader-database.js';

let groups = 0;
const pass = () => { groups += 1; };
const secret = 'r'.repeat(64);
const ref = PUBLICATION_GUARD_READER_RUNTIME_SCOPE.projectRef;
const readerUrl = `postgresql://fx558_reader_login.${ref}:${secret}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`;
const baseEnvironment = Object.freeze({
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  VERCEL_TARGET_ENV: 'preview',
  VERCEL_PROJECT_ID: PUBLICATION_GUARD_READER_RUNTIME_SCOPE.approvedProjectId,
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'usdimpact',
  VERCEL_GIT_REPO_SLUG: 'usd-impact-site',
  VERCEL_GIT_COMMIT_REF: PUBLICATION_GUARD_READER_RUNTIME_SCOPE.approvedBranch,
  PUBLICATION_GUARD_READER_DATABASE_URL: readerUrl,
});

const goodIdentity = Object.freeze({
  role: 'fx558_reader_login',
  database: 'postgres',
  ssl: true,
  readSnapshot: true,
  authorizeRelease: false,
  prepareAdmission: false,
  recordVerifiedReceipt: false,
  revokeRelease: false,
  revokeAdmission: false,
});

class FakePool {
  static mode = 'ok';
  static identity = goodIdentity;
  static instances = [];

  constructor(config) {
    this.config = config;
    this.ended = false;
    this.calls = [];
    FakePool.instances.push(this);
  }

  async query(config) {
    this.calls.push(config);
    assert.equal(Object.hasOwn(config, 'name'), false, 'transaction-pool queries must remain unnamed');
    assert.equal(typeof config.text, 'string');
    assert.equal(Array.isArray(config.values), true);
    if (FakePool.mode === 'fail') throw new Error('backend detail containing a secret must never escape');
    if (config.text.includes("'readSnapshot', has_function_privilege")) {
      return { rows: [{ value: FakePool.identity }] };
    }
    if (config.text === 'select publication_guard_api.read_snapshot($1, $2::jsonb) as value') {
      assert.deepEqual(config.values, ['0', '[]']);
      return { rows: [{ value: { revision: '0', records: [] } }] };
    }
    throw new Error('unexpected query');
  }

  async end() {
    this.ended = true;
  }
}

async function hold(work, code) {
  await assert.rejects(work, (error) => error?.code === code);
  pass();
}

function contextHold(environment, code) {
  assert.throws(
    () => assertPublicationGuardReaderPreviewContext(environment),
    (error) => error instanceof PublicationGuardReaderDatabaseError && error.code === code,
  );
  pass();
}

const runtime = assertPublicationGuardReaderPreviewContext(baseEnvironment);
assert.deepEqual(runtime, {
  environment: 'preview',
  projectId: PUBLICATION_GUARD_READER_RUNTIME_SCOPE.approvedProjectId,
  repository: 'usdimpact/usd-impact-site',
  branch: 'publishing/558-calendar-validation',
});
pass();

contextHold({ ...baseEnvironment, VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production' }, 'HOLD_READER_ENVIRONMENT');
contextHold({ ...baseEnvironment, VERCEL_GIT_COMMIT_REF: 'main' }, 'HOLD_READER_BRANCH');
contextHold({ ...baseEnvironment, VERCEL_GIT_REPO_OWNER: 'other' }, 'HOLD_READER_REPOSITORY');
contextHold({ ...baseEnvironment, VERCEL_PROJECT_ID: 'prj_other' }, 'HOLD_READER_PROJECT');
contextHold({ ...baseEnvironment, VERCEL_GIT_PROVIDER: 'gitlab' }, 'HOLD_READER_GIT_PROVIDER');

await hold(
  () => createPublicationGuardReaderDatabase({ environment: { ...baseEnvironment, PUBLICATION_GUARD_READER_DATABASE_URL: '' }, PoolClass: FakePool }),
  'HOLD_DATABASE_URL',
);
await hold(
  () => createPublicationGuardReaderDatabase({
    environment: {
      ...baseEnvironment,
      PUBLICATION_GUARD_READER_DATABASE_URL: readerUrl.replace(`.${ref}`, '.gjzetjugmnwanvjkchux'),
    },
    PoolClass: FakePool,
  }),
  'HOLD_DATABASE_PROJECT',
);
await hold(
  () => createPublicationGuardReaderDatabase({
    environment: {
      ...baseEnvironment,
      PUBLICATION_GUARD_READER_DATABASE_URL: readerUrl.replace('aws-0-eu-central-1.pooler.supabase.com:6543', `db.${ref}.supabase.co:5432`),
    },
    PoolClass: FakePool,
  }),
  'HOLD_DATABASE_POOLER',
);

FakePool.mode = 'ok';
FakePool.identity = goodIdentity;
const database = createPublicationGuardReaderDatabase({ environment: baseEnvironment, PoolClass: FakePool });
const pool = FakePool.instances.at(-1);
assert.equal(pool.config.connectionString, readerUrl);
assert.equal(pool.config.max, 1);
assert.equal(pool.config.connectionTimeoutMillis, 3000);
assert.equal(pool.config.idleTimeoutMillis, 5000);
assert.equal(pool.config.allowExitOnIdle, true);
assert.equal(database.publicationAuthorized, false);
assert.equal(database.enforcementActive, false);
assert.equal(JSON.stringify(database).includes(secret), false);
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
assert.equal(JSON.stringify(identity).includes(secret), false);
pass();

const snapshot = await database.readBaselineSnapshot();
assert.deepEqual(snapshot, { revision: '0', recordCount: 0 });
assert.equal(JSON.stringify(snapshot).includes(secret), false);
assert.equal(pool.calls.every((call) => !Object.hasOwn(call, 'name')), true);
pass();

await database.close();
assert.equal(pool.ended, true);
pass();

FakePool.identity = { ...goodIdentity, authorizeRelease: true };
const privilegeDrift = createPublicationGuardReaderDatabase({ environment: baseEnvironment, PoolClass: FakePool });
await hold(() => privilegeDrift.verifyIdentityAndPrivileges(), 'HOLD_READER_PRIVILEGE');
await privilegeDrift.close();

FakePool.identity = { ...goodIdentity, ssl: false };
const sslDrift = createPublicationGuardReaderDatabase({ environment: baseEnvironment, PoolClass: FakePool });
await hold(() => sslDrift.verifyIdentityAndPrivileges(), 'HOLD_READER_SSL');
await sslDrift.close();

FakePool.identity = { ...goodIdentity, role: 'fx558_controller_login' };
const roleDrift = createPublicationGuardReaderDatabase({ environment: baseEnvironment, PoolClass: FakePool });
await hold(() => roleDrift.verifyIdentityAndPrivileges(), 'HOLD_READER_ROLE');
await roleDrift.close();

FakePool.identity = goodIdentity;
FakePool.mode = 'fail';
const backendFailure = createPublicationGuardReaderDatabase({ environment: baseEnvironment, PoolClass: FakePool });
await hold(() => backendFailure.verifyIdentityAndPrivileges(), 'HOLD_READER_DATABASE_QUERY');
await backendFailure.close();
FakePool.mode = 'ok';

await hold(
  () => Promise.resolve().then(() => createPublicationGuardReaderDatabase({ environment: baseEnvironment, PoolClass: {} })),
  'HOLD_READER_POOL',
);

console.log(`publication guard reader database tests pass (${groups} groups; offline fake pool only)`);
