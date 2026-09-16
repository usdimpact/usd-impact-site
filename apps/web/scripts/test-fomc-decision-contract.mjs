import assert from 'node:assert/strict';
import { readFile, readdir, lstat, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOMC_ASSERTION_SCHEMA, FOMC_CONTRACT_VERSION, FOMC_ASSERTION_FIELDS, FomcContractHold,
  normalizeFomcDecisionAssertion, fomcDecisionIdentity, fomcDecisionPhaseKey, inspectFomcDecisionContract,
} from '../src/lib/fomc-decision-contract.js';

let groups = 0;
const check = (fn) => { fn(); groups += 1; };
const fixture = (changes = {}) => ({
  schema: 'fomc-decision-assertion/v1', publisher: 'FEDERAL_RESERVE', committee: 'FOMC',
  eventKind: 'policy-decision', meetingKind: 'scheduled-two-day',
  meetingStartDate: '2026-09-15', meetingEndDate: '2026-09-16', decisionDate: '2026-09-16',
  releaseTime: '14:00', timeZone: 'America/New_York', releaseAt: '2026-09-16T18:00:00.000Z',
  ...changes,
});
const request = (assertion = fixture(), phase = 'preview') => ({
  assertion, phase, statusLabel: phase === 'preview' ? 'scheduled-confirmed' : 'released',
});
const deadline = Date.parse(fixture().releaseAt);
function rejects(fn, code) {
  assert.throws(fn, (error) => error instanceof FomcContractHold && error.code === code && error.message === code);
}
function nonAuthorizing(result) {
  assert.equal(result.decision, 'ASSERTION_VALID_NOT_VERIFIED');
  assert.equal(result.outcomeEvidence, 'NOT_CHECKED');
  assert.equal(result.clockBasis, 'caller-supplied-diagnostic-only');
  for (const field of ['freshSourceVerificationPerformed', 'calendarLeaseIssued', 'publicationAuthorized', 'enforcementActive']) {
    assert.equal(result[field], false, field);
  }
  for (const field of ['verified', 'publishable', 'validUntil', 'signature', 'receipt', 'admission']) {
    assert.equal(Object.hasOwn(result, field), false, field);
  }
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.assertion));
}
check(() => {
  assert.equal(FOMC_ASSERTION_SCHEMA, fixture().schema);
  assert.equal(FOMC_CONTRACT_VERSION, 'fomc-decision-contract/v1');
  assert.deepEqual([...FOMC_ASSERTION_FIELDS], Object.keys(fixture()));
  assert.ok(Object.isFrozen(FOMC_ASSERTION_FIELDS));
});

// All dates below are synthetic arithmetic fixtures, not a verified meeting list.
for (const [start, end, hour] of [
  ['2026-01-27', '2026-01-28', '19'], ['2026-06-16', '2026-06-17', '18'],
  ['2026-09-15', '2026-09-16', '18'], ['2026-12-08', '2026-12-09', '19'],
  ['2025-12-31', '2026-01-01', '19'], ['2026-04-30', '2026-05-01', '18'],
  ['2024-02-28', '2024-02-29', '19'], ['2024-02-29', '2024-03-01', '19'],
  ['2026-03-06', '2026-03-07', '19'], ['2026-03-07', '2026-03-08', '18'],
  ['2026-10-30', '2026-10-31', '18'], ['2026-10-31', '2026-11-01', '19'],
]) check(() => {
  const value = fixture({ meetingStartDate: start, meetingEndDate: end, decisionDate: end, releaseAt: `${end}T${hour}:00:00.000Z` });
  assert.deepEqual(normalizeFomcDecisionAssertion(value), value);
  const result = inspectFomcDecisionContract(request(value), Date.parse(value.releaseAt) - 1);
  nonAuthorizing(result);
  assert.equal(result.previewDeadlineElapsed, false);
});
for (const [delta, relation, elapsed] of [
  [-1, 'BEFORE_ASSERTED_RELEASE', false], [0, 'AT_ASSERTED_RELEASE', true], [1, 'AFTER_ASSERTED_RELEASE', true],
  [30 * 60000, 'AFTER_ASSERTED_RELEASE', true], [DAY(), 'AFTER_ASSERTED_RELEASE', true],
]) for (const phase of ['preview', 'outcome']) check(() => {
  const result = inspectFomcDecisionContract(request(fixture(), phase), deadline + delta);
  nonAuthorizing(result);
  assert.equal(result.clockRelation, relation);
  assert.equal(result.previewDeadlineElapsed, elapsed);
});
function DAY() { return 86400000; }
check(() => {
  const value = fixture(); const before = JSON.stringify(value);
  const identity = fomcDecisionIdentity(value);
  assert.equal(identity, 'fomc-decision/v1|publisher=FEDERAL_RESERVE|committee=FOMC|eventKind=policy-decision|meetingKind=scheduled-two-day|meetingStartDate=2026-09-15|meetingEndDate=2026-09-16');
  assert.equal(fomcDecisionPhaseKey(value, 'preview'), `${identity}|phase=preview`);
  assert.equal(fomcDecisionPhaseKey(value, 'outcome'), `${identity}|phase=outcome`);
  assert.equal(inspectFomcDecisionContract(request(value, 'outcome'), deadline).eventIdentity, identity);
  assert.equal(JSON.stringify(value), before);
  assert.notEqual(normalizeFomcDecisionAssertion(value), value);
});
check(() => {
  const value = fixture({ releaseAt: '2026-09-16T18:00:00Z' });
  const reversed = Object.fromEntries(Object.entries(value).reverse());
  assert.equal(fomcDecisionIdentity(reversed), fomcDecisionIdentity(fixture()));
  assert.equal(normalizeFomcDecisionAssertion(reversed).releaseAt, fixture().releaseAt);
  assert.deepEqual(normalizeFomcDecisionAssertion(Object.assign(Object.create(null), value)), normalizeFomcDecisionAssertion(value));
});
check(() => {
  const changedDates = fixture({ meetingStartDate: '2026-09-16', meetingEndDate: '2026-09-17', decisionDate: '2026-09-17', releaseAt: '2026-09-17T18:00:00Z' });
  assert.notEqual(fomcDecisionIdentity(changedDates), fomcDecisionIdentity(fixture()));
  // A different asserted range is a different identity, not an automatic reschedule/supersession.
  assert.equal(Object.hasOwn(inspectFomcDecisionContract(request(changedDates), deadline), 'supersedes'), false);
});
check(() => {
  const result = inspectFomcDecisionContract(request(), deadline - 1);
  assert.throws(() => { result.publicationAuthorized = true; }, TypeError);
  assert.throws(() => { result.assertion.releaseTime = '14:30'; }, TypeError);
  const input = fixture(); const output = normalizeFomcDecisionAssertion(input);
  input.meetingStartDate = '2020-01-01';
  assert.equal(output.meetingStartDate, '2026-09-15');
});
for (const field of FOMC_ASSERTION_FIELDS) {
  check(() => { const value = fixture(); delete value[field]; rejects(() => normalizeFomcDecisionAssertion(value), 'HOLD_FOMC_ASSERTION_SHAPE'); });
  for (const bad of [null, undefined, true, 14, ['text'], { toString() { throw new Error('must not coerce'); } }]) {
    check(() => rejects(() => normalizeFomcDecisionAssertion(fixture({ [field]: bad })), 'HOLD_FOMC_ASSERTION_SHAPE'));
  }
  check(() => rejects(() => normalizeFomcDecisionAssertion(fixture({ [field]: ` ${fixture()[field]}` })), 'HOLD_FOMC_ASSERTION_SHAPE'));
}
for (const value of [null, [], 'text', 5, Object.create(fixture()), new Date(), new (class Assertion {})()]) {
  check(() => rejects(() => normalizeFomcDecisionAssertion(value), 'HOLD_FOMC_ASSERTION_SHAPE'));
}
for (const field of ['verified', 'publicationAuthorized', 'calendarLeaseIssued', 'phase', 'statusLabel', 'event', 'title', 'slug', 'rate', 'supersedes', 'referencePeriod']) {
  check(() => rejects(() => normalizeFomcDecisionAssertion(fixture({ [field]: 'untrusted' })), 'HOLD_FOMC_ASSERTION_SHAPE'));
}
check(() => rejects(() => normalizeFomcDecisionAssertion(fixture({ schema: 'fomc-decision-assertion/v2' })), 'HOLD_FOMC_ASSERTION_SHAPE'));
for (const change of [
  { publisher: 'BLS' }, { committee: 'BOARD_OF_GOVERNORS' }, { meetingKind: 'emergency' },
  { meetingKind: 'one-day' }, { meetingKind: 'rescheduled' }, { meetingKind: 'unscheduled' },
  ...['press-conference', 'minutes', 'projections', 'implementation-note', 'speech', 'notation-vote', 'meeting-start'].map((eventKind) => ({ eventKind })),
]) check(() => rejects(() => normalizeFomcDecisionAssertion(fixture(change)), 'HOLD_FOMC_UNSUPPORTED_EVENT'));
for (const change of [
  { decisionDate: '2026-09-15' }, { meetingStartDate: '2026-09-16' }, { meetingStartDate: '2026-09-17' },
  { meetingStartDate: '2026-09-14' }, { meetingStartDate: '2026-02-29' }, { decisionDate: '2026-13-16' },
  { meetingEndDate: '2026-04-31' }, { meetingStartDate: '2026-9-15' }, { meetingStartDate: '2026-09-00' },
  { meetingStartDate: '1999-12-31' }, { decisionDate: '2100-01-01' },
]) check(() => rejects(() => normalizeFomcDecisionAssertion(fixture(change)), 'HOLD_FOMC_DATES'));
for (const change of [
  { releaseTime: '14:30' }, { releaseTime: '17:00' }, { releaseTime: '2:00' }, { releaseTime: '02:30' },
  { timeZone: 'EST' }, { timeZone: 'EDT' }, { timeZone: 'UTC' },
  { releaseAt: '2026-09-16T19:00:00Z' }, { releaseAt: '2026-09-15T18:00:00Z' },
  { releaseAt: '2026-09-16T18:30:00Z' }, { releaseAt: '2026-09-16T18:00:00+00:00' },
  { releaseAt: '2026-09-16T18:00:00.001Z' }, { releaseAt: '2026-09-16T18:00:01Z' },
]) check(() => rejects(() => normalizeFomcDecisionAssertion(fixture(change)), 'HOLD_FOMC_RELEASE_TIME'));
for (const phase of ['', 'PREVIEW', 'released', null, 1, {}, ['preview']]) {
  check(() => rejects(() => fomcDecisionPhaseKey(fixture(), phase), 'HOLD_FOMC_PHASE'));
}
for (const statusLabel of ['released', 'rescheduled', 'cancelled', null, true]) {
  check(() => rejects(() => inspectFomcDecisionContract({ ...request(), statusLabel }, deadline), 'HOLD_FOMC_PHASE'));
}
check(() => rejects(() => inspectFomcDecisionContract({ ...request(fixture(), 'outcome'), statusLabel: 'scheduled-confirmed' }, deadline), 'HOLD_FOMC_PHASE'));
for (const clock of [undefined, null, '1789581600000', -1, 0.5, NaN, Infinity, 8640000000000001, 1n, new Date()]) {
  check(() => rejects(() => inspectFomcDecisionContract(request(), clock), 'HOLD_FOMC_CLOCK'));
}
for (const field of ['verified', 'publicationAuthorized', 'clock', 'sources', 'receipt']) {
  check(() => rejects(() => inspectFomcDecisionContract({ ...request(), [field]: true }, deadline), 'HOLD_FOMC_ASSERTION_SHAPE'));
}
check(() => {
  let invoked = 0;
  const value = fixture();
  Object.defineProperty(value, 'releaseAt', { enumerable: true, get() { invoked += 1; throw new Error('secret'); } });
  rejects(() => normalizeFomcDecisionAssertion(value), 'HOLD_FOMC_ASSERTION_SHAPE');
  const outer = request();
  Object.defineProperty(outer, 'assertion', { enumerable: true, get() { invoked += 1; throw new Error('secret'); } });
  rejects(() => inspectFomcDecisionContract(outer, deadline), 'HOLD_FOMC_ASSERTION_SHAPE');
  assert.equal(invoked, 0);
});
check(() => {
  let invoked = 0; const trap = () => { invoked += 1; throw new Error('proxy trap'); };
  const proxy = new Proxy(fixture(), { getPrototypeOf: trap, ownKeys: trap, get: trap, getOwnPropertyDescriptor: trap });
  rejects(() => normalizeFomcDecisionAssertion(proxy), 'HOLD_FOMC_ASSERTION_SHAPE');
  rejects(() => inspectFomcDecisionContract(new Proxy(request(), { getPrototypeOf: trap }), deadline), 'HOLD_FOMC_ASSERTION_SHAPE');
  const revoked = Proxy.revocable(fixture(), {}); revoked.revoke();
  rejects(() => normalizeFomcDecisionAssertion(revoked.proxy), 'HOLD_FOMC_ASSERTION_SHAPE');
  assert.equal(invoked, 0);
});
check(() => {
  const hidden = fixture(); Object.defineProperty(hidden, 'releaseAt', { enumerable: false });
  rejects(() => normalizeFomcDecisionAssertion(hidden), 'HOLD_FOMC_ASSERTION_SHAPE');
  const symbolic = fixture(); symbolic[Symbol('verified')] = true;
  rejects(() => normalizeFomcDecisionAssertion(symbolic), 'HOLD_FOMC_ASSERTION_SHAPE');
  const poisoned = JSON.parse(JSON.stringify(fixture()).replace(/}$/, ',"__proto__":{"verified":true}}'));
  rejects(() => normalizeFomcDecisionAssertion(poisoned), 'HOLD_FOMC_ASSERTION_SHAPE');
});
check(() => {
  const originalFetch = globalThis.fetch; const originalNow = Date.now; let calls = 0;
  const rejectCall = () => { calls += 1; throw new Error('unexpected side effect'); };
  try {
    globalThis.fetch = rejectCall; Date.now = rejectCall;
    nonAuthorizing(inspectFomcDecisionContract(request(fixture(), 'outcome'), deadline + 1));
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
});

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const moduleSource = await readFile(new URL('../src/lib/fomc-decision-contract.js', import.meta.url), 'utf8');
check(() => {
  assert.deepEqual([...moduleSource.matchAll(/^import .+ from '([^']+)';$/gm)].map((match) => match[1]), ['node:util']);
  assert.doesNotMatch(moduleSource, /\b(?:process|fetch|setTimeout|setInterval|eval|require)\b|\bimport\s*\(|Date\.now|new Date\(\)/);
});
const allowedReferences = ['src/lib/fomc-decision-contract.js', 'scripts/test-fomc-decision-contract.mjs', 'scripts/validate-publishing.mjs'];
async function scanDormancy(root) {
  let scanned = 0; const references = [];
  async function visit(relative) {
    const absolute = path.join(root, relative); const stat = await lstat(absolute);
    assert.equal(stat.isSymbolicLink(), false, `Unexpected symlink: ${relative}`);
    if (stat.isDirectory()) {
      for (const item of await readdir(absolute)) await visit(path.join(relative, item));
    } else if (/\.(?:js|mjs|cjs|ts|tsx|jsx|astro)$/.test(relative)) {
      assert.ok(stat.isFile() && stat.size <= 4000000, `Unsupported source: ${relative}`);
      scanned += 1;
      const text = await readFile(absolute, 'utf8');
      if (text.includes('fomc-decision-contract')) {
        const normalized = relative.split(path.sep).join('/');
        assert.ok(allowedReferences.includes(normalized), `Dormant FOMC reference outside offline allowlist: ${normalized}`);
        references.push(normalized);
      }
    }
  }
  for (const directory of ['src', 'api', 'scripts']) {
    assert.ok((await lstat(path.join(root, directory))).isDirectory());
    await visit(directory);
  }
  await visit('middleware.js');
  assert.deepEqual(references.sort(), [...allowedReferences].sort());
  return scanned;
}
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'fomc-dormancy-'));
try {
  for (const directory of ['src/lib', 'api', 'scripts']) await mkdir(path.join(temporaryRoot, directory), { recursive: true });
  for (const file of allowedReferences) await writeFile(path.join(temporaryRoot, file), '// fomc-decision-contract fixture');
  await writeFile(path.join(temporaryRoot, 'middleware.js'), '// inert fixture');
  assert.equal(await scanDormancy(temporaryRoot), 4); groups += 1;
  await writeFile(path.join(temporaryRoot, 'api/accidental.js'), "import '../src/lib/fomc-decision-contract.js';");
  await assert.rejects(scanDormancy(temporaryRoot), /outside offline allowlist/); groups += 1;
} finally { await rm(temporaryRoot, { recursive: true, force: true }); }

// COMPLETE_CHECKOUT_DORMANCY_CHECK: the normal CI path always executes this scan.
const sourceFilesScanned = await scanDormancy(webRoot); groups += 1;
const driver = await readFile(path.join(webRoot, 'scripts/validate-publishing.mjs'), 'utf8');
check(() => assert.equal(driver.split("await import('./test-fomc-decision-contract.mjs');").length - 1, 1));
console.log(`FOMC decision contract: ${groups} groups passed; ${sourceFilesScanned} source files checked for dormant-only references (synthetic assertions, no source verification or publication).`);
