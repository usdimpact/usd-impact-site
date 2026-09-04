import { createHash } from 'node:crypto';

export const SCHEMA_VERSION = 1;
export const OUTCOME = Object.freeze({ PASS: 'PASS', WARN: 'WARN', FAIL: 'FAIL', UNKNOWN: 'UNKNOWN', SKIP: 'SKIP' });
export const CLASSIFICATION = Object.freeze({
  GOLD: 'A_GOLD',
  GOLD_CANDIDATE: 'A_GOLD_CANDIDATE',
  FUNCTIONAL: 'B_FUNCTIONAL',
  FRAGILE: 'C_FRAGILE',
  FAILED: 'D_FAILED',
  UNKNOWN: 'E_UNKNOWN',
  REDUNDANT: 'F_REDUNDANT',
});
export const SEVERITY = Object.freeze({ P0: 'P0', P1: 'P1', P2: 'P2', P3: 'P3' });

const SECRET_KEY = /(authorization|cookie|secret|password|token|api[-_]?key|private[-_]?key|service[-_]?role|access[-_]?token|refresh[-_]?token|signature)/i;
const VALUE_PATTERNS = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED]'],
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_OPENAI_KEY]'],
  [/\bre_[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_RESEND_KEY]'],
  [/\bwhsec_[A-Za-z0-9_+/=-]{8,}\b/g, '[REDACTED_WEBHOOK_SECRET]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_JWT]'],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]'],
];
const OUTCOME_RANK = Object.freeze({ FAIL: 0, UNKNOWN: 1, WARN: 2, SKIP: 3, PASS: 4 });
const SEVERITY_RANK = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function redactString(value, maxLength = 4_000) {
  let result = String(value ?? '').slice(0, maxLength);
  for (const [pattern, replacement] of VALUE_PATTERNS) result = result.replace(pattern, replacement);
  return result;
}

export function sanitize(value, seen = new WeakSet()) {
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 250).map((item) => sanitize(item, seen));
  if (typeof value !== 'object') return redactString(value);
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  const result = {};
  for (const [key, entry] of Object.entries(value).slice(0, 250)) {
    if (SECRET_KEY.test(key) && (typeof entry === 'string' || (entry && typeof entry === 'object'))) result[key] = '[REDACTED]';
    else result[key] = sanitize(entry, seen);
  }
  return result;
}

export function classify(outcome, goldEligible = false) {
  if (outcome === OUTCOME.PASS) return goldEligible ? CLASSIFICATION.GOLD_CANDIDATE : CLASSIFICATION.FUNCTIONAL;
  if (outcome === OUTCOME.WARN) return CLASSIFICATION.FRAGILE;
  if (outcome === OUTCOME.FAIL) return CLASSIFICATION.FAILED;
  return CLASSIFICATION.UNKNOWN;
}

export function result(input) {
  for (const field of ['id', 'workflowId', 'title', 'domain', 'severity', 'outcome']) {
    if (!input[field]) throw new Error(`Missing contract result field: ${field}`);
  }
  if (!Object.values(SEVERITY).includes(input.severity)) throw new Error(`Invalid severity: ${input.severity}`);
  if (!Object.values(OUTCOME).includes(input.outcome)) throw new Error(`Invalid outcome: ${input.outcome}`);
  const evidence = sanitize(input.evidence || []);
  return Object.freeze({
    schema_version: SCHEMA_VERSION,
    id: input.id,
    workflow_id: input.workflowId,
    title: input.title,
    domain: input.domain,
    severity: input.severity,
    material: input.material !== false,
    outcome: input.outcome,
    classification: classify(input.outcome, input.goldEligible === true),
    gold_eligible: input.goldEligible === true,
    summary: redactString(input.summary || ''),
    observed_at: input.observedAt || new Date().toISOString(),
    evidence,
    evidence_digest: sha256(JSON.stringify(evidence)),
    remediation: input.remediation ? sanitize(input.remediation) : null,
  });
}

export function compareResults(a, b) {
  return (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99)
    || (OUTCOME_RANK[a.outcome] ?? 99) - (OUTCOME_RANK[b.outcome] ?? 99)
    || a.id.localeCompare(b.id);
}

export function health(results) {
  const material = results.filter((entry) => entry.material !== false);
  const outcomes = Object.fromEntries(Object.values(OUTCOME).map((name) => [name, 0]));
  for (const entry of material) outcomes[entry.outcome] += 1;
  const p0Fail = material.some((entry) => entry.severity === 'P0' && entry.outcome === 'FAIL');
  const p0Unknown = material.some((entry) => entry.severity === 'P0' && ['UNKNOWN', 'SKIP'].includes(entry.outcome));
  const p1Fail = material.some((entry) => entry.severity === 'P1' && entry.outcome === 'FAIL');
  const degraded = material.some((entry) => ['WARN', 'UNKNOWN', 'SKIP'].includes(entry.outcome));
  const status = p0Fail ? 'RED' : (p0Unknown || p1Fail || degraded ? 'AMBER' : 'GREEN');
  const verified = outcomes.PASS + outcomes.WARN + outcomes.FAIL;
  return {
    status,
    release_gate: status === 'RED' ? 'NOT_READY' : (status === 'AMBER' ? 'READY_WITH_CONDITIONS' : 'READY'),
    material_contracts: material.length,
    evidence_coverage_percent: material.length ? Number((verified * 100 / material.length).toFixed(1)) : 0,
    pass_percent: material.length ? Number((outcomes.PASS * 100 / material.length).toFixed(1)) : 0,
    outcomes,
  };
}

export function fixPacket(entry, generatedAt = new Date().toISOString()) {
  if (!['FAIL', 'WARN', 'UNKNOWN'].includes(entry.outcome)) return null;
  const remediation = entry.remediation || {};
  return sanitize({
    schema_version: SCHEMA_VERSION,
    id: `FIX-${entry.id}`,
    generated_at: generatedAt,
    status: 'PROPOSED_ONLY',
    human_approval_required: true,
    contract_id: entry.id,
    workflow_id: entry.workflow_id,
    severity: entry.severity,
    outcome: entry.outcome,
    problem_statement: entry.summary,
    evidence_digest: entry.evidence_digest,
    likely_root_causes: remediation.likely_root_causes || ['Insufficient evidence or a deviation from the explicit contract.'],
    smallest_safe_scope: remediation.smallest_safe_scope || ['The affected workflow and direct dependencies only.'],
    proposed_changes: remediation.proposed_changes || ['Collect direct evidence before changing code or configuration.'],
    verification_plan: remediation.verification_plan || ['Re-run this contract on the exact proposed head.', 'Run related regression contracts.', 'Verify Preview before any Production approval.'],
    rollback_plan: remediation.rollback_plan || ['Revert only the scoped remediation commit.', 'Verify the prior fail-closed state.'],
    prohibited_actions: remediation.prohibited_actions || ['No automatic merge or Production deployment.', 'No database, customer, entitlement, email, payment, Drive, or secret mutation.'],
    acceptance_criteria: remediation.acceptance_criteria || ['Current direct evidence passes.', 'No related regression fails.', 'Independent review confirms the root cause was addressed.'],
  });
}

export function register(workflows, results, generatedAt) {
  const byWorkflow = new Map();
  for (const entry of results) {
    if (!byWorkflow.has(entry.workflow_id)) byWorkflow.set(entry.workflow_id, []);
    byWorkflow.get(entry.workflow_id).push(entry);
  }
  return workflows.map((workflow) => {
    const contracts = (byWorkflow.get(workflow.id) || []).sort(compareResults);
    let current = workflow.baseline_classification || CLASSIFICATION.UNKNOWN;
    if (contracts.some((entry) => entry.outcome === 'FAIL')) current = CLASSIFICATION.FAILED;
    else if (contracts.some((entry) => ['UNKNOWN', 'SKIP'].includes(entry.outcome))) current = CLASSIFICATION.UNKNOWN;
    else if (contracts.some((entry) => entry.outcome === 'WARN')) current = CLASSIFICATION.FRAGILE;
    else if (contracts.length && contracts.every((entry) => entry.outcome === 'PASS')) current = contracts.every((entry) => entry.gold_eligible) ? CLASSIFICATION.GOLD_CANDIDATE : CLASSIFICATION.FUNCTIONAL;
    return sanitize({ ...workflow, current_classification: current, last_verified_at: contracts.length ? generatedAt : null, contract_ids: contracts.map((entry) => entry.id), contract_outcomes: Object.fromEntries(contracts.map((entry) => [entry.id, entry.outcome])) });
  });
}

export function assertSafeArtifact(value) {
  const text = JSON.stringify(value);
  const detected = [];
  for (const [pattern, replacement] of VALUE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text) && !String(replacement).includes('EMAIL')) detected.push(String(replacement));
  }
  if (detected.length) throw new Error(`Sensitive material remained in artifact: ${detected.join(', ')}`);
  return true;
}
