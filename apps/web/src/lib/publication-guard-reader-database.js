import {
  PUBLICATION_GUARD_DATABASE_SCOPE,
  createPublicationGuardSqlAdapter,
  validatePublicationGuardDatabaseUrl,
} from './publication-postgres-adapter.js';

const ENV_KEY = 'PUBLICATION_GUARD_READER_DATABASE_URL';
const APPROVED_BRANCH = 'publishing/558-calendar-validation';
const APPROVED_OWNER = 'usdimpact';
const APPROVED_REPOSITORY = 'usd-impact-site';
const APPROVED_PROJECT_ID = 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7';
const READER_LOGIN = 'fx558_reader_login';

const QUERY_FAILURE = Object.freeze({
  dns: 'HOLD_READER_DATABASE_DNS',
  connectTimeout: 'HOLD_READER_DATABASE_CONNECT_TIMEOUT',
  connect: 'HOLD_READER_DATABASE_CONNECT',
  tls: 'HOLD_READER_DATABASE_TLS',
  auth28P01: 'HOLD_READER_DATABASE_AUTH_28P01',
  auth: 'HOLD_READER_DATABASE_AUTH',
  poolerAuthQuery: 'HOLD_READER_DATABASE_POOLER_AUTH_QUERY',
  poolerTenant: 'HOLD_READER_DATABASE_POOLER_TENANT',
  queryPermission: 'HOLD_READER_DATABASE_QUERY_PERMISSION',
  other: 'HOLD_READER_DATABASE_QUERY_OTHER',
});

const IDENTITY_SQL = `select jsonb_build_object(
  'role', current_user,
  'database', current_database(),
  'ssl', coalesce((select ssl from pg_stat_ssl where pid = pg_backend_pid()), false),
  'readSnapshot', has_function_privilege(current_user, 'publication_guard_api.read_snapshot(text,jsonb)', 'EXECUTE'),
  'authorizeRelease', has_function_privilege(current_user, 'publication_guard_api.authorize_release(uuid,text,text,text,text,timestamptz)', 'EXECUTE'),
  'prepareAdmission', has_function_privilege(current_user, 'publication_guard_api.prepare_admission(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz)', 'EXECUTE'),
  'recordVerifiedReceipt', has_function_privilege(current_user, 'publication_guard_api.record_verified_receipt(uuid,text,text,text)', 'EXECUTE'),
  'revokeRelease', has_function_privilege(current_user, 'publication_guard_api.revoke_release(uuid)', 'EXECUTE'),
  'revokeAdmission', has_function_privilege(current_user, 'publication_guard_api.revoke_admission(uuid,text,text)', 'EXECUTE')
) as value`;

export class PublicationGuardReaderDatabaseError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationGuardReaderDatabaseError';
    this.code = code;
  }
}

const fail = (code) => { throw new PublicationGuardReaderDatabaseError(code); };
const need = (condition, code) => { if (!condition) fail(code); };
const token = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

export function classifyPublicationGuardReaderDatabaseFailure(error) {
  const code = token(error?.code);
  const errno = token(error?.errno);
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  const tags = new Set([code, errno]);

  if (tags.has('ENOTFOUND') || tags.has('EAI_AGAIN')) return QUERY_FAILURE.dns;
  if (
    tags.has('ETIMEDOUT')
    || tags.has('ERR_SOCKET_CONNECTION_TIMEOUT')
    || /(?:connection|connect).*timeout|timeout expired/.test(message)
  ) return QUERY_FAILURE.connectTimeout;
  if (
    tags.has('ERR_TLS_CERT_ALTNAME_INVALID')
    || tags.has('DEPTH_ZERO_SELF_SIGNED_CERT')
    || tags.has('UNABLE_TO_VERIFY_LEAF_SIGNATURE')
    || tags.has('CERT_HAS_EXPIRED')
    || /tls handshake|self[- ]signed certificate|certificate.*(?:invalid|expired)|ssl.*(?:error|certificate)/.test(message)
  ) return QUERY_FAILURE.tls;
  if (/eauthquery/.test(message)) return QUERY_FAILURE.poolerAuthQuery;
  if (/(?:tenant|user).*(?:not found|unsupported)|(?:not found).*(?:tenant|user)/.test(message)) {
    return QUERY_FAILURE.poolerTenant;
  }
  if (code === '28P01') return QUERY_FAILURE.auth28P01;
  if (code === '28000') return QUERY_FAILURE.auth;
  if (code === '42501') return QUERY_FAILURE.queryPermission;
  if (
    tags.has('ECONNREFUSED')
    || tags.has('ECONNRESET')
    || tags.has('ECONNABORTED')
    || tags.has('EHOSTUNREACH')
    || tags.has('ENETUNREACH')
    || tags.has('EPIPE')
  ) return QUERY_FAILURE.connect;
  return QUERY_FAILURE.other;
}

export function assertPublicationGuardReaderPreviewContext(environment = {}) {
  need(environment.VERCEL === '1', 'HOLD_READER_CONTEXT');
  need(environment.VERCEL_ENV === 'preview' && environment.VERCEL_TARGET_ENV === 'preview', 'HOLD_READER_ENVIRONMENT');
  need(environment.VERCEL_PROJECT_ID === APPROVED_PROJECT_ID, 'HOLD_READER_PROJECT');
  need(environment.VERCEL_GIT_PROVIDER === 'github', 'HOLD_READER_GIT_PROVIDER');
  need(environment.VERCEL_GIT_REPO_OWNER === APPROVED_OWNER, 'HOLD_READER_REPOSITORY');
  need(environment.VERCEL_GIT_REPO_SLUG === APPROVED_REPOSITORY, 'HOLD_READER_REPOSITORY');
  need(environment.VERCEL_GIT_COMMIT_REF === APPROVED_BRANCH, 'HOLD_READER_BRANCH');
  return Object.freeze({
    environment: 'preview',
    projectId: APPROVED_PROJECT_ID,
    repository: `${APPROVED_OWNER}/${APPROVED_REPOSITORY}`,
    branch: APPROVED_BRANCH,
  });
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

export function createPublicationGuardReaderDatabase({ environment = process.env, PoolClass } = {}) {
  const runtime = assertPublicationGuardReaderPreviewContext(environment);
  const rawUrl = environment[ENV_KEY];
  const target = validatePublicationGuardDatabaseUrl(rawUrl, { role: 'reader' });
  need(typeof PoolClass === 'function', 'HOLD_READER_POOL');

  const pool = new PoolClass({
    connectionString: rawUrl,
    max: 1,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 5000,
    allowExitOnIdle: true,
  });

  const safeQuery = async ({ text, values = [] }) => {
    need(typeof text === 'string' && Array.isArray(values), 'HOLD_READER_QUERY');
    try {
      return await pool.query({ text, values });
    } catch (error) {
      fail(classifyPublicationGuardReaderDatabaseFailure(error));
    }
  };

  const reader = createPublicationGuardSqlAdapter({ role: 'reader', query: safeQuery });

  async function verifyIdentityAndPrivileges() {
    const value = normalizeValue(await safeQuery({ text: IDENTITY_SQL, values: [] }), 'HOLD_READER_IDENTITY');
    need(value.role === READER_LOGIN, 'HOLD_READER_ROLE');
    need(value.database === 'postgres', 'HOLD_READER_DATABASE');
    need(value.ssl === true, 'HOLD_READER_SSL');
    need(value.readSnapshot === true, 'HOLD_READER_PRIVILEGE');
    need(value.authorizeRelease === false, 'HOLD_READER_PRIVILEGE');
    need(value.prepareAdmission === false, 'HOLD_READER_PRIVILEGE');
    need(value.recordVerifiedReceipt === false, 'HOLD_READER_PRIVILEGE');
    need(value.revokeRelease === false, 'HOLD_READER_PRIVILEGE');
    need(value.revokeAdmission === false, 'HOLD_READER_PRIVILEGE');
    return Object.freeze({
      role: READER_LOGIN,
      database: 'postgres',
      ssl: true,
      readSnapshot: true,
      writePrivileges: false,
      projectRef: PUBLICATION_GUARD_DATABASE_SCOPE.projectRef,
    });
  }

  async function readBaselineSnapshot() {
    const snapshot = await reader.readSnapshot({ revision: '0', entries: [] });
    need(snapshot && typeof snapshot === 'object', 'HOLD_READER_SNAPSHOT');
    need(snapshot.revision === '0' && Array.isArray(snapshot.records) && snapshot.records.length === 0, 'HOLD_READER_SNAPSHOT');
    return Object.freeze({ revision: '0', recordCount: 0 });
  }

  async function close() {
    try { await pool.end(); } catch { /* close is best-effort after fail-closed request handling */ }
  }

  return Object.freeze({
    publicationAuthorized: false,
    enforcementActive: false,
    runtime,
    target,
    reader,
    verifyIdentityAndPrivileges,
    readBaselineSnapshot,
    close,
  });
}

export async function runPublicationGuardReaderReadiness({ environment = process.env, PoolClass } = {}) {
  const database = createPublicationGuardReaderDatabase({ environment, PoolClass });
  try {
    const identity = await database.verifyIdentityAndPrivileges();
    const snapshot = await database.readBaselineSnapshot();
    return Object.freeze({
      decision: 'PASS_READER_READINESS',
      runtime: database.runtime,
      identity,
      snapshot,
      publicationAuthorized: false,
      enforcementActive: false,
    });
  } finally {
    await database.close();
  }
}

export const PUBLICATION_GUARD_READER_RUNTIME_SCOPE = Object.freeze({
  environmentKey: ENV_KEY,
  approvedBranch: APPROVED_BRANCH,
  approvedProjectId: APPROVED_PROJECT_ID,
  approvedRepository: `${APPROVED_OWNER}/${APPROVED_REPOSITORY}`,
  readerLogin: READER_LOGIN,
  projectRef: PUBLICATION_GUARD_DATABASE_SCOPE.projectRef,
});
