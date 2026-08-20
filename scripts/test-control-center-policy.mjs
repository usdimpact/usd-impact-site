import assert from 'node:assert/strict';
import {
  evaluateDailyDispatch,
  isCompletedFailure,
  isCompletedSuccess,
  isFailureOnCurrentHead,
  isFailureOnOlderHead,
  isRunUnknown,
  runMatchesHead,
} from './control-center-policy.mjs';

const currentHead = 'current-head-sha';
const oldHead = 'old-head-sha';
const run = ({ status = 'completed', conclusion = 'success', headSha = currentHead } = {}) => ({
  status,
  conclusion,
  head_sha: headSha,
});

assert.equal(isCompletedSuccess(run()), true);
assert.equal(isCompletedFailure(run({ conclusion: 'failure' })), true);
assert.equal(runMatchesHead(run(), currentHead), true);
assert.equal(isFailureOnCurrentHead(run({ conclusion: 'failure' }), currentHead), true);
assert.equal(isFailureOnOlderHead(run({ conclusion: 'failure', headSha: oldHead }), currentHead), true);
assert.equal(isRunUnknown({ status: 'in_progress', conclusion: null, head_sha: currentHead }), true);

{
  const result = evaluateDailyDispatch({
    command: 'daily',
    websiteHeadSha: currentHead,
    quality: run(),
    daily: run(),
    dailyHealth: run(),
  });
  assert.equal(result.allowed, true);
  assert.equal(result.mode, 'standard');
  assert.equal(result.recoveryEligible, false);
}

{
  const result = evaluateDailyDispatch({
    command: 'daily',
    websiteHeadSha: currentHead,
    quality: run(),
    daily: run({ conclusion: 'failure', headSha: oldHead }),
    dailyHealth: run({ conclusion: 'failure', headSha: oldHead }),
  });
  assert.equal(result.allowed, true);
  assert.equal(result.mode, 'stale-failure-recovery');
  assert.equal(result.recoveryEligible, true);
  assert.equal(result.currentQualityGreen, true);
  assert.equal(result.dailyFailureStale, true);
  assert.equal(result.dailyHealthFailureStale, true);
}

{
  const result = evaluateDailyDispatch({
    command: 'status',
    websiteHeadSha: currentHead,
    quality: run(),
    daily: run({ conclusion: 'failure', headSha: oldHead }),
    dailyHealth: run({ conclusion: 'failure', headSha: oldHead }),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.recoveryEligible, false);
}

{
  const result = evaluateDailyDispatch({
    command: 'daily',
    websiteHeadSha: currentHead,
    quality: run({ headSha: oldHead }),
    daily: run({ conclusion: 'failure', headSha: oldHead }),
    dailyHealth: run({ conclusion: 'failure', headSha: oldHead }),
  });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /exact current main commit/i);
}

{
  const result = evaluateDailyDispatch({
    command: 'daily',
    websiteHeadSha: currentHead,
    quality: run(),
    daily: run({ conclusion: 'failure', headSha: oldHead }),
    dailyHealth: run({ conclusion: 'failure', headSha: currentHead }),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.dailyHealthFailureStale, false);
}

{
  const result = evaluateDailyDispatch({
    command: 'daily',
    websiteHeadSha: currentHead,
    quality: run(),
    daily: run({ conclusion: 'failure', headSha: oldHead }),
    dailyHealth: run({ conclusion: 'failure', headSha: oldHead }),
    dailyIssueBlocker: {
      number: 999,
      title: 'P1 — Daily publication blocked',
    },
  });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /#999/);
}

{
  const result = evaluateDailyDispatch({
    command: 'daily',
    websiteHeadSha: currentHead,
    quality: { status: 'UNKNOWN', conclusion: 'UNKNOWN', head_sha: null },
    daily: run({ conclusion: 'failure', headSha: oldHead }),
    dailyHealth: run({ conclusion: 'failure', headSha: oldHead }),
  });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /unknown/i);
}

{
  const result = evaluateDailyDispatch({
    command: 'daily',
    websiteHeadSha: currentHead,
    quality: run({ conclusion: 'failure' }),
    daily: run({ conclusion: 'failure', headSha: oldHead }),
    dailyHealth: run({ conclusion: 'failure', headSha: oldHead }),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.currentQualityGreen, false);
}

console.log('Control-center Daily recovery policy tests passed.');
