/**
 * USD Impact S-1: manually invoked, read-only advisory.
 * NOT a merge gate, release approval, deploy controller or publishing command.
 * No PR-head code is checked out or executed; official data is freshly fetched.
 */
import { createHash } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const ADVISORY_SCOPE = 'ADVISORY - not a merge, deployment or publication authorization.';
export const S1_REPOSITORY = 'usdimpact/usd-impact-site';
export const S1_MARGIN_MS = 60 * 60 * 1000;
const SHA = /^[a-f0-9]{40}$/;
const CATALYST = 'apps/web/src/content/catalyst-briefs/';
const NEWS = 'apps/web/src/content/news/';
const FLAT_CATALYST = /^apps\/web\/src\/content\/catalyst-briefs\/[a-z0-9-]+\.md$/;
const MAX_FILES = 100;
const MAX_SNAPSHOT = 500;
const MAX_FILE_BYTES = 256000;
const PASS = new Set(['PASS', 'NO_PUBLICATION_DECISION', 'ARCHIVE_EDIT', 'NO_CONTENT_CHANGE']);
const sum = (value) => createHash('sha256').update(value).digest('hex');

class AdvisoryHold extends Error {
  constructor(code, detail = '') { super(detail || code); this.code = code; }
}
const hold = (code, message) => { throw new AdvisoryHold(code, message); };
const checkedSha = (s) => SHA.test(s ?? '') || hold('HOLD_INVALID_SHA', 'Expected a full 40-character lower-case SHA.');
const iso = (t) => Number.isFinite(t) ? new Date(t).toISOString() : null;
const safeKey = (p) => encodeURIComponent(p).replaceAll('%2F', '/');
const fullRoute = (path) => `/repos/${S1_REPOSITORY}${path}`;

/** GitHub GET-only transport. The token is never printed, persisted, or put in outputs. */
export async function readGithub(route, { token = process.env.GITHUB_TOKEN, fetchImpl = globalThis.fetch } = {}) {
  if (!route.startsWith(fullRoute('/')) || !token || typeof token !== 'string') hold('HOLD_GITHUB_READ', 'Read-only GitHub access is not available.');
  let response;
  try {
    response = await fetchImpl(`https://api.github.com${route}`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
  } catch { hold('HOLD_GITHUB_READ', 'GitHub read failed or timed out.'); }
  if (!response.ok) hold('HOLD_GITHUB_READ', `GitHub read returned ${response.status}.`);
  try {
    const body = await response.text();
    if (Buffer.byteLength(body) > 8_000_000) hold('HOLD_GITHUB_READ', 'GitHub response exceeded the bounded size.');
    return JSON.parse(body);
  } catch (error) {
    if (error instanceof AdvisoryHold) throw error;
    hold('HOLD_GITHUB_READ', 'GitHub returned an invalid response.');
  }
}

function decodeBase64File(file, bound = MAX_FILE_BYTES) {
  if (!file || file.encoding !== 'base64' || typeof file.content !== 'string') hold('HOLD_CONTENT_READ', 'File content is not verified base64.');
  const raw = file.content.replace(/\s/g, '');
  if (raw.length > Math.ceil(bound / 3) * 4 + 8 || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) hold('HOLD_CONTENT_READ', 'Invalid or oversized file encoding.');
  const bytes = Buffer.from(raw, 'base64');
  if (bytes.length > bound || bytes.toString('base64') !== raw) hold('HOLD_CONTENT_READ', 'File encoding failed round-trip verification.');
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) hold('HOLD_CONTENT_READ', 'File is not UTF-8.');
  return text;
}

async function blob(api, sha) {
  checkedSha(sha);
  const result = await api(fullRoute(`/git/blobs/${sha}`));
  if (result.sha !== sha) hold('HOLD_CONTENT_READ', 'Blob identity changed.');
  return decodeBase64File(result);
}
async function refMain(api) {
  const r = await api(fullRoute('/git/ref/heads/main'));
  if (!r?.object?.sha || !SHA.test(r.object.sha)) hold('HOLD_REVISION_DRIFT', 'Main ref could not be verified.');
  return r.object.sha;
}
async function readPr(api, number) {
  const r = await api(fullRoute(`/pulls/${number}`));
  if (r?.number !== number || r?.state !== 'open' || r?.base?.ref !== 'main' || !r?.head?.sha || !r?.base?.sha) {
    hold('HOLD_REVISION_DRIFT', 'PR identity, state, or base is different.');
  }
  return r;
}
async function changedFiles(api, number) {
  const all = [];
  for (let page = 1; page <= 2; page++) {
    const chunk = await api(fullRoute(`/pulls/${number}/files?per_page=100&page=${page}`));
    if (!Array.isArray(chunk) || chunk.length > MAX_FILES) hold('HOLD_INCOMPLETE_FILE_LIST', 'Invalid PR file page.');
    all.push(...chunk);
    if (all.length > MAX_FILES) hold('HOLD_INCOMPLETE_FILE_LIST', 'More than 100 changed files.');
    if (chunk.length < MAX_FILES) {
      if (all.some(x => !x || typeof x.filename !== 'string') || new Set(all.map(x => x.filename)).size !== all.length) {
        hold('HOLD_INCOMPLETE_FILE_LIST', 'Unexpected or duplicated file record.');
      }
      return all;
    }
  }
  hold('HOLD_INCOMPLETE_FILE_LIST', 'File scan did not end with a short page.');
}
async function contentAt(api, sha, file) {
  checkedSha(sha);
  if (!FLAT_CATALYST.test(file)) hold('HOLD_UNEXPECTED_CATALYST_PATH', 'Unexpected catalyst file path.');
  const r = await api(fullRoute(`/contents/${safeKey(file)}?ref=${sha}`));
  if (r?.type !== 'file' || !SHA.test(r.sha ?? '')) hold('HOLD_CONTENT_READ', 'File identity cannot be confirmed.');
  return decodeBase64File(r);
}
function nowMs(clock) {
  const t = clock();
  if (!Number.isSafeInteger(t) || t < 0) hold('HOLD_INVALID_CLOCK', 'The trusted runner clock is invalid.');
  return t;
}
function releaseFields(record, clock) {
  const a = Date.parse(record.event?.releaseAt ?? '');
  if (!Number.isFinite(a)) hold('HOLD_SOURCE_SCHEMA', 'No verified official release instant.');
  const t = nowMs(clock);
  const until = record.event?.phase === 'preview'
    ? Math.min(a - S1_MARGIN_MS, Date.parse(record.validUntil ?? ''))
    : Date.parse(record.validUntil ?? '');
  if (!Number.isFinite(until)) hold('HOLD_EVIDENCE_STALE', 'Evidence expiry is unavailable.');
  const timeNY = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short', hour12: true,
  }).format(new Date(a));
  return { releaseAtUTC: iso(a), releaseAtNewYork: timeNY, minutesToRelease: Math.floor((a - t) / 60000), validUntil: iso(until),
    sources: (record.sources ?? []).map(x => ({ url: x.url, fetchedAt: x.fetchedAt })).filter(x => typeof x.url === 'string' && x.url.startsWith('https://')) };
}
/** Remove precisely the top-level archiveNote YAML block, leaving all other bytes unchanged. */
export function withoutArchiveNote(markdown) {
  if (typeof markdown !== 'string') hold('HOLD_SOURCE_FRONTMATTER');
  const lines = markdown.split('\n');
  if (lines[0]?.trim() !== '---') hold('HOLD_SOURCE_FRONTMATTER');
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end < 1) hold('HOLD_SOURCE_FRONTMATTER');
  let seen = false;
  const out = [];
  let skipping = false;
  for (const [i, line] of lines.entries()) {
    if (i > 0 && i < end) {
      if (/^archiveNote:/.test(line)) { seen = true; skipping = true; continue; }
      if (skipping && (/^[ \t]/.test(line) || !line.trim())) continue;
      skipping = false;
    }
    out.push(line);
  }
  return { seen, rest: out.join('\n') };
}
export function archiveNoteOnly(before, after, parse) {
  if (!before || !after) return false;
  const b = parse(before), a = parse(after);
  if (b.phase !== 'preview' || a.phase !== 'preview' || b.status !== 'published' || a.status !== 'published') return false;
  const x = withoutArchiveNote(before), y = withoutArchiveNote(after);
  if (!y.seen || x.rest !== y.rest || before === after) return false;
  // Archive notes must remain strictly after the event date, like the Astro schema.
  const eventDate = after.match(/^eventDate:\s*"?(20\d{2}-\d{2}-\d{2})"?\s*$/m)?.[1];
  const addedAt = after.match(/^  addedAt:\s*"?(20\d{2}-\d{2}-\d{2})"?\s*$/m)?.[1];
  const realDate = (d) => d && Number.isFinite(Date.parse(d + 'T00:00:00Z'))
    && new Date(Date.parse(d + 'T00:00:00Z')).toISOString().slice(0, 10) === d;
  return Boolean(realDate(eventDate) && realDate(addedAt) && addedAt > eventDate);
}
async function getPolicy(deps) {
  if (deps.parse && deps.verify && deps.freshness && deps.classify) return deps;
  const [calendar, parser] = await Promise.all([
    import('../src/lib/publication-calendar.js'),
    import('../src/lib/publication-calendar-pr-guard.js'),
  ]);
  return { ...deps, parse: deps.parse ?? parser.parseGuardedCatalystSource,
    verify: deps.verify ?? calendar.verifyPublicationCalendar,
    freshness: deps.freshness ?? calendar.checkCalendarDecisionFreshness,
    classify: deps.classify ?? calendar.classifyPublicationSnapshots };
}
const label = (decision) => decision === 'HOLD_PREVIEW_EXPIRED' ? 'BLOCK_PREVIEW_EXPIRED' : decision;

async function assessOne(raw, oldRaw, binding, deps, clock) {
  const parsed = deps.parse(raw); // May parse, never trust its calendar classification.
  if (!['preview', 'outcome'].includes(parsed.phase) || !['published', 'draft', 'review', 'ready-for-build'].includes(parsed.status)) {
    return { decision: 'HOLD_SOURCE_SCHEMA', reason: 'Unknown phase or status.' };
  }
  if (archiveNoteOnly(oldRaw, raw, deps.parse)) return { decision: 'ARCHIVE_EDIT', reason: 'Only an already-published preview archive note changed.' };
  if (parsed.status !== 'published') return { decision: 'NO_PUBLICATION_DECISION', reason: 'Not a publication-status candidate.' };
  if (!parsed.calendar) return { decision: /\bBLS\b/i.test(parsed.event) && /Consumer Price Index|Producer Price Index|Employment Situation/i.test(parsed.event)
    ? 'HOLD_MISSING_CALENDAR_RECORD' : 'HOLD_UNSUPPORTED_EVENT', reason: 'No supported official calendar record.' };
  const candidate = { ...parsed.calendar, event: parsed.event, phase: parsed.phase, statusLabel: parsed.statusLabel };
  const official = await deps.verify(candidate, { binding, now: clock });
  if (official?.decision !== 'PASS') return { decision: label(official?.decision ?? 'HOLD_SOURCE_UNAVAILABLE'), reason: official?.reason ?? 'Official verification did not pass.' };
  const details = releaseFields(official, clock);
  const fresh = deps.freshness(official, { binding, now: clock });
  if (fresh !== 'PASS') return { decision: label(fresh), reason: 'Freshness or decision binding failed.', ...details };
  const remain = Date.parse(official.event.releaseAt) - nowMs(clock);
  if (parsed.phase === 'preview' && remain <= 0) return { decision: 'BLOCK_PREVIEW_EXPIRED', reason: 'Verified release instant has passed.', ...details };
  if (parsed.phase === 'preview' && remain < S1_MARGIN_MS) return { decision: 'HOLD_FRESHNESS_SAFETY_WINDOW', reason: 'Less than 60 minutes remain before the official release.', ...details };
  if (nowMs(clock) >= Date.parse(details.validUntil)) return { decision: 'HOLD_EVIDENCE_STALE', reason: 'Official evidence or safety margin has expired.', ...details };
  return { decision: 'PASS', reason: 'Official schedule, identity, phase, revision and 60-minute margin verified.', ...details };
}

function aggregate(items, noChange = 'NO_PUBLICATION_DECISION') {
  if (items.length === 0) return { decision: noChange, reason: 'No guarded publication change requires an advisory.', items };
  const firstBad = items.find(x => !PASS.has(x.decision));
  if (firstBad) return { decision: firstBad.decision, reason: firstBad.reason, items };
  if (items.some(x => x.decision === 'PASS')) return { decision: 'PASS', reason: 'All guarded items passed.', items };
  if (items.every(x => x.decision === 'ARCHIVE_EDIT')) return { decision: 'ARCHIVE_EDIT', reason: 'Archive-only editorial changes.', items };
  return { decision: noChange, reason: 'No guarded publication change requires an advisory.', items };
}

async function confirmPrStillBound(api, number, head, base) {
  const [pr, main] = await Promise.all([readPr(api, number), refMain(api)]);
  if (main !== base || pr.head.sha !== head || pr.base.sha !== base) hold('HOLD_REVISION_DRIFT', 'Head or base moved while checking.');
}

async function preMerge(input, deps, api, clock) {
  const { prNumber, expectedHeadSha: head, expectedBaseSha: base } = input;
  if (!Number.isSafeInteger(prNumber) || prNumber < 1 || prNumber > 99999999) hold('HOLD_INVALID_INPUT', 'A valid PR number is required.');
  checkedSha(head); checkedSha(base);
  await confirmPrStillBound(api, prNumber, head, base);
  const files = await changedFiles(api, prNumber);
  const publications = files.filter(x => x.filename.startsWith(CATALYST) || String(x.previous_filename ?? '').startsWith(CATALYST));
  const items = [];
  const records = [];
  const policy = await getPolicy(deps);
  for (const file of publications) {
    if (!FLAT_CATALYST.test(file.filename) || !['added', 'modified'].includes(file.status) || !SHA.test(file.sha ?? '')) {
      hold(file.status === 'removed' ? 'HOLD_PUBLICATION_DELETION' : 'HOLD_UNEXPECTED_CATALYST_PATH', 'Changed catalyst path cannot be evaluated safely.');
    }
    const raw = await blob(api, file.sha);
    records.push([file.filename, sum(raw)]);
    const oldRaw = file.status === 'modified' ? await contentAt(api, base, file.filename) : null;
    items.push({ path: file.filename, status: file.status, raw, oldRaw });
  }
  const binding = { repository: S1_REPOSITORY, base, head,
    contentSha256: sum(JSON.stringify(records.sort((a,b)=>a[0].localeCompare(b[0])))) };
  const reviewed = [];
  for (const item of items) {
    let verdict;
    try { verdict = await assessOne(item.raw, item.oldRaw, binding, policy, clock); }
    catch (error) { verdict = { decision: error instanceof AdvisoryHold ? error.code : 'HOLD_SOURCE_SCHEMA', reason: 'The content could not be safely assessed.' }; }
    reviewed.push({ path: item.path, status: item.status, sha256: sum(item.raw), ...verdict });
  }
  await confirmPrStillBound(api, prNumber, head, base);
  const summary = aggregate(reviewed);
  const daily = files.filter(f => f.filename.startsWith(NEWS)).map(f => f.filename);
  return { ...summary, binding, prNumber, headSha: head, baseSha: base,
    informational: daily.length ? [{ code: 'OUT_OF_SCOPE_DAILY', count: daily.length, note: 'No Daily publication authorization.' }] : [] };
}

async function treeSnapshot(api, commitSha) {
  checkedSha(commitSha);
  let treeSha;
  try {
    const c = await api(fullRoute(`/git/commits/${commitSha}`));
    treeSha = c?.tree?.sha;
  } catch { hold('HOLD_UNKNOWN_TARGET', 'Target commit is unavailable.'); }
  if (!SHA.test(treeSha ?? '')) hold('HOLD_UNKNOWN_TARGET', 'Commit tree is unavailable.');
  const tree = await api(fullRoute(`/git/trees/${treeSha}?recursive=1`));
  if (tree?.truncated !== false || !Array.isArray(tree.tree) || tree.tree.length > 25000) hold('HOLD_SNAPSHOT_INCOMPLETE', 'A complete Git tree is required.');
  const candidates = tree.tree.filter(x => x?.path?.startsWith(CATALYST));
  if (candidates.length > MAX_SNAPSHOT || candidates.some(x => x.type !== 'blob' || !SHA.test(x.sha ?? '') || !FLAT_CATALYST.test(x.path))) {
    hold('HOLD_SNAPSHOT_INCOMPLETE', 'Unexpected or excessive catalyst content.');
  }
  const map = {};
  for (const item of candidates) map[item.path] = await blob(api, item.sha);
  return map;
}

async function preAlias(input, deps, api, clock) {
  const { targetSha: target, expectedMainSha: main } = input;
  checkedSha(target); checkedSha(main);
  const live = await refMain(api);
  if (live !== main) hold('HOLD_REVISION_DRIFT', 'Main moved before checking the target.');
  // Even a current-SHA redeploy must refer to a real, readable commit.
  const targetCommit = await api(fullRoute(`/git/commits/${target}`));
  if (targetCommit?.sha !== target) hold('HOLD_UNKNOWN_TARGET', 'The target is not a verified commit.');
  let result;
  const policy = await getPolicy(deps);
  if (target === main) result = { decision: 'NO_CONTENT_CHANGE', reason: 'Same source SHA, but time-dependent build output may differ.', items: [] };
  else {
    const [mainSnap, targetSnap] = await Promise.all([treeSnapshot(api, main), treeSnapshot(api, target)]);
    const delta = policy.classify(mainSnap, targetSnap);
    const changed = delta.filter(x => x.change !== 'unchanged');
    if (changed.some(x => x.change === 'deleted')) result = { decision: 'HOLD_CONTENT_REGRESSION', reason: 'Target lacks current catalyst content.', items: changed };
    else {
      const records = Object.entries(targetSnap).map(([path, raw]) => [path, sum(raw)]).sort((a,b)=>a[0].localeCompare(b[0]));
      const binding = { repository: S1_REPOSITORY, base: main, head: target, contentSha256: sum(JSON.stringify(records)) };
      const items = [];
      for (const item of changed) {
        const raw = targetSnap[item.file];
        let assessment;
        try { assessment = await assessOne(raw, mainSnap[item.file] ?? null, binding, policy, clock); }
        catch { assessment = { decision: 'HOLD_TARGET_DIFFERS', reason: 'Changed target cannot be verified.' }; }
        if (assessment.decision === 'NO_PUBLICATION_DECISION' || assessment.decision === 'ARCHIVE_EDIT') {
          assessment = { decision: 'HOLD_TARGET_DIFFERS', reason: 'Target differs from current published content.' };
        }
        items.push({ path: item.file, change: item.change, ...assessment });
      }
      result = aggregate(items, 'NO_CONTENT_CHANGE');
      result.binding = binding;
    }
  }
  if (await refMain(api) !== main) hold('HOLD_REVISION_DRIFT', 'Main moved during evaluation.');
  return { ...result, targetSha: target, mainSha: main, nextStep: 'Verify the production aliases after any separately authorized action.' };
}

/**
 * Main test seam. api(route) must be GET-only and return parsed GitHub JSON.
 * verify/freshness/parse/classify seams are for synthetic offline tests only.
 */
export async function runPreActAdvisory(input, { api = readGithub, now = Date.now, ...deps } = {}) {
  const output = { schemaVersion: 'usd-impact/pre-act-advisory/v1', scope: ADVISORY_SCOPE,
    repository: S1_REPOSITORY, mode: input?.mode ?? null, decision: 'HOLD_INVALID_INPUT', reason: 'Invalid input.',
    publicationAttempted: false, publicationAuthorized: false, checkedAt: null };
  try {
    if (!['pre-merge', 'pre-alias'].includes(input?.mode)) hold('HOLD_INVALID_INPUT', 'Mode must be pre-merge or pre-alias.');
    const begin = nowMs(now);
    const result = input.mode === 'pre-merge' ? await preMerge(input, deps, api, now) : await preAlias(input, deps, api, now);
    if (nowMs(now) < begin) hold('HOLD_INVALID_CLOCK', 'Clock moved backward during the advisory.');
    const final = { ...output, ...result, checkedAt: iso(nowMs(now)), publicationAttempted: false, publicationAuthorized: false };
    if (final.decision === 'PASS' && Array.isArray(final.items)) {
      const expires = final.items.map(x => Date.parse(x.validUntil ?? '')).filter(Number.isFinite);
      if (expires.length && nowMs(now) >= Math.min(...expires)) {
        return { ...final, decision: 'HOLD_EVIDENCE_STALE', reason: 'Evidence expired before output was recorded.' };
      }
    }
    return final;
  } catch (error) {
    return { ...output, decision: error instanceof AdvisoryHold ? error.code : 'HOLD_INTERNAL_ERROR',
      reason: error instanceof AdvisoryHold ? error.message : 'The advisory could not be completed.', checkedAt: iso(Date.now()) };
  }
}

export function statusCode(result) { return PASS.has(result.decision) ? 0 : 2; }
export function renderSummary(result) {
  const lines = [
    '### Publication pre-act advisory (manual only)',
    `**${ADVISORY_SCOPE}**`,
    `**Decision:** \`${result.decision}\` — ${result.reason}`,
    `**Repository:** \`${result.repository}\`; **mode:** \`${result.mode}\``,
    `**Revision:** head \`${result.headSha ?? result.targetSha ?? 'n/a'}\`; main/base \`${result.baseSha ?? result.mainSha ?? 'n/a'}\``,
    `**Content SHA-256:** \`${result.binding?.contentSha256 ?? 'n/a'}\``,
    `**Checked at (UTC):** ${result.checkedAt ?? 'unknown'}`,
  ];
  for (const x of result.items ?? []) {
    lines.push(`- ${x.path}: **${x.decision}**${x.releaseAtUTC ? `; release ${x.releaseAtUTC} (${x.releaseAtNewYork})` : ''}${x.minutesToRelease !== undefined ? `; ${x.minutesToRelease} min` : ''}${x.validUntil ? `; valid until ${x.validUntil}` : ''}`);
    for (const s of x.sources ?? []) lines.push(`  - Official: ${s.url} (fetched ${s.fetchedAt})`);
  }
  for (const x of result.informational ?? []) lines.push(`- Info: ${x.code} (${x.count}), not a Daily release authorization.`);
  lines.push(`**Next step:** ${result.nextStep ?? (statusCode(result) === 0 ? 'Verify exact SHA and time again before acting; rerun after drift or expiry.' : 'HOLD. Do not merge, promote, deploy or publish based on this result.')}`);
  return lines.join('\n') + '\n';
}

function inputFromArgs(args, env) {
  if (args.length) {
    const keys = new Set(['--mode', '--pr-number', '--expected-head-sha', '--expected-base-sha', '--target-sha', '--expected-main-sha']);
    if (args.length % 2 !== 0) hold('HOLD_INVALID_INPUT');
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!keys.has(args[i]) || Object.hasOwn(options, args[i])) hold('HOLD_INVALID_INPUT');
      options[args[i]] = args[i+1];
    }
    env = { S1_MODE: options['--mode'], S1_PR: options['--pr-number'],
      S1_HEAD: options['--expected-head-sha'], S1_BASE: options['--expected-base-sha'],
      S1_TARGET: options['--target-sha'], S1_MAIN: options['--expected-main-sha'] };
  }
  return { mode: env.S1_MODE,
    prNumber: Number(env.S1_PR), expectedHeadSha: env.S1_HEAD, expectedBaseSha: env.S1_BASE,
    targetSha: env.S1_TARGET, expectedMainSha: env.S1_MAIN };
}

export async function main(args = process.argv.slice(2), env = process.env, { run = runPreActAdvisory, write = console.log, saveSummary = appendFile } = {}) {
  let result;
  try { result = await run(inputFromArgs(args, env)); }
  catch { result = { schemaVersion: 'usd-impact/pre-act-advisory/v1', scope: ADVISORY_SCOPE, repository: S1_REPOSITORY,
    mode: null, decision: 'HOLD_INVALID_INPUT', reason: 'Invalid command line input.', publicationAttempted: false, publicationAuthorized: false }; }
  write(JSON.stringify(result, null, 2));
  if (env.GITHUB_STEP_SUMMARY) await saveSummary(env.GITHUB_STEP_SUMMARY, renderSummary(result));
  return statusCode(result);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
