import { validCronAuthorization } from './account-deletion-finalizer.js';
import { requestOrigin } from './supabase-auth.js';
import { requestHeader } from './supabase-server.js';
import { createVercelProtectedPreviewFetch } from './vercel-protected-preview-fetch.js';
import {
  WeeklyNewsletterQaBatchError,
  runWeeklyNewsletterQaBatch,
} from './weekly-newsletter-qa-batch.js';

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

function safeBatchError(error) {
  const status = Number.isInteger(error?.status) ? error.status : 503;
  const code = /^[A-Z][A-Z0-9_]{1,79}$/.test(String(error?.code ?? ''))
    ? error.code
    : 'WEEKLY_NEWSLETTER_QA_BATCH_FAILED';
  return {
    status,
    payload: {
      error: status >= 500
        ? 'Weekly Newsletter QA is temporarily unavailable.'
        : 'Weekly Newsletter QA request was rejected.',
      code,
    },
  };
}

export async function handleWeeklyNewsletterQaBatchRequest(
  request,
  response,
  {
    authorize = validCronAuthorization,
    runBatch = runWeeklyNewsletterQaBatch,
    resolveOrigin = requestOrigin,
    createArtifactFetch = createVercelProtectedPreviewFetch,
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
    const origin = resolveOrigin(request);
    const artifactFetch = createArtifactFetch({ environment });
    const result = await runBatch({
      weekEnding: body.weekEnding,
      artifactBaseUrl: environment.WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL || origin,
      unsubscribeBaseUrl: environment.WEEKLY_NEWSLETTER_PUBLIC_BASE_URL || origin,
      environment,
      artifactFetch,
    });
    return sendJson(response, result.failed > 0 ? 503 : 200, {
      ok: result.failed === 0,
      weekEnding: result.weekEnding,
      artifactChecksum: result.artifactChecksum,
      selected: result.selected,
      accepted: result.accepted,
      skipped: result.skipped,
      failed: result.failed,
      results: result.results,
    });
  } catch (error) {
    if (error instanceof WeeklyNewsletterQaBatchError || Number.isInteger(error?.status)) {
      const safe = safeBatchError(error);
      return sendJson(response, safe.status, safe.payload);
    }
    console.error('Weekly Newsletter QA batch failed.', {
      code: error?.code || 'WEEKLY_NEWSLETTER_QA_BATCH_FAILED',
    });
    const safe = safeBatchError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}
