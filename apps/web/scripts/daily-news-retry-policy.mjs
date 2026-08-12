import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const RETRYABLE_CODES = new Set([
  'insufficient-grounded-sources',
  'ungrounded-source',
]);
const RETRYABLE_RESULT = 'retryable-grounding-failure';
const RETRYABLE_PATTERNS = [
  /fewer than two grounded source urls/i,
  /fewer than two grounded urls/i,
  /at least two distinct grounded source urls/i,
  /insufficient grounded sources/i,
  /not returned by OpenAI web search/i,
  /cited URLs were not present in the grounded web-search results/i,
  /bundle must contain 3-7 highlights/i,
  /requires one primary source or two independent reporting domains/i,
  /dated after the edition/i,
  /stale daily-development source/i,
  /unsupported absence claim/i,
  /current Treasury refunding or auction source/i,
  /upcoming systemic catalyst mentioned but missing/i,
  /not referenced by any highlight or catalyst/i,
  /conversational assistant residue/i,
];

export function isRetryableGroundingFailure(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (RETRYABLE_CODES.has(payload.code)) return true;

  const text = [
    payload.error,
    payload.reason,
    payload.initialValidationReason,
    payload.repairValidationReason,
    payload.repairError,
  ]
    .filter((value) => typeof value === 'string')
    .join('\n');

  return RETRYABLE_PATTERNS.some((pattern) => pattern.test(text));
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/daily-news-retry-policy.mjs <error.json>');
    process.exit(2);
  }

  let payload;
  try {
    payload = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch {
    process.exit(1);
  }

  if (isRetryableGroundingFailure(payload)) {
    console.log(RETRYABLE_RESULT);
    process.exit(0);
  }
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
