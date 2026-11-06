// Stage 2 is an offline, synthetic-only advisory contract. No API, task runner, or writes.
import { pathToFileURL } from 'node:url';

export const SCHEMA_VERSION = 1;
const ENVELOPE_KEYS = Object.freeze(['schema_version', 'task_id', 'origin', 'operation', 'scope']);
const PROPOSAL_KEYS = Object.freeze(['schema_version', 'task_id', 'recommendation']);
const OPERATIONS = Object.freeze({
  isolated_draft_qa: Object.freeze({ scope: 'offline_read_only', recommendation: 'REVIEW_ONLY', reason: 'SYNTHETIC_DRAFT_QA' }),
  research_production_merge: Object.freeze({ scope: 'production', recommendation: 'HOLD', reason: 'RESEARCH_P1_RELEASE_BLOCKED' }),
  score_unlicensed_publication: Object.freeze({ scope: 'public_release', recommendation: 'HOLD', reason: 'SCORE_SOURCE_RIGHTS_BLOCKED' }),
  external_customer_email: Object.freeze({ scope: 'external_io', recommendation: 'HOLD', reason: 'CUSTOMER_IO_NOT_AUTHORIZED' }),
  daily_publication: Object.freeze({ scope: 'production', recommendation: 'HOLD', reason: 'PUBLISHING_OUTSIDE_STAGE2' }),
});

export const SYNTHETIC_FIXTURES = Object.freeze([
  Object.freeze({ schema_version: 1, task_id: 'S2-A01', origin: 'synthetic_fixture', operation: 'isolated_draft_qa', scope: 'offline_read_only' }),
  Object.freeze({ schema_version: 1, task_id: 'S2-B01', origin: 'synthetic_fixture', operation: 'research_production_merge', scope: 'production' }),
  Object.freeze({ schema_version: 1, task_id: 'S2-C01', origin: 'synthetic_fixture', operation: 'score_unlicensed_publication', scope: 'public_release' }),
  Object.freeze({ schema_version: 1, task_id: 'S2-D01', origin: 'synthetic_fixture', operation: 'external_customer_email', scope: 'external_io' }),
  Object.freeze({ schema_version: 1, task_id: 'S2-E01', origin: 'synthetic_fixture', operation: 'daily_publication', scope: 'production' }),
]);

function plainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function exactDataFields(value, expected) {
  if (!plainRecord(value)) return false;
  // Reflect.ownKeys also sees symbols and nonenumerable properties. Both are forbidden.
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expected.length ||
      !keys.every(key => typeof key === 'string' && expected.includes(key))) return false;
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return false;
  }
  return true;
}

function decision(taskId, recommendation, reasonCode) {
  return Object.freeze({
    schema_version: SCHEMA_VERSION,
    task_id: taskId,
    recommendation,
    reason_code: reasonCode,
    human_review_required: true,
    side_effects: 'NONE',
  });
}

// The caller cannot supply free text, a URL, an approval, or an execution instruction.
export function validateSyntheticTask(task) {
  if (!exactDataFields(task, ENVELOPE_KEYS)) throw Error('INVALID_ENVELOPE');
  if (task.schema_version !== SCHEMA_VERSION || task.origin !== 'synthetic_fixture' ||
      typeof task.task_id !== 'string' || !/^S2-[A-Z][0-9]{2}$/.test(task.task_id) ||
      typeof task.operation !== 'string' || !Object.hasOwn(OPERATIONS, task.operation)) {
    throw Error('INVALID_ENVELOPE');
  }
  if (task.scope !== OPERATIONS[task.operation].scope) throw Error('SCOPE_MISMATCH');
  // An operation name is not evidence that an arbitrary task ID is an approved fixture.
  const fixture = SYNTHETIC_FIXTURES.find(value => value.task_id === task.task_id);
  if (!fixture || task.operation !== fixture.operation || task.scope !== fixture.scope) {
    throw Error('FIXTURE_IDENTITY_MISMATCH');
  }
  return Object.freeze({ ...task });
}

export function classifySyntheticTask(task) {
  let safe;
  try { safe = validateSyntheticTask(task); }
  catch { return decision('INVALID', 'HOLD', 'INVALID_ENVELOPE'); }
  const rule = OPERATIONS[safe.operation];
  return decision(safe.task_id, rule.recommendation, rule.reason);
}

// Future model suggestions are untrusted data. A match is advisory, never an approval.
export function evaluateUntrustedProposal(task, proposal) {
  const policy = classifySyntheticTask(task);
  if (policy.recommendation === 'HOLD') return policy;
  // A hostile JavaScript object or Proxy may throw during inspection: still fail closed.
  let matches = false;
  try {
    matches = exactDataFields(proposal, PROPOSAL_KEYS) &&
      proposal.schema_version === SCHEMA_VERSION &&
      proposal.task_id === policy.task_id && proposal.recommendation === 'REVIEW_ONLY';
  } catch { /* Untrusted input cannot interrupt the HOLD decision. */ }
  if (!matches) return decision(policy.task_id, 'HOLD', 'UNTRUSTED_PROPOSAL_REJECTED');
  return decision(policy.task_id, 'REVIEW_ONLY', 'ADVISORY_MATCH_ONLY');
}

// This CLI prints deterministic local fixture decisions only. It has no network or write paths.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const task of SYNTHETIC_FIXTURES) console.log(JSON.stringify(classifySyntheticTask(task)));
}
