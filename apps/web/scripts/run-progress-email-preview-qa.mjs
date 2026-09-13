import { runProgressEmailQaBatch } from '../src/lib/progress-email-qa-batch.js';
import { resolveProgressEmailQaSources } from '../src/lib/progress-email-qa-source-resolver.js';

const WEEK_ENDING = '2026-09-11';

export async function runProgressEmailPreviewQa(environment = process.env) {
  const sources = await resolveProgressEmailQaSources({
    weekEnding: WEEK_ENDING,
    environment,
  });
  const result = await runProgressEmailQaBatch({
    weeklyReports: sources.weeklyReports,
    currentWeeklyReport: sources.currentWeeklyReport,
    environment,
  });
  console.log(`Learning Progress Preview QA: selected ${result.selected}; accepted ${result.accepted}; skipped ${result.skipped}; failed ${result.failed}; retry scheduled ${result.retryScheduled}.`);
  if (result.failed > 0 || result.retryScheduled > 0) {
    throw new Error('Learning Progress Preview QA did not complete cleanly.');
  }
  return result;
}
