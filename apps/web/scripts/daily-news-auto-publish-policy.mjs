import { simplePublicationMarkdown } from './publication-ci-plan.mjs';

export const REPOSITORY = 'usdimpact/usd-impact-site';
export const REQUIRED_GENERATOR_STEPS = Object.freeze([
  'Start background news generation',
  'Poll background news generation',
  'Import as published content',
  'Validate publication content preflight',
  'Open and validate publication pull request',
]);
export const REQUIRED_CHECKS = Object.freeze([
  'validate-and-build',
  'Dependency review',
  'Reject Development-only Production migration files',
]);

export function beforeUsFirstRelease(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;
  // Morning publication only: stop before the typical 08:30 ET US data window.
  return hour * 60 + minute < 8 * 60 + 30;
}

export function validateSourceRun(run, jobs, mainSha, now = new Date()) {
  if (!run || run.status !== 'completed' || run.conclusion !== 'success'
      || !['schedule', 'workflow_dispatch'].includes(run.event)
      || run.path !== '.github/workflows/daily-news.yml'
      || run.head_branch !== 'main' || run.repository?.full_name !== REPOSITORY) {
    return 'not-a-successful-trusted-daily-run';
  }
  if (!/^[a-f0-9]{40}$/.test(mainSha || '') || run.head_sha !== mainSha) return 'main-has-moved';
  if (!Number.isSafeInteger(run.id) || run.id < 1) return 'invalid-source-run-id';
  const day = String(run.created_at || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)
      || day !== now.toISOString().slice(0, 10)
      || [0, 6].includes(now.getUTCDay())) return 'not-current-utc-weekday';
  if (!beforeUsFirstRelease(now)) return 'after-first-us-release-cutoff';
  if (!Array.isArray(jobs) || jobs.length !== 1
      || jobs[0].name !== 'build-and-publish'
      || jobs[0].conclusion !== 'success') return 'generator-job-not-successful';
  for (const name of REQUIRED_GENERATOR_STEPS) {
    const matches = (jobs[0].steps || []).filter((step) => step.name === name);
    if (matches.length !== 1 || matches[0].conclusion !== 'success') return 'generator-required-step-missing-or-failed';
  }
  return null;
}

export function isTrustedBackstop(backstops, run) {
  if (!Array.isArray(backstops) || backstops.length > 100) return false;
  const created = Date.parse(run?.created_at);
  if (!Number.isFinite(created)) return false;
  return backstops.some((entry) =>
    entry.path === '.github/workflows/daily-news-schedule-backstop.yml'
    && ['schedule', 'workflow_dispatch'].includes(entry.event)
    && entry.head_branch === 'main'
    && entry.head_sha === run.head_sha
    && entry.conclusion === 'success'
    && entry.status === 'completed'
    && created - Date.parse(entry.created_at) >= 0
    && created - Date.parse(entry.created_at) <= 120_000
  );
}

export function selectExactDailyPr(pulls, run, mainSha) {
  if (!Array.isArray(pulls) || pulls.length >= 100) throw new Error('open-pr-evidence-incomplete');
  const day = run.created_at.slice(0, 10);
  const expectedBranch = 'automation/daily-usd-impact-' + day + '-' + run.id;
  const matches = pulls.filter((pr) =>
    pr.state === 'open' && !pr.draft
    && pr.base?.ref === 'main' && pr.base?.sha === mainSha
    && pr.head?.ref === expectedBranch
    && pr.head?.repo?.full_name === REPOSITORY
    && pr.title === 'Publish Daily USD Impact — ' + day
  );
  if (matches.length !== 1) throw new Error('exact-daily-pr-not-unique');
  const pr = matches[0];
  if (!Number.isSafeInteger(pr.number) || pr.number < 1
      || !/^[a-f0-9]{40}$/.test(pr.head.sha)) throw new Error('invalid-daily-pr-identity');
  return { prNumber: pr.number, branch: expectedBranch, headSha: pr.head.sha, editionDate: day };
}

export function validateDailyContent(content, editionDate, file) {
  const bytes = Buffer.from(String(content), 'utf8');
  const expectedFile = 'apps/web/src/content/news/' + editionDate + '.md';
  if (!file || file.filename !== expectedFile || file.status !== 'added'
      || !simplePublicationMarkdown(bytes)) throw new Error('not-a-single-safe-new-daily');
  const esc = editionDate.replace(/-/g, '\\-');
  if (!(new RegExp('^date: "' + esc + '"$', 'm')).test(content)
      || !(new RegExp('^slug: "/news/' + esc + '"$', 'm')).test(content)
      || !(new RegExp('^lastReviewed: "' + esc + '"$', 'm')).test(content)
      || !(new RegExp('^generatedAt: "' + esc + 'T', 'm')).test(content)
      || !/^status: "published"$/m.test(content)
      || !/^complianceNote: "Educational and informational only\./m.test(content)) {
    throw new Error('daily-date-or-compliance-drift');
  }
  const sourceCount = (content.match(/^  - id: "[a-z0-9-]+"$/gm) || []).length;
  const primaryCount = (content.match(/^    sourceType: "primary"$/gm) || []).length;
  const headlineCount = (content.split('\ncatalysts:')[0].match(/^  - headline: /gm) || []).length;
  if (sourceCount < 3 || sourceCount > 24 || sourceCount !== primaryCount
      || headlineCount < 3 || headlineCount > 7) throw new Error('not-three-primary-sourced-highlights');
  return { sourceCount, headlineCount };
}

export function requireExactChecks(checkRuns, headSha) {
  if (!Array.isArray(checkRuns) || checkRuns.length < REQUIRED_CHECKS.length) {
    throw new Error('missing-required-check-evidence');
  }
  for (const name of REQUIRED_CHECKS) {
    const matching = checkRuns
      .filter((check) => check.name === name && check.head_sha === headSha
        && check.app?.slug === 'github-actions')
      .sort((a, b) => (b.id || 0) - (a.id || 0));
    if (!matching.length || matching[0].status !== 'completed' || matching[0].conclusion !== 'success') {
      throw new Error('required-check-not-successful-' + name.replace(/[^a-z]+/gi, '-').toLowerCase());
    }
  }
  return true;
}
