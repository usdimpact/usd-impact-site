// Entirely synthetic. Fake IDs/digests/receipts do not establish live acceptance.
// Phase 1b-B / D6 advisory-only synthetic regression suite; never live certification.
// Fixture: verbatim copy of test-daily-840-phase1a.mjs lines 6-14 and 16-123 at
// 4563f022303ee65198698606845824e4a2dd4f9c; the fixture-sanity cases detect drift.
import assert from 'node:assert/strict';
import { classifyDailyPhase1a } from './daily-840-phase1a-classifier.mjs';

const REPO = 'usdimpact/usd-impact-site';
const BASE = 'a'.repeat(40), HEAD = 'b'.repeat(40), MERGE = 'c'.repeat(40), DIGEST = 'd'.repeat(64);
const BOT = 'github-actions[bot]';
const CHECK_IDENTITIES = {
  webQuality: ['validate-and-build', 'github-actions', '.github/workflows/quality.yml'],
  dependencyReview: ['Dependency review', 'github-actions', '.github/workflows/dependency-review.yml'],
  migrationGuard: ['Reject Development-only Production migration files', 'github-actions', '.github/workflows/supabase-production-intake-guard.yml'],
  codeql: ['CodeQL', 'github-advanced-security', '.github/workflows/codeql.yml']
};
const clone = value => structuredClone(value);
const time = (date, value) => `${date}T${value}Z`;
const offset = (value, seconds) => new Date(Date.parse(value) + seconds * 1000).toISOString();
// Synthetic ORIGINAL Health snapshot and evaluation bounds, not live evidence.
function makeFreshnessEvidence(source, health) {
  return { kind: 'normalized-original-health-freshness-window', authenticated: true,
    immutable: true, originalAttemptVerified: true, metadataBindingsVerified: true,
    sourceTimestampFromOriginalReport: true, evaluationBoundsVerified: true,
    runId: health.id, runAttempt: 1, jobId: health.report.jobId, reportSha256: health.report.sha256,
    sourceRunId: source.id, sourceRunAttempt: 1, sourceCreatedAt: source.createdAt,
    sourceUpdatedAt: source.completedAt, timestampBasis: 'updated_at',
    evaluatedNoEarlierThan: health.createdAt, evaluatedNoLaterThan: health.report.recordedAt,
    maxAgeSeconds: 43_200 };
}
function good(date = '2026-11-17', recovery = false, slot = '10:47') {
  const createdAt = time(date, recovery ? (slot === '10:47' ? '10:48:00' : '11:08:00') : '09:20:00');
  const run = (id, workflowPath, event, start, end) => ({ repository: REPO, id, workflowPath, event,
    branch: 'main', attempt: 1, status: 'completed', conclusion: 'success', headSha: BASE,
    createdAt: start, completedAt: end, actor: recovery ? BOT : 'usdimpact', triggeringActor: recovery ? BOT : 'usdimpact' });
  const source = run(101, '.github/workflows/daily-news.yml', recovery ? 'workflow_dispatch' : 'schedule', createdAt, offset(createdAt, 120));
  source.jobs = Object.fromEntries(['start', 'poll', 'import', 'validate', 'openPr'].map(key => [key, 'success']));
  const publisher = { ...run(102, '.github/workflows/daily-news-auto-publish.yml', recovery ? 'workflow_dispatch' : 'workflow_run', offset(createdAt, recovery ? 100 : 180), offset(createdAt, 360)),
    sourceRunId: 101, sourceRunAttempt: 1, verifiedPrHeadSha: HEAD, prNumber: 104, mergeSha: MERGE, protectedMergeVerified: true,
    recoveryReceipt: recovery ? { kind: 'original-github-job-summary', authenticated: true, immutable: true, originalAttemptVerified: true,
      metadataBindingsVerified: true, repository: REPO, workflowPath: '.github/workflows/daily-news-auto-publish.yml',
      runId: 102, runAttempt: 1, jobId: 304, sha256: DIGEST, recordedAt: offset(createdAt, 350),
      sourceRunId: 101, sourceRunAttempt: 1, sourceHeadSha: BASE, prNumber: 104, prHeadSha: HEAD, mergeSha: MERGE } : null,
    recoveryLogReceipt: recovery ? { kind: 'original-github-job-log', authenticated: true, immutable: true, originalAttemptVerified: true,
      metadataBindingsVerified: true, repository: REPO, workflowPath: '.github/workflows/daily-news-auto-publish.yml',
      runId: 102, runAttempt: 1, jobId: 304, sha256: DIGEST, recordedAt: offset(createdAt, 350),
      sourceRunId: 101, sourceRunAttempt: 1, sourceHeadSha: BASE, editionDate: date, prNumber: 104, prHeadSha: HEAD,
      mergeSha: MERGE, editionUrl: `https://www.usd-impact.com/news/${date}/` } : null };
  const pr = { repository: REPO, number: 104, draft: false, merged: true, authorType: 'Bot', authorLogin: 'usd-impact-daily-pr-author[bot]',
    authorAppSlug: 'usd-impact-daily-pr-author', authorAppVerified: true, mergedBy: BOT, baseBranch: 'main', baseSha: BASE,
    headBranch: `automation/daily-usd-impact-${date}-101`, headSha: HEAD, mergeSha: MERGE, sourceRunId: 101, editionDate: date,
    createdAt: offset(createdAt, 60), mergedAt: offset(createdAt, 240),
    changedFiles: [`apps/web/src/content/news/${date}.md`], changedFilesComplete: true, changedFilesAtHeadSha: HEAD,
    originalHeadSha: HEAD, originalHeadVerified: true,
    originalHeadReceipt: { kind: 'original-source-quality-handoff', authenticated: true, immutable: true, sourceRunId: 101,
      sourceRunAttempt: 1, jobId: 303, sha256: DIGEST, headSha: HEAD, recordedAt: offset(createdAt, 61),
      independentBindingsVerified: true, qualityRunId: 501, qualityRunAttempt: 1, qualityWorkflowPath: '.github/workflows/quality.yml',
      qualityEvent: 'workflow_dispatch', qualityRepository: REPO, qualityHeadSha: HEAD, qualityHeadBranch: `automation/daily-usd-impact-${date}-101` },
    preview: { provider: 'vercel', projectId: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7', projectName: 'usd-impact-site', repository: REPO,
      deploymentId: 'dpl_previewSynthetic', target: 'preview', state: 'READY', headSha: HEAD, gitRef: `automation/daily-usd-impact-${date}-101`,
      createdAt: offset(createdAt, 50), readyAt: offset(createdAt, 200), observedAt: offset(createdAt, 220),
      proofKind: 'authenticated-vercel-deployment-metadata', authenticated: true, readyTimestampVerified: true },
    checks: Object.fromEntries(['webQuality', 'dependencyReview', 'migrationGuard', 'codeql'].map((key, index) =>
      [key, { id: 201 + index, name: CHECK_IDENTITIES[key][0], appSlug: CHECK_IDENTITIES[key][1], workflowPath: CHECK_IDENTITIES[key][2],
        status: 'completed', conclusion: 'success', headSha: HEAD, completedAt: offset(createdAt, 210),
        workflowRunId: 401 + index, workflowEvent: 'pull_request', workflowRunAttempt: 1, workflowHeadSha: HEAD,
        workflowRepository: REPO, prNumber: 104, workflowProvenanceVerified: true }])) };
  const outputs = Object.fromEntries(Object.entries({ article: `https://www.usd-impact.com/news/${date}/`, index: 'https://www.usd-impact.com/news/',
    latestJson: 'https://www.usd-impact.com/news/latest.json', rss: 'https://www.usd-impact.com/news/feed.xml' }).map(([key, url]) =>
    [key, { url, status: 200, contentType: key === 'latestJson' ? 'application/json' : key === 'rss' ? 'application/rss+xml' : 'text/html',
      editionDate: date, title: 'Synthetic Daily example', observedAt: time(date, '19:00:00'), slug: key === 'latestJson' ? `/news/${date}` : null }]));
  const healthRun = recovery ? { state: 'pending', targetEditionDate: date } : {
    ...run(103, '.github/workflows/daily-news-health.yml', 'schedule', time(date, '18:55:00'), time(date, '18:56:00')),
    state: 'healthy', targetEditionDate: date, headSha: MERGE,
    report: { kind: 'original-github-job-log', authenticated: true, immutable: true, originalAttemptVerified: true,
      metadataBindingsVerified: true, runId: 103, runAttempt: 1, jobId: 301, sha256: DIGEST, state: 'healthy', targetEditionDate: date,
      sourceRunId: 101, mergeSha: MERGE, recordedAt: time(date, '18:55:30') } };
  const editorial = { editionDate: date, distinctPrimarySources: 3, rightsCleared: true, singlePaidGeneration: true,
    history: { repository: REPO, editionDate: date, observedAt: time(date, '19:01:00'),
      sourceRunsComplete: true, publisherRunsComplete: true, prsComplete: true, paginationComplete: true, allRelevantRunOutcomesVerified: true,
      sourceRuns: [{ id: 101, attempt: 1, event: source.event, headSha: BASE, generationStarted: true,
        status: 'completed', conclusion: 'success', createdAt: source.createdAt, completedAt: source.completedAt, noOpVerified: false }],
      publisherRuns: [{ id: 102, attempt: 1, event: publisher.event, sourceRunId: 101, merged: true, mergeSha: MERGE,
        status: 'completed', conclusion: 'success', createdAt: publisher.createdAt, completedAt: publisher.completedAt, noOpVerified: false }],
      prs: [{ number: 104, sourceRunId: 101, headSha: HEAD, merged: true }] },
    budget: { sourceRunId: 101, editionDate: date, ledgerComplete: true, approvedMaxGenerations: 1, observedGenerations: 1,
      approvedLimitUsd: 0.02, spentUsd: 0.01, observedAt: time(date, '19:01:00') } };
  const recoveryOrigin = recovery ? { kind: 'native-scheduled-backstop', nominalSlot: slot,
    run: run(105, '.github/workflows/daily-news-schedule-backstop.yml', 'schedule', time(date, `${slot}:10`), offset(createdAt, 20)),
    receipt: { kind: 'original-github-job-summary', authenticated: true, immutable: true, originalAttemptVerified: true,
      repository: REPO, workflowPath: '.github/workflows/daily-news-schedule-backstop.yml', runId: 105, runAttempt: 1,
      jobId: 302, sha256: DIGEST, recordedAt: offset(createdAt, 10), sourceRunUrl: `https://github.com/${REPO}/actions/runs/101`,
      sourceRunId: 101, sourceRunAttempt: 1, sourceHeadSha: BASE, sourceMetadataVerified: true, editionDate: date } } : null;
  // SYNTHETIC authority/ledger/receipt; none is evidence of actual provider spend.
  publisher.originalVerification = {
    kind: 'original-publisher-four-output-verification', artifactKind: 'original-github-job-log',
    authenticated: true, immutable: true, originalAttemptVerified: true, metadataBindingsVerified: true,
    verifierContractVerified: true, repository: REPO, workflowPath: '.github/workflows/daily-news-auto-publish.yml',
    runId: 102, runAttempt: 1, jobId: 304, sha256: DIGEST, recordedAt: offset(createdAt, 350),
    editionDate: date, editionUrl: `https://www.usd-impact.com/news/${date}/`,
    sourceRunId: 101, sourceRunAttempt: 1, sourceHeadSha: BASE, prNumber: 104, prHeadSha: HEAD,
    mergeSha: MERGE, deploymentId: 'dpl_synthetic', verifierSourceSha: BASE,
    checkedOutputs: ['article', 'index', 'latestJson', 'rss']
  };
  if (recovery) publisher.recoveryReceipt.sha256 = 'e'.repeat(64);
  editorial.budget.requestAccounting = {
    kind: 'authenticated-edition-request-ledger', repository: REPO, editionDate: date,
    authenticated: true, immutable: true, scope: 'entire-edition-all-generation-requests',
    complete: true, paginationComplete: true, allSubmissionAttemptsIncluded: true,
    sha256: 'f'.repeat(64), observedAt: time(date, '19:01:00'),
    authorization: { kind: 'independently-verified-existing-budget', reference: 'SYNTHETIC-OWNER-BUDGET',
      sha256: 'e'.repeat(64), independentlyVerified: true, editionDate: date, currency: 'USD',
      maxGenerationRequests: 1, limitUsd: 0.02 },
    requests: [{ clientRequestId: 'synthetic-create-1', providerRequestId: 'synthetic-provider-1',
      operation: 'generation-create', method: 'POST', sourceRunId: 101, sourceRunAttempt: 1,
      sourceHeadSha: BASE, editionDate: date, submittedAt: offset(createdAt, 10),
      authenticated: true, originalAttemptVerified: true, billingState: 'settled', chargedMicrousd: 10_000 }]
  };
  if (!recovery) healthRun.freshness = makeFreshnessEvidence(source, healthRun);
  return { editionDate: date, now: time(date, '23:59:00'), evidence: { sourceRun: source, publisher, pr,
    deployment: { repository: REPO, projectId: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7', id: 'dpl_synthetic', target: 'production', state: 'READY', sha: MERGE, readyAt: offset(createdAt, 300),
      canonicalAlias: 'www.usd-impact.com', aliasDeploymentId: 'dpl_synthetic', aliasObservedAt: time(date, '19:00:00') },
    outputs, healthRun, editorial, recoveryOrigin } };
}

// ---- D6 regressions (advisory-only synthetic; must pass on the exact Phase 1a head) ----
const d6 = { fixtureSanity: 0, nativePublisherNotSuccess: 0, publisherInvalidOrAbsent: 0,
  recoveryPublisherNotSuccess: 0, publisherNotCompleted: 0, provisionalPublisherNotSuccess: 0 };
const NOT_SUCCESS = ['skipped', 'failure', 'cancelled', 'timed_out', 'neutral', 'action_required', 'stale', null];
function held(label, input, ...codes) {
  const r = classifyDailyPhase1a(input);
  assert.equal(r.evidenceClass, 'HOLD', `${label}: ${JSON.stringify(r.issues)}`);
  for (const code of codes) assert.ok(r.issues.includes(code), `${label}: missing ${code} in ${JSON.stringify(r.issues)}`);
  assert.equal(r.accepted, false, label); assert.equal(r.nativeAcceptance, false, label);
  assert.equal(r.nativeHealthy, false, label); assert.equal(r.reportVerified, false, label);
  assert.equal(r.recoveryVerified, false, label); assert.equal(r.mayCloseIncident, false, label);
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.issues), label);
  return r;
}
function setPublisher(x, fields) {
  Object.assign(x.evidence.publisher, fields);
  // Keep the complete-history record consistent so only the publisher outcome differs.
  for (const key of ['status', 'conclusion']) if (key in fields) x.evidence.editorial.history.publisherRuns[0][key] = fields[key];
  return x;
}
// Fixture sanity: the copied fixture still matches the classifier contract (drift detector).
{ const r = classifyDailyPhase1a(good()); assert.equal(r.evidenceClass, 'NATIVE_AUTO_VERIFIED', JSON.stringify(r.issues)); d6.fixtureSanity++; }
{ const r = classifyDailyPhase1a(good('2026-11-17', true));
  assert.notEqual(r.evidenceClass, 'NATIVE_AUTO_VERIFIED'); assert.equal(r.accepted, false); assert.equal(r.nativeHealthy, false);
  assert.equal(r.mayCloseIncident, false); d6.fixtureSanity++; }
// I-8 / SC-02: a completed publisher that did not succeed can never certify native acceptance.
for (const conclusion of NOT_SUCCESS) {
  held(`native publisher ${conclusion} (history consistent)`, setPublisher(good(), { conclusion }), 'PUBLISHER_NOT_SUCCESS');
  d6.nativePublisherNotSuccess++;
  const x = good(); x.evidence.publisher.conclusion = conclusion;
  held(`native publisher ${conclusion} (history contradicts)`, x, 'PUBLISHER_NOT_SUCCESS');
  d6.nativePublisherNotSuccess++;
}
// Unknown or absent publisher records fail closed as invalid evidence.
held('publisher startup_failure is not a supported success', setPublisher(good(), { conclusion: 'startup_failure' }), 'EVIDENCE_INVALID:publisher');
d6.publisherInvalidOrAbsent++;
{ const x = good(); x.evidence.publisher = null; held('publisher record null', x, 'EVIDENCE_INVALID:publisher'); d6.publisherInvalidOrAbsent++; }
{ const x = good(); delete x.evidence.publisher; held('publisher record absent', x, 'EVIDENCE_INVALID:publisher'); d6.publisherInvalidOrAbsent++; }
// Recovery never upgrades a non-successful publisher (no native, no recovery verification).
for (const conclusion of NOT_SUCCESS) {
  held(`recovery publisher ${conclusion}`, setPublisher(good('2026-11-17', true), { conclusion }), 'PUBLISHER_NOT_SUCCESS');
  d6.recoveryPublisherNotSuccess++;
}
// A publisher that has not completed is never success.
for (const status of ['queued', 'waiting', 'pending', 'requested', 'in_progress']) {
  held(`native publisher status ${status}`, setPublisher(good(), { status, conclusion: null }), 'PUBLISHER_NOT_SUCCESS');
  d6.publisherNotCompleted++;
}
// Provisional origins (external wake, human correlation) do not mask a skipped publisher.
for (const kind of ['external-wake', 'human-correlation']) {
  const x = setPublisher(good('2026-11-17', true), { conclusion: 'skipped' });
  x.evidence.recoveryOrigin.kind = kind;
  if (kind === 'external-wake') { x.evidence.recoveryOrigin.nominalSlot = null; x.evidence.recoveryOrigin.run.event = 'workflow_dispatch'; }
  held(`${kind} with skipped publisher`, x, 'PUBLISHER_NOT_SUCCESS', 'RECOVERY_ORIGIN_NOT_CERTIFIED');
  d6.provisionalPublisherNotSuccess++;
}
console.log('DEC026 Phase1b-D6 REGRESSION PASS ' + JSON.stringify({ ...d6,
  totalCases: Object.values(d6).reduce((sum, count) => sum + count, 0) }) + '; synthetic only; no external I/O.');
