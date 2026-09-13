import { randomUUID } from 'node:crypto';
import { deliverMarketingOptInConfirmation } from './marketing-opt-in-delivery.js';
import { prepareMarketingOptInRequest } from './marketing-opt-in-readiness.js';
import { requireNewsletterPreviewReadiness } from './newsletter-preview-readiness.js';
import { runProgressEmailQaBatch } from './progress-email-qa-batch.js';
import { resolveProgressEmailQaSources } from './progress-email-qa-source-resolver.js';
import { createVercelProtectedPreviewFetch } from './vercel-protected-preview-fetch.js';
import { runWeeklyNewsletterQaBatch } from './weekly-newsletter-qa-batch.js';

const QA_BRANCH = 'integration/newsletter-system-convergence';
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const WEEK_PATTERN = /^20\d{2}-\d{2}-\d{2}$/;

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.end(JSON.stringify(payload));
}

function requestUrl(request) {
  return new URL(request.url || '/api/account', 'https://usd-impact.invalid');
}

function parseEmailSet(value) {
  const entries = String(value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0 || entries.some((email) => !EMAIL_PATTERN.test(email))) return null;
  return new Set(entries);
}

function sharedQaRecipient(environment) {
  const sets = [
    parseEmailSet(environment.EMAIL_OPT_IN_QA_RECIPIENTS),
    parseEmailSet(environment.WEEKLY_NEWSLETTER_QA_RECIPIENTS),
    parseEmailSet(environment.PROGRESS_EMAIL_QA_RECIPIENTS),
  ];
  if (sets.some((set) => !(set instanceof Set) || set.size === 0)) return null;
  for (const email of sets[0]) {
    if (sets.slice(1).every((set) => set.has(email))) return email;
  }
  return null;
}

function requireQaEnvironment(environment) {
  requireNewsletterPreviewReadiness(environment);
  if (String(environment.VERCEL_GIT_COMMIT_REF ?? '').trim() !== QA_BRANCH) {
    const error = new Error('Newsletter Preview QA driver is restricted to the approved branch.');
    error.code = 'NEWSLETTER_PREVIEW_QA_BRANCH_MISMATCH';
    error.status = 404;
    throw error;
  }
  const recipient = sharedQaRecipient(environment);
  if (!recipient) {
    const error = new Error('A shared QA recipient is required.');
    error.code = 'NEWSLETTER_PREVIEW_QA_RECIPIENT_MISSING';
    error.status = 503;
    throw error;
  }
  return recipient;
}

function requireWeekEnding(value) {
  const weekEnding = String(value ?? '').trim();
  if (!WEEK_PATTERN.test(weekEnding) || !Number.isFinite(Date.parse(`${weekEnding}T00:00:00.000Z`))) {
    const error = new Error('A valid weekEnding is required.');
    error.code = 'INVALID_NEWSLETTER_PREVIEW_QA_WEEK';
    error.status = 400;
    throw error;
  }
  return weekEnding;
}

export async function handleNewsletterPreviewQaDriverRequest(
  request,
  response,
  { environment = process.env } = {},
) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const recipient = requireQaEnvironment(environment);
    const url = requestUrl(request);
    const phase = String(url.searchParams.get('phase') ?? '').trim().toLowerCase();

    if (phase === 'weekly-opt-in') {
      const result = await prepareMarketingOptInRequest({
        email: recipient,
        requestId: randomUUID(),
        purpose: 'weekly_newsletter',
        locale: 'en',
        environment,
      });
      if (result.outbox) {
        await deliverMarketingOptInConfirmation({
          outbox: result.outbox,
          baseUrl: `https://${String(environment.VERCEL_BRANCH_URL ?? '').trim()}`,
          environment,
        });
      }
      return sendJson(response, 200, {
        ok: true,
        phase,
        action: result.action,
        confirmationRequired: Boolean(result.outbox),
      });
    }

    if (phase === 'weekly-send') {
      const weekEnding = requireWeekEnding(url.searchParams.get('weekEnding'));
      const artifactFetch = createVercelProtectedPreviewFetch({ environment });
      const result = await runWeeklyNewsletterQaBatch({
        weekEnding,
        artifactBaseUrl: environment.WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL,
        unsubscribeBaseUrl: environment.WEEKLY_NEWSLETTER_PUBLIC_BASE_URL,
        environment,
        artifactFetch,
      });
      return sendJson(response, result.failed > 0 ? 503 : 200, {
        ok: result.failed === 0,
        phase,
        weekEnding,
        selected: result.selected,
        accepted: result.accepted,
        skipped: result.skipped,
        failed: result.failed,
      });
    }

    if (phase === 'progress-send') {
      const weekEnding = requireWeekEnding(url.searchParams.get('weekEnding'));
      const sources = await resolveProgressEmailQaSources({ weekEnding, environment });
      const result = await runProgressEmailQaBatch({
        weeklyReports: sources.weeklyReports,
        currentWeeklyReport: sources.currentWeeklyReport,
        environment,
      });
      return sendJson(response, result.failed > 0 ? 503 : 200, {
        ok: result.failed === 0,
        phase,
        weekEnding,
        selected: result.selected,
        accepted: result.accepted,
        skipped: result.skipped,
        failed: result.failed,
        retryScheduled: result.retryScheduled,
      });
    }

    return sendJson(response, 400, {
      error: 'Unsupported QA phase.',
      code: 'INVALID_NEWSLETTER_PREVIEW_QA_PHASE',
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 503;
    console.error('Newsletter Preview QA driver failed.', {
      code: error?.code || 'NEWSLETTER_PREVIEW_QA_FAILED',
    });
    return sendJson(response, status, {
      error: status >= 500 ? 'Newsletter Preview QA is temporarily unavailable.' : 'Newsletter Preview QA request was rejected.',
      code: error?.code || 'NEWSLETTER_PREVIEW_QA_FAILED',
    });
  }
}
