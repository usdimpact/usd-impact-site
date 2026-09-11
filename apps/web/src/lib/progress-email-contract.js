import { buildWeeklyNewsletterPayload } from './weekly-newsletter-contract.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_PROGRESS_EMAIL_INTERVAL_MS = 7 * DAY_MS;
const WEEKLY_NEWSLETTER_PRIORITY_WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_INACTIVE_DAYS = 44;
const SITE_ORIGIN = 'https://www.usd-impact.com';
const ALLOWED_CHANGE_KINDS = new Set([
  'weekly_report',
  'weekly_score',
  'learning_content',
  'research',
  'report',
  'platform',
]);
const ALLOWED_PRIORITIES = new Set(['P2', 'P3']);

export const PROGRESS_EMAIL_MESSAGE_ID = 'learning_progress_update';
export const PROGRESS_EMAIL_CONSENT_PURPOSE = 'learning_progress_updates';
export const PROGRESS_EMAIL_TEMPLATE_VERSION = 'learning-progress-email-v1';

export class ProgressEmailContractError extends Error {
  constructor(message, code = 'PROGRESS_EMAIL_CONTRACT_INVALID') {
    super(message);
    this.name = 'ProgressEmailContractError';
    this.code = code;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new ProgressEmailContractError(`${field} is required.`, 'INVALID_PROGRESS_EMAIL_INPUT');
  return normalized;
}

function timestamp(value, field, { optional = false } = {}) {
  if ((value === null || value === undefined || value === '') && optional) return null;
  const raw = requireString(value, field);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new ProgressEmailContractError(`${field} must be a valid timestamp.`, 'INVALID_PROGRESS_EMAIL_TIMESTAMP');
  }
  return parsed;
}

function canonicalSiteUrl(value, field) {
  const raw = requireString(value, field);
  let parsed;
  try {
    parsed = new URL(raw, SITE_ORIGIN);
  } catch {
    throw new ProgressEmailContractError(`${field} must be a valid URL.`, 'INVALID_PROGRESS_EMAIL_URL');
  }
  if (
    parsed.origin !== SITE_ORIGIN
    || parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
  ) {
    throw new ProgressEmailContractError(`${field} must resolve to the canonical USD Impact site.`, 'NON_CANONICAL_PROGRESS_EMAIL_URL');
  }
  parsed.hash = '';
  return parsed.toString();
}

function nonNegativeInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new ProgressEmailContractError(`${field} must be a non-negative integer.`, 'INVALID_LEARNING_JOURNEY');
  }
  return number;
}

function selectCohort(daysInactive) {
  if (daysInactive >= 30 && daysInactive <= MAX_INACTIVE_DAYS) return 'inactive_30d';
  if (daysInactive >= 14) return 'inactive_14d';
  if (daysInactive >= 7) return 'inactive_7d';
  return null;
}

function normalizeChange(change, index, lastSignInMs) {
  if (!isObject(change)) {
    throw new ProgressEmailContractError(`meaningfulChanges[${index}] must be an object.`, 'INVALID_MEANINGFUL_CHANGE');
  }
  const kind = requireString(change.kind, `meaningfulChanges[${index}].kind`);
  const priority = requireString(change.priority, `meaningfulChanges[${index}].priority`).toUpperCase();
  if (!ALLOWED_CHANGE_KINDS.has(kind)) {
    throw new ProgressEmailContractError(`meaningfulChanges[${index}].kind is unsupported.`, 'INVALID_MEANINGFUL_CHANGE');
  }
  if (!ALLOWED_PRIORITIES.has(priority)) {
    throw new ProgressEmailContractError(
      `meaningfulChanges[${index}].priority must be P2 or P3 for lifecycle marketing.`,
      'INVALID_MEANINGFUL_CHANGE_PRIORITY',
    );
  }
  const occurredAt = timestamp(change.occurredAt, `meaningfulChanges[${index}].occurredAt`);
  return {
    kind,
    priority,
    title: requireString(change.title, `meaningfulChanges[${index}].title`),
    occurredAt: new Date(occurredAt).toISOString(),
    url: canonicalSiteUrl(change.url, `meaningfulChanges[${index}].url`),
    afterLastSignIn: occurredAt > lastSignInMs,
  };
}

function suppressed(reason, details = {}) {
  return deepFreeze({ eligible: false, action: 'suppress', reason, ...details });
}

export function evaluateProgressEmailEligibility({
  now = new Date().toISOString(),
  lastSignInAt,
  lastProgressEmailAt = null,
  lastWeeklyNewsletterAt = null,
  accountEligible = false,
  consentActive = false,
  providerSuppressed = false,
  meaningfulChanges = [],
} = {}) {
  if (!accountEligible) return suppressed('account_not_eligible');
  if (!consentActive) return suppressed('consent_not_granted');
  if (providerSuppressed) return suppressed('provider_suppressed');

  const nowMs = timestamp(now, 'now');
  const lastSignInMs = timestamp(lastSignInAt, 'lastSignInAt');
  if (lastSignInMs > nowMs) return suppressed('last_sign_in_in_future');

  const daysInactive = Math.floor((nowMs - lastSignInMs) / DAY_MS);
  if (daysInactive < 7) return suppressed('inactive_too_short', { daysInactive });
  if (daysInactive > MAX_INACTIVE_DAYS) return suppressed('inactive_window_expired', { daysInactive });

  const cohort = selectCohort(daysInactive);
  if (!cohort) return suppressed('no_inactivity_cohort', { daysInactive });

  if (!Array.isArray(meaningfulChanges)) {
    throw new ProgressEmailContractError('meaningfulChanges must be an array.', 'INVALID_MEANINGFUL_CHANGES');
  }
  const normalizedChanges = meaningfulChanges
    .map((change, index) => normalizeChange(change, index, lastSignInMs))
    .filter((change) => change.afterLastSignIn)
    .map(({ afterLastSignIn, ...change }) => change)
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority.localeCompare(right.priority);
      return right.occurredAt.localeCompare(left.occurredAt);
    });

  if (normalizedChanges.length === 0) {
    return suppressed('no_meaningful_change', { daysInactive, cohort });
  }

  const lastWeeklyMs = timestamp(lastWeeklyNewsletterAt, 'lastWeeklyNewsletterAt', { optional: true });
  if (lastWeeklyMs !== null) {
    const elapsed = nowMs - lastWeeklyMs;
    if (elapsed < 0) return suppressed('weekly_newsletter_timestamp_in_future', { daysInactive, cohort });
    if (elapsed < WEEKLY_NEWSLETTER_PRIORITY_WINDOW_MS) {
      return suppressed('weekly_newsletter_priority_window', { daysInactive, cohort });
    }
  }

  const lastProgressMs = timestamp(lastProgressEmailAt, 'lastProgressEmailAt', { optional: true });
  if (lastProgressMs !== null) {
    const elapsed = nowMs - lastProgressMs;
    if (elapsed < 0) return suppressed('progress_email_timestamp_in_future', { daysInactive, cohort });
    if (elapsed < MIN_PROGRESS_EMAIL_INTERVAL_MS) {
      return suppressed('progress_email_frequency_cap', { daysInactive, cohort });
    }
  }

  return deepFreeze({
    eligible: true,
    action: 'queue_candidate',
    reason: 'eligible',
    daysInactive,
    cohort,
    meaningfulChanges: normalizedChanges.slice(0, 3),
  });
}

function normalizeLearningJourney(learningJourney) {
  if (!isObject(learningJourney)) {
    throw new ProgressEmailContractError('learningJourney must be an object.', 'INVALID_LEARNING_JOURNEY');
  }
  if (!isObject(learningJourney.nextStep)) {
    throw new ProgressEmailContractError('learningJourney.nextStep is required.', 'INVALID_LEARNING_JOURNEY');
  }
  const nextStep = learningJourney.nextStep;
  return {
    available: Boolean(learningJourney.available),
    activityCount: nonNegativeInteger(learningJourney.activityCount ?? 0, 'learningJourney.activityCount'),
    completedCount: nonNegativeInteger(learningJourney.completedCount ?? 0, 'learningJourney.completedCount'),
    inProgressCount: nonNegativeInteger(learningJourney.inProgressCount ?? 0, 'learningJourney.inProgressCount'),
    nextStep: {
      kind: requireString(nextStep.kind, 'learningJourney.nextStep.kind'),
      title: requireString(nextStep.title, 'learningJourney.nextStep.title'),
      description: requireString(nextStep.description, 'learningJourney.nextStep.description'),
      ctaLabel: requireString(nextStep.ctaLabel, 'learningJourney.nextStep.ctaLabel'),
      url: canonicalSiteUrl(nextStep.href, 'learningJourney.nextStep.href'),
    },
  };
}

export function buildProgressEmailPayload({
  eligibility,
  learningJourney,
  weeklyReport,
  locale = 'en',
} = {}) {
  if (!isObject(eligibility) || eligibility.eligible !== true || eligibility.action !== 'queue_candidate') {
    throw new ProgressEmailContractError('An eligible progress-email decision is required.', 'PROGRESS_EMAIL_NOT_ELIGIBLE');
  }
  if (locale !== 'en') {
    throw new ProgressEmailContractError(
      'Only source-language English is enabled until translated copy has an approved validation path.',
      'UNAPPROVED_PROGRESS_EMAIL_LOCALE',
    );
  }

  const journey = normalizeLearningJourney(learningJourney);
  const weekly = buildWeeklyNewsletterPayload({ weeklyReport, locale });

  return deepFreeze({
    messageId: PROGRESS_EMAIL_MESSAGE_ID,
    consentPurpose: PROGRESS_EMAIL_CONSENT_PURPOSE,
    templateVersion: PROGRESS_EMAIL_TEMPLATE_VERSION,
    classification: 'marketing',
    locale,
    cohort: requireString(eligibility.cohort, 'eligibility.cohort'),
    subject: 'Pick up where you left off at USD Impact',
    preheader: 'Your next learning step and the latest validated weekly context.',
    progress: {
      available: journey.available,
      activityCount: journey.activityCount,
      completedCount: journey.completedCount,
      inProgressCount: journey.inProgressCount,
    },
    nextStep: journey.nextStep,
    changes: Array.isArray(eligibility.meaningfulChanges)
      ? eligibility.meaningfulChanges.slice(0, 3)
      : [],
    latestContext: {
      weekEnding: weekly.weekEnding,
      score: weekly.score,
      weeklyReport: weekly.primaryCta,
    },
    complianceNote: weekly.complianceNote,
    unsubscribeRequired: true,
    sourceBoundaries: {
      learningProgress: 'existing_sanitized_learning_journey',
      lastLogin: 'supabase_auth_last_sign_in_at',
      weeklyContext: weekly.source,
    },
  });
}
