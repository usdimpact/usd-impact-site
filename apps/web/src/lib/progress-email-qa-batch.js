import { createHash } from 'node:crypto';
import { readMarketingEmailPreferences } from './marketing-email-preferences.js';
import {
  dispatchProgressEmailOutbox,
  enqueueProgressEmailCandidate,
  ProgressEmailDispatchError,
} from './progress-email-dispatch.js';
import { resolveGovernedProgressEmailCandidate } from './progress-email-governed-candidate.js';

const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_QA_BATCH = 5;

export class ProgressEmailQaBatchError extends Error {
  constructor(message, code = 'PROGRESS_EMAIL_QA_BATCH_FAILED', status = 503) {
    super(message);
    this.name = 'ProgressEmailQaBatchError';
    this.code = code;
    this.status = status;
  }
}

function requireQaEnvironment(environment) {
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  if (vercelEnvironment === 'production') {
    throw new ProgressEmailQaBatchError(
      'Learning Progress QA batch is hard-disabled in Production.',
      'PRODUCTION_PROGRESS_EMAIL_QA_BLOCKED',
      503,
    );
  }
  if (!['preview', 'development'].includes(vercelEnvironment)) {
    throw new ProgressEmailQaBatchError(
      'Learning Progress QA batch requires Development or Preview.',
      'UNAPPROVED_PROGRESS_EMAIL_QA_ENVIRONMENT',
      503,
    );
  }
  if (environment.PROGRESS_EMAIL_QA_BATCH_ENABLED !== 'true') {
    throw new ProgressEmailQaBatchError(
      'Learning Progress QA batch is disabled.',
      'PROGRESS_EMAIL_QA_BATCH_DISABLED',
      404,
    );
  }
}

function parseQaRecipients(environment) {
  const values = String(environment.PROGRESS_EMAIL_QA_RECIPIENTS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(values)];
  if (unique.length === 0 || unique.some((email) => email.length > 320 || !EMAIL_PATTERN.test(email))) {
    throw new ProgressEmailQaBatchError(
      'Learning Progress QA recipient allowlist is missing or invalid.',
      'PROGRESS_EMAIL_QA_ALLOWLIST_INVALID',
      503,
    );
  }
  const limit = Number.parseInt(String(environment.PROGRESS_EMAIL_QA_BATCH_LIMIT ?? '1'), 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_QA_BATCH) {
    throw new ProgressEmailQaBatchError(
      `PROGRESS_EMAIL_QA_BATCH_LIMIT must be between 1 and ${MAX_QA_BATCH}.`,
      'PROGRESS_EMAIL_QA_BATCH_LIMIT_INVALID',
      503,
    );
  }
  return unique.sort().slice(0, limit);
}

function recipientReference(email) {
  return createHash('sha256').update(email).digest('hex').slice(0, 12);
}

function safeCode(error, fallback = 'PROGRESS_EMAIL_QA_RECIPIENT_FAILED') {
  const code = String(error?.code ?? '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]{1,79}$/.test(code) ? code : fallback;
}

function currentProgressGrant(preferences, email) {
  const state = preferences?.learningProgressUpdates;
  const grant = state?.active ? state.grant : null;
  if (
    !grant
    || grant.status !== 'granted'
    || grant.purpose !== 'learning_progress_updates'
    || grant.email_normalized !== email
    || !UUID_PATTERN.test(String(grant.user_id ?? ''))
  ) return null;
  return grant;
}

function validateSourceInputs(weeklyReports, currentWeeklyReport) {
  if (!Array.isArray(weeklyReports) || weeklyReports.length === 0) {
    throw new ProgressEmailQaBatchError(
      'Learning Progress QA requires server-resolved Weekly Report sources.',
      'PROGRESS_EMAIL_QA_SOURCES_MISSING',
      503,
    );
  }
  if (!currentWeeklyReport || typeof currentWeeklyReport !== 'object' || Array.isArray(currentWeeklyReport)) {
    throw new ProgressEmailQaBatchError(
      'Learning Progress QA requires a server-resolved current Weekly Report.',
      'PROGRESS_EMAIL_QA_SOURCES_MISSING',
      503,
    );
  }
}

export async function runProgressEmailQaBatch({
  weeklyReports,
  currentWeeklyReport,
  registry,
  environment = process.env,
  databaseFetch = fetch,
  providerFetch = fetch,
  now = new Date(),
  readPreferences = readMarketingEmailPreferences,
  resolveCandidate = resolveGovernedProgressEmailCandidate,
  enqueue = enqueueProgressEmailCandidate,
  dispatch = dispatchProgressEmailOutbox,
} = {}) {
  requireQaEnvironment(environment);
  validateSourceInputs(weeklyReports, currentWeeklyReport);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new ProgressEmailQaBatchError('QA batch clock is invalid.', 'INVALID_QA_BATCH_CLOCK', 503);
  }
  const qaRecipients = parseQaRecipients(environment);
  const results = [];

  for (const email of qaRecipients) {
    const recipientRef = recipientReference(email);
    try {
      const preferences = await readPreferences({
        email,
        environment,
        fetchImpl: databaseFetch,
      });
      const grant = currentProgressGrant(preferences, email);
      if (!grant) {
        results.push(Object.freeze({
          recipientRef,
          status: 'skipped',
          reason: 'learning_progress_consent_not_active',
        }));
        continue;
      }

      const accountId = String(grant.user_id).toLowerCase();
      const candidate = await resolveCandidate({
        accountId,
        weeklyReports,
        currentWeeklyReport,
        ...(registry === undefined ? {} : { registry }),
        environment,
        fetchImpl: databaseFetch,
        now,
      });
      if (!candidate?.eligible) {
        results.push(Object.freeze({
          recipientRef,
          status: 'skipped',
          reason: candidate?.reason || 'not_eligible',
        }));
        continue;
      }
      if (candidate.email !== email || candidate.consentGrant?.id !== grant.id) {
        results.push(Object.freeze({
          recipientRef,
          status: 'skipped',
          reason: 'qa_candidate_identity_mismatch',
        }));
        continue;
      }

      const queued = await enqueue({
        candidate,
        environment,
        fetchImpl: databaseFetch,
        now,
      });
      const delivery = await dispatch({
        outboxId: queued.outbox.id,
        accountId,
        weeklyReports,
        currentWeeklyReport,
        ...(registry === undefined ? {} : { registry }),
        environment,
        fetchImpl: async (input, options) => {
          const url = new URL(input);
          return url.origin === 'https://api.resend.com'
            ? providerFetch(input, options)
            : databaseFetch(input, options);
        },
        now,
      });
      results.push(Object.freeze({
        recipientRef,
        status: delivery.status,
        reason: delivery.reason || null,
        outboxStatus: delivery.outboxStatus || delivery.status,
      }));
    } catch (error) {
      results.push(Object.freeze({
        recipientRef,
        status: 'failed',
        reason: safeCode(error),
      }));
    }
  }

  return Object.freeze({
    enabled: true,
    selected: qaRecipients.length,
    accepted: results.filter((item) => item.status === 'accepted').length,
    skipped: results.filter((item) => ['skipped', 'cancelled', 'complete', 'blocked', 'wait', 'suppressed'].includes(item.status)).length,
    failed: results.filter((item) => ['failed', 'terminal_failed'].includes(item.status)).length,
    retryScheduled: results.filter((item) => item.status === 'retry_scheduled').length,
    results: Object.freeze(results),
  });
}

export function isProgressEmailQaBatchError(error) {
  return error instanceof ProgressEmailQaBatchError
    || error instanceof ProgressEmailDispatchError;
}
