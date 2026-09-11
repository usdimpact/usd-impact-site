import { buildProgressEmailMeaningfulChanges } from './progress-email-meaningful-changes.js';
import { resolveProgressEmailCandidate } from './progress-email-readiness.js';

export async function resolveGovernedProgressEmailCandidate({
  accountId,
  weeklyReports,
  currentWeeklyReport,
  registry,
  locale = 'en',
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const meaningfulChanges = buildProgressEmailMeaningfulChanges({
    ...(registry === undefined ? {} : { registry }),
    weeklyReports,
  });
  return resolveProgressEmailCandidate({
    accountId,
    meaningfulChanges,
    weeklyReport: currentWeeklyReport,
    locale,
    environment,
    fetchImpl,
    now,
  });
}
