// Draft-only WIF identity verification for one manually approved GitHub Actions run.
// No Messages API call, model input, task content, GitHub write, or persistent token.
import { pathToFileURL } from 'node:url';

export const REPOSITORY = 'usdimpact/usd-impact-site';
export const WORKFLOW_REF =
  'usdimpact/usd-impact-site/.github/workflows/usd-impact-claude-issue-review.yml@refs/heads/main';
export const RULE_ID = 'fdrl_0155aihurC9hFwhp4qeVBv6m';
export const SERVICE_ACCOUNT_ID = 'svac_01XaAxLMutnfzNuK5KCNwayu';
export const ORGANIZATION_ID = 'dc187cb9-51e9-4059-a01f-1d2f5ea0b2b2';
export const OPTIONAL_WORKSPACE_ID = 'wrkspc_013c8nMSXXPc8sVBvSKbtnFZ';
export const CONFIRMATION = 'I_APPROVE_ONE_FREE_IDENTITY_EXCHANGE';
const OIDC_AUDIENCE = 'https://api.anthropic.com';
const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
const OAUTH_URL = 'https://api.anthropic.com/v1/oauth/token';
const NUMERIC = /^[1-9][0-9]{0,8}$/;
const SHA40 = /^[0-9a-f]{40}$/;

function hold(test, reason) {
  if (!test) throw new Error(reason);
}

// All security conditions are checked before requesting a GitHub OIDC token.
export function requireIdentityCheckApproval(env) {
  hold(env && typeof env === 'object', 'IDENTITY_CONTEXT_HOLD');
  hold(env.GITHUB_REPOSITORY === REPOSITORY &&
    env.GITHUB_REF === 'refs/heads/main' &&
    env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    env.GITHUB_WORKFLOW_REF === WORKFLOW_REF &&
    typeof env.GITHUB_SHA === 'string' && SHA40.test(env.GITHUB_SHA), 'WORKFLOW_IDENTITY_HOLD');
  hold(env.ISSUE_NUMBER === '1193' && env.MODE === 'identity_check', 'SYNTHETIC_FIXTURE_ONLY');
  hold(env.IDENTITY_CHECK_CONFIRMATION === CONFIRMATION, 'OWNER_CONFIRMATION_MISSING');
  hold(env.BILLING_READY === '' || env.BILLING_READY === 'no', 'MODEL_BILLING_MUST_BE_OFF');
  hold(env.GITHUB_RUN_ATTEMPT === '1' &&
    typeof env.APPROVED_IDENTITY_RUN_NUMBER === 'string' &&
    NUMERIC.test(env.APPROVED_IDENTITY_RUN_NUMBER) &&
    env.APPROVED_IDENTITY_RUN_NUMBER === env.GITHUB_RUN_NUMBER, 'ONE_SHOT_IDENTITY_RUN_NOT_APPROVED');
  hold(env.FEDERATION_RULE_ID === RULE_ID &&
    env.ANTHROPIC_ORGANIZATION_ID === ORGANIZATION_ID &&
    env.ANTHROPIC_SERVICE_ACCOUNT_ID === SERVICE_ACCOUNT_ID &&
    (!env.ANTHROPIC_WORKSPACE_ID || env.ANTHROPIC_WORKSPACE_ID === OPTIONAL_WORKSPACE_ID),
    'PINNED_FEDERATION_CONFIG_HOLD');
  hold(typeof env.ACTIONS_ID_TOKEN_REQUEST_URL === 'string' &&
    typeof env.ACTIONS_ID_TOKEN_REQUEST_TOKEN === 'string' &&
    env.ACTIONS_ID_TOKEN_REQUEST_TOKEN.length > 10, 'OIDC_UNAVAILABLE');
  let url;
  try { url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL); }
  catch { throw new Error('OIDC_ENDPOINT_HOLD'); }
  hold(url.protocol === 'https:' &&
    url.hostname.endsWith('.actions.githubusercontent.com') &&
    !url.username && !url.password && !url.port && !url.hash,
    'OIDC_ENDPOINT_HOLD');
  url.searchParams.set('audience', OIDC_AUDIENCE);
  return Object.freeze({ oidc_url: url.toString() });
}

export function verifyOidcClaims(claims, now = Math.floor(Date.now() / 1000)) {
  hold(claims && typeof claims === 'object' && !Array.isArray(claims), 'OIDC_CLAIMS_HOLD');
  const expected = {
    iss: GITHUB_ISSUER,
    aud: OIDC_AUDIENCE,
    sub: `repo:${REPOSITORY}:ref:refs/heads/main`,
    repository_owner: 'usdimpact',
    repository_owner_id: '275107298',
    repository: REPOSITORY,
    repository_id: '1265351071',
    ref: 'refs/heads/main',
    event_name: 'workflow_dispatch',
    workflow_ref: WORKFLOW_REF,
  };
  for (const [key, value] of Object.entries(expected)) {
    hold(claims[key] === value, 'OIDC_CLAIMS_HOLD');
  }
  hold(Number.isSafeInteger(claims.iat) && Number.isSafeInteger(claims.exp) &&
    claims.iat <= now + 30 && claims.exp > now && claims.exp <= now + 900,
    'OIDC_TIME_HOLD');
  // Local claim decoding is not signature validation: Anthropic verifies JWT/JWKS.
  return true;
}

function parseJwtPayload(jwt) {
  hold(typeof jwt === 'string' && jwt.length <= 12000 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt), 'OIDC_TOKEN_HOLD');
  try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')); }
  catch { throw new Error('OIDC_TOKEN_HOLD'); }
}

async function requestJson(url, init, reason) {
  let res;
  try { res = await fetch(url, { ...init, signal: AbortSignal.timeout(12000), redirect: 'error' }); }
  catch { throw new Error(reason); }
  hold(res.ok, reason);
  let raw;
  try { raw = await res.text(); }
  catch { throw new Error(reason); }
  hold(raw.length <= 15000, reason);
  try { return JSON.parse(raw); }
  catch { throw new Error(reason); }
}

export async function performFreeIdentityExchange(env, now = Math.floor(Date.now() / 1000)) {
  const approved = requireIdentityCheckApproval(env);
  const oidc = await requestJson(approved.oidc_url, {
    headers: { Authorization: 'Bearer ' + env.ACTIONS_ID_TOKEN_REQUEST_TOKEN },
  }, 'OIDC_FETCH_HOLD');
  const claims = parseJwtPayload(oidc.value);
  verifyOidcClaims(claims, now);

  // Exactly one OAuth exchange; no Messages API, model call, or token output.
  const exchanged = await requestJson(OAUTH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: oidc.value,
      federation_rule_id: RULE_ID,
      organization_id: ORGANIZATION_ID,
      service_account_id: SERVICE_ACCOUNT_ID,
      ...(env.ANTHROPIC_WORKSPACE_ID ? { workspace_id: env.ANTHROPIC_WORKSPACE_ID } : {}),
    }),
  }, 'ANTHROPIC_WIF_EXCHANGE_HOLD');
  hold(typeof exchanged.access_token === 'string' &&
    exchanged.access_token.startsWith('sk-ant-oat01-') &&
    exchanged.token_type === 'Bearer' &&
    Number.isSafeInteger(exchanged.expires_in) && exchanged.expires_in >= 60,
    'ANTHROPIC_TOKEN_RESPONSE_HOLD');
  // Do not return, print, cache or persist the Anthropic access token.
  return Object.freeze({
    result: 'IDENTITY_EXCHANGE_PASS',
    model_requests: 0,
    token_discarded: true,
    request_count: 2,
    side_effects: 'NONE',
  });
}

export async function cli(env = process.env) {
  const report = await performFreeIdentityExchange(env);
  console.log(report.result);
  console.log('MODEL_REQUESTS=0');
  console.log('TOKEN_DISCARDED=true');
  console.log('NO_MESSAGES_API_OR_REPOSITORY_WRITES');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch(error => {
    // Only controlled, non-sensitive error codes reach the GitHub logs.
    const allowed = new Set([
      'IDENTITY_CONTEXT_HOLD', 'WORKFLOW_IDENTITY_HOLD', 'SYNTHETIC_FIXTURE_ONLY',
      'OWNER_CONFIRMATION_MISSING', 'MODEL_BILLING_MUST_BE_OFF',
      'ONE_SHOT_IDENTITY_RUN_NOT_APPROVED', 'PINNED_FEDERATION_CONFIG_HOLD',
      'OIDC_UNAVAILABLE', 'OIDC_ENDPOINT_HOLD', 'OIDC_CLAIMS_HOLD',
      'OIDC_TIME_HOLD', 'OIDC_TOKEN_HOLD', 'OIDC_FETCH_HOLD',
      'ANTHROPIC_WIF_EXCHANGE_HOLD', 'ANTHROPIC_TOKEN_RESPONSE_HOLD',
    ]);
    console.error(allowed.has(error?.message) ? error.message : 'UNEXPECTED_IDENTITY_CHECK_HOLD');
    process.exitCode = 1;
  });
}
