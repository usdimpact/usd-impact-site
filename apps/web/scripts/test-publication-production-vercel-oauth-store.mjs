import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import {
  PublicationProductionVercelOAuthStoreError,
  PUBLICATION_PRODUCTION_VERCEL_OAUTH_STORE_SCOPE,
  assertPublicationProductionVercelOAuthStoreContext,
  createPublicationProductionVercelOAuthStore,
  preparePublicationProductionVercelOAuthStoreSeed,
  validatePublicationProductionVercelOAuthStoreDatabaseUrl,
} from '../src/lib/publication-production-vercel-oauth-store.js';

let passed = 0;
const pass = () => { passed += 1; };

const projectRef = 'edkdqncrreouzmxqeypm';
const projectId = 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7';
const teamId = 'team_1LuMlacGuM198mRjoID4O3Ct';
const login = 'fx558_oauth_store_login';
const password = 'store_password_abcdefghijklmnopqrstuvwxyz0123456789';
const keyHex = '11'.repeat(32);
const key = Buffer.from(keyHex, 'hex');
const fingerprint = createHash('sha256').update(key).digest('hex');
const baseAad = `publication-production-vercel-oauth-refresh/v1|project=${projectId}|team=${teamId}|store=publication_provider_credential.vercel_oauth_refresh_state`;
const ca = `-----BEGIN CERTIFICATE-----\n${'A'.repeat(256)}\n-----END CERTIFICATE-----`;
const databaseUrl = `postgresql://${login}.${projectRef}:${password}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`;
const commitSha = 'a'.repeat(40);
const environment = Object.freeze({
  VERCEL: '1',
  VERCEL_ENV: 'production',
  VERCEL_TARGET_ENV: 'production',
  VERCEL_PROJECT_ID: projectId,
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'usdimpact',
  VERCEL_GIT_REPO_SLUG: 'usd-impact-site',
  VERCEL_GIT_COMMIT_REF: 'main',
  VERCEL_GIT_COMMIT_SHA: commitSha,
  PUBLICATION_GUARD_VERCEL_OAUTH_STORE_DATABASE_URL: databaseUrl,
  PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_CA_CERT: ca,
  PUBLICATION_GUARD_VERCEL_OAUTH_STORE_KEY: keyHex,
});

function aad(version) {
  return Buffer.from(`${baseAad}|version=${version}|key=${fingerprint}`, 'utf8');
}

function encryptFixture(token, version = '0') {
  const nonce = Buffer.alloc(12, Number(version) + 1);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
  cipher.setAAD(aad(version));
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    version,
    key_fingerprint: fingerprint,
    nonce,
    ciphertext,
    auth_tag: cipher.getAuthTag(),
  };
}

function decryptCaptured({ version, nonce, ciphertext, authTag }) {
  const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
  decipher.setAAD(aad(version));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function makePoolClass(handler, capture = {}) {
  return class FakePool {
    constructor(config) { capture.config = config; }
    async query(query) { return handler(query); }
    async end() { capture.closed = true; }
  };
}

async function hold(work, code) {
  await assert.rejects(work, (error) => error instanceof PublicationProductionVercelOAuthStoreError
    && error.code === code && error.policyCode === code);
  pass();
}

assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_STORE_SCOPE.schema, 'publication-production-vercel-oauth-store/v1');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_STORE_SCOPE.projectRef, projectRef);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_STORE_SCOPE.projectId, projectId);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_STORE_SCOPE.teamId, teamId);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_STORE_SCOPE.login, login);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_STORE_SCOPE.cipher, 'aes-256-gcm');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_STORE_SCOPE.publicationAuthorized, false);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_STORE_SCOPE.enforcementActive, false);
pass();

const initialToken = 'refresh_initial_abcdefghijklmnopqrstuvwxyz0123456789';
const nextToken = 'refresh_rotated_abcdefghijklmnopqrstuvwxyz0123456789';

const seed = preparePublicationProductionVercelOAuthStoreSeed({ token: initialToken, encryptionKeyHex: keyHex });
assert.equal(seed.version, '0');
assert.equal(seed.keyFingerprint, fingerprint);
assert.equal(decryptCaptured({ version: '0', nonce: seed.nonce, ciphertext: seed.ciphertext, authTag: seed.authTag }), initialToken);
pass();

const target = validatePublicationProductionVercelOAuthStoreDatabaseUrl(databaseUrl);
assert.deepEqual(target, {
  role: login,
  projectRef,
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  username: `${login}.${projectRef}`,
  sslRequired: true,
});
pass();

const context = assertPublicationProductionVercelOAuthStoreContext(environment);
assert.equal(context.environment, 'production');
assert.equal(context.projectId, projectId);
assert.equal(context.teamId, teamId);
assert.equal(context.repository, 'usdimpact/usd-impact-site');
assert.equal(context.branch, 'main');
assert.equal(context.commitSha, commitSha);
pass();

const initialRow = encryptFixture(initialToken, '0');
const identity = {
  role: login,
  database: 'postgres',
  schemaUsage: true,
  schemaCreate: false,
  storeSelect: true,
  storeUpdate: true,
  storeInsert: false,
  storeDelete: false,
  storeTruncate: false,
  vaultSecretsSelect: false,
  vaultDecryptedSelect: false,
  readCurrentRevision: false,
  readSnapshot: false,
  authorizeRelease: false,
  prepareAdmission: false,
  recordVerifiedReceipt: false,
  revokeRelease: false,
  revokeAdmission: false,
};
const capture = {};
const PoolClass = makePoolClass(async ({ text, values }) => {
  if (text.startsWith('select jsonb_build_object')) return { rows: [{ value: identity }] };
  if (text.startsWith('select version::text')) return { rows: [initialRow] };
  if (text.startsWith('update publication_provider_credential.vercel_oauth_refresh_state')) {
    capture.replaceValues = values;
    return { rows: [{ version: '1', key_fingerprint: fingerprint }] };
  }
  throw new Error('unexpected query');
}, capture);

const store = createPublicationProductionVercelOAuthStore({ environment, PoolClass });
assert.equal(store.publicationAuthorized, false);
assert.equal(store.enforcementActive, false);
assert.equal(capture.config.host, 'aws-0-eu-central-1.pooler.supabase.com');
assert.equal(capture.config.port, 6543);
assert.equal(capture.config.user, `${login}.${projectRef}`);
assert.equal(capture.config.password, password);
assert.equal(capture.config.ssl.rejectUnauthorized, true);
assert.equal(capture.config.ssl.ca, ca);
assert.equal(capture.config.max, 1);
pass();

const verified = await store.verifyIdentityAndPrivileges();
assert.deepEqual(verified, {
  role: login,
  database: 'postgres',
  ssl: true,
  storeSelect: true,
  storeUpdate: true,
  insertDeleteCreate: false,
  vaultAccess: false,
  publicationGuardAccess: false,
  projectRef,
});
pass();

const loaded = await store.loadRefreshCredential();
assert.deepEqual(loaded, { token: initialToken, version: '0' });
pass();

const replaced = await store.replaceRefreshCredential({ expectedVersion: loaded.version, nextToken });
assert.deepEqual(replaced, { stored: true, version: '1' });
assert.equal(capture.replaceValues[0], '0');
assert.equal(capture.replaceValues[4], fingerprint);
assert.ok(Buffer.isBuffer(capture.replaceValues[1]) && capture.replaceValues[1].length === 12);
assert.ok(Buffer.isBuffer(capture.replaceValues[2]));
assert.ok(Buffer.isBuffer(capture.replaceValues[3]) && capture.replaceValues[3].length === 16);
assert.equal(decryptCaptured({
  version: '1',
  nonce: capture.replaceValues[1],
  ciphertext: capture.replaceValues[2],
  authTag: capture.replaceValues[3],
}), nextToken);
pass();

await store.close();
assert.equal(capture.closed, true);
pass();

for (const patch of [
  { VERCEL: '0' },
  { VERCEL_ENV: 'preview' },
  { VERCEL_TARGET_ENV: 'preview' },
  { VERCEL_PROJECT_ID: 'prj_other' },
  { VERCEL_GIT_PROVIDER: 'gitlab' },
  { VERCEL_GIT_REPO_OWNER: 'other' },
  { VERCEL_GIT_REPO_SLUG: 'other' },
  { VERCEL_GIT_COMMIT_REF: 'develop' },
  { VERCEL_GIT_COMMIT_SHA: 'bad' },
]) {
  await hold(async () => assertPublicationProductionVercelOAuthStoreContext({ ...environment, ...patch }),
    'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CONTEXT');
}

for (const badUrl of [
  `http://${login}.${projectRef}:${password}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
  `postgresql://${login}.${projectRef}:${password}@db.${projectRef}.supabase.co:6543/postgres`,
  `postgresql://${login}.${projectRef}:${password}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
  `postgresql://${login}.${projectRef}:${password}@aws-0-eu-central-1.pooler.supabase.com:6543/other`,
  `postgresql://postgres.${projectRef}:${password}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
  `postgresql://${login}.${projectRef}:short@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
  `postgresql://${login}.${projectRef}:${password}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?application_name=x`,
]) {
  await assert.rejects(async () => validatePublicationProductionVercelOAuthStoreDatabaseUrl(badUrl),
    PublicationProductionVercelOAuthStoreError);
  pass();
}

for (const badKey of ['', '00', 'G'.repeat(64), '11'.repeat(31)]) {
  await hold(async () => createPublicationProductionVercelOAuthStore({
    environment: { ...environment, PUBLICATION_GUARD_VERCEL_OAUTH_STORE_KEY: badKey },
    PoolClass,
  }), 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_KEY');
}

for (const badCa of ['', '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----']) {
  await hold(async () => createPublicationProductionVercelOAuthStore({
    environment: { ...environment, PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_CA_CERT: badCa },
    PoolClass,
  }), 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CA');
}

await hold(async () => createPublicationProductionVercelOAuthStore({ environment }),
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_POOL');

for (const privilegePatch of [
  { schemaCreate: true },
  { storeSelect: false },
  { storeUpdate: false },
  { storeInsert: true },
  { storeDelete: true },
  { storeTruncate: true },
  { vaultSecretsSelect: true },
  { vaultDecryptedSelect: true },
]) {
  const Candidate = makePoolClass(async ({ text }) => {
    if (text.startsWith('select jsonb_build_object')) return { rows: [{ value: { ...identity, ...privilegePatch } }] };
    throw new Error('unexpected');
  });
  const instance = createPublicationProductionVercelOAuthStore({ environment, PoolClass: Candidate });
  await hold(() => instance.verifyIdentityAndPrivileges(), 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_PRIVILEGE');
}

for (const publicationPatch of [
  { readCurrentRevision: true },
  { readSnapshot: true },
  { authorizeRelease: true },
  { prepareAdmission: true },
  { recordVerifiedReceipt: true },
  { revokeRelease: true },
  { revokeAdmission: true },
]) {
  const Candidate = makePoolClass(async ({ text }) => {
    if (text.startsWith('select jsonb_build_object')) return { rows: [{ value: { ...identity, ...publicationPatch } }] };
    throw new Error('unexpected');
  });
  const instance = createPublicationProductionVercelOAuthStore({ environment, PoolClass: Candidate });
  await hold(() => instance.verifyIdentityAndPrivileges(), 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_PUBLICATION_PRIVILEGE');
}

const wrongIdentityPool = makePoolClass(async ({ text }) => {
  if (text.startsWith('select jsonb_build_object')) return { rows: [{ value: { ...identity, role: 'postgres' } }] };
  throw new Error('unexpected');
});
await hold(() => createPublicationProductionVercelOAuthStore({ environment, PoolClass: wrongIdentityPool }).verifyIdentityAndPrivileges(),
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_IDENTITY');

const wrongFingerprintPool = makePoolClass(async ({ text }) => {
  if (text.startsWith('select version::text')) return { rows: [{ ...initialRow, key_fingerprint: 'b'.repeat(64) }] };
  throw new Error('unexpected');
});
await hold(() => createPublicationProductionVercelOAuthStore({ environment, PoolClass: wrongFingerprintPool }).loadRefreshCredential(),
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_KEY_BINDING');

const tamperedTag = Buffer.from(initialRow.auth_tag);
tamperedTag[0] ^= 0xff;
const tamperedPool = makePoolClass(async ({ text }) => {
  if (text.startsWith('select version::text')) return { rows: [{ ...initialRow, auth_tag: tamperedTag }] };
  throw new Error('unexpected');
});
await hold(() => createPublicationProductionVercelOAuthStore({ environment, PoolClass: tamperedPool }).loadRefreshCredential(),
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CRYPTO');

const stalePool = makePoolClass(async ({ text }) => {
  if (text.startsWith('update publication_provider_credential.vercel_oauth_refresh_state')) return { rows: [] };
  throw new Error('unexpected');
});
await hold(() => createPublicationProductionVercelOAuthStore({ environment, PoolClass: stalePool })
  .replaceRefreshCredential({ expectedVersion: '0', nextToken }),
'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CAS');

await hold(() => store.replaceRefreshCredential({ expectedVersion: '9223372036854775807', nextToken }),
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_VERSION');
await hold(() => store.replaceRefreshCredential({ expectedVersion: 'not-a-version', nextToken }),
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_VERSION');
await hold(() => store.replaceRefreshCredential({ expectedVersion: '0', nextToken: 'short' }),
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_TOKEN');

const secretBearingError = `do not leak ${initialToken} ${nextToken}`;
const failingPool = makePoolClass(async () => { throw new Error(secretBearingError); });
const failing = createPublicationProductionVercelOAuthStore({ environment, PoolClass: failingPool });
await hold(() => failing.loadRefreshCredential(), 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE');

const sql = fs.readFileSync(path.resolve('docs/sql/publication-production-vercel-oauth-store-558.sql'), 'utf8');
assert.match(sql, /create role fx558_oauth_store\s+[\s\S]*nologin[\s\S]*nobypassrls;/i);
assert.match(sql, /create role fx558_oauth_store_login\s+[\s\S]*login[\s\S]*password null;/i);
assert.match(sql, /enable row level security;/i);
assert.match(sql, /force row level security;/i);
assert.match(sql, /grant select \([\s\S]*\) on publication_provider_credential\.vercel_oauth_refresh_state to fx558_oauth_store;/i);
assert.match(sql, /grant update \([\s\S]*\) on publication_provider_credential\.vercel_oauth_refresh_state to fx558_oauth_store;/i);
assert.doesNotMatch(sql, /grant\s+(?:insert|delete|truncate|create)\b/i);
assert.doesNotMatch(sql, /security\s+definer/i);
assert.doesNotMatch(sql, /vault\.(?:create_secret|update_secret)\s*\(/i);
assert.match(sql, /revoke all on table vault\.decrypted_secrets from fx558_oauth_store, fx558_oauth_store_login;/i);
assert.match(sql, /revoke execute on function publication_guard_api\.authorize_release/i);
assert.match(sql, /The migration intentionally creates no row and no password\./i);
pass();

console.log(`publication production Vercel OAuth store regression pass (${passed} groups)`);
