import { readFile } from 'node:fs/promises';
import { verifyWeeklyNewsletterEditionArtifact } from '../src/lib/weekly-newsletter-edition.js';
import { runWeeklyNewsletterQaBatch } from '../src/lib/weekly-newsletter-qa-batch.js';

const QA_BRANCH = 'integration/newsletter-system-convergence';
const WEEK_ENDING = '2026-09-11';
const ARTIFACT_URL = new URL(`../public/newsletter/weekly/${WEEK_ENDING}.json`, import.meta.url);

async function loadStagedArtifact() {
  const raw = await readFile(ARTIFACT_URL, 'utf8');
  const artifact = JSON.parse(raw);
  const verified = verifyWeeklyNewsletterEditionArtifact(artifact);
  if (verified.payload.weekEnding !== WEEK_ENDING) {
    throw new Error('Staged Weekly Newsletter artifact week does not match the QA week.');
  }
  return verified;
}

export async function runWeeklyNewsletterPreviewQa(environment = process.env) {
  if (String(environment.VERCEL_ENV ?? '').trim().toLowerCase() !== 'preview') return null;
  if (String(environment.VERCEL_GIT_COMMIT_REF ?? '').trim() !== QA_BRANCH) return null;

  const result = await runWeeklyNewsletterQaBatch({
    weekEnding: WEEK_ENDING,
    artifactBaseUrl: environment.WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL,
    unsubscribeBaseUrl: environment.WEEKLY_NEWSLETTER_PUBLIC_BASE_URL,
    environment,
    loadArtifact: loadStagedArtifact,
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
