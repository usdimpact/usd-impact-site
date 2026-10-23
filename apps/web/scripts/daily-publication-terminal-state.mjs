export const DAILY_TERMINAL_STATES = Object.freeze({
  SUCCESS: 'SUCCESS',
  RECOVERED_AFTER_REVIEW: 'RECOVERED_AFTER_REVIEW',
  FAILED_CLOSED: 'FAILED_CLOSED',
  PENDING: 'PENDING',
  MISSING_TERMINAL_SUCCESS: 'MISSING_TERMINAL_SUCCESS',
});

const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);

function normalizeRun(run) {
  return {
    id: run?.id ?? null,
    event: String(run?.event || ''),
    status: String(run?.status || ''),
    conclusion: run?.conclusion == null ? null : String(run.conclusion),
    updated_at: run?.updated_at || null,
    html_url: run?.html_url || null,
  };
}

function latest(runs) {
  return [...runs].sort((a, b) => {
    const ta = Date.parse(a.updated_at || '') || 0;
    const tb = Date.parse(b.updated_at || '') || 0;
    return tb - ta;
  })[0] || null;
}

export function evaluateDailyPublicationTerminalState({
  editionDate,
  runs = [],
  publicationArtifactPresent = false,
  now = new Date(),
  cutoffHourUtc = 12,
} = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(editionDate || ''))) {
    throw new Error('editionDate must be YYYY-MM-DD');
  }
  if (!Number.isInteger(cutoffHourUtc) || cutoffHourUtc < 0 || cutoffHourUtc > 23) {
    throw new Error('cutoffHourUtc must be an integer from 0 to 23');
  }

  const normalized = runs.map(normalizeRun);
  const scheduled = normalized.filter((run) => run.event === 'schedule');
  const manual = normalized.filter((run) => run.event === 'workflow_dispatch');
  const active = latest(normalized.filter((run) => ACTIVE.has(run.status)));
  const scheduledSuccess = latest(scheduled.filter((run) => run.status === 'completed' && run.conclusion === 'success'));
  const scheduledFailure = latest(scheduled.filter((run) => run.status === 'completed' && run.conclusion && run.conclusion !== 'success'));
  const manualSuccess = latest(manual.filter((run) => run.status === 'completed' && run.conclusion === 'success'));

  const cutoff = new Date(`${editionDate}T${String(cutoffHourUtc).padStart(2, '0')}:00:00.000Z`);
  const afterCutoff = now.getTime() >= cutoff.getTime();

  const base = {
    schema_version: 1,
    edition_date: editionDate,
    cutoff_hour_utc: cutoffHourUtc,
    publication_artifact_present: Boolean(publicationArtifactPresent),
    native_schedule_success: false,
    recovery_required: false,
    source_run_id: null,
    source_event: null,
    source_conclusion: null,
    failure_class: null,
    stage: 'publication',
  };

  if (scheduledSuccess && publicationArtifactPresent) {
    return {
      ...base,
      state: DAILY_TERMINAL_STATES.SUCCESS,
      terminal: true,
      native_schedule_success: true,
      source_run_id: scheduledSuccess.id,
      source_event: scheduledSuccess.event,
      source_conclusion: scheduledSuccess.conclusion,
    };
  }

  if (manualSuccess && publicationArtifactPresent) {
    return {
      ...base,
      state: DAILY_TERMINAL_STATES.RECOVERED_AFTER_REVIEW,
      terminal: true,
      source_run_id: manualSuccess.id,
      source_event: manualSuccess.event,
      source_conclusion: manualSuccess.conclusion,
      failure_class: scheduledFailure ? 'scheduled_run_failed_before_recovery' : 'native_schedule_not_proven',
    };
  }

  if (scheduledSuccess && !publicationArtifactPresent) {
    return {
      ...base,
      state: DAILY_TERMINAL_STATES.FAILED_CLOSED,
      terminal: true,
      recovery_required: true,
      source_run_id: scheduledSuccess.id,
      source_event: scheduledSuccess.event,
      source_conclusion: scheduledSuccess.conclusion,
      failure_class: 'successful_run_missing_publication_artifact',
    };
  }

  if (scheduledFailure && !active) {
    return {
      ...base,
      state: DAILY_TERMINAL_STATES.FAILED_CLOSED,
      terminal: true,
      recovery_required: true,
      source_run_id: scheduledFailure.id,
      source_event: scheduledFailure.event,
      source_conclusion: scheduledFailure.conclusion,
      failure_class: 'scheduled_workflow_failed',
      stage: 'workflow',
    };
  }

  if (active) {
    return {
      ...base,
      state: DAILY_TERMINAL_STATES.PENDING,
      terminal: false,
      source_run_id: active.id,
      source_event: active.event,
      source_conclusion: active.conclusion,
      stage: 'workflow',
    };
  }

  if (afterCutoff && !publicationArtifactPresent) {
    return {
      ...base,
      state: DAILY_TERMINAL_STATES.MISSING_TERMINAL_SUCCESS,
      terminal: true,
      recovery_required: true,
      failure_class: 'expected_success_not_observed_by_cutoff',
    };
  }

  return {
    ...base,
    state: DAILY_TERMINAL_STATES.PENDING,
    terminal: false,
    failure_class: 'awaiting_expected_window',
  };
}
