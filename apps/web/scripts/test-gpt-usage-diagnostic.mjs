import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyGptValidationReason,
  emitGptUsageDiagnostic,
  summarizeOpenAiUsage,
} from '../src/lib/gpt-usage-diagnostic.js';

const privateCanary = 'secret-text-should-never-be-logged';
const provider = {
  id: 'resp_test_secret_identifier',
  model: 'gpt-5',
  status: 'completed',
  output: [{ text: privateCanary, url: 'https://example.com/private' }],
  usage: {
    input_tokens: 1024,
    input_tokens_details: { cached_tokens: 384 },
    output_tokens: 256,
    output_tokens_details: { reasoning_tokens: 71 },
    total_tokens: 1280,
    arbitrary_private_string: privateCanary,
  },
};

const captured = [];
const logger = (message) => captured.push(message);
const args = { response: provider, stage: 'research', outcome: 'invalid', validationReason: 'Source abc was not returned by OpenAI web search' };

assert.equal(emitGptUsageDiagnostic(args, { env: {}, logger }), false, 'off by default');
assert.equal(emitGptUsageDiagnostic(args, { env: { USDIMPACT_GPT_METRICS_ENABLED: 'TRUE' }, logger }), false, 'exact true only');
assert.deepEqual(captured, [], 'no opt-in means no new logs');

assert.equal(emitGptUsageDiagnostic(args, { env: { USDIMPACT_GPT_METRICS_ENABLED: 'true' }, logger }), true);
const logged = JSON.parse(captured[0]);
assert.equal(logged.event, 'USDIMPACT_GPT_USAGE');
assert.equal(logged.component, 'daily-news');
assert.equal(logged.model, 'gpt-5');
assert.equal(logged.validationCode, 'ungrounded_source');
assert.deepEqual(logged.usage, {
  inputTokens: 1024,
  cachedInputTokens: 384,
  outputTokens: 256,
  reasoningTokens: 71,
  totalTokens: 1280,
});
assert.equal(captured[0].includes(privateCanary), false);
assert.equal(captured[0].includes('resp_test_secret_identifier'), false);
assert.equal(captured[0].includes('https://'), false);

const missing = summarizeOpenAiUsage({ input_tokens: -1, output_tokens: '123', total_tokens: 1.5 });
assert.equal(missing.inputTokens, null);
assert.equal(missing.outputTokens, null);
assert.equal(missing.totalTokens, null);
assert.equal(summarizeOpenAiUsage(null), null);

const cases = [
  ['The bundle must contain 3-24 sources', 'source_count'],
  ['Highlight 2 references only stale daily-development sources', 'stale_source'],
  ['Upcoming systemic catalyst mentioned but missing from catalysts: labor', 'catalyst_mismatch'],
  ['Federal Reserve annual FOMC press-release index requires a directly linked dated document', 'source_date'],
  ['Highlight 3 requires one primary source or two independent reporting domains', 'insufficient_evidence'],
  ['OpenAI structured output was not valid JSON', 'schema_invalid'],
  [privateCanary, 'other'],
];
for (const [reason, expected] of cases) {
  assert.equal(classifyGptValidationReason(reason), expected, reason);
}

const invalidModel = { ...provider, model: 'model\n' + privateCanary };
emitGptUsageDiagnostic({ response: invalidModel, stage: 'repair', outcome: 'validated', repairAttempt: 999 },
  { env: { USDIMPACT_GPT_METRICS_ENABLED: 'true' }, logger });
const sanitized = JSON.parse(captured[1]);
assert.equal(sanitized.model, 'unknown');
assert.equal(sanitized.repairAttempt, 2);
assert.equal(sanitized.validationCode, 'none');
assert.equal(captured[1].includes(privateCanary), false);

// Telemetry failures must never interrupt a successful publication or
// convert a source-validation decision into an unrelated server error.
const enabled = { USDIMPACT_GPT_METRICS_ENABLED: 'true' };
const beforeFailureCount = captured.length;
assert.equal(
  emitGptUsageDiagnostic(args, { env: enabled, logger: () => { throw new Error(privateCanary); } }),
  false,
  'a failing logger must be non-blocking',
);
assert.equal(captured.length, beforeFailureCount, 'logging failure must not fall back to raw output');
const providerWithBadUsage = {
  ...provider,
  get usage() { throw new Error(privateCanary); },
};
assert.equal(
  emitGptUsageDiagnostic({ ...args, response: providerWithBadUsage }, { env: enabled, logger }),
  false,
  'a malformed provider usage accessor must be non-blocking',
);
assert.equal(captured.length, beforeFailureCount);

const background = readFileSync(new URL('../api/daily-news-background.js', import.meta.url), 'utf8');
assert.match(background, /emitGptUsageDiagnostic/);
assert.match(background, /outcome: 'provider_failed'/);
assert.match(background, /stage: 'repair'/);

console.log('PASS: GPT usage diagnostics remain opt-in, metadata-only, and bounded.');
