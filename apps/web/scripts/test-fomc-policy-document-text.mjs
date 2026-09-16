import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, lstat, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOMC_TEXT_SCHEMA, FOMC_TEXT_PAIR_SCHEMA, FOMC_TEXT_MAX_BYTES, FomcTextHold,
  parseFomcPolicyDocumentText, compareFomcPolicyDocumentTexts,
} from '../src/lib/fomc-policy-document-text.js';

let groups = 0;
const check = (fn) => { fn(); groups += 1; };
function rejects(fn, code) {
  assert.throws(fn, (error) => error instanceof FomcTextHold && error.message === error.code
    && /^HOLD_FOMC_TEXT_[A-Z_]+$/.test(error.code) && (!code || error.code === code));
}
const fixtureData = JSON.parse(await readFile(new URL('./fixtures/fomc-policy-document-text-cases.json', import.meta.url), 'utf8'));
assert.equal(fixtureData.schema, 'fomc-policy-document-text-fixtures/v1');
const byId = Object.fromEntries(fixtureData.cases.map((item) => [item.id, item]));
const cut = byId['majority-cut-not-dissent'].request;
const hold = byId['majority-maintain-not-dissent'].request;
const note = byId['note-other-rates-not-target'].request;
const parse = parseFomcPolicyDocumentText;
const pair = (statement = cut, implementation = note) => compareFomcPolicyDocumentTexts({ schema: FOMC_TEXT_PAIR_SCHEMA, statement, implementation });
const textChange = (input, from, to) => ({ ...input, articleText: input.articleText.replace(from, to) });
const flags = ['sourceAuthenticityVerified', 'meetingAssociationVerified', 'rawPageCompatibilityCertified', 'documentCompletenessVerified', 'freshSourceVerificationPerformed', 'calendarLeaseIssued', 'publicationAuthorized', 'enforcementActive'];
function nonAuthorizing(result) {
  for (const key of flags) assert.equal(result[key], false, key);
  for (const key of ['PASS', 'verified', 'publishable', 'validUntil', 'signature', 'lease', 'admission', 'receipt']) assert.equal(Object.hasOwn(result, key), false, key);
  assert.ok(Object.isFrozen(result));
}
function spans(result, text) {
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    assert.ok(Object.isFrozen(value));
    if (Object.hasOwn(value, 'unit') && value.unit === 'UTF-16-code-units') {
      assert.ok(Number.isInteger(value.start) && Number.isInteger(value.end) && value.start >= 0 && value.end > value.start && value.end <= text.length);
      assert.equal(value.text, text.slice(value.start, value.end));
    }
    for (const item of Object.values(value)) visit(item);
  }
  visit(result);
  assert.equal(result.documentTextSha256, createHash('sha256').update(text, 'utf8').digest('hex'));
}
for (const item of fixtureData.cases) check(() => {
  assert.ok(['synthetic-article-text', 'synthetic-context-with-source-derived-wording'].includes(item.provenance.kind));
  if (item.provenance.kind === 'synthetic-context-with-source-derived-wording') {
    assert.ok(item.provenance.sourceWordings.length > 0);
    for (const wording of item.provenance.sourceWordings) assert.ok(item.request.articleText.includes(wording));
  }
  assert.equal(item.provenance.rawResponseCaptured, false);
  assert.equal(item.provenance.textSha256, createHash('sha256').update(item.request.articleText, 'utf8').digest('hex'));
  if (item.expectedError) { rejects(() => parse(item.request), item.expectedError); return; }
  const result = parse(item.request), expected = item.expected;
  assert.equal(result.decision, 'DOCUMENT_TEXT_PARSED_NOT_VERIFIED');
  nonAuthorizing(result); spans(result, item.request.articleText);
  for (const field of ['action', 'changeBasisPoints', 'changeStatedNumerically', 'associatedStatementDate', 'directiveEffectiveDate']) assert.equal(result[field], expected[field], `${item.id}:${field}`);
  assert.equal(result.targetRange.lowerBasisPoints, expected.lowerBasisPoints);
  assert.equal(result.targetRange.upperBasisPoints, expected.upperBasisPoints);
  assert.equal(result.releaseClock?.releaseAt ?? null, expected.releaseAt);
});
check(() => {
  const result = pair(); nonAuthorizing(result);
  assert.equal(result.decision, 'DOCUMENT_TEXT_PAIR_CONSISTENT_NOT_VERIFIED');
  assert.equal(result.implementation.releaseClock, null);
  assert.equal(result.implementation.directiveEffectiveDate, '2025-12-11');
  spans(result.statement, cut.articleText); spans(result.implementation, note.articleText);
});
for (const id of ['note-clock-explicit', 'note-issue-and-effective-distinct', 'note-updated-date-retained']) check(() => nonAuthorizing(pair(cut, byId[id].request)));
check(() => {
  const result = parse(byId['note-updated-date-retained'].request);
  assert.deepEqual(result.updateNotices.map(({ kind, date }) => ({ kind, date })), [{ kind: 'update-advisory', date: null }, { kind: 'printed-update-date', date: '2025-12-12' }]);
});
for (const change of ['3-1/2 to 4', '3 to 3-3/4']) check(() => rejects(() => pair(cut, textChange(note, '3-1/2 to 3-3/4', change)), 'HOLD_FOMC_TEXT_PAIR_CONFLICT'));
check(() => rejects(() => pair(hold, note), 'HOLD_FOMC_TEXT_PAIR_CONFLICT'));
check(() => rejects(() => pair(note, cut), 'HOLD_FOMC_TEXT_ROLE'));
check(() => rejects(() => pair(parse(cut), parse(note)), 'HOLD_FOMC_TEXT_SHAPE'));
for (const bad of [null, [], true, 'text', 42, Object.create(cut), new Date(), new (class Request {})()]) check(() => rejects(() => parse(bad), 'HOLD_FOMC_TEXT_SHAPE'));
for (const field of Object.keys(cut)) {
  check(() => { const value = { ...cut }; delete value[field]; rejects(() => parse(value), 'HOLD_FOMC_TEXT_SHAPE'); });
  for (const bad of [null, undefined, true, 17, {}, [], { toString() { throw new Error('must-not-coerce'); } }]) check(() => rejects(() => parse({ ...cut, [field]: bad })));
}
for (const field of ['verified', 'publicationAuthorized', 'enforcementActive', 'sourceAuthenticityVerified', 'permissive', 'expectedRate', 'calendarLeaseIssued']) check(() => rejects(() => parse({ ...cut, [field]: true }), 'HOLD_FOMC_TEXT_SHAPE'));
check(() => nonAuthorizing(parse(Object.assign(Object.create(null), cut))));
check(() => {
  const saved = JSON.stringify(cut), result = parse(cut);
  assert.equal(JSON.stringify(cut), saved);
  assert.throws(() => { result.publicationAuthorized = true; }, TypeError);
  assert.throws(() => { result.targetRange.lowerBasisPoints = 0; }, TypeError);
});
check(() => {
  let invoked = 0;
  for (const field of Object.keys(cut)) {
    const value = { ...cut }; Object.defineProperty(value, field, { enumerable: true, get() { invoked += 1; throw new Error('secret'); } });
    rejects(() => parse(value), 'HOLD_FOMC_TEXT_SHAPE');
  }
  const trap = () => { invoked += 1; throw new Error('secret'); };
  rejects(() => parse(new Proxy(cut, { get: trap, ownKeys: trap, getOwnPropertyDescriptor: trap, getPrototypeOf: trap })), 'HOLD_FOMC_TEXT_SHAPE');
  const revoked = Proxy.revocable(cut, {}); revoked.revoke(); rejects(() => parse(revoked.proxy), 'HOLD_FOMC_TEXT_SHAPE');
  const outer = { schema: FOMC_TEXT_PAIR_SCHEMA, statement: cut, implementation: note };
  Object.defineProperty(outer, 'statement', { enumerable: true, get: trap });
  rejects(() => compareFomcPolicyDocumentTexts(outer), 'HOLD_FOMC_TEXT_SHAPE');
  assert.equal(invoked, 0);
});
check(() => {
  const hidden = { ...cut }; Object.defineProperty(hidden, 'articleText', { enumerable: false }); rejects(() => parse(hidden), 'HOLD_FOMC_TEXT_SHAPE');
  const symbol = { ...cut, [Symbol('approval')]: true }; rejects(() => parse(symbol), 'HOLD_FOMC_TEXT_SHAPE');
  const poisoned = JSON.parse(JSON.stringify(cut).replace(/}$/, ',"__proto__":{"verified":true}}')); rejects(() => parse(poisoned), 'HOLD_FOMC_TEXT_SHAPE');
});
for (const url of [
  cut.sourceUrl+'?verified=true', cut.sourceUrl+'#body', cut.sourceUrl.replace('https:', 'http:'),
  cut.sourceUrl.replace('www.federalreserve.gov', 'www.federalreserve.gov.evil.invalid'),
  cut.sourceUrl.replace('www.', ''), cut.sourceUrl.replace('www.', 'USER@www.'),
  cut.sourceUrl.replace('.gov/', '.gov:443/'), cut.sourceUrl.replace('20251210a', '20251211a'),
  cut.sourceUrl.replace('20251210a', '20251210a1'), cut.sourceUrl.replace('/pressreleases/', '/pressreleases/../pressreleases/'),
  cut.sourceUrl.replace('monetary', 'monet%61ry'), cut.sourceUrl+' ', 'x'.repeat(2049),
]) check(() => rejects(() => parse({ ...cut, sourceUrl: url })));
for (const extra of ['<script>fake</script>', '...', '\u2026', '[truncated]', '\u0000', '\u000b', '\u202e', '\ud800', '\u00ad', '\rX', '&lt;article&gt;']) check(() => rejects(() => parse({ ...cut, articleText: cut.articleText+extra }), 'HOLD_FOMC_TEXT_INPUT'));
check(() => rejects(() => parse({ ...cut, articleText: 'x'.repeat(FOMC_TEXT_MAX_BYTES+1) }), 'HOLD_FOMC_TEXT_INPUT'));
check(() => rejects(() => parse({ ...cut, articleText: '\u00e9'.repeat(FOMC_TEXT_MAX_BYTES/2+1) }), 'HOLD_FOMC_TEXT_INPUT'));
check(() => rejects(() => parse({ ...cut, articleText: cut.articleText+'x'.repeat(4097) }), 'HOLD_FOMC_TEXT_INPUT'));
check(() => rejects(() => parse({ ...cut, articleText: cut.articleText+'x\n\n'.repeat(257) }), 'HOLD_FOMC_TEXT_INPUT'));
check(() => rejects(() => parse({ ...cut, articleText: cut.articleText+'x\n'.repeat(1025) }), 'HOLD_FOMC_TEXT_INPUT'));
for (const text of [
  cut.articleText+cut.articleText, cut.articleText+note.articleText,
  'Minutes of the Federal Open Market Committee\n'+cut.articleText,
  cut.articleText.replace('Federal Reserve issues FOMC statement', 'Press Conference'),
  'The Committee decided to maintain the target range for the federal funds rate at 3 to 4 percent.',
  cut.articleText.replace('Voting for the monetary policy action were', 'Participants discussed'),
]) check(() => rejects(() => parse({ ...cut, articleText: text })));
for (const bad of ['3.501', '03.50', '3e0', '-1', '101', '3-1/8', '3-2/2', '3 4/4', 'three', '3.']) check(() => rejects(() => parse(textChange(cut, '3-1/2 to 3-3/4', `${bad} to 4`))));
for (const bad of ['4 to 3', '3 to 3', '100 to 101', '3.50-3.75']) check(() => rejects(() => parse(textChange(cut, '3-1/2 to 3-3/4', bad))));
for (const bad of ['0 percentage point', '1/8 percentage point', '0.001 percentage point', '25 percent', '25.5 basis points', 'one percentage point']) check(() => rejects(() => parse(textChange(cut, '1/4 percentage point', bad))));
for (const [from, to] of [
  ['decided to lower', 'preferred to lower'], ['decided to lower', 'did not decide to lower'],
  ['3-3/4 percent.', '3-3/4 percent if inflation rises.'], ['rate by', 'rate at'],
  ['In support of its goals and in light of the shift in the balance of risks, the', 'Last month, the'],
  ['In support of its goals and in light of the shift in the balance of risks, the', '"The'],
]) check(() => rejects(() => parse(textChange(cut, from, to))));
for (const [from, to] of [
  ['December 10, 2025', 'February 29, 2025'], ['2:00 p.m. EST', '2:30 p.m. EST'],
  ['2:00 p.m. EST', '2:00 p.m. EDT'], ['2:00 p.m. EST', '14:00 UTC'],
  ['For release at 2:00 p.m. EST', 'For immediate release'],
]) check(() => rejects(() => parse(textChange(cut, from, to))));
check(() => rejects(() => parse(textChange(hold, '2:00 p.m. EDT', '2:00 p.m. EST')), 'HOLD_FOMC_TEXT_CLOCK'));
check(() => rejects(() => parse(textChange(cut, 'For release at 2:00 p.m. EST', '')), 'HOLD_FOMC_TEXT_CLOCK'));
check(() => rejects(() => parse(textChange(cut, 'For release at 2:00 p.m. EST', 'For release at 2:00 p.m. EST\nFor release at 2:00 p.m. EST')), 'HOLD_FOMC_TEXT_CLOCK'));
check(() => rejects(() => parse(textChange(hold, ' rate at ', ' rate to ')), 'HOLD_FOMC_TEXT_GRAMMAR'));
for (const [from, to] of [
  ['statement on December 10, 2025', 'statement on December 9, 2025'],
  ['Effective December 11, 2025', 'Effective December 9, 2025'],
  ['Last Update: December 10, 2025', 'Last Update: December 9, 2025'],
  ['Last Update: December 10, 2025', 'Updated: unknown'],
  ['federal funds rate in a target range', 'interest on reserve balances in a target range'],
  ['The Federal Reserve has made', 'Analysts believe the Federal Reserve has made'],
]) check(() => rejects(() => parse(textChange(note, from, to))));
check(() => rejects(() => parse({ ...note, articleText: note.articleText+'\nA different target range is 1 to 2 percent.\n' }), 'HOLD_FOMC_TEXT_AMBIGUOUS'));
check(() => rejects(() => parse({ ...note, articleText: note.articleText+'\nLast Update: December 10, 2025\n' }), 'HOLD_FOMC_TEXT_VERSION'));
check(() => {
  const alteredOtherRates = note.articleText.replace('reserve balances to 3.65', 'reserve balances to 8.75').replace('repurchase agreement operations at a rate of 3.75', 'repurchase agreement operations at a rate of 9.75');
  assert.deepEqual(parse({ ...note, articleText: alteredOtherRates }).targetRange, parse(note).targetRange);
});
for (const transform of [
  (text) => text.replaceAll('\n', '\r\n'), (text) => text.replaceAll(' ', '\u202f'),
  (text) => text.replaceAll('3-1/2', '3\u20111/2').replaceAll('3-3/4', '3\u20133/4'),
  (text) => text.replace('The Committee seeks', '\ud83d\udcc4 The Committee seeks'),
]) check(() => {
  const changed = transform(cut.articleText), result = parse({ ...cut, articleText: changed });
  assert.deepEqual(result.targetRange, parse(cut).targetRange); nonAuthorizing(result); spans(result, changed);
});
check(() => {
  const originalFetch = globalThis.fetch, originalNow = Date.now; let called = 0;
  const fail = () => { called += 1; throw new Error('unexpected side effect'); };
  try { globalThis.fetch = fail; Date.now = fail; nonAuthorizing(pair()); assert.equal(called, 0); }
  finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
});
for (const [notation, bp] of [['3.5', 350], ['3.05', 305], ['3 1/2', 350], ['3-1/4', 325], ['3\u00bc', 325], ['0.01', 1]]) check(() => {
  const value = textChange(cut, '3-1/2 to 3-3/4', `${notation} to 4`);
  const result = parse(value); assert.equal(result.targetRange.lowerBasisPoints, bp); spans(result, value.articleText);
});
check(() => {
  const value = textChange(cut, 'by 1/4 percentage point ', '');
  const result = parse(value); assert.equal(result.changeBasisPoints, null); assert.equal(result.changeStatedNumerically, false); assert.equal(result.evidence.change, null);
});
check(() => {
  const result = parse(cut); assert.equal(result.evidence.change.text, '1/4'); assert.equal(result.evidence.changeUnit.text, 'percentage point');
});
for (const value of [null, [], {}, { schema: FOMC_TEXT_PAIR_SCHEMA, statement: cut, implementation: note, verified: true }, { schema: 'bad', statement: cut, implementation: note }]) check(() => rejects(() => compareFomcPolicyDocumentTexts(value), 'HOLD_FOMC_TEXT_SHAPE'));
check(() => rejects(() => parse({ ...cut, schema: 'fomc-policy-document-text/v2' }), 'HOLD_FOMC_TEXT_SHAPE'));
check(() => rejects(() => parse({ ...cut, documentRole: 'minutes' }), 'HOLD_FOMC_TEXT_SHAPE'));
check(() => {
  const value = { ...note, articleText: note.articleText.replace('This information will be updated as appropriate.\n\nLast Update: December 10, 2025\n', '') };
  assert.deepEqual(parse(value).updateNotices, []);
});
check(() => rejects(() => parse({ ...cut, articleText: cut.articleText+'\nA copied document: Federal Reserve issues FOMC statement\n' }), 'HOLD_FOMC_TEXT_ROLE'));
check(() => {
  const value = { ...cut, articleText: cut.articleText.replace('Federal Reserve issues FOMC statement\n\nDecember 10, 2025', 'December 10, 2025\n\nFederal Reserve issues FOMC statement') };
  assert.deepEqual(parse(value).targetRange, parse(cut).targetRange);
});
check(() => {
  const directive = '- Undertake open market operations as necessary to maintain the federal funds rate in a target range of 3-1/2 to 3-3/4 percent.';
  rejects(() => parse({ ...note, articleText: note.articleText+'\n'+directive+'\n' }), 'HOLD_FOMC_TEXT_AMBIGUOUS');
});
// Source-derived wording remains synthetic context, not original-page or outcome evidence.
const guidance = byId['source-guidance-same-paragraph'].provenance.sourceWordings[0];
const advisory = byId['source-full-update-advisory'].provenance.sourceWordings[0];
const guided = byId['source-guidance-same-paragraph'].request;
const combinedNote = byId['source-note-combined-variants'].request;
const beforeVoting = (input, sentence, separator = '\n\n') => textChange(input,
  '\n\nVoting for the', `${separator}${sentence}\n\nVoting for the`);
check(() => {
  const result = pair(guided, combinedNote); nonAuthorizing(result);
  nonAuthorizing(result.statement); nonAuthorizing(result.implementation);
  assert.equal(result.statement.action, 'lower'); assert.equal(result.statement.changeBasisPoints, -25);
  assert.equal(result.implementation.releaseClock, null);
  assert.equal(result.implementation.directiveEffectiveDate, '2025-12-11');
  assert.equal(result.statement.evidence.forwardGuidance.length, 1);
  assert.equal(result.statement.evidence.forwardGuidance[0].text, guidance);
  assert.equal(result.implementation.updateNotices[0].evidence.text, advisory);
  spans(result.statement, guided.articleText); spans(result.implementation, combinedNote.articleText);
});
for (const base of [cut, hold, byId['raise-amount-absent'].request]) check(() => {
  const value = beforeVoting(base, guidance), result = parse(value), control = parse(base);
  assert.equal(result.action, control.action); assert.equal(result.changeBasisPoints, control.changeBasisPoints);
  assert.deepEqual(result.targetRange, control.targetRange); nonAuthorizing(result); spans(result, value.articleText);
});
for (const sentence of [
  'The Committee decided to maintain the target range for the federal funds rate at 1 to 2 percent.',
  'The Committee decided to lower the target range for the federal funds rate to 3-1/2 to 3-3/4 percent.',
  'The Committee decided to leave the target range for the federal funds rate unchanged.',
  'The Committee chose to set the target range for the federal funds rate at 1 to 2 percent.',
  'The target range is now 1 to 2 percent.',
  'The target range for the federal funds rate remains 3-1/2 to 3-3/4 percent.',
  'The Committee decided to change policy without specifying a numerical range.',
]) for (const separator of [' ', '\n\n']) check(() => rejects(() => parse(beforeVoting(guided, sentence, separator))));
for (const sentence of [
  'The Committee decided to maintain the target range for the federal funds rate at 1 to 2 percent.',
  'The Committee decided to leave the target range for the federal funds rate unchanged.',
  'The target range is now 1 to 2 percent.',
]) check(() => rejects(() => parse(textChange(guided, guidance, guidance+' '+sentence))));
for (const altered of [
  guidance.replace('additional adjustments', 'additional reductions'),
  guidance.replace('will carefully assess', 'will set the range at 1 to 2 percent and assess'),
  guidance.replace('balance of risks.', 'balance of risks at this meeting.'),
  guidance.replace('the target range', 'the TARGET RANGE'),
  `Analysts said ${guidance}`, `"${guidance}"`,
  guidance.replace('risks.', 'risks; a new decision follows.'),
]) check(() => rejects(() => parse(textChange(guided, guidance, altered)), 'HOLD_FOMC_TEXT_AMBIGUOUS'));
check(() => rejects(() => parse(beforeVoting(guided, guidance)), 'HOLD_FOMC_TEXT_AMBIGUOUS'));
check(() => rejects(() => parse(textChange(cut, 'The Committee seeks', guidance+' The Committee seeks')), 'HOLD_FOMC_TEXT_AMBIGUOUS'));
check(() => rejects(() => parse({ ...cut, articleText: cut.articleText+'\n'+guidance+'\n' }), 'HOLD_FOMC_TEXT_AMBIGUOUS'));
check(() => rejects(() => parse({ ...guided, articleText: guided.articleText+'\nThe target range is now 1 to 2 percent.\n' }), 'HOLD_FOMC_TEXT_AMBIGUOUS'));
check(() => rejects(() => parse(textChange(guided, 'who preferred to lower', 'the Committee decided to lower')), 'HOLD_FOMC_TEXT_AMBIGUOUS'));
for (const verb of ['directly', 'not direct', 'consider directing', 'authorize or direct', 'authorize and not direct', 'direct and authorize']) {
  check(() => rejects(() => parse(textChange(combinedNote, 'voted to direct', `voted to ${verb}`)), 'HOLD_FOMC_TEXT_GRAMMAR'));
}
for (const changed of [
  advisory.replace('will be updated', 'could be updated'),
  advisory.replace('as appropriate to reflect', 'as appropriate, to reflect'),
  advisory.replace('Federal Open Market Committee or', 'Federal Open Market Committee and'),
  advisory+' Publication is approved.',
  advisory.slice(0, -1), advisory.replace('policy.', 'policy; this is verified.'),
]) check(() => rejects(() => parse(textChange(combinedNote, advisory, changed)), 'HOLD_FOMC_TEXT_VERSION'));
check(() => rejects(() => parse({ ...combinedNote, articleText: combinedNote.articleText+'\n'+advisory+'\n' }), 'HOLD_FOMC_TEXT_VERSION'));
for (const [input, from, to] of [
  [guided, guidance, guidance.replaceAll(', ', ',\n')],
  [combinedNote, advisory, advisory.replace('regarding details', 'regarding\ndetails')],
  [combinedNote, advisory, advisory.replace("Reserve's", 'Reserve\u2019s')],
  [guided, '3-1/2 to 3-3/4', '3\u20111/2 to 3\u20133/4'],
]) check(() => {
  const value = textChange(input, from, to), result = parse(value);
  assert.deepEqual(result.targetRange, parse(input).targetRange); nonAuthorizing(result); spans(result, value.articleText);
});
check(() => {
  const noAmount = textChange(guided, 'by 1/4 percentage point ', ''), result = parse(noAmount);
  assert.equal(result.changeBasisPoints, null); assert.equal(result.evidence.change, null);
  assert.equal(pair(noAmount, combinedNote).implementation.releaseClock, null); nonAuthorizing(result);
});
for (const change of ['3 to 3-3/4', '3-1/2 to 4']) check(() => rejects(() => pair(guided, textChange(combinedNote, '3-1/2 to 3-3/4', change)), 'HOLD_FOMC_TEXT_PAIR_CONFLICT'));
check(() => {
  const originalFetch = globalThis.fetch, originalNow = Date.now; let calls = 0;
  const fail = () => { calls += 1; throw new Error('No side effects permitted'); };
  try {
    globalThis.fetch = fail; Date.now = fail;
    nonAuthorizing(pair(guided, combinedNote)); assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
});
check(() => {
  assert.deepEqual(parse(cut).evidence.forwardGuidance, []);
  assert.ok(parse(guided).evidence.targetClause.end <= parse(guided).evidence.forwardGuidance[0].start);
});
const moduleSource = await readFile(new URL('../src/lib/fomc-policy-document-text.js', import.meta.url), 'utf8');
check(() => {
  assert.deepEqual([...moduleSource.matchAll(/^import .+ from '([^']+)';$/gm)].map((match) => match[1]), ['node:crypto', 'node:util']);
  assert.doesNotMatch(moduleSource, /\b(?:process|fetch|console|setTimeout|setInterval|eval|require)\b|\bimport\s*\(|Date\.now|new Date\(\)/);
});
const allowed = ['src/lib/fomc-policy-document-text.js', 'scripts/test-fomc-policy-document-text.mjs', 'scripts/validate-publishing.mjs'];
async function scanDormancy(root) {
  let count = 0; const references = [];
  async function visit(relative) {
    const absolute = path.join(root, relative), stat = await lstat(absolute);
    assert.equal(stat.isSymbolicLink(), false, 'Source symlink not allowed');
    if (stat.isDirectory()) { for (const name of await readdir(absolute)) await visit(path.join(relative, name)); }
    else if (/\.(?:js|mjs|cjs|ts|tsx|jsx|astro)$/.test(relative)) {
      assert.ok(stat.isFile() && stat.size <= 4000000); count += 1; assert.ok(count <= 10000);
      if ((await readFile(absolute, 'utf8')).includes('fomc-policy-document-text')) {
        const name = relative.split(path.sep).join('/');
        assert.ok(allowed.includes(name), `Unexpected active text-parser reference: ${name}`); references.push(name);
      }
    }
  }
  for (const directory of ['src', 'api', 'scripts']) { assert.ok((await lstat(path.join(root, directory))).isDirectory()); await visit(directory); }
  await visit('middleware.js'); assert.deepEqual(references.sort(), [...allowed].sort()); return count;
}
const temporary = await mkdtemp(path.join(tmpdir(), 'fomc-text-dormancy-'));
try {
  for (const directory of ['src/lib', 'api', 'scripts']) await mkdir(path.join(temporary, directory), { recursive: true });
  for (const name of allowed) await writeFile(path.join(temporary, name), '// fomc-policy-document-text fixture');
  await writeFile(path.join(temporary, 'middleware.js'), '// inert');
  assert.equal(await scanDormancy(temporary), 4); groups += 1;
  await writeFile(path.join(temporary, 'api/accidental.js'), "import '../src/lib/fomc-policy-document-text.js';");
  await assert.rejects(scanDormancy(temporary), /Unexpected active/); groups += 1;
} finally { await rm(temporary, { recursive: true, force: true }); }

// COMPLETE_CHECKOUT_DORMANCY_CHECK: no runtime switch skips this in normal CI.
const webRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceFilesScanned = await scanDormancy(webRoot); groups += 1;
const driver = await readFile(path.join(webRoot, 'scripts/validate-publishing.mjs'), 'utf8');
check(() => assert.equal(driver.split("await import('./test-fomc-policy-document-text.mjs');").length - 1, 1));
console.log(`FOMC policy document text: ${groups} groups passed; ${sourceFilesScanned} source files checked for dormant-only references (synthetic article text; no source verification or publication).`);
