import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  SAFE_SCORE_SCHEMA_VERSION,
  SAFE_SCORE_SOURCE_PIPELINE,
  validatePublicSafeScore,
} from './score-public-safe-report-prototype.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = path.resolve(webRoot, '..', '..');
const fixture = JSON.parse(await readFile(
  new URL('./fixtures/score-v21e-site-quarantine-2026-10-28.json', import.meta.url),
  'utf8',
));

async function source(relative) {
  return readFile(path.join(repoRoot, relative), 'utf8');
}

const expectedSeries = [
  'H10/H10/JRXWTFB_N.B',
  'WPU0561',
  'H8/H8/B1001NCBA',
  'H41/H41/RESPPALDP_N.WW',
  'H41/H41/RESPPA_N.WW',
  'H15/H15/RIFLGFCY10_XII_N.B',
  'H15/H15/RIFLGFCY02_N.B',
  'H15/H15/RIFLGFCY10_N.B',
];

function syntheticScore(pipeline, schemaVersion = SAFE_SCORE_SCHEMA_VERSION) {
  return {
    schema_version: schemaVersion,
    metadata: {
      pipeline,
      generated_at_utc: '2026-10-23T22:00:00Z',
      n_weeks: 1,
      weights: { USD: 0.125 },
    },
    latest: {
      week_ending: '2026-10-23',
      score: -0.5,
      regime: 'Soft dollar regime',
      week_over_week_change: 0,
      four_week_change: 0,
    },
    history: [{ date: '2026-10-23', score: -0.5, regime: 'Soft dollar regime' }],
    release_evidence: { aggregate_history_sha256: 'a'.repeat(64) },
  };
}

test('candidate is explicitly versioned and all upstream research/release gates remain closed', () => {
  assert.equal(fixture.schemaVersion, 'score-v21e-site-quarantine-v1');
  assert.equal(fixture.candidateVersion, '2.1E-design-candidate');
  assert.equal(fixture.candidateState, 'design_only');
  assert.equal(fixture.methodologyIdentity, 'distinct_not_an_equivalent_v2_source_swap');
  assert.equal(fixture.controllingRightsIssue,
    'https://github.com/usdimpact/usd-impact-pipeline/issues/155');
  assert.equal(fixture.replacementPlanningIssue,
    'https://github.com/usdimpact/usd-impact-pipeline/issues/179');
  assert.equal(fixture.frozenDesignMergeSha, '65e71695a3d99ed6a5584548652a61dc0e66006f');
  assert.equal(fixture.frozenPreregistrationMergeSha, 'b93ab1b4514e828561e74963b1a830421a104e29');
  assert.equal(fixture.authorizationPacketMergeSha, '4810d6546d511debf49b6e0afba57c265837f71d');
  assert.deepEqual(fixture.slots.map(entry => entry.series), expectedSeries);
  assert.equal(fixture.slots.length, 8);
  assert.equal(fixture.slots.filter(entry => entry.source === 'BLS').length, 1);
  assert.equal(fixture.slots.filter(entry => entry.source === 'Federal Reserve Board').length, 7);
  assert.deepEqual(new Set(fixture.slots.map(entry => entry.role)).size, 8);
  for (const field of [
    'sourceRightsCleared', 'realDataResearchAuthorized', 'liveSourceSwitchoverAuthorized',
    'researchLedgerMutationAuthorized', 'publicArtifactReplacementAuthorized',
    'productionActivationAuthorized', 'sitePublishCandidate', 'releaseAuthorized',
  ]) assert.equal(fixture[field], false, field + ' requires separate approval');
});

test('website Score v2 source and public-safe prototype cannot silently accept v2.1E', async () => {
  assert.equal(fixture.legacySiteProductionMethodology, 'v2');
  assert.equal(fixture.legacyAggregateSchema, SAFE_SCORE_SCHEMA_VERSION);
  assert.equal(fixture.legacyAggregatePipeline, SAFE_SCORE_SOURCE_PIPELINE);
  const score = await source('apps/web/src/pages/score.astro');
  const methodology = await source('apps/web/src/pages/score/methodology.astro');
  assert.match(score, /USD Impact Score v2 uses eight fixed-weight weekly market levels/);
  assert.match(methodology, /USD Impact Score v2 Methodology/);
  assert.ok(methodology.includes('0.125 × (DXY − WTI − SPX + VIX − BTC − GOLD + UST2Y + UST10Y)'));
  assert.match(score, /href="\/score\/member\/en\/"/);
  assert.equal(validatePublicSafeScore(syntheticScore(SAFE_SCORE_SOURCE_PIPELINE)).schemaVersion,
    SAFE_SCORE_SCHEMA_VERSION);
  for (const pipelineName of [
    'usd_impact_score_v2_1e',
    'score-v2.1E',
    '2.1E-design-candidate',
    'unknown-provider',
    'usd_impact_score_v2 ' + 'replacement',
  ]) {
    assert.throws(
      () => validatePublicSafeScore(syntheticScore(pipelineName)),
      /source identity|metadata.pipeline/,
      pipelineName,
    );
  }
  assert.throws(
    () => validatePublicSafeScore(syntheticScore(
      SAFE_SCORE_SOURCE_PIPELINE, 'score-public-v21e-unsafe-alias',
    )),
    /schema_version/,
  );
});

test('Score rights HOLD and Class-C component-derived public paths remain accurately classified', async () => {
  const siteRights = JSON.parse(await source('governance/score-derived-publication-rights-gate.json'));
  const consumer = JSON.parse(await source('apps/web/scripts/score-rights-consumer-manifest.json'));
  assert.equal(siteRights.state, 'hold');
  assert.equal(siteRights.decision_receipt, null);
  assert.equal(siteRights.approved_by, null);
  assert.equal(consumer.state, 'hold');
  assert.equal(consumer.production_change_authorized, false);
  assert.equal(consumer.weekly_report_publication_hold_required, true);
  assert.equal(consumer.historical_content_treatment_unresolved, true);
  for (const key of [
    '/data/usd_impact_score_v2.json',
    '/data/usd_impact_score_v2.csv',
    '/data/weekly_input_latest.json',
  ]) assert.equal(consumer.path_classes[key], 'C');
  assert.equal(consumer.runtime_consumers['apps/web/scripts/generate-weekly-report.mjs'].class, 'C');
});

test('protected Score delivery and public sample are not coupled to candidate promotion', async () => {
  const vercel = JSON.parse(await source('apps/web/vercel.json'));
  assert.ok(vercel.rewrites.some(r =>
    r.source === '/score/member/:path*' &&
    r.destination === '/api/account?action=score-member-content&path=:path*'));
  const memberHandler = await source('apps/web/src/lib/score-member-handler.js');
  assert.match(memberHandler, /RESEARCH_MEMBERSHIP_PRODUCT_ID/);
  assert.match(memberHandler, /resolveSessionWithRefresh/);
  const sample = await source('apps/web/src/pages/research/sample/index.astro');
  assert.ok(sample.includes("PUBLIC_SAMPLE_DATE = '2026-08-07'"));
  assert.ok(sample.includes('PUBLIC_SAMPLE_MIN_AGE_DAYS = 30'));
});

test('live Score sources and report generator do not import the new candidate series or version', async () => {
  const runtimePaths = [
    'apps/web/src/pages/score.astro',
    'apps/web/src/pages/score/methodology.astro',
    'apps/web/src/lib/score-pipeline-origin.js',
    'apps/web/src/lib/score-member-handler.js',
    'apps/web/src/lib/score-member-assets.js',
    'apps/web/src/lib/score-membership-handler.js',
    'apps/web/scripts/generate-weekly-report.mjs',
    '.github/workflows/weekly-report.yml',
  ];
  const forbidden = /2\.1e-design-candidate|score[-_ ]v2[.\-_]?1e|wpu0561|h10\/h10\/jrxwtfb_n\.b/i;
  const unexpected = [];
  for (const file of runtimePaths) {
    const text = await source(file);
    if (forbidden.test(text)) unexpected.push(file);
  }
  assert.deepEqual(unexpected, [],
    'Candidate version/series entered Score runtime without a separate methodology release');
});

console.log('Score v2.1E candidate quarantined from current website Score v2; no rights or release approved.');
