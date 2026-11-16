import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workflow = await readFile(
  new URL('../../../.github/workflows/daily-news.yml', import.meta.url), 'utf8',
);
const config = workflow.indexOf('- name: Check newsfeed configuration');
const paidStartAt = workflow.indexOf('- name: Start background news generation');
assert.ok(config > 0 && paidStartAt > config, 'configuration precedes paid source start');
// Existing no-spend configuration fixtures must remain unchanged; the
// clock gate is immediately before the first source POST instead.
const configStep = workflow.slice(config, paidStartAt);
assert.doesNotMatch(configStep, /curl --fail[\s\S]*?--request POST/);

const paidStart = workflow.slice(
  workflow.indexOf('- name: Start background news generation'),
  workflow.indexOf('- name: Poll background news generation'),
);
assert.match(
  paidStart,
  /run: \|\n\s+if ! bash scripts\/guard-daily-news-paid-start\.sh; then[\s\S]*?exit 1[\s\S]*?fi[\s\S]*?curl --fail[\s\S]*?--request POST/,
  'the initial guard must explicitly exit before any billed provider request',
);

// The single bounded full-regeneration POST is also a paid provider request.
// Its authorization must be rechecked after polling, not inherited from an
// initial start that may have occurred before the launch cutoff.
const pollStartAt = workflow.indexOf('- name: Poll background news generation');
const importAt = workflow.indexOf('- name: Import as published content');
assert.ok(pollStartAt > paidStartAt && importAt > pollStartAt);
const pollStep = workflow.slice(pollStartAt, importAt);
const retryStartAt = pollStep.indexOf('if [ "$regeneration_used" = "false" ] && node scripts/daily-news-retry-policy.mjs "$poll_payload"; then');
assert.ok(retryStartAt > 0, 'bounded retry eligibility must remain in the poll step');
const retryBlock = pollStep.slice(retryStartAt);
const retryGuard = retryBlock.indexOf('bash scripts/guard-daily-news-paid-start.sh');
const retryCurl = retryBlock.indexOf('curl --fail --silent --show-error --location');
const retryPost = retryBlock.indexOf('--request POST');
assert.ok(retryGuard >= 0, 'retry must run the same fail-closed paid-start guard');
assert.ok(retryCurl > retryGuard && retryPost > retryCurl,
  'retry guard must run immediately before the paid regeneration request');
assert.match(
  retryBlock.slice(0, retryPost),
  /if ! bash scripts\/guard-daily-news-paid-start\.sh; then[\s\S]*?regeneration-withheld-cutoff[\s\S]*?exit 1\n\s+fi\n\s+echo "Recoverable generation or bounded-repair failure detected; starting one bounded full regeneration attempt\."\n\s+curl --fail/,
  'retry guard must explicitly abort, classify withheld spend, and precede the paid POST');
assert.equal((pollStep.match(/--request POST/g) || []).length, 1,
  'only one bounded full-regeneration POST may be present in the poll step');
assert.doesNotMatch(pollStep.slice(0, retryStartAt), /--request POST/,
  'polling a prior response must not generate new paid requests');
assert.match(retryBlock, /regeneration_used=true[\s\S]*generation_attempt=2/,
  'exactly one regeneration remains the existing upper bound');

const guardPath = fileURLToPath(new URL('./guard-daily-news-paid-start.sh', import.meta.url));
const guardText = await readFile(guardPath, 'utf8');
assert.match(guardText, /TZ=America\/New_York date \+%H:%M/);
assert.match(guardText, /07:10/);

const mockDir = await mkdtemp(join(tmpdir(), 'usd-impact-daily-pre-spend-'));
try {
  await writeFile(join(mockDir, 'date'), [
    '#!/bin/sh',
    'if [ "$1" = "-u" ]; then',
    '  if [ "$2" = "+%F" ]; then printf "%s\\n" "$MOCK_UTC_DAY"; exit 0; fi',
    '  if [ "$2" = "+%u" ]; then printf "%s\\n" "$MOCK_UTC_WEEKDAY"; exit 0; fi',
    'fi',
    'if [ "$1" = "+%F" ]; then printf "%s\\n" "$MOCK_US_DAY"; exit 0; fi',
    'if [ "$1" = "+%H:%M" ]; then printf "%s\\n" "$MOCK_US_TIME"; exit 0; fi',
    'exit 88',
    '',
  ].join('\n'), { mode: 0o755 });

  const scenarios = [
    { name: 'EST before cutoff', utc: '2026-11-16', weekday: '1', ny: '2026-11-16', time: '06:07', exit: 0 },
    { name: 'EST last permitted minute', utc: '2026-11-16', weekday: '1', ny: '2026-11-16', time: '07:09', exit: 0 },
    { name: 'EST exact cutoff', utc: '2026-11-16', weekday: '1', ny: '2026-11-16', time: '07:10', exit: 1 },
    { name: 'EST late scheduled job', utc: '2026-11-16', weekday: '1', ny: '2026-11-16', time: '12:14', exit: 1 },
    { name: 'EDT before cutoff', utc: '2026-09-14', weekday: '1', ny: '2026-09-14', time: '06:47', exit: 0 },
    { name: 'EDT after cutoff', utc: '2026-09-14', weekday: '1', ny: '2026-09-14', time: '08:31', exit: 1 },
    { name: 'UTC and New York day differ', utc: '2026-11-16', weekday: '1', ny: '2026-11-15', time: '23:15', exit: 1 },
    { name: 'weekend', utc: '2026-11-14', weekday: '6', ny: '2026-11-14', time: '06:45', exit: 1 },
    { name: 'invalid local time', utc: '2026-11-16', weekday: '1', ny: '2026-11-16', time: '29:59', exit: 1 },
  ];
  for (const s of scenarios) {
    const run = spawnSync('bash', [guardPath], {
      encoding: 'utf8',
      timeout: 5000,
      env: {
        ...process.env,
        PATH: mockDir + ':' + process.env.PATH,
        MOCK_UTC_DAY: s.utc,
        MOCK_UTC_WEEKDAY: s.weekday,
        MOCK_US_DAY: s.ny,
        MOCK_US_TIME: s.time,
      },
    });
    assert.equal(run.error, undefined, s.name + ': subprocess error');
    assert.equal(run.status, s.exit, s.name + ': ' + run.stdout + run.stderr);
  }
  // Execute the ACTUAL YAML shell bodies under bash without errexit, as if
  // a future edit added set +e or changed the step to shell: bash {0}.
  // Fake date and curl ensure zero external network or provider charges.
  const makeShell = (section) => {
    const block = section.match(/        run: \|\n([\s\S]*)/);
    assert.ok(block, 'run body must exist for shell-negative test');
    return block[1].split('\n')
      .map((line) => line.startsWith('          ') ? line.slice(10) : line)
      .join('\n');
  };
  await writeFile(join(mockDir, 'curl'), [
    '#!/bin/sh',
    'printf "%s\\n" "$*" >> "$MOCK_CURL_CALLS"',
    'case " $* " in *" --request POST "*) exit 97 ;; esac',
    'out=""',
    'prev=""',
    'for token in "$@"; do',
    '  if [ "$prev" = "--output" ]; then out="$token"; fi',
    '  prev="$token"',
    'done',
    '[ -n "$out" ] || exit 95',
    'printf \'{"code":"insufficient-grounded-sources","error":"fewer than three grounded urls","status":"failed"}\\n\' > "$out"',
    'printf "422"',
    '',
  ].join('\n'), { mode: 0o755 });
  const testEnv = {
    ...process.env,
    PATH: mockDir + ':' + process.env.PATH,
    MOCK_UTC_DAY: '2026-11-16',
    MOCK_UTC_WEEKDAY: '1',
    MOCK_US_DAY: '2026-11-16',
    MOCK_US_TIME: '07:10',
    NEWSFEED_ENDPOINT: 'https://example.invalid/daily-news-source',
    NEWSFEED_BEARER_TOKEN: 'synthetic-not-a-secret',
    BACKGROUND_ENDPOINT: 'https://example.invalid/daily-news-grounded-background',
    EDITION_DATE: '2026-11-16',
    OPENAI_RESPONSE_ID: 'resp_synthetic1234567',
    RUNNER_TEMP: mockDir,
    GITHUB_ENV: join(mockDir, 'github-env'),
    MOCK_CURL_CALLS: join(mockDir, 'curl-calls'),
  };
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const actualStart = spawnSync('bash', ['-c', 'set +e\n' + makeShell(paidStart)], {
    cwd, env: testEnv, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(actualStart.error, undefined);
  assert.equal(actualStart.status, 1, 'initial guard must exit even with errexit disabled');
  await assert.rejects(readFile(testEnv.MOCK_CURL_CALLS),
    'blocked initial generation must make zero HTTP calls');

  const actualPoll = spawnSync('bash', ['-c', 'set +e\n' + makeShell(pollStep)], {
    cwd, env: testEnv, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(actualPoll.error, undefined);
  assert.equal(actualPoll.status, 1, 'retry guard must exit even with errexit disabled');
  const calls = (await readFile(testEnv.MOCK_CURL_CALLS, 'utf8')).trim().split('\n');
  assert.equal(calls.length, 1, 'retry must only poll the prior response, no new POST');
  assert.doesNotMatch(calls.join('\n'), /--request POST/,
    'a withheld regeneration must never make the second paid POST');
  const heldPayload = JSON.parse(await readFile(join(mockDir, 'daily-usd-impact-poll.json'), 'utf8'));
  assert.equal(heldPayload.code, 'regeneration-withheld-cutoff',
    'incident evidence must distinguish withheld from paid failed regeneration');
  assert.match(actualPoll.stderr + actualPoll.stdout, /Paid regeneration withheld/,
    'a blocked retry must emit an unambiguous hold message');

} finally {
  await rm(mockDir, { recursive: true, force: true });
}
console.log('daily paid-start cutoff: 9/9 synthetic cases passed');
