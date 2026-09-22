import { execFileSync } from 'node:child_process';
import { appendFile, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REPOSITORY = 'usdimpact/usd-impact-site';
const ROOT = `repos/${REPOSITORY}`;
const DAILY_PATH = '.github/workflows/daily-news.yml';
const BACKSTOP_PATH = '.github/workflows/daily-news-schedule-backstop.yml';
const SHA = /^[a-f0-9]{40}$/;
const ID = /^[1-9][0-9]{0,15}$/;
const RESPONSE_ID = /^resp_[A-Za-z0-9_-]{8,200}$/;
const ACTIVE = new Set(['queued', 'in_progress']);
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'incomplete']);
const RUN_STATUSES = new Set(['completed', 'queued', 'in_progress', 'requested', 'waiting', 'pending']);
const CONCLUSIONS = new Set(['success', 'failure', 'cancelled', 'timed_out', 'neutral', 'skipped', 'action_required', 'stale', 'startup_failure']);
const KINDS = new Set(['create-requested', 'start-response', 'application-poll', 'application-result', 'unavailable']);
const MAX_PAGES = 20;
const PAGE_SIZE = 100;
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const requireValue = (ok) => { if (!ok) throw new Error('unavailable-or-invalid-evidence'); };
const numericId = (v) => (typeof v === 'string' && ID.test(v)) || (Number.isSafeInteger(v) && v > 0);
const timestamp = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === (v.includes('.') ? v : v.replace('Z', '.000Z'));
const day = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const deny = (reason, uncertain = false) => ({ needed: false, reason, uncertain });

// No error text, headers, tokens or URLs from gh are surfaced to logs or artifacts.
export function parseApiResponse(text) {
  requireValue(typeof text === 'string');
  const split = text.search(/\r?\n\r?\n/);
  requireValue(split >= 0);
  const code = /^HTTP\/(?:1\.0|1\.1|2(?:\.0)?|3(?:\.0)?) ([1-5][0-9]{2})(?: |\r?$)/m.exec(text.slice(0, split));
  requireValue(code);
  const body = text.slice(split).replace(/^\r?\n\r?\n/, '');
  return { status: Number(code[1]), body: JSON.parse(body) };
}

function githubRead(endpoint) {
  requireValue(endpoint.startsWith(`${ROOT}/`) && !/[\r\n]/.test(endpoint));
  const args = ['api', '--hostname', 'github.com', '--method', 'GET', '--include', endpoint];
  let text;
  try {
    text = execFileSync('gh', args, { encoding: 'utf8', timeout: 20_000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    text = typeof error.stdout === 'string' ? error.stdout : '';
  }
  return parseApiResponse(text);
}

async function json(read, endpoint) {
  const result = await read(endpoint);
  requireValue(result?.status === 200);
  return result.body;
}

async function mainSha(read) {
  const ref = await json(read, `${ROOT}/git/ref/heads/main`);
  requireValue(ref?.ref === 'refs/heads/main' && ref.object?.type === 'commit' && SHA.test(ref.object.sha));
  return ref.object.sha;
}

// A bounded but complete enumeration is required. A partial page, changed count,
// duplicate ID, access failure or pagination cap can never mean "no prior run".
export async function listAll(read, endpoint, collection = null) {
  const rows = [];
  const seen = new Set();
  let total;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await json(read, `${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=${PAGE_SIZE}&page=${page}`);
    const items = collection ? data?.[collection] : data;
    requireValue(Array.isArray(items) && items.length <= PAGE_SIZE);
    if (collection) {
      requireValue(Number.isSafeInteger(data.total_count) && data.total_count >= 0 && data.total_count < MAX_PAGES * PAGE_SIZE);
      if (total === undefined) total = data.total_count;
      requireValue(total === data.total_count);
    }
    for (const item of items) {
      requireValue(object(item) && numericId(item.id) && !seen.has(String(item.id)));
      seen.add(String(item.id));
      rows.push(item);
    }
    if (collection && rows.length === total) return rows;
    if (items.length < PAGE_SIZE) {
      requireValue(!collection || rows.length === total);
      return rows;
    }
  }
  throw new Error('pagination-evidence-incomplete');
}

export function runDecision(runs, editionDate, selfId = null) {
  requireValue(Array.isArray(runs) && day(editionDate));
  if (selfId !== null) requireValue(numericId(selfId) && runs.some((run) => String(run.id) === String(selfId)));
  const seen = new Set();
  let prior = false;
  let active = false;
  let recovery = false;
  for (const run of runs) {
    requireValue(object(run) && numericId(run.id) && !seen.has(String(run.id)));
    seen.add(String(run.id));
    requireValue(run.path === DAILY_PATH && run.repository?.full_name === REPOSITORY);
    requireValue(RUN_STATUSES.has(run.status) && timestamp(run.created_at) && timestamp(run.updated_at) && timestamp(run.run_started_at));
    requireValue(Date.parse(run.updated_at) >= Date.parse(run.created_at));
    requireValue(Number.isSafeInteger(run.run_attempt) && run.run_attempt >= 1);
    requireValue(['schedule', 'workflow_dispatch'].includes(run.event));
    requireValue(run.status !== 'completed' ? run.conclusion === null : CONCLUSIONS.has(run.conclusion));
    if (selfId !== null && String(run.id) === String(selfId)) {
      requireValue(run.run_attempt === 1 && run.status === 'in_progress' && run.head_branch === 'main');
      continue;
    }
    // updated_at/run_started_at cover a delayed start or rerun across midnight.
    const touchesDay = [run.created_at, run.updated_at, run.run_started_at].some((v) => v.slice(0, 10) >= editionDate);
    if (run.status !== 'completed') active = true;
    if (touchesDay) {
      prior = true;
      if (run.event === 'workflow_dispatch') recovery = true;
    }
  }
  if (active) return deny('prior-workflow-active');
  if (recovery) return deny('recovery-budget-exhausted');
  if (prior) return deny('prior-run-requires-review');
  return { needed: true, reason: 'missed-start-only', uncertain: false };
}

export async function inspectRecovery(context, read = githubRead) {
  try {
    requireValue(context?.repository === REPOSITORY && day(context.editionDate) && SHA.test(context.sha));
    requireValue(['publication', 'backstop'].includes(context.mode) && numericId(context.runId) && context.runAttempt === 1);
    const before = await mainSha(read);
    if (before !== context.sha) return deny('main-revision-drift', true);
    const own = await json(read, `${ROOT}/actions/runs/${context.runId}`);
    requireValue(own?.repository?.full_name === REPOSITORY && String(own.id) === String(context.runId));
    requireValue(own.head_branch === 'main' && own.head_sha === context.sha && own.run_attempt === 1 && own.status === 'in_progress');
    requireValue(own.path === (context.mode === 'publication' ? DAILY_PATH : BACKSTOP_PATH));
    requireValue(['schedule', 'workflow_dispatch'].includes(own.event));
    const filePath = `apps/web/src/content/news/${context.editionDate}.md`;
    const file = await read(`${ROOT}/contents/${filePath}?ref=${before}`);
    if (file?.status === 200) {
      requireValue(file.body?.type === 'file' && file.body.path === filePath && SHA.test(file.body.sha));
      return deny('published');
    }
    requireValue(file?.status === 404 && file.body?.message === 'Not Found');
    const prs = await listAll(read, `${ROOT}/pulls?state=all&base=main`);
    let matchingPr = false;
    for (const pr of prs) {
      requireValue(typeof pr.title === 'string' && typeof pr.head?.ref === 'string' && pr.base?.ref === 'main' && ['open', 'closed'].includes(pr.state));
      if (pr.title === `Publish Daily USD Impact \u2014 ${context.editionDate}` || pr.head.ref.startsWith(`automation/daily-usd-impact-${context.editionDate}-`)) matchingPr = true;
    }
    if (matchingPr) return deny('publication-pr-exists');
    const runs = await listAll(read, `${ROOT}/actions/workflows/daily-news.yml/runs`, 'workflow_runs');
    const decision = runDecision(runs, context.editionDate, context.mode === 'publication' ? context.runId : null);
    if (!decision.needed) return decision;
    if (await mainSha(read) !== before) return deny('main-revision-drift', true);
    return decision;
  } catch {
    return deny('unavailable-or-invalid-evidence', true);
  }
}

// Injected effects allow all recovery/dispatch tests to run without network access.
// Publication repeats this guard inside its existing concurrency group. This is
// a conservative cross-run gate, not a claim of an atomic provider-side lease.
export async function guardedBackstop(context, { read = githubRead, dispatch, now = () => new Date() } = {}) {
  requireValue(context.mode === 'backstop' && typeof dispatch === 'function');
  for (let check = 0; check < 2; check += 1) {
    if (now().toISOString().slice(0, 10) !== context.editionDate) return deny('edition-date-drift', true);
    const decision = await inspectRecovery(context, read);
    if (!decision.needed) return decision;
  }
  if (now().toISOString().slice(0, 10) !== context.editionDate) return deny('edition-date-drift', true);
  try {
    await dispatch(); // Exactly one attempt. Never retry an uncertain POST.
    return { needed: false, reason: 'missed-start-dispatched', uncertain: false };
  } catch {
    return deny('dispatch-outcome-unknown', true);
  }
}

export function newEvidence(env, now = new Date()) {
  requireValue(env.GITHUB_REPOSITORY === REPOSITORY && numericId(env.GITHUB_RUN_ID) && SHA.test(env.GITHUB_SHA));
  requireValue(numericId(env.GITHUB_RUN_ATTEMPT) && day(env.DAILY_EDITION_DATE));
  return {
    schemaVersion: 1, repository: REPOSITORY, workflow: DAILY_PATH,
    runId: String(env.GITHUB_RUN_ID), runAttempt: Number(env.GITHUB_RUN_ATTEMPT),
    commit: env.GITHUB_SHA, editionDate: env.DAILY_EDITION_DATE,
    capturedAt: now.toISOString(), evidenceAvailable: true, attempts: [],
  };
}

export function cleanEvidence(state) {
  requireValue(object(state) && state.schemaVersion === 1 && state.repository === REPOSITORY && state.workflow === DAILY_PATH);
  requireValue(numericId(state.runId) && Number.isSafeInteger(state.runAttempt) && state.runAttempt >= 1 && SHA.test(state.commit));
  requireValue(day(state.editionDate) && timestamp(state.capturedAt) && typeof state.evidenceAvailable === 'boolean');
  requireValue(Array.isArray(state.attempts) && state.attempts.length <= 2);
  return {
    schemaVersion: 1, repository: REPOSITORY, workflow: DAILY_PATH,
    runId: String(state.runId), runAttempt: state.runAttempt, commit: state.commit,
    editionDate: state.editionDate, capturedAt: state.capturedAt,
    evidenceAvailable: state.evidenceAvailable,
    attempts: state.attempts.map((attempt, index) => {
      requireValue(object(attempt) && attempt.number === index + 1 && timestamp(attempt.startRequestedAt));
      requireValue(attempt.responseId === null || (typeof attempt.responseId === 'string' && RESPONSE_ID.test(attempt.responseId)));
      requireValue(attempt.lastObservedStatus === 'unknown' || ACTIVE.has(attempt.lastObservedStatus) || TERMINAL.has(attempt.lastObservedStatus));
      requireValue(attempt.lastObservedAt === null || timestamp(attempt.lastObservedAt));
      requireValue(KINDS.has(attempt.lastObservation) && typeof attempt.observationAvailable === 'boolean');
      requireValue(attempt.httpStatus === null || (Number.isInteger(attempt.httpStatus) && attempt.httpStatus >= 100 && attempt.httpStatus <= 599));
      requireValue([null, 'max_output_tokens', 'content_filter'].includes(attempt.terminalReason));
      return {
        number: attempt.number, startRequestedAt: attempt.startRequestedAt, responseId: attempt.responseId,
        lastObservedStatus: attempt.lastObservedStatus, lastObservedAt: attempt.lastObservedAt,
        lastObservation: attempt.lastObservation, observationAvailable: attempt.observationAvailable,
        httpStatus: attempt.httpStatus, terminalReason: attempt.terminalReason,
      };
    }),
  };
}

export function recordEvidence(state, { kind, number, payload = null, httpStatus = null, transportExit = 0, now = new Date() }) {
  const result = cleanEvidence(state);
  requireValue(['begin', 'start', 'poll'].includes(kind) && [1, 2].includes(number));
  result.capturedAt = now.toISOString();
  if (kind === 'begin') {
    requireValue(result.editionDate === result.capturedAt.slice(0, 10) && result.attempts.length === number - 1);
    result.attempts.push({ number, startRequestedAt: result.capturedAt, responseId: null, lastObservedStatus: 'unknown', lastObservedAt: null, lastObservation: 'create-requested', observationAvailable: false, httpStatus: null, terminalReason: null });
    return result;
  }
  const attempt = result.attempts[number - 1];
  requireValue(attempt && result.attempts.length === number);
  attempt.observationAvailable = false;
  attempt.lastObservation = 'unavailable';
  attempt.httpStatus = Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : null;
  if (transportExit !== 0 || !object(payload)) return result;
  if (kind === 'start') {
    if (typeof payload.id !== 'string' || !RESPONSE_ID.test(payload.id)) return result;
    if (attempt.responseId !== null && attempt.responseId !== payload.id) return result;
    attempt.responseId = payload.id;
  }
  if (!attempt.responseId || (payload.id !== undefined && payload.id !== attempt.responseId)) return result;
  let status = null;
  if (kind === 'start' && (ACTIVE.has(payload.status) || TERMINAL.has(payload.status))) status = payload.status;
  if (kind === 'poll' && httpStatus === 202 && ACTIVE.has(payload.status)) status = payload.status;
  if (kind === 'poll' && httpStatus === 502 && TERMINAL.has(payload.status) && payload.status !== 'completed') status = payload.status;
  if (kind === 'poll' && httpStatus === 200 && payload.date === result.editionDate && Array.isArray(payload.highlights) && Array.isArray(payload.sources) && typeof payload.body === 'string') status = 'completed';
  if (status === null) return result;
  attempt.lastObservedStatus = status;
  attempt.lastObservedAt = result.capturedAt;
  attempt.lastObservation = kind === 'start' ? 'start-response' : httpStatus === 200 ? 'application-result' : 'application-poll';
  attempt.observationAvailable = true;
  attempt.terminalReason = status === 'incomplete' && ['max_output_tokens', 'content_filter'].includes(payload.reason) ? payload.reason : null;
  return result;
}

async function readLocalJson(path, limit = 512 * 1024) {
  requireValue((await stat(path)).size <= limit);
  return JSON.parse(await readFile(path, 'utf8'));
}

async function saveJson(path, state) {
  await writeFile(`${path}.tmp`, `${JSON.stringify(cleanEvidence(state), null, 2)}\n`, { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}

async function recordCommand(args, env) {
  const statePath = join(env.RUNNER_TEMP, 'daily-generation-state.json');
  let state;
  try { state = cleanEvidence(await readLocalJson(statePath, 16 * 1024)); }
  catch (error) {
    requireValue(error.code === 'ENOENT' && args[0] === 'begin' && args[1] === '1');
    state = newEvidence(env);
  }
  requireValue(state.runId === env.GITHUB_RUN_ID && state.commit === env.GITHUB_SHA && state.runAttempt === Number(env.GITHUB_RUN_ATTEMPT) && state.editionDate === env.DAILY_EDITION_DATE);
  let payload = null;
  if (['start', 'poll'].includes(args[0]) && (args[0] !== 'poll' || args[4] === '0')) {
    try { payload = await readLocalJson(args[2]); } catch { /* Unknown, never inferred failed. */ }
  }
  const next = recordEvidence(state, { kind: args[0], number: Number(args[1]), payload, httpStatus: args[0] === 'start' ? null : Number(args[3]), transportExit: args[0] === 'poll' ? Number(args[4]) : 0 });
  await saveJson(statePath, next);
}

async function preserveCommand(env) {
  let state;
  try {
    state = cleanEvidence(await readLocalJson(join(env.RUNNER_TEMP, 'daily-generation-state.json'), 16 * 1024));
    requireValue(state.runId === env.GITHUB_RUN_ID && state.commit === env.GITHUB_SHA && state.runAttempt === Number(env.GITHUB_RUN_ATTEMPT) && state.editionDate === env.DAILY_EDITION_DATE);
  } catch {
    state = newEvidence(env);
    state.evidenceAvailable = false;
  }
  await saveJson(join(env.RUNNER_TEMP, 'daily-generation-evidence.json'), state);
  await appendFile(env.GITHUB_STEP_SUMMARY, `\n## Daily generation evidence (captured, not a live provider check)\n\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n\nMissing or unavailable evidence never authorizes a replacement. No prompt, output, credentials or raw provider error is included.\n`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const env = process.env;
  if (command === 'record') return recordCommand(args, env);
  if (command === 'preserve') return preserveCommand(env);
  requireValue(['guard', 'backstop'].includes(command));
  requireValue(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === REPOSITORY && env.GITHUB_REF === 'refs/heads/main');
  requireValue(['schedule', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME));
  const context = { repository: env.GITHUB_REPOSITORY, editionDate: new Date().toISOString().slice(0, 10), sha: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID, runAttempt: Number(env.GITHUB_RUN_ATTEMPT), mode: command === 'guard' ? 'publication' : 'backstop' };
  const decision = command === 'guard' ? await inspectRecovery(context) : await guardedBackstop(context, {
    dispatch: () => execFileSync('gh', ['workflow', 'run', 'daily-news.yml', '--repo', REPOSITORY, '--ref', 'main'], { encoding: 'utf8', timeout: 20_000, maxBuffer: 64 * 1024, env: { ...env, GH_HOST: 'github.com' }, stdio: ['ignore', 'pipe', 'pipe'] }),
  });
  if (command === 'guard') {
    await appendFile(env.GITHUB_OUTPUT, `needed=${decision.needed}\nreason=${decision.reason}\n`);
    await appendFile(env.GITHUB_ENV, `DAILY_EDITION_DATE=${context.editionDate}\n`);
  }
  await appendFile(env.GITHUB_STEP_SUMMARY, `\n## Daily missed-start safety gate\n\nEdition: ${context.editionDate}\n\nResult: ${decision.reason}\n\nA GitHub conclusion is not an OpenAI lifecycle state. The backstop does not retry any existing same-edition run.\n`);
  console.log(`Daily recovery gate: ${decision.reason}`);
  if (decision.uncertain) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Daily recovery stopped: unavailable or invalid evidence; no automatic retry.'); process.exitCode = 1; });
}
