import { createPublicKey, verify as verifySignature } from 'node:crypto';

export const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
export const GITHUB_OIDC_JWKS_URI = 'https://token.actions.githubusercontent.com/.well-known/jwks';
const REPOSITORY = 'usdimpact/usd-impact-site';
const REPOSITORY_ID = '1265351071';
const REPOSITORY_OWNER = 'usdimpact';
const REPOSITORY_OWNER_ID = '275107298';
const MAIN_REF = 'refs/heads/main';
const HEX = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const DIGITS = /^[1-9][0-9]{0,30}$/;
const TOKEN_SEGMENT = /^[A-Za-z0-9_-]+$/;
const fail = (code) => { throw Object.assign(new Error(code), { code }); };
const need = (value, code) => { if (!value) fail(code); };
const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};
function instant(value, code = 'HOLD_GITHUB_OIDC_TIME') {
  need(typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), code);
  const n = Date.parse(value);
  need(Number.isFinite(n) && new Date(n).toISOString() === value, code);
  return n;
}
function jsonSegment(segment, max, code) {
  need(typeof segment === 'string' && segment.length > 0 && segment.length <= max && TOKEN_SEGMENT.test(segment), code);
  const bytes = Buffer.from(segment, 'base64url');
  need(bytes.toString('base64url') === segment, code);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail(code); }
  let value;
  try { value = JSON.parse(text); } catch { fail(code); }
  need(value && typeof value === 'object' && !Array.isArray(value), code);
  return value;
}
function tokenTime(value, code) {
  need(Number.isSafeInteger(value) && value >= 0, code);
  return value * 1000;
}
function protectedRef(value) {
  return value === true || value === 'true';
}
function audience({ purpose, evidenceSha256 }) {
  need(['challenge', 'receipt'].includes(purpose) && HEX.test(evidenceSha256), 'HOLD_GITHUB_OIDC_AUDIENCE');
  return `urn:usd-impact:public-witness:${purpose}:sha256:${evidenceSha256}`;
}
export function githubOidcWitnessAudience(input) { return audience(input); }

export function normalizeGitHubOidcDiscovery(document) {
  need(document && typeof document === 'object' && !Array.isArray(document), 'HOLD_GITHUB_OIDC_DISCOVERY');
  need(document.issuer === GITHUB_OIDC_ISSUER && document.jwks_uri === GITHUB_OIDC_JWKS_URI,
    'HOLD_GITHUB_OIDC_DISCOVERY');
  need(Array.isArray(document.id_token_signing_alg_values_supported)
    && document.id_token_signing_alg_values_supported.includes('RS256'), 'HOLD_GITHUB_OIDC_DISCOVERY');
  const requiredClaims = ['aud','iss','sub','jti','nbf','iat','exp','repository','repository_id','repository_owner',
    'repository_owner_id','ref','ref_type','ref_protected','sha','run_id','run_attempt','workflow_ref','workflow_sha',
    'job_workflow_ref','job_workflow_sha','event_name','repository_visibility','runner_environment','check_run_id'];
  need(Array.isArray(document.claims_supported)
    && requiredClaims.every((claim) => document.claims_supported.includes(claim)), 'HOLD_GITHUB_OIDC_DISCOVERY');
  return freeze({ issuer: GITHUB_OIDC_ISSUER, jwksUri: GITHUB_OIDC_JWKS_URI,
    signingAlgorithm: 'RS256', requiredClaims: [...requiredClaims] });
}

export function normalizeGitHubOidcJwks(document, { observedAt, validUntil } = {}) {
  need(document && typeof document === 'object' && !Array.isArray(document)
    && Array.isArray(document.keys) && document.keys.length > 0 && document.keys.length <= 8,
  'HOLD_GITHUB_OIDC_JWKS');
  instant(observedAt, 'HOLD_GITHUB_OIDC_JWKS');
  need(instant(validUntil, 'HOLD_GITHUB_OIDC_JWKS') > instant(observedAt, 'HOLD_GITHUB_OIDC_JWKS'),
    'HOLD_GITHUB_OIDC_JWKS');
  const keys = document.keys.map((key) => {
    need(key && typeof key === 'object' && !Array.isArray(key)
      && key.kty === 'RSA' && key.alg === 'RS256' && key.use === 'sig'
      && typeof key.kid === 'string' && /^[A-Za-z0-9_.-]{1,160}$/.test(key.kid)
      && typeof key.n === 'string' && key.n.length >= 300 && TOKEN_SEGMENT.test(key.n)
      && typeof key.e === 'string' && key.e.length >= 2 && key.e.length <= 16 && TOKEN_SEGMENT.test(key.e),
    'HOLD_GITHUB_OIDC_JWKS');
    return { kty: 'RSA', alg: 'RS256', use: 'sig', kid: key.kid, n: key.n, e: key.e };
  });
  need(new Set(keys.map((key) => key.kid)).size === keys.length, 'HOLD_GITHUB_OIDC_JWKS');
  return freeze({ issuer: GITHUB_OIDC_ISSUER, observedAt, validUntil, keys });
}

function validateExpected(expected) {
  need(expected && typeof expected === 'object' && !Array.isArray(expected), 'HOLD_GITHUB_OIDC_EXPECTED');
  const fields = ['purpose','evidenceSha256','workflowRef','workflowSha','jobWorkflowRef','jobWorkflowSha','eventName','run'];
  need(Object.keys(expected).length === fields.length && fields.every((field) => Object.hasOwn(expected, field)),
    'HOLD_GITHUB_OIDC_EXPECTED');
  audience(expected);
  need(typeof expected.workflowRef === 'string'
    && expected.workflowRef.startsWith(`${REPOSITORY}/.github/workflows/`)
    && expected.workflowRef.endsWith(`@${MAIN_REF}`), 'HOLD_GITHUB_OIDC_WORKFLOW');
  need(SHA.test(expected.workflowSha), 'HOLD_GITHUB_OIDC_WORKFLOW');
  need(typeof expected.jobWorkflowRef === 'string'
    && expected.jobWorkflowRef.startsWith(`${REPOSITORY}/.github/workflows/`)
    && expected.jobWorkflowRef.endsWith(`@${expected.jobWorkflowSha}`)
    && SHA.test(expected.jobWorkflowSha), 'HOLD_GITHUB_OIDC_JOB_WORKFLOW');
  need(['workflow_dispatch'].includes(expected.eventName), 'HOLD_GITHUB_OIDC_EVENT');
  // A receipt must continue a previously authenticated challenge execution.
  // Only the initial challenge may establish a run without prior run context.
  need(expected.purpose !== 'receipt' || expected.run !== null, 'HOLD_GITHUB_OIDC_RUN_REQUIRED');
  if (expected.run !== null) {
    need(expected.run && typeof expected.run === 'object' && !Array.isArray(expected.run)
      && Object.keys(expected.run).length === 5
      && ['runId','runAttempt','checkRunId','tokenJti','tokenIssuedAt'].every((field) => Object.hasOwn(expected.run, field))
      && DIGITS.test(expected.run.runId) && DIGITS.test(expected.run.runAttempt) && DIGITS.test(expected.run.checkRunId)
      && typeof expected.run.tokenJti === 'string' && expected.run.tokenJti.length >= 8 && expected.run.tokenJti.length <= 200,
    'HOLD_GITHUB_OIDC_RUN');
    instant(expected.run.tokenIssuedAt, 'HOLD_GITHUB_OIDC_RUN');
  }
  return expected;
}

function validateClaims(claims, expected, nowMs, maxTokenAgeMs) {
  need(claims.iss === GITHUB_OIDC_ISSUER && claims.aud === audience(expected), 'HOLD_GITHUB_OIDC_AUDIENCE');
  need(typeof claims.sub === 'string' && claims.sub.length > 0 && claims.sub.length <= 700, 'HOLD_GITHUB_OIDC_SUBJECT');
  need(claims.repository === REPOSITORY && String(claims.repository_id) === REPOSITORY_ID
    && claims.repository_owner === REPOSITORY_OWNER && String(claims.repository_owner_id) === REPOSITORY_OWNER_ID,
  'HOLD_GITHUB_OIDC_REPOSITORY');
  need(claims.ref === MAIN_REF && claims.ref_type === 'branch' && protectedRef(claims.ref_protected),
    'HOLD_GITHUB_OIDC_REF');
  need(claims.repository_visibility === 'public' && claims.runner_environment === 'github-hosted',
    'HOLD_GITHUB_OIDC_RUNNER');
  need(claims.event_name === expected.eventName, 'HOLD_GITHUB_OIDC_EVENT');
  need(claims.workflow_ref === expected.workflowRef && claims.workflow_sha === expected.workflowSha
    && claims.sha === expected.workflowSha, 'HOLD_GITHUB_OIDC_WORKFLOW');
  need(claims.job_workflow_ref === expected.jobWorkflowRef && claims.job_workflow_sha === expected.jobWorkflowSha,
    'HOLD_GITHUB_OIDC_JOB_WORKFLOW');
  need(DIGITS.test(String(claims.run_id)) && DIGITS.test(String(claims.run_attempt)) && DIGITS.test(String(claims.check_run_id)),
    'HOLD_GITHUB_OIDC_RUN');
  need(typeof claims.jti === 'string' && claims.jti.length >= 8 && claims.jti.length <= 200,
    'HOLD_GITHUB_OIDC_RUN');
  const nbf = tokenTime(claims.nbf, 'HOLD_GITHUB_OIDC_TIME');
  const iat = tokenTime(claims.iat, 'HOLD_GITHUB_OIDC_TIME');
  const exp = tokenTime(claims.exp, 'HOLD_GITHUB_OIDC_TIME');
  need(nbf <= iat && iat < exp && exp - iat <= 600000, 'HOLD_GITHUB_OIDC_TIME');
  need(nbf <= nowMs + 5000 && iat <= nowMs + 5000 && nowMs < exp && nowMs - iat <= maxTokenAgeMs,
    'HOLD_GITHUB_OIDC_EXPIRED');
  if (expected.run !== null) {
    need(String(claims.run_id) === expected.run.runId
      && String(claims.run_attempt) === expected.run.runAttempt
      && String(claims.check_run_id) === expected.run.checkRunId,
    'HOLD_GITHUB_OIDC_RUN_CONTINUITY');
    need(claims.jti !== expected.run.tokenJti && iat >= instant(expected.run.tokenIssuedAt, 'HOLD_GITHUB_OIDC_RUN'),
      'HOLD_GITHUB_OIDC_RUN_CONTINUITY');
  }
  return { nbf, iat, exp };
}

/**
 * Verifies identity tokens from a future GitHub-hosted reusable witness workflow.
 * This module never requests an OIDC token and never grants id-token permission.
 * The caller must provide a fresh normalized JWKS snapshot from GitHub's fixed
 * issuer and bind the custom audience to an exact challenge or receipt digest.
 */
export function createGitHubOidcWitnessVerifier({ now = Date.now, maxTokenAgeMs = 30000, maxJwksAgeMs = 300000 } = {}) {
  need(typeof now === 'function' && Number.isInteger(maxTokenAgeMs) && maxTokenAgeMs >= 5000 && maxTokenAgeMs <= 120000
    && Number.isInteger(maxJwksAgeMs) && maxJwksAgeMs >= 10000 && maxJwksAgeMs <= 600000,
  'HOLD_GITHUB_OIDC_CONFIG');
  let highest = -1;
  function clock() {
    const n = now();
    need(Number.isSafeInteger(n) && n >= 0 && n >= highest, 'HOLD_GITHUB_OIDC_CLOCK');
    highest = n;
    return n;
  }
  return function verifyGitHubOidcWitness(rawToken, { jwksSnapshot, expected } = {}) {
    try {
      const n = clock();
      const checked = validateExpected(expected);
      need(typeof rawToken === 'string' && rawToken.length > 0 && rawToken.length <= 20000, 'HOLD_GITHUB_OIDC_TOKEN');
      const segments = rawToken.split('.');
      need(segments.length === 3 && segments.every((segment) => segment.length > 0), 'HOLD_GITHUB_OIDC_TOKEN');
      const [encodedHeader, encodedPayload, encodedSignature] = segments;
      const header = jsonSegment(encodedHeader, 2000, 'HOLD_GITHUB_OIDC_HEADER');
      need(header.alg === 'RS256' && header.typ === 'JWT' && typeof header.kid === 'string'
        && /^[A-Za-z0-9_.-]{1,160}$/.test(header.kid), 'HOLD_GITHUB_OIDC_HEADER');
      need(jwksSnapshot && typeof jwksSnapshot === 'object' && jwksSnapshot.issuer === GITHUB_OIDC_ISSUER
        && Array.isArray(jwksSnapshot.keys) && jwksSnapshot.keys.length > 0 && jwksSnapshot.keys.length <= 8,
      'HOLD_GITHUB_OIDC_JWKS');
      const observedAt = instant(jwksSnapshot.observedAt, 'HOLD_GITHUB_OIDC_JWKS');
      const validUntil = instant(jwksSnapshot.validUntil, 'HOLD_GITHUB_OIDC_JWKS');
      need(observedAt <= n && n < validUntil && validUntil - observedAt <= maxJwksAgeMs,
        'HOLD_GITHUB_OIDC_JWKS_EXPIRED');
      const ids = jwksSnapshot.keys.map((key) => key?.kid);
      need(new Set(ids).size === ids.length, 'HOLD_GITHUB_OIDC_JWKS');
      const jwk = jwksSnapshot.keys.find((key) => key?.kid === header.kid);
      need(jwk && jwk.kty === 'RSA' && jwk.alg === 'RS256' && jwk.use === 'sig'
        && typeof jwk.n === 'string' && typeof jwk.e === 'string', 'HOLD_GITHUB_OIDC_KEY');
      const key = createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' });
      need(key.type === 'public' && key.asymmetricKeyType === 'rsa'
        && (key.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048, 'HOLD_GITHUB_OIDC_KEY');
      need(TOKEN_SEGMENT.test(encodedSignature) && encodedSignature.length <= 1024, 'HOLD_GITHUB_OIDC_SIGNATURE');
      const signature = Buffer.from(encodedSignature, 'base64url');
      need(signature.toString('base64url') === encodedSignature
        && verifySignature('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`, 'ascii'), key, signature),
      'HOLD_GITHUB_OIDC_SIGNATURE');
      const claims = jsonSegment(encodedPayload, 14000, 'HOLD_GITHUB_OIDC_CLAIMS');
      const timing = validateClaims(claims, checked, n, maxTokenAgeMs);
      const final = clock();
      // Recheck the application freshness budget, not only provider expiration.
      need(final < timing.exp && final < validUntil && final - timing.iat <= maxTokenAgeMs,
        'HOLD_GITHUB_OIDC_EXPIRED');
      return freeze({ decision: 'VERIFIED_GITHUB_OIDC_WITNESS_IDENTITY', provider: 'github-actions',
        purpose: checked.purpose, evidenceSha256: checked.evidenceSha256,
        run: { runId: String(claims.run_id), runAttempt: String(claims.run_attempt),
          checkRunId: String(claims.check_run_id), tokenJti: claims.jti,
          tokenIssuedAt: new Date(timing.iat).toISOString() },
        workflowSha: claims.workflow_sha, jobWorkflowSha: claims.job_workflow_sha,
        verifiedAt: new Date(final).toISOString(), identityAuthenticated: true,
        publicationAuthorized: false, admissionRecorded: false, enforcementActive: false });
    } catch (error) {
      return freeze({ decision: typeof error?.code === 'string' && /^HOLD_GITHUB_OIDC_[A-Z_]+$/.test(error.code)
        ? error.code : 'HOLD_GITHUB_OIDC_INVALID', identityAuthenticated: false,
        publicationAuthorized: false, admissionRecorded: false, enforcementActive: false });
    }
  };
}