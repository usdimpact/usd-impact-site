import assert from 'node:assert/strict';
import {
  decideResearchPreviewRequest,
  decideWeeklyResearchPreviewRequest,
  isMonthlyResearchPreviewPath,
  isWeeklyResearchPreviewPath,
  isWeeklyScoreResearchPreviewPath,
  researchPreviewSurfaceForPath,
} from '../src/lib/research-preview-route.js';
import { RESEARCH_ACCESS_SURFACES } from '../src/lib/research-access-gate.js';
import { readAccountAccessState } from '../src/lib/supabase-server.js';

const request = (path, method = 'GET') => new Request(`https://preview.example${path}`, { method });
const preview = { VERCEL_ENV: 'preview' };
const production = { VERCEL_ENV: 'production' };

assert.equal(isWeeklyResearchPreviewPath('/reports/weekly/2026-08-28'), true);
assert.equal(isWeeklyResearchPreviewPath('/reports/'), false);
assert.equal(isMonthlyResearchPreviewPath('/reports/monthly/2026-08-21'), true);
assert.equal(isMonthlyResearchPreviewPath('/reports/'), false);
assert.equal(isWeeklyScoreResearchPreviewPath('/score'), true);
assert.equal(isWeeklyScoreResearchPreviewPath('/score/'), true);
assert.equal(isWeeklyScoreResearchPreviewPath('/score/history'), false);
assert.equal(researchPreviewSurfaceForPath('/reports/weekly/2026-08-28'), RESEARCH_ACCESS_SURFACES.WEEKLY_REPORT);
assert.equal(researchPreviewSurfaceForPath('/reports/monthly/2026-08-21'), RESEARCH_ACCESS_SURFACES.MONTHLY_REPORT);
assert.equal(researchPreviewSurfaceForPath('/score/'), RESEARCH_ACCESS_SURFACES.WEEKLY_SCORE);
assert.equal(researchPreviewSurfaceForPath('/news/'), null);

for (const protectedPath of ['/reports/weekly/2026-08-28', '/reports/monthly/2026-08-21', '/score/']) {
  const prodDecision = await decideResearchPreviewRequest({ request: request(protectedPath), environment: production });
  assert.equal(prodDecision.action, 'allow');
  assert.equal(prodDecision.reason, 'preview-gate-inactive');

  const noSession = await decideResearchPreviewRequest({
    request: request(protectedPath),
    environment: preview,
    readAccessToken: () => null,
  });
  assert.equal(noSession.action, 'redirect');
  assert.match(noSession.location, /\/account\/sign-in\//);
  assert.equal(new URL(noSession.location).searchParams.get('next'), protectedPath);

  for (const state of ['active']) {
    const decision = await decideResearchPreviewRequest({
      request: request(protectedPath),
      environment: preview,
      readAccessToken: () => 'token',
      readAccessState: async ({ productId }) => {
        assert.equal(productId, 'research-membership');
        return {
          allowed: true,
          profile: { status: 'active' },
          entitlement: { state, productId: 'research-membership' },
        };
      },
    });
    assert.equal(decision.action, 'allow', `${protectedPath}/${state}`);
  }

  for (const state of ['pending', 'past_due', 'cancel_scheduled', 'cancelled', 'refunded', 'disputed', 'charged_back']) {
    const decision = await decideResearchPreviewRequest({
      request: request(protectedPath),
      environment: preview,
      readAccessToken: () => 'token',
      readAccessState: async () => ({
        allowed: false,
        profile: { status: 'active' },
        entitlement: { state, productId: 'research-membership' },
      }),
    });
    assert.equal(decision.action, 'redirect', `${protectedPath}/${state}`);
    assert.match(decision.location, /\/research\/access-required\//);
  }
}

const activeEntitlement = { state: 'active', productId: 'research-membership' };
const contradictoryStates = [
  ['deletion_pending', { allowed: false, profile: { status: 'deletion_pending' }, entitlement: activeEntitlement }],
  ['deleted', { allowed: false, profile: { status: 'deleted' }, entitlement: activeEntitlement }],
  ['expired', { allowed: false, reason: 'expired', profile: { status: 'active' }, entitlement: activeEntitlement }],
  ['not_started', { allowed: false, reason: 'not-started', profile: { status: 'active' }, entitlement: activeEntitlement }],
  ['wrong_product', { allowed: true, profile: { status: 'active' }, entitlement: { ...activeEntitlement, productId: 'read-the-dollar-first-guided-interactive-edition' } }],
  ['inconsistent_deleted', { allowed: true, profile: { status: 'deleted' }, entitlement: activeEntitlement }],
  ['missing_authorization', { profile: { status: 'active' }, entitlement: activeEntitlement }],
  ['missing_profile', { allowed: true, profile: null, entitlement: activeEntitlement }],
  ['invalid_entitlement_state', { allowed: true, profile: { status: 'active' }, entitlement: { ...activeEntitlement, state: 'cancel_scheduled' } }],
];
for (const protectedPath of ['/reports/weekly/2026-08-28', '/reports/monthly/2026-08-21', '/score/']) {
  for (const [name, state] of contradictoryStates) {
    for (const method of ['GET', 'HEAD']) {
      const result = await decideResearchPreviewRequest({
        request: request(protectedPath, method),
        environment: preview,
        readAccessToken: () => 'synthetic-read-access-token',
        readAccessState: async () => state,
      });
      assert.equal(result.action, 'redirect', protectedPath + '/' + method + '/' + name);
      assert.match(result.location, /\/research\/access-required\//);
      assert.equal(new URL(result.location).searchParams.get('next'), protectedPath);
    }
  }
}
console.log('D34 Preview rejects expired/deleted/inconsistent entitlements on GET and HEAD.');

const syntheticUserId = '3a7376d0-1b53-49ba-8eb7-e4029bfdd91a';
const syntheticToken = 'synthetic-research-preview-access-token-12345678';
const syntheticConfig = {
  url: 'https://synthetic.invalid',
  publishableKey: 'sb_publishable_synthetic_not_real_abcdefghijklmnopqrstuvwxyz',
  secretKey: null,
};
async function verifiedStateFromSyntheticSupabase({ profileStatus, endsAt }) {
  const fetchImpl = async (url) => {
    const target = String(url);
    let payload;
    if (target.endsWith('/auth/v1/user')) {
      payload = {
        id: syntheticUserId,
        email: 'reader@invalid.example',
        email_confirmed_at: '2026-10-01T00:00:00Z',
      };
    } else if (target.includes('/rest/v1/profiles?')) {
      payload = [{ account_id: syntheticUserId, status: profileStatus }];
    } else if (target.includes('/rest/v1/entitlements?')) {
      payload = [{
        id: 'synthetic-preview-entitlement',
        account_id: syntheticUserId,
        product_id: 'research-membership',
        state: 'active',
        starts_at: '2026-10-01T00:00:00Z',
        ends_at: endsAt,
        version: 1,
        updated_at: '2026-10-01T00:00:00Z',
      }];
    } else {
      throw Error('Unexpected external request ' + target);
    }
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  return readAccountAccessState({
    accessToken: syntheticToken,
    productId: 'research-membership',
    config: syntheticConfig,
    fetchImpl,
    nowMs: Date.parse('2026-11-05T12:00:00Z'),
  });
}
const expiredState = await verifiedStateFromSyntheticSupabase({
  profileStatus: 'active',
  endsAt: '2026-11-04T00:00:00Z',
});
assert.equal(expiredState.allowed, false);
assert.equal(expiredState.reason, 'expired');

const deletedState = await verifiedStateFromSyntheticSupabase({
  profileStatus: 'deleted',
  endsAt: '2026-12-04T00:00:00Z',
});
assert.equal(deletedState.allowed, false);
assert.equal(deletedState.reason, 'deleted');

const activeState = await verifiedStateFromSyntheticSupabase({
  profileStatus: 'active',
  endsAt: '2026-12-04T00:00:00Z',
});
assert.equal(activeState.allowed, true);
for (const [name, state, expected] of [
  ['expired', expiredState, 'redirect'],
  ['deleted', deletedState, 'redirect'],
  ['valid', activeState, 'allow'],
]) {
  const result = await decideResearchPreviewRequest({
    request: request('/score/'),
    environment: preview,
    readAccessToken: () => syntheticToken,
    readAccessState: async () => state,
  });
  assert.equal(result.action, expected, name);
}
console.log('D34 Preview honors real readAccountAccessState expired/deleted/valid results.');

const missingEntitlement = await decideResearchPreviewRequest({
  request: request('/score/'),
  environment: preview,
  readAccessToken: () => 'token',
  readAccessState: async () => ({ entitlement: null }),
});
assert.equal(missingEntitlement.action, 'redirect');

const serviceFailure = await decideResearchPreviewRequest({
  request: request('/score/'),
  environment: preview,
  readAccessToken: () => 'token',
  readAccessState: async () => { throw new Error('unavailable'); },
});
assert.equal(serviceFailure.action, 'redirect');

const unrelated = await decideResearchPreviewRequest({
  request: request('/news/'),
  environment: preview,
  readAccessToken: () => null,
});
assert.equal(unrelated.action, 'allow');
assert.equal(unrelated.reason, 'preview-gate-inactive');

const legacyAlias = await decideWeeklyResearchPreviewRequest({
  request: request('/reports/weekly/2026-08-28'),
  environment: production,
});
assert.equal(legacyAlias.action, 'allow');

console.log('Research Preview route guard matrix passed for Weekly Reports, Monthly Reports, and Weekly Score.');
