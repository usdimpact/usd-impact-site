import { validCronAuthorization } from './account-deletion-finalizer.js';
import { requestHeader } from './supabase-server.js';
import {
  ProgressEmailQaBatchError,
  runProgressEmailQaBatch,
} from './progress-email-qa-batch.js';
import { resolveProgressEmailQaSources } from './progress-email-qa-source-resolver.js';

const WEEK_PATTERN = /^20\d{2}-\d{2}-\d{2}$/;

function sendJson(response, status, payload, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(payload));
}

function parseJsonBody(request) {
  const body = request.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  if (typeof body === 'string' || Buffer.isBuffer(body)) return JSON.parse(body.toString());
  throw new TypeError('Request body is missing.');
}

function requireWeekEnding(value) {
  const weekEnding = String(value ?? '').trim();
  const parsed = Date.parse(`${weekEnding}T00:00:00.000Z`);
  if (!WEEK_PATTERN.test(weekEnding) || !Number.isFinite(parsed)) {
    throw new ProgressEmailQaBatchError(
      'An explicit YYYY-MM-DD current Weekly Report period end is required.',
      'INVALID_PROGRESS_EMAIL_QA_WEEK',
      400,
    );
  }
  return weekEnding;
}

function safeBatchError(error) {
  const status = Number.isInteger(error?.status) ? error.status : 503;
  const code = /^[A-Z][A-Z0-9_]{1,79}$/.test(String(error?.code ?? ''))
    ? error.code
    : 'PROGRESS_EMAIL_QA_BATCH_FAILED';
  return {
    status,
    payload: {
      error: status >= 500
        ? 'Learning Progress QA is temporarily unavailable.'
        : 'Learning Progress QA request was rejected.',
      code,
    },
  };
}

export async function handleProgressEmailQaBatchRequest(
  request,
  response,
  {
    authorize = validCronAuthorization,
    runBatch = runProgressEmailQaBatch,
    resolveSources = resolveProgressEmailQaSources,
    environment = process.env,
  } = {},
) {
  if (request.method !== 'POST') {
    return sendJson(
      response,
      405,
      { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' },
      { Allow: 'POST' },
    );
  }
  if (!authorize(request, environment)) {
    return sendJson(response, 401, {
      error: 'Scheduler authorization is required.',
      code: 'SCHEDULER_AUTHORIZATION_REQUIRED',
    });
  }
  if (!requestHeader(request, 'content-type').toLowerCase().includes('application/json')) {
    return sendJson(response, 415, {
      error: 'Content type must be application/json.',
      code: 'INVALID_CONTENT_TYPE',
    });
  }

  let body;
  try {
    body = parseJsonBody(request);
  } catch {
    return sendJson(response, 400, {
      error: 'Invalid request body.',
      code: 'INVALID_REQUEST_BODY',
    });
  }

  try {
    const weekEnding = requireWeekEnding(body.weekEnding);
    if (typeof resolveSources !== 'function') {
      throw new ProgressEmailQaBatchError(
        'Learning Progress QA source resolver is not configured.',
        'PROGRESS_EMAIL_QA_SOURCE_RESOLVER_MISSING',
        503,
      );
    }
    const sources = await resolveSources({ weekEnding, environment });
    if (
      !sources
      || !Array.isArray(sources.weeklyReports)
      || !sources.currentWeeklyReport
      || String(sources.currentWeeklyReport.periodEnd ?? '') !== weekEnding
    ) {
      throw new ProgressEmailQaBatchError(
        'Learning Progress QA source resolution did not match the requested Weekly period.',
        'PROGRESS_EMAIL_QA_SOURCE_MISMATCH',
        503,
      );
    }
    const result = await runBatch({
      weeklyReports: sources.weeklyReports,
      currentWeeklyReport: sources.currentWeeklyReport,
      environment,
    });
    return sendJson(response, result.failed > 0 ? 503 : 200, {
      ok: result.failed === 0,
      weekEnding,
      selected: result.selected,
      accepted: result.accepted,
      skipped: result.skipped,
      failed: result.failed,
      retryScheduled: result.retryScheduled,
      results: result.results,
    });
  } catch (error) {
    if (error instanceof ProgressEmailQaBatchError || Number.isInteger(error?.status)) {
      const safe = safeBatchError(error);
      return sendJson(response, safe.status, safe.payload);
    }
    console.error('Learning Progress QA batch failed.', {
      code: error?.code || 'PROGRESS_EMAIL_QA_BATCH_FAILED',
    });
    const safe = safeBatchError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}
