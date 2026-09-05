import assert from 'node:assert/strict';
import { decideWeeklyResearchPreviewRequest, isWeeklyResearchPreviewPath } from '../src/lib/research-preview-route.js';

const request = (path, method = 'GET') => new Request(`https://preview.example${path}`, { method });
const preview = { VERCEL_ENV: 'preview' };
const production = { VERCEL_ENV: 'production' };

assert.equal(isWeeklyResearchPreviewPath('/reports/weekly/2026-08-28'), true);
assert.equal(isWeeklyResearchPreviewPath('/reports/'), false);

const prodDecision = await decideWeeklyResearchPreviewRequest({ request: request('/reports/weekly/2026-08-28'), environment: production });
assert.equal(prodDecision.action, 'allow');
assert.equal(prodDecision.reason, 'preview-gate-inactive');

const noSession = await decideWeeklyResearchPreviewRequest({
  request: request('/reports/weekly/2026-08-28'),
  environment: preview,
  readAccessToken: () => null,
});
assert.equal(noSession.action, 'redirect');
assert.match(noSession.location, /\/account\/sign-in\//);

for (const state of ['active', 'cancel_scheduled']) {
  const decision = await decideWeeklyResearchPreviewRequest({
    request: request('/reports/weekly/2026-08-28'),
    environment: preview,
    readAccessToken: () => 'token',
    readAccessState: async () => ({ entitlement: { state } }),
  });
  assert.equal(decision.action, 'allow', state);
}

for (const state of ['pending', 'past_due', 'cancelled', 'refunded', 'disputed', 'charged_back']) {
  const decision = await decideWeeklyResearchPreviewRequest({
    request: request('/reports/weekly/2026-08-28'),
    environment: preview,
    readAccessToken: () => 'token',
    readAccessState: async () => ({ entitlement: { state } }),
  });
  assert.equal(decision.action, 'redirect', state);
  assert.match(decision.location, /\/account\/access-required\//);
}

const missingEntitlement = await decideWeeklyResearchPreviewRequest({
  request: request('/reports/weekly/2026-08-28'),
  environment: preview,
  readAccessToken: () => 'token',
  readAccessState: async () => ({ entitlement: null }),
});
assert.equal(missingEntitlement.action, 'redirect');

const serviceFailure = await decideWeeklyResearchPreviewRequest({
  request: request('/reports/weekly/2026-08-28'),
  environment: preview,
  readAccessToken: () => 'token',
  readAccessState: async () => { throw new Error('unavailable'); },
});
assert.equal(serviceFailure.action, 'redirect');

console.log('Research Preview route guard matrix passed.');
