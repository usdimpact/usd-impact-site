import {
  RESEARCH_MEMBERSHIP_STATES,
  researchMembershipEntitlementDecision,
} from './research-membership-runtime.js';

export const RESEARCH_ACCESS_SURFACES = Object.freeze({
  WEEKLY_REPORT: 'weekly-report',
  WEEKLY_ARCHIVE: 'weekly-archive',
  WEEKLY_SCORE: 'weekly-score',
  WEEKLY_SCORE_HISTORY: 'weekly-score-history',
  WEEKLY_SCORE_BREAKDOWN: 'weekly-score-breakdown',
  MONTHLY_REPORT: 'monthly-report',
  RESEARCH_KNOWLEDGE: 'research-knowledge',
});

const VALID_SURFACES = new Set(Object.values(RESEARCH_ACCESS_SURFACES));

function normalizeSurface(surface) {
  const value = typeof surface === 'string' ? surface.trim() : '';
  if (!VALID_SURFACES.has(value)) {
    throw new TypeError('surface is not a supported Research Membership surface.');
  }
  return value;
}

function validNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${fieldName} must be a non-negative integer.`);
  }
  return value;
}

export function resolveResearchAccess({
  surface,
  subscriptionState,
  publicSampleApproved = false,
  reportAgeDays = null,
  publicSampleMinAgeDays = 30,
} = {}) {
  const normalizedSurface = normalizeSurface(surface);
  const entitlement = researchMembershipEntitlementDecision(subscriptionState);

  if (publicSampleApproved) {
    if (normalizedSurface !== RESEARCH_ACCESS_SURFACES.WEEKLY_REPORT) {
      throw new TypeError('Public sample approval is valid only for a Weekly Report surface.');
    }
    const age = validNonNegativeInteger(reportAgeDays, 'reportAgeDays');
    const minimumAge = validNonNegativeInteger(publicSampleMinAgeDays, 'publicSampleMinAgeDays');
    if (age >= minimumAge) {
      return Object.freeze({
        allowed: true,
        reason: 'approved-public-sample',
        surface: normalizedSurface,
        subscriptionState,
      });
    }
  }

  if (entitlement.entitled) {
    return Object.freeze({
      allowed: true,
      reason: subscriptionState === RESEARCH_MEMBERSHIP_STATES.CANCEL_SCHEDULED
        ? 'paid-through-current-period'
        : 'active-research-membership',
      surface: normalizedSurface,
      subscriptionState,
    });
  }

  return Object.freeze({
    allowed: false,
    reason: 'research-membership-required',
    surface: normalizedSurface,
    subscriptionState,
  });
}

export function assertResearchAccess(options) {
  const decision = resolveResearchAccess(options);
  if (!decision.allowed) {
    const error = new Error('Research Membership access required.');
    error.code = 'RESEARCH_MEMBERSHIP_ACCESS_REQUIRED';
    error.status = 403;
    error.decision = decision;
    throw error;
  }
  return decision;
}
