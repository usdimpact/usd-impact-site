import { createHash } from 'node:crypto';
import {
  PUBLICATION_GUARD_PRODUCTION_READER_SCOPE,
  assertPublicationGuardProductionReaderContext,
} from './publication-production-reader-database.js';

const PROVIDER_SCHEMA = 'publication-production-provider-state/v1';
const AUTHORITY_SCHEMA = 'publication-serving-authority/v1';
const APPROVED_TEAM_ID = 'team_1LuMlacGuM198mRjoID4O3Ct';
const MAX_AUTHORITY_MS = 15_000;
const SHA = /^[a-f0-9]{40}$/;
const HEX = /^[a-f0-9]{64}$/;
const DEPLOYMENT = /^dpl_[A-Za-z0-9]{8,80}$/;
const DEPLOYMENT_HOST = /^[a-z0-9][a-z0-9-]{1,98}\.vercel\.app$/;
const REVISION = /^(?:0|[1-9][0-9]{0,18})$/;
const ROUTE = /^\/news\/(?:\d{4}-\d{2}-\d{2}|catalysts\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const APPROVED_PUBLIC_ALIASES = Object.freeze([
  'usd-impact-site-git-main-usd-impact.vercel.app',
  'usd-impact-site-usd-impact.vercel.app',
  'usd-impact-site.vercel.app',
  'usd-impact.com',
  'www.usd-impact.com',
]);
const PROVIDER_FIELDS = Object.freeze([
  'schema',
  'repository',
  'projectId',
  'teamId',
  'target',
  'exposure',
  'source',
  'deploymentId',
  'deploymentHost',
  'commitSha',
  'artifactSha256',
  'manifestSha256',
  'entries',
  'publicAliases',
  'observedAt',
  'validUntil',
]);

export class PublicationProductionAuthorityError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationProductionAuthorityError';
    this.code = code;
    this.policyCode = code;
  }
}

const fail = (code) => { throw new PublicationProductionAuthorityError(code); };
const need = (condition, code) => { if (!condition) fail(code); };
const hash = (value) => createHash('sha256').update(value).digest('hex');

function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}

function copy(value, maxBytes, code) {
  let encoded;
  try { encoded = JSON.stringify(value); } catch { fail(code); }
  need(typeof encoded === 'string' && Buffer.byteLength(encoded) <= maxBytes, code);
  try { return JSON.parse(encoded); } catch { fail(code); }
}

function instant(value, code) {
  need(typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), code);
  const time = Date.parse(value);
  need(Number.isFinite(time) && new Date(time).toISOString() === value, code);
  return time;
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function canonicalEntries(entries) {
  need(Array.isArray(entries) && entries.length <= 500, 'HOLD_PRODUCTION_AUTHORITY_MANIFEST');
  const seen = new Set();
  const rows = entries.map((entry) => {
    need(plain(entry) && Object.keys(entry).length === 2
      && Object.hasOwn(entry, 'path') && Object.hasOwn(entry, 'sourceSha256'),
    'HOLD_PRODUCTION_AUTHORITY_MANIFEST');
    need(ROUTE.test(entry.path ?? '') && HEX.test(entry.sourceSha256 ?? '') && !seen.has(entry.path),
      'HOLD_PRODUCTION_AUTHORITY_MANIFEST');
    seen.add(entry.path);
    return { path: entry.path, sourceSha256: entry.sourceSha256 };
  });
  rows.sort((left, right) => left.path.localeCompare(right.path));
  return rows;
}

function assertRuntime(environment) {
  let base;
  try { base = assertPublicationGuardProductionReaderContext(environment); }
  catch { fail('HOLD_PRODUCTION_AUTHORITY_CONTEXT'); }
  need(DEPLOYMENT.test(environment.VERCEL_DEPLOYMENT_ID ?? ''), 'HOLD_PRODUCTION_AUTHORITY_CONTEXT');
  need(DEPLOYMENT_HOST.test(environment.VERCEL_URL ?? ''), 'HOLD_PRODUCTION_AUTHORITY_CONTEXT');
  return freeze({
    ...base,
    teamId: APPROVED_TEAM_ID,
    deploymentId: environment.VERCEL_DEPLOYMENT_ID,
    deploymentHost: environment.VERCEL_URL,
  });
}

function normalizeProviderState(raw, runtime, now) {
  const value = copy(raw, 500_000, 'HOLD_PRODUCTION_AUTHORITY_PROVIDER');
  need(plain(value), 'HOLD_PRODUCTION_AUTHORITY_PROVIDER');
  const keys = Object.keys(value).sort();
  const expected = [...PROVIDER_FIELDS].sort();
  need(keys.length === expected.length && keys.every((key, index) => key === expected[index]),
    'HOLD_PRODUCTION_AUTHORITY_PROVIDER');
  need(value.schema === PROVIDER_SCHEMA
    && value.repository === PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.approvedRepository
    && value.projectId === runtime.projectId
    && value.teamId === runtime.teamId
    && value.target === 'production'
    && value.exposure === 'public-approved'
    && value.source === 'git',
  'HOLD_PRODUCTION_AUTHORITY_PROVIDER_BINDING');
  need(value.deploymentId === runtime.deploymentId
    && value.deploymentHost === runtime.deploymentHost
    && value.commitSha === runtime.commitSha
    && DEPLOYMENT.test(value.deploymentId)
    && DEPLOYMENT_HOST.test(value.deploymentHost)
    && SHA.test(value.commitSha ?? ''),
  'HOLD_PRODUCTION_AUTHORITY_PROVIDER_BINDING');
  need(HEX.test(value.artifactSha256 ?? '') && HEX.test(value.manifestSha256 ?? ''),
    'HOLD_PRODUCTION_AUTHORITY_MANIFEST');

  const entries = canonicalEntries(value.entries);
  need(hash(JSON.stringify(entries)) === value.manifestSha256, 'HOLD_PRODUCTION_AUTHORITY_MANIFEST');

  need(Array.isArray(value.publicAliases)
    && value.publicAliases.every((alias) => typeof alias === 'string'),
  'HOLD_PRODUCTION_AUTHORITY_PUBLIC_EXPOSURE');
  const aliases = [...new Set(value.publicAliases)].sort();
  need(aliases.length === value.publicAliases.length
    && sameArray(aliases, APPROVED_PUBLIC_ALIASES),
  'HOLD_PRODUCTION_AUTHORITY_PUBLIC_EXPOSURE');

  const observedAt = instant(value.observedAt, 'HOLD_PRODUCTION_AUTHORITY_FRESHNESS');
  const validUntil = instant(value.validUntil, 'HOLD_PRODUCTION_AUTHORITY_FRESHNESS');
  need(observedAt <= now && now < validUntil && validUntil - observedAt <= MAX_AUTHORITY_MS,
    'HOLD_PRODUCTION_AUTHORITY_FRESHNESS');

  return freeze({
    schema: PROVIDER_SCHEMA,
    repository: value.repository,
    projectId: value.projectId,
    teamId: value.teamId,
    target: value.target,
    exposure: value.exposure,
    source: value.source,
    deploymentId: value.deploymentId,
    deploymentHost: value.deploymentHost,
    commitSha: value.commitSha,
    artifactSha256: value.artifactSha256,
    manifestSha256: value.manifestSha256,
    entries: freeze(entries),
    publicAliases: freeze(aliases),
    observedAt: value.observedAt,
    validUntil: value.validUntil,
  });
}

function binding(value) {
  return {
    repository: value.repository,
    projectId: value.projectId,
    teamId: value.teamId,
    target: value.target,
    exposure: value.exposure,
    source: value.source,
    deploymentId: value.deploymentId,
    deploymentHost: value.deploymentHost,
    commitSha: value.commitSha,
    artifactSha256: value.artifactSha256,
    manifestSha256: value.manifestSha256,
    entries: value.entries,
    publicAliases: value.publicAliases,
  };
}

function sameBinding(left, right) {
  return JSON.stringify(binding(left)) === JSON.stringify(binding(right));
}

export function createPublicationProductionAuthorityAdapter({
  environment = process.env,
  reader,
  loadProviderState,
  now = Date.now,
} = {}) {
  const runtime = assertRuntime(environment);
  need(reader && typeof reader === 'object'
    && typeof reader.verifyIdentityAndPrivileges === 'function'
    && typeof reader.readCurrentRevision === 'function'
    && typeof reader.readSnapshot === 'function',
  'HOLD_PRODUCTION_AUTHORITY_READER');
  need(typeof loadProviderState === 'function' && typeof now === 'function',
    'HOLD_PRODUCTION_AUTHORITY_CONFIG');

  let highestTime = -1;
  function clock() {
    const value = now();
    need(Number.isSafeInteger(value) && value >= 0 && value >= highestTime,
      'HOLD_PRODUCTION_AUTHORITY_CLOCK');
    highestTime = value;
    return value;
  }

  async function providerState() {
    let raw;
    try { raw = await loadProviderState(); }
    catch { fail('HOLD_PRODUCTION_AUTHORITY_PROVIDER'); }
    return normalizeProviderState(raw, runtime, clock());
  }

  async function verifiedReaderIdentity() {
    let identity;
    try { identity = await reader.verifyIdentityAndPrivileges(); }
    catch { fail('HOLD_PRODUCTION_AUTHORITY_READER'); }
    need(plain(identity)
      && identity.role === PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.readerLogin
      && identity.projectRef === PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.projectRef
      && identity.database === 'postgres'
      && identity.ssl === true
      && identity.readCurrentRevision === true
      && identity.readSnapshot === true
      && identity.writePrivileges === false,
    'HOLD_PRODUCTION_AUTHORITY_READER');
    return identity;
  }

  async function loadAuthority() {
    const first = await providerState();
    await verifiedReaderIdentity();
    let revision;
    try { revision = await reader.readCurrentRevision(); }
    catch { fail('HOLD_PRODUCTION_AUTHORITY_READER'); }
    need(typeof revision === 'string' && REVISION.test(revision), 'HOLD_PRODUCTION_AUTHORITY_REVISION');
    const second = await providerState();
    need(sameBinding(first, second), 'HOLD_PRODUCTION_AUTHORITY_DRIFT');

    const observedAt = new Date(Math.max(Date.parse(first.observedAt), Date.parse(second.observedAt))).toISOString();
    const validUntil = new Date(Math.min(Date.parse(first.validUntil), Date.parse(second.validUntil))).toISOString();
    const current = clock();
    need(Date.parse(observedAt) <= current && current < Date.parse(validUntil)
      && Date.parse(validUntil) - Date.parse(observedAt) <= MAX_AUTHORITY_MS,
    'HOLD_PRODUCTION_AUTHORITY_FRESHNESS');

    return freeze({
      schema: AUTHORITY_SCHEMA,
      repository: second.repository,
      projectId: second.projectId,
      teamId: second.teamId,
      target: 'production',
      exposure: 'public-approved',
      deploymentId: second.deploymentId,
      commitSha: second.commitSha,
      artifactSha256: second.artifactSha256,
      manifestSha256: second.manifestSha256,
      historyRevision: revision,
      entries: second.entries,
      legacyBaseline: null,
      observedAt,
      validUntil,
    });
  }

  async function readHistory({ revision, entries } = {}) {
    need(typeof revision === 'string' && REVISION.test(revision)
      && Array.isArray(entries) && entries.length <= 500,
    'HOLD_PRODUCTION_AUTHORITY_HISTORY');
    let snapshot;
    try { snapshot = await reader.readSnapshot({ revision, entries }); }
    catch { fail('HOLD_PRODUCTION_AUTHORITY_READER'); }
    need(plain(snapshot) && snapshot.revision === revision && Array.isArray(snapshot.records)
      && snapshot.records.length === entries.length,
    'HOLD_PRODUCTION_AUTHORITY_HISTORY');
    return freeze(copy(snapshot, 2_000_000, 'HOLD_PRODUCTION_AUTHORITY_HISTORY'));
  }

  return Object.freeze({
    publicationAuthorized: false,
    enforcementActive: false,
    runtime,
    loadAuthority,
    readHistory,
  });
}

export const PUBLICATION_PRODUCTION_AUTHORITY_SCOPE = Object.freeze({
  providerSchema: PROVIDER_SCHEMA,
  authoritySchema: AUTHORITY_SCHEMA,
  teamId: APPROVED_TEAM_ID,
  approvedPublicAliases: APPROVED_PUBLIC_ALIASES,
  maxAuthorityMs: MAX_AUTHORITY_MS,
  publicationAuthorized: false,
  enforcementActive: false,
});
