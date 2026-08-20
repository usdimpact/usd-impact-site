import assert from 'node:assert/strict';
import { isRetryableGroundingFailure } from './daily-news-retry-policy.mjs';

assert.equal(isRetryableGroundingFailure({ code: 'insufficient-grounded-sources' }), true);
assert.equal(isRetryableGroundingFailure({ code: 'ungrounded-source' }), true);
assert.equal(isRetryableGroundingFailure({ code: 'invalid-highlight-count' }), true);
assert.equal(isRetryableGroundingFailure({ code: 'invalid-catalyst-window' }), true);
assert.equal(isRetryableGroundingFailure({ code: 'invalid-catalyst-collection' }), true);
assert.equal(isRetryableGroundingFailure({ code: 'repair-exhausted' }), true);
assert.equal(isRetryableGroundingFailure({
  initialValidationReason: 'OpenAI web search returned fewer than two grounded source URLs',
  repairError: 'The completed response contained fewer than two grounded URLs.',
}), true);
assert.equal(isRetryableGroundingFailure({
  error: 'Daily news source generation failed validation after two bounded repair attempts.',
  initialValidationReason: 'Source eia-wpsr was not returned by OpenAI web search',
  repairValidationReason: 'Source eia-wpsr was not returned by OpenAI web search',
}), true);
assert.equal(isRetryableGroundingFailure({
  code: 'ungrounded-source',
  reason: 'One or more cited URLs were not present in the grounded web-search results.',
}), true);
assert.equal(isRetryableGroundingFailure({
  initialValidationReason: 'The bundle must contain 3-7 highlights',
}), true);
assert.equal(isRetryableGroundingFailure({
  initialValidationReason: 'The bundle contains fewer than three highlights',
}), true);
assert.equal(isRetryableGroundingFailure({
  initialValidationReason: 'The bundle contains more than seven highlights',
}), true);
assert.equal(isRetryableGroundingFailure({
  repairValidationReason: 'Highlight 1 requires one primary source or two independent reporting domains',
}), true);
assert.equal(isRetryableGroundingFailure({
  initialValidationReason: 'Highlight 1 references only stale daily-development sources',
}), true);
assert.equal(isRetryableGroundingFailure({
  initialValidationReason: 'Highlight 2 makes an unsupported absence claim',
}), true);
assert.equal(isRetryableGroundingFailure({
  repairValidationReason: 'Catalyst 1 requires a current Treasury refunding or auction source',
}), true);
assert.equal(isRetryableGroundingFailure({
  repairValidationReason: 'Upcoming systemic catalyst mentioned but missing from catalysts: labor',
}), true);
assert.equal(isRetryableGroundingFailure({
  repairValidationReason: "Catalyst 1 must fall within the edition's next seven calendar days",
}), true);
assert.equal(isRetryableGroundingFailure({
  repairValidationReason: 'Catalysts must be an array',
}), true);
assert.equal(isRetryableGroundingFailure({
  error: 'Daily news source generation exhausted its bounded repair budget.',
}), true);

assert.equal(isRetryableGroundingFailure({
  error: 'Daily news source generation failed validation after two bounded repair attempts.',
  initialValidationReason: 'Highlight 1 requires a current Treasury refunding or auction source',
  repairValidationReason: 'Upcoming systemic catalyst mentioned but missing from catalysts: central-bank',
}), true);
assert.equal(isRetryableGroundingFailure({ repairValidationReason: 'Source treasury-old is not referenced by any highlight or catalyst' }), true);
assert.equal(isRetryableGroundingFailure({ repairValidationReason: 'Body contains conversational assistant residue' }), true);
assert.equal(isRetryableGroundingFailure({ error: 'Unauthorized.' }), false);
assert.equal(isRetryableGroundingFailure({ error: 'Daily news background generation is not configured.' }), false);
assert.equal(isRetryableGroundingFailure({ error: 'OpenAI structured output was not valid JSON' }), false);
assert.equal(isRetryableGroundingFailure(null), false);

console.log('daily news retry policy tests pass');
