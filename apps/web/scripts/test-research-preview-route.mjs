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

  for (const state of ['active', 'cancel_scheduled']) {
    const decision = await decideResearchPreviewRequest({
      request: request(protectedPath),
      environment: preview,
      readAccessToken: () => 'token',
      readAccessState: async ({ productId }) => {
        assert.equal(productId, 'research-membership');
        return { entitlement: { state } };
      },
    });
    assert.equal(decision.action, 'allow', `${protectedPath}/${state}`);
  }

  for (const state of ['pending', 'past_due', 'cancelled', 'refunded', 'disputed', 'charged_back']) {
    const decision = await decideResearchPreviewRequest({
      request: request(protectedPath),
      environment: preview,
      readAccessToken: () => 'token',
      readAccessState: async () => ({ entitlement: { state } }),
    });
    assert.equal(decision.action, 'redirect', `${protectedPath}/${state}`);
    assert.match(decision.location, /\/account\/access-required\//);
  }
}

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
