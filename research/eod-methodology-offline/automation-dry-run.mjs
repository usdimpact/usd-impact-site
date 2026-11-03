// CLI intentionally never accesses providers, writes a PR, or publishes content.
import { appendFileSync } from 'node:fs';
import { demonstrate } from './fixtures.mjs';
import { planMethodologyDryRun, SYNTHETIC_PROBE_SOURCES } from './methodology-schedule.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = arg.match(/^--(now|evidence)=([A-Za-z0-9_:+.\-]+)$/);
  if (!match) throw new Error('unsupported argument');
  return [match[1], match[2]];
}));
const evidence = args.evidence ?? 'quiet';
if (!Object.hasOwn(SYNTHETIC_PROBE_SOURCES, evidence)) throw new Error('unsupported invented evidence selection');
const asOfUtc = args.now ?? new Date().toISOString();
const run = planMethodologyDryRun({ asOfUtc, sources: SYNTHETIC_PROBE_SOURCES[evidence] });
const demonstration = demonstrate();
if (demonstration.release_authorized !== false || demonstration.score.public_release_authorized !== false ||
  !demonstration.languages.every(item => item.en.publish_allowed === false && item.es.publish_allowed === false)) {
  throw new Error('synthetic output attempted to authorize a release');
}
const summary = {
  run, fictional_period: '2100-02', synthetic_days: demonstration.counts.days,
  synthetic_weeks: demonstration.counts.weeks, synthetic_months: demonstration.counts.months,
  invented_score: demonstration.score.total, release_authorized: false,
  uses_external_data: false, requests_real_market_data: false,
  notices: { en: 'RESEARCH ONLY. No news feed, licensed data retrieval, or publish authorization.',
    es: 'SOLO INVESTIGACION. Sin fuentes de datos reales, ni autorizacion para publicar.' },
};
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const c = run.proposed_candidates;
  const report = [
    '## USD Impact EOD Methodology - synthetic scheduled dry run',
    '', '**RESEARCH ONLY - NO MARKET DATA OR PUBLICATION**', '',
    `- Runner as-of (UTC): ${run.as_of_utc}`,
    `- New York business-day: ${run.local_day}`,
    `- Clock state: ${run.dry_run_state}`,
    `- Fictional evidence scenario: ${run.hypothetical_review.kind}`,
    `- Candidate eligibility (not approval): Daily=${c.daily}, Weekly=${c.weekly}, Monthly=${c.monthly}`,
    `- Fictional fixture: February 2100; 20 Dailies / 4 Weeklies / 1 Monthly; Score=${demonstration.score.total}`,
    '- No rights-cleared real data ingested; no source costs, web routes, commits, PRs or emails.',
    '- Existing Daily News and original Score publication gates unchanged.', '',
  ].join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, report, 'utf8');
}
