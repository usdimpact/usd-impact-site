import assert from 'node:assert/strict';
import {
  classifyWorkflowRecovery,
  evaluateDailyDispatch,
  isCompletedFailure,
  isCompletedSuccess,
  isFailureOnCurrentHead,
  isFailureOnOlderHead,
  isRunUnknown,
  runMatchesHead,
  selectWorkflowRun,
} from './control-center-policy.mjs';

const currentHead = 'current-head-sha';
const oldHead = 'old-head-sha';
const run = ({ status = 'completed', conclusion = 'success', headSha = currentHead, createdAt = '2026-08-24T10:00:00Z' } = {}) => ({
  status,
  conclusion,
  head_sha: headSha,
  created_at: createdAt,
});

{
  const automationRun = run({ conclusion: 'action_required', headSha: 'automation-head-sha' });
  const currentMainRun = run();
  const olderMainRun = run({ conclusion: 'failure', headSha: oldHead });
  const runs = [automationRun, currentMainRun, olderMainRun];

  assert.equal(selectWorkflowRun(runs), automationRun);
  assert.equal(selectWorkflowRun(runs, { headSha: currentHead }), currentMainRun);
  assert.equal(selectWorkflowRun(runs, { headSha: 'missing-head-sha' }), null);
  assert.equal(selectWorkflowRun(null, { headSha: currentHead }), null);
}

assert.equal(isCompletedSuccess(run()), true);
assert.equal(isCompletedFailure(run({ conclusion: 'failure' })), true);
assert.equal(runMatchesHead(run(), currentHead), true);
assert.equal(isFailureOnCurrentHead(run({ conclusion: 'failure' }), currentHead), true);
assert.equal(isFailureOnOlderHead(run({ conclusion: 'failure', headSha: oldHead }), currentHead), true);
assert.equal(isRunUnknown({ status: 'in_progress', conclusion: null, head_sha: currentHead }), true);

{
  const classified = classifyWorkflowRecovery(
    run({ conclusion: 'failure', headSha: oldHead }),
    {
      number: 301,
      title: 'Publish Daily USD Impact — 2026-08-24',
      url: 'https://github.com/usdimpact/usd-impact-site/pull/301',
      merged_at: '2026-08-24T12:20:00Z',
      merge_commit_sha: 'merge-sha',
    },
  );
  assert.equal(classified.conclusion, 'failure');
  assert.equal(classified.operational_conclusion, 'recovered_after_review');
  assert.equal(classified.recovery.number, 301);
  assert.equal(classified.recovery.merge_commit_sha, 'merge-sha');
}

{
  const classified = classifyWorkflowRecovery(
    run({ conclusion: 'failure', headSha: oldHead }),
    {
      number: 299,
      title: 'Publish Catalyst Brief — Example',
      url: 'https://github.com/usdimpact/usd-impact-site/pull/299',
      merged_at: '2026-08-24T09:00:00Z',
      merge_commit_sha: 'older-merge-sha',
    },
  );
  assert.equal(classified.operational_conclusion, 'failure');
  assert.equal(classified.recovery, null);
}

{
  const classified = classifyWorkflowRecovery(run(), {
    number: 301,
    title: 'Publish Daily USD Impact — 2026-08-24',
    url: 'https://github.com/usdimpact/usd-impact-site/pull/301',
    merged_at: '2026-08-24T12:20:00Z',
  });
  assert.equal(classified.operational_conclusion, 'success');
  assert.equal(classified.recovery, null);
}

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
      gate: 'site-validation-build',
    },
  });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /#999/);
  assert.match(result.reason, /gate: site-validation-build/);
}

{
  const result = evaluateDailyDispatch({
    command: 'daily',
    websiteHeadSha: currentHead,
    quality: run(),
    daily: run({ conclusion: 'failure', headSha: oldHead }),
    dailyHealth: run({ conclusion: 'failure', headSha: oldHead }),
    dailyIssueBlocker: {
      number: 1000,
      title: 'P1 — Daily publication blocked',
      gate: 'repair <secret>',
    },
  });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /gate: repair-secret/);
  assert.doesNotMatch(result.reason, /</);
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

console.log('Control-center workflow selection and Daily recovery policy tests passed.');
