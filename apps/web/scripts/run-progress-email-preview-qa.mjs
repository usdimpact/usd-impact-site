import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProgressEmailQaBatch } from '../src/lib/progress-email-qa-batch.js';
import { verifyProgressEmailQaSourceArtifact } from '../src/lib/progress-email-qa-source-artifact.js';

const QA_BRANCH = 'integration/newsletter-system-convergence';
const WEEK_ENDING = '2026-09-11';

export async function runProgressEmailPreviewQa(environment = process.env) {
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  const commitRef = String(environment.VERCEL_GIT_COMMIT_REF ?? '').trim();
  if (vercelEnvironment !== 'preview' || commitRef !== QA_BRANCH) return null;

  const here = path.dirname(fileURLToPath(import.meta.url));
  const artifactPath = path.join(here, '..', 'dist', 'newsletter', 'progress', `${WEEK_ENDING}.json`);
  const artifact = verifyProgressEmailQaSourceArtifact(JSON.parse(await readFile(artifactPath, 'utf8')));
  if (artifact.payload.weekEnding !== WEEK_ENDING) {
    throw new Error('Learning Progress Preview QA local artifact does not match the requested week.');
  }

  const result = await runProgressEmailQaBatch({
    weeklyReports: artifact.payload.sourceReports,
    currentWeeklyReport: artifact.payload.currentWeeklyReport,
    environment,
  });
  const reasonCodes = [...new Set(result.results.map((item) => item.reason).filter(Boolean))].sort();
  console.log(`Learning Progress Preview QA: selected ${result.selected}; accepted ${result.accepted}; skipped ${result.skipped}; failed ${result.failed}; retry scheduled ${result.retryScheduled}; reasons ${reasonCodes.length ? reasonCodes.join(',') : 'none'}.`);
  if (result.failed > 0 || result.retryScheduled > 0) {
    throw new Error('Learning Progress Preview QA did not complete cleanly.');
  }
  return result;
}

await runProgressEmailPreviewQa(process.env);
