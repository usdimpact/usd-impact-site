import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const RETRYABLE_CODE = 'insufficient-grounded-sources';
const RETRYABLE_PATTERNS = [
  /fewer than two grounded source urls/i,
  /fewer than two grounded urls/i,
  /at least two distinct grounded source urls/i,
  /insufficient grounded sources/i,
  /bundle must contain 3-7 highlights/i,
  /requires one primary source or two independent reporting domains/i,
];

export function isRetryableGroundingFailure(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (payload.code === RETRYABLE_CODE) return true;

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
    console.log(RETRYABLE_CODE);
    process.exit(0);
  }
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
