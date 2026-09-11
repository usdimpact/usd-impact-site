import { createHash } from 'node:crypto';
import { readMarketingEmailPreferences } from './marketing-email-preferences.js';
import { evaluateWeeklyNewsletterCandidate } from './weekly-newsletter-candidate.js';
import { verifyWeeklyNewsletterEditionArtifact } from './weekly-newsletter-edition.js';
import {
  WeeklyNewsletterDispatchError,
  deliverWeeklyNewsletterOutbox,
  enqueueWeeklyNewsletterOutbox,
} from './weekly-newsletter-dispatch.js';

const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const WEEK_PATTERN = /^20\d{2}-\d{2}-\d{2}$/;
const MAX_QA_BATCH = 5;

export class WeeklyNewsletterQaBatchError extends Error {
  constructor(message, code = 'WEEKLY_NEWSLETTER_QA_BATCH_FAILED', status = 503) {
    super(message);
    this.name = 'WeeklyNewsletterQaBatchError';
    this.code = code;
    this.status = status;
  }
}

function requireQaEnvironment(environment) {
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  if (vercelEnvironment === 'production') {
    throw new WeeklyNewsletterQaBatchError(
      'Weekly Newsletter QA batch is hard-disabled in Production.',
      'PRODUCTION_WEEKLY_NEWSLETTER_QA_BLOCKED',
      503,
    );
  }
  if (!['preview', 'development'].includes(vercelEnvironment)) {
    throw new WeeklyNewsletterQaBatchError(
      'Weekly Newsletter QA batch requires Development or Preview.',
      'UNAPPROVED_WEEKLY_NEWSLETTER_QA_ENVIRONMENT',
      503,
    );
  }
  if (environment.WEEKLY_NEWSLETTER_QA_BATCH_ENABLED !== 'true') {
    throw new WeeklyNewsletterQaBatchError(
      'Weekly Newsletter QA batch is disabled.',
      'WEEKLY_NEWSLETTER_QA_BATCH_DISABLED',
      404,
    );
  }
}

function requireWeekEnding(value) {
  const weekEnding = String(value ?? '').trim();
  if (!WEEK_PATTERN.test(weekEnding) || !Number.isFinite(Date.parse(`${weekEnding}T00:00:00.000Z`))) {
    throw new WeeklyNewsletterQaBatchError(
      'An explicit YYYY-MM-DD week ending is required.',
      'INVALID_WEEKLY_NEWSLETTER_WEEK',
      400,
    );
  }
  return weekEnding;
}

function parseQaRecipients(environment) {
  const values = String(environment.WEEKLY_NEWSLETTER_QA_RECIPIENTS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(values)];
  if (unique.length === 0 || unique.some((email) => email.length > 320 || !EMAIL_PATTERN.test(email))) {
    throw new WeeklyNewsletterQaBatchError(
      'Weekly Newsletter QA recipient allowlist is missing or invalid.',
      'WEEKLY_NEWSLETTER_QA_ALLOWLIST_INVALID',
      503,
    );
  }
  const limit = Number.parseInt(String(environment.WEEKLY_NEWSLETTER_QA_BATCH_LIMIT ?? '1'), 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_QA_BATCH) {
    throw new WeeklyNewsletterQaBatchError(
      `WEEKLY_NEWSLETTER_QA_BATCH_LIMIT must be between 1 and ${MAX_QA_BATCH}.`,
      'WEEKLY_NEWSLETTER_QA_BATCH_LIMIT_INVALID',
      503,
    );
  }
  return unique.sort().slice(0, limit);
}

function approvedArtifactOrigin(value) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    throw new WeeklyNewsletterQaBatchError(
      'Weekly Newsletter artifact origin is invalid.',
      'WEEKLY_NEWSLETTER_ARTIFACT_ORIGIN_INVALID',
      503,
    );
  }
  const canonical = url.origin === 'https://www.usd-impact.com';
  const preview = url.protocol === 'https:'
    && url.hostname.startsWith('usd-impact-site')
    && url.hostname.endsWith('.vercel.app');
  if ((!canonical && !preview) || url.username || url.password) {
    throw new WeeklyNewsletterQaBatchError(
      'Weekly Newsletter artifact origin is outside the approved set.',
      'WEEKLY_NEWSLETTER_ARTIFACT_ORIGIN_INVALID',
      503,
    );
  }
  return url.origin;
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function loadWeeklyNewsletterQaArtifact({
  weekEnding,
  baseUrl,
  fetchImpl = fetch,
} = {}) {
  const week = requireWeekEnding(weekEnding);
  const origin = approvedArtifactOrigin(baseUrl);
  const response = await fetchImpl(`${origin}/newsletter/weekly/${week}.json`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new WeeklyNewsletterQaBatchError(
      `Weekly Newsletter QA artifact fetch failed with status ${response.status}.`,
      'WEEKLY_NEWSLETTER_ARTIFACT_FETCH_FAILED',
      503,
    );
  }
  const artifact = await readJsonSafely(response);
  let verified;
  try {
    verified = verifyWeeklyNewsletterEditionArtifact(artifact);
  } catch (error) {
    throw new WeeklyNewsletterQaBatchError(
      `Weekly Newsletter QA artifact verification failed: ${error?.code || 'INVALID_ARTIFACT'}.`,
      'WEEKLY_NEWSLETTER_ARTIFACT_INVALID',
      503,
    );
  }
  if (verified.payload.weekEnding !== week) {
    throw new WeeklyNewsletterQaBatchError(
      'Weekly Newsletter QA artifact week does not match the requested week.',
      'WEEKLY_NEWSLETTER_ARTIFACT_WEEK_MISMATCH',
      503,
    );
  }
  return verified;
}

function recipientReference(email) {
  return createHash('sha256').update(email).digest('hex').slice(0, 12);
}

function safeCode(error, fallback = 'WEEKLY_NEWSLETTER_QA_RECIPIENT_FAILED') {
  const code = String(error?.code ?? '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]{1,79}$/.test(code) ? code : fallback;
}

export async function runWeeklyNewsletterQaBatch({
  weekEnding,
  artifactBaseUrl,
  unsubscribeBaseUrl,
  environment = process.env,
  databaseFetch = fetch,
  artifactFetch = fetch,
  providerFetch = fetch,
  now = new Date(),
  loadArtifact = loadWeeklyNewsletterQaArtifact,
  readPreferences = readMarketingEmailPreferences,
  enqueue = enqueueWeeklyNewsletterOutbox,
  deliver = deliverWeeklyNewsletterOutbox,
} = {}) {
  requireQaEnvironment(environment);
  const week = requireWeekEnding(weekEnding);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new WeeklyNewsletterQaBatchError('QA batch clock is invalid.', 'INVALID_QA_BATCH_CLOCK', 503);
  }
  const qaRecipients = parseQaRecipients(environment);
  const artifact = await loadArtifact({
    weekEnding: week,
    baseUrl: artifactBaseUrl,
    fetchImpl: artifactFetch,
  });

  const results = [];
  for (const email of qaRecipients) {
    const recipientRef = recipientReference(email);
    try {
      const preferences = await readPreferences({
        email,
        environment,
        fetchImpl: databaseFetch,
      });
      const grant = preferences?.weeklyNewsletter?.active
        ? preferences.weeklyNewsletter.grant
        : null;
      if (!grant) {
        results.push(Object.freeze({
          recipientRef,
          status: 'skipped',
          reason: 'weekly_newsletter_consent_not_active',
        }));
        continue;
      }

      const candidate = evaluateWeeklyNewsletterCandidate({
        payload: artifact.payload,
        consentGrant: grant,
        providerSuppressed: false,
        now: now.toISOString(),
      });
      if (!candidate.eligible) {
        results.push(Object.freeze({
          recipientRef,
          status: 'skipped',
          reason: candidate.reason,
        }));
        continue;
      }

      const queued = await enqueue({
        candidate,
        artifact,
        consentCheckedAt: now.toISOString(),
        environment,
        fetchImpl: databaseFetch,
      });
      const delivery = await deliver({
        outbox: queued.outbox,
        artifactBaseUrl,
        unsubscribeBaseUrl,
        environment,
        databaseFetch,
        artifactFetch,
        providerFetch,
        now: () => now,
        artifactLoader: async () => artifact,
      });
      results.push(Object.freeze({
        recipientRef,
        status: delivery.sent ? 'accepted' : delivery.state,
        reason: delivery.reason,
        outboxStatus: delivery.outbox?.status || delivery.state,
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
    weekEnding: week,
    artifactChecksum: artifact.checksum,
    selected: qaRecipients.length,
    accepted: results.filter((item) => item.status === 'accepted').length,
    skipped: results.filter((item) => ['skipped', 'complete', 'cancelled', 'suppressed', 'waiting', 'blocked'].includes(item.status)).length,
    failed: results.filter((item) => item.status === 'failed').length,
    results: Object.freeze(results),
  });
}

export function isWeeklyNewsletterQaBatchError(error) {
  return error instanceof WeeklyNewsletterQaBatchError
    || error instanceof WeeklyNewsletterDispatchError;
}
