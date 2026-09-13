import { runWeeklyNewsletterQaBatch } from '../src/lib/weekly-newsletter-qa-batch.js';

const QA_BRANCH = 'integration/newsletter-system-convergence';
const WEEK_ENDING = '2026-09-11';
const CANONICAL_ARTIFACT_BASE_URL = 'https://www.usd-impact.com';

export async function runWeeklyNewsletterPreviewQa(environment = process.env) {
  if (String(environment.VERCEL_ENV ?? '').trim().toLowerCase() !== 'preview') return null;
  if (String(environment.VERCEL_GIT_COMMIT_REF ?? '').trim() !== QA_BRANCH) return null;

  const result = await runWeeklyNewsletterQaBatch({
    weekEnding: WEEK_ENDING,
    artifactBaseUrl: CANONICAL_ARTIFACT_BASE_URL,
    unsubscribeBaseUrl: environment.WEEKLY_NEWSLETTER_PUBLIC_BASE_URL,
    environment,
  });

  console.log(
    `Weekly Newsletter Preview QA: week ${result.weekEnding}; selected ${result.selected}; accepted ${result.accepted}; skipped ${result.skipped}; failed ${result.failed}.`,
  );

  if (result.failed > 0) {
    const reasons = result.results
      .filter((item) => item.status === 'failed')
      .map((item) => item.reason)
      .join(', ');
    throw new Error(`Weekly Newsletter Preview QA failed: ${reasons || 'unknown failure'}.`);
  }

  return result;
}
