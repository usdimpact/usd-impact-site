import assert from 'node:assert/strict';
import {
  RESEARCH_ACCESS_SURFACES,
  assertResearchAccess,
  resolveResearchAccess,
} from '../src/lib/research-access-gate.js';

const entitledStates = ['active', 'cancel_scheduled'];
const deniedStates = ['pending', 'past_due', 'cancelled', 'refunded', 'disputed', 'charged_back'];
const surfaces = Object.values(RESEARCH_ACCESS_SURFACES);

for (const surface of surfaces) {
  for (const state of entitledStates) {
    const decision = resolveResearchAccess({ surface, subscriptionState: state });
    assert.equal(decision.allowed, true, `${surface}/${state} should be allowed`);
  }

  for (const state of deniedStates) {
    const decision = resolveResearchAccess({ surface, subscriptionState: state });
    assert.equal(decision.allowed, false, `${surface}/${state} should fail closed`);
    assert.equal(decision.reason, 'research-membership-required');
  }
}

const paidThrough = resolveResearchAccess({
  surface: RESEARCH_ACCESS_SURFACES.WEEKLY_SCORE,
  subscriptionState: 'cancel_scheduled',
});
assert.equal(paidThrough.reason, 'paid-through-current-period');

const approvedSample = resolveResearchAccess({
  surface: RESEARCH_ACCESS_SURFACES.WEEKLY_REPORT,
  subscriptionState: 'cancelled',
  publicSampleApproved: true,
  reportAgeDays: 30,
  publicSampleMinAgeDays: 30,
});
assert.equal(approvedSample.allowed, true);
assert.equal(approvedSample.reason, 'approved-public-sample');

const tooFreshSample = resolveResearchAccess({
  surface: RESEARCH_ACCESS_SURFACES.WEEKLY_REPORT,
  subscriptionState: 'cancelled',
  publicSampleApproved: true,
  reportAgeDays: 29,
  publicSampleMinAgeDays: 30,
});
assert.equal(tooFreshSample.allowed, false);

assert.throws(
  () => resolveResearchAccess({
    surface: RESEARCH_ACCESS_SURFACES.WEEKLY_SCORE,
    subscriptionState: 'cancelled',
    publicSampleApproved: true,
    reportAgeDays: 45,
  }),
  /Public sample approval is valid only for a Weekly Report surface/,
);

assert.throws(
  () => assertResearchAccess({
    surface: RESEARCH_ACCESS_SURFACES.RESEARCH_KNOWLEDGE,
    subscriptionState: 'refunded',
  }),
  (error) => error?.code === 'RESEARCH_MEMBERSHIP_ACCESS_REQUIRED' && error?.status === 403,
);

console.log('Research Membership access gate matrix passed.');
