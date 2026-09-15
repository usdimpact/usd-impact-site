import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const STORE_SCHEMA = 'publication-production-vercel-oauth-store/v1';
const PRODUCTION_GUARD_PROJECT_REF = 'edkdqncrreouzmxqeypm';
const APPROVED_PROJECT_ID = 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7';
const APPROVED_TEAM_ID = 'team_1LuMlacGuM198mRjoID4O3Ct';
const APPROVED_OWNER = 'usdimpact';
const APPROVED_REPOSITORY = 'usd-impact-site';
const APPROVED_BRANCH = 'main';
const STORE_LOGIN = 'fx558_oauth_store_login';
const STORE_SCHEMA_NAME = 'publication_provider_credential';
const STORE_TABLE_NAME = 'vercel_oauth_refresh_state';
const DATABASE_URL_ENV_KEY = 'PUBLICATION_GUARD_VERCEL_OAUTH_STORE_DATABASE_URL';
const CA_ENV_KEY = 'PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_CA_CERT';
const ENCRYPTION_KEY_ENV_KEY = 'PUBLICATION_GUARD_VERCEL_OAUTH_STORE_KEY';
const POOLER = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/;
const SHA = /^[a-f0-9]{40}$/;
const HEX_64 = /^[a-f0-9]{64}$/;
const VERSION = /^(?:0|[1-9][0-9]{0,18})$/;
const MAX_BIGINT = 9223372036854775807n;
const TOKEN_MIN = 20;
const TOKEN_MAX = 8192;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const CIPHER = 'aes-256-gcm';
const BASE_AAD = `publication-production-vercel-oauth-refresh/v1|project=${APPROVED_PROJECT_ID}|team=${APPROVED_TEAM_ID}|store=${STORE_SCHEMA_NAME}.${STORE_TABLE_NAME}`;

const IDENTITY_SQL = `select jsonb_build_object(
  'role', current_user,
  'database', current_database(),
  'schemaUsage', has_schema_privilege(current_user, '${STORE_SCHEMA_NAME}', 'USAGE'),
  'schemaCreate', has_schema_privilege(current_user, '${STORE_SCHEMA_NAME}', 'CREATE'),
  'storeSelect', has_table_privilege(current_user, '${STORE_SCHEMA_NAME}.${STORE_TABLE_NAME}', 'SELECT'),
  'storeUpdate', has_table_privilege(current_user, '${STORE_SCHEMA_NAME}.${STORE_TABLE_NAME}', 'UPDATE'),
  'storeInsert', has_table_privilege(current_user, '${STORE_SCHEMA_NAME}.${STORE_TABLE_NAME}', 'INSERT'),
  'storeDelete', has_table_privilege(current_user, '${STORE_SCHEMA_NAME}.${STORE_TABLE_NAME}', 'DELETE'),
  'storeTruncate', has_table_privilege(current_user, '${STORE_SCHEMA_NAME}.${STORE_TABLE_NAME}', 'TRUNCATE'),
  'vaultSecretsSelect', has_table_privilege(current_user, 'vault.secrets', 'SELECT'),
  'vaultDecryptedSelect', has_table_privilege(current_user, 'vault.decrypted_secrets', 'SELECT'),
  'readCurrentRevision', has_function_privilege(current_user, 'publication_guard_api.read_current_revision()', 'EXECUTE'),
  'readSnapshot', has_function_privilege(current_user, 'publication_guard_api.read_snapshot(text,jsonb)', 'EXECUTE'),
  'authorizeRelease', has_function_privilege(current_user, 'publication_guard_api.authorize_release(uuid,text,text,text,text,timestamptz)', 'EXECUTE'),
  'prepareAdmission', has_function_privilege(current_user, 'publication_guard_api.prepare_admission(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz)', 'EXECUTE'),
  'recordVerifiedReceipt', has_function_privilege(current_user, 'publication_guard_api.record_verified_receipt(uuid,text,text,text)', 'EXECUTE'),
  'revokeRelease', has_function_privilege(current_user, 'publication_guard_api.revoke_release(uuid)', 'EXECUTE'),
  'revokeAdmission', has_function_privilege(current_user, 'publication_guard_api.revoke_admission(uuid,text,text)', 'EXECUTE')
) as value`;

const LOAD_SQL = `select version::text as version,
       key_fingerprint,
       nonce,
       ciphertext,
       auth_tag
from ${STORE_SCHEMA_NAME}.${STORE_TABLE_NAME}
where singleton`;

const REPLACE_SQL = `update ${STORE_SCHEMA_NAME}.${STORE_TABLE_NAME}
set version = version + 1,
    nonce = $2,
    ciphertext = $3,
    auth_tag = $4,
    updated_at = transaction_timestamp()
where singleton
  and version = $1::bigint
  and key_fingerprint = $5
returning version::text as version, key_fingerprint`;

export class PublicationProductionVercelOAuthStoreError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationProductionVercelOAuthStoreError';
    this.code = code;
    this.policyCode = code;
  }
}

const fail = (code) => { throw new PublicationProductionVercelOAuthStoreError(code); };
const need = (condition, code) => { if (!condition) fail(code); };

function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function safeToken(value) {
  return typeof value === 'string'
    && value.length >= TOKEN_MIN
    && value.length <= TOKEN_MAX
    && !/\s/.test(value);
}

function normalizeVersion(value, code = 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_VERSION') {
  const normalized = typeof value === 'bigint'
    ? value.toString()
    : typeof value === 'number' && Number.isSafeInteger(value)
      ? String(value)
      : value;
  need(typeof normalized === 'string' && VERSION.test(normalized), code);
  const parsed = BigInt(normalized);
  need(parsed <= MAX_BIGINT, code);
  return normalized;
}

function nextVersion(value) {
  const current = BigInt(normalizeVersion(value));
  need(current < MAX_BIGINT, 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_VERSION');
  return (current + 1n).toString();
}

function normalizeCaCertificate(value) {
  need(typeof value === 'string', 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CA');
  const normalized = value.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  need(normalized.length >= 256 && normalized.length <= 65536,
    'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CA');
  need(!/PRIVATE KEY/i.test(normalized), 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CA');
  need(normalized.startsWith('-----BEGIN CERTIFICATE-----')
      && normalized.endsWith('-----END CERTIFICATE-----'),
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CA');
  const material = normalized
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');
  need(material.length >= 128 && /^[A-Za-z0-9+/=]+$/.test(material),
    'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CA');
  return normalized;
}

function keyMaterial(value) {
  need(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value),
    'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_KEY');
  const key = Buffer.from(value, 'hex');
  need(key.length === KEY_BYTES, 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_KEY');
  return Object.freeze({
    key,
    fingerprint: createHash('sha256').update(key).digest('hex'),
  });
}

function aad(version, fingerprint) {
  return Buffer.from(`${BASE_AAD}|version=${normalizeVersion(version)}|key=${fingerprint}`, 'utf8');
}

function encryptToken(token, version, material) {
  need(safeToken(token), 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_TOKEN');
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(CIPHER, material.key, nonce, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad(version, material.fingerprint));
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  need(ciphertext.length >= TOKEN_MIN && ciphertext.length <= TOKEN_MAX
    && authTag.length === TAG_BYTES,
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CRYPTO');
  return { nonce, ciphertext, authTag };
}

function decryptToken(row, material) {
  need(plain(row), 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_ROW');
  const version = normalizeVersion(row.version);
  need(typeof row.key_fingerprint === 'string'
    && HEX_64.test(row.key_fingerprint)
    && row.key_fingerprint === material.fingerprint,
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_KEY_BINDING');
  need(Buffer.isBuffer(row.nonce) && row.nonce.length === NONCE_BYTES
    && Buffer.isBuffer(row.ciphertext)
    && row.ciphertext.length >= TOKEN_MIN
    && row.ciphertext.length <= TOKEN_MAX
    && Buffer.isBuffer(row.auth_tag)
    && row.auth_tag.length === TAG_BYTES,
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_ROW');
  let token;
  try {
    const decipher = createDecipheriv(CIPHER, material.key, row.nonce, { authTagLength: TAG_BYTES });
    decipher.setAAD(aad(version, material.fingerprint));
    decipher.setAuthTag(row.auth_tag);
    token = Buffer.concat([decipher.update(row.ciphertext), decipher.final()]).toString('utf8');
  } catch {
    fail('HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CRYPTO');
  }
  need(safeToken(token), 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_TOKEN');
  return { token, version };
}

export function preparePublicationProductionVercelOAuthStoreSeed({ token, encryptionKeyHex } = {}) {
  const material = keyMaterial(encryptionKeyHex);
  const encrypted = encryptToken(token, '0', material);
  return Object.freeze({
    version: '0',
    keyFingerprint: material.fingerprint,
    nonce: Buffer.from(encrypted.nonce),
    ciphertext: Buffer.from(encrypted.ciphertext),
    authTag: Buffer.from(encrypted.authTag),
  });
}

export function validatePublicationProductionVercelOAuthStoreDatabaseUrl(raw) {
  need(typeof raw === 'string' && raw.length >= 32 && raw.length <= 4096,
    'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE_URL');
  let url;
  try { url = new URL(raw); } catch { fail('HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE_URL'); }
  need(['postgres:', 'postgresql:'].includes(url.protocol),
    'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE_PROTOCOL');
  need(POOLER.test(url.hostname) && url.port === '6543',
    'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE_POOLER');
  need(url.pathname === '/postgres', 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE_NAME');
  let username;
  let password;
  try {
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    fail('HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE_CREDENTIAL');
  }
  need(username === `${STORE_LOGIN}.${PRODUCTION_GUARD_PROJECT_REF}`,
    'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE_ROLE');
  need(password.length >= 32 && password.length <= 512,
    'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE_CREDENTIAL');
  const params = [...url.searchParams.entries()];
  need(params.length <= 1
    && params.every(([key, value]) => key === 'sslmode' && value === 'require'),
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE_OPTIONS');
  return Object.freeze({
    role: STORE_LOGIN,
    projectRef: PRODUCTION_GUARD_PROJECT_REF,
    host: url.hostname,
    port: 6543,
    database: 'postgres',
    username,
    sslRequired: true,
  });
}

export function assertPublicationProductionVercelOAuthStoreContext(environment = {}) {
  need(environment && typeof environment === 'object', 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CONTEXT');
  need(environment.VERCEL === '1'
    && environment.VERCEL_ENV === 'production'
    && environment.VERCEL_TARGET_ENV === 'production'
    && environment.VERCEL_PROJECT_ID === APPROVED_PROJECT_ID
    && environment.VERCEL_GIT_PROVIDER === 'github'
    && environment.VERCEL_GIT_REPO_OWNER === APPROVED_OWNER
    && environment.VERCEL_GIT_REPO_SLUG === APPROVED_REPOSITORY
    && environment.VERCEL_GIT_COMMIT_REF === APPROVED_BRANCH
    && SHA.test(environment.VERCEL_GIT_COMMIT_SHA ?? ''),
  'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CONTEXT');
  return Object.freeze({
    environment: 'production',
    projectId: APPROVED_PROJECT_ID,
    teamId: APPROVED_TEAM_ID,
    repository: `${APPROVED_OWNER}/${APPROVED_REPOSITORY}`,
    branch: APPROVED_BRANCH,
    commitSha: environment.VERCEL_GIT_COMMIT_SHA,
  });
}

function poolConfig(rawUrl, ca) {
  let url;
  try { url = new URL(rawUrl); } catch { fail('HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE_URL'); }
  let user;
  let password;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    fail('HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE_CREDENTIAL');
  }
  return {
    host: url.hostname,
    port: Number(url.port),
    database: url.pathname.slice(1),
    user,
    password,
    ssl: { ca, rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 5000,
    allowExitOnIdle: true,
  };
}

function normalizeValue(result, code) {
  need(result && Array.isArray(result.rows) && result.rows.length === 1, code);
  need(Object.hasOwn(result.rows[0], 'value'), code);
  const raw = result.rows[0].value;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { fail(code); }
  }
  need(plain(raw), code);
  return raw;
}

function databaseFailure() {
  fail('HOLD_PRODUCTION_VERCEL_OAUTH_STORE_DATABASE');
}

export function createPublicationProductionVercelOAuthStore({
  environment = process.env,
  PoolClass,
} = {}) {
  const runtime = assertPublicationProductionVercelOAuthStoreContext(environment);
  const rawUrl = environment[DATABASE_URL_ENV_KEY];
  const target = validatePublicationProductionVercelOAuthStoreDatabaseUrl(rawUrl);
  const ca = normalizeCaCertificate(environment[CA_ENV_KEY]);
  const material = keyMaterial(environment[ENCRYPTION_KEY_ENV_KEY]);
  need(typeof PoolClass === 'function', 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_POOL');

  const pool = new PoolClass(poolConfig(rawUrl, ca));
  const safeQuery = async ({ text, values = [] }) => {
    need(typeof text === 'string' && Array.isArray(values),
      'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_QUERY');
    try {
      return await pool.query({ text, values });
    } catch {
      databaseFailure();
    }
  };

  async function verifyIdentityAndPrivileges() {
    const value = normalizeValue(await safeQuery({ text: IDENTITY_SQL, values: [] }),
      'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_IDENTITY');
    need(value.role === STORE_LOGIN && value.database === 'postgres',
      'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_IDENTITY');
    need(value.schemaUsage === true && value.schemaCreate === false,
      'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_PRIVILEGE');
    need(value.storeSelect === true && value.storeUpdate === true,
      'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_PRIVILEGE');
    need(value.storeInsert === false && value.storeDelete === false && value.storeTruncate === false,
      'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_PRIVILEGE');
    need(value.vaultSecretsSelect === false && value.vaultDecryptedSelect === false,
      'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_PRIVILEGE');
    need(value.readCurrentRevision === false && value.readSnapshot === false
      && value.authorizeRelease === false && value.prepareAdmission === false
      && value.recordVerifiedReceipt === false && value.revokeRelease === false
      && value.revokeAdmission === false,
    'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_PUBLICATION_PRIVILEGE');
    return Object.freeze({
      role: STORE_LOGIN,
      database: 'postgres',
      ssl: true,
      storeSelect: true,
      storeUpdate: true,
      insertDeleteCreate: false,
      vaultAccess: false,
      publicationGuardAccess: false,
      projectRef: PRODUCTION_GUARD_PROJECT_REF,
    });
  }

  async function loadRefreshCredential() {
    const result = await safeQuery({ text: LOAD_SQL, values: [] });
    need(result && Array.isArray(result.rows) && result.rows.length === 1,
      'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_ROW');
    const credential = decryptToken(result.rows[0], material);
    return Object.freeze(credential);
  }

  async function replaceRefreshCredential({ expectedVersion, nextToken } = {}) {
    const expected = normalizeVersion(expectedVersion);
    const next = nextVersion(expected);
    need(safeToken(nextToken), 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_TOKEN');
    const encrypted = encryptToken(nextToken, next, material);
    const result = await safeQuery({
      text: REPLACE_SQL,
      values: [expected, encrypted.nonce, encrypted.ciphertext, encrypted.authTag, material.fingerprint],
    });
    need(result && Array.isArray(result.rows), 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CAS');
    need(result.rows.length === 1, 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CAS');
    const storedVersion = normalizeVersion(result.rows[0].version, 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CAS');
    need(storedVersion === next
      && result.rows[0].key_fingerprint === material.fingerprint,
    'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_CAS');
    return Object.freeze({ stored: true, version: storedVersion });
  }

  async function close() {
    try { await pool.end(); } catch { /* best-effort close after fail-closed handling */ }
  }

  return Object.freeze({
    publicationAuthorized: false,
    enforcementActive: false,
    runtime,
    target,
    verifyIdentityAndPrivileges,
    loadRefreshCredential,
    replaceRefreshCredential,
    close,
  });
}

export const PUBLICATION_PRODUCTION_VERCEL_OAUTH_STORE_SCOPE = Object.freeze({
  schema: STORE_SCHEMA,
  projectRef: PRODUCTION_GUARD_PROJECT_REF,
  projectId: APPROVED_PROJECT_ID,
  teamId: APPROVED_TEAM_ID,
  approvedRepository: `${APPROVED_OWNER}/${APPROVED_REPOSITORY}`,
  approvedBranch: APPROVED_BRANCH,
  login: STORE_LOGIN,
  storeSchema: STORE_SCHEMA_NAME,
  storeTable: STORE_TABLE_NAME,
  databaseUrlEnvironmentKey: DATABASE_URL_ENV_KEY,
  caEnvironmentKey: CA_ENV_KEY,
  encryptionKeyEnvironmentKey: ENCRYPTION_KEY_ENV_KEY,
  cipher: CIPHER,
  nonceBytes: NONCE_BYTES,
  authTagBytes: TAG_BYTES,
  keyBytes: KEY_BYTES,
  publicationAuthorized: false,
  enforcementActive: false,
});
