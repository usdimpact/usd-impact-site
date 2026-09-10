import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  createGitHubOidcWitnessVerifier, githubOidcWitnessAudience,
  normalizeGitHubOidcDiscovery, normalizeGitHubOidcJwks,
  GITHUB_OIDC_ISSUER, GITHUB_OIDC_JWKS_URI,
} from './verifier.mjs';

export const VERIFIER_SHA256 = 'e65f2f81f376473534cde41262108803515a2a5f5bf798909bd6425ee1163378';
export const REPOSITORY = 'usdimpact/usd-impact-site';
export const CALLER = `${REPOSITORY}/.github/workflows/publication-oidc-rehearsal-558.yml@refs/heads/main`;
export const RUNNER_PATH = `${REPOSITORY}/.github/workflows/publication-oidc-rehearsal-runner-558.yml`;
export const DISCOVERY = `${GITHUB_OIDC_ISSUER}/.well-known/openid-configuration`;
const SHA = /^[a-f0-9]{40}$/;
const ID = /^[1-9][0-9]{0,30}$/;
const hash = (value) => createHash('sha256').update(value).digest('hex');
class RehearsalHold extends Error {
  constructor(code) { super(code); this.code = code; }
}
const need = (condition, code) => { if (!condition) throw new RehearsalHold(code); };
const flags = Object.freeze({ rehearsalOnly: true, publicationAuthorized: false,
  admissionRecorded: false, enforcementActive: false, publicResponseObserved: false });

export function validateContext(value) {
  need(value && typeof value === 'object' && !Array.isArray(value), 'HOLD_REHEARSAL_CONTEXT');
  const keys = ['actions','repository','repositoryId','ownerId','ref','refProtected','eventName',
    'runId','runAttempt','callerSha','runnerSha','checkoutSha','workflowRef','approval'];
  need(Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)), 'HOLD_REHEARSAL_CONTEXT');
  need(value.actions === 'true' && value.approval === 'identity-only-558-v1', 'HOLD_REHEARSAL_NOT_AUTHORIZED');
  need(value.repository === REPOSITORY && value.repositoryId === '1265351071'
    && value.ownerId === '275107298', 'HOLD_REHEARSAL_REPOSITORY');
  need(value.ref === 'refs/heads/main' && value.refProtected === 'true'
    && value.eventName === 'workflow_dispatch' && value.workflowRef === CALLER, 'HOLD_REHEARSAL_EXECUTION');
  need(typeof value.runId === 'string' && ID.test(value.runId) && value.runAttempt === '1', 'HOLD_REHEARSAL_RUN');
  need(typeof value.callerSha === 'string' && SHA.test(value.callerSha)
    && typeof value.runnerSha === 'string' && SHA.test(value.runnerSha)
    && value.checkoutSha === value.runnerSha, 'HOLD_REHEARSAL_REVISION');
  return Object.freeze({ ...value });
}

// GitHub supplies the full issuance URL; its path is not a documented suffix contract.
// This helper checks the existing URL envelope only and performs no request.
function validatedTokenEndpoint(base) {
  need(typeof base === 'string' && base.length > 0 && base.length <= 4096
    && !/[\r\n\t]/.test(base), 'HOLD_REHEARSAL_TOKEN_ENDPOINT');
  let url;
  try { url = new URL(base); } catch { throw new RehearsalHold('HOLD_REHEARSAL_TOKEN_ENDPOINT'); }
  need(url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
    && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.actions\.githubusercontent\.com$/.test(url.hostname),
    'HOLD_REHEARSAL_TOKEN_ENDPOINT');
  return url;
}

export function tokenRequestUrl(base, audience) {
  const url = validatedTokenEndpoint(base);
  need(typeof audience === 'string' && /^urn:usd-impact:public-witness:(challenge|receipt):sha256:[a-f0-9]{64}$/.test(audience),
    'HOLD_REHEARSAL_AUDIENCE');
  url.searchParams.delete('audience');
  url.searchParams.set('audience', audience);
  return url.href;
}

/** Bounded GETs only. Bearer material is confined to GitHub's injected token
 * endpoint; no redirects, retries, response-body logs, or arbitrary destinations.
 * This is a source-level destination restriction, not a runner-wide firewall.
 */
export function createJsonTransport({ fetchImpl = globalThis.fetch, timeoutMs = 4000, maxBytes = 65536,
  tokenEndpoint = null } = {}) {
  need(typeof fetchImpl === 'function' && Number.isInteger(timeoutMs) && timeoutMs >= 10 && timeoutMs <= 5000
    && Number.isInteger(maxBytes) && maxBytes >= 100 && maxBytes <= 65536, 'HOLD_REHEARSAL_TRANSPORT_CONFIG');
  // Capture one trusted runtime endpoint. Omitting it permits discovery/JWKS only.
  // Never authorize a bearer destination by validating that destination against itself.
  const boundTokenEndpoint = tokenEndpoint === null ? null : validatedTokenEndpoint(tokenEndpoint).href;
  return async function getJson(url, bearer = null) {
    if (bearer === null) need(url === DISCOVERY || url === GITHUB_OIDC_JWKS_URI, 'HOLD_REHEARSAL_DESTINATION');
    else {
      need(typeof bearer === 'string' && bearer.length > 0 && bearer.length <= 20000 && !/[\r\n]/.test(bearer), 'HOLD_REHEARSAL_TOKEN_PERMISSION');
      need(boundTokenEndpoint !== null && typeof url === 'string' && url.length <= 4096,
        'HOLD_REHEARSAL_TOKEN_ENDPOINT');
      let audience;
      try { audience = new URL(url).searchParams.get('audience'); }
      catch { throw new RehearsalHold('HOLD_REHEARSAL_TOKEN_ENDPOINT'); }
      // Exact origin, path and non-audience parameters are bound to the captured URL.
      // Only the verifier's challenge/receipt audience may differ between requests.
      need(tokenRequestUrl(boundTokenEndpoint, audience) === url, 'HOLD_REHEARSAL_TOKEN_ENDPOINT');
    }
    const abort = new AbortController();
    let timer, reader;
    const work = async () => {
      const headers = { Accept: 'application/json' };
      if (bearer !== null) headers.Authorization = `Bearer ${bearer}`;
      const response = await fetchImpl(url, { method: 'GET', headers, redirect: 'error',
        cache: 'no-store', credentials: 'omit', signal: abort.signal });
      need(response && response.status === 200 && response.redirected === false && response.url === url,
        'HOLD_REHEARSAL_HTTP');
      const type = response.headers.get('content-type');
      need(typeof type === 'string' && /^application\/(json|jwk-set\+json)(?:\s*;|$)/i.test(type), 'HOLD_REHEARSAL_CONTENT_TYPE');
      const length = response.headers.get('content-length');
      need(length === null || (/^[0-9]+$/.test(length) && Number(length) <= maxBytes), 'HOLD_REHEARSAL_BODY_LIMIT');
      need(response.body && typeof response.body.getReader === 'function', 'HOLD_REHEARSAL_BODY');
      reader = response.body.getReader();
      const chunks = []; let count = 0;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        count += part.value.byteLength;
        need(count <= maxBytes, 'HOLD_REHEARSAL_BODY_LIMIT');
        chunks.push(Buffer.from(part.value));
      }
      need(count > 0 && (length === null || count === Number(length)), 'HOLD_REHEARSAL_BODY');
      let parsed;
      try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { throw new RehearsalHold('HOLD_REHEARSAL_JSON'); }
      need(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'HOLD_REHEARSAL_JSON');
      return parsed;
    };
    try {
      return await Promise.race([work(), new Promise((_, reject) => {
        timer = setTimeout(() => { abort.abort(); reject(new RehearsalHold('HOLD_REHEARSAL_TIMEOUT')); }, timeoutMs);
      })]);
    } catch (error) {
      if (error instanceof RehearsalHold) throw error;
      throw new RehearsalHold('HOLD_REHEARSAL_NETWORK');
    } finally {
      clearTimeout(timer); abort.abort();
      if (reader) void reader.cancel().catch(() => {});
    }
  };
}

/** Live entry uses real GitHub data; tests explicitly inject synthetic data.
 * There is no article fetch, publication recorder, database, or provider client.
 */
export async function runIdentityRehearsal({ context, endpoint, requestBearer, getJson,
  now = Date.now, nonce = () => randomBytes(32).toString('hex') } = {}) {
  const counters = { requestsAttempted: 0, tokensRequested: 0, tokensVerified: 0 };
  let stage = 'preflight'; let last = -1;
  const clock = () => { const n = now(); need(Number.isSafeInteger(n) && n >= last && n >= 0,
    'HOLD_REHEARSAL_CLOCK'); last = n; return n; };
  let c;
  try {
    c = validateContext(context);
    need(typeof getJson === 'function', 'HOLD_REHEARSAL_TRANSPORT_CONFIG');
    need(typeof requestBearer === 'string' && requestBearer.length > 0 && requestBearer.length <= 20000
      && !/[\r\n]/.test(requestBearer), 'HOLD_REHEARSAL_TOKEN_PERMISSION');
    const n = nonce(); need(typeof n === 'string' && /^[a-f0-9]{64}$/.test(n), 'HOLD_REHEARSAL_NONCE');
    // Domain-separated, synthetic evidence. No caller-supplied article/hash/URL.
    const challengeDigest = hash(JSON.stringify({ schema: 'identity-rehearsal-only/558-v1', phase: 'challenge',
      nonce: n, repository: REPOSITORY, callerSha: c.callerSha, runnerSha: c.runnerSha,
      runId: c.runId, runAttempt: c.runAttempt, publicResponseObserved: false }));
    const expectation = (purpose, evidenceSha256, run = null) => ({ purpose, evidenceSha256,
      workflowRef: CALLER, workflowSha: c.callerSha, jobWorkflowRef: `${RUNNER_PATH}@${c.runnerSha}`,
      jobWorkflowSha: c.runnerSha, eventName: 'workflow_dispatch', run });
    const firstExpected = expectation('challenge', challengeDigest);
    tokenRequestUrl(endpoint, githubOidcWitnessAudience(firstExpected));
    const get = async (url, bearer = null) => { counters.requestsAttempted++; return getJson(url, bearer); };
    stage = 'discovery';
    normalizeGitHubOidcDiscovery(await get(DISCOVERY));
    stage = 'jwks'; const observed = clock();
    const jwksSnapshot = normalizeGitHubOidcJwks(await get(GITHUB_OIDC_JWKS_URI), {
      observedAt: new Date(observed).toISOString(), validUntil: new Date(observed + 60000).toISOString() });
    const verifier = createGitHubOidcWitnessVerifier({ now: clock });
    const fetchAndVerify = async (expected) => {
      counters.tokensRequested++;
      const body = await get(tokenRequestUrl(endpoint, githubOidcWitnessAudience(expected)), requestBearer);
      need(Object.keys(body).length === 1 && typeof body.value === 'string'
        && body.value.length > 0 && body.value.length <= 20000, 'HOLD_REHEARSAL_TOKEN_RESPONSE');
      const checked = verifier(body.value, { jwksSnapshot, expected });
      need(checked.identityAuthenticated === true, 'HOLD_REHEARSAL_IDENTITY_REJECTED');
      need(checked.run.runId === c.runId && checked.run.runAttempt === c.runAttempt, 'HOLD_REHEARSAL_RUN');
      counters.tokensVerified++;
      // Only the digest and sanitized identity metadata survive this function.
      return { identity: checked, tokenDigest: hash(body.value) };
    };
    stage = 'challenge'; const first = await fetchAndVerify(firstExpected);
    stage = 'receipt';
    const receiptDigest = hash(JSON.stringify({ schema: 'identity-rehearsal-only/558-v1', phase: 'receipt',
      challengeDigest, challengeTokenDigest: first.tokenDigest, publicResponseObserved: false }));
    const second = await fetchAndVerify(expectation('receipt', receiptDigest, first.identity.run));
    return Object.freeze({ schema: 'oidc-rehearsal-report/558-v1', decision: 'PASS_IDENTITY_REHEARSAL_ONLY',
      stage: 'complete', ...flags, ...counters, repository: REPOSITORY, callerSha: c.callerSha,
      runnerSha: c.runnerSha, runId: c.runId, runAttempt: c.runAttempt,
      sameExecution: first.identity.run.checkRunId === second.identity.run.checkRunId,
      distinctTokens: first.tokenDigest !== second.tokenDigest,
      verifiedAt: new Date(clock()).toISOString() });
  } catch (error) {
    const decision = error instanceof RehearsalHold ? error.code : 'HOLD_REHEARSAL_FAILED';
    return Object.freeze({ schema: 'oidc-rehearsal-report/558-v1', decision, stage, ...flags, ...counters });
  }
}

async function main() {
  let report;
  try {
    need(process.argv.length === 3 && process.argv[2] === '--live', 'HOLD_REHEARSAL_MODE');
    need(process.env.GITHUB_ACTIONS === 'true' && process.env.REHEARSAL_APPROVAL === 'identity-only-558-v1',
      'HOLD_REHEARSAL_NOT_AUTHORIZED');
    need(hash(await readFile(new URL('./verifier.mjs', import.meta.url))) === VERIFIER_SHA256,
      'HOLD_REHEARSAL_SOURCE_DRIFT');
    const e = process.env;
    const checkoutSha = execFileSync('git', ['rev-parse','HEAD'], { encoding: 'utf8', timeout: 2000,
      stdio: ['ignore','pipe','ignore'] }).trim();
    const context = { actions: e.GITHUB_ACTIONS, repository: e.GITHUB_REPOSITORY,
      repositoryId: e.REHEARSAL_REPOSITORY_ID, ownerId: e.REHEARSAL_OWNER_ID,
      ref: e.GITHUB_REF, refProtected: e.REHEARSAL_REF_PROTECTED, eventName: e.GITHUB_EVENT_NAME,
      runId: e.GITHUB_RUN_ID, runAttempt: e.GITHUB_RUN_ATTEMPT, callerSha: e.GITHUB_SHA,
      runnerSha: e.REHEARSAL_RUNNER_SHA, checkoutSha, workflowRef: e.GITHUB_WORKFLOW_REF,
      approval: e.REHEARSAL_APPROVAL };
    // Read the platform endpoint once; CLI/workflow inputs cannot supply an override.
    const endpoint = e.ACTIONS_ID_TOKEN_REQUEST_URL;
    report = await runIdentityRehearsal({ context, endpoint,
      requestBearer: e.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
      getJson: createJsonTransport({ tokenEndpoint: endpoint }) });
  } catch (error) {
    report = { schema: 'oidc-rehearsal-report/558-v1', decision: error instanceof RehearsalHold
      ? error.code : 'HOLD_REHEARSAL_FAILED', stage: 'preflight', ...flags,
      requestsAttempted: 0, tokensRequested: 0, tokensVerified: 0 };
  }
  // No raw tokens, token claims, request URLs, or exception messages in outputs.
  console.log(JSON.stringify(report));
  process.exitCode = report.decision === 'PASS_IDENTITY_REHEARSAL_ONLY' ? 0 : 2;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
