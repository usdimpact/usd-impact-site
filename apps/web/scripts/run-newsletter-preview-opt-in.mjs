import { deliverMarketingOptInConfirmation } from '../src/lib/marketing-opt-in-delivery.js';
import { prepareMarketingOptInRequest } from '../src/lib/marketing-opt-in-readiness.js';

const QA_BRANCH = 'integration/newsletter-system-convergence';
const REQUEST_ID = '5d7c9e4a-2b6f-4c71-8f20-9c3d4e5f6a70';
const REQUESTED_AT = '2026-09-13T17:15:00.000Z';
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

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

export async function runNewsletterPreviewOptIn(environment = process.env) {
  if (String(environment.VERCEL_ENV ?? '').trim().toLowerCase() !== 'preview') return null;
  if (String(environment.VERCEL_GIT_COMMIT_REF ?? '').trim() !== QA_BRANCH) return null;

  const recipient = sharedQaRecipient(environment);
  if (!recipient) throw new Error('Newsletter Preview opt-in rehearsal requires one common QA recipient.');

  const result = await prepareMarketingOptInRequest({
    email: recipient,
    requestId: REQUEST_ID,
    purpose: 'weekly_newsletter',
    locale: 'en',
    requestedAt: REQUESTED_AT,
    environment,
  });

  if (result.outbox) {
    await deliverMarketingOptInConfirmation({
      outbox: result.outbox,
      baseUrl: `https://${String(environment.VERCEL_BRANCH_URL ?? '').trim()}`,
      environment,
    });
  }

  console.log(`Newsletter Preview opt-in rehearsal: ${result.action}; confirmation required: ${Boolean(result.outbox)}.`);
  return result;
}
