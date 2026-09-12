import assert from 'node:assert/strict';
import { createDormantPublicationGuardFunction } from '../src/lib/publication-guard.js';
import {
  PUBLICATION_PREVIEW_REHEARSAL,
  PublicationPreviewRehearsalError,
  runPublicationPreviewRehearsal,
} from '../src/lib/publication-preview-rehearsal.js';
import {
  PUBLICATION_GUARD_READER_RUNTIME_SCOPE,
} from '../src/lib/publication-guard-reader-database.js';
import {
  signDormantPreviewRouteEnvelope,
  verifyDormantPreviewRouteEnvelope,
} from '../src/lib/publication-route-candidate.js';

let groups = 0;
const pass = () => { groups += 1; };
const now = Date.parse('2026-09-12T18:00:00.000Z');
const ref = PUBLICATION_GUARD_READER_RUNTIME_SCOPE.projectRef;
const databaseSecret = 'r'.repeat(64);
const routeSecret = 'fixture-route-secret-32-bytes-minimum-558';
const commitSha = 'a'.repeat(40);
const deploymentHost = 'usd-impact-site-preview-fixture-usd-impact.vercel.app';
const routePath = '/news/2026-09-11';
const readerUrl = `postgresql://fx558_reader_login.${ref}:${databaseSecret}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`;
const environment = Object.freeze({
  PUBLICATION_GUARD_ROUTE_CANDIDATE: 'preview-dormant',
  PUBLICATION_GUARD_ROUTE_SECRET: routeSecret,
  PUBLICATION_GUARD_PREVIEW_REHEARSAL: PUBLICATION_PREVIEW_REHEARSAL.approvedMode,
  PUBLICATION_GUARD_READER_DATABASE_URL: readerUrl,
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  VERCEL_TARGET_ENV: 'preview',
  VERCEL_PROJECT_ID: PUBLICATION_GUARD_READER_RUNTIME_SCOPE.approvedProjectId,
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'usdimpact',
  VERCEL_GIT_REPO_SLUG: 'usd-impact-site',
  VERCEL_GIT_COMMIT_REF: PUBLICATION_GUARD_READER_RUNTIME_SCOPE.approvedBranch,
  VERCEL_GIT_COMMIT_SHA: commitSha,
  VERCEL_URL: deploymentHost,
});

const goodIdentity = Object.freeze({
  role: PUBLICATION_GUARD_READER_RUNTIME_SCOPE.readerLogin,
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
    if (FakePool.mode === 'fail') throw new Error('backend detail must not escape');
    if (config.text.includes("'readSnapshot', has_function_privilege")) {
      return { rows: [{ value: goodIdentity }] };
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

function signedRequest(method = 'GET') {
  const signed = signDormantPreviewRouteEnvelope({
    method,
    host: deploymentHost,
    path: routePath,
    issuedAt: now,
    environment,
    secret: routeSecret,
  });
  return {
    method,
    url: '/api/publication-guard?publicationGuardRoute=1',
    headers: { host: deploymentHost, ...signed },
  };
}

const envelope = verifyDormantPreviewRouteEnvelope({
  request: signedRequest(),
  environment,
  secret: routeSecret,
  now: () => now + 1,
});
const bundle = Object.freeze({
  schema: 'publication-render-inputs/v1',
  buildCommitSha: commitSha,
  publications: Object.freeze([{ html: 'SECRET_ARTICLE_BYTES_MUST_NEVER_BE_DISPATCHED' }]),
});

function createResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    body: '',
    getHeaderNames() { return [...headers.keys()]; },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    writeHead(status, values = {}) {
      this.statusCode = status;
      for (const [name, value] of Object.entries(values)) this.setHeader(name, value);
      this.headersSent = true;
    },
    end(value = '') {
      this.body += value ?? '';
      this.writableEnded = true;
    },
    destroy() { this.destroyed = true; },
  };
}

const diagnostic = await runPublicationPreviewRehearsal({
  environment,
  PoolClass: FakePool,
  envelope,
  bundle,
});
assert.deepEqual(diagnostic.route, { surface: 'article', path: routePath });
assert.equal(diagnostic.schema, PUBLICATION_PREVIEW_REHEARSAL.schema);
assert.equal(diagnostic.decision, 'HOLD_NOT_ADMITTED');
assert.equal(diagnostic.runtime.target, 'preview');
assert.equal(diagnostic.runtime.exposure, 'protected-preview');
assert.equal(diagnostic.runtime.commitSha, commitSha);
assert.equal(diagnostic.reader.role, PUBLICATION_GUARD_READER_RUNTIME_SCOPE.readerLogin);
assert.equal(diagnostic.reader.readSnapshot, true);
assert.equal(diagnostic.reader.writePrivileges, false);
assert.deepEqual(diagnostic.snapshot, { revision: '0', recordCount: 0 });
assert.equal(diagnostic.publicationAuthorized, false);
assert.equal(diagnostic.enforcementActive, false);
assert.equal(JSON.stringify(diagnostic).includes(databaseSecret), false);
assert.equal(JSON.stringify(diagnostic).includes(readerUrl), false);
assert.equal(FakePool.instances.at(-1).ended, true);
pass();

await assert.rejects(
  () => runPublicationPreviewRehearsal({
    environment: { ...environment, PUBLICATION_GUARD_PREVIEW_REHEARSAL: '' },
    PoolClass: FakePool,
    envelope,
    bundle,
  }),
  (error) => error instanceof PublicationPreviewRehearsalError && error.code === 'HOLD_REHEARSAL_DORMANT',
);
pass();

await assert.rejects(
  () => runPublicationPreviewRehearsal({
    environment,
    PoolClass: FakePool,
    envelope,
    bundle: { ...bundle, buildCommitSha: 'b'.repeat(40) },
  }),
  (error) => error instanceof PublicationPreviewRehearsalError && error.code === 'HOLD_REHEARSAL_BUILD',
);
pass();

await assert.rejects(
  () => runPublicationPreviewRehearsal({
    environment: { ...environment, VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production' },
    PoolClass: FakePool,
    envelope,
    bundle,
  }),
  (error) => error instanceof PublicationPreviewRehearsalError && error.code === 'HOLD_REHEARSAL_CONTEXT',
);
pass();

const handler = createDormantPublicationGuardFunction({
  environment,
  loadBundle: async () => bundle,
  runRehearsal: ({ environment: runtimeEnvironment, envelope: verifiedEnvelope, bundle: runtimeBundle }) =>
    runPublicationPreviewRehearsal({
      environment: runtimeEnvironment,
      PoolClass: FakePool,
      envelope: verifiedEnvelope,
      bundle: runtimeBundle,
    }),
  now: () => now + 1,
});
const response = createResponse();
const result = await handler(signedRequest(), response);
assert.equal(result.decision, 'HOLD_NOT_ADMITTED');
assert.equal(result.status, 503);
assert.equal(result.rehearsal, true);
assert.equal(result.publicationAuthorized, false);
assert.equal(result.enforcementActive, false);
assert.equal(response.statusCode, 503);
assert.equal(response.getHeader('content-type'), 'application/json; charset=utf-8');
assert.equal(response.getHeader('cache-control'), 'private, no-store');
assert.equal(response.getHeader('cdn-cache-control'), 'no-store');
assert.equal(response.getHeader('vercel-cdn-cache-control'), 'no-store');
assert.equal(JSON.parse(response.body).decision, 'HOLD_NOT_ADMITTED');
assert.doesNotMatch(response.body, /SECRET_ARTICLE_BYTES_MUST_NEVER_BE_DISPATCHED/);
pass();

const headResponse = createResponse();
const headResult = await handler(signedRequest('HEAD'), headResponse);
assert.equal(headResult.decision, 'HOLD_NOT_ADMITTED');
assert.equal(headResponse.statusCode, 503);
assert.equal(headResponse.body, '');
assert.equal(headResponse.getHeader('content-length'), undefined);
pass();

let invalidRunnerCalls = 0;
const invalidRunner = createDormantPublicationGuardFunction({
  environment,
  loadBundle: async () => bundle,
  runRehearsal: async () => {
    invalidRunnerCalls += 1;
    return {
      schema: PUBLICATION_PREVIEW_REHEARSAL.schema,
      decision: 'PASS_REHEARSAL',
      publicationAuthorized: false,
      enforcementActive: false,
    };
  },
  now: () => now + 1,
});
const invalidResponse = createResponse();
const invalidResult = await invalidRunner(signedRequest(), invalidResponse);
assert.equal(invalidRunnerCalls, 1);
assert.equal(invalidResult.decision, 'HOLD_ROUTE_UNAVAILABLE');
assert.equal(invalidResponse.statusCode, 503);
assert.equal(invalidResponse.body, 'Publication unavailable.\n');
pass();

let dormantRunnerCalls = 0;
const dormantEnvironment = { ...environment };
delete dormantEnvironment.PUBLICATION_GUARD_PREVIEW_REHEARSAL;
const dormantHandler = createDormantPublicationGuardFunction({
  environment: dormantEnvironment,
  loadBundle: async () => bundle,
  runRehearsal: async () => { dormantRunnerCalls += 1; return diagnostic; },
  now: () => now + 1,
});
const dormantResponse = createResponse();
const dormantResult = await dormantHandler(signedRequest(), dormantResponse);
assert.equal(dormantRunnerCalls, 0);
assert.equal(dormantResult.decision, 'HOLD_ROUTE_UNAVAILABLE');
assert.equal(dormantResponse.statusCode, 503);
pass();

const unknownModeHandler = createDormantPublicationGuardFunction({
  environment: { ...environment, PUBLICATION_GUARD_PREVIEW_REHEARSAL: 'write-v1' },
  loadBundle: async () => bundle,
  runRehearsal: async () => { throw new Error('must not run'); },
  now: () => now + 1,
});
const unknownModeResponse = createResponse();
const unknownModeResult = await unknownModeHandler(signedRequest(), unknownModeResponse);
assert.equal(unknownModeResult.decision, 'HOLD_ROUTE_UNAVAILABLE');
assert.equal(unknownModeResponse.statusCode, 503);
pass();

console.log(`publication Preview rehearsal tests pass (${groups} groups; offline fake pool only)`);
