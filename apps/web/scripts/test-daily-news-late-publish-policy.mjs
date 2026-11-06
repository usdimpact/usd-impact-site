import assert from 'node:assert/strict';
import { assessLatePublication } from './daily-news-late-publish-policy.mjs';
import { buildCarryForward } from './create-daily-carry-forward.mjs';
import { REQUIRED_CHECKS } from './daily-news-auto-publish-policy.mjs';

const date = '2026-11-09';
const sourceId = 912345678;
const main = 'a'.repeat(40);
const head = 'b'.repeat(40);
const path = 'apps/web/src/content/news/' + date + '.md';
const sources = [
  { id: 'bls-employment', title: 'Employment Situation, October 2026',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/news.release/archives/empsit_11062026.htm',
    publishedAt: '2026-11-06', sourceType: 'primary' },
  { id: 'treasury-refunding', title: 'Quarterly Refunding Statement',
    publisher: 'U.S. Department of the Treasury',
    url: 'https://home.treasury.gov/news/press-releases/sb0678',
    publishedAt: '2026-11-04', sourceType: 'primary' },
  { id: 'bls-productivity', title: 'Productivity and Costs, Third Quarter 2026',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/news.release/archives/prod2_11052026.htm',
    publishedAt: '2026-11-05', sourceType: 'primary' },
  { id: 'bea-trade', title: 'U.S. International Trade in Goods and Services, September',
    publisher: 'U.S. Bureau of Economic Analysis',
    url: 'https://www.bea.gov/news/2026/us-international-trade-goods-and-services-september-2026',
    publishedAt: '2026-11-04', sourceType: 'primary' },
];
const archive = { date: '2026-11-06', status: 'published', sources,
  highlights: [{ headline: 'Synthetic baseline only' }] };
const content = buildCarryForward({ editionDate: date,
  archive, archiveDate: '2026-11-06', generatedAt: date + 'T15:47:00.000Z' });
const runs = REQUIRED_CHECKS.map((name, i) => ({
  id: 10000 + i, event: 'pull_request', head_sha: head, status: 'completed',
  conclusion: 'success', repository: { full_name: 'usdimpact/usd-impact-site' },
}));
const checks = REQUIRED_CHECKS.map((name, i) => ({
  name, head_sha: head, status: 'completed', conclusion: 'success',
  app: { slug: 'github-actions' },
  details_url: 'https://github.com/usdimpact/usd-impact-site/actions/runs/'
    + (10000 + i) + '/job/' + (20000 + i),
}));
const source = {
  id: sourceId, path: '.github/workflows/daily-news-late-carryforward.yml',
  head_branch: 'main', head_sha: main, run_attempt: 1,
  status: 'completed', conclusion: 'success', event: 'schedule',
  created_at: date + 'T15:47:03Z',
  repository: { full_name: 'usdimpact/usd-impact-site' },
};
const branch = 'automation/daily-carryforward-' + date + '-' + sourceId;
const pr = {
  state: 'open', draft: false, merged: false, mergeable: true, mergeable_state: 'clean',
  head: { sha: head, ref: branch, repo: { full_name: 'usdimpact/usd-impact-site' } },
  base: { ref: 'main', sha: main },
  title: 'Publish Daily USD Impact — ' + date + ' (late verified carry-forward)',
};
const file = { filename: path, status: 'added' };
const compare = { status: 'ahead', ahead_by: 1, behind_by: 0, files: [file] };
const reviews = [{ state: 'APPROVED', commit_id: head,
  user: { login: 'usdimpact' }, submitted_at: date + 'T16:31:00Z' }];
const now = new Date(date + 'T17:05:00.000Z');
const input = { enabled: true, now, currentMain: main, source, pr,
  compare, files: [file], content, archiveSources: sources, checks,
  checkWorkflowRuns: runs, preview: { state: 'READY', target: 'preview', commitSha: head },
  reviews };
function outcome(name, changed, reason) {
  const result = assessLatePublication({ ...input, ...changed });
  assert.equal(result.eligible, false, name + ': should fail closed');
  assert.equal(result.reason, reason, name + ': unexpected failure reason');
}
const eligible = assessLatePublication(input);
assert.deepEqual(eligible, { eligible: true,
  reason: 'reviewed-late-pr-eligible-for-normal-protected-merge',
  headSha: head, baseSha: main, edition: date, path });
outcome('default disabled', { enabled: false }, 'owner-activation-not-approved');
outcome('missing source identity', { source: { ...source, path: '.github/workflows/daily-news.yml' } },
  'not-original-successful-late-workflow');
outcome('failed source workflow', { source: { ...source, conclusion: 'failure' } },
  'not-original-successful-late-workflow');
outcome('rerun', { source: { ...source, run_attempt: 2 } },
  'not-original-successful-late-workflow');
outcome('next UTC day', { now: new Date('2026-11-10T00:05:00Z') },
  'not-same-day-late-weekday-window');
outcome('before US release window', { now: new Date(date + 'T12:45:00Z') },
  'not-same-day-late-weekday-window');
outcome('base moved', { currentMain: 'c'.repeat(40) }, 'not-original-successful-late-workflow');
outcome('lookalike PR', { pr: { ...pr, title: pr.title + ' unauthorized' } },
  'late-pr-identity-or-protection-drift');
outcome('draft PR', { pr: { ...pr, draft: true } }, 'late-pr-identity-or-protection-drift');
outcome('extra file', { files: [file, { filename: '.github/workflows/evil.yml', status: 'added' }] },
  'not-one-new-content-file');
outcome('altered archived source', { archiveSources: sources.slice(0, 3) },
  'source-not-identical-to-reviewed-original');
outcome('false manual check', { checkWorkflowRuns: runs.map((x) => ({ ...x, event: 'workflow_dispatch' })) },
  'genuine-exact-head-pull-request-checks-not-proven');
outcome('one failed actual PR check', { checks: checks.map((x, i) =>
  i === 1 ? { ...x, conclusion: 'failure' } : x) },
  'genuine-exact-head-pull-request-checks-not-proven');
outcome('ineligible SHA', { checkWorkflowRuns: runs.map((x, i) =>
  i === 2 ? { ...x, head_sha: main } : x) },
  'genuine-exact-head-pull-request-checks-not-proven');
outcome('stale preview', { preview: { state: 'READY', target: 'preview', commitSha: main } },
  'exact-head-preview-not-ready');
outcome('human has not reviewed', { reviews: [] }, 'owner-exact-head-approval-missing');
outcome('approval for old head', { reviews: [{ ...reviews[0], commit_id: main }] },
  'owner-exact-head-approval-missing');
outcome('latest changes requested', { reviews: [...reviews,
  { ...reviews[0], state: 'CHANGES_REQUESTED', submitted_at: date + 'T16:40:00Z' }] },
  'owner-exact-head-approval-missing');
console.log('Late Daily publication eligibility: 1 positive, 18 fail-closed offline cases PASS.');
