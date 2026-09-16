import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';

// Transport/eligibility diagnostics only. Neither a receipt nor publishable=true
// authorizes content or replaces importer validation and protected release review.
export const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_RECEIPT_BYTES = 4096;
const SCHEMA = 'catalyst-response/v1';
const CALENDAR_HOLDS = new Set([
  'HOLD_UNSUPPORTED_EVENT', 'HOLD_PREVIEW_EXPIRED', 'HOLD_OUTCOME_NOT_RELEASED',
  'HOLD_EVIDENCE_STALE', 'HOLD_SOURCE_SCHEMA', 'HOLD_SOURCE_UNAVAILABLE', 'HOLD_INVALID_CANDIDATE',
  'HOLD_IDENTITY_MISMATCH', 'HOLD_MISSING_CALENDAR_RECORD',
  'HOLD_RELEASE_TIME_MISMATCH', 'HOLD_REFERENCE_PERIOD_MISMATCH',
  'HOLD_SCHEDULE_CONFLICT', 'HOLD_CALENDAR_CLAIM', 'HOLD_DUPLICATE_EVENT',
  'HOLD_INVALID_CLOCK', 'HOLD_INVALID_PHASE', 'HOLD_REVISION_DRIFT',
  'HOLD_UNTRUSTED_EVIDENCE',
]);
const HOLD_FIELDS = ['calendarDecision', 'holdReason', 'publicationAttempted', 'publishable'];
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

class ResponseError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function reject(code) { throw new ResponseError(code); }
function boundedReason(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
}

function parseJson(bytes, maxBytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > maxBytes) reject('RESPONSE_SIZE');
  let text; let value;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    value = JSON.parse(text);
  } catch { reject('RESPONSE_JSON'); }
  // JSON.parse would otherwise erase duplicate keys. This lexical pass runs on
  // already valid, byte-bounded JSON and also bounds nesting before traversal.
  const tokens = [...text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/g)].map((item) => item[0]);
  if (tokens.length > 60000) reject('RESPONSE_COMPLEXITY');
  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '{' || token === '[') {
      if (stack.length >= 24) reject('RESPONSE_COMPLEXITY');
      stack.push(token === '{' ? new Set() : null);
    } else if (token === '}' || token === ']') stack.pop();
    else if (token.startsWith('"') && tokens[i + 1] === ':') {
      const key = JSON.parse(token); const keys = stack.at(-1);
      if (!keys || keys.has(key) || FORBIDDEN_KEYS.has(key)) reject('RESPONSE_KEYS');
      keys.add(key);
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject('RESPONSE_OBJECT');
  return value;
}

async function readBoundedFile(filename, maxBytes) {
  let handle;
  try {
    if (typeof filename !== 'string' || !filename || filename.length > 4096) reject('RESPONSE_FILE');
    handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size > BigInt(maxBytes)) reject('RESPONSE_FILE');
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const result = await handle.read(buffer, length, buffer.length - length, length);
      if (result.bytesRead === 0) break;
      length += result.bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (length > maxBytes || BigInt(length) !== before.size
        || before.size !== after.size || before.mtimeNs !== after.mtimeNs
        || before.ctimeNs !== after.ctimeNs || before.ino !== after.ino || before.dev !== after.dev) {
      reject('RESPONSE_FILE');
    }
    return buffer.subarray(0, length);
  } catch (error) {
    if (error instanceof ResponseError) throw error;
    reject('RESPONSE_FILE');
  } finally { await handle?.close(); }
}

export function classifyCatalystResponse({ bytes, httpStatus, transportExit }) {
  if (typeof httpStatus !== 'string' || !/^(?:000|[1-5][0-9]{2})$/.test(httpStatus)
      || typeof transportExit !== 'string' || !/^(?:0|[1-9][0-9]{0,2})$/.test(transportExit)
      || Number(transportExit) > 255) reject('RESPONSE_TRANSPORT_METADATA');
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_RESPONSE_BYTES) reject('RESPONSE_SIZE');
  const status = Number(httpStatus); const exit = Number(transportExit);
  const result = (decision, code, publishable = false) => Object.freeze({
    schema: SCHEMA, httpStatus: status, transportExit: exit,
    bodyBytes: bytes.length, bodySha256: createHash('sha256').update(bytes).digest('hex'),
    decision, code, publishable, publicationAuthorized: false, enforcementActive: false,
  });
  // Retain at most one retry, and only for failed resolution/connection before
  // an HTTP response or response bytes. Timeouts, 5xx and other uncertain POST
  // outcomes are NOT replayed: the research endpoint has no idempotency proof.
  if (exit !== 0) {
    return [5, 6, 7].includes(exit) && status === 0 && bytes.length === 0
      ? result('retry', 'RETRY_CONNECTION_UNAVAILABLE')
      : result('error', 'RESPONSE_TRANSPORT_FAILED');
  }
  if (status !== 200 && status !== 409) return result('error', 'RESPONSE_HTTP_STATUS');
  const payload = parseJson(bytes, MAX_RESPONSE_BYTES);
  if (!Object.hasOwn(payload, 'publishable') || typeof payload.publishable !== 'boolean') {
    reject('RESPONSE_PUBLISHABLE_TYPE');
  }
  if (status === 409) {
    if (!isDeepStrictEqual(Object.keys(payload).sort(), HOLD_FIELDS)
        || payload.publishable !== false || payload.publicationAttempted !== false
        || !CALENDAR_HOLDS.has(payload.calendarDecision) || !boundedReason(payload.holdReason)) {
      reject('RESPONSE_CALENDAR_HOLD');
    }
    return result('hold', payload.calendarDecision);
  }
  // A 200 must not disguise an error/calendar envelope or an authority claim.
  for (const key of ['error', 'calendarDecision', 'publicationAttempted', 'publicationAuthorized', 'enforcementActive']) {
    if (Object.hasOwn(payload, key)) reject('RESPONSE_CONTRADICTION');
  }
  if (payload.publishable === false) {
    if (!boundedReason(payload.holdReason)) reject('RESPONSE_HOLD_REASON');
    return result('hold', 'HOLD_RESEARCH_VERIFICATION');
  }
  if (Object.hasOwn(payload, 'holdReason')) reject('RESPONSE_CONTRADICTION');
  // This is the literal eligibility bit only. Full article/source validation
  // still belongs to the unchanged importer and exact-head release gates.
  return result('eligible', 'ELIGIBLE_FOR_IMPORT_VALIDATION', true);
}

export async function runResponseCommand(args) {
  if (!Array.isArray(args)) reject('RESPONSE_ARGUMENTS');
  if (args[0] === 'classify' && args.length === 4) {
    const bytes = await readBoundedFile(args[1], MAX_RESPONSE_BYTES);
    const report = classifyCatalystResponse({ bytes, httpStatus: args[2], transportExit: args[3] });
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (report.decision === 'error') process.stderr.write('Catalyst response rejected; no publication attempted.\n');
    return report.decision === 'retry' ? 75 : report.decision === 'error' ? 1 : 0;
  }
  if (args[0] === 'eligibility' && args.length === 3) {
    const receipt = parseJson(await readBoundedFile(args[2], MAX_RECEIPT_BYTES), MAX_RECEIPT_BYTES);
    if (receipt.schema !== SCHEMA || !Number.isInteger(receipt.httpStatus)
        || !Number.isInteger(receipt.transportExit) || !['eligible', 'hold'].includes(receipt.decision)) {
      reject('RESPONSE_RECEIPT');
    }
    const bytes = await readBoundedFile(args[1], MAX_RESPONSE_BYTES);
    const report = classifyCatalystResponse({
      bytes, httpStatus: String(receipt.httpStatus).padStart(3, '0'), transportExit: String(receipt.transportExit),
    });
    if (!isDeepStrictEqual(receipt, report)) reject('RESPONSE_RECEIPT');
    // Only fixed classifier values reach Actions output. Never emit remote
    // holdReason, URLs, bodies, headers or arbitrary exception messages.
    process.stdout.write(`publishable=${report.publishable}\ndecision=${report.decision}\nresponse_code=${report.code}\npublication_authorized=false\nenforcement_active=false\n`);
    process.stderr.write(report.decision === 'hold'
      ? `Catalyst Brief held (${report.code}); not publication recovery. Existing incidents remain open.\n`
      : 'Catalyst response eligible for importer validation only; release review remains required.\n');
    return 0;
  }
  reject('RESPONSE_ARGUMENTS');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = await runResponseCommand(process.argv.slice(2)); }
  catch (error) {
    const code = error instanceof ResponseError ? error.code : 'RESPONSE_UNAVAILABLE';
    process.stderr.write(`Catalyst response rejected (${code}); no publication attempted.\n`);
    process.exitCode = 1;
  }
}
