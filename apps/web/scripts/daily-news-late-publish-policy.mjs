import yaml from 'js-yaml';
import { REPOSITORY, REQUIRED_CHECKS, validateDailyContent } from './daily-news-auto-publish-policy.mjs';
import { SOURCE_DATE_BASIS, sourceDateBasisForUrl, sourceDateAttributionIssue } from '../src/lib/source-date-basis.js';

// Offline-only decision policy. It never calls GitHub, deploys, merges, or dispatches.
// Any future executor must obtain each receipt from a trusted, fresh read and perform
// the ordinary protected merge, then independently verify exact-SHA live publication.
const SHA = /^[a-f0-9]{40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const SOURCE_PATH = '.github/workflows/daily-news-late-carryforward.yml';
const ALLOWED_EVENTS = new Set(['schedule', 'workflow_dispatch']);
const MAX_SOURCES = 24;

function dateMs(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return null;
  const time = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

function nyParts(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return { day: [part('year'), part('month'), part('day')].join('-'),
    minute: Number(part('hour')) * 60 + Number(part('minute')) };
}

function parseContent(content) {
  if (typeof content !== 'string' || content.length > 262144) return null;
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  try {
    const front = yaml.load(m[1], { schema: yaml.JSON_SCHEMA });
    return front && !Array.isArray(front) && typeof front === 'object' ? front : null;
  } catch { return null; }
}

function hasEligiblePullRequestChecks(checks, runs, sha) {
  if (!Array.isArray(checks) || !Array.isArray(runs)
      || checks.length > 100 || runs.length > 100) return false;
  for (const name of REQUIRED_CHECKS) {
    const matching = checks.filter((check) =>
      check?.name === name && check.head_sha === sha
      && check.app?.slug === 'github-actions');
    if (matching.length !== 1) return false;
    const check = matching[0];
    if (check.status !== 'completed' || check.conclusion !== 'success') return false;
    const match = String(check.details_url ?? '')
      .match(/^https:\/\/github\.com\/usdimpact\/usd-impact-site\/actions\/runs\/([1-9]\d*)\/job\/[1-9]\d*$/);
    if (!match) return false;
    const runId = Number(match[1]);
    if (!Number.isSafeInteger(runId)) return false;
    const eligible = runs.filter((run) => run?.id === runId
      && run.event === 'pull_request' && run.head_sha === sha
      && run.status === 'completed' && run.conclusion === 'success'
      && run.repository?.full_name === REPOSITORY);
    if (eligible.length !== 1) return false;
  }
  return true;
}

/**
 * Returns an eligibility *assessment*, not an authorization or a side effect.
 * The owner must separately approve any executor of this candidate policy.
 */
export function assessLatePublication({
  enabled = false, now, currentMain, source, pr, compare, files, content,
  archiveSources, checks, checkWorkflowRuns, reviews, preview,
}) {
  const deny = (reason) => ({ eligible: false, reason });
  if (enabled !== true) return deny('owner-activation-not-approved');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return deny('invalid-current-clock');
  const edition = now.toISOString().slice(0, 10);
  const et = nyParts(now);
  if ([0, 6].includes(now.getUTCDay()) || et.day !== edition
      || et.minute < 8 * 60 + 30) return deny('not-same-day-late-weekday-window');
  if (!SHA.test(currentMain || '')) return deny('main-sha-not-pinned');
  if (!source || source.path !== SOURCE_PATH || source.repository?.full_name !== REPOSITORY
      || source.head_branch !== 'main' || source.head_sha !== currentMain
      || !ALLOWED_EVENTS.has(source.event) || source.run_attempt !== 1
      || source.status !== 'completed' || source.conclusion !== 'success'
      || !Number.isSafeInteger(source.id) || source.id < 1
      || !String(source.created_at ?? '').startsWith(edition + 'T')) {
    return deny('not-original-successful-late-workflow');
  }
  const branch = 'automation/daily-carryforward-' + edition + '-' + source.id;
  const file = 'apps/web/src/content/news/' + edition + '.md';
  if (!pr || pr.state !== 'open' || pr.draft !== false || pr.merged === true
      || pr.base?.ref !== 'main' || pr.base?.sha !== currentMain
      || pr.head?.ref !== branch || pr.head?.repo?.full_name !== REPOSITORY
      || !SHA.test(pr.head?.sha || '')
      || pr.title !== 'Publish Daily USD Impact — ' + edition + ' (late verified carry-forward)'
      || pr.mergeable !== true || pr.mergeable_state !== 'clean') {
    return deny('late-pr-identity-or-protection-drift');
  }
  const head = pr.head.sha;
  if (compare?.status !== 'ahead' || compare.ahead_by !== 1 || compare.behind_by !== 0
      || !Array.isArray(compare.files) || compare.files.length !== 1
      || compare.files[0].filename !== file || compare.files[0].status !== 'added'
      || !Array.isArray(files) || files.length !== 1
      || files[0].filename !== file || files[0].status !== 'added') {
    return deny('not-one-new-content-file');
  }
  const front = parseContent(content);
  if (!front || front.date !== edition || !String(front.summary ?? '').startsWith('Carry-forward context')
      || !String(front.marketRegime ?? '').startsWith('Carry-forward context')
      || !Array.isArray(front.sources) || !Array.isArray(front.highlights)
      || !Array.isArray(front.catalysts) || front.catalysts.length
      || front.sources.length < 3 || front.sources.length > MAX_SOURCES) {
    return deny('not-a-clearly-dated-carry-forward');
  }
  try { validateDailyContent(content, edition, files[0]); }
  catch { return deny('unsafe-daily-content-shape'); }

  // No new, invented or edited primary references: exact immutable records must
  // already appear in a trusted, previously published main-branch source ledger.
  if (!Array.isArray(archiveSources) || archiveSources.length > 100) return deny('missing-trusted-archive-ledger');
  const trusted = new Set(archiveSources.map((s) =>
    JSON.stringify([s?.id, s?.url, s?.publishedAt, s?.sourceType, s?.title, s?.publisher])));
  const seenUrls = new Set(), seenIds = new Set();
  const editionTime = dateMs(edition);
  for (const src of front.sources) {
    if (!src || src.sourceType !== 'primary'
        || typeof src.id !== 'string' || seenIds.has(src.id)
        || typeof src.url !== 'string' || seenUrls.has(src.url)
        || sourceDateBasisForUrl(src.url) !== SOURCE_DATE_BASIS.PUBLISHED
        || sourceDateAttributionIssue(src.url)
        || !trusted.has(JSON.stringify([src.id, src.url, src.publishedAt,
          src.sourceType, src.title, src.publisher]))) {
      return deny('source-not-identical-to-reviewed-original');
    }
    const published = dateMs(src.publishedAt);
    if (published === null || editionTime - published < 0
        || editionTime - published > 14 * DAY) return deny('source-outside-verified-age');
    seenUrls.add(src.url); seenIds.add(src.id);
  }

  if (!hasEligiblePullRequestChecks(checks, checkWorkflowRuns, head)) {
    return deny('genuine-exact-head-pull-request-checks-not-proven');
  }
  if (!preview || preview.state !== 'READY' || preview.target !== 'preview'
      || preview.commitSha !== head) return deny('exact-head-preview-not-ready');

  // Explicit approval of this exact commit, by the owner, with no subsequent
  // CHANGES_REQUESTED / DISMISSED record. Never infer approval from CI or labels.
  if (!Array.isArray(reviews) || reviews.length > 100) return deny('missing-review-history');
  const sorted = [...reviews].sort((a, b) =>
    Date.parse(a?.submitted_at ?? 0) - Date.parse(b?.submitted_at ?? 0));
  const ownerReviews = sorted.filter((review) => review?.user?.login === 'usdimpact');
  const latest = ownerReviews.at(-1);
  if (!latest || latest.state !== 'APPROVED' || latest.commit_id !== head
      || !Number.isFinite(Date.parse(latest.submitted_at))) {
    return deny('owner-exact-head-approval-missing');
  }
  return { eligible: true, reason: 'reviewed-late-pr-eligible-for-normal-protected-merge',
    headSha: head, baseSha: currentMain, edition, path: file };
}
