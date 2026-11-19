// Entirely synthetic. Fake IDs/digests/receipts do not establish live acceptance.
import assert from 'node:assert/strict';
import { classifyDailyPhase1a, validUtc } from './daily-840-phase1a-classifier.mjs';
import { collectDailyPhase1a } from './daily-840-phase1a-collector.mjs';

const REPO = 'usdimpact/usd-impact-site';
const BASE = 'a'.repeat(40), HEAD = 'b'.repeat(40), MERGE = 'c'.repeat(40), DIGEST = 'd'.repeat(64);
const BOT = 'github-actions[bot]';
const CHECK_IDENTITIES = {
  webQuality: ['validate-and-build', 'github-actions', '.github/workflows/quality.yml'],
  dependencyReview: ['Dependency review', 'github-actions', '.github/workflows/dependency-review.yml'],
  migrationGuard: ['Reject Development-only Production migration files', 'github-actions', '.github/workflows/supabase-production-intake-guard.yml'],
  codeql: ['CodeQL', 'github-advanced-security', '.github/workflows/codeql.yml']
};
const counts = { nativePositive: 0, recoveryPositive: 0, negative: 0, provisional: 0, pending: 0, collector: 0 };
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
function invariant(result) {
  assert.equal(result.mayCloseIncident, false);
  assert.equal(result.sourceAccess, 'NOT_INDEPENDENTLY_VERIFIED_BY_CLASSIFIER');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.issues));
  if (result.evidenceClass !== 'NATIVE_AUTO_VERIFIED') {
    assert.equal(result.accepted, false); assert.equal(result.nativeAcceptance, false); assert.equal(result.nativeHealthy, false);
  }
}
function positive(input, recovery = false, countCase = true) {
  const result = classifyDailyPhase1a(input); invariant(result);
  assert.deepEqual(result.issues, [], JSON.stringify(result));
  assert.equal(result.evidenceClass, recovery ? 'UNATTENDED_RECOVERY_VERIFIED' : 'NATIVE_AUTO_VERIFIED');
  assert.equal(result.reportVerified, true);
  assert.equal(result.recoveryVerified, recovery);
  assert.equal(result.accepted, !recovery);
  assert.equal(result.latency.native === null, recovery);
  assert.equal(result.latency.recovery === null, !recovery);
  if (recovery) assert.equal(result.nativeHealth.verified, false);
  if (countCase) counts[recovery ? 'recoveryPositive' : 'nativePositive']++;
}
function reject(label, input, expectedIssue) {
  const result = classifyDailyPhase1a(input); invariant(result);
  assert.equal(result.reportVerified, false, label);
  assert.equal(result.evidenceClass, 'HOLD', label + ': ' + JSON.stringify(result));
  assert.ok(result.issues.includes(expectedIssue), label + ': ' + JSON.stringify(result.issues));
  counts.negative++;
}
function caseOf(label, mutate, issue, recovery = false) {
  const input = good('2026-11-17', recovery); mutate(input); reject(label, input, issue);
}
positive(good());
positive(good('2026-07-13'));
const midnight = good(); midnight.now = '2026-11-18T00:30:00Z'; positive(midnight);
const actorFree = good(); delete actorFree.evidence.sourceRun.actor; delete actorFree.evidence.sourceRun.triggeringActor; positive(actorFree);
const canonical = good(); canonical.evidence.outputs.article.url = canonical.evidence.outputs.article.url.slice(0, -1); canonical.evidence.outputs.index.url = canonical.evidence.outputs.index.url.slice(0, -1); positive(canonical);
const extraNoop = good(); extraNoop.evidence.editorial.history.sourceRuns.push({ id: 106, attempt: 1, event: 'schedule', headSha: BASE, generationStarted: false,
  status: 'completed', conclusion: 'skipped', createdAt: '2026-11-17T10:00:00Z', completedAt: '2026-11-17T10:00:10Z', noOpVerified: true }); positive(extraNoop);
const codeqlAction = good(); codeqlAction.evidence.pr.checks.codeql.name = 'CodeQL (javascript-typescript)'; codeqlAction.evidence.pr.checks.codeql.appSlug = 'github-actions'; positive(codeqlAction);
const retrospectivePreview = good(); retrospectivePreview.evidence.pr.preview.observedAt = '2026-11-17T19:00:00Z'; positive(retrospectivePreview);
const delayedHealth = good();
delayedHealth.evidence.healthRun.createdAt = '2026-11-18T00:03:00Z'; delayedHealth.evidence.healthRun.completedAt = '2026-11-18T00:04:00Z';
delayedHealth.evidence.healthRun.report.recordedAt = '2026-11-18T00:03:30Z';
delayedHealth.evidence.editorial.history.observedAt = '2026-11-18T00:05:00Z'; delayedHealth.evidence.editorial.budget.observedAt = '2026-11-18T00:05:00Z';
delayedHealth.evidence.editorial.budget.requestAccounting.observedAt = '2026-11-18T00:05:00Z';
delayedHealth.now = '2026-11-18T00:30:00Z';
// This timeline exceeds the unchanged live Health 12-hour freshness limit.
// A genuine such run cannot supply a healthy report under current live policy.
delayedHealth.evidence.healthRun.state = 'unhealthy';
delayedHealth.evidence.healthRun.conclusion = 'failure';
delayedHealth.evidence.healthRun.report = null;
reject('late Health freshness failure cannot certify native acceptance', delayedHealth, 'NATURAL_HEALTH_NOT_HEALTHY');
const sourceAtNominal = good(); sourceAtNominal.evidence.sourceRun.createdAt = '2026-11-17T09:17:00Z';
sourceAtNominal.evidence.editorial.history.sourceRuns[0].createdAt = sourceAtNominal.evidence.sourceRun.createdAt;
sourceAtNominal.evidence.healthRun.freshness = makeFreshnessEvidence(sourceAtNominal.evidence.sourceRun, sourceAtNominal.evidence.healthRun); positive(sourceAtNominal);
const healthAtNominal = good(); healthAtNominal.evidence.healthRun.createdAt = '2026-11-17T18:45:00Z';
healthAtNominal.evidence.healthRun.completedAt = '2026-11-17T18:46:00Z'; healthAtNominal.evidence.healthRun.report.recordedAt = '2026-11-17T18:45:30Z';
healthAtNominal.evidence.healthRun.freshness = makeFreshnessEvidence(healthAtNominal.evidence.sourceRun, healthAtNominal.evidence.healthRun); positive(healthAtNominal);
reject('weekday cron cannot certify Saturday', good('2026-11-14'), 'EDITION_OUTSIDE_WEEKDAY_SCHEDULE');
reject('weekday cron cannot certify Sunday', good('2026-11-15'), 'EDITION_OUTSIDE_WEEKDAY_SCHEDULE');
reject('recovery weekday cron cannot certify Saturday', good('2026-11-14', true), 'EDITION_OUTSIDE_WEEKDAY_SCHEDULE');

// Coherent dates on either side of both 2026 DST transitions; exact issue checks.
for (const [date, cutoff] of [['2026-03-06', '13:30:00'], ['2026-03-09', '12:30:00'], ['2026-10-30', '12:30:00'], ['2026-11-02', '13:30:00'], ['2026-07-13', '12:30:00'], ['2026-11-17', '13:30:00']]) {
  const before = good(date), boundary = time(date, cutoff);
  before.evidence.pr.mergedAt = offset(boundary, -1);
  before.evidence.publisher.completedAt = offset(boundary, 1);
  before.evidence.editorial.history.publisherRuns[0].completedAt = before.evidence.publisher.completedAt;
  before.evidence.deployment.readyAt = offset(boundary, -1);
  before.evidence.publisher.originalVerification.recordedAt = offset(boundary, -1);
  positive(before);
  const equalMerge = clone(before); equalMerge.evidence.pr.mergedAt = boundary;
  reject('exact merge cutoff ' + date, equalMerge, 'MERGE_AFTER_0830_ET_CUTOFF');
  const beforeSource = clone(before);
  for (const [object, fields] of [[beforeSource.evidence.sourceRun, ['createdAt', 'completedAt']], [beforeSource.evidence.publisher, ['createdAt']], [beforeSource.evidence.pr, ['createdAt', 'mergedAt']]])
    for (const field of fields) object[field] = offset(boundary, -1);
  for (const check of Object.values(beforeSource.evidence.pr.checks)) check.completedAt = offset(boundary, -1);
  beforeSource.evidence.pr.originalHeadReceipt.recordedAt = offset(boundary, -1);
  for (const field of ['createdAt', 'readyAt', 'observedAt']) beforeSource.evidence.pr.preview[field] = offset(boundary, -1);
  beforeSource.evidence.editorial.budget.requestAccounting.requests[0].submittedAt = offset(boundary, -1);
  beforeSource.evidence.editorial.history.sourceRuns[0].createdAt = beforeSource.evidence.sourceRun.createdAt;
  beforeSource.evidence.editorial.history.sourceRuns[0].completedAt = beforeSource.evidence.sourceRun.completedAt;
  beforeSource.evidence.editorial.history.publisherRuns[0].createdAt = beforeSource.evidence.publisher.createdAt;
  beforeSource.evidence.healthRun.freshness = makeFreshnessEvidence(beforeSource.evidence.sourceRun, beforeSource.evidence.healthRun);
  positive(beforeSource);
  const equalSource = clone(beforeSource);
  equalSource.evidence.sourceRun.createdAt = boundary;
  reject('exact source cutoff ' + date, equalSource, 'SOURCE_AFTER_0830_ET_CUTOFF');
}

for (const [label, mutate, issue] of [
  ['source wrong repo', x => x.evidence.sourceRun.repository = 'other/repo', 'SOURCE_IDENTITY_INVALID'],
  ['source wrong workflow', x => x.evidence.sourceRun.workflowPath = '.github/workflows/quality.yml', 'SOURCE_IDENTITY_INVALID'],
  ['source wrong branch', x => x.evidence.sourceRun.branch = 'agent/test', 'SOURCE_IDENTITY_INVALID'],
  ['source rerun', x => x.evidence.sourceRun.attempt = 2, 'SOURCE_NOT_ORIGINAL_ATTEMPT'],
  ['source failed', x => x.evidence.sourceRun.conclusion = 'failure', 'SOURCE_NOT_SUCCESS'],
  ['source in progress', x => x.evidence.sourceRun.status = 'in_progress', 'SOURCE_NOT_SUCCESS'],
  ['source future', x => x.now = '2026-11-17T09:19:00Z', 'SOURCE_TIME_INVALID'],
  ['source previous date', x => x.evidence.sourceRun.createdAt = '2026-11-16T09:20:00Z', 'SOURCE_EDITION_DATE_MISMATCH'],
  ['source UTC date but previous NY date', x => x.evidence.sourceRun.createdAt = '2026-11-17T00:20:00Z', 'SOURCE_EDITION_DATE_MISMATCH'],
  ['source completion reversed', x => x.evidence.sourceRun.completedAt = '2026-11-17T09:19:00Z', 'SOURCE_TIME_INVALID'],
  ['publisher wrong workflow', x => x.evidence.publisher.workflowPath = '.github/workflows/quality.yml', 'PUBLISHER_IDENTITY_INVALID'],
  ['publisher wrong repo', x => x.evidence.publisher.repository = 'other/repo', 'PUBLISHER_IDENTITY_INVALID'],
  ['publisher wrong branch', x => x.evidence.publisher.branch = 'agent/test', 'PUBLISHER_IDENTITY_INVALID'],
  ['publisher in progress', x => x.evidence.publisher.status = 'in_progress', 'PUBLISHER_NOT_SUCCESS'],
  ['publisher rerun', x => x.evidence.publisher.attempt = 2, 'PUBLISHER_NOT_ORIGINAL_ATTEMPT'],
  ['publisher wrong event', x => x.evidence.publisher.event = 'workflow_dispatch', 'PUBLISHER_LINEAGE_NOT_VERIFIED'],
  ['publisher wrong source', x => x.evidence.publisher.sourceRunId = 999, 'PUBLISHER_LINEAGE_NOT_VERIFIED'],
  ['publisher wrong source attempt', x => x.evidence.publisher.sourceRunAttempt = 2, 'PUBLISHER_LINEAGE_NOT_VERIFIED'],
  ['publisher wrong original SHA', x => x.evidence.publisher.headSha = HEAD, 'PUBLISHER_LINEAGE_NOT_VERIFIED'],
  ['publisher unprotected merge', x => x.evidence.publisher.protectedMergeVerified = false, 'PUBLISHER_LINEAGE_NOT_VERIFIED'],
  ['publisher wrong PR head', x => x.evidence.publisher.verifiedPrHeadSha = BASE, 'PUBLISHER_LINEAGE_NOT_VERIFIED'],
  ['publisher wrong merge', x => x.evidence.publisher.mergeSha = BASE, 'PUBLISHER_LINEAGE_NOT_VERIFIED'],
  ['publisher before source complete', x => x.evidence.publisher.createdAt = '2026-11-17T09:21:59Z', 'PUBLICATION_CHRONOLOGY_INVALID'],
  ['merge before source', x => x.evidence.pr.mergedAt = '2026-11-16T09:24:00Z', 'PUBLICATION_CHRONOLOGY_INVALID'],
  ['merge before publisher', x => x.evidence.pr.mergedAt = '2026-11-17T09:22:59Z', 'PUBLICATION_CHRONOLOGY_INVALID'],
  ['merge after publisher complete', x => x.evidence.pr.mergedAt = '2026-11-17T09:26:01Z', 'PUBLICATION_CHRONOLOGY_INVALID'],
  ['production before merge', x => x.evidence.deployment.readyAt = '2026-11-17T09:23:59Z', 'PUBLICATION_CHRONOLOGY_INVALID'],
  ['PR draft', x => x.evidence.pr.draft = true, 'PR_PROTECTED_LINEAGE_NOT_VERIFIED'],
  ['PR unmerged', x => x.evidence.pr.merged = false, 'PR_PROTECTED_LINEAGE_NOT_VERIFIED'],
  ['PR wrong author', x => x.evidence.pr.authorLogin = 'other-app[bot]', 'PR_PROTECTED_LINEAGE_NOT_VERIFIED'],
  ['PR fictional App type', x => x.evidence.pr.authorType = 'App', 'PR_PROTECTED_LINEAGE_NOT_VERIFIED'],
  ['PR App unverified', x => x.evidence.pr.authorAppVerified = false, 'PR_PROTECTED_LINEAGE_NOT_VERIFIED'],
  ['PR wrong merger', x => x.evidence.pr.mergedBy = 'usdimpact', 'PR_PROTECTED_LINEAGE_NOT_VERIFIED'],
  ['PR wrong branch', x => x.evidence.pr.headBranch = 'agent/test', 'PR_PROTECTED_LINEAGE_NOT_VERIFIED'],
  ['PR wrong base', x => x.evidence.pr.baseBranch = 'other', 'PR_PROTECTED_LINEAGE_NOT_VERIFIED'],
  ['PR wrong base SHA', x => x.evidence.pr.baseSha = HEAD, 'PR_PROTECTED_LINEAGE_NOT_VERIFIED'],
  ['PR wrong source', x => x.evidence.pr.sourceRunId = 999, 'PR_PROTECTED_LINEAGE_NOT_VERIFIED'],
  ['duplicate check ID', x => x.evidence.pr.checks.webQuality.id = x.evidence.pr.checks.codeql.id, 'CHECK_IDS_NOT_DISTINCT'],
  ['production preview', x => x.evidence.deployment.target = 'preview', 'PRODUCTION_SHA_NOT_READY'],
  ['production building', x => x.evidence.deployment.state = 'BUILDING', 'PRODUCTION_SHA_NOT_READY'],
  ['production wrong SHA', x => x.evidence.deployment.sha = HEAD, 'PRODUCTION_SHA_NOT_READY'],
  ['rights not cleared', x => x.evidence.editorial.rightsCleared = false, 'EDITORIAL_OR_RIGHTS_NOT_VERIFIED'],
  ['too few primary sources', x => x.evidence.editorial.distinctPrimarySources = 2, 'EDITORIAL_OR_RIGHTS_NOT_VERIFIED'],
  ['generation claim false', x => x.evidence.editorial.singlePaidGeneration = false, 'COMPLETE_HISTORY_NOT_VERIFIED'],
  ['incomplete pagination', x => x.evidence.editorial.history.paginationComplete = false, 'COMPLETE_HISTORY_NOT_VERIFIED'],
  ['incomplete run history', x => x.evidence.editorial.history.sourceRunsComplete = false, 'COMPLETE_HISTORY_NOT_VERIFIED'],
  ['history stale', x => x.evidence.editorial.history.observedAt = '2026-11-17T18:59:00Z', 'HISTORY_OBSERVATION_STALE'],
  ['history future', x => x.evidence.editorial.history.observedAt = '2026-11-18T00:00:00Z', 'HISTORY_OBSERVATION_STALE'],
  ['extra generation', x => x.evidence.editorial.history.sourceRuns.push({ ...x.evidence.editorial.history.sourceRuns[0], id: 999 }), 'DUPLICATE_OR_UNBOUND_GENERATION'],
  ['duplicate source record', x => x.evidence.editorial.history.sourceRuns.push(clone(x.evidence.editorial.history.sourceRuns[0])), 'DUPLICATE_OR_UNBOUND_GENERATION'],
  ['extra merge', x => x.evidence.editorial.history.publisherRuns.push({ ...x.evidence.editorial.history.publisherRuns[0], id: 999 }), 'DUPLICATE_OR_UNBOUND_PUBLISHER'],
  ['extra PR', x => x.evidence.editorial.history.prs.push({ ...x.evidence.editorial.history.prs[0], number: 999 }), 'DUPLICATE_OR_UNBOUND_PR'],
  ['budget incomplete', x => x.evidence.editorial.budget.ledgerComplete = false, 'BUDGET_OR_SINGLE_GENERATION_NOT_VERIFIED'],
  ['budget two generations', x => x.evidence.editorial.budget.observedGenerations = 2, 'BUDGET_OR_SINGLE_GENERATION_NOT_VERIFIED'],
  ['budget exceeded', x => x.evidence.editorial.budget.spentUsd = 0.03, 'BUDGET_OR_SINGLE_GENERATION_NOT_VERIFIED'],
  ['budget stale', x => x.evidence.editorial.budget.observedAt = '2026-11-17T18:00:00Z', 'BUDGET_OR_SINGLE_GENERATION_NOT_VERIFIED'],
  ['health wrong workflow', x => x.evidence.healthRun.workflowPath = '.github/workflows/quality.yml', 'HEALTH_IDENTITY_INVALID'],
  ['health wrong branch', x => x.evidence.healthRun.branch = 'agent/test', 'HEALTH_IDENTITY_INVALID'],
  ['health manual', x => x.evidence.healthRun.event = 'workflow_dispatch', 'HEALTH_IDENTITY_INVALID'],
  ['health rerun', x => x.evidence.healthRun.attempt = 2, 'HEALTH_IDENTITY_INVALID'],
  ['health missing run SHA', x => delete x.evidence.healthRun.headSha, 'HEALTH_IDENTITY_INVALID'],
  ['health before deployment', x => x.evidence.deployment.readyAt = '2026-11-17T18:55:01Z', 'HEALTH_CHRONOLOGY_INVALID'],
  ['health failed', x => x.evidence.healthRun.conclusion = 'failure', 'NATURAL_HEALTH_NOT_HEALTHY'],
  ['health false green report', x => x.evidence.healthRun.report.state = 'unhealthy', 'NATURAL_HEALTH_NOT_HEALTHY'],
  ['health wrong original run', x => x.evidence.healthRun.report.runId = 999, 'HEALTH_ORIGINAL_REPORT_NOT_BOUND'],
  ['health wrong original attempt', x => x.evidence.healthRun.report.runAttempt = 2, 'HEALTH_ORIGINAL_REPORT_NOT_BOUND'],
  ['health wrong source', x => x.evidence.healthRun.report.sourceRunId = 999, 'HEALTH_ORIGINAL_REPORT_NOT_BOUND'],
  ['health wrong SHA', x => x.evidence.healthRun.report.mergeSha = HEAD, 'HEALTH_ORIGINAL_REPORT_NOT_BOUND'],
  ['health unauthenticated report', x => x.evidence.healthRun.report.authenticated = false, 'HEALTH_ORIGINAL_REPORT_NOT_BOUND'],
  ['health wrong report date', x => x.evidence.healthRun.report.targetEditionDate = '2026-11-16', 'HEALTH_ORIGINAL_REPORT_NOT_BOUND'],
  ['collection error', x => x.errors = ['READER_FAILED:healthRun'], 'COLLECTION_ERROR']
]) caseOf(label, mutate, issue);
for (const job of ['start', 'poll', 'import', 'validate', 'openPr']) caseOf(job + ' skipped', x => x.evidence.sourceRun.jobs[job] = 'skipped', `SOURCE_JOB_NOT_SUCCESS:${job}`);
for (const key of ['webQuality', 'dependencyReview', 'migrationGuard', 'codeql']) {
  caseOf(key + ' wrong SHA', x => x.evidence.pr.checks[key].headSha = BASE, `EXACT_HEAD_CHECK_NOT_VERIFIED:${key}`);
  caseOf(key + ' skipped', x => x.evidence.pr.checks[key].conclusion = 'skipped', `EXACT_HEAD_CHECK_NOT_VERIFIED:${key}`);
}
for (const key of ['article', 'index', 'latestJson', 'rss']) {
  for (const [field, value] of [['status', 404], ['url', 'https://example.invalid/'], ['editionDate', '2026-11-16'], ['observedAt', '2026-11-17T09:24:59Z'], ['title', 'Different synthetic title']])
    caseOf(key + ':' + field, x => x.evidence.outputs[key][field] = value, `PUBLIC_OUTPUT_NOT_VERIFIED:${field === 'title' && key === 'article' ? 'index' : key}`);
}
caseOf('JSON slug wrong', x => x.evidence.outputs.latestJson.slug += '/', 'PUBLIC_OUTPUT_NOT_VERIFIED:latestJson');
caseOf('title whitespace', x => x.evidence.outputs.article.title = '  ', 'PUBLIC_OUTPUT_NOT_VERIFIED:article');
caseOf('source before nominal 09:17', x => { x.evidence.sourceRun.createdAt = '2026-11-17T09:16:59Z'; x.evidence.editorial.history.sourceRuns[0].createdAt = x.evidence.sourceRun.createdAt; }, 'SOURCE_BEFORE_NOMINAL_SCHEDULE');
caseOf('Health at 10:00 before nominal 18:45', x => { x.evidence.healthRun.createdAt = '2026-11-17T10:00:00Z'; x.evidence.healthRun.completedAt = '2026-11-17T10:01:00Z'; x.evidence.healthRun.report.recordedAt = '2026-11-17T10:00:30Z'; }, 'HEALTH_BEFORE_NOMINAL_SCHEDULE');
for (const key of ['webQuality', 'dependencyReview', 'migrationGuard', 'codeql']) {
  for (const [field, value] of [['name', 'Untrusted check'], ['appSlug', 'untrusted-app'], ['workflowPath', '.github/workflows/manual.yml'],
    ['workflowEvent', 'push'], ['workflowRunAttempt', 2], ['workflowHeadSha', BASE], ['workflowRepository', 'other/repo'], ['prNumber', 999], ['workflowProvenanceVerified', false]])
    caseOf('check provenance ' + key + ':' + field, x => x.evidence.pr.checks[key][field] = value, `EXACT_HEAD_CHECK_NOT_VERIFIED:${key}`);
}
caseOf('duplicate check workflow run IDs', x => x.evidence.pr.checks.webQuality.workflowRunId = x.evidence.pr.checks.codeql.workflowRunId, 'CHECK_WORKFLOW_RUN_IDS_NOT_DISTINCT');
caseOf('PR check cannot reuse source workflow run', x => x.evidence.pr.checks.webQuality.workflowRunId = x.evidence.sourceRun.id, 'EXACT_HEAD_CHECK_NOT_VERIFIED:webQuality');
caseOf('unexpected second changed PR file', x => x.evidence.pr.changedFiles.push('apps/web/api/commerce.js'), 'PR_NOT_ORIGINAL_ONE_FILE_EDITION');
caseOf('wrong edition PR file', x => x.evidence.pr.changedFiles = ['apps/web/src/content/news/2026-11-16.md'], 'PR_NOT_ORIGINAL_ONE_FILE_EDITION');
caseOf('incomplete changed file pagination', x => x.evidence.pr.changedFilesComplete = false, 'PR_NOT_ORIGINAL_ONE_FILE_EDITION');
caseOf('changed file list at wrong SHA', x => x.evidence.pr.changedFilesAtHeadSha = BASE, 'PR_NOT_ORIGINAL_ONE_FILE_EDITION');
caseOf('original head was changed', x => x.evidence.pr.originalHeadSha = BASE, 'PR_ORIGINAL_HEAD_NOT_VERIFIED');
caseOf('original head unverified', x => x.evidence.pr.originalHeadVerified = false, 'PR_ORIGINAL_HEAD_NOT_VERIFIED');
for (const [field, value] of [['authenticated', false], ['immutable', false], ['sourceRunId', 999], ['sourceRunAttempt', 2], ['headSha', BASE], ['recordedAt', '2026-11-17T09:22:01Z']])
  caseOf('original head receipt:' + field, x => x.evidence.pr.originalHeadReceipt[field] = value, 'PR_ORIGINAL_HEAD_NOT_VERIFIED');
for (const [field, value] of [['independentBindingsVerified', false], ['qualityRunAttempt', 2], ['qualityWorkflowPath', '.github/workflows/manual.yml'],
  ['qualityEvent', 'pull_request'], ['qualityRepository', 'other/repo'], ['qualityHeadSha', BASE], ['qualityHeadBranch', 'agent/other'], ['qualityRunId', 101], ['qualityRunId', 401]])
  caseOf('original source quality handoff:' + field + ':' + value, x => x.evidence.pr.originalHeadReceipt[field] = value, 'PR_ORIGINAL_HEAD_NOT_VERIFIED');
caseOf('missing Preview evidence', x => delete x.evidence.pr.preview, 'EVIDENCE_INVALID:pr');
for (const [field, value] of [['authenticated', false], ['readyTimestampVerified', false], ['provider', 'other-provider'], ['projectId', 'prj_other'],
  ['projectName', 'other-project'], ['repository', 'other/repo'], ['target', 'production'], ['state', 'ERROR'], ['headSha', BASE], ['gitRef', 'agent/other'],
  ['createdAt', '2026-11-17T09:19:59Z'], ['observedAt', '2026-11-18T00:00:00Z']])
  caseOf('exact head Preview:' + field, x => x.evidence.pr.preview[field] = value, 'EXACT_HEAD_PREVIEW_NOT_VERIFIED');
caseOf('Preview became ready after merge despite later observation', x => { x.evidence.pr.preview.readyAt = '2026-11-17T09:24:01Z'; x.evidence.pr.preview.observedAt = '2026-11-17T19:00:00Z'; }, 'EXACT_HEAD_PREVIEW_NOT_VERIFIED');
caseOf('raw null Preview target cannot replace verified normalization', x => x.evidence.pr.preview.target = null, 'EVIDENCE_INVALID:pr');
caseOf('Production wrong project', x => x.evidence.deployment.projectId = 'prj_other', 'PRODUCTION_PROJECT_NOT_VERIFIED');
caseOf('Health independent merge join not verified', x => x.evidence.healthRun.report.metadataBindingsVerified = false, 'HEALTH_ORIGINAL_REPORT_NOT_BOUND');
for (const [field, value] of [['canonicalAlias', 'preview.example.invalid'], ['aliasDeploymentId', 'dpl_other'], ['aliasObservedAt', '2026-11-17T09:24:59Z'], ['aliasObservedAt', '2026-11-18T00:00:00Z']])
  caseOf('canonical alias:' + field + ':' + value, x => x.evidence.deployment[field] = value, 'CANONICAL_PRODUCTION_ALIAS_NOT_VERIFIED');
caseOf('missing alias proof', x => delete x.evidence.deployment.aliasDeploymentId, 'EVIDENCE_INVALID:deployment');
caseOf('history outcomes not fully verified', x => x.evidence.editorial.history.allRelevantRunOutcomesVerified = false, 'COMPLETE_HISTORY_NOT_VERIFIED');
for (const [field, value] of [['noOpVerified', false], ['status', 'in_progress'], ['conclusion', 'failure'], ['completedAt', '2026-11-17T19:01:01Z']]) {
  caseOf('extra source cannot be ignored:' + field, x => x.evidence.editorial.history.sourceRuns.push({ ...extraNoop.evidence.editorial.history.sourceRuns[1], [field]: value }), 'HISTORY_EXTRA_RUN_NOT_VERIFIED_NOOP');
  caseOf('extra publisher cannot be ignored:' + field, x => x.evidence.editorial.history.publisherRuns.push({
    id: 107, attempt: 1, event: 'workflow_run', sourceRunId: 101, merged: false, mergeSha: null,
    status: 'completed', conclusion: 'skipped', createdAt: '2026-11-17T10:00:00Z', completedAt: '2026-11-17T10:00:10Z', noOpVerified: true, [field]: value }), 'HISTORY_EXTRA_RUN_NOT_VERIFIED_NOOP');
}
for (const invalid of ['head1', {}, 123, 'F'.repeat(40), '0'.repeat(39)]) caseOf('malformed SHA', x => x.evidence.pr.headSha = invalid, 'EVIDENCE_INVALID:pr');
for (const invalid of ['2026-11-17T09:20:00', '2026-11-17T10:20:00+01:00', '2026-02-30T09:20:00Z', '2026-11-17', Symbol('SENTINEL')])
  caseOf('bad source timestamp', x => x.evidence.sourceRun.createdAt = invalid, 'EVIDENCE_INVALID:sourceRun');
for (const invalid of [null, undefined, [], 3, Symbol('SENTINEL'), { editionDate: '2026-11-17', now: Symbol('SENTINEL') }, { editionDate: '2026-02-30', now: '2026-11-17T23:59:00Z' }])
  reject('invalid request', invalid, 'REQUEST_DATE_OR_CLOCK_INVALID');
caseOf('secret object in expected scalar', x => x.evidence.sourceRun.jobs.start = { secret: 'SENTINEL' }, 'EVIDENCE_INVALID:sourceRun');
caseOf('raw event string', x => x.evidence.sourceRun.event = 'Bearer SENTINEL', 'EVIDENCE_INVALID:sourceRun');

for (const state of ['pending', 'unknown']) {
  const input = good(); input.evidence.healthRun = { state, targetEditionDate: input.editionDate };
  const result = classifyDailyPhase1a(input); invariant(result);
  assert.equal(result.evidenceClass, 'UNKNOWN'); assert.equal(result.nativeHealth.state, state); counts.pending++;
}
for (const slot of ['10:47', '11:07']) positive(good('2026-11-17', true, slot), true);
const exactBackstop = good('2026-11-17', true); exactBackstop.evidence.recoveryOrigin.run.createdAt = '2026-11-17T10:47:00Z'; positive(exactBackstop, true);
const shortBackstop = good('2026-11-17', true, '11:07');
assert.ok(Date.parse(shortBackstop.evidence.recoveryOrigin.run.completedAt) < Date.parse(shortBackstop.evidence.pr.createdAt));
assert.ok(Date.parse(shortBackstop.evidence.recoveryOrigin.run.completedAt) < Date.parse(shortBackstop.evidence.publisher.createdAt));
assert.ok(Date.parse(shortBackstop.evidence.publisher.createdAt) < Date.parse(shortBackstop.evidence.sourceRun.completedAt));
assert.ok(Date.parse(shortBackstop.evidence.pr.mergedAt) >= Date.parse(shortBackstop.evidence.sourceRun.completedAt));
assert.equal(Object.hasOwn(shortBackstop.evidence.recoveryOrigin.receipt, 'publisherRunId'), false);
assert.equal(Object.hasOwn(shortBackstop.evidence.recoveryOrigin.receipt, 'prHeadSha'), false);
positive(shortBackstop, true);
const missingSlash = clone(shortBackstop);
missingSlash.evidence.publisher.recoveryLogReceipt.editionUrl = missingSlash.evidence.publisher.recoveryLogReceipt.editionUrl.slice(0, -1);
reject('publisher URL without trailing slash', missingSlash, 'RECOVERY_PUBLISHER_LOG_NOT_BOUND');
const recoveryUnknown = good('2026-07-13', true); recoveryUnknown.evidence.healthRun.state = 'unknown'; positive(recoveryUnknown, true);
const pendingRecoveryHealth = good('2026-11-17', true);
pendingRecoveryHealth.evidence.healthRun = { state: 'pending', targetEditionDate: '2026-11-17', repository: REPO,
  id: 103, workflowPath: '.github/workflows/daily-news-health.yml', branch: 'main', attempt: 1, event: 'schedule',
  status: 'in_progress', conclusion: null, createdAt: '2026-11-17T18:55:00Z', completedAt: null, headSha: MERGE, report: null };
positive(pendingRecoveryHealth, true);
for (const [name, id] of [['source', 101], ['publisher', 102], ['backstop', 105]]) {
  const reusedHealthRun = clone(pendingRecoveryHealth); reusedHealthRun.evidence.healthRun.id = id;
  reject('pending recovery Health cannot reuse ' + name + ' run ID', reusedHealthRun, 'RECOVERY_RUN_IDS_NOT_DISTINCT');
}
for (const origin of [null, { kind: 'external-wake' }, { kind: 'human-correlation' }, { kind: 'native-scheduled-backstop' }]) {
  const input = good('2026-11-17', true); input.evidence.recoveryOrigin = origin;
  const result = classifyDailyPhase1a(input); invariant(result);
  assert.equal(result.evidenceClass, 'RECOVERY_PROVISIONAL'); assert.equal(result.reportVerified, false); counts.provisional++;
}
for (const [label, mutate, issue] of [
  ['source actor human', x => x.evidence.sourceRun.actor = 'usdimpact', 'RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
  ['source triggering actor human', x => x.evidence.sourceRun.triggeringActor = 'usdimpact', 'RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
  ['publisher actor human', x => x.evidence.publisher.actor = 'usdimpact', 'RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
  ['publisher triggering actor human', x => x.evidence.publisher.triggeringActor = 'usdimpact', 'RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
  ['recovery generic publisher', x => x.evidence.publisher.event = 'workflow_run', 'PUBLISHER_LINEAGE_NOT_VERIFIED'],
  ['backstop manual', x => x.evidence.recoveryOrigin.run.event = 'workflow_dispatch', 'RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
  ['backstop wrong workflow', x => x.evidence.recoveryOrigin.run.workflowPath = '.github/workflows/quality.yml', 'BACKSTOP_IDENTITY_INVALID'],
  ['backstop rerun', x => x.evidence.recoveryOrigin.run.attempt = 2, 'BACKSTOP_NOT_ORIGINAL_ATTEMPT'],
  ['backstop failed', x => x.evidence.recoveryOrigin.run.conclusion = 'failure', 'BACKSTOP_NOT_SUCCESS'],
  ['backstop after source', x => x.evidence.recoveryOrigin.run.createdAt = '2026-11-17T10:49:00Z', 'RECOVERY_ORIGIN_CHRONOLOGY_INVALID'],
  ['receipt unauthenticated', x => x.evidence.recoveryOrigin.receipt.authenticated = false, 'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND'],
  ['receipt mutable', x => x.evidence.recoveryOrigin.receipt.immutable = false, 'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND'],
  ['receipt original attempt unverified', x => x.evidence.recoveryOrigin.receipt.originalAttemptVerified = false, 'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND'],
  ['receipt wrong source', x => x.evidence.recoveryOrigin.receipt.sourceRunId = 999, 'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND'],
  ['receipt wrong source attempt', x => x.evidence.recoveryOrigin.receipt.sourceRunAttempt = 2, 'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND'],
  ['receipt wrong publisher', x => x.evidence.publisher.recoveryReceipt.runId = 999, 'RECOVERY_PUBLISHER_RECEIPT_NOT_BOUND'],
  ['receipt wrong publisher attempt', x => x.evidence.publisher.recoveryReceipt.runAttempt = 2, 'RECOVERY_PUBLISHER_RECEIPT_NOT_BOUND'],
  ['receipt wrong original run', x => x.evidence.recoveryOrigin.receipt.runId = 999, 'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND'],
  ['receipt wrong original attempt', x => x.evidence.recoveryOrigin.receipt.runAttempt = 2, 'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND'],
  ['receipt wrong edition', x => x.evidence.recoveryOrigin.receipt.editionDate = '2026-11-16', 'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND'],
  ['receipt wrong source head', x => x.evidence.recoveryOrigin.receipt.sourceHeadSha = HEAD, 'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND'],
  ['receipt after original backstop ends', x => x.evidence.recoveryOrigin.receipt.recordedAt = '2026-11-17T10:48:21Z', 'RECOVERY_ORIGIN_CHRONOLOGY_INVALID'],
  ['receipt only summary URL', x => x.evidence.recoveryOrigin.receipt.kind = 'step-summary-url', 'EVIDENCE_INVALID:recoveryOrigin'],
  ['recovery completed pending with failure conclusion', x => x.evidence.healthRun = { ...good().evidence.healthRun, state: 'pending', conclusion: 'failure', report: null }, 'RECOVERY_NATIVE_HEALTH_INCONSISTENT'],
  ['recovery completed Health before start', x => x.evidence.healthRun = { ...good().evidence.healthRun, state: 'pending', conclusion: 'success', report: null, completedAt: '2026-11-17T18:54:59Z' }, 'HEALTH_TIME_INVALID']
]) caseOf(label, mutate, issue, true);
caseOf('recovery contradictory orphan Health', x => x.evidence.healthRun.branch = 'agent/test', 'HEALTH_ORPHAN_METADATA', true);
caseOf('recovery wrong nominal slot 11:07', x => x.evidence.recoveryOrigin.nominalSlot = '11:07', 'BACKSTOP_BEFORE_NOMINAL_SCHEDULE', true);
caseOf('backstop one second before nominal', x => x.evidence.recoveryOrigin.run.createdAt = '2026-11-17T10:46:59Z', 'BACKSTOP_BEFORE_NOMINAL_SCHEDULE', true);
caseOf('backstop receipt before source creation', x => x.evidence.recoveryOrigin.receipt.recordedAt = '2026-11-17T10:47:59Z', 'RECOVERY_ORIGIN_CHRONOLOGY_INVALID', true);
caseOf('backstop source URL not exact', x => x.evidence.recoveryOrigin.receipt.sourceRunUrl = 'https://github.com/usdimpact/usd-impact-site/actions/runs/999', 'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND', true);
caseOf('backstop source metadata not independently verified', x => x.evidence.recoveryOrigin.receipt.sourceMetadataVerified = false, 'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND', true);
caseOf('echo command is not original summary content', x => x.evidence.recoveryOrigin.receipt.kind = 'original-github-job-log', 'EVIDENCE_INVALID:recoveryOrigin', true);
caseOf('missing downstream publisher receipt', x => x.evidence.publisher.recoveryReceipt = null, 'RECOVERY_PUBLISHER_RECEIPT_NOT_BOUND', true);
caseOf('recovery publisher before PR/head handoff', x => { x.evidence.publisher.createdAt = '2026-11-17T10:49:00Z'; x.evidence.editorial.history.publisherRuns[0].createdAt = x.evidence.publisher.createdAt; }, 'PUBLICATION_CHRONOLOGY_INVALID', true);
caseOf('recovery merge cannot precede source completion', x => {
  x.evidence.pr.mergedAt = '2026-11-17T10:49:59Z';
  x.evidence.pr.preview.readyAt = '2026-11-17T10:49:50Z'; x.evidence.pr.preview.observedAt = '2026-11-17T10:49:55Z';
  for (const check of Object.values(x.evidence.pr.checks)) check.completedAt = '2026-11-17T10:49:50Z';
}, 'PUBLICATION_CHRONOLOGY_INVALID', true);
for (const [field, value] of [['authenticated', false], ['immutable', false], ['originalAttemptVerified', false], ['metadataBindingsVerified', false],
  ['sourceRunId', 999], ['sourceRunAttempt', 2], ['sourceHeadSha', HEAD], ['prNumber', 999], ['prHeadSha', BASE], ['mergeSha', BASE],
  ['editionDate', '2026-11-16'], ['editionUrl', 'https://example.invalid/'], ['recordedAt', '2026-11-17T10:51:59Z'], ['recordedAt', '2026-11-17T10:54:01Z']])
  caseOf('independent downstream publisher receipt:' + field + ':' + value,
    x => x.evidence.publisher[['editionDate', 'editionUrl'].includes(field) ? 'recoveryLogReceipt' : 'recoveryReceipt'][field] = value,
    ['editionDate', 'editionUrl'].includes(field) ? 'RECOVERY_PUBLISHER_LOG_NOT_BOUND' : 'RECOVERY_PUBLISHER_RECEIPT_NOT_BOUND', true);

let getterCalls = 0;
for (const target of ['top', 'nested']) {
  const input = good(); const object = target === 'top' ? input : input.evidence.sourceRun;
  Object.defineProperty(object, target === 'top' ? 'now' : 'createdAt', { get() { getterCalls++; throw Error('SENTINEL_GETTER'); } });
  const result = classifyDailyPhase1a(input); invariant(result); assert.equal(result.accepted, false);
  assert.doesNotMatch(JSON.stringify(result), /SENTINEL/); counts.negative++;
}
assert.equal(getterCalls, 0);
const proxy = new Proxy({}, { getPrototypeOf() { throw Error('SENTINEL_PROXY'); } });
assert.equal(classifyDailyPhase1a(proxy).evidenceClass, 'HOLD'); counts.negative++;

async function collected(input, transform = value => value) {
  let calls = 0;
  const readers = Object.fromEntries(Object.entries(input.evidence).filter(([key]) => key !== 'recoveryOrigin' || input.evidence.recoveryOrigin !== null)
    .map(([key, value]) => [key, async date => { calls++; assert.equal(date, input.editionDate); return transform(value, key); }]));
  return { result: await collectDailyPhase1a({ editionDate: input.editionDate, now: input.now, readers, clock: async () => input.now }), calls };
}
const clean = await collected(good(), value => ({ ...value, secret: 'SENTINEL_TOP', apiKey: 'SENTINEL_API' }));
assert.equal(clean.calls, 7); assert.equal(clean.result.errors.length, 0); positive(clean.result, false, false);
assert.doesNotMatch(JSON.stringify(clean.result), /SENTINEL/); counts.collector++;
const recovered = await collected(good('2026-11-17', true)); assert.equal(recovered.calls, 8); positive(recovered.result, true, false); counts.collector++;
for (const [label, transform] of [
  ['nested scalar object', (value, key) => key === 'pr' ? { ...value, headSha: { token: 'SENTINEL_SECRET' } } : value],
  ['provider error', () => { throw Error('SENTINEL_PROVIDER'); }],
  ['empty records', () => ({})],
  ['getter', (value, key) => { if (key !== 'pr') return value; const changed = { ...value }; Object.defineProperty(changed, 'headSha', { get() { getterCalls++; throw Error('SENTINEL_GETTER'); } }); return changed; }]
]) {
  const { result } = await collected(good(), transform); assert.ok(result.errors.length > 0, label);
  assert.equal(classifyDailyPhase1a(result).accepted, false); assert.doesNotMatch(JSON.stringify(result), /SENTINEL/); counts.collector++;
}
let invalidReads = 0;
const readers = Object.fromEntries(['sourceRun', 'publisher', 'pr', 'deployment', 'outputs', 'healthRun', 'editorial'].map(key => [key, async () => { invalidReads++; return {}; }]));
for (const input of [null, {}, { editionDate: '2026-02-30', now: '2026-11-17T23:59:00Z', readers }, { editionDate: '2026-11-17', now: '2026-11-17T23:59:00', readers }]) {
  const result = await collectDailyPhase1a(input); assert.ok(result.errors.length > 0); counts.collector++;
}
assert.equal(invalidReads, 0); assert.equal(getterCalls, 0);
// Reviewer R1: explicitly verify log provenance rather than summary-only URL.
caseOf('missing publisher log', x => x.evidence.publisher.recoveryLogReceipt = null, 'RECOVERY_PUBLISHER_LOG_NOT_BOUND', true);
caseOf('publisher log wrong source', x => x.evidence.publisher.recoveryLogReceipt.sourceRunId = 999, 'RECOVERY_PUBLISHER_LOG_NOT_BOUND', true);
caseOf('publisher log mutable', x => x.evidence.publisher.recoveryLogReceipt.immutable = false, 'RECOVERY_PUBLISHER_LOG_NOT_BOUND', true);
// Reviewer R2: terminal-Health approval is unresolved. Retain both inputs and
// require the explicit policy HOLD rather than certifying an unapproved meaning.
for (const [state, conclusion] of [['unhealthy', 'failure'], ['healthy', 'success']]) {
  const x = good('2026-11-17', true);
  x.evidence.healthRun = { ...good().evidence.healthRun, state, conclusion,
    report: state === 'unhealthy' ? null : good().evidence.healthRun.report };
  const v = classifyDailyPhase1a(x); invariant(v);
  assert.equal(v.evidenceClass, 'HOLD');
  assert.equal(v.reportVerified, false);
  assert.equal(v.nativeHealth.reviewRequired, true);
  assert.equal(v.nativeHealth.state, 'unknown');
  assert.ok(v.issues.includes('RECOVERY_TERMINAL_HEALTH_HOLD'));
  assert.ok(v.warnings.includes('NATIVE_HEALTH_SEPARATE_REVIEW_REQUIRED'));
  counts.negative++;
}
const completedPending = good('2026-11-17', true);
completedPending.evidence.healthRun = { ...good().evidence.healthRun, state: 'pending', conclusion: 'success', report: null };
positive(completedPending, true);
// Reviewer R3: provenance uncertainty must not hide independent failures.
const bad = good('2026-11-17', true);
bad.evidence.recoveryOrigin = { kind: 'external-wake' };
bad.evidence.sourceRun.conclusion = 'failure';
bad.evidence.pr.merged = false;
bad.evidence.editorial.rightsCleared = false;
const badResult = classifyDailyPhase1a(bad); invariant(badResult);
assert.equal(badResult.evidenceClass, 'HOLD');
for (const issue of ['RECOVERY_ORIGIN_NOT_CERTIFIED', 'SOURCE_NOT_SUCCESS', 'PR_PROTECTED_LINEAGE_NOT_VERIFIED', 'EDITORIAL_OR_RIGHTS_NOT_VERIFIED'])
  assert.ok(badResult.issues.includes(issue), issue);
counts.negative++;
// Reviewer R4: legitimate reader timestamps exceed collection start, not final clock.
const observed = good(); observed.now = '2026-11-17T19:00:00Z';
for (const item of Object.values(observed.evidence.outputs)) item.observedAt = '2026-11-17T19:00:05Z';
observed.evidence.deployment.aliasObservedAt = '2026-11-17T19:00:05Z';
observed.evidence.editorial.history.observedAt = '2026-11-17T19:00:07Z';
observed.evidence.editorial.budget.observedAt = '2026-11-17T19:00:07Z';
observed.evidence.editorial.budget.requestAccounting.observedAt = '2026-11-17T19:00:07Z';
const observedReaders = Object.fromEntries(Object.entries(observed.evidence).filter(([key]) => key !== 'recoveryOrigin')
  .map(([key, value]) => [key, async () => value]));
const observedResult = await collectDailyPhase1a({ editionDate: observed.editionDate, now: observed.now, readers: observedReaders,
  clock: async () => '2026-11-17T19:00:10Z' });
positive(observedResult, false, false); counts.collector++;
const noClock = await collectDailyPhase1a({ editionDate: observed.editionDate, now: observed.now, readers: observedReaders });
assert.ok(noClock.errors.includes('FINAL_CLOCK_MISSING')); counts.collector++;
const badClock = await collectDailyPhase1a({ editionDate: observed.editionDate, now: observed.now, readers: observedReaders,
  clock: async () => '2026-11-17T19:11:00Z' });
assert.ok(badClock.errors.includes('FINAL_CLOCK_INVALID')); counts.collector++;
// Additional negative coverage from independent review.
caseOf('check completed after merge', x => x.evidence.pr.checks.codeql.completedAt = '2026-11-17T09:24:01Z', 'EXACT_HEAD_CHECK_NOT_VERIFIED:codeql');
caseOf('action required check', x => x.evidence.pr.checks.webQuality.conclusion = 'action_required', 'EXACT_HEAD_CHECK_NOT_VERIFIED:webQuality');
caseOf('PR after source completion', x => x.evidence.pr.createdAt = '2026-11-17T09:22:01Z', 'PUBLICATION_CHRONOLOGY_INVALID');
caseOf('wrong content type', x => x.evidence.outputs.article.contentType = 'text/plain', 'PUBLIC_OUTPUT_NOT_VERIFIED:article');
caseOf('unexpected native recovery artifact', x => x.evidence.recoveryOrigin = { kind: 'external-wake' }, 'NATIVE_HAS_RECOVERY_ORIGIN');
caseOf('unsupported source event', x => x.evidence.sourceRun.event = 'repository_dispatch', 'SOURCE_EVENT_UNSUPPORTED');
caseOf('duplicate native run ID', x => x.evidence.publisher.id = x.evidence.sourceRun.id, 'RUN_IDS_NOT_DISTINCT');
caseOf('Health edition wrong', x => x.evidence.healthRun.targetEditionDate = '2026-11-16', 'HEALTH_EDITION_MISMATCH');
caseOf('merge previous edition date', x => x.evidence.pr.mergedAt = '2026-11-16T09:24:00Z', 'MERGE_EDITION_DATE_MISMATCH');
reject('missing evidence', {editionDate:'2026-11-17',now:'2026-11-17T23:59:00Z'}, 'EVIDENCE_MISSING');
assert.equal(validUtc('2026-11-17T23:59:00.123Z'), true);
assert.equal(validUtc('2026-11-17T23:59:60Z'), false);

// Integrated independent-review regressions; local synthetic evidence only.
{
const results=[];
function check(label, input, expected, required=[], extra=()=>{}) {
  const r=classifyDailyPhase1a(input);
  assert.equal(r.evidenceClass,expected,label+': '+JSON.stringify(r));
  for(const code of required) assert.ok(r.issues.includes(code),label+': '+code);
  assert.equal(r.mayCloseIncident,false,label);
  assert.ok(Object.isFrozen(r)); assert.ok(Object.isFrozen(r.warnings));
  assert.ok(!r.issues.includes('NATIVE_HEALTH_SEPARATE_REVIEW_REQUIRED'));
  if(input.evidence?.sourceRun.event==='workflow_dispatch') {
    assert.equal(r.accepted,false); assert.equal(r.nativeAcceptance,false);
    assert.equal(r.nativeHealthy,false); assert.equal(r.nativeHealth.verified,false);
  }
  if(expected==='HOLD') assert.equal(r.reportVerified,false);
  extra(r);
  results.push({label,evidenceClass:r.evidenceClass,issues:r.issues,warnings:r.warnings});
}
function recovery(){return good('2026-11-17',true);}
function terminal(state='healthy',conclusion='success',report=true){
  const h=structuredClone(good().evidence.healthRun);
  h.state=state; h.conclusion=conclusion;
  h.report=report ? {...h.report,state,sourceRunId:106} : null;
  return h;
}
for(const status of ['queued']) {
  const x=recovery(); x.evidence.healthRun={...terminal('pending',null,false),status,completedAt:null};
  check('Health '+status,x,'UNATTENDED_RECOVERY_VERIFIED');
}
for(const [state,conclusion] of [['unhealthy','success'],['unhealthy','cancelled'],['healthy','failure'],['pending','failure'],['unknown','success']]) {
  const x=recovery();x.evidence.healthRun=terminal(state,conclusion,false);
  check('inconsistent Health '+state+'/'+conclusion,x,'HOLD',['RECOVERY_NATIVE_HEALTH_INCONSISTENT'],r=>assert.equal(r.nativeHealth.state,'unknown'));
}
{
  const x=recovery();x.evidence.healthRun=terminal('healthy','success',false);
  check('healthy needs report',x,'HOLD',['RECOVERY_HEALTH_REPORT_MISSING']);
}
for(const [field,value] of [
  ['state','unhealthy'],['runId',999],['runAttempt',2],['targetEditionDate','2026-11-16'],
  ['authenticated',false],['immutable',false],['originalAttemptVerified',false],['metadataBindingsVerified',false],
  ['recordedAt','2026-11-17T18:54:59Z'],['recordedAt','2026-11-17T18:56:01Z']
]) {
  const x=recovery();x.evidence.healthRun=terminal();x.evidence.healthRun.report[field]=value;
  check('bad Health report '+field+'/'+value,x,'HOLD',['RECOVERY_HEALTH_REPORT_NOT_BOUND']);
}
for(const sourceRunId of [101,102,103,105]) {
  const x=recovery();x.evidence.healthRun=terminal();x.evidence.healthRun.report.sourceRunId=sourceRunId;
  check('Health report cannot assess known non-source '+sourceRunId,x,'HOLD',['RECOVERY_HEALTH_SOURCE_NOT_SCHEDULED']);
}
{
  const x=recovery();x.evidence.healthRun=terminal('unhealthy','failure',true);
  check('unhealthy report cannot pretend to be printed failure log',x,'HOLD',['RECOVERY_HEALTH_FAILURE_LOG_NOT_SUPPORTED']);
}
for(const h of [terminal(),terminal('unhealthy','failure',false)]) {
  const x=recovery();x.evidence.healthRun=h;
  check('terminal '+h.state+' blocked on unresolved policy',x,'HOLD',['RECOVERY_TERMINAL_HEALTH_HOLD'],r=>{
    assert.ok(r.warnings.includes('NATIVE_HEALTH_SEPARATE_REVIEW_REQUIRED'));
    assert.equal(r.nativeHealth.reviewRequired,true);
  });
}
const provisionalMutations=[
 ['summary missing',x=>x.evidence.publisher.recoveryReceipt=null,'RECOVERY_PUBLISHER_RECEIPT_NOT_BOUND'],
 ['log missing',x=>x.evidence.publisher.recoveryLogReceipt=null,'RECOVERY_PUBLISHER_LOG_NOT_BOUND'],
 ['source actor',x=>x.evidence.sourceRun.actor='usdimpact','RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
 ['source trigger',x=>x.evidence.sourceRun.triggeringActor='usdimpact','RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
 ['publisher actor',x=>x.evidence.publisher.actor='usdimpact','RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
 ['publisher trigger',x=>x.evidence.publisher.triggeringActor='usdimpact','RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
 ['run ID collision',x=>x.evidence.publisher.id=101,'RECOVERY_RUN_IDS_NOT_DISTINCT'],
 ['contradictory Health',x=>x.evidence.healthRun=terminal('unhealthy','success',false),'RECOVERY_NATIVE_HEALTH_INCONSISTENT']
];
for(const [label,mutate,issue] of provisionalMutations){
  const x=recovery();x.evidence.recoveryOrigin={kind:'external-wake'};mutate(x);
  check('provisional plus '+label,x,'HOLD',['RECOVERY_ORIGIN_NOT_CERTIFIED',issue]);
}
{
  const x=recovery(); x.evidence.recoveryOrigin={kind:'external-wake'};
  x.evidence.publisher.recoveryReceipt=null;x.evidence.publisher.recoveryLogReceipt=null;
  x.evidence.sourceRun.actor='usdimpact';x.evidence.publisher.actor='usdimpact';
  x.evidence.healthRun={...terminal('healthy','failure',false),id:101};
  check('reviewer combined hidden failures',x,'HOLD',[
    'RECOVERY_ORIGIN_NOT_CERTIFIED','RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED',
    'RECOVERY_PUBLISHER_RECEIPT_NOT_BOUND','RECOVERY_PUBLISHER_LOG_NOT_BOUND',
    'RECOVERY_RUN_IDS_NOT_DISTINCT','RECOVERY_NATIVE_HEALTH_INCONSISTENT']);
}
{
 const x=recovery();x.evidence.recoveryOrigin.receipt=null;x.evidence.recoveryOrigin.run.conclusion='failure';
 check('partial origin does not hide failed backstop',x,'HOLD',['BACKSTOP_NOT_SUCCESS']);
}
{
 const x=recovery();x.evidence.recoveryOrigin.run.completedAt='2026-11-17T10:46:59Z';
 check('backstop reversed times',x,'HOLD',['BACKSTOP_TIME_INVALID']);
}
{
 const x=recovery();x.evidence.publisher.completedAt='2026-11-17T10:48:00Z';
 check('publisher reversed times',x,'HOLD',['PUBLISHER_TIME_INVALID']);
}
{
 const x=recovery();x.evidence.healthRun={state:'healthy',targetEditionDate:'2026-11-17'};
 check('healthy without run metadata',x,'HOLD',['HEALTH_RUN_MISSING']);
}
{
 const x=good();const readers=Object.fromEntries(Object.entries(x.evidence).filter(([k])=>k!=='recoveryOrigin').map(([k,v])=>[k,async()=>v]));
 const collected=await collectDailyPhase1a({editionDate:x.editionDate,now:x.now,readers,clock:async()=>{throw Error('SENTINEL_CLOCK');}});
 assert.ok(collected.errors.includes('FINAL_CLOCK_FAILED'));
 assert.doesNotMatch(JSON.stringify(collected),/SENTINEL_CLOCK/);
 const r=classifyDailyPhase1a(collected); assert.equal(r.evidenceClass,'HOLD');
 results.push({label:'throwing clock preserves fail-closed collector behavior',evidenceClass:r.evidenceClass,collectorErrors:collected.errors});
}

// Result identities permit a reviewer to bind a verdict to its actual inputs.
{
 const x=recovery(); const v=classifyDailyPhase1a(x);
 assert.deepEqual([v.editionDate,v.sourceRunId,v.publisherRunId,v.backstopRunId,
   v.healthRunId,v.prNumber,v.mergeSha],['2026-11-17',101,102,105,null,104,MERGE]);
 results.push({label:'recovery result carries full publication identity'});
}
{
 const v=classifyDailyPhase1a(good());
 assert.deepEqual([v.publisherRunId,v.backstopRunId,v.healthRunId,v.prNumber,v.mergeSha],
   [102,null,103,104,MERGE]);
 results.push({label:'native result carries full publication identity'});
}
// Regression: partial supplied origins still get their own checks before provisional.
{
 const x=recovery(); x.evidence.recoveryOrigin.run=null;
 check('orphan backstop receipt cannot be merely provisional',x,'HOLD',
   ['RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND','RECOVERY_ORIGIN_NOT_CERTIFIED']);
}
{
 const x=recovery(); x.evidence.recoveryOrigin.receipt=null;
 x.evidence.recoveryOrigin.nominalSlot='11:07';
 check('partial origin still obeys nominal slot',x,'HOLD',
   ['BACKSTOP_BEFORE_NOMINAL_SCHEDULE','RECOVERY_ORIGIN_NOT_CERTIFIED']);
}
counts.reviewRegression=results.length;
}
// Owner-approved design policy regressions; pure synthetic evidence only.
{
const ledger = x => x.evidence.editorial.budget.requestAccounting;
const proof = x => x.evidence.publisher.originalVerification;
const receipts = [];
function policyCase(label, x, expected='HOLD', issue=null) {
  const v=classifyDailyPhase1a(x); invariant(v);
  assert.equal(v.policyRevision,'owner-2026-11-17-offline-v1',label);
  assert.equal(v.evidenceClass,expected,label+': '+JSON.stringify(v.issues));
  if(issue) assert.ok(v.issues.includes(issue),label+': '+JSON.stringify(v.issues));
  if(expected==='HOLD') assert.equal(v.reportVerified,false,label);
  else if(['NATIVE_AUTO_VERIFIED','UNATTENDED_RECOVERY_VERIFIED'].includes(expected)) assert.deepEqual(v.issues,[],label);
  assert.equal(v.mayCloseIncident,false,label);
  receipts.push({label,evidenceClass:v.evidenceClass,issues:v.issues});
  return v;
}
function nearCutoff(date,cutoff,recovery=false){
  const x=good(date,recovery), boundary=time(date,cutoff);
  x.evidence.pr.mergedAt=offset(boundary,-3);
  x.evidence.deployment.readyAt=offset(boundary,-2);
  proof(x).recordedAt=offset(boundary,-1);
  x.evidence.publisher.completedAt=offset(boundary,1);
  x.evidence.editorial.history.publisherRuns[0].completedAt=x.evidence.publisher.completedAt;
  if(recovery){
    x.evidence.publisher.recoveryReceipt.recordedAt=proof(x).recordedAt;
    x.evidence.publisher.recoveryLogReceipt.recordedAt=proof(x).recordedAt;
  }
  return x;
}
for(const [date,cutoff] of [['2026-03-06','13:30:00'],['2026-03-09','12:30:00'],['2026-10-30','12:30:00'],['2026-11-02','13:30:00'],['2026-07-13','12:30:00'],['2026-11-17','13:30:00']]){
  for(const recovery of [false,true]){
    const x=nearCutoff(date,cutoff,recovery), expected=recovery?'UNATTENDED_RECOVERY_VERIFIED':'NATIVE_AUTO_VERIFIED';
    policyCase('all three stages before cutoff '+date+'/'+recovery,x,expected);
    const fractional=clone(x);
    fractional.evidence.deployment.readyAt=offset(time(date,cutoff),-0.002);
    proof(fractional).recordedAt=offset(time(date,cutoff),-0.001);
    if(recovery) for(const r of ['recoveryReceipt','recoveryLogReceipt']) fractional.evidence.publisher[r].recordedAt=proof(fractional).recordedAt;
    policyCase('millisecond before cutoff '+date+'/'+recovery,fractional,expected);
    for(const delay of [0,0.001]){
      const d=clone(x); d.evidence.deployment.readyAt=offset(time(date,cutoff),delay);
      policyCase('Production at/after cutoff '+date+'/'+recovery+'/'+delay,d,'HOLD','PRODUCTION_READY_AFTER_0830_ET_CUTOFF');
      const v=clone(x);proof(v).recordedAt=offset(time(date,cutoff),delay);
      if(recovery) for(const r of ['recoveryReceipt','recoveryLogReceipt']) v.evidence.publisher[r].recordedAt=proof(v).recordedAt;
      policyCase('verification at/after cutoff '+date+'/'+recovery+'/'+delay,v,'HOLD','PUBLICATION_VERIFICATION_AFTER_0830_ET_CUTOFF');
    }
  }
}
for(const recovery of [false,true]){
  const x=good('2026-11-17',recovery);
  x.now='2026-11-18T00:30:00Z';
  for(const row of Object.values(x.evidence.outputs))row.observedAt='2026-11-18T00:20:00Z';
  x.evidence.deployment.aliasObservedAt='2026-11-18T00:20:00Z';
  x.evidence.editorial.history.observedAt='2026-11-18T00:21:00Z';
  x.evidence.editorial.budget.observedAt='2026-11-18T00:21:00Z';
  ledger(x).observedAt='2026-11-18T00:21:00Z';
  policyCase('read-only verification next UTC day permitted '+recovery,x,recovery?'UNATTENDED_RECOVERY_VERIFIED':'NATIVE_AUTO_VERIFIED');
}
{
 const x=good();x.evidence.publisher.completedAt='2026-11-17T16:30:00Z';
 x.evidence.editorial.history.publisherRuns[0].completedAt=x.evidence.publisher.completedAt;
 policyCase('publisher cleanup after deadline is not original verification',x,'NATIVE_AUTO_VERIFIED');
}
for(const [label,mutate,issue] of [
 ['missing original verification',x=>delete x.evidence.publisher.originalVerification,'ORIGINAL_PUBLICATION_VERIFICATION_MISSING'],
 ['retrospective inspection cannot replace original receipt',x=>proof(x).recordedAt='2026-11-17T19:00:00Z','PUBLICATION_VERIFICATION_AFTER_0830_ET_CUTOFF'],
 ['verification before READY',x=>proof(x).recordedAt='2026-11-17T09:24:59Z','ORIGINAL_PUBLICATION_VERIFICATION_TIME_INVALID'],
 ['verification after publisher completed',x=>proof(x).recordedAt='2026-11-17T09:26:00.001Z','ORIGINAL_PUBLICATION_VERIFICATION_TIME_INVALID'],
 ['missing index coverage',x=>proof(x).checkedOutputs=['article','latestJson','rss'],'ORIGINAL_PUBLICATION_FOUR_OUTPUTS_NOT_PROVEN'],
 ['duplicate output coverage',x=>proof(x).checkedOutputs=['article','article','latestJson','rss'],'ORIGINAL_PUBLICATION_FOUR_OUTPUTS_NOT_PROVEN'],
 ['extra output coverage',x=>proof(x).checkedOutputs.push('index'),'ORIGINAL_PUBLICATION_FOUR_OUTPUTS_NOT_PROVEN'],
 ['READY previous edition',x=>x.evidence.deployment.readyAt='2026-11-16T13:29:00Z','PRODUCTION_READY_EDITION_DATE_MISMATCH'],
 ['verification previous edition',x=>proof(x).recordedAt='2026-11-16T13:29:00Z','PUBLICATION_VERIFICATION_EDITION_DATE_MISMATCH']
]){const x=good();mutate(x);policyCase(label,x,'HOLD',issue);}
for(const [field,value] of [['authenticated',false],['immutable',false],['originalAttemptVerified',false],['metadataBindingsVerified',false],['verifierContractVerified',false],['repository','other/repo'],['workflowPath','.github/workflows/quality.yml'],['runId',999],['runAttempt',2],['sourceRunId',999],['sourceRunAttempt',2],['sourceHeadSha',HEAD],['prNumber',999],['prHeadSha',BASE],['mergeSha',BASE],['deploymentId','dpl_other'],['verifierSourceSha',HEAD],['editionDate','2026-11-16'],['editionUrl','https://example.invalid/']]){
 const x=good();proof(x)[field]=value;policyCase('original proof binding '+field,x,'HOLD','ORIGINAL_PUBLICATION_VERIFICATION_NOT_BOUND');
}
for(const [label,mutate,issue] of [
 ['recovery log wrong job',x=>x.evidence.publisher.recoveryLogReceipt.jobId=999,'ORIGINAL_VERIFICATION_RECOVERY_LOG_MISMATCH'],
 ['recovery log different artifact',x=>x.evidence.publisher.recoveryLogReceipt.sha256='9'.repeat(64),'ORIGINAL_VERIFICATION_RECOVERY_LOG_MISMATCH'],
 ['recovery log different verification instant',x=>x.evidence.publisher.recoveryLogReceipt.recordedAt='2026-11-17T10:53:49Z','ORIGINAL_VERIFICATION_RECOVERY_LOG_MISMATCH'],
 ['recovery summary wrong job',x=>x.evidence.publisher.recoveryReceipt.jobId=999,'ORIGINAL_VERIFICATION_RECOVERY_SUMMARY_MISMATCH'],
 ['summary cannot have full log digest',x=>x.evidence.publisher.recoveryReceipt.sha256=proof(x).sha256,'ORIGINAL_VERIFICATION_RECOVERY_SUMMARY_MISMATCH'],
 ['summary before verification',x=>x.evidence.publisher.recoveryReceipt.recordedAt='2026-11-17T10:53:49Z','ORIGINAL_VERIFICATION_RECOVERY_SUMMARY_MISMATCH']
]){const x=good('2026-11-17',true);mutate(x);policyCase(label,x,'HOLD',issue);}
function poll(x,n=1){return {...ledger(x).requests[0],clientRequestId:'synthetic-poll-'+n,operation:'status-poll',method:'GET',billingState:'not-chargeable',chargedMicrousd:0,submittedAt:offset(x.evidence.sourceRun.createdAt,20+n)};}
{
 const x=good();for(let n=1;n<=50;n++)ledger(x).requests.push(poll(x,n));
 policyCase('one generation plus fifty polls consumes one slot',x,'NATIVE_AUTO_VERIFIED');
}
{
 const x=good();x.evidence.editorial.budget.spentUsd=0;ledger(x).requests[0].chargedMicrousd=0;
 policyCase('known settled zero cost still consumes generation slot',x,'NATIVE_AUTO_VERIFIED');
}
for(const [label,mutate,issue] of [
 ['missing request ledger',x=>delete x.evidence.editorial.budget.requestAccounting,'PAID_REQUEST_LEDGER_MISSING'],
 ['unknown charge is not free',x=>ledger(x).requests[0].billingState='unknown','GENERATION_CHARGE_UNRESOLVED'],
 ['charge absent',x=>ledger(x).requests[0].chargedMicrousd=null,'GENERATION_CHARGE_UNRESOLVED'],
 ['provider receipt missing',x=>ledger(x).requests[0].providerRequestId=null,'GENERATION_CHARGE_UNRESOLVED'],
 ['generation labelled not chargeable',x=>ledger(x).requests[0].billingState='not-chargeable','GENERATION_CHARGE_UNRESOLVED'],
 ['generation GET',x=>ledger(x).requests[0].method='GET','PAID_REQUEST_OPERATION_INVALID'],
 ['no generation records',x=>ledger(x).requests=[],'PAID_GENERATION_REQUEST_CAP_OR_COUNT_MISMATCH'],
 ['regeneration inside same run counted',x=>ledger(x).requests.push({...ledger(x).requests[0],clientRequestId:'create-2',providerRequestId:'provider-2'}),'PAID_GENERATION_REQUEST_CAP_OR_COUNT_MISMATCH'],
 ['same provider ID cannot deduplicate separate POSTs',x=>ledger(x).requests.push({...ledger(x).requests[0],clientRequestId:'create-2'}),'PAID_GENERATION_REQUEST_CAP_OR_COUNT_MISMATCH'],
 ['duplicate client ID',x=>ledger(x).requests.push({...ledger(x).requests[0]}),'PAID_REQUEST_IDS_NOT_DISTINCT'],
 ['underreported cost',x=>ledger(x).requests[0].chargedMicrousd=10001,'PAID_REQUEST_COST_RECONCILIATION_FAILED'],
 ['exceeded dollar cap',x=>{ledger(x).requests[0].chargedMicrousd=30000;x.evidence.editorial.budget.spentUsd=0.03;},'PAID_REQUEST_COST_RECONCILIATION_FAILED'],
 ['unsupported precision',x=>x.evidence.editorial.budget.spentUsd=0.0100001,'PAID_REQUEST_COST_RECONCILIATION_FAILED'],
 ['relabel create as poll',x=>{ledger(x).requests[0].operation='status-poll';ledger(x).requests[0].method='GET';},'PAID_GENERATION_REQUEST_CAP_OR_COUNT_MISMATCH']
]){const x=good();mutate(x);policyCase(label,x,'HOLD',issue);}
for(const [field,value] of [['authenticated',false],['immutable',false],['complete',false],['paginationComplete',false],['allSubmissionAttemptsIncluded',false],['repository','other/repo'],['editionDate','2026-11-16'],['observedAt','2026-11-17T19:00:59Z'],['observedAt','2026-11-18T00:00:00Z']]){
 const x=good();ledger(x)[field]=value;policyCase('ledger completeness '+field,x,'HOLD','PAID_REQUEST_LEDGER_NOT_VERIFIED');
}
for(const [field,value] of [['independentlyVerified',false],['editionDate','2026-11-16'],['maxGenerationRequests',2],['limitUsd',1]]){
 const x=good();ledger(x).authorization[field]=value;policyCase('no budget expansion '+field,x,'HOLD','PAID_REQUEST_BUDGET_AUTHORITY_NOT_VERIFIED');
}
for(const [field,value] of [['authenticated',false],['originalAttemptVerified',false],['sourceRunId',999],['sourceRunAttempt',2],['sourceHeadSha',HEAD],['editionDate','2026-11-16'],['submittedAt','2026-11-17T09:19:59Z'],['submittedAt','2026-11-17T09:22:00.001Z']]){
 const x=good();ledger(x).requests[0][field]=value;policyCase('request binding '+field+'/'+value,x,'HOLD','PAID_REQUEST_IDENTITY_OR_TIME_INVALID');
}
for(const [field,value] of [['method','POST'],['billingState','unknown'],['chargedMicrousd',1],['providerRequestId','other'],['submittedAt','2026-11-17T09:20:09Z']]){
 const x=good();const row=poll(x);row[field]=value;ledger(x).requests.push(row);policyCase('poll cannot hide paid POST '+field,x,'HOLD','STATUS_POLL_NOT_VERIFIED');
}
{
 const x=good('2026-11-17',true);x.evidence.recoveryOrigin={kind:'external-wake'};
 ledger(x).requests.push({...ledger(x).requests[0],clientRequestId:'create-2'});
 policyCase('provisional origin does not hide paid request breach',x,'HOLD','PAID_GENERATION_REQUEST_CAP_OR_COUNT_MISMATCH');
}
{
 const x=good();x.evidence.pr.merged=false;x.evidence.healthRun.report.authenticated=false;
 const v=policyCase('native lineage failure no longer hides bad Health report',x,'HOLD','PR_PROTECTED_LINEAGE_NOT_VERIFIED');
 assert.ok(v.issues.includes('HEALTH_ORIGINAL_REPORT_NOT_BOUND'));
}
for(const [state,conclusion] of [['healthy','success'],['unhealthy','failure']]){
 const x=good('2026-11-17',true);x.evidence.healthRun={...good().evidence.healthRun,state,conclusion,report:state==='healthy'?{...good().evidence.healthRun.report,sourceRunId:999}:null};
 const v=policyCase('approved terminal recovery HOLD '+state,x,'HOLD','RECOVERY_TERMINAL_HEALTH_HOLD');
 assert.equal(v.accepted,false);assert.equal(v.nativeHealthy,false);assert.equal(v.nativeHealth.state,'unknown');
}
{
 const x=good('2026-11-17',true);
 x.evidence.publisher.recoveryLogReceipt.recordedAt='2026-11-17T10:53:50Z';
 policyCase('equivalent log timestamp representation',x,'UNATTENDED_RECOVERY_VERIFIED');
}
{
 const x=good();x.evidence.editorial.budget.approvedMaxGenerations=2;
 ledger(x).authorization.maxGenerationRequests=2;
 policyCase('even matching caller caps cannot increase fixed ceiling',x,'HOLD','PAID_REQUEST_BUDGET_AUTHORITY_NOT_VERIFIED');
}
counts.ownerPolicy=receipts.length;
console.log('OWNER_POLICY_REGRESSIONS '+JSON.stringify(receipts));
}

// V5: findings from the independently supplied v3 review. All data synthetic.
{
const rows = [];
function review5(label, input, expected, required = []) {
  assert.ok(!rows.some(row => row.label === label), 'duplicate V5 scenario label');
  const v = classifyDailyPhase1a(input); invariant(v);
  assert.equal(v.evidenceClass, expected, label + ': ' + JSON.stringify(v.issues));
  for (const code of required) assert.ok(v.issues.includes(code), label + ': missing ' + code);
  assert.ok(Object.isFrozen(v.nativeHealth)); assert.ok(Object.isFrozen(v.warnings));
  if (v.evidenceClass !== 'NATIVE_AUTO_VERIFIED') {
    assert.equal(v.nativeHealth.sourceRunId, null, label + ': unverified source presented as verified');
    if (['healthy', 'unhealthy'].includes(v.nativeHealth.reportedState))
      assert.equal(v.nativeHealth.state, 'unknown', label);
  }
  rows.push({label, evidenceClass:v.evidenceClass, issues:v.issues});
  return v;
}
function externalComplete() {
  const x=good('2026-11-17',true);
  x.evidence.recoveryOrigin.kind='external-wake';
  x.evidence.recoveryOrigin.nominalSlot=null;
  x.evidence.recoveryOrigin.run.event='workflow_dispatch';
  return x;
}
{
 const x=externalComplete(),v=review5('truthful complete external wake is provisional only',x,'RECOVERY_PROVISIONAL',['RECOVERY_ORIGIN_NOT_CERTIFIED']);
 assert.equal(v.reportVerified,false); assert.equal(v.recoveryVerified,false);
 assert.equal(v.latency.recovery.nominalBackstopAt,null);
 assert.equal(v.latency.recovery.backstopSchedulerDelayMs,null);
 assert.ok(!v.issues.includes('RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'));
}
for(const [label,mutate,code] of [
 ['source human',x=>x.evidence.sourceRun.actor='usdimpact','RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
 ['publisher human',x=>x.evidence.publisher.triggeringActor='usdimpact','RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
 ['summary missing',x=>x.evidence.publisher.recoveryReceipt=null,'RECOVERY_PUBLISHER_RECEIPT_NOT_BOUND'],
 ['log missing',x=>x.evidence.publisher.recoveryLogReceipt=null,'RECOVERY_PUBLISHER_LOG_NOT_BOUND'],
 ['failed backstop',x=>x.evidence.recoveryOrigin.run.conclusion='failure','BACKSTOP_NOT_SUCCESS'],
 ['wrong workflow',x=>x.evidence.recoveryOrigin.run.workflowPath='.github/workflows/quality.yml','BACKSTOP_IDENTITY_INVALID'],
 ['wrong event',x=>x.evidence.recoveryOrigin.run.event='push','RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
 ['record falsely claims schedule',x=>x.evidence.recoveryOrigin.run.event='schedule','RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED'],
 ['wrong summary binding',x=>x.evidence.recoveryOrigin.receipt.sourceRunId=999,'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND'],
 ['backstop after source',x=>x.evidence.recoveryOrigin.run.createdAt='2026-11-17T10:49:00Z','RECOVERY_ORIGIN_CHRONOLOGY_INVALID'],
 ['receipt without run',x=>x.evidence.recoveryOrigin.run=null,'RECOVERY_ORIGINAL_RECEIPT_NOT_BOUND']
]) { const x=externalComplete();mutate(x);review5('complete wake does not conceal '+label,x,'HOLD',[code,'RECOVERY_ORIGIN_NOT_CERTIFIED']); }
{
 const x=externalComplete();x.evidence.recoveryOrigin.nominalSlot='11:07';
 const v=review5('external nominal label cannot create scheduled latency',x,'RECOVERY_PROVISIONAL');
 assert.equal(v.latency.recovery.nominalBackstopAt,null);
}
{
 const x=good('2026-11-17',true);x.evidence.recoveryOrigin.run.event='workflow_dispatch';
 review5('native backstop still requires schedule event',x,'HOLD',['RECOVERY_MACHINE_ORIGIN_NOT_VERIFIED']);
}
for(const event of ['schedule','workflow_dispatch']) {
 const x=good('2026-11-17',true);x.evidence.recoveryOrigin.kind='human-correlation';x.evidence.recoveryOrigin.run.event=event;
 const v=review5('human correlation remains provisional with '+event,x,'RECOVERY_PROVISIONAL');
 assert.equal(v.reportVerified,false); assert.equal(v.latency.recovery.nominalBackstopAt,null);
}
for(const id of [101,102,103,105,501,401,402,403,404]) {
 const x=good('2026-11-17',true);x.evidence.healthRun=clone(good().evidence.healthRun);
 x.evidence.healthRun.report.sourceRunId=id;
 const v=review5('reject all known nonscheduled source IDs '+id,x,'HOLD',['RECOVERY_HEALTH_SOURCE_NOT_SCHEDULED','RECOVERY_TERMINAL_HEALTH_HOLD']);
 assert.equal(v.nativeHealth.reportedSourceRunId,id);
}
for(const id of [106,999,201]) {
 const x=good('2026-11-17',true);x.evidence.healthRun=clone(good().evidence.healthRun);x.evidence.healthRun.report.sourceRunId=id;
 const v=review5('unknown run ID is not falsely authenticated '+id,x,'HOLD',['RECOVERY_TERMINAL_HEALTH_HOLD']);
 assert.ok(!v.issues.includes('RECOVERY_HEALTH_SOURCE_NOT_SCHEDULED'));
}
for(const [label,mutate,issue] of [
 ['PR unmerged',x=>x.evidence.pr.merged=false,'PR_PROTECTED_LINEAGE_NOT_VERIFIED'],
 ['rights absent',x=>x.evidence.editorial.rightsCleared=false,'EDITORIAL_OR_RIGHTS_NOT_VERIFIED'],
 ['unbound Health',x=>x.evidence.healthRun.report.sourceRunId=999,'HEALTH_ORIGINAL_REPORT_NOT_BOUND'],
 ['unsuccessful check',x=>x.evidence.pr.checks.webQuality.conclusion='failure','EXACT_HEAD_CHECK_NOT_VERIFIED:webQuality']
]) {
 const x=good();mutate(x);const v=review5('native HOLD displays only reported claim: '+label,x,'HOLD',[issue]);
 assert.equal(v.nativeHealth.reportedState,'healthy');assert.equal(v.nativeHealth.state,'unknown');
 assert.equal(v.nativeHealth.reportedSourceRunId,x.evidence.healthRun.report.sourceRunId);
}
{
 const v=review5('healthy native result exposes a verified source ID',good(),'NATIVE_AUTO_VERIFIED');
 assert.equal(v.nativeHealth.sourceRunId,101); assert.equal(v.nativeHealth.reportedSourceRunId,101);
 assert.equal(v.nativeHealth.state,'healthy');assert.equal(v.nativeHealth.verified,true);
}
const fresh=x=>x.evidence.healthRun.freshness;
for(const [field,value] of [
 ['authenticated',false],['immutable',false],['originalAttemptVerified',false],['metadataBindingsVerified',false],
 ['sourceTimestampFromOriginalReport',false],['evaluationBoundsVerified',false],
 ['runId',999],['runAttempt',2],['jobId',999],['reportSha256','f'.repeat(64)],
 ['sourceRunId',999],['sourceRunAttempt',2],['sourceCreatedAt','2026-11-17T09:19:59Z'],
 ['maxAgeSeconds',43_201],['maxAgeSeconds',86_400],['maxAgeSeconds',0]
]) {const x=good();fresh(x)[field]=value;review5('freshness authority/binding '+field+'/'+value,x,'HOLD',['HEALTH_FRESHNESS_EVIDENCE_NOT_BOUND']);}
for(const [label,mutate,issue] of [
 ['missing proof',x=>delete x.evidence.healthRun.freshness,'HEALTH_FRESHNESS_EVIDENCE_MISSING'],
 ['unknown format',x=>fresh(x).kind='provider-timestamp','EVIDENCE_INVALID:healthRun'],
 ['proof omits required field',x=>delete fresh(x).evaluatedNoEarlierThan,'EVIDENCE_INVALID:healthRun'],
 ['missing updated_at without fallback',x=>fresh(x).sourceUpdatedAt=null,'HEALTH_SOURCE_TIMESTAMP_INCONSISTENT'],
 ['fallback while updated_at exists',x=>fresh(x).timestampBasis='created_at-fallback','HEALTH_SOURCE_TIMESTAMP_INCONSISTENT'],
 ['source timestamp before creation',x=>fresh(x).sourceUpdatedAt='2026-11-17T09:19:59Z','HEALTH_SOURCE_TIMESTAMP_INCONSISTENT'],
 ['source timestamp after assessment',x=>fresh(x).sourceUpdatedAt='2026-11-17T18:55:00.001Z','HEALTH_SOURCE_TIMESTAMP_INCONSISTENT'],
 ['window before Health run',x=>fresh(x).evaluatedNoEarlierThan='2026-11-17T18:54:59Z','HEALTH_FRESHNESS_CLOCK_WINDOW_INVALID'],
 ['window reversed',x=>fresh(x).evaluatedNoLaterThan='2026-11-17T18:54:59Z','HEALTH_FRESHNESS_CLOCK_WINDOW_INVALID'],
 ['window after report',x=>fresh(x).evaluatedNoLaterThan='2026-11-17T18:55:30.001Z','HEALTH_FRESHNESS_CLOCK_WINDOW_INVALID'],
 ['window after completion',x=>fresh(x).evaluatedNoLaterThan='2026-11-17T18:56:01Z','HEALTH_FRESHNESS_CLOCK_WINDOW_INVALID'],
 ['date not UTC',x=>fresh(x).evaluatedNoEarlierThan='2026-11-17T19:55:00+01:00','EVIDENCE_INVALID:healthRun']
]) {const x=good();mutate(x);review5('freshness invalid '+label,x,'HOLD',[issue]);}
{
 const x=good();fresh(x).sourceUpdatedAt=null;fresh(x).timestampBasis='created_at-fallback';
 review5('actual created_at fallback is allowed with original snapshot proof',x,'NATIVE_AUTO_VERIFIED');
}
function assessment(x,early,late=early) {
 const h=x.evidence.healthRun;
 h.createdAt=offset(early,-5);h.completedAt=offset(late,5);h.report.recordedAt=offset(late,1);
 h.freshness=makeFreshnessEvidence(x.evidence.sourceRun,h);
 h.freshness.evaluatedNoEarlierThan=early;h.freshness.evaluatedNoLaterThan=late;
 const after=offset(h.completedAt,60);
 x.evidence.editorial.history.observedAt=after;
 x.evidence.editorial.budget.observedAt=after;
 x.evidence.editorial.budget.requestAccounting.observedAt=after;
 x.now=offset(after,60);
 return x;
}
for(const [label,at,expected,issue] of [
 ['one second before limit','2026-11-17T21:21:59Z','NATIVE_AUTO_VERIFIED',null],
 ['exact twelve hours is permitted','2026-11-17T21:22:00Z','NATIVE_AUTO_VERIFIED',null],
 ['same Unix second with milliseconds','2026-11-17T21:22:00.999Z','NATIVE_AUTO_VERIFIED',null],
 ['one full second beyond limit','2026-11-17T21:22:01Z','HOLD','HEALTH_SOURCE_STALE'],
 ['false healthy more than fourteen hours later','2026-11-18T00:03:30Z','HOLD','HEALTH_SOURCE_STALE']
]) {review5(label,assessment(good(),at),expected,issue?[issue]:[]);}
{
 const x=assessment(good(),'2026-11-17T21:21:59Z','2026-11-17T21:22:01Z');
 review5('straddled limit is unknown assessment, not falsely healthy',x,'HOLD',['HEALTH_FRESHNESS_BOUNDARY_UNCERTAIN']);
}
{
 const x=good();x.now='2026-11-18T00:30:00Z';
 review5('next-day acceptance preserves earlier fresh actual Health assessment',x,'NATIVE_AUTO_VERIFIED');
}
{
 const x=assessment(good(),'2026-11-17T21:22:01Z');
 x.evidence.healthRun.createdAt='2026-11-17T21:21:59Z';
 review5('run started before expiry but actual evaluation after expiry',x,'HOLD',['HEALTH_SOURCE_STALE']);
}
{
 const x=assessment(good(),'2026-11-17T21:21:59Z');
 x.evidence.healthRun.report.recordedAt='2026-11-17T21:23:00Z';
 x.evidence.healthRun.completedAt='2026-11-17T21:23:01Z';
 for(const r of [x.evidence.editorial.history,x.evidence.editorial.budget,x.evidence.editorial.budget.requestAccounting])r.observedAt='2026-11-17T21:24:00Z';
 x.now='2026-11-17T21:25:00Z';
 review5('later report emission does not replace proven earlier evaluation',x,'NATIVE_AUTO_VERIFIED');
}
{
 const x=assessment(good(),'2026-11-18T00:03:30Z');
 // Explicit synthetic original Last updated snapshot, not inferred from completedAt.
 fresh(x).sourceUpdatedAt='2026-11-17T12:10:00Z';
 review5('original updated_at is not silently replaced by source completedAt',x,'NATIVE_AUTO_VERIFIED');
}
{
 const x=assessment(good(),'2026-11-18T00:03:30Z');
 fresh(x).sourceUpdatedAt='2026-11-17T12:10:00Z';fresh(x).sourceTimestampFromOriginalReport=false;
 review5('a later API timestamp without original report proof cannot renew age',x,'HOLD',['HEALTH_FRESHNESS_EVIDENCE_NOT_BOUND']);
}
{
 const x=assessment(good(),'2026-11-17T21:20:00Z');fresh(x).sourceUpdatedAt=null;fresh(x).timestampBasis='created_at-fallback';
 review5('created_at fallback at exact twelve-hour limit',x,'NATIVE_AUTO_VERIFIED');
}
{
 const x=assessment(good(),'2026-11-17T21:20:01Z');fresh(x).sourceUpdatedAt=null;fresh(x).timestampBasis='created_at-fallback';
 review5('created_at fallback one second stale',x,'HOLD',['HEALTH_SOURCE_STALE']);
}
for(const originKind of ['native-scheduled-backstop','external-wake','human-correlation']) {
 const x=good('2026-11-17',true);
 if(originKind==='external-wake') {x.evidence.recoveryOrigin.kind=originKind;x.evidence.recoveryOrigin.run.event='workflow_dispatch';}
 if(originKind==='human-correlation') x.evidence.recoveryOrigin.kind=originKind;
 x.evidence.healthRun=clone(good().evidence.healthRun);x.evidence.healthRun.report.sourceRunId=999;
 review5('all terminal recovery routes remain held '+originKind,x,'HOLD',['RECOVERY_TERMINAL_HEALTH_HOLD']);
}
counts.v5Review=rows.length;
console.log('V5_REVIEW_REGRESSIONS '+JSON.stringify(rows));
}

console.log('DEC026 Phase1a PASS ' + JSON.stringify({ ...counts, totalCases: Object.values(counts).reduce((sum, count) => sum + count, 0) }) + '; synthetic only; no external I/O.');
