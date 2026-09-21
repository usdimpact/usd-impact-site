import { appendFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REPOSITORY = 'usdimpact/usd-impact-site';
const SHA = /^[a-f0-9]{40}$/;
const MAX_FILES = 10;
const MAX_BYTES = 262144;
const MAX_TOTAL_BYTES = 1048576;
const MAX_BASELINE_AGE_MS = 72 * 60 * 60 * 1000;
const ROOT_KEYS = new Set(('title metaTitle metaDescription slug date generatedAt lastReviewed status category '
  + 'marketRegime summary featured assets highlights catalysts sources complianceNote eventKey event eventDate '
  + 'calendar sourceEditionDate phase statusLabel verifiedFacts transmissionChannels whatToWatch').split(' '));

function full(reason) { return { route: 'full', reason }; }
function execute(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  if (result.error || result.status !== 0) throw new Error('evidence-command-failed');
  return result.stdout;
}
function git(args, cwd) { return execute('git', args, cwd); }

// Routing is not source verification, a Markdown sanitizer, or permission to publish.
// Deliberately recognize only the simple serialization used by the two importers.
export function simplePublicationMarkdown(bytes) {
  if (bytes.length > MAX_BYTES) return false;
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return false; }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<]/.test(text)) return false;
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return false;
  const seen = new Set();
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^[ \t]/.test(line)) {
      // Match a whole importer-serialized nested line, not just its indentation.
      const nested = line.match(/^( {2,})(?:- )?(?:([A-Za-z][A-Za-z0-9]*):(?: (.*))?|(".*"))$/);
      if (!nested || nested[1].length % 2) return false;
      const value = nested[3] ?? nested[4] ?? '';
      if (value) {
        try {
          const parsed = JSON.parse(value);
          const scalar = parsed === null || ['string', 'boolean'].includes(typeof parsed) || Number.isSafeInteger(parsed);
          const calendar = nested[2] === 'calendar' && parsed && typeof parsed === 'object' && !Array.isArray(parsed);
          if (!scalar && !calendar) return false;
        } catch { return false; }
      }
      continue;
    }
    const entry = line.match(/^([A-Za-z][A-Za-z0-9]*):(?: (.*))?$/);
    if (!entry || !ROOT_KEYS.has(entry[1]) || seen.has(entry[1])) return false;
    seen.add(entry[1]);
    const value = entry[2] ?? '';
    if (value && !/^(?:"|true$|false$|null$|\{)/.test(value)) return false;
    if (value.startsWith('"')) {
      try { if (typeof JSON.parse(value) !== 'string') return false; } catch { return false; }
    } else if (value.startsWith('{')) {
      if (entry[1] !== 'calendar') return false;
      try { JSON.parse(value); } catch { return false; }
    }
  }
  return ['title', 'slug', 'status', 'sources', 'complianceNote'].every((key) => seen.has(key));
}

export function parseAddedPublications(raw) {
  if (!raw || !raw.endsWith('\0')) return null;
  const parts = raw.slice(0, -1).split('\0');
  if (parts.length % 2 || parts.length > MAX_FILES * 2) return null;
  const files = [];
  for (let i = 0; i < parts.length; i += 2) {
    const header = parts[i].match(/^:000000 100644 0{40} ([a-f0-9]{40}) A$/);
    const path = parts[i + 1];
    const daily = /^apps\/web\/src\/content\/news\/\d{4}-\d{2}-\d{2}\.md$/.test(path);
    const catalyst = /^apps\/web\/src\/content\/catalyst-briefs\/\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*-(?:preview|outcome)\.md$/.test(path);
    if (!header || !(daily || catalyst) || path.length > 240) return null;
    if (files.some((file) => file.path === path)) return null;
    files.push({ path, sha: header[1] });
  }
  return files.length ? files : null;
}

export function publicationContext(env, event) {
  const base = env.PUBLICATION_POLICY_BASE_SHA;
  if (env.GITHUB_REPOSITORY !== REPOSITORY || !SHA.test(base ?? '') || !SHA.test(env.GITHUB_SHA ?? '')) return null;
  if (env.GITHUB_EVENT_NAME === 'pull_request') {
    const pr = event?.pull_request;
    if (pr?.state !== 'open' || pr.base?.ref !== 'main' || pr.base?.sha !== base
      || pr.base?.repo?.full_name !== REPOSITORY || pr.head?.repo?.full_name !== REPOSITORY
      || !SHA.test(pr.head?.sha ?? '')) return null;
    return { base, head: pr.head.sha, checkout: env.GITHUB_SHA, event: 'pull_request' };
  }
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    if (env.PUBLICATION_BASE_SHA !== base || env.PUBLICATION_HEAD_SHA !== env.GITHUB_SHA) return null;
    return { base, head: env.GITHUB_SHA, checkout: env.GITHUB_SHA, event: 'workflow_dispatch' };
  }
  // In particular, every push to main still runs the complete platform suite.
  return null;
}

export function successfulFullBaseline(payload, base, now = Date.now()) {
  if (!payload || !Number.isSafeInteger(payload.total_count) || payload.total_count < 0
    || payload.total_count > 100 || !Array.isArray(payload.workflow_runs)
    || payload.workflow_runs.length !== payload.total_count) return null;
  const runs = payload.workflow_runs.filter((run) => run.path === '.github/workflows/quality.yml');
  if (!runs.length || runs.some((run) => !Number.isSafeInteger(run.id))) return null;
  const latest = [...runs].sort((a, b) => b.id - a.id)[0];
  const updated = Date.parse(latest.updated_at);
  if (latest.name !== 'Web quality' || latest.event !== 'push' || latest.head_branch !== 'main'
    || latest.head_sha !== base || latest.repository?.full_name !== REPOSITORY
    || latest.status !== 'completed' || latest.conclusion !== 'success'
    || !Number.isFinite(updated) || updated > now || now - updated > MAX_BASELINE_AGE_MS) return null;
  return latest.id;
}

export function inspectPublicationDiff(context, cwd) {
  const { base, head, checkout, event } = context;
  if (![base, head, checkout].every((sha) => SHA.test(sha ?? ''))) return full('invalid-revisions');
  if (git(['rev-parse', 'HEAD'], cwd).trim() !== checkout) return full('checkout-drift');
  if (git(['rev-parse', 'refs/remotes/origin/main'], cwd).trim() !== base) return full('base-drift');
  if (git(['rev-parse', `${base}^{commit}`], cwd).trim() !== base
    || git(['rev-parse', `${head}^{commit}`], cwd).trim() !== head) return full('invalid-commits');
  git(['merge-base', '--is-ancestor', base, head], cwd);
  if (checkout !== head) {
    const parents = git(['show', '-s', '--format=%P', checkout], cwd).trim();
    if (event !== 'pull_request' || parents !== `${base} ${head}`) return full('unbound-merge-checkout');
    if (git(['rev-parse', `${checkout}^{tree}`], cwd) !== git(['rev-parse', `${head}^{tree}`], cwd)) return full('merge-tree-drift');
  }
  const raw = git(['diff', '--raw', '-z', '--no-renames', '--no-ext-diff', '--no-textconv', '--abbrev=40', base, head, '--'], cwd);
  const files = parseAddedPublications(raw);
  if (!files) return full('not-new-publication-only');
  let bytes = 0;
  for (const file of files) {
    const result = spawnSync('git', ['cat-file', 'blob', file.sha], {
      cwd, timeout: 10000, maxBuffer: MAX_BYTES + 1,
      env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' },
    });
    if (result.error || result.status !== 0 || !simplePublicationMarkdown(result.stdout)) return full('nonstandard-publication-content');
    bytes += result.stdout.length;
    if (bytes > MAX_TOTAL_BYTES) return full('publication-size-limit');
  }
  return { route: 'content-only', reason: 'verified-addition-only-diff', base, head, files: files.map((file) => file.path) };
}

export function planPublicationCI({ env = process.env, event = {}, cwd = process.cwd(), loadRuns, now = Date.now() } = {}) {
  try {
    const context = publicationContext(env, event);
    if (!context) return full('full-or-unverified-event');
    const plan = inspectPublicationDiff(context, cwd);
    if (plan.route !== 'content-only') return plan;
    const payload = loadRuns ? loadRuns(context.base) : JSON.parse(execute('gh', [
      'api', `repos/${REPOSITORY}/actions/runs?head_sha=${context.base}&event=push&branch=main&per_page=100`,
    ], cwd));
    const baselineRunId = successfulFullBaseline(payload, context.base, now);
    if (!baselineRunId) return full('full-baseline-unverified');
    return { ...plan, baselineRunId };
  } catch {
    // No exception, API outage, shallow clone, truncated diff or unknown evidence can opt in.
    return full('evidence-unavailable');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let event = {};
  try { event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')); } catch { /* full fallback for PRs */ }
  const plan = planPublicationCI({ event });
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `route=${plan.route}\nreason=${plan.reason}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## Publication validation route\n\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\n`
    + 'Routing is not factual approval, required-check approval, Preview readiness or merge authorization. '
    + 'Full main-push validation, source/editorial review, calendar enforcement and release controls remain required.\n');
  console.log(JSON.stringify(plan));
}
