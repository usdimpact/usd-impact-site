function normalized(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function selectWorkflowRun(runs, { headSha = null } = {}) {
  if (!Array.isArray(runs)) return null;
  const candidates = runs.filter((run) => run && typeof run === 'object');
  if (!headSha) return candidates[0] || null;
  return candidates.find((run) => run.head_sha === headSha) || null;
}

export function isRunUnknown(run) {
  if (!run || typeof run !== 'object') return true;
  const status = normalized(run.status);
  const conclusion = normalized(run.conclusion);
  return !status
    || status === 'unknown'
    || status !== 'completed'
    || !conclusion
    || conclusion === 'unknown';
}

export function isCompletedSuccess(run) {
  return normalized(run?.status) === 'completed'
    && normalized(run?.conclusion) === 'success';
}

export function isCompletedFailure(run) {
  return normalized(run?.status) === 'completed'
    && normalized(run?.conclusion) === 'failure';
}

export function runMatchesHead(run, headSha) {
  return Boolean(headSha)
    && typeof run?.head_sha === 'string'
    && run.head_sha === headSha;
}

export function isFailureOnCurrentHead(run, headSha) {
  return isCompletedFailure(run) && runMatchesHead(run, headSha);
}

export function isFailureOnOlderHead(run, headSha) {
  return isCompletedFailure(run)
    && Boolean(headSha)
    && typeof run?.head_sha === 'string'
    && run.head_sha.length > 0
    && run.head_sha !== headSha;
}

export function evaluateDailyDispatch({
  command,
  websiteHeadSha,
  quality,
  daily,
  dailyHealth,
  dailyIssueBlocker = null,
}) {
  const currentQualityGreen = isCompletedSuccess(quality)
    && runMatchesHead(quality, websiteHeadSha);
  const dailyFailureStale = isFailureOnOlderHead(daily, websiteHeadSha);
  const dailyHealthFailureStale = isFailureOnOlderHead(dailyHealth, websiteHeadSha);
  const recoveryEligible = normalized(command) === 'daily'
    && !dailyIssueBlocker
    && currentQualityGreen
    && dailyFailureStale
    && dailyHealthFailureStale;

  if (dailyIssueBlocker) {
    return Object.freeze({
      allowed: false,
      mode: 'blocked',
      reason: `Open Daily publication blocker: #${dailyIssueBlocker.number} ${dailyIssueBlocker.title}`,
      recoveryEligible: false,
      currentQualityGreen,
      dailyFailureStale,
      dailyHealthFailureStale,
    });
  }

  if (isRunUnknown(quality) || isRunUnknown(dailyHealth)) {
    return Object.freeze({
      allowed: false,
      mode: 'blocked',
      reason: 'Website quality or Daily health workflow state is incomplete or unknown.',
      recoveryEligible: false,
      currentQualityGreen,
      dailyFailureStale,
      dailyHealthFailureStale,
    });
  }

  if (!currentQualityGreen) {
    return Object.freeze({
      allowed: false,
      mode: 'blocked',
      reason: 'Web Quality has not passed on the exact current main commit.',
      recoveryEligible: false,
      currentQualityGreen,
      dailyFailureStale,
      dailyHealthFailureStale,
    });
  }

  if (isCompletedSuccess(dailyHealth)) {
    return Object.freeze({
      allowed: true,
      mode: 'standard',
      reason: 'Current-head quality is green and the latest Daily health workflow passed.',
      recoveryEligible: false,
      currentQualityGreen,
      dailyFailureStale,
      dailyHealthFailureStale,
    });
  }

  if (recoveryEligible) {
    return Object.freeze({
      allowed: true,
      mode: 'stale-failure-recovery',
      reason: 'The latest Daily and Daily health failures belong to older commits while exact-current-head Web Quality is green; one explicit recovery dispatch is permitted.',
      recoveryEligible: true,
      currentQualityGreen,
      dailyFailureStale,
      dailyHealthFailureStale,
    });
  }

  return Object.freeze({
    allowed: false,
    mode: 'blocked',
    reason: isCompletedFailure(dailyHealth)
      ? 'The latest Daily health workflow failed and is not eligible for an explicit stale-head recovery dispatch.'
      : 'The latest Daily health workflow is not green.',
    recoveryEligible: false,
    currentQualityGreen,
    dailyFailureStale,
    dailyHealthFailureStale,
  });
}
