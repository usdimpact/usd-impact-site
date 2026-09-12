const PROJECT_REF = 'xakayexlzyrazuunqlxe';
const SHARED_DEVELOPMENT_REF = 'ycstrcvshdluovtuasjc';
const PRODUCTION_REF = 'gjzetjugmnwanvjkchux';
const ROLE_NAMES = Object.freeze({
  reader: 'fx558_reader_login',
  controller: 'fx558_controller_login',
  recorder: 'fx558_recorder_login',
  revoker: 'fx558_revoker_login',
});
const POOLER = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/;
const HEX = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PATH = /^\/news\/(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;

export class PublicationGuardDatabaseConfigurationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationGuardDatabaseConfigurationError';
    this.code = code;
  }
}

const fail = (code) => { throw new PublicationGuardDatabaseConfigurationError(code); };
const need = (value, code) => { if (!value) fail(code); };

export function publicationGuardLoginName(role) {
  need(Object.hasOwn(ROLE_NAMES, role), 'HOLD_DATABASE_ROLE');
  return ROLE_NAMES[role];
}

export function validatePublicationGuardDatabaseUrl(raw, { role, projectRef = PROJECT_REF } = {}) {
  need(typeof raw === 'string' && raw.length >= 32 && raw.length <= 4096, 'HOLD_DATABASE_URL');
  need(projectRef === PROJECT_REF, 'HOLD_DATABASE_PROJECT');
  need(!raw.includes(SHARED_DEVELOPMENT_REF) && !raw.includes(PRODUCTION_REF), 'HOLD_DATABASE_PROJECT');
  let url;
  try { url = new URL(raw); } catch { fail('HOLD_DATABASE_URL'); }
  need(['postgres:', 'postgresql:'].includes(url.protocol), 'HOLD_DATABASE_PROTOCOL');
  need(POOLER.test(url.hostname), 'HOLD_DATABASE_POOLER');
  need(url.port === '6543', 'HOLD_DATABASE_POOLER');
  need(url.pathname === '/postgres', 'HOLD_DATABASE_NAME');
  const login = publicationGuardLoginName(role);
  need(decodeURIComponent(url.username) === `${login}.${PROJECT_REF}`, 'HOLD_DATABASE_ROLE');
  need(url.password.length >= 32 && url.password.length <= 512, 'HOLD_DATABASE_CREDENTIAL');
  const params = [...url.searchParams.entries()];
  need(params.length <= 1 && params.every(([key, value]) => key === 'sslmode' && value === 'require'), 'HOLD_DATABASE_OPTIONS');
  return Object.freeze({
    role,
    projectRef: PROJECT_REF,
    host: url.hostname,
    port: 6543,
    database: 'postgres',
    username: `${login}.${PROJECT_REF}`,
    sslRequired: true,
  });
}

function boundedText(value, max, code) {
  need(typeof value === 'string' && value.length > 0 && value.length <= max, code);
  return value;
}

function timestamp(value, code) {
  boundedText(value, 64, code);
  const time = Date.parse(value);
  need(Number.isFinite(time) && new Date(time).toISOString() === value, code);
  return value;
}

function entriesJson(entries) {
  need(Array.isArray(entries) && entries.length <= 500, 'HOLD_DATABASE_ENTRIES');
  const seen = new Set();
  for (const entry of entries) {
    need(entry && typeof entry === 'object' && Object.keys(entry).length === 2, 'HOLD_DATABASE_ENTRIES');
    need(PATH.test(entry.path) && HEX.test(entry.sourceSha256) && !seen.has(entry.path), 'HOLD_DATABASE_ENTRIES');
    seen.add(entry.path);
  }
  const encoded = JSON.stringify(entries);
  need(Buffer.byteLength(encoded) <= 100000, 'HOLD_DATABASE_ENTRIES');
  return encoded;
}

async function one(query, text, values, code) {
  need(typeof query === 'function', 'HOLD_DATABASE_ADAPTER');
  const result = await query(Object.freeze({ text, values: Object.freeze(values.slice()) }));
  need(result && Array.isArray(result.rows) && result.rows.length === 1 && Object.hasOwn(result.rows[0], 'value'), code);
  return result.rows[0].value;
}

export function createPublicationGuardSqlAdapter({ role, query } = {}) {
  publicationGuardLoginName(role);
  need(typeof query === 'function', 'HOLD_DATABASE_ADAPTER');
  const adapter = { role, publicationAuthorized: false, enforcementActive: false };

  if (role === 'reader') {
    adapter.readSnapshot = async ({ revision, entries } = {}) => one(query,
      'select publication_guard_api.read_snapshot($1, $2::jsonb) as value',
      [boundedText(revision, 120, 'HOLD_DATABASE_REVISION'), entriesJson(entries)], 'HOLD_DATABASE_SNAPSHOT');
  }

  if (role === 'controller') {
    adapter.authorizeRelease = async ({ releaseId, deploymentId, commitSha, artifactSha256, approvalSha256, expiresAt } = {}) => {
      need(UUID.test(releaseId ?? '') && /^dpl_[A-Za-z0-9]{8,80}$/.test(deploymentId ?? '')
        && SHA.test(commitSha ?? '') && HEX.test(artifactSha256 ?? '') && HEX.test(approvalSha256 ?? ''), 'HOLD_DATABASE_ARGUMENT');
      return one(query, 'select publication_guard_api.authorize_release($1,$2,$3,$4,$5,$6::timestamptz) as value',
        [releaseId, deploymentId, commitSha, artifactSha256, approvalSha256, timestamp(expiresAt, 'HOLD_DATABASE_ARGUMENT')], 'HOLD_DATABASE_WRITE');
    };
    adapter.prepareAdmission = async ({ releaseId, path, sourceSha256, mode, evidenceSha256, checkedAt, validUntil, previewDeadline = null, notBefore = null } = {}) => {
      need(UUID.test(releaseId ?? '') && PATH.test(path ?? '') && HEX.test(sourceSha256 ?? '') && HEX.test(evidenceSha256 ?? '')
        && ['preview', 'outcome', 'none'].includes(mode), 'HOLD_DATABASE_ARGUMENT');
      if (previewDeadline !== null) timestamp(previewDeadline, 'HOLD_DATABASE_ARGUMENT');
      if (notBefore !== null) timestamp(notBefore, 'HOLD_DATABASE_ARGUMENT');
      return one(query, 'select publication_guard_api.prepare_admission($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz,$8::timestamptz,$9::timestamptz) as value',
        [releaseId, path, sourceSha256, mode, evidenceSha256, timestamp(checkedAt, 'HOLD_DATABASE_ARGUMENT'),
          timestamp(validUntil, 'HOLD_DATABASE_ARGUMENT'), previewDeadline, notBefore], 'HOLD_DATABASE_WRITE');
    };
  }

  if (role === 'recorder') {
    adapter.recordVerifiedReceipt = async ({ releaseId, path, sourceSha256, receiptSha256 } = {}) => {
      need(UUID.test(releaseId ?? '') && PATH.test(path ?? '') && HEX.test(sourceSha256 ?? '') && HEX.test(receiptSha256 ?? ''), 'HOLD_DATABASE_ARGUMENT');
      return one(query, 'select publication_guard_api.record_verified_receipt($1,$2,$3,$4) as value',
        [releaseId, path, sourceSha256, receiptSha256], 'HOLD_DATABASE_WRITE');
    };
  }

  if (role === 'revoker') {
    adapter.revokeRelease = async ({ releaseId } = {}) => {
      need(UUID.test(releaseId ?? ''), 'HOLD_DATABASE_ARGUMENT');
      return one(query, 'select publication_guard_api.revoke_release($1) as value', [releaseId], 'HOLD_DATABASE_WRITE');
    };
    adapter.revokeAdmission = async ({ releaseId, path, sourceSha256 } = {}) => {
      need(UUID.test(releaseId ?? '') && PATH.test(path ?? '') && HEX.test(sourceSha256 ?? ''), 'HOLD_DATABASE_ARGUMENT');
      return one(query, 'select publication_guard_api.revoke_admission($1,$2,$3) as value',
        [releaseId, path, sourceSha256], 'HOLD_DATABASE_WRITE');
    };
  }

  return Object.freeze(adapter);
}

export const PUBLICATION_GUARD_DATABASE_SCOPE = Object.freeze({
  projectRef: PROJECT_REF,
  sharedDevelopmentRef: SHARED_DEVELOPMENT_REF,
  productionRef: PRODUCTION_REF,
  roles: ROLE_NAMES,
});