import { deliverMarketingOptInConfirmation } from '../src/lib/marketing-opt-in-delivery.js';
import { prepareMarketingOptInRequest } from '../src/lib/marketing-opt-in-readiness.js';
import { readSupabaseServerConfig } from '../src/lib/supabase-server.js';

const QA_BRANCH = 'integration/newsletter-system-convergence';
const REQUEST_ID = '84dcda52-285b-4c84-8c39-19e19c7e7b1f';
const REQUESTED_AT = '2026-09-13T17:55:00.000Z';
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

function qaRecipient(environment) {
  const entries = String(environment.PROGRESS_EMAIL_QA_RECIPIENTS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length !== 1 || !EMAIL_PATTERN.test(entries[0])) {
    throw new Error('Learning Progress Preview opt-in requires exactly one valid QA recipient.');
  }
  return entries[0];
}

async function resolveAccountId(email, environment) {
  const config = readSupabaseServerConfig(environment, { requireSecret: true });
  const url = new URL('/rest/v1/profiles', config.url);
  url.searchParams.set('email', `eq.${email}`);
  url.searchParams.set('status', 'eq.active');
  url.searchParams.set('select', 'account_id,email');
  url.searchParams.set('limit', '2');
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Learning Progress QA profile lookup failed with status ${response.status}.`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.email !== email || !rows[0]?.account_id) {
    throw new Error('Learning Progress QA requires one active Development profile matching the QA recipient.');
  }
  return rows[0].account_id;
}

export async function runProgressPreviewOptIn(environment = process.env) {
  if (String(environment.VERCEL_ENV ?? '').trim().toLowerCase() !== 'preview') return null;
  if (String(environment.VERCEL_GIT_COMMIT_REF ?? '').trim() !== QA_BRANCH) return null;

  const email = qaRecipient(environment);
  const userId = await resolveAccountId(email, environment);
  const result = await prepareMarketingOptInRequest({
    email,
    requestId: REQUEST_ID,
    purpose: 'learning_progress_updates',
    userId,
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

  console.log(`Learning Progress Preview opt-in rehearsal: ${result.action}; confirmation required: ${Boolean(result.outbox)}.`);
  return result;
}
