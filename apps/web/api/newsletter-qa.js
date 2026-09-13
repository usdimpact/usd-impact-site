import { handleMarketingOptInConfirmation } from '../src/lib/marketing-opt-in-handler.js';
import { handleNewsletterPreviewQaDriverRequest } from '../src/lib/newsletter-preview-qa-driver.js';
import { handleNewsletterPreviewReadinessRequest } from '../src/lib/newsletter-preview-readiness-handler.js';

function action(request) {
  const url = new URL(request.url || '/api/newsletter-qa', 'https://usd-impact.invalid');
  return String(url.searchParams.get('action') ?? '').trim().toLowerCase();
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.end(JSON.stringify(payload));
}

const handlers = Object.freeze({
  driver: handleNewsletterPreviewQaDriverRequest,
  confirm: handleMarketingOptInConfirmation,
  readiness: handleNewsletterPreviewReadinessRequest,
});

export default async function handler(request, response) {
  if (String(process.env.VERCEL_ENV ?? '').trim().toLowerCase() !== 'preview') {
    return sendJson(response, 404, {
      error: 'Newsletter QA is not available in this environment.',
      code: 'NEWSLETTER_QA_NOT_AVAILABLE',
    });
  }
  if (String(process.env.VERCEL_GIT_COMMIT_REF ?? '').trim() !== 'integration/newsletter-system-convergence') {
    return sendJson(response, 404, {
      error: 'Newsletter QA is not available on this branch.',
      code: 'NEWSLETTER_QA_BRANCH_NOT_AVAILABLE',
    });
  }
  const selected = handlers[action(request)];
  if (!selected) {
    return sendJson(response, 404, {
      error: 'Newsletter QA action not found.',
      code: 'NEWSLETTER_QA_ACTION_NOT_FOUND',
    });
  }
  return selected(request, response);
}
