import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyCatalystResponse, MAX_RESPONSE_BYTES } from './catalyst-brief-response.mjs';

const workflow = await readFile(new URL('../../../.github/workflows/catalyst-brief.yml', import.meta.url), 'utf8');
const cwd = fileURLToPath(new URL('..', import.meta.url));
const helper = fileURLToPath(new URL('./catalyst-brief-response.mjs', import.meta.url));

assert.match(workflow, /cron: '45 6 \* \* \*'/, 'preview check must run every day');
assert.match(workflow, /cron: '45 22 \* \* \*'/, 'outcome check must run every day');
assert.match(workflow, /select-important-catalyst\.mjs/, 'workflow must deterministically select an eligible catalyst');
assert.match(workflow, /catalyst-brief-source/, 'workflow must fetch fresh source-backed analysis');
assert.match(workflow, /for attempt in 1 2;/, 'research must retain at most one explicitly classified retry');
assert.match(workflow, /import-catalyst-brief\.mjs[\s\S]*--publish --skip-published/, 'workflow must import idempotently');
assert.match(workflow, /existing_pr_url="\$\(gh pr list --state open --head "\$branch"/, 'reruns must reuse an existing immutable publication PR');
assert.match(workflow, /gh workflow run quality\.yml/, 'exact publication commit must receive Web quality');
assert.match(workflow, /ready for protected review and merge/, 'workflow must hand off to protected human review');
assert.doesNotMatch(workflow, /gh pr merge/, 'workflow must never merge unreviewed catalyst content');
assert.match(workflow, /automation requires attention/, 'workflow failures must create or update a health issue');
assert.doesNotMatch(workflow, /gh issue close/, 'research and no-op successes must not auto-close publication incidents');
assert.match(workflow, /permissions:\n  actions: write\n  contents: write\n  issues: write\n  pull-requests: write\n/);
assert.match(workflow, /concurrency:\n  group: important-catalyst-brief\n  cancel-in-progress: false\n/);

function step(name) {
  const start = workflow.indexOf(`      - name: ${name}\n`);
  assert.notEqual(start, -1, `missing step: ${name}`);
  const end = workflow.indexOf('\n      - ', start + 1);
  return workflow.slice(start, end < 0 ? workflow.length : end);
}
function script(name) {
  const body = step(name).split('        run: |\n')[1];
  assert.ok(body, 'expected literal shell block');
  return body.split('\n').map((line) => {
    assert.ok(!line.trim() || line.startsWith('          '), 'unexpected shell indentation');
    return line.slice(10);
  }).join('\n');
}
const research = script('Fetch and analyze the catalyst');
const eligibility = script('Check publication eligibility');
assert.match(research, /curl -q --silent --globoff --proto '=https'/);
assert.match(research, /--max-time 280 --max-filesize 1048576/);
assert.doesNotMatch(research, /--(?:location|follow|retry|fail|insecure)\b/);
assert.match(research, /classification_exit.*!= "75"/);
assert.doesNotMatch(eligibility, /Boolean\(/);
assert.match(eligibility, /catalyst-brief-response\.mjs eligibility/);
for (const name of ['Import as protected publication content', 'Validate and build', 'Open publication pull request']) {
  assert.match(step(name), /\n        if: steps\.eligibility\.outputs\.publishable == 'true'\n/);
  assert.doesNotMatch(step(name), /always\(\)|continue-on-error/);
}
for (const body of [research, eligibility]) {
  const checked = spawnSync('bash', ['-n'], { input: body, encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
}

let groups = 1;
const remoteMarker = 'remote-secret-fixture-DO-NOT-LOG';
const encode = (value) => Buffer.from(JSON.stringify(value));
const hold = (calendarDecision = 'HOLD_UNSUPPORTED_EVENT') => ({
  publishable: false, holdReason: `${remoteMarker}\n::error::untrusted reason`,
  calendarDecision, publicationAttempted: false,
});
const classify = (payload, httpStatus = '200', transportExit = '0') => classifyCatalystResponse({
  bytes: Buffer.isBuffer(payload) ? payload : encode(payload), httpStatus, transportExit,
});
function invariants(report) {
  assert.equal(report.publicationAuthorized, false);
  assert.equal(report.enforcementActive, false);
  assert.equal(report.publishable, report.decision === 'eligible');
  assert.match(report.bodySha256, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(report).includes(remoteMarker));
}
for (const code of ['HOLD_UNSUPPORTED_EVENT', 'HOLD_PREVIEW_EXPIRED', 'HOLD_OUTCOME_NOT_RELEASED',
  'HOLD_EVIDENCE_STALE', 'HOLD_SOURCE_SCHEMA', 'HOLD_SOURCE_UNAVAILABLE', 'HOLD_INVALID_CANDIDATE', 'HOLD_IDENTITY_MISMATCH',
  'HOLD_MISSING_CALENDAR_RECORD', 'HOLD_RELEASE_TIME_MISMATCH', 'HOLD_REFERENCE_PERIOD_MISMATCH',
  'HOLD_SCHEDULE_CONFLICT', 'HOLD_CALENDAR_CLAIM', 'HOLD_DUPLICATE_EVENT', 'HOLD_INVALID_CLOCK',
  'HOLD_INVALID_PHASE', 'HOLD_REVISION_DRIFT', 'HOLD_UNTRUSTED_EVIDENCE']) {
  const report = classify(hold(code), '409');
  assert.equal(report.decision, 'hold'); assert.equal(report.code, code); invariants(report); groups++;
}
for (const [payload, status] of [
  [hold('HOLD_UNKNOWN_CODE'), '409'], [{ ...hold(), publishable: true }, '409'],
  [{ ...hold(), publicationAttempted: true }, '409'], [{ ...hold(), publicationAttempted: 'false' }, '409'],
  [{ ...hold(), holdReason: '' }, '409'], [{ ...hold(), holdReason: 'x'.repeat(501) }, '409'],
  [{ ...hold(), extra: false }, '409'], [{ publishable: false, calendarDecision: 'HOLD_UNSUPPORTED_EVENT' }, '409'],
  [{ publishable: 'false' }, '200'], [{ publishable: 'true' }, '200'], [{ publishable: 1 }, '200'],
  [{ publishable: 0 }, '200'], [{ publishable: null }, '200'], [{ publishable: [] }, '200'],
  [{ publishable: {} }, '200'], [{}, '200'], [{ nested: { publishable: true } }, '200'],
  [[], '200'], [null, '200'], [true, '200'], [{ publishable: false }, '200'],
  [{ publishable: true, error: remoteMarker }, '200'], [{ publishable: true, holdReason: 'held' }, '200'],
  [{ publishable: true, calendarDecision: 'HOLD_UNSUPPORTED_EVENT' }, '200'],
  [{ publishable: true, publicationAuthorized: true }, '200'], [hold(), '200'],
  [Buffer.from('{"publishable":false,"publishable":true}'), '200'],
  [Buffer.from('{"publishable":false,"publish\\u0061ble":true}'), '200'],
  [Buffer.from('{"publishable":true,"a":{"x":1,"x":2}}'), '200'],
  [Buffer.from('{"publishable":true,"__proto__":{}}'), '200'],
  [Buffer.from('{"publishable":true,"constructor":{}}'), '200'],
  [Buffer.from('{"publishable":true,"a":{"prototype":1}}'), '200'],
  [Buffer.from('{broken'), '200'], [Buffer.from(''), '200'], [Buffer.from('<html>Login</html>'), '200'],
  [Buffer.from([0xc3, 0x28]), '200'], [Buffer.alloc(MAX_RESPONSE_BYTES + 1), '200'],
  [Buffer.from('{"publishable":true,"a":' + '['.repeat(24) + '0' + ']'.repeat(24) + '}'), '200'],
]) {
  assert.throws(() => classify(payload, status)); groups++;
}
for (const [status, exit] of [['200\npublishable=true', '0'], ['0200', '0'], ['600', '0'],
  ['200', '-1'], ['200', '256'], ['200', '00'], ['200', 'false']]) {
  assert.throws(() => classify({}, status, exit)); groups++;
}
for (const payload of [{ publishable: true }, { publishable: false, holdReason: remoteMarker }]) {
  const report = classify(payload); invariants(report); groups++;
}

// Execute the literal workflow blocks with a fake curl executable. The fake
// has no networking imports: it records arguments and writes synthetic bytes.
// No endpoint, importer, build, GitHub command, secret or customer is used.
const root = await mkdtemp(path.join(tmpdir(), 'catalyst-response-test-'));
try {
  const bin = path.join(root, 'bin'); await mkdir(bin);
  const fakeCurl = path.join(bin, 'curl');
  await writeFile(fakeCurl, `#!${process.execPath}\n` + String.raw`
const fs = require('node:fs');
const path = require('node:path');
const dir = process.env.FIXTURE_DIR;
const callsPath = path.join(dir, 'calls.json');
const calls = JSON.parse(fs.readFileSync(callsPath));
const sequence = JSON.parse(fs.readFileSync(path.join(dir, 'sequence.json')));
const args = process.argv.slice(2);
const fixture = sequence[calls.length];
calls.push(args); fs.writeFileSync(callsPath, JSON.stringify(calls));
if (!fixture) process.exit(97);
fs.writeFileSync(args[args.indexOf('--output') + 1], Buffer.from(fixture.body, 'base64'));
process.stderr.write('remote-secret-fixture-DO-NOT-LOG');
process.stdout.write(fixture.status);
process.exit(fixture.exit);
`, { mode: 0o700 });
  await writeFile(path.join(bin, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  const response = (status, payload, exit = 0) => ({
    status, exit, body: (Buffer.isBuffer(payload) ? payload : encode(payload)).toString('base64'),
  });
  const scenarios = [
    ['unsupported HOLD', [response('409', hold())], 0, false, 1],
    ['expired HOLD', [response('409', hold('HOLD_PREVIEW_EXPIRED'))], 0, false, 1],
    ['official source unavailable HOLD', [response('409', hold('HOLD_SOURCE_UNAVAILABLE'))], 0, false, 1],
    ['research HOLD', [response('200', { publishable: false, holdReason: remoteMarker })], 0, false, 1],
    ['eligible bit only', [response('200', { publishable: true })], 0, true, 1],
    ['unknown 409', [response('409', hold('HOLD_UNKNOWN'))], 1, false, 1],
    ['malformed 409', [response('409', { publishable: false })], 1, false, 1],
    ['contradictory 409', [response('409', { ...hold(), publishable: true })], 1, false, 1],
    ['string false', [response('200', { publishable: 'false' })], 1, false, 1],
    ['missing bit', [response('200', {})], 1, false, 1],
    ['invalid JSON', [response('200', Buffer.from('{broken'))], 1, false, 1],
    ['invalid UTF8', [response('200', Buffer.from([0xc3, 0x28]))], 1, false, 1],
    ['oversized body', [response('200', Buffer.alloc(MAX_RESPONSE_BYTES + 1))], 1, false, 1],
    ['duplicate bit', [response('200', Buffer.from('{"publishable":false,"publishable":true}'))], 1, false, 1],
    ['DNS retry', [response('000', Buffer.alloc(0), 6), response('200', { publishable: true })], 0, true, 2],
    ['connect retry HOLD', [response('000', Buffer.alloc(0), 7), response('409', hold())], 0, false, 2],
    ['proxy resolution retry exhausted', [response('000', Buffer.alloc(0), 5), response('000', Buffer.alloc(0), 5)], 1, false, 2],
    ['timeout never replayed', [response('000', Buffer.alloc(0), 28)], 1, false, 1],
    ['partial response never replayed', [response('200', { publishable: true }, 18)], 1, false, 1],
    ['TLS failure', [response('000', Buffer.alloc(0), 60)], 1, false, 1],
    ['size limit transport', [response('200', Buffer.alloc(0), 63)], 1, false, 1],
    ['connection code with bytes', [response('000', Buffer.from('partial'), 7)], 1, false, 1],
    ['connection code with HTTP', [response('200', Buffer.alloc(0), 7)], 1, false, 1],
  ];
  for (const status of ['301', '302', '307', '308', '401', '403', '408', '429', '500', '502', '503', '504']) {
    scenarios.push([`HTTP ${status} never replayed`, [response(status, { error: remoteMarker })], 1, false, 1]);
  }
  let index = 0;
  for (const [name, sequence, expectedExit, expectedEligible, requests] of scenarios) {
    const dir = path.join(root, String(index++)); await mkdir(dir);
    await writeFile(path.join(dir, 'sequence.json'), JSON.stringify(sequence));
    await writeFile(path.join(dir, 'calls.json'), '[]');
    await writeFile(path.join(dir, 'catalyst-candidate.json'), '{"candidate":{}}');
    // A previous attempt's true response must not survive a new failure/HOLD.
    await writeFile(path.join(dir, 'catalyst-brief.json'), '{"publishable":true}');
    await writeFile(path.join(dir, 'catalyst-response.json'), '{"publishable":true}');
    const output = path.join(dir, 'output'); await writeFile(output, '');
    const env = {
      PATH: `${bin}:${process.env.PATH}`, HOME: dir, TMPDIR: dir, RUNNER_TEMP: dir,
      FIXTURE_DIR: dir, GITHUB_OUTPUT: output,
      CATALYST_ENDPOINT: 'https://example.invalid/catalyst-brief-source',
      NEWSFEED_BEARER_TOKEN: 'synthetic-response-test-token',
    };
    const options = { cwd, env, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 };
    const ran = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', research], options);
    assert.equal(ran.status, expectedExit, `${name}: ${ran.stderr}`);
    let logs = ran.stdout + ran.stderr;
    if (ran.status === 0) {
      const next = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', eligibility], options);
      assert.equal(next.status, 0, `${name}: ${next.stderr}`); logs += next.stdout + next.stderr;
    } else {
      await assert.rejects(readFile(path.join(dir, 'catalyst-brief.json')));
    }
    const emitted = await readFile(output, 'utf8');
    const flags = Object.fromEntries(emitted.trim().split('\n').filter(Boolean).map((line) => line.split('=')));
    assert.equal(flags.publishable === 'true', expectedEligible, name);
    if (!expectedEligible) assert.doesNotMatch(emitted, /publishable=true/);
    if (ran.status === 0) {
      assert.equal(flags.publication_authorized, 'false'); assert.equal(flags.enforcement_active, 'false');
      if (!expectedEligible) assert.match(logs, /not publication recovery/);
    }
    assert.ok(!logs.includes(remoteMarker), name);
    assert.ok(!logs.includes(env.NEWSFEED_BEARER_TOKEN), name);
    const calls = JSON.parse(await readFile(path.join(dir, 'calls.json')));
    assert.equal(calls.length, requests, name);
    for (const args of calls) {
      assert.equal(args[0], '-q');
      assert.equal(args[args.indexOf('--proto') + 1], '=https');
      assert.equal(args[args.indexOf('--max-filesize') + 1], String(MAX_RESPONSE_BYTES));
      assert.equal(args[args.indexOf('--url') + 1], env.CATALYST_ENDPOINT);
      assert.equal(args[args.indexOf('--write-out') + 1], '%{http_code}');
      for (const forbidden of ['--location', '--follow', '--retry', '--fail', '--insecure']) assert.ok(!args.includes(forbidden));
    }
    groups++;
  }
  const bodyPath = path.join(root, 'body'); const receiptPath = path.join(root, 'receipt');
  const original = encode({ publishable: true });
  const report = classify(original);
  const cli = (args) => spawnSync(process.execPath, [helper, ...args], {
    encoding: 'utf8', timeout: 10000, env: { PATH: process.env.PATH, HOME: root },
  });
  await writeFile(bodyPath, original);
  await writeFile(receiptPath, JSON.stringify(report));
  assert.equal(cli(['eligibility', bodyPath, receiptPath]).status, 0); groups++;
  await writeFile(bodyPath, Buffer.concat([original, Buffer.from(' ')]));
  let rejected = cli(['eligibility', bodyPath, receiptPath]);
  assert.equal(rejected.status, 1); assert.equal(rejected.stdout, ''); groups++;
  await writeFile(bodyPath, original);
  for (const change of [{ publishable: false }, { publicationAuthorized: true }, { enforcementActive: true },
    { bodySha256: '0'.repeat(64) }, { extra: true }, { decision: 'retry' }, { httpStatus: '200' }]) {
    await writeFile(receiptPath, JSON.stringify({ ...report, ...change }));
    rejected = cli(['eligibility', bodyPath, receiptPath]);
    assert.equal(rejected.status, 1); assert.equal(rejected.stdout, ''); groups++;
  }
  await symlink(bodyPath, path.join(root, 'link'));
  for (const filename of [path.join(root, 'link'), root, path.join(root, 'absent')]) {
    rejected = cli(['classify', filename, '200', '0']);
    assert.equal(rejected.status, 1); assert.equal(rejected.stdout, '');
    assert.ok(!rejected.stderr.includes(filename)); groups++;
  }
  assert.equal(cli(['unknown', bodyPath]).status, 1); groups++;
} finally { await rm(root, { recursive: true, force: true }); }

console.log(`catalyst brief workflow tests pass (${groups} response-boundary groups; synthetic curl, no network/generation/import/publication)`);
