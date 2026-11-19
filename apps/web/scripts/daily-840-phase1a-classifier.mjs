// DEC-026 / #840 Phase 1a. Pure proposal for Draft review; no runtime integration.
// Readers must independently authenticate facts and enumerate complete histories.
// This module checks supplied data, not source authenticity. A receipt is an
// authenticated immutable original-attempt record, never just a URL,
// title, time proximity or human correlation. No built-in retrieval or clock.
// Recovery verifies publication provenance only; native acceptance and
// incident closure are always false for recovery. Later Health is separate.

// Owner decision recorded in this conversation on 2026-11-17. OFFLINE ONLY.
// This does not change live publisher/Health policy or authorize any spending.
export const POLICY_REVISION = 'owner-2026-11-17-offline-v1';
export const REPOSITORY = 'usdimpact/usd-impact-site';
const SOURCE = '.github/workflows/daily-news.yml';
const PUBLISHER = '.github/workflows/daily-news-auto-publish.yml';
const HEALTH = '.github/workflows/daily-news-health.yml';
const BACKSTOP = '.github/workflows/daily-news-schedule-backstop.yml';
const VERCEL_PROJECT = 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7';
const BOT = 'github-actions[bot]';
const AUTHOR = 'usd-impact-daily-pr-author[bot]';
const JOBS = ['start', 'poll', 'import', 'validate', 'openPr'];
const CHECKS = ['webQuality', 'dependencyReview', 'migrationGuard', 'codeql'];
const CHECK_IDENTITIES = {
  webQuality: [['validate-and-build', 'github-actions', '.github/workflows/quality.yml']],
  dependencyReview: [['Dependency review', 'github-actions', '.github/workflows/dependency-review.yml']],
  migrationGuard: [['Reject Development-only Production migration files', 'github-actions', '.github/workflows/supabase-production-intake-guard.yml']],
  codeql: [['CodeQL', 'github-advanced-security', '.github/workflows/codeql.yml'],
    ['CodeQL (javascript-typescript)', 'github-actions', '.github/workflows/codeql.yml']]
};
const OUTPUTS = ['article', 'index', 'latestJson', 'rss'];
export const READER_KEYS = Object.freeze(['sourceRun', 'publisher', 'pr', 'deployment', 'outputs', 'healthRun', 'editorial', 'recoveryOrigin']);
const BAD = Symbol('invalid data');
const optional = schema => ({ optional: schema });
const list = schema => ({ list: schema });
const oneOf = (...values) => value => values.includes(value);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 300 && !/[\u0000-\u001f\u007f]/u.test(value);
const id = value => Number.isSafeInteger(value) && value > 0;
const count = value => Number.isSafeInteger(value) && value >= 0;
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const deploymentId = value => typeof value === 'string' && /^dpl_[A-Za-z0-9]+$/.test(value);
const boolean = value => typeof value === 'boolean';
const money = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const login = value => typeof value === 'string' && /^[A-Za-z0-9-]+(?:\[bot\])?$/.test(value) && value.length <= 100;
const workflow = value => typeof value === 'string' && /^\.github\/workflows\/[a-z0-9-]+\.yml$/.test(value);
const event = oneOf('schedule', 'workflow_dispatch', 'workflow_run', 'repository_dispatch', 'push', 'pull_request');
const status = oneOf('queued', 'in_progress', 'completed', 'waiting', 'pending', 'requested');
const conclusion = oneOf(null, 'success', 'failure', 'cancelled', 'skipped', 'timed_out', 'neutral', 'action_required', 'stale');

export function validEditionDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function validUtc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const time = Date.parse(value);
  const canonical = value.length === 20 ? value.slice(0, -1) + '.000Z' : value;
  return Number.isFinite(time) && new Date(time).toISOString() === canonical;
}
const utc = validUtc;
const record = value => {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch { return false; }
};
// Data descriptors only: input getters and object coercions are never called.
export function ownData(value, key) {
  try {
    if (!record(value)) return BAD;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return undefined;
    return Object.hasOwn(descriptor, 'value') ? descriptor.value : BAD;
  } catch { return BAD; }
}
function sanitize(value, schema) {
  try {
    if (typeof schema === 'function') return schema(value) ? value : BAD;
    if (Object.hasOwn(schema, 'optional')) return value === undefined || value === null ? null : sanitize(value, schema.optional);
    if (Object.hasOwn(schema, 'list')) {
      if (!Array.isArray(value) || value.length > 500) return BAD;
      const clean = [];
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.hasOwn(descriptor, 'value')) return BAD;
        const item = sanitize(descriptor.value, schema.list);
        if (item === BAD) return BAD;
        clean.push(item);
      }
      return clean;
    }
    if (!record(value)) return BAD;
    const clean = {};
    for (const [key, rule] of Object.entries(schema)) {
      const item = sanitize(ownData(value, key), rule);
      if (item === BAD) return BAD;
      clean[key] = item;
    }
    return clean;
  } catch { return BAD; }
}
const run = {
  repository: text, id, workflowPath: workflow, branch: text, attempt: id, event,
  status, conclusion, createdAt: utc, completedAt: utc, headSha: sha,
  actor: optional(login), triggeringActor: optional(login)
};
// The backstop SUMMARY prints edition and exact source-run URL, then exits.
// It cannot know the future publisher/PR. Source attempt/head are independently
// fetched metadata joined to that URL, not text claimed to appear in the summary.
const receipt = {
  kind: oneOf('original-github-job-summary'), authenticated: boolean, immutable: boolean,
  originalAttemptVerified: boolean, repository: text, workflowPath: workflow,
  runId: id, runAttempt: id, jobId: id, sha256: digest, recordedAt: utc,
  sourceRunUrl: text, sourceRunId: id, sourceRunAttempt: id, sourceHeadSha: sha,
  sourceMetadataVerified: boolean, editionDate: validEditionDate
};
// Publisher SUMMARY contains PR number and merge SHA; metadata joins
// supply source and PR-head identity. Edition/URL are in original job LOG.
const publisherReceipt = {
  kind: oneOf('original-github-job-summary'), authenticated: boolean, immutable: boolean,
  originalAttemptVerified: boolean, metadataBindingsVerified: boolean, repository: text, workflowPath: workflow,
  runId: id, runAttempt: id, jobId: id, sha256: digest, recordedAt: utc,
  sourceRunId: id, sourceRunAttempt: id, sourceHeadSha: sha, prNumber: id, prHeadSha: sha, mergeSha: sha
};
const publisherLogReceipt = {
  kind: oneOf('original-github-job-log'), authenticated: boolean, immutable: boolean,
  originalAttemptVerified: boolean, metadataBindingsVerified: boolean, repository: text, workflowPath: workflow,
  runId: id, runAttempt: id, jobId: id, sha256: digest, recordedAt: utc,
  sourceRunId: id, sourceRunAttempt: id, sourceHeadSha: sha, prNumber: id, prHeadSha: sha,
  mergeSha: sha, editionDate: validEditionDate, editionUrl: text
};
// A success marker is timed from an original authenticated publisher job log.
// The four-output coverage, SHA and deployment metadata are INDEPENDENT joins:
// they must not be falsely attributed to fields printed by the log itself.
const originalVerification = {
  kind: oneOf('original-publisher-four-output-verification'),
  artifactKind: oneOf('original-github-job-log'),
  authenticated: boolean, immutable: boolean, originalAttemptVerified: boolean,
  metadataBindingsVerified: boolean, verifierContractVerified: boolean,
  repository: text, workflowPath: workflow, runId: id, runAttempt: id, jobId: id,
  sha256: digest, recordedAt: utc, editionDate: validEditionDate, editionUrl: text,
  sourceRunId: id, sourceRunAttempt: id, sourceHeadSha: sha,
  prNumber: id, prHeadSha: sha, mergeSha: sha, deploymentId,
  verifierSourceSha: sha, checkedOutputs: list(oneOf(...OUTPUTS))
};
// Entire-edition request inventory, including failed/uncertain create attempts.
// Polling is listed for traceability but does not consume a generation slot.
// Scalar flags are a normalized contract, NOT authentication implemented here.
const requestAccounting = {
  kind: oneOf('authenticated-edition-request-ledger'), repository: text,
  editionDate: validEditionDate, authenticated: boolean, immutable: boolean,
  scope: oneOf('entire-edition-all-generation-requests'), complete: boolean,
  paginationComplete: boolean, allSubmissionAttemptsIncluded: boolean,
  sha256: digest, observedAt: utc,
  authorization: {
    kind: oneOf('independently-verified-existing-budget'), reference: text,
    sha256: digest, independentlyVerified: boolean, editionDate: validEditionDate,
    currency: oneOf('USD'), maxGenerationRequests: count, limitUsd: money
  },
  requests: list({
    clientRequestId: text, providerRequestId: optional(text),
    operation: oneOf('generation-create', 'status-poll'), method: oneOf('POST', 'GET'),
    sourceRunId: id, sourceRunAttempt: id, sourceHeadSha: sha, editionDate: validEditionDate,
    submittedAt: utc, authenticated: boolean, originalAttemptVerified: boolean,
    billingState: oneOf('settled', 'unknown', 'not-chargeable'),
    chargedMicrousd: optional(count)
  })
};
// Normalized independent joins, NOT a claim that the workflow prints an exact
// evaluation timestamp. The original report supplies its selected source's
// Started/Last updated values. Trusted readers must establish an inclusive
// window containing the actual date -u +%s evaluation; ambiguous windows HOLD.
const healthFreshnessWindow = {
  kind: oneOf('normalized-original-health-freshness-window'),
  authenticated: boolean, immutable: boolean, originalAttemptVerified: boolean,
  metadataBindingsVerified: boolean, sourceTimestampFromOriginalReport: boolean,
  evaluationBoundsVerified: boolean,
  runId: id, runAttempt: id, jobId: id, reportSha256: digest,
  sourceRunId: id, sourceRunAttempt: id, sourceCreatedAt: utc,
  sourceUpdatedAt: optional(utc), timestampBasis: oneOf('updated_at', 'created_at-fallback'),
  evaluatedNoEarlierThan: utc, evaluatedNoLaterThan: utc, maxAgeSeconds: count
};
const outcome = { status, conclusion, createdAt: utc, completedAt: utc, noOpVerified: boolean };
const sourceHistory = { id, attempt: id, event, headSha: sha, generationStarted: boolean, ...outcome };
const publisherHistory = { id, attempt: id, event, sourceRunId: id, merged: boolean, mergeSha: optional(sha), ...outcome };
const prHistory = { number: id, sourceRunId: id, headSha: sha, merged: boolean };
// These normalized fields require independent check/run/PR acquisition; they are
// not all fields of GitHub's check-runs REST response. In particular an aggregate
// CodeQL check needs its actual underlying PR analysis workflow provenance.
const check = { id, name: text, appSlug: text, workflowPath: workflow, status, conclusion, headSha: sha, completedAt: utc,
  workflowRunId: id, workflowEvent: event, workflowRunAttempt: id, workflowHeadSha: sha,
  workflowRepository: text, prNumber: id, workflowProvenanceVerified: boolean };
const output = { url: text, status: count, contentType: text, editionDate: validEditionDate, title: text, observedAt: utc, slug: optional(text) };
const schemas = {
  sourceRun: { ...run, jobs: Object.fromEntries(JOBS.map(key => [key, conclusion])) },
  publisher: { ...run, sourceRunId: id, sourceRunAttempt: id, verifiedPrHeadSha: sha, prNumber: id, mergeSha: sha,
    protectedMergeVerified: boolean, recoveryReceipt: optional(publisherReceipt), recoveryLogReceipt: optional(publisherLogReceipt),
    originalVerification: optional(originalVerification) },
  pr: { repository: text, number: id, draft: boolean, merged: boolean, authorType: text, authorLogin: login,
    authorAppSlug: text, authorAppVerified: boolean, mergedBy: login, baseBranch: text, baseSha: sha,
    headBranch: text, headSha: sha, mergeSha: sha, sourceRunId: id, editionDate: validEditionDate,
    createdAt: utc, mergedAt: utc, changedFiles: list(text), changedFilesComplete: boolean, changedFilesAtHeadSha: sha,
    originalHeadSha: sha, originalHeadVerified: boolean,
    // Source first-creation logs identify the dispatched quality run; full HEAD is
    // independently fetched from its immutable run metadata, not printed there.
    originalHeadReceipt: { kind: oneOf('original-source-quality-handoff'), authenticated: boolean, immutable: boolean,
      sourceRunId: id, sourceRunAttempt: id, jobId: id, sha256: digest, headSha: sha, recordedAt: utc,
      independentBindingsVerified: boolean, qualityRunId: id, qualityRunAttempt: id, qualityWorkflowPath: workflow,
      qualityEvent: event, qualityRepository: text, qualityHeadSha: sha, qualityHeadBranch: text },
    // `target:preview` is normalized only from authenticated provider semantics
    // and branch context; Vercel's raw API target may be null. ReadyAt is the
    // authenticated original readiness timestamp; observedAt is the independent
    // collection time and may legitimately be after merge or natural Health.
    preview: { provider: text, projectId: text, projectName: text, repository: text, deploymentId,
      target: text, state: text, headSha: sha, gitRef: text, createdAt: utc, readyAt: utc, observedAt: utc,
      proofKind: oneOf('authenticated-vercel-deployment-metadata', 'authenticated-github-vercel-status'), authenticated: boolean, readyTimestampVerified: boolean },
    checks: Object.fromEntries(CHECKS.map(key => [key, check])) },
  deployment: { repository: text, projectId: text, id: deploymentId, target: text, state: text, sha, readyAt: utc,
    canonicalAlias: text, aliasDeploymentId: deploymentId, aliasObservedAt: utc },
  outputs: Object.fromEntries(OUTPUTS.map(key => [key, output])),
  healthRun: { state: oneOf('pending', 'unknown', 'healthy', 'unhealthy'), targetEditionDate: validEditionDate,
    repository: optional(text), id: optional(id), workflowPath: optional(workflow), branch: optional(text),
    attempt: optional(id), event: optional(event), status: optional(status), conclusion: optional(conclusion),
    createdAt: optional(utc), completedAt: optional(utc), headSha: optional(sha),
    freshness: optional(healthFreshnessWindow),
    report: optional({ kind: oneOf('original-github-job-log'), authenticated: boolean, immutable: boolean,
      originalAttemptVerified: boolean, metadataBindingsVerified: boolean, runId: id, runAttempt: id, jobId: id, sha256: digest,
      state: oneOf('healthy', 'unhealthy'), targetEditionDate: validEditionDate,
      // Native Health report supplies source/date/state. mergeSha is an explicitly
      // independently verified source→PR→Production join, not a claimed log field.
      sourceRunId: id, mergeSha: sha, recordedAt: utc }) },
  editorial: { editionDate: validEditionDate, distinctPrimarySources: count, rightsCleared: boolean,
    singlePaidGeneration: boolean,
    history: { repository: text, editionDate: validEditionDate, observedAt: utc,
      sourceRunsComplete: boolean, publisherRunsComplete: boolean, prsComplete: boolean, paginationComplete: boolean,
      allRelevantRunOutcomesVerified: boolean,
      sourceRuns: list(sourceHistory), publisherRuns: list(publisherHistory), prs: list(prHistory) },
    budget: { sourceRunId: id, editionDate: validEditionDate, ledgerComplete: boolean,
      approvedMaxGenerations: count, observedGenerations: count, approvedLimitUsd: money,
      spentUsd: money, observedAt: utc, requestAccounting: optional(requestAccounting) } },
  recoveryOrigin: { kind: oneOf('native-scheduled-backstop', 'external-wake', 'human-correlation'),
    run: optional(run), nominalSlot: optional(oneOf('10:47', '11:07')), receipt: optional(receipt) }
};
// Shared normalized contract; invalid expected fields never survive collection.
export function sanitizeEvidencePart(key, raw) {
  if (!READER_KEYS.includes(key)) return { valid: false, value: null };
  if (key === 'recoveryOrigin' && (raw === undefined || raw === null)) return { valid: true, value: null };
  const clean = sanitize(raw, schemas[key]);
  return clean === BAD ? { valid: false, value: null } : { valid: true, value: clean };
}
export function validRequest(input) {
  return record(input) && validEditionDate(ownData(input, 'editionDate')) && validUtc(ownData(input, 'now'));
}
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const milliseconds = value => validUtc(value) ? Date.parse(value) : null;
function eastern(timestamp) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, seconds: +parts.hour * 3600 + +parts.minute * 60 + +parts.second };
}
function healthSnapshot(health) {
  return { state: health?.state ?? 'unknown', runId: health?.id ?? null, attempt: health?.attempt ?? null,
    sourceRunId: health?.report?.sourceRunId ?? null, editionDate: health?.targetEditionDate ?? null,
    conclusion: health?.conclusion ?? null, verified: false };
}
function latencyLedger(date, evidence) {
  const source = evidence.sourceRun, pr = evidence.pr, deploy = evidence.deployment, health = evidence.healthRun;
  const delta = (a, b) => milliseconds(a) !== null && milliseconds(b) !== null ? milliseconds(a) - milliseconds(b) : null;
  const common = { sourceDurationMs: delta(source?.completedAt, source?.createdAt),
    sourceToMergeMs: delta(pr?.mergedAt, source?.createdAt), mergeToProductionMs: delta(deploy?.readyAt, pr?.mergedAt) };
  const origin = evidence.recoveryOrigin;
  const nativeBackstop = origin?.kind === 'native-scheduled-backstop';
  // Nominal times and latency are observational; latency never grants acceptance.
  return { native: source?.event === 'schedule' ? { nominalAt: `${date}T09:17:00Z`,
    schedulerDelayMs: delta(source.createdAt, `${date}T09:17:00Z`), ...common } : null,
    recovery: source?.event === 'workflow_dispatch' ? { nominalBackstopAt: nativeBackstop && origin?.nominalSlot ? `${date}T${origin.nominalSlot}:00Z` : null,
      backstopSchedulerDelayMs: nativeBackstop && origin?.nominalSlot ? delta(origin.run?.createdAt, `${date}T${origin.nominalSlot}:00Z`) : null,
      dispatchDelayMs: delta(source.createdAt, origin?.run?.createdAt), ...common } : null,
    health: { nominalAt: `${date}T18:45:00Z`, schedulerDelayMs: delta(health?.createdAt, `${date}T18:45:00Z`) } };
}
function result(evidenceClass, issues, evidence = {}, date = null) {
  const native = evidenceClass === 'NATIVE_AUTO_VERIFIED';
  const recovery = evidenceClass === 'UNATTENDED_RECOVERY_VERIFIED';
  const health = healthSnapshot(evidence.healthRun);
  health.reportedState = health.state;
  health.reportedSourceRunId = health.sourceRunId;
  health.sourceRunId = native ? health.reportedSourceRunId : null;
  const healthInvalid = issues.some(issue => issue.startsWith('HEALTH_') ||
    issue.startsWith('RECOVERY_HEALTH_') || issue === 'RECOVERY_NATIVE_HEALTH_INCONSISTENT');
  // Any unverified terminal claim is display-only, including unrelated native HOLDs.
  if (healthInvalid || (!native && ['healthy', 'unhealthy'].includes(health.reportedState)))
    health.state = 'unknown';
  health.verified = native;
  health.reviewRequired = evidence.sourceRun?.event === 'workflow_dispatch' &&
    ['healthy', 'unhealthy'].includes(health.reportedState);
  const warnings = health.reviewRequired ? ['NATIVE_HEALTH_SEPARATE_REVIEW_REQUIRED'] : [];
  return freeze({ evidenceClass, policyRevision: POLICY_REVISION, editionDate: date, sourceRunId: evidence.sourceRun?.id ?? null,
    publisherRunId: evidence.publisher?.id ?? null, backstopRunId: evidence.recoveryOrigin?.run?.id ?? null,
    healthRunId: evidence.healthRun?.id ?? null, prNumber: evidence.pr?.number ?? null,
    mergeSha: evidence.pr?.mergeSha ?? null,
    originalPublisherVerifiedAt: evidence.publisher?.originalVerification?.recordedAt ?? null,
    accepted: native, nativeAcceptance: native, nativeHealthy: native,
    reportVerified: native || recovery, recoveryVerified: recovery, mayCloseIncident: false,
    sourceAccess: 'NOT_INDEPENDENTLY_VERIFIED_BY_CLASSIFIER', nativeHealth: health,
    latency: date ? latencyLedger(date, evidence) : { native: null, recovery: null, health: null },
    issues: [...new Set(issues)], warnings });
}
function checkRun(value, path, issues, prefix, now) {
  if (value.repository !== REPOSITORY || value.workflowPath !== path || value.branch !== 'main') issues.push(`${prefix}_IDENTITY_INVALID`);
  if (value.attempt !== 1) issues.push(`${prefix}_NOT_ORIGINAL_ATTEMPT`);
  if (value.status !== 'completed' || value.conclusion !== 'success') issues.push(`${prefix}_NOT_SUCCESS`);
  if (milliseconds(value.createdAt) > milliseconds(value.completedAt) || milliseconds(value.completedAt) > now) issues.push(`${prefix}_TIME_INVALID`);
}
function beforeCutoff(value, date, prefix, issues) {
  const local = eastern(value);
  if (value.slice(0, 10) !== date || local.date !== date) issues.push(`${prefix}_EDITION_DATE_MISMATCH`);
  if (local.seconds >= 8 * 3600 + 30 * 60) issues.push(`${prefix}_AFTER_0830_ET_CUTOFF`);
}
function checkOriginalVerification(publisher, source, pr, deploy, date, now, issues) {
  const proof = publisher.originalVerification;
  if (!proof) { issues.push('ORIGINAL_PUBLICATION_VERIFICATION_MISSING'); return; }
  if (!proof.authenticated || !proof.immutable || !proof.originalAttemptVerified ||
      !proof.metadataBindingsVerified || !proof.verifierContractVerified ||
      proof.repository !== REPOSITORY || proof.workflowPath !== PUBLISHER ||
      proof.runId !== publisher.id || proof.runAttempt !== 1 ||
      proof.sourceRunId !== source.id || proof.sourceRunAttempt !== 1 || proof.sourceHeadSha !== source.headSha ||
      proof.prNumber !== pr.number || proof.prHeadSha !== pr.headSha || proof.mergeSha !== pr.mergeSha ||
      proof.deploymentId !== deploy.id || proof.verifierSourceSha !== publisher.headSha ||
      proof.editionDate !== date || proof.editionUrl !== `https://www.usd-impact.com/news/${date}/`)
    issues.push('ORIGINAL_PUBLICATION_VERIFICATION_NOT_BOUND');
  if (proof.checkedOutputs.length !== OUTPUTS.length || new Set(proof.checkedOutputs).size !== OUTPUTS.length ||
      OUTPUTS.some(key => !proof.checkedOutputs.includes(key)))
    issues.push('ORIGINAL_PUBLICATION_FOUR_OUTPUTS_NOT_PROVEN');
  if (milliseconds(proof.recordedAt) < Math.max(milliseconds(pr.mergedAt), milliseconds(deploy.readyAt), milliseconds(publisher.createdAt)) ||
      milliseconds(proof.recordedAt) > milliseconds(publisher.completedAt) || milliseconds(proof.recordedAt) > now)
    issues.push('ORIGINAL_PUBLICATION_VERIFICATION_TIME_INVALID');
  // Original verification must precede 08:30, not later collector observations.
  // Later workflow cleanup is permitted; this is not a workflow end-time cutoff.
  beforeCutoff(proof.recordedAt, date, 'PUBLICATION_VERIFICATION', issues);
  const log = publisher.recoveryLogReceipt, summary = publisher.recoveryReceipt;
  if (log && (proof.jobId !== log.jobId || proof.sha256 !== log.sha256 || milliseconds(proof.recordedAt) !== milliseconds(log.recordedAt)))
    issues.push('ORIGINAL_VERIFICATION_RECOVERY_LOG_MISMATCH');
  if (summary && (proof.jobId !== summary.jobId || proof.sha256 === summary.sha256 ||
      milliseconds(summary.recordedAt) < milliseconds(proof.recordedAt)))
    issues.push('ORIGINAL_VERIFICATION_RECOVERY_SUMMARY_MISMATCH');
}
function dollarsToMicros(value) {
  const scaled = value * 1_000_000, rounded = Math.round(scaled);
  return Number.isSafeInteger(rounded) && Math.abs(scaled - rounded) < 0.000001 ? rounded : null;
}
function checkRequestAccounting(budget, source, date, latestObservation, now, issues) {
  const ledger = budget.requestAccounting;
  if (!ledger) { issues.push('PAID_REQUEST_LEDGER_MISSING'); return; }
  if (!ledger.authenticated || !ledger.immutable || !ledger.complete || !ledger.paginationComplete ||
      !ledger.allSubmissionAttemptsIncluded || ledger.repository !== REPOSITORY || ledger.editionDate !== date ||
      milliseconds(ledger.observedAt) < Math.max(latestObservation, milliseconds(budget.observedAt)) ||
      milliseconds(ledger.observedAt) > now)
    issues.push('PAID_REQUEST_LEDGER_NOT_VERIFIED');
  const approval = ledger.authorization;
  // Preserve the existing single-generation ceiling. This decision adds NO
  // retries and no higher dollar limit, even when two POSTs share a response ID.
  if (!approval.independentlyVerified || approval.editionDate !== date ||
      approval.maxGenerationRequests !== 1 || approval.maxGenerationRequests !== budget.approvedMaxGenerations ||
      approval.limitUsd !== budget.approvedLimitUsd)
    issues.push('PAID_REQUEST_BUDGET_AUTHORITY_NOT_VERIFIED');
  const creates = ledger.requests.filter(row => row.operation === 'generation-create');
  if (creates.length !== 1 || creates.length !== budget.observedGenerations ||
      creates.length > approval.maxGenerationRequests)
    issues.push('PAID_GENERATION_REQUEST_CAP_OR_COUNT_MISMATCH');
  if (new Set(ledger.requests.map(row => row.clientRequestId)).size !== ledger.requests.length)
    issues.push('PAID_REQUEST_IDS_NOT_DISTINCT');
  let total = 0;
  for (const row of ledger.requests) {
    if (!row.authenticated || !row.originalAttemptVerified || row.sourceRunId !== source.id ||
        row.sourceRunAttempt !== 1 || row.sourceHeadSha !== source.headSha || row.editionDate !== date ||
        milliseconds(row.submittedAt) < milliseconds(source.createdAt) ||
        milliseconds(row.submittedAt) > milliseconds(source.completedAt) || milliseconds(row.submittedAt) > now)
      issues.push('PAID_REQUEST_IDENTITY_OR_TIME_INVALID');
    if (row.operation === 'generation-create') {
      if (row.method !== 'POST') issues.push('PAID_REQUEST_OPERATION_INVALID');
      if (row.billingState !== 'settled' || row.chargedMicrousd === null || !row.providerRequestId)
        issues.push('GENERATION_CHARGE_UNRESOLVED');
      else total += row.chargedMicrousd;
    } else {
      // A POST cannot be relabelled as a free status poll. Polls must refer to a
      // generation already submitted in this same complete edition inventory.
      const created = creates.find(item => item.providerRequestId === row.providerRequestId);
      if (row.method !== 'GET' || row.billingState !== 'not-chargeable' || row.chargedMicrousd !== 0 ||
          !row.providerRequestId || !created || milliseconds(row.submittedAt) < milliseconds(created.submittedAt))
        issues.push('STATUS_POLL_NOT_VERIFIED');
    }
  }
  const spent = dollarsToMicros(budget.spentUsd), limit = dollarsToMicros(approval.limitUsd);
  if (!Number.isSafeInteger(total) || spent === null || limit === null || total !== spent || total > limit)
    issues.push('PAID_REQUEST_COST_RECONCILIATION_FAILED');
}
function checkHistory(editorial, source, publisher, pr, latestObservation, now, issues) {
  const history = editorial.history, budget = editorial.budget;
  if (editorial.editionDate !== pr.editionDate || editorial.distinctPrimarySources < 3 || !editorial.rightsCleared) issues.push('EDITORIAL_OR_RIGHTS_NOT_VERIFIED');
  if (!editorial.singlePaidGeneration || !history.sourceRunsComplete || !history.publisherRunsComplete || !history.prsComplete || !history.paginationComplete ||
      !history.allRelevantRunOutcomesVerified || history.repository !== REPOSITORY || history.editionDate !== pr.editionDate) issues.push('COMPLETE_HISTORY_NOT_VERIFIED');
  if (milliseconds(history.observedAt) < latestObservation || milliseconds(history.observedAt) > now) issues.push('HISTORY_OBSERVATION_STALE');
  const generated = history.sourceRuns.filter(item => item.generationStarted);
  if (generated.length !== 1 || generated[0].id !== source.id || generated[0].attempt !== 1 || generated[0].event !== source.event || generated[0].headSha !== source.headSha ||
      generated[0].status !== source.status || generated[0].conclusion !== source.conclusion || generated[0].noOpVerified ||
      milliseconds(generated[0].createdAt) !== milliseconds(source.createdAt) || milliseconds(generated[0].completedAt) !== milliseconds(source.completedAt) ||
      new Set(history.sourceRuns.map(item => `${item.id}:${item.attempt}`)).size !== history.sourceRuns.length) issues.push('DUPLICATE_OR_UNBOUND_GENERATION');
  const merged = history.publisherRuns.filter(item => item.merged);
  if (merged.length !== 1 || merged[0].id !== publisher.id || merged[0].attempt !== 1 || merged[0].event !== publisher.event ||
      merged[0].sourceRunId !== source.id || merged[0].mergeSha !== pr.mergeSha || merged[0].status !== publisher.status || merged[0].conclusion !== publisher.conclusion || merged[0].noOpVerified ||
      milliseconds(merged[0].createdAt) !== milliseconds(publisher.createdAt) || milliseconds(merged[0].completedAt) !== milliseconds(publisher.completedAt) ||
      new Set(history.publisherRuns.map(item => `${item.id}:${item.attempt}`)).size !== history.publisherRuns.length) issues.push('DUPLICATE_OR_UNBOUND_PUBLISHER');
  for (const row of [...history.sourceRuns.filter(item => !item.generationStarted), ...history.publisherRuns.filter(item => !item.merged)]) {
    if (!row.noOpVerified || row.status !== 'completed' || !['success', 'skipped'].includes(row.conclusion) ||
        row.createdAt.slice(0, 10) !== pr.editionDate || milliseconds(row.completedAt) < milliseconds(row.createdAt) ||
        milliseconds(row.completedAt) > milliseconds(history.observedAt) || milliseconds(row.completedAt) > now) issues.push('HISTORY_EXTRA_RUN_NOT_VERIFIED_NOOP');
  }
  if (history.prs.length !== 1 || history.prs[0].number !== pr.number || history.prs[0].sourceRunId !== source.id ||
      history.prs[0].headSha !== pr.headSha || !history.prs[0].merged) issues.push('DUPLICATE_OR_UNBOUND_PR');
  if (!budget.ledgerComplete || budget.sourceRunId !== source.id || budget.editionDate !== pr.editionDate ||
      budget.approvedMaxGenerations !== 1 || budget.observedGenerations !== 1 || budget.spentUsd > budget.approvedLimitUsd ||
      milliseconds(budget.observedAt) < latestObservation || milliseconds(budget.observedAt) > now) issues.push('BUDGET_OR_SINGLE_GENERATION_NOT_VERIFIED');
  checkRequestAccounting(budget, source, pr.editionDate, latestObservation, now, issues);
}
function checkHealthIdentity(health, date, now, issues) {
  if (health.targetEditionDate !== date) issues.push('HEALTH_EDITION_MISMATCH');
  if (health.id !== null) {
    if (health.repository !== REPOSITORY || health.workflowPath !== HEALTH || health.branch !== 'main' || health.attempt !== 1 || health.event !== 'schedule' || !health.headSha || !health.status) issues.push('HEALTH_IDENTITY_INVALID');
    if (!health.createdAt || milliseconds(health.createdAt) > now || (health.completedAt && milliseconds(health.completedAt) > now)) issues.push('HEALTH_TIME_INVALID');
    if (health.createdAt && milliseconds(health.createdAt) < milliseconds(`${date}T18:45:00Z`)) issues.push('HEALTH_BEFORE_NOMINAL_SCHEDULE');
    if (health.createdAt && health.completedAt && milliseconds(health.completedAt) < milliseconds(health.createdAt)) issues.push('HEALTH_TIME_INVALID');
  } else {
    if (health.state !== 'pending' && health.state !== 'unknown') issues.push('HEALTH_RUN_MISSING');
    if (['repository', 'workflowPath', 'branch', 'attempt', 'event', 'status', 'conclusion', 'createdAt', 'completedAt', 'headSha', 'report'].some(key => health[key] !== null)) issues.push('HEALTH_ORPHAN_METADATA');
  }
}
// No wall clock or I/O: these are consistency checks on normalized evidence.
// The pinned live workflow computes age from the original selected source's
// updated_at (created_at fallback), using integer Unix seconds. It rejects age
// < 0 or > 43200, so exactly 12 hours is allowed. Evaluation is NOT now, Health
// creation, report emission, or source completion unless independently bound.
function checkNativeHealthFreshness(health, source, now, issues) {
  const proof = health.freshness, report = health.report;
  if (!proof) { issues.push('HEALTH_FRESHNESS_EVIDENCE_MISSING'); return; }
  if (!report || !proof.authenticated || !proof.immutable || !proof.originalAttemptVerified ||
      !proof.metadataBindingsVerified || !proof.sourceTimestampFromOriginalReport ||
      !proof.evaluationBoundsVerified || proof.runId !== health.id || proof.runAttempt !== 1 ||
      proof.jobId !== report.jobId || proof.reportSha256 !== report.sha256 ||
      proof.sourceRunId !== source.id || proof.sourceRunId !== report.sourceRunId ||
      proof.sourceRunAttempt !== 1 ||
      milliseconds(proof.sourceCreatedAt) !== milliseconds(source.createdAt) ||
      proof.maxAgeSeconds !== 12 * 60 * 60)
    issues.push('HEALTH_FRESHNESS_EVIDENCE_NOT_BOUND');
  const lower = milliseconds(proof.evaluatedNoEarlierThan);
  const upper = milliseconds(proof.evaluatedNoLaterThan);
  if (!health.createdAt || !health.completedAt || !report ||
      lower < milliseconds(health.createdAt) || upper < lower ||
      upper > milliseconds(report?.recordedAt) || upper > milliseconds(health.completedAt) || upper > now)
    issues.push('HEALTH_FRESHNESS_CLOCK_WINDOW_INVALID');
  const fromUpdated = proof.timestampBasis === 'updated_at';
  if ((fromUpdated && proof.sourceUpdatedAt === null) ||
      (!fromUpdated && proof.sourceUpdatedAt !== null)) {
    issues.push('HEALTH_SOURCE_TIMESTAMP_INCONSISTENT'); return;
  }
  const selected = milliseconds(fromUpdated ? proof.sourceUpdatedAt : proof.sourceCreatedAt);
  if (selected < milliseconds(source.createdAt) || selected > lower) {
    issues.push('HEALTH_SOURCE_TIMESTAMP_INCONSISTENT'); return;
  }
  // Match the shell's date +%s precision, rather than imposing a new ms rule.
  const minimumAge = Math.floor(lower / 1000) - Math.floor(selected / 1000);
  const maximumAge = Math.floor(upper / 1000) - Math.floor(selected / 1000);
  if (minimumAge > 12 * 60 * 60) issues.push('HEALTH_SOURCE_STALE');
  else if (maximumAge > 12 * 60 * 60) issues.push('HEALTH_FRESHNESS_BOUNDARY_UNCERTAIN');
}

// Owner-approved interim rule: retain HOLD for terminal recovery Health.
// No verified-plus-review or live Health change is authorized by this design.
function checkRecoveryHealth(health, date, publicationRunIds, issues) {
  const waiting = ['pending', 'unknown'].includes(health.state) && health.report === null &&
    health.conclusion === null && health.completedAt === null &&
    (health.status === null || ['queued', 'pending', 'waiting', 'requested', 'in_progress'].includes(health.status));
  const completed = health.id !== null && health.status === 'completed' &&
    health.createdAt !== null && health.completedAt !== null;
  const pending = completed && health.state === 'pending' &&
    health.conclusion === 'success' && health.report === null;
  const healthy = completed && health.state === 'healthy' && health.conclusion === 'success';
  const unhealthy = completed && health.state === 'unhealthy' && health.conclusion === 'failure';
  if (!waiting && !pending && !healthy && !unhealthy)
    issues.push('RECOVERY_NATIVE_HEALTH_INCONSISTENT');

  const report = health.report;
  // Failure paths do not print an unhealthy original job-log report. Do not
  // manufacture one or accept a normalized state as proof of such an artifact.
  if (unhealthy && report !== null) issues.push('RECOVERY_HEALTH_FAILURE_LOG_NOT_SUPPORTED');
  if (healthy && report === null) issues.push('RECOVERY_HEALTH_REPORT_MISSING');
  if (report !== null) {
    if (!completed || report.state !== health.state || !report.authenticated || !report.immutable ||
        !report.originalAttemptVerified || !report.metadataBindingsVerified ||
        report.runId !== health.id || report.runAttempt !== 1 ||
        report.targetEditionDate !== date ||
        milliseconds(report.recordedAt) < milliseconds(health.createdAt) ||
        milliseconds(report.recordedAt) > milliseconds(health.completedAt))
      issues.push('RECOVERY_HEALTH_REPORT_NOT_BOUND');
    // Actual Health selects a scheduled Daily source, not this dispatched
    // recovery, its publisher, backstop, or Health itself. Do not join to them.
    // Positive authentication of a different scheduled source remains a reader
    // obligation, and terminal outcomes retain the owner-approved interim HOLD.
    if (publicationRunIds.includes(report.sourceRunId))
      issues.push('RECOVERY_HEALTH_SOURCE_NOT_SCHEDULED');
  }
  if (['healthy', 'unhealthy'].includes(health.state))
    issues.push('RECOVERY_TERMINAL_HEALTH_HOLD');
}
export function classifyDailyPhase1a(input) {
  try { return classify(input); } catch { return result('HOLD', ['INPUT_NOT_SAFE_DATA']); }
}
function classify(input) {
  const editionDate = ownData(input, 'editionDate'), nowValue = ownData(input, 'now');
  if (!validEditionDate(editionDate) || !validUtc(nowValue)) return result('HOLD', ['REQUEST_DATE_OR_CLOCK_INVALID']);
  const now = milliseconds(nowValue);
  const raw = ownData(input, 'evidence');
  if (!record(raw)) return result('HOLD', ['EVIDENCE_MISSING']);
  const errors = ownData(input, 'errors');
  if (errors !== undefined && (!Array.isArray(errors) || errors.length > 0)) return result('HOLD', ['COLLECTION_ERROR']);
  const evidence = {}, issues = [];
  for (const key of READER_KEYS) {
    const part = sanitizeEvidencePart(key, ownData(raw, key));
    if (!part.valid) issues.push(`EVIDENCE_INVALID:${key}`);
    evidence[key] = part.value;
  }
  if (issues.length) return result('HOLD', issues, evidence, editionDate);
  const source = evidence.sourceRun, publisher = evidence.publisher, pr = evidence.pr;
  const deploy = evidence.deployment, health = evidence.healthRun, origin = evidence.recoveryOrigin;
  const recovery = source.event === 'workflow_dispatch';
  const weekday = new Date(`${editionDate}T00:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return result('HOLD', ['EDITION_OUTSIDE_WEEKDAY_SCHEDULE'], evidence, editionDate);
  if (!recovery && source.event !== 'schedule') return result('HOLD', ['SOURCE_EVENT_UNSUPPORTED'], evidence, editionDate);
  const provisionalOrigin = recovery && (!origin || origin.kind !== 'native-scheduled-backstop' || !origin.run || !origin.receipt || !origin.nominalSlot);
  checkRun(source, SOURCE, issues, 'SOURCE', now);
  checkRun(publisher, PUBLISHER, issues, 'PUBLISHER', now);
  if (!recovery && milliseconds(source.createdAt) < milliseconds(`${editionDate}T09:17:00Z`)) issues.push('SOURCE_BEFORE_NOMINAL_SCHEDULE');
  beforeCutoff(source.createdAt, editionDate, 'SOURCE', issues);
  beforeCutoff(pr.mergedAt, editionDate, 'MERGE', issues);
  beforeCutoff(deploy.readyAt, editionDate, 'PRODUCTION_READY', issues);
  checkOriginalVerification(publisher, source, pr, deploy, editionDate, now, issues);
  for (const key of JOBS) if (source.jobs[key] !== 'success') issues.push(`SOURCE_JOB_NOT_SUCCESS:${key}`);
  if (publisher.event !== (recovery ? 'workflow_dispatch' : 'workflow_run') || publisher.sourceRunId !== source.id ||
      publisher.sourceRunAttempt !== 1 || publisher.prNumber !== pr.number || !publisher.protectedMergeVerified ||
      publisher.verifiedPrHeadSha !== pr.headSha || publisher.mergeSha !== pr.mergeSha || publisher.headSha !== source.headSha) issues.push('PUBLISHER_LINEAGE_NOT_VERIFIED');
  if (pr.repository !== REPOSITORY || pr.draft || !pr.merged || pr.authorType !== 'Bot' || pr.authorLogin !== AUTHOR ||
      pr.authorAppSlug !== 'usd-impact-daily-pr-author' || !pr.authorAppVerified || pr.mergedBy !== BOT || pr.baseBranch !== 'main' ||
      pr.baseSha !== source.headSha || pr.sourceRunId !== source.id || pr.editionDate !== editionDate ||
      pr.headBranch !== `automation/daily-usd-impact-${editionDate}-${source.id}`) issues.push('PR_PROTECTED_LINEAGE_NOT_VERIFIED');
  const original = pr.originalHeadReceipt;
  if (!pr.changedFilesComplete || pr.changedFiles.length !== 1 || pr.changedFiles[0] !== `apps/web/src/content/news/${editionDate}.md` ||
      pr.changedFilesAtHeadSha !== pr.headSha) issues.push('PR_NOT_ORIGINAL_ONE_FILE_EDITION');
  if (!pr.originalHeadVerified || pr.originalHeadSha !== pr.headSha || !original.authenticated || !original.immutable ||
      original.sourceRunId !== source.id || original.sourceRunAttempt !== 1 || original.headSha !== pr.headSha ||
      !original.independentBindingsVerified || original.qualityRunAttempt !== 1 || original.qualityWorkflowPath !== '.github/workflows/quality.yml' ||
      original.qualityEvent !== 'workflow_dispatch' || original.qualityRepository !== REPOSITORY || original.qualityHeadSha !== pr.headSha ||
      original.qualityHeadBranch !== pr.headBranch || [source.id, publisher.id, health.id, origin?.run?.id].includes(original.qualityRunId) ||
      CHECKS.some(key => pr.checks[key].workflowRunId === original.qualityRunId) ||
      milliseconds(original.recordedAt) < milliseconds(pr.createdAt) || milliseconds(original.recordedAt) > milliseconds(source.completedAt)) issues.push('PR_ORIGINAL_HEAD_NOT_VERIFIED');
  const preview = pr.preview;
  if (!preview.authenticated || !preview.readyTimestampVerified || preview.provider !== 'vercel' || preview.projectId !== VERCEL_PROJECT || preview.projectName !== 'usd-impact-site' ||
      preview.repository !== REPOSITORY || preview.target !== 'preview' || preview.state !== 'READY' || preview.headSha !== pr.headSha || preview.gitRef !== pr.headBranch ||
      milliseconds(preview.createdAt) < milliseconds(source.createdAt) || milliseconds(preview.readyAt) < milliseconds(preview.createdAt) ||
      milliseconds(preview.readyAt) > milliseconds(pr.mergedAt) || milliseconds(preview.observedAt) < milliseconds(preview.readyAt) || milliseconds(preview.observedAt) > now) issues.push('EXACT_HEAD_PREVIEW_NOT_VERIFIED');
  for (const key of CHECKS) {
    const check = pr.checks[key];
    if (check.status !== 'completed' || check.conclusion !== 'success' || check.headSha !== pr.headSha ||
        !CHECK_IDENTITIES[key].some(([name, app, path]) => check.name === name && check.appSlug === app && check.workflowPath === path) ||
        !check.workflowProvenanceVerified || check.workflowEvent !== 'pull_request' || check.workflowRunAttempt !== 1 ||
        check.workflowHeadSha !== pr.headSha || check.workflowRepository !== REPOSITORY || check.prNumber !== pr.number ||
        [source.id, publisher.id, health.id, origin?.run?.id].includes(check.workflowRunId) ||
        milliseconds(check.completedAt) < milliseconds(pr.createdAt) || milliseconds(check.completedAt) > milliseconds(pr.mergedAt)) issues.push(`EXACT_HEAD_CHECK_NOT_VERIFIED:${key}`);
  }
  if (new Set(CHECKS.map(key => pr.checks[key].id)).size !== CHECKS.length) issues.push('CHECK_IDS_NOT_DISTINCT');
  if (new Set(CHECKS.map(key => pr.checks[key].workflowRunId)).size !== CHECKS.length) issues.push('CHECK_WORKFLOW_RUN_IDS_NOT_DISTINCT');
  // Native workflow_run begins after source completion. Recovery source dispatches
  // and observes the publisher receiver before it exits; that receiver waits for
  // source success before merging. Receiver creation is not publication time.
  if (milliseconds(pr.createdAt) < milliseconds(source.createdAt) || milliseconds(pr.createdAt) > milliseconds(source.completedAt) ||
      (!recovery && milliseconds(publisher.createdAt) < milliseconds(source.completedAt)) ||
      (recovery && milliseconds(publisher.createdAt) < Math.max(milliseconds(pr.createdAt), milliseconds(original.recordedAt))) ||
      milliseconds(pr.mergedAt) < milliseconds(source.completedAt) || milliseconds(pr.mergedAt) < milliseconds(publisher.createdAt) ||
      milliseconds(pr.mergedAt) > milliseconds(publisher.completedAt) || milliseconds(deploy.readyAt) < milliseconds(pr.mergedAt) ||
      milliseconds(deploy.readyAt) > now) issues.push('PUBLICATION_CHRONOLOGY_INVALID');
  if (deploy.repository !== REPOSITORY || deploy.target !== 'production' || deploy.state !== 'READY' || deploy.sha !== pr.mergeSha) issues.push('PRODUCTION_SHA_NOT_READY');
  if (deploy.projectId !== VERCEL_PROJECT) issues.push('PRODUCTION_PROJECT_NOT_VERIFIED');
  if (deploy.canonicalAlias !== 'www.usd-impact.com' || deploy.aliasDeploymentId !== deploy.id ||
      milliseconds(deploy.aliasObservedAt) < milliseconds(deploy.readyAt) || milliseconds(deploy.aliasObservedAt) > now) issues.push('CANONICAL_PRODUCTION_ALIAS_NOT_VERIFIED');
  const urls = { article: [`https://www.usd-impact.com/news/${editionDate}/`, `https://www.usd-impact.com/news/${editionDate}`],
    index: ['https://www.usd-impact.com/news/', 'https://www.usd-impact.com/news'],
    latestJson: ['https://www.usd-impact.com/news/latest.json'], rss: ['https://www.usd-impact.com/news/feed.xml'] };
  const types = { article: ['text/html'], index: ['text/html'], latestJson: ['application/json'], rss: ['application/rss+xml', 'application/xml', 'text/xml'] };
  let latestObservation = Math.max(milliseconds(deploy.readyAt), milliseconds(deploy.aliasObservedAt), milliseconds(preview.observedAt));
  for (const key of OUTPUTS) {
    const output = evidence.outputs[key];
    if (!urls[key].includes(output.url) || output.status !== 200 || !types[key].includes(output.contentType) || output.editionDate !== editionDate ||
        output.title.trim() !== output.title || output.title !== evidence.outputs.article.title ||
        milliseconds(output.observedAt) < milliseconds(deploy.readyAt) || milliseconds(output.observedAt) > now ||
        (key === 'latestJson' && output.slug !== `/news/${editionDate}`)) issues.push(`PUBLIC_OUTPUT_NOT_VERIFIED:${key}`);
    latestObservation = Math.max(latestObservation, milliseconds(output.observedAt));
  }
  checkHealthIdentity(health, editionDate, now, issues);
  if (health.completedAt) latestObservation = Math.max(latestObservation, milliseconds(health.completedAt));
  checkHistory(evidence.editorial, source, publisher, pr, latestObservation, now, issues);
  if (recovery) {
    // Provisional origin is not an exemption from publication evidence checks.
    const run = origin?.run ?? null, receipt = origin?.receipt ?? null;
    if (source.actor !== BOT || source.triggeringActor !== BOT ||
        publisher.actor !== BOT || publisher.triggeringActor !== BOT)
      issues.push('RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED');
    // Validate available origin records even when another origin part is absent.
    if (run) {
      checkRun(run, BACKSTOP, issues, 'BACKSTOP', now);
      const scheduledOrigin = origin.kind === 'native-scheduled-backstop';
      if (scheduledOrigin && origin.nominalSlot && milliseconds(run.createdAt) < milliseconds(`${editionDate}T${origin.nominalSlot}:00Z`)) issues.push('BACKSTOP_BEFORE_NOMINAL_SCHEDULE');
      // External wake stays PROVISIONAL; accepting its truthful dispatch event
      // as a record is not machine-origin certification or native acceptance.
      const expectedEvent = scheduledOrigin ? run.event === 'schedule'
        : origin.kind === 'external-wake' ? run.event === 'workflow_dispatch'
        : ['schedule', 'workflow_dispatch'].includes(run.event);
      if (!expectedEvent || run.headSha !== source.headSha || run.createdAt.slice(0, 10) !== editionDate)
        issues.push('RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED');
      if (milliseconds(run.createdAt) > milliseconds(source.createdAt)) issues.push('RECOVERY_ORIGIN_CHRONOLOGY_INVALID');
    }
    if (receipt) {
      if (!run || milliseconds(receipt.recordedAt) < milliseconds(source.createdAt) ||
          milliseconds(receipt.recordedAt) > milliseconds(run?.completedAt)) issues.push('RECOVERY_ORIGIN_CHRONOLOGY_INVALID');
      if (!receipt.authenticated || !receipt.immutable || !receipt.originalAttemptVerified || receipt.repository !== REPOSITORY || receipt.workflowPath !== BACKSTOP ||
          !run || receipt.runId !== run.id || receipt.runAttempt !== 1 || receipt.sourceRunId !== source.id || receipt.sourceRunAttempt !== 1 ||
          !receipt.sourceMetadataVerified || receipt.sourceRunUrl !== `https://github.com/${REPOSITORY}/actions/runs/${source.id}` ||
          receipt.editionDate !== editionDate || receipt.sourceHeadSha !== source.headSha) issues.push('RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND');
    }
    const downstream = publisher.recoveryReceipt, logged = publisher.recoveryLogReceipt;
    if (!downstream || !downstream.authenticated || !downstream.immutable || !downstream.originalAttemptVerified || !downstream.metadataBindingsVerified ||
        downstream.repository !== REPOSITORY || downstream.workflowPath !== PUBLISHER || downstream.runId !== publisher.id || downstream.runAttempt !== 1 ||
        downstream.sourceRunId !== source.id || downstream.sourceRunAttempt !== 1 || downstream.sourceHeadSha !== source.headSha ||
        downstream.prNumber !== pr.number || downstream.prHeadSha !== pr.headSha || downstream.mergeSha !== pr.mergeSha ||
        milliseconds(downstream.recordedAt) < milliseconds(pr.mergedAt) || milliseconds(downstream.recordedAt) > milliseconds(publisher.completedAt))
      issues.push('RECOVERY_PUBLISHER_RECEIPT_NOT_BOUND');
    if (!logged || !logged.authenticated || !logged.immutable || !logged.originalAttemptVerified || !logged.metadataBindingsVerified ||
        logged.repository !== REPOSITORY || logged.workflowPath !== PUBLISHER || logged.runId !== publisher.id || logged.runAttempt !== 1 ||
        logged.sourceRunId !== source.id || logged.sourceRunAttempt !== 1 || logged.sourceHeadSha !== source.headSha ||
        logged.prNumber !== pr.number || logged.prHeadSha !== pr.headSha || logged.mergeSha !== pr.mergeSha ||
        logged.editionDate !== editionDate || logged.editionUrl !== `https://www.usd-impact.com/news/${editionDate}/` ||
        milliseconds(logged.recordedAt) < milliseconds(pr.mergedAt) || milliseconds(logged.recordedAt) > milliseconds(publisher.completedAt))
      issues.push('RECOVERY_PUBLISHER_LOG_NOT_BOUND');
    const recoveryRunIds = [source.id, publisher.id, ...(run ? [run.id] : []), ...(health.id === null ? [] : [health.id])];
    if (new Set(recoveryRunIds).size !== recoveryRunIds.length) issues.push('RECOVERY_RUN_IDS_NOT_DISTINCT');
    const knownNonScheduledSourceIds = [
      ...recoveryRunIds, original.qualityRunId,
      ...CHECKS.map(key => pr.checks[key].workflowRunId),
      ...evidence.editorial.history.publisherRuns.map(row => row.id),
      ...evidence.editorial.history.sourceRuns.filter(row => row.event !== 'schedule').map(row => row.id)
    ];
    checkRecoveryHealth(health, editionDate, knownNonScheduledSourceIds, issues);
    if (provisionalOrigin) {
      return result(issues.length ? 'HOLD' : 'RECOVERY_PROVISIONAL',
        ['RECOVERY_ORIGIN_NOT_CERTIFIED', ...issues], evidence, editionDate);
    }
    return result(issues.length ? 'HOLD' : 'UNATTENDED_RECOVERY_VERIFIED', issues, evidence, editionDate);
  }
  if (source.id === publisher.id || (health.id !== null && [source.id, publisher.id].includes(health.id))) issues.push('RUN_IDS_NOT_DISTINCT');
  if (origin !== null || publisher.recoveryReceipt !== null || publisher.recoveryLogReceipt !== null) issues.push('NATIVE_HAS_RECOVERY_ORIGIN');
  if (['pending', 'unknown'].includes(health.state) && !health.report && health.conclusion === null && !health.completedAt &&
      (health.status === null || ['queued', 'pending', 'waiting', 'requested', 'in_progress'].includes(health.status))) {
    return result(issues.length ? 'HOLD' : 'UNKNOWN', [...issues, 'NATURAL_HEALTH_NOT_YET_VERIFIED'], evidence, editionDate);
  }
  const report = health.report;
  if (health.state !== 'healthy' || health.status !== 'completed' || health.conclusion !== 'success' || !report || report.state !== 'healthy') issues.push('NATURAL_HEALTH_NOT_HEALTHY');
  if (!health.createdAt || !health.completedAt || milliseconds(health.createdAt) < milliseconds(deploy.readyAt) ||
      milliseconds(health.completedAt) < milliseconds(health.createdAt) || milliseconds(health.completedAt) > now) issues.push('HEALTH_CHRONOLOGY_INVALID');
  if (!report || !report.authenticated || !report.immutable || !report.originalAttemptVerified || !report.metadataBindingsVerified || report.runId !== health.id || report.runAttempt !== 1 ||
      report.targetEditionDate !== editionDate || report.sourceRunId !== source.id || report.mergeSha !== pr.mergeSha ||
      milliseconds(report.recordedAt) < milliseconds(health.createdAt) || milliseconds(report.recordedAt) > milliseconds(health.completedAt)) issues.push('HEALTH_ORIGINAL_REPORT_NOT_BOUND');
  if (health.state === 'healthy' || report?.state === 'healthy')
    checkNativeHealthFreshness(health, source, now, issues);
  return result(issues.length ? 'HOLD' : 'NATIVE_AUTO_VERIFIED', issues, evidence, editionDate);
}
