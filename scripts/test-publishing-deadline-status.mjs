import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyDailyDelivery as classify, deadlineClock, POLICY } from './publishing-deadline-status.mjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40), D = 'd'.repeat(40);
const day = '2026-10-23', now = `${day}T12:00:00Z`;
const link = 'https://github.com/usdimpact/usd-impact-site/pull/1';
let count = 0;
const results = [];
function check(name, fn) { fn(); count++; results.push(name); }
function evidence(at = now, edition = day) {
  return {
    version: 1, edition, observedAt: at, mainSha: A,
    article: { observedAt: at, edition, mainSha: A, state: 'absent' },
    prs: { observedAt: at, coverage: 'open-all-closed-14d-complete', items: [] },
    runs: { observedAt: at, coverage: 'all-active-and-edition-complete', items: [] },
    dispatchReceipt: 'none',
  };
}
function run(overrides = {}) {
  return { id: 1, workflow: 'daily', edition: day, branch: 'main', event: 'schedule',
    headSha: A, createdAt: `${day}T10:00:00Z`, updatedAt: `${day}T11:00:00Z`,
    status: 'completed', conclusion: 'failure', ...overrides };
}
function candidate(overrides = {}) {
  const gates = { headSha: B, sourceReview: 'pass', sourceReceipt: link,
    preview: 'pass', previewHeadSha: B, previewReceipt: 'https://vercel.com/usd-impact/example',
  };
  for (const key of ['webQuality', 'audit', 'dependencyReview', 'codeql']) {
    gates[key] = 'pass'; gates[`${key}Receipt`] = link;
  }
  return { number: 1, edition: day, state: 'open', draft: true, headSha: B, contentSha: C,
    title: `Publish Daily USD Impact \u2014 ${day}`, headRef: `automation/daily-usd-impact-${day}-editorial-test`,
    files: [`apps/web/src/content/news/${day}.md`], gates,
    humanReview: { decision: 'pending' }, ...overrides };
}
function approval() { return { decision: 'approved', reviewer: 'synthetic-reviewer',
  approvedContentSha: C, approvedHeadSha: B, receipt: link }; }
const evaluate = (e, at = now, edition = day) => classify({ now: at, edition, evidence: e });
const expect = (e, state, at = now, edition = day) => assert.equal(evaluate(e, at, edition).state, state);
function published() {
  const e = evidence();
  e.article = { ...e.article, state: 'published', contentSha: C };
  e.prs.items = [candidate({ state: 'merged', draft: false, mergeSha: D, humanReview: approval() })];
  e.release = { observedAt: now, prNumber: 1, mergeSha: D, publishedHeadSha: B,
    publishedContentSha: C, protectedMerge: true, mergeReceipt: link,
    production: { sha: A, state: 'READY', id: 'dpl_synthetic', mergeContained: true, contentSha: C,
      aliases: ['www.usd-impact.com', 'usd-impact.com'], receipt: 'https://vercel.com/usd-impact/example' },
    live: Object.fromEntries(['article', 'index', 'latestJson', 'rss'].map(k =>
      [k, { edition: day, state: 'verified', receipt: `https://www.usd-impact.com/news/${day}` }])) };
  return e;
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

check('exact 14:00 summer handoff', () => {
  const c = deadlineClock(now); assert.equal(c.localTime, '14:00'); assert.equal(c.phase, 'ASSESSMENT');
});
for (const [utc, time, phase] of [
  ['2026-10-23T11:59:59Z', '13:59', 'BEFORE_HANDOFF'],
  ['2026-10-23T13:59:59Z', '15:59', 'ASSESSMENT'],
  ['2026-10-23T14:00:00Z', '16:00', 'TARGET'],
  ['2026-10-23T15:59:59Z', '17:59', 'TARGET'],
  ['2026-10-23T16:00:00Z', '18:00', 'ESCALATION'],
  ['2026-10-26T13:00:00Z', '14:00', 'ASSESSMENT'],
  ['2026-10-26T15:00:00Z', '16:00', 'TARGET'],
  ['2026-10-26T17:00:00Z', '18:00', 'ESCALATION'],
  ['2026-10-25T00:30:00Z', '02:30', 'BEFORE_HANDOFF'],
  ['2026-10-25T01:30:00Z', '02:30', 'BEFORE_HANDOFF'],
]) check(`IANA clock ${utc}`, () => {
  const c = deadlineClock(utc); assert.equal(c.localTime, time); assert.equal(c.phase, phase);
});
for (const bad of [null, {}, [], 'bad', '2026-02-29T00:00:00Z', '2026-10-23T24:00:00Z',
  '2026-10-23T12:00:00', '2026-10-23', '2026-10-23T12:00:00+00:00']) {
  check(`invalid UTC clock ${JSON.stringify(bad)}`, () => assert.equal(deadlineClock(bad), null));
}
for (const input of [undefined, null, [], 4, 'bad', {}, { now, edition: '2026-02-31' }]) {
  check(`invalid top-level input ${JSON.stringify(input)}`, () => assert.equal(classify(input).state, 'UNKNOWN'));
}
check('future edition does not create placeholder', () => expect(null, 'NOT_DUE', '2026-10-22T16:00:00Z'));
check('historical edition is not replayed', () => expect(null, 'HISTORICAL_HOLD', '2026-10-24T00:00:00Z'));
check('weekend does not generate Daily', () => expect(null, 'NOT_ELIGIBLE', '2026-10-24T12:00:00Z', '2026-10-24'));
check('UTC/local midnight boundary holds', () => expect(null, 'DATE_BOUNDARY_HOLD', '2026-10-23T22:30:00Z'));
check('snapshot at 5-minute limit accepted', () => expect(evidence('2026-10-23T11:55:00Z'), 'FALLBACK_ASSESSMENT'));
check('snapshot one millisecond stale is UNKNOWN', () => expect(evidence('2026-10-23T11:54:59.999Z'), 'UNKNOWN'));
check('future-dated snapshot is UNKNOWN', () => expect(evidence('2026-10-23T12:00:00.001Z'), 'UNKNOWN'));
for (const key of ['article', 'prs', 'runs']) {
  check(`missing ${key} is not absence`, () => { const e = evidence(); delete e[key]; expect(e, 'UNKNOWN'); });
  check(`stale ${key} is not absence`, () => { const e = evidence(); e[key].observedAt = '2026-10-23T11:54:00Z'; expect(e, 'UNKNOWN'); });
}
check('incomplete PR pagination holds', () => { const e = evidence(); e.prs.coverage = 'partial'; expect(e, 'UNKNOWN'); });
check('incomplete run pagination holds', () => { const e = evidence(); e.runs.coverage = 'partial'; expect(e, 'UNKNOWN'); });
check('article-main mismatch holds', () => { const e = evidence(); e.article.mainSha = D; expect(e, 'UNKNOWN'); });
check('ambiguous dispatch never retries', () => { const e = evidence(); e.dispatchReceipt = 'unknown'; expect(e, 'UNKNOWN'); });
check('missing dispatch state is UNKNOWN', () => { const e = evidence(); delete e.dispatchReceipt; expect(e, 'UNKNOWN'); });
for (const status of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
  check(`active ${status} suppresses fallback`, () => { const e = evidence(); e.runs.items = [run({ status, conclusion: null })]; expect(e, 'ACTIVE'); });
}
check('prior-day active run also suppresses fallback', () => {
  const e = evidence(); e.runs.items = [run({ edition: '2026-10-22', status: 'in_progress', conclusion: null })]; expect(e, 'ACTIVE');
});
check('backstop activity is not Daily success', () => {
  const e = evidence(); e.runs.items = [run({ workflow: 'backstop', status: 'in_progress', conclusion: null })]; expect(e, 'ACTIVE');
});
check('duplicate run records fail closed', () => { const e = evidence(); e.runs.items = [run(), run()]; expect(e, 'UNKNOWN'); });
for (const mutation of [{ status: 'new-provider-state' }, { event: 'push' }, { headSha: 'short' },
  { updatedAt: '2026-10-23T13:00:00Z' }, { createdAt: '2026-10-23T11:30:00Z' }, { conclusion: null }]) {
  check(`malformed run ${JSON.stringify(mutation)}`, () => { const e = evidence(); e.runs.items = [run(mutation)]; expect(e, 'UNKNOWN'); });
}
check('closed candidate prevents replacement', () => { const e = evidence(); e.prs.items = [candidate({ state: 'closed' })]; expect(e, 'EDITORIAL_HOLD'); });
check('merged candidate still needs public verification', () => { const e = evidence(); e.prs.items = [candidate({ state: 'merged' })]; expect(e, 'PUBLICATION_VERIFICATION'); });
check('two date-related candidates require reconciliation', () => { const e = evidence(); e.prs.items = [candidate(), candidate({ number: 2 })]; expect(e, 'CONFLICT_HOLD'); });
for (const patch of [{ title: 'Alternative editorial copy' }, { headRef: 'manual-other-branch' }, { files: ['extra.md'] },
  { files: [`apps/web/src/content/news/${day}.md`, 'extra.md'] }]) {
  check(`off-contract PR retained as blocker ${Object.keys(patch)[0]}`, () => { const e = evidence(); e.prs.items = [candidate(patch)]; expect(e, 'CONFLICT_HOLD'); });
}
check('technical PASS without human approval awaits review', () => { const e = evidence(); e.prs.items = [candidate()]; expect(e, 'AWAITING_EDITORIAL_REVIEW'); });
check('source failure stays HOLD', () => { const e = evidence(); const pr = candidate(); pr.gates.sourceReview = 'fail'; e.prs.items = [pr]; expect(e, 'SOURCE_HOLD'); });
check('wrong exact-head evidence is UNKNOWN', () => { const e = evidence(); const pr = candidate(); pr.gates.headSha = D; e.prs.items = [pr]; expect(e, 'UNKNOWN'); });
for (const key of ['webQuality', 'audit', 'dependencyReview', 'codeql', 'preview']) {
  check(`${key} pending prevents release`, () => { const e = evidence(); const pr = candidate(); pr.gates[key] = 'pending'; e.prs.items = [pr]; expect(e, 'TECHNICAL_HOLD'); });
}
check('wrong preview head prevents release', () => { const e = evidence(); const pr = candidate(); pr.gates.previewHeadSha = D; e.prs.items = [pr]; expect(e, 'UNKNOWN'); });
check('missing source receipt holds', () => { const e = evidence(); const pr = candidate(); delete pr.gates.sourceReceipt; e.prs.items = [pr]; expect(e, 'UNKNOWN'); });
check('approval for different content cannot release', () => { const e = evidence(); e.prs.items = [candidate({ humanReview: { ...approval(), approvedContentSha: D } })]; expect(e, 'AWAITING_EDITORIAL_REVIEW'); });
check('changes requested preserved', () => { const e = evidence(); e.prs.items = [candidate({ humanReview: { decision: 'changes_requested' } })]; expect(e, 'EDITORIAL_HOLD'); });
check('approved candidate only receives release-review classification', () => { const e = evidence(); e.prs.items = [candidate({ humanReview: approval() })]; expect(e, 'RELEASE_REVIEW'); });
check('no candidate before handoff is not schedule failure', () => {
  const at = '2026-10-23T09:18:00Z'; expect(evidence(at), 'NO_CANDIDATE', at);
});
check('absence after complete handoff snapshot is assessment only', () => expect(evidence(), 'FALLBACK_ASSESSMENT'));
check('failed original permits assessment not execution', () => { const e = evidence(); e.runs.items = [run()]; const r = evaluate(e); assert.equal(r.state, 'FALLBACK_ASSESSMENT'); assert.equal(r.executionAllowed, false); });
check('green no-op without candidate is UNKNOWN', () => { const e = evidence(); e.runs.items = [run({ conclusion: 'success' })]; expect(e, 'UNKNOWN'); });
check('latest Daily receipt governs, not older success', () => { const e = evidence(); e.runs.items = [run({ conclusion: 'success' }), run({ id: 2, createdAt: '2026-10-23T11:10:00Z', updatedAt: '2026-10-23T11:20:00Z', event: 'workflow_dispatch' })]; expect(e, 'FALLBACK_ASSESSMENT'); });
for (const conclusion of ['cancelled', 'skipped', 'neutral', 'action_required', 'stale', 'startup_failure']) {
  check(`terminal ${conclusion} requires reconciliation`, () => { const e = evidence(); e.runs.items = [run({ conclusion })]; expect(e, 'UNKNOWN'); });
}
check('published file alone is not complete delivery', () => { const e = evidence(); e.article.state = 'published'; e.article.contentSha = C; expect(e, 'PUBLICATION_VERIFICATION'); });
check('fully bound synthetic manual release can be delivered but never native accepted', () => {
  const r = evaluate(published()); assert.equal(r.state, 'DELIVERED'); assert.equal(r.nativeAcceptance, 'NOT_EVALUATED');
});
for (const key of ['article', 'index', 'latestJson', 'rss']) {
  check(`missing ${key} live evidence holds delivery`, () => { const e = published(); delete e.release.live[key]; expect(e, 'PUBLICATION_VERIFICATION'); });
  check(`wrong ${key} date holds delivery`, () => { const e = published(); e.release.live[key].edition = '2026-10-22'; expect(e, 'PUBLICATION_VERIFICATION'); });
}
for (const [name, mutate] of [
  ['wrong deployed SHA', e => e.release.production.sha = D],
  ['missing apex alias', e => e.release.production.aliases = ['www.usd-impact.com']],
  ['building deployment', e => e.release.production.state = 'BUILDING'],
  ['unknown merge ancestry', e => e.release.production.mergeContained = false],
  ['wrong content hash', e => e.release.production.contentSha = D],
  ['wrong release PR', e => e.release.prNumber = 2],
  ['unprotected merge', e => e.release.protectedMerge = false],
  ['stale release evidence', e => e.release.observedAt = '2026-10-23T11:54:00Z'],
  ['missing human receipt', e => delete e.prs.items[0].humanReview.receipt],
  ['credential-bearing receipt URL', e => e.release.production.receipt = 'https://private:secret@vercel.com/example'],
]) check(name, () => { const e = published(); mutate(e); expect(e, 'PUBLICATION_VERIFICATION'); });
check('18:00 unmet gate requests escalation without sending anything', () => {
  const at = '2026-10-23T16:00:00Z', r = evaluate(evidence(at), at); assert.equal(r.escalationRequired, true); assert.equal(r.executionAllowed, false);
});
check('frozen input remains unchanged', () => { const e = freeze(published()), before = JSON.stringify(e); evaluate(e); assert.equal(JSON.stringify(e), before); });
check('deterministic, immutable output', () => { const e = evidence(); assert.deepEqual(evaluate(e), evaluate(e)); assert.equal(Object.isFrozen(evaluate(e)), true); });
check('no raw input or secret echoed', () => { const e = evidence(); e.secret = 'sensitive-fixture-not-real'; assert.equal(JSON.stringify(evaluate(e)).includes(e.secret), false); });
check('policy snapshot bound remains distinct from Health age', () => { assert.equal(POLICY.snapshotMaxAgeMs, 300000); assert.equal(Object.isFrozen(POLICY), true); });
const source = await readFile(new URL('./publishing-deadline-status.mjs', import.meta.url), 'utf8');
check('module has no imported I/O or clock execution', () => {
  assert.doesNotMatch(source, /\b(?:import|require)\s*(?:\(|\{|['"])/);
  assert.doesNotMatch(source, /\bfetch\s*\(|\bprocess\.|Date\.now\s*\(|\b(?:setTimeout|setInterval|eval)\s*\(/);
});
check('global fetch trap is never touched', () => {
  const original = globalThis.fetch; let calls = 0;
  try { globalThis.fetch = () => { calls++; throw new Error('network forbidden'); }; evaluate(evidence()); evaluate(published()); }
  finally { globalThis.fetch = original; }
  assert.equal(calls, 0);
});
console.log(JSON.stringify({ result: 'PASS', testGroups: count, runtime: process.version,
  providerRequests: 0, externalRequests: 0, repositoryWrites: 0,
  activation: 'NOT_INSTALLED', nativeAcceptance: 'NOT_EVALUATED', cases: results }, null, 2));
