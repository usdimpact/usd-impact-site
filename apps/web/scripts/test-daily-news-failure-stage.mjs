import assert from 'node:assert/strict';
import {
  classifyDailyPayloadFailure,
  classifyDailyWorkflowFailure,
} from './daily-news-failure-stage.mjs';

assert.deepEqual(
  classifyDailyPayloadFailure({
    error: 'Daily news source generation failed validation after two bounded repair attempts.',
    repairAttempts: 2,
    repairValidationReason: 'The bundle must contain 3-7 highlights',
  }).stage,
  'repair',
);
assert.equal(
  classifyDailyPayloadFailure({
    error: 'Daily news background generation did not complete.',
    status: 'incomplete',
  }).stage,
  'generation',
);
assert.equal(
  classifyDailyPayloadFailure({
    code: 'invalid-catalyst-window',
    reason: 'Every catalyst must use a date inside the seven-day window.',
  }).stage,
  'validation',
);

assert.deepEqual(
  classifyDailyWorkflowFailure({
    startOutcome: 'success',
    pollOutcome: 'failure',
    importOutcome: 'skipped',
    validateOutcome: 'skipped',
    publishOutcome: 'skipped',
    payload: { repairAttempts: 1, repairError: 'repair failed' },
  }).stage,
  'repair',
);
assert.equal(
  classifyDailyWorkflowFailure({
    startOutcome: 'success',
    pollOutcome: 'success',
    importOutcome: 'failure',
    validateOutcome: 'skipped',
    publishOutcome: 'skipped',
  }).stage,
  'import',
);
assert.equal(
  classifyDailyWorkflowFailure({
    startOutcome: 'success',
    pollOutcome: 'success',
    importOutcome: 'success',
    validateOutcome: 'failure',
    publishOutcome: 'skipped',
  }).gate,
  'site-validation-build',
);
assert.equal(
  classifyDailyWorkflowFailure({
    startOutcome: 'success',
    pollOutcome: 'success',
    importOutcome: 'success',
    validateOutcome: 'success',
    publishOutcome: 'failure',
  }).stage,
  'publication',
);
assert.equal(
  classifyDailyWorkflowFailure({
    startOutcome: 'failure',
    pollOutcome: 'skipped',
    importOutcome: 'skipped',
    validateOutcome: 'skipped',
    publishOutcome: 'skipped',
  }).gate,
  'background-generation-start',
);
assert.equal(
  classifyDailyWorkflowFailure({
    startOutcome: 'success',
    pollOutcome: 'success',
    importOutcome: 'success',
    validateOutcome: 'success',
    publishOutcome: 'success',
  }).stage,
  'workflow',
);

const sanitized = classifyDailyPayloadFailure({
  repairAttempts: 1,
  repairError: 'See https://example.com/private and token ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
});
assert.doesNotMatch(sanitized.detail, /https:\/\//);
assert.doesNotMatch(sanitized.detail, /ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/);

console.log('daily news failure-stage tests pass');
