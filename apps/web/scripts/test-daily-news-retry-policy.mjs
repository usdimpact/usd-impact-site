import assert from 'node:assert/strict';
import { isRetryableGroundingFailure } from './daily-news-retry-policy.mjs';

assert.equal(isRetryableGroundingFailure({ code: 'insufficient-grounded-sources' }), true);
assert.equal(isRetryableGroundingFailure({
  initialValidationReason: 'OpenAI web search returned fewer than two grounded source URLs',
  repairError: 'The completed response contained fewer than two grounded URLs.',
}), true);
assert.equal(isRetryableGroundingFailure({
  initialValidationReason: 'The bundle must contain 3-7 highlights',
}), true);
assert.equal(isRetryableGroundingFailure({
  repairValidationReason: 'Highlight 1 requires one primary source or two independent reporting domains',
}), true);
assert.equal(isRetryableGroundingFailure({ error: 'Unauthorized.' }), false);
assert.equal(isRetryableGroundingFailure({ error: 'Daily news background generation is not configured.' }), false);
assert.equal(isRetryableGroundingFailure({ error: 'OpenAI structured output was not valid JSON' }), false);
assert.equal(isRetryableGroundingFailure(null), false);

console.log('daily news retry policy tests pass');
