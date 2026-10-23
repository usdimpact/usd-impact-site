import assert from 'node:assert/strict';
import {
  DAILY_TERMINAL_STATES,
  evaluateDailyPublicationTerminalState,
} from './daily-publication-terminal-state.mjs';

const run = (overrides = {}) => ({
  id: 1,
  event: 'schedule',
  status: 'completed',
  conclusion: 'success',
  updated_at: '2026-10-23T10:00:00Z',
  ...overrides,
});

const fixedNow = new Date('2026-10-23T13:00:00Z');

{
  const result = evaluateDailyPublicationTerminalState({
    editionDate: '2026-10-23',
    runs: [run()],
    publicationArtifactPresent: true,
    now: fixedNow,
  });
  assert.equal(result.state, DAILY_TERMINAL_STATES.SUCCESS);
  assert.equal(result.terminal, true);
  assert.equal(result.native_schedule_success, true);
  assert.equal(result.recovery_required, false);
}

{
  const result = evaluateDailyPublicationTerminalState({
    editionDate: '2026-10-23',
    runs: [run({ id: 2, conclusion: 'failure' })],
    publicationArtifactPresent: false,
    now: fixedNow,
  });
  assert.equal(result.state, DAILY_TERMINAL_STATES.FAILED_CLOSED);
  assert.equal(result.failure_class, 'scheduled_workflow_failed');
  assert.equal(result.recovery_required, true);
}

{
  const result = evaluateDailyPublicationTerminalState({
    editionDate: '2026-10-23',
    runs: [run({ id: 3 })],
    publicationArtifactPresent: false,
    now: fixedNow,
  });
  assert.equal(result.state, DAILY_TERMINAL_STATES.FAILED_CLOSED);
  assert.equal(result.failure_class, 'successful_run_missing_publication_artifact');
}

{
  const result = evaluateDailyPublicationTerminalState({
    editionDate: '2026-10-23',
    runs: [
      run({ id: 4, conclusion: 'failure', updated_at: '2026-10-23T09:00:00Z' }),
      run({ id: 5, event: 'workflow_dispatch', conclusion: 'success', updated_at: '2026-10-23T11:00:00Z' }),
    ],
    publicationArtifactPresent: true,
    now: fixedNow,
  });
  assert.equal(result.state, DAILY_TERMINAL_STATES.RECOVERED_AFTER_REVIEW);
  assert.equal(result.native_schedule_success, false);
  assert.equal(result.failure_class, 'scheduled_run_failed_before_recovery');
}

{
  const result = evaluateDailyPublicationTerminalState({
    editionDate: '2026-10-23',
    runs: [run({ id: 6, status: 'in_progress', conclusion: null })],
    publicationArtifactPresent: false,
    now: new Date('2026-10-23T11:00:00Z'),
  });
  assert.equal(result.state, DAILY_TERMINAL_STATES.PENDING);
  assert.equal(result.terminal, false);
}

{
  const result = evaluateDailyPublicationTerminalState({
    editionDate: '2026-10-23',
    runs: [],
    publicationArtifactPresent: false,
    now: fixedNow,
  });
  assert.equal(result.state, DAILY_TERMINAL_STATES.MISSING_TERMINAL_SUCCESS);
  assert.equal(result.failure_class, 'expected_success_not_observed_by_cutoff');
  assert.equal(result.recovery_required, true);
}

{
  const result = evaluateDailyPublicationTerminalState({
    editionDate: '2026-10-23',
    runs: [],
    publicationArtifactPresent: false,
    now: new Date('2026-10-23T11:59:59Z'),
  });
  assert.equal(result.state, DAILY_TERMINAL_STATES.PENDING);
  assert.equal(result.failure_class, 'awaiting_expected_window');
}

assert.throws(
  () => evaluateDailyPublicationTerminalState({ editionDate: '23-10-2026' }),
  /YYYY-MM-DD/,
);

console.log('Daily publication terminal-state shadow evaluator tests passed.');
