import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPOSITORY, cleanEvidence, guardedBackstop, inspectRecovery, listAll, newEvidence, parseApiResponse, recordEvidence, runDecision } from './daily-news-recovery.mjs';

let cases = 0;
const test = async (name, fn) => {
  try { await fn(); cases += 1; }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
};
const sha = 'a'.repeat(40);
const date = '2026-09-22';
const at = new Date(`${date}T15:00:00Z`);
const context = { repository: REPOSITORY, editionDate: date, sha, mode: 'backstop', runId: '999', runAttempt: 1 };
const run = (overrides = {}) => ({ id: 10, repository: { full_name: REPOSITORY }, path: '.github/workflows/daily-news.yml', event: 'schedule', status: 'completed', conclusion: 'failure', created_at: `${date}T09:17:00Z`, run_started_at: `${date}T09:17:10Z`, updated_at: `${date}T10:00:00Z`, run_attempt: 1, head_branch: 'main', head_sha: sha, ...overrides });
const oldRun = (id = 10) => run({ id, created_at: '2026-09-21T09:17:00Z', run_started_at: '2026-09-21T09:17:10Z', updated_at: '2026-09-21T10:00:00Z', conclusion: 'success' });
const pr = (overrides = {}) => ({ id: 15, title: `Publish Daily USD Impact \u2014 ${date}`, head: { ref: `automation/daily-usd-impact-${date}-15` }, base: { ref: 'main' }, state: 'open', ...overrides });
function fakeRead({ ctx = context, runs = [], prs = [], fileStatus = 404, edit = (value) => value } = {}) {
  const calls = [];
  const read = async (endpoint) => {
    calls.push(endpoint);
    let response;
    if (endpoint.endsWith('/git/ref/heads/main')) response = { status: 200, body: { ref: 'refs/heads/main', object: { type: 'commit', sha } } };
    else if (endpoint.endsWith(`/actions/runs/${ctx.runId}`)) response = { status: 200, body: run({ id: Number(ctx.runId), path: ctx.mode === 'backstop' ? '.github/workflows/daily-news-schedule-backstop.yml' : '.github/workflows/daily-news.yml', status: 'in_progress', conclusion: null }) };
    else if (endpoint.includes('/contents/')) response = { status: fileStatus, body: fileStatus === 200 ? { type: 'file', path: `apps/web/src/content/news/${date}.md`, sha } : { message: 'Not Found' } };
    else if (endpoint.includes('/pulls?')) {
      const page = Number(new URL(`https://api.github.com/${endpoint}`).searchParams.get('page'));
      response = { status: 200, body: prs.slice((page - 1) * 100, page * 100) };
    } else if (endpoint.includes('/actions/workflows/daily-news.yml/runs?')) {
      const page = Number(new URL(`https://api.github.com/${endpoint}`).searchParams.get('page'));
      response = { status: 200, body: { total_count: runs.length, workflow_runs: runs.slice((page - 1) * 100, page * 100) } };
    } else throw new Error('Unexpected mocked endpoint');
    return edit(structuredClone(response), endpoint, calls);
  };
  return { read, calls };
}
const check = async (options, reason, ctx = context) => {
  const mock = fakeRead({ ...options, ctx });
  const result = await inspectRecovery(ctx, mock.read);
  assert.equal(result.reason, reason);
  assert.equal(result.needed, reason === 'missed-start-only');
  assert.ok(mock.calls.every((p) => p.startsWith(`repos/${REPOSITORY}/`) && !p.includes('/responses') && !p.includes('/cancel')));
  return result;
};

await test('empty complete history is a genuine missed start', () => check({}, 'missed-start-only'));
await test('historical completed runs do not prevent the next edition', () => check({ runs: [oldRun()] }, 'missed-start-only'));
for (const conclusion of ['success', 'failure', 'timed_out', 'cancelled', 'skipped', 'neutral', 'action_required', 'stale', 'startup_failure']) {
  await test(`same-day ${conclusion} is not proof of a missed start`, () => check({ runs: [run({ conclusion })] }, 'prior-run-requires-review'));
}
for (const status of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
  await test(`prior GitHub ${status} is blocking`, () => check({ runs: [run({ status, conclusion: null })] }, 'prior-workflow-active'));
}
await test('prior provider queued timeout remains blocking with no artifact', () => check({ runs: [run({ conclusion: 'failure' })] }, 'prior-run-requires-review'));
await test('terminal max-token attempt does not expand backstop retries', () => check({ runs: [run({ event: 'workflow_dispatch' })] }, 'recovery-budget-exhausted'));
await test('older still-active workflow blocks across midnight', () => check({ runs: [oldRun(), run({ ...oldRun(11), status: 'in_progress', conclusion: null })] }, 'prior-workflow-active'));
await test('rerun of yesterday created today is blocking', () => check({ runs: [run({ ...oldRun(), run_attempt: 2, run_started_at: `${date}T10:00:00Z`, updated_at: `${date}T10:30:00Z` })] }, 'prior-run-requires-review'));
await test('earlier same-edition recovery exhausts allowance', () => check({ runs: [run({ event: 'workflow_dispatch', conclusion: 'success' })] }, 'recovery-budget-exhausted'));
await test('known published file blocks', () => check({ fileStatus: 200 }, 'published'));
for (const state of ['open', 'closed']) {
  await test(`${state} matching PR is respected`, () => check({ prs: [pr({ state })] }, 'publication-pr-exists'));
}
await test('renamed editorial PR still blocks by branch', () => check({ prs: [pr({ title: 'Renamed editorial review' })] }, 'publication-pr-exists'));
await test('retitled branch still blocks by edition title', () => check({ prs: [pr({ head: { ref: 'manual-editorial' } })] }, 'publication-pr-exists'));
for (const fileStatus of [401, 403, 429, 500, 502, 0]) {
  await test(`file lookup HTTP ${fileStatus} is not absence`, () => check({ fileStatus }, 'unavailable-or-invalid-evidence'));
}
await test('false 404 body is not absence', () => check({ edit: (r, p) => p.includes('/contents/') ? { status: 404, body: null } : r }, 'unavailable-or-invalid-evidence'));
await test('unexpected file shape blocks', () => check({ fileStatus: 200, edit: (r, p) => p.includes('/contents/') ? { status: 200, body: [] } : r }, 'unavailable-or-invalid-evidence'));
await test('malformed PR metadata blocks', () => check({ prs: [{ id: 1 }] }, 'unavailable-or-invalid-evidence'));
await test('unknown run state blocks', () => check({ runs: [run({ status: 'future-state' })] }, 'unavailable-or-invalid-evidence'));
await test('missing conclusion blocks', () => check({ runs: [run({ conclusion: null })] }, 'unavailable-or-invalid-evidence'));
await test('missing timestamps block', () => check({ runs: [run({ run_started_at: null })] }, 'unavailable-or-invalid-evidence'));
await test('wrong workflow identity blocks', () => check({ runs: [run({ path: '.github/workflows/unrelated.yml' })] }, 'unavailable-or-invalid-evidence'));
await test('wrong repository identity blocks', () => check({ runs: [run({ repository: { full_name: 'elsewhere/repo' } })] }, 'unavailable-or-invalid-evidence'));
await test('empty/missing run evidence is not a zero count', () => check({ edit: (r, p) => p.includes('/daily-news.yml/runs?') ? { status: 200, body: {} } : r }, 'unavailable-or-invalid-evidence'));
await test('exception/time-out cannot dispatch', () => check({ edit: () => { throw new Error('network unavailable'); } }, 'unavailable-or-invalid-evidence'));
await test('exact base drift blocks', () => check({}, 'main-revision-drift', { ...context, sha: 'b'.repeat(40) }));
await test('main changes during evidence gathering', () => check({ edit: (r, p, calls) => p.endsWith('/git/ref/heads/main') && calls.filter((x) => x.endsWith('/git/ref/heads/main')).length === 2 ? { ...r, body: { ...r.body, object: { type: 'commit', sha: 'b'.repeat(40) } } } : r }, 'main-revision-drift'));
await test('current publication self alone can start', async () => {
  const ctx = { ...context, mode: 'publication' };
  await check({ runs: [run({ id: 999, status: 'in_progress', conclusion: null })] }, 'missed-start-only', ctx);
});
await test('current publication missing from history blocks', () => check({}, 'unavailable-or-invalid-evidence', { ...context, mode: 'publication' }));
await test('current publication rerun cannot erase old provider attempt', () => check({}, 'unavailable-or-invalid-evidence', { ...context, mode: 'publication', runAttempt: 2 }));
await test('consumer blocks delayed scheduled duplicate after backstop', () => check({ runs: [run({ id: 999, status: 'in_progress', conclusion: null }), run({ event: 'workflow_dispatch' })] }, 'recovery-budget-exhausted', { ...context, mode: 'publication' }));
await test('prior blocking run beyond first page is found', () => check({ runs: [...Array.from({ length: 100 }, (_, i) => oldRun(i + 1)), run({ id: 101 })] }, 'prior-run-requires-review'));
await test('matching PR beyond first page is found', () => check({ prs: [...Array.from({ length: 100 }, (_, i) => pr({ id: i + 1, title: 'Other', head: { ref: `other-${i}` } })), pr({ id: 101 })] }, 'publication-pr-exists'));
await test('duplicate run IDs block a shifting page', () => check({ runs: [oldRun(), oldRun()] }, 'unavailable-or-invalid-evidence'));
await test('truncated page cannot prove absence', () => check({ edit: (r, p) => p.includes('/daily-news.yml/runs?') ? { status: 200, body: { total_count: 101, workflow_runs: [] } } : r }, 'unavailable-or-invalid-evidence'));
await test('changing total count blocks', () => check({ runs: Array.from({ length: 101 }, (_, i) => oldRun(i + 1)), edit: (r, p) => p.includes('runs?') && p.endsWith('page=2') ? { ...r, body: { ...r.body, total_count: 102 } } : r }, 'unavailable-or-invalid-evidence'));
await test('page two permission error blocks', () => check({ runs: Array.from({ length: 101 }, (_, i) => oldRun(i + 1)), edit: (r, p) => p.includes('runs?') && p.endsWith('page=2') ? { status: 403, body: {} } : r }, 'unavailable-or-invalid-evidence'));
await test('bounded scan cap blocks rather than truncates', () => check({ edit: (r, p) => p.includes('runs?') ? { status: 200, body: { total_count: 2000, workflow_runs: [] } } : r }, 'unavailable-or-invalid-evidence'));
await test('array pagination cap blocks', async () => {
  await assert.rejects(listAll(async (endpoint) => {
    const page = Number(new URL(`https://api.github.com/${endpoint}`).searchParams.get('page'));
    return { status: 200, body: Array.from({ length: 100 }, (_, i) => ({ id: (page - 1) * 100 + i + 1 })) };
  }, 'repos/mock/repo/pulls'));
});
await test('bad edition date blocks', async () => {
  assert.throws(() => runDecision([], '2026-02-31'));
  assert.throws(() => runDecision([], 'bad\nneeded=true'));
});
await test('HTTP parser separates 404 and errors from missing data', () => {
  assert.deepEqual(parseApiResponse('HTTP/2.0 404 Not Found\r\ncontent-type: application/json\r\n\r\n{"message":"Not Found"}'), { status: 404, body: { message: 'Not Found' } });
  assert.throws(() => parseApiResponse('unreadable'));
  assert.throws(() => parseApiResponse('HTTP/2.0 200 OK\r\n\r\n<html>login</html>'));
});
await test('genuine missed start dispatches exactly once after two checks', async () => {
  const mock = fakeRead(); let writes = 0;
  const result = await guardedBackstop(context, { read: mock.read, now: () => at, dispatch: () => { writes += 1; } });
  assert.equal(writes, 1); assert.equal(result.reason, 'missed-start-dispatched');
  assert.equal(mock.calls.filter((p) => p.includes('/daily-news.yml/runs?')).length, 2);
});
await test('new prior run appears on final check, no dispatch', async () => {
  let reads = 0; let writes = 0;
  const mock = fakeRead({ edit: (r, p) => {
    if (p.includes('/daily-news.yml/runs?') && ++reads === 2) return { status: 200, body: { total_count: 1, workflow_runs: [run()] } };
    return r;
  } });
  const result = await guardedBackstop(context, { read: mock.read, now: () => at, dispatch: () => { writes += 1; } });
  assert.equal(writes, 0); assert.equal(result.needed, false);
});
await test('uncertain dispatch outcome is never retried', async () => {
  let writes = 0;
  const result = await guardedBackstop(context, { read: fakeRead().read, now: () => at, dispatch: () => { writes += 1; throw new Error('timeout after possible acceptance'); } });
  assert.equal(writes, 1); assert.equal(result.reason, 'dispatch-outcome-unknown'); assert.equal(result.uncertain, true);
});
await test('date rollover blocks backstop', async () => {
  let writes = 0;
  const result = await guardedBackstop(context, { read: fakeRead().read, now: () => new Date('2026-09-23T00:00:00Z'), dispatch: () => { writes += 1; } });
  assert.equal(writes, 0); assert.equal(result.reason, 'edition-date-drift');
});

const env = { GITHUB_REPOSITORY: REPOSITORY, GITHUB_RUN_ID: '999', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: sha, DAILY_EDITION_DATE: date };
const begin = () => recordEvidence(newEvidence(env, at), { kind: 'begin', number: 1, now: at });
const started = () => recordEvidence(begin(), { kind: 'start', number: 1, payload: { id: 'resp_mock_response_one', status: 'queued' }, now: at });
await test('mark create uncertainty before POST could be accepted', () => {
  const e = begin(); assert.equal(e.attempts[0].lastObservedStatus, 'unknown'); assert.equal(e.attempts[0].responseId, null); assert.equal(e.attempts[0].observationAvailable, false);
});
await test('partial start response preserves unknown with valid ID', () => {
  const e = recordEvidence(begin(), { kind: 'start', number: 1, payload: { id: 'resp_mock_response_one' }, now: at });
  assert.equal(e.attempts[0].responseId, 'resp_mock_response_one'); assert.equal(e.attempts[0].lastObservedStatus, 'unknown');
});
await test('invalid ID is not serialized', () => {
  const e = recordEvidence(begin(), { kind: 'start', number: 1, payload: { id: 'private-value\nneeded=true', status: 'queued' }, now: at });
  assert.equal(e.attempts[0].responseId, null); assert.ok(!JSON.stringify(e).includes('private-value'));
});
for (const status of ['queued', 'in_progress']) {
  await test(`last ${status} survives transport failure and timeout`, () => {
    const observed = recordEvidence(started(), { kind: 'poll', number: 1, payload: { status }, httpStatus: 202, now: at });
    const e = recordEvidence(observed, { kind: 'poll', number: 1, payload: { status: 'failed', error: 'local failure, not provider failure' }, httpStatus: 502, transportExit: 35, now: new Date('2026-09-22T16:00:00Z') });
    assert.equal(e.attempts[0].lastObservedStatus, status); assert.equal(e.attempts[0].lastObservedAt, at.toISOString()); assert.equal(e.attempts[0].observationAvailable, false);
  });
}
for (const status of ['failed', 'cancelled', 'incomplete']) {
  await test(`actual application-reported ${status} is preserved without raw payload`, () => {
    const e = recordEvidence(started(), { kind: 'poll', number: 1, httpStatus: 502, payload: { status, reason: 'max_output_tokens', error: 'SENTINEL_SECRET', output: ['SENTINEL_SECRET'] }, now: at });
    assert.equal(e.attempts[0].lastObservedStatus, status); assert.ok(!JSON.stringify(e).includes('SENTINEL_SECRET'));
    assert.equal(e.attempts[0].terminalReason, status === 'incomplete' ? 'max_output_tokens' : null);
  });
}
await test('HTTP 200 requires a same-edition application result', () => {
  const e = recordEvidence(started(), { kind: 'poll', number: 1, httpStatus: 200, payload: { date, body: 'SENTINEL_BODY', highlights: [], sources: [] }, now: at });
  assert.equal(e.attempts[0].lastObservedStatus, 'completed'); assert.equal(e.attempts[0].lastObservation, 'application-result'); assert.ok(!JSON.stringify(e).includes('SENTINEL_BODY'));
  const wrongDate = recordEvidence(started(), { kind: 'poll', number: 1, httpStatus: 200, payload: { date: '2026-09-21', body: 'draft', highlights: [], sources: [] }, now: at });
  assert.equal(wrongDate.attempts[0].observationAvailable, false);
});
await test('empty completed provider object is not a publishable result', () => {
  const e = recordEvidence(started(), { kind: 'poll', number: 1, httpStatus: 200, payload: { status: 'completed', output: [] }, now: at });
  assert.equal(e.attempts[0].observationAvailable, false);
});
await test('different response ID cannot overwrite evidence', () => {
  const e = recordEvidence(started(), { kind: 'poll', number: 1, httpStatus: 202, payload: { id: 'resp_other_response', status: 'in_progress' }, now: at });
  assert.equal(e.attempts[0].lastObservedStatus, 'queued'); assert.equal(e.attempts[0].responseId, 'resp_mock_response_one'); assert.equal(e.attempts[0].observationAvailable, false);
});
await test('unreadable/malformed poll is not terminal evidence', () => {
  for (const payload of [null, [], {}, { status: 'unrecognized' }, { status: 'failed' }]) {
    const e = recordEvidence(started(), { kind: 'poll', number: 1, httpStatus: 403, payload, now: at });
    assert.equal(e.attempts[0].lastObservedStatus, 'queued'); assert.equal(e.attempts[0].observationAvailable, false);
  }
});
await test('bounded existing retry records both IDs separately', () => {
  let e = recordEvidence(started(), { kind: 'begin', number: 2, now: at });
  e = recordEvidence(e, { kind: 'start', number: 2, payload: { id: 'resp_mock_response_two', status: 'in_progress' }, now: at });
  assert.deepEqual(e.attempts.map((a) => a.responseId), ['resp_mock_response_one', 'resp_mock_response_two']);
  assert.throws(() => recordEvidence(e, { kind: 'begin', number: 3, now: at }));
  assert.throws(() => recordEvidence(e, { kind: 'begin', number: 2, now: at }));
});
await test('midnight drift stops before a create marker/POST', () => {
  assert.throws(() => recordEvidence(newEvidence(env, at), { kind: 'begin', number: 1, now: new Date('2026-09-23T00:00:00Z') }));
});
await test('artifact reserialization is a strict field allowlist', () => {
  const e = started(); e.authorization = 'SENTINEL_SECRET'; e.prompt = 'SENTINEL_SECRET'; e.attempts[0].output = 'SENTINEL_SECRET';
  const clean = cleanEvidence(e);
  assert.ok(!JSON.stringify(clean).includes('SENTINEL_SECRET'));
  assert.equal(Object.keys(clean.attempts[0]).length, 9);
  assert.throws(() => cleanEvidence({ ...e, runId: 'SENTINEL_SECRET' }));
  assert.throws(() => cleanEvidence({ ...e, attempts: [{ ...e.attempts[0], terminalReason: 'SENTINEL_SECRET' }] }));
});

const dir = await mkdtemp(join(tmpdir(), 'daily-recovery-mock-'));
try {
  const executable = fileURLToPath(new URL('./daily-news-recovery.mjs', import.meta.url));
  const localEnv = { ...process.env, ...env, RUNNER_TEMP: dir, GITHUB_STEP_SUMMARY: join(dir, 'summary.md'), GITHUB_ACTIONS: 'false' };
  const cli = (...args) => spawnSync(process.execPath, [executable, ...args], { env: localEnv, encoding: 'utf8' });
  await test('CLI refuses live guard outside authorized workflow context', () => {
    assert.equal(cli('guard').status, 1); assert.equal(cli('backstop').status, 1);
  });
  await test('missing evidence is preserved explicitly, no fabricated status', async () => {
    assert.equal(cli('preserve').status, 0);
    const e = JSON.parse(await readFile(join(dir, 'daily-generation-evidence.json'), 'utf8'));
    assert.equal(e.evidenceAvailable, false); assert.deepEqual(e.attempts, []);
  });
  await test('corrupt evidence cannot leak into summary or uploaded file', async () => {
    await writeFile(join(dir, 'daily-generation-state.json'), 'SENTINEL_SECRET');
    assert.equal(cli('preserve').status, 0);
    assert.ok(!(await readFile(join(dir, 'daily-generation-evidence.json'), 'utf8')).includes('SENTINEL_SECRET'));
    assert.ok(!(await readFile(join(dir, 'summary.md'), 'utf8')).includes('SENTINEL_SECRET'));
  });
  await test('valid evidence survives preserve without provider calls', async () => {
    await writeFile(join(dir, 'daily-generation-state.json'), JSON.stringify(started()));
    assert.equal(cli('preserve').status, 0);
    const e = JSON.parse(await readFile(join(dir, 'daily-generation-evidence.json'), 'utf8'));
    assert.equal(e.attempts[0].lastObservedStatus, 'queued'); assert.equal(e.evidenceAvailable, true);
  });
  await test('foreign run evidence becomes unavailable, not trusted', async () => {
    await writeFile(join(dir, 'daily-generation-state.json'), JSON.stringify({ ...started(), runId: '123' }));
    assert.equal(cli('preserve').status, 0);
    assert.equal(JSON.parse(await readFile(join(dir, 'daily-generation-evidence.json'), 'utf8')).evidenceAvailable, false);
  });
} finally { await rm(dir, { recursive: true, force: true }); }
console.log(`daily news recovery tests pass: ${cases} mocked cases; no network/provider calls`);
