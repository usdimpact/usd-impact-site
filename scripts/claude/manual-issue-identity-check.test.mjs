import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REPOSITORY, WORKFLOW_REF, RULE_ID, SERVICE_ACCOUNT_ID, ORGANIZATION_ID,
  OPTIONAL_WORKSPACE_ID, CONFIRMATION, requireIdentityCheckApproval,
  verifyOidcClaims, performFreeIdentityExchange,
} from './manual-issue-identity-check.mjs';

const NOW = Math.floor(Date.now() / 1000);
const makeEnv = (patch = {}) => ({
  GITHUB_REPOSITORY: REPOSITORY,
  GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_WORKFLOW_REF: WORKFLOW_REF,
  GITHUB_SHA: 'a'.repeat(40),
  GITHUB_RUN_NUMBER: '2',
  GITHUB_RUN_ATTEMPT: '1',
  ISSUE_NUMBER: '1193',
  MODE: 'identity_check',
  IDENTITY_CHECK_CONFIRMATION: CONFIRMATION,
  BILLING_READY: '',
  APPROVED_IDENTITY_RUN_NUMBER: '2',
  FEDERATION_RULE_ID: RULE_ID,
  ANTHROPIC_ORGANIZATION_ID: ORGANIZATION_ID,
  ANTHROPIC_SERVICE_ACCOUNT_ID: SERVICE_ACCOUNT_ID,
  ANTHROPIC_WORKSPACE_ID: '',
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://pipelines.actions.githubusercontent.com/oidc?foo=bar',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'synthetic-actions-token',
  ...patch,
});
const claims = (patch = {}) => ({
  iss: 'https://token.actions.githubusercontent.com',
  aud: 'https://api.anthropic.com',
  sub: `repo:${REPOSITORY}:ref:refs/heads/main`,
  repository_owner: 'usdimpact', repository_owner_id: '275107298',
  repository: REPOSITORY, repository_id: '1265351071', ref: 'refs/heads/main',
  event_name: 'workflow_dispatch', workflow_ref: WORKFLOW_REF,
  iat: NOW - 2, exp: NOW + 300, ...patch,
});
const jwt = (payload = claims()) =>
  'a.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.b';
const ok = x => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
function hold(input, code) {
  assert.throws(() => requireIdentityCheckApproval(input), x => x.message === code);
}

// No tests use a real GitHub, Anthropic, or credential endpoint.
test('one pinned, manually authorized, first-attempt synthetic run is accepted for IDENTITY ONLY', () => {
  const e = makeEnv();
  const validated = requireIdentityCheckApproval(e);
  assert.ok(validated.oidc_url.startsWith('https://pipelines.actions.githubusercontent.com/oidc?'));
  assert.ok(validated.oidc_url.includes('audience=https%3A%2F%2Fapi.anthropic.com'));
  assert.equal(Object.hasOwn(validated, 'token'), false);
});

test('preflight, model_review, any other mode and other issues are excluded', () => {
  for (const mode of ['preflight', 'model_review', '', 'admin']) hold(makeEnv({ MODE: mode }), 'SYNTHETIC_FIXTURE_ONLY');
  for (const n of ['950', '1', '1194', '0001193']) hold(makeEnv({ ISSUE_NUMBER: n }), 'SYNTHETIC_FIXTURE_ONLY');
});

test('approval confirmation is separate from paid model phrase', () => {
  for (const s of ['', 'I_APPROVE_ONE_CLAUDE_ISSUE_REVIEW', 'approve', 'I_APPROVE_ONE_FREE_IDENTITY_EXCHANGE ']) {
    hold(makeEnv({ IDENTITY_CHECK_CONFIRMATION: s }), 'OWNER_CONFIRMATION_MISSING');
  }
});

test('explicit or absent billing-off state is required, never enabled', () => {
  assert.ok(requireIdentityCheckApproval(makeEnv({ BILLING_READY: 'no' })));
  for (const s of ['yes', 'true', '1', 'NO']) hold(makeEnv({ BILLING_READY: s }), 'MODEL_BILLING_MUST_BE_OFF');
});

test('run number is pinned and rerun attempts are rejected', () => {
  for (const s of ['1', '3', '', '2.0', '0002']) {
    hold(makeEnv({ APPROVED_IDENTITY_RUN_NUMBER: s }), 'ONE_SHOT_IDENTITY_RUN_NOT_APPROVED');
  }
  hold(makeEnv({ GITHUB_RUN_ATTEMPT: '2' }), 'ONE_SHOT_IDENTITY_RUN_NOT_APPROVED');
});

test('the GitHub runner repository, exact branch and event are mandatory', () => {
  for (const [key, value] of [
    ['GITHUB_REPOSITORY', 'other/repo'], ['GITHUB_REF', 'refs/heads/dev'],
    ['GITHUB_EVENT_NAME', 'push'], ['GITHUB_SHA', 'f'.repeat(39)],
    ['GITHUB_WORKFLOW_REF', 'usdimpact/usd-impact-site/.github/workflows/other.yml@refs/heads/main'],
  ]) hold(makeEnv({ [key]: value }), 'WORKFLOW_IDENTITY_HOLD');
});

test('new rule, organization and service account IDs are independently pinned', () => {
  for (const [key, value] of [
    ['FEDERATION_RULE_ID', 'fdrl_other'], ['FEDERATION_RULE_ID', 'fdrl_01HRiH1Y7tmwsGPydotJ3UrG'],
    ['ANTHROPIC_ORGANIZATION_ID', '00000000-0000-0000-0000-000000000000'],
    ['ANTHROPIC_SERVICE_ACCOUNT_ID', 'svac_015zgd3YiZFNcYepAd3gyT85'],
  ]) hold(makeEnv({ [key]: value }), 'PINNED_FEDERATION_CONFIG_HOLD');
});

test('one verified workspace ID may be supplied; other workspace IDs fail closed', () => {
  assert.ok(requireIdentityCheckApproval(makeEnv({ ANTHROPIC_WORKSPACE_ID: OPTIONAL_WORKSPACE_ID })));
  hold(makeEnv({ ANTHROPIC_WORKSPACE_ID: 'wrkspc_other' }), 'PINNED_FEDERATION_CONFIG_HOLD');
});

test('GitHub request token must exist before making an outbound request', () => {
  hold(makeEnv({ ACTIONS_ID_TOKEN_REQUEST_TOKEN: '' }), 'OIDC_UNAVAILABLE');
  hold(makeEnv({ ACTIONS_ID_TOKEN_REQUEST_URL: '' }), 'OIDC_ENDPOINT_HOLD');
});

test('OIDC endpoint is pinned to HTTPS GitHub Actions subdomain', () => {
  for (const url of [
    'http://pipelines.actions.githubusercontent.com/path',
    'https://actions.githubusercontent.com.attacker.invalid/oidc',
    'https://api.anthropic.com/v1/messages',
    'https://attacker@pipelines.actions.githubusercontent.com/oidc',
    'https://pipelines.actions.githubusercontent.com:8443/oidc',
  ]) hold(makeEnv({ ACTIONS_ID_TOKEN_REQUEST_URL: url }), 'OIDC_ENDPOINT_HOLD');
});

test('OIDC JWT must pin exact issuer, audience, repository and workflow identity', () => {
  for (const [key, val] of [
    ['iss', 'https://attacker.invalid'], ['aud', 'other'], ['sub', 'other'],
    ['repository_owner', 'attacker'], ['repository_owner_id', '1'],
    ['repository', 'different/repo'], ['repository_id', '11'],
    ['ref', 'refs/heads/dev'], ['event_name', 'push'],
    ['workflow_ref', 'different.yml'],
  ]) assert.throws(() => verifyOidcClaims(claims({ [key]: val }), NOW), /OIDC_CLAIMS_HOLD/);
  assert.equal(verifyOidcClaims(claims(), NOW), true);
});

test('stale or future-issued identity JWTs are rejected', () => {
  for (const bad of [
    { exp: NOW - 1 }, { iat: NOW + 31 }, { exp: NOW + 4000 },
    { exp: 'never' }, { iat: 'now' },
  ]) assert.throws(() => verifyOidcClaims(claims(bad), NOW), /OIDC_TIME_HOLD/);
});

test('no API request can occur before the owner/run gates pass', async () => {
  const original = globalThis.fetch;
  let count = 0;
  globalThis.fetch = () => { count++; throw Error('Unexpected network'); };
  try {
    await assert.rejects(performFreeIdentityExchange(makeEnv({ APPROVED_IDENTITY_RUN_NUMBER: '' }), NOW), /ONE_SHOT_IDENTITY_RUN_NOT_APPROVED/);
    assert.equal(count, 0);
  } finally { globalThis.fetch = original; }
});

test('verified GitHub -> Anthropic token exchange makes exactly two requests, no Messages call', async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (requests.length === 1) return ok({ value: jwt() });
    if (requests.length === 2) return ok({ access_token: 'sk-ant-oat01-synthetic-fake-test-token', token_type: 'Bearer', expires_in: 600 });
    throw Error('Unexpected third network call');
  };
  try {
    const result = await performFreeIdentityExchange(makeEnv(), NOW);
    assert.deepEqual(result, { result: 'IDENTITY_EXCHANGE_PASS', model_requests: 0,
      token_discarded: true, request_count: 2, side_effects: 'NONE' });
    assert.equal(requests.length, 2);
    assert.equal(new URL(requests[0].url).hostname, 'pipelines.actions.githubusercontent.com');
    assert.equal(requests[1].url, 'https://api.anthropic.com/v1/oauth/token');
    assert.equal(requests[1].init.method, 'POST');
    const body = JSON.parse(requests[1].init.body);
    assert.equal(body.federation_rule_id, RULE_ID);
    assert.equal(body.organization_id, ORGANIZATION_ID);
    assert.equal(body.service_account_id, SERVICE_ACCOUNT_ID);
    assert.equal(Object.hasOwn(body, 'workspace_id'), false);
    assert.ok(!JSON.stringify(result).includes('sk-ant-'));
    assert.ok(!requests.some(x => x.url.includes('/v1/messages')));
  } finally { globalThis.fetch = original; }
});

test('wrong OIDC claims fail before Anthropic exchange', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return ok({ value: jwt(claims({ event_name: 'push' })) }); };
  try { await assert.rejects(performFreeIdentityExchange(makeEnv(), NOW), /OIDC_CLAIMS_HOLD/); assert.equal(calls, 1); }
  finally { globalThis.fetch = original; }
});

test('malformed OIDC JWT fails before Anthropic exchange', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return ok({ value: 'not-a-jwt' }); };
  try { await assert.rejects(performFreeIdentityExchange(makeEnv(), NOW), /OIDC_TOKEN_HOLD/); assert.equal(calls, 1); }
  finally { globalThis.fetch = original; }
});

test('Anthropic HTTP or invalid response cannot be considered success', async () => {
  const original = globalThis.fetch;
  for (const invalid of [
    new Response('unavailable', { status: 403 }),
    ok({ access_token: '', token_type: 'Bearer', expires_in: 600 }),
    ok({ access_token: 'sk-ant-oat01-test', token_type: 'unknown', expires_in: 600 }),
    ok({ access_token: 'sk-ant-oat01-test', token_type: 'Bearer', expires_in: 20 }),
  ]) {
    let calls = 0;
    globalThis.fetch = async () => ++calls === 1 ? ok({ value: jwt() }) : invalid;
    await assert.rejects(performFreeIdentityExchange(makeEnv(), NOW), /ANTHROPIC_/);
    assert.equal(calls, 2);
  }
  globalThis.fetch = original;
});

test('network failure is fail-closed without exposing bearer tokens', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('PRIVATE_TEST_TOKEN_DO_NOT_LOG'); };
  try {
    await assert.rejects(performFreeIdentityExchange(makeEnv(), NOW), e =>
      e.message === 'OIDC_FETCH_HOLD' && !e.message.includes('PRIVATE_TEST_TOKEN'));
  } finally { globalThis.fetch = original; }
});
