import {
  createPublicationGuardSqlAdapter,
  publicationGuardLoginName,
} from './publication-postgres-adapter.js';
import { classifyPublicationGuardReaderDatabaseFailure } from './publication-guard-reader-database.js';

const PRODUCTION_GUARD_PROJECT_REF = 'edkdqncrreouzmxqeypm';
const BLOCKED_PROJECT_REFS = Object.freeze([
  'xakayexlzyrazuunqlxe',
  'ycstrcvshdluovtuasjc',
  'gjzetjugmnwanvjkchux',
]);
const ENV_KEY = 'PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_URL';
const CA_ENV_KEY = 'PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_CA_CERT';
const APPROVED_PROJECT_ID = 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7';
const APPROVED_OWNER = 'usdimpact';
const APPROVED_REPOSITORY = 'usd-impact-site';
const APPROVED_BRANCH = 'main';
const READER_LOGIN = 'fx558_reader_login';
const POOLER = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/;
const SHA = /^[a-f0-9]{40}$/;
const REVISION = /^(?:0|[1-9][0-9]{0,18})$/;

const IDENTITY_SQL = `select jsonb_build_object(
  'role', current_user,
  'database', current_database(),
  'readCurrentRevision', has_function_privilege(current_user, 'publication_guard_api.read_current_revision()', 'EXECUTE'),
  'readSnapshot', has_function_privilege(current_user, 'publication_guard_api.read_snapshot(text,jsonb)', 'EXECUTE'),
  'authorizeRelease', has_function_privilege(current_user, 'publication_guard_api.authorize_release(uuid,text,text,text,text,timestamptz)', 'EXECUTE'),
  'prepareAdmission', has_function_privilege(current_user, 'publication_guard_api.prepare_admission(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz)', 'EXECUTE'),
  'recordVerifiedReceipt', has_function_privilege(current_user, 'publication_guard_api.record_verified_receipt(uuid,text,text,text)', 'EXECUTE'),
  'revokeRelease', has_function_privilege(current_user, 'publication_guard_api.revoke_release(uuid)', 'EXECUTE'),
  'revokeAdmission', has_function_privilege(current_user, 'publication_guard_api.revoke_admission(uuid,text,text)', 'EXECUTE')
) as value`;

export class PublicationGuardProductionReaderDatabaseError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationGuardProductionReaderDatabaseError';
    this.code = code;
  }
}

const fail = (code) => { throw new PublicationGuardProductionReaderDatabaseError(code); };
const need = (condition, code) => { if (!condition) fail(code); };

function normalizeCaCertificate(value) {
  need(typeof value === 'string', 'HOLD_PRODUCTION_READER_DATABASE_CA');
  const normalized = value.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  need(normalized.length >= 256 && normalized.length <= 65536, 'HOLD_PRODUCTION_READER_DATABASE_CA');
  need(!/PRIVATE KEY/i.test(normalized), 'HOLD_PRODUCTION_READER_DATABASE_CA');
  need(
    normalized.startsWith('-----BEGIN CERTIFICATE-----')
      && normalized.endsWith('-----END CERTIFICATE-----'),
    'HOLD_PRODUCTION_READER_DATABASE_CA',
  );
  const material = normalized
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');
  need(material.length >= 128 && /^[A-Za-z0-9+/=]+$/.test(material), 'HOLD_PRODUCTION_READER_DATABASE_CA');
  return normalized;
}

export function validatePublicationGuardProductionDatabaseUrl(raw) {
  need(typeof raw === 'string' && raw.length >= 32 && raw.length <= 4096, 'HOLD_PRODUCTION_DATABASE_URL');
  need(BLOCKED_PROJECT_REFS.every((ref) => !raw.includes(ref)), 'HOLD_PRODUCTION_DATABASE_PROJECT');
  let url;
  try { url = new URL(raw); } catch { fail('HOLD_PRODUCTION_DATABASE_URL'); }
  need(['postgres:', 'postgresql:'].includes(url.protocol), 'HOLD_PRODUCTION_DATABASE_PROTOCOL');
  need(POOLER.test(url.hostname) && url.port === '6543', 'HOLD_PRODUCTION_DATABASE_POOLER');
  need(url.pathname === '/postgres', 'HOLD_PRODUCTION_DATABASE_NAME');
  let username;
  let password;
  try {
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    fail('HOLD_PRODUCTION_DATABASE_CREDENTIAL');
  }
  need(username === `${READER_LOGIN}.${PRODUCTION_GUARD_PROJECT_REF}`, 'HOLD_PRODUCTION_DATABASE_ROLE');
  need(password.length >= 32 && password.length <= 512, 'HOLD_PRODUCTION_DATABASE_CREDENTIAL');
  const params = [...url.searchParams.entries()];
  need(params.length <= 1 && params.every(([key, value]) => key === 'sslmode' && value === 'require'), 'HOLD_PRODUCTION_DATABASE_OPTIONS');
  return Object.freeze({
    role: 'reader',
    projectRef: PRODUCTION_GUARD_PROJECT_REF,
    host: url.hostname,
    port: 6543,
    database: 'postgres',
    username,
    sslRequired: true,
  });
}

export function assertPublicationGuardProductionReaderContext(environment = {}) {
  need(environment.VERCEL === '1', 'HOLD_PRODUCTION_READER_CONTEXT');
  need(environment.VERCEL_ENV === 'production' && environment.VERCEL_TARGET_ENV === 'production', 'HOLD_PRODUCTION_READER_ENVIRONMENT');
  need(environment.VERCEL_PROJECT_ID === APPROVED_PROJECT_ID, 'HOLD_PRODUCTION_READER_PROJECT');
  need(environment.VERCEL_GIT_PROVIDER === 'github', 'HOLD_PRODUCTION_READER_GIT_PROVIDER');
  need(environment.VERCEL_GIT_REPO_OWNER === APPROVED_OWNER, 'HOLD_PRODUCTION_READER_REPOSITORY');
  need(environment.VERCEL_GIT_REPO_SLUG === APPROVED_REPOSITORY, 'HOLD_PRODUCTION_READER_REPOSITORY');
  need(environment.VERCEL_GIT_COMMIT_REF === APPROVED_BRANCH, 'HOLD_PRODUCTION_READER_BRANCH');
  need(SHA.test(environment.VERCEL_GIT_COMMIT_SHA ?? ''), 'HOLD_PRODUCTION_READER_COMMIT');
  return Object.freeze({
    environment: 'production',
    projectId: APPROVED_PROJECT_ID,
    repository: `${APPROVED_OWNER}/${APPROVED_REPOSITORY}`,
    branch: APPROVED_BRANCH,
    commitSha: environment.VERCEL_GIT_COMMIT_SHA,
  });
}

function poolConfig(rawUrl, ca) {
  let url;
  try { url = new URL(rawUrl); } catch { fail('HOLD_PRODUCTION_DATABASE_URL'); }
  let user;
  let password;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    fail('HOLD_PRODUCTION_DATABASE_CREDENTIAL');
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
  need(raw && typeof raw === 'object' && !Array.isArray(raw), code);
  return raw;
}

function normalizeRevision(result) {
  need(result && Array.isArray(result.rows) && result.rows.length === 1, 'HOLD_PRODUCTION_READER_REVISION');
  need(Object.hasOwn(result.rows[0], 'value'), 'HOLD_PRODUCTION_READER_REVISION');
  const raw = result.rows[0].value;
  const value = typeof raw === 'bigint' ? raw.toString() : typeof raw === 'number' ? String(raw) : raw;
  need(typeof value === 'string' && REVISION.test(value), 'HOLD_PRODUCTION_READER_REVISION');
  return value;
}

export function createPublicationGuardProductionReaderDatabase({ environment = process.env, PoolClass } = {}) {
  const runtime = assertPublicationGuardProductionReaderContext(environment);
  const rawUrl = environment[ENV_KEY];
  const target = validatePublicationGuardProductionDatabaseUrl(rawUrl);
  const ca = normalizeCaCertificate(environment[CA_ENV_KEY]);
  need(typeof PoolClass === 'function', 'HOLD_PRODUCTION_READER_POOL');

  const pool = new PoolClass(poolConfig(rawUrl, ca));
  const safeQuery = async ({ text, values = [] }) => {
    need(typeof text === 'string' && Array.isArray(values), 'HOLD_PRODUCTION_READER_QUERY');
    try {
      return await pool.query({ text, values });
    } catch (error) {
      fail(classifyPublicationGuardReaderDatabaseFailure(error));
    }
  };
  const reader = createPublicationGuardSqlAdapter({ role: 'reader', query: safeQuery });

  async function verifyIdentityAndPrivileges() {
    const value = normalizeValue(await safeQuery({ text: IDENTITY_SQL, values: [] }), 'HOLD_PRODUCTION_READER_IDENTITY');
    need(value.role === READER_LOGIN && value.database === 'postgres', 'HOLD_PRODUCTION_READER_IDENTITY');
    need(value.readCurrentRevision === true, 'HOLD_PRODUCTION_READER_PRIVILEGE');
    need(value.readSnapshot === true, 'HOLD_PRODUCTION_READER_PRIVILEGE');
    need(value.authorizeRelease === false, 'HOLD_PRODUCTION_READER_PRIVILEGE');
    need(value.prepareAdmission === false, 'HOLD_PRODUCTION_READER_PRIVILEGE');
    need(value.recordVerifiedReceipt === false, 'HOLD_PRODUCTION_READER_PRIVILEGE');
    need(value.revokeRelease === false, 'HOLD_PRODUCTION_READER_PRIVILEGE');
    need(value.revokeAdmission === false, 'HOLD_PRODUCTION_READER_PRIVILEGE');
    return Object.freeze({
      role: READER_LOGIN,
      database: 'postgres',
      ssl: true,
      readCurrentRevision: true,
      readSnapshot: true,
      writePrivileges: false,
      projectRef: PRODUCTION_GUARD_PROJECT_REF,
    });
  }

  async function readCurrentRevision() {
    return normalizeRevision(await safeQuery({
      text: 'select publication_guard_api.read_current_revision() as value',
      values: [],
    }));
  }

  async function readSnapshot({ revision, entries } = {}) {
    const snapshot = await reader.readSnapshot({ revision, entries });
    need(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot), 'HOLD_PRODUCTION_READER_SNAPSHOT');
    need(typeof snapshot.revision === 'string' && Array.isArray(snapshot.records), 'HOLD_PRODUCTION_READER_SNAPSHOT');
    return snapshot;
  }

  async function close() {
    try { await pool.end(); } catch { /* best-effort close after fail-closed request handling */ }
  }

  return Object.freeze({
    publicationAuthorized: false,
    enforcementActive: false,
    runtime,
    target,
    verifyIdentityAndPrivileges,
    readCurrentRevision,
    readSnapshot,
    close,
  });
}

export const PUBLICATION_GUARD_PRODUCTION_READER_SCOPE = Object.freeze({
  projectRef: PRODUCTION_GUARD_PROJECT_REF,
  blockedProjectRefs: BLOCKED_PROJECT_REFS,
  environmentKey: ENV_KEY,
  caEnvironmentKey: CA_ENV_KEY,
  approvedProjectId: APPROVED_PROJECT_ID,
  approvedRepository: `${APPROVED_OWNER}/${APPROVED_REPOSITORY}`,
  approvedBranch: APPROVED_BRANCH,
  readerLogin: READER_LOGIN,
  publicationAuthorized: false,
  enforcementActive: false,
});
