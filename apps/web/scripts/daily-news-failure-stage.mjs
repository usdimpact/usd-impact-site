import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const FAILED_OUTCOMES = new Set(['failure', 'cancelled', 'timed_out', 'action_required']);

function normalized(value) {
  return String(value ?? '').trim().toLowerCase();
}

function failed(value) {
  return FAILED_OUTCOMES.has(normalized(value));
}

function payloadText(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  return [
    payload.code,
    payload.error,
    payload.reason,
    payload.initialValidationReason,
    payload.repairValidationReason,
    payload.repairError,
    payload.status,
  ]
    .filter((value) => typeof value === 'string')
    .join('\n');
}

function safeDetail(payload) {
  const text = payloadText(payload);
  if (!text) return null;
  return text
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{32,}\b/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500) || null;
}

export function classifyDailyPayloadFailure(payload) {
  const text = payloadText(payload);
  const repairAttempts = Number(payload?.repairAttempts ?? 0);

  if (
    repairAttempts > 0
    || /repair-exhausted|bounded repair|repair attempt|could not be repaired|after two bounded repair attempts/i.test(text)
  ) {
    return { stage: 'repair', gate: 'bounded-repair', detail: safeDetail(payload) };
  }

  if (
    /provider-incomplete|background generation|OpenAI|grounded source|generation could not|generation did not complete|unknown status/i.test(text)
  ) {
    return { stage: 'generation', gate: 'background-generation', detail: safeDetail(payload) };
  }

  if (
    /invalid-highlight-count|invalid-catalyst-window|invalid-catalyst-collection|generation-validation-failed|validation/i.test(text)
  ) {
    return { stage: 'validation', gate: 'generated-bundle-validation', detail: safeDetail(payload) };
  }

  return { stage: 'generation', gate: 'background-generation', detail: safeDetail(payload) };
}

export function classifyDailyWorkflowFailure({
  startOutcome,
  pollOutcome,
  importOutcome,
  validateOutcome,
  publishOutcome,
  payload = null,
}) {
  if (failed(publishOutcome)) {
    return { stage: 'publication', gate: 'publication-pr-quality', detail: null };
  }
  if (failed(validateOutcome)) {
    return { stage: 'validation', gate: 'site-validation-build', detail: null };
  }
  if (failed(importOutcome)) {
    return { stage: 'import', gate: 'content-import', detail: null };
  }
  if (failed(pollOutcome)) {
    return classifyDailyPayloadFailure(payload);
  }
  if (failed(startOutcome)) {
    return { stage: 'generation', gate: 'background-generation-start', detail: null };
  }
  return { stage: 'workflow', gate: 'workflow-or-configuration', detail: safeDetail(payload) };
}

async function readPayload(inputPath) {
  if (!inputPath || inputPath === '-') return null;
  try {
    return JSON.parse(await readFile(inputPath, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const [
    payloadPath,
    startOutcome = '',
    pollOutcome = '',
    importOutcome = '',
    validateOutcome = '',
    publishOutcome = '',
  ] = process.argv.slice(2);

  const payload = await readPayload(payloadPath);
  const result = classifyDailyWorkflowFailure({
    startOutcome,
    pollOutcome,
    importOutcome,
    validateOutcome,
    publishOutcome,
    payload,
  });
  process.stdout.write(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
