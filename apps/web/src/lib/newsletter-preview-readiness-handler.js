import { validCronAuthorization } from './account-deletion-finalizer.js';
import { inspectNewsletterPreviewReadiness } from './newsletter-preview-readiness.js';

function sendJson(response, status, payload, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(payload));
}

export async function handleNewsletterPreviewReadinessRequest(
  request,
  response,
  {
    authorize = validCronAuthorization,
    inspect = inspectNewsletterPreviewReadiness,
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
  if (String(environment.VERCEL_ENV ?? '').trim().toLowerCase() !== 'preview') {
    return sendJson(response, 404, {
      error: 'Newsletter Preview readiness is not available in this environment.',
      code: 'NEWSLETTER_PREVIEW_READINESS_NOT_AVAILABLE',
    });
  }
  if (!authorize(request, environment)) {
    return sendJson(response, 401, {
      error: 'Scheduler authorization is required.',
      code: 'SCHEDULER_AUTHORIZATION_REQUIRED',
    });
  }

  try {
    const report = inspect(environment);
    return sendJson(response, report.ready ? 200 : 503, {
      ok: report.ready,
      environment: report.environment,
      checked: report.checked,
      passed: report.passed,
      failed: report.failed,
      sharedQaRecipients: report.sharedQaRecipients,
      checks: report.checks,
    });
  } catch (error) {
    console.error('Newsletter Preview readiness inspection failed.', {
      code: error?.code || 'NEWSLETTER_PREVIEW_READINESS_FAILED',
    });
    return sendJson(response, 503, {
      error: 'Newsletter Preview readiness inspection failed.',
      code: 'NEWSLETTER_PREVIEW_READINESS_FAILED',
    });
  }
}
