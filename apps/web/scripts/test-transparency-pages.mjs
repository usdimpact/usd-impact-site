import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  about,
  methodology,
  score,
  compliance,
  reports,
  onrcGate,
  frameworkPage,
  threeDialsComponent,
  threeDialsLib,
  threeDialsGenerator,
  threeDialsWorkflow,
  threeDialsFramework,
  threeDialsSourceLatest,
  threeDialsPublicLatest,
] = await Promise.all([
  readFile(new URL('../src/pages/about.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/score/methodology.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/score.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/compliance.md', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/reports/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../../../docs/operations/onrc-company-verification-gate.md', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/[...slug].astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/ThreeDialsSnapshot.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/three-dials.js', import.meta.url), 'utf8'),
  readFile(new URL('./generate-three-dials-snapshot.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../../../.github/workflows/three-dials-snapshot.yml', import.meta.url), 'utf8'),
  readFile(new URL('../src/content/frameworks/framework-three-dial-dashboard.md', import.meta.url), 'utf8'),
  readFile(new URL('../src/data/three-dials-latest.json', import.meta.url), 'utf8'),
  readFile(new URL('../public/data/three-dials/latest.json', import.meta.url), 'utf8'),
]);

const brandedScoreOrigin = 'https://score.usd-impact.com';
const legacyScoreOrigin = 'https://usd-impact-pipeline.pages.dev';
const vintageJson = `${brandedScoreOrigin}/data/research/score_v2_vintage_comparison_latest.json`;
const vintageCsv = `${brandedScoreOrigin}/data/research/score_v2_vintage_comparison_latest.csv`;
const dataSemantics = `${brandedScoreOrigin}/data/score_v2_data_semantics.json`;
const retentionPolicy = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/docs/source-retention-policy.md';
const predictiveProtocol = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/research/score_v2_predictive_preregistration.json';
const predictiveContract = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/research/score_v2_predictive_implementation_contract.json';
const predictiveEngineLock = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/research/score_v2_predictive_engine_lock.json';
const scoreV3Protocol = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/research/score_v3_preregistration.json';
const scoreV3MetricContract = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/research/score_v3_metric_implementation_contract.json';
const scoreV3EngineLock = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/research/score_v3_engine_lock.json';
const onrcIssueUrl = 'https://github.com/usdimpact/usd-impact-site/issues/341';
const onrcPortalUrl = 'https://myportal.onrc.ro/';
const aboutHrefs = new Set([...about.matchAll(/href="([^"]+)"/g)].map((match) => match[1]));

assert.match(about, /KELA LEADS S.R.L./);
assert.match(about, /CUI 40790448/);
assert.match(about, /J38\/820\/2020/);
assert.match(about, /ROONRC.J38\/820\/2020/);
assert.ok(about.includes('Str. Doctor Hacman nr. 28, bl. 83, sc. B, ap. 9, 240232 Râmnicu Vâlcea, România'));
assert.match(about, /streetAddress: 'Str\. Doctor Hacman nr\. 28, bl\. 83, sc\. B, ap\. 9'/);
assert.match(about, /postalCode: '240232'/);
assert.match(about, /addressLocality: 'Râmnicu Vâlcea'/);
assert.match(about, /Mircea Albulescu/);
assert.match(about, /separates verified facts, first-party disclosures and claims that have not been established/);
assert.match(about, /checked on August 28, 2026/);
assert.match(about, /issued on August 27, 2026 \(report 3178140\)/);
assert.match(about, /The company record has been checked/);
assert.match(about, /Current official ONRC company certificate/);
assert.match(about, /Official record checked/);
assert.match(about, /Electronically signed <em>Certificat constatator<\/em>, report 3178140/);
assert.match(about, /narrow company-record verification/);
assert.match(about, /Issue #341/);
assert.equal(aboutHrefs.has(onrcIssueUrl), true, 'About page must link the exact ONRC verification tracker URL.');
assert.equal(aboutHrefs.has(onrcPortalUrl), true, 'About page must link the exact official ONRC portal URL.');
assert.match(about, /not an independent audit, assurance engagement or ONRC endorsement/);
assert.doesNotMatch(about, /<span class="status disclosed">(?:ONRC|Registry|Officially) verified<\/span>/i);
assert.doesNotMatch(about, /independently verified legal operator/i);
assert.doesNotMatch(about, /ONRC verified operator/i);
assert.doesNotMatch(about, /\bCNP\b|identity-document|date of birth|bank or payout/i);

assert.match(onrcGate, /Tracking issue: #341/);
assert.match(onrcGate, /COMPLETE — reviewed on 2026-08-28 against the retained electronically signed ONRC certificate/);
assert.match(onrcGate, /does not need to be published merely to sell online/);
assert.match(onrcGate, /accurate buyer-facing trader information before public selling/);
assert.match(onrcGate, /ff8af906f214e983dff43bdc91d8dcaa8fd86c822fe65383e5bbafbf1ba21654/);
assert.match(onrcGate, /PDF signature integrity: PASS/);
assert.match(onrcGate, /OFICIUL NATIONAL AL REGISTRULUI COMERTULUI/);
assert.match(onrcGate, /Local certificate-chain validation: REQUIRES REVIEW/);
assert.match(onrcGate, /Exact legal-name comparison: PASS/);
assert.match(onrcGate, /Original retained in company-controlled storage: YES/);
assert.match(onrcGate, /Do not commit it by default/);
assert.match(onrcGate, /registered-office comparison: PASS\/FAIL without printing the address/);
assert.match(onrcGate, /does not verify the W-8 classification/);
assert.match(onrcGate, /not an independent assurance engagement or ONRC endorsement/);

assert.match(about, /Exact product revenue and customers/);
assert.match(about, /Not publicly disclosed/);
assert.match(about, /Meaningful predictive power[\s\S]*Not established and not claimed/);
assert.match(about, /Genuine predictive out-of-sample test[\s\S]*Preregistered; pending/);
assert.match(about, /first untouched origin on August 28, 2026/);
assert.match(about, /no result exists before 52 resolved future predictions/);
assert.ok(about.includes(predictiveProtocol), 'About page must link the predictive preregistration.');
assert.ok(about.includes(predictiveEngineLock), 'About page must link the predictive engine lock.');
assert.ok(about.includes(scoreV3Protocol), 'About page must link the Score v3 preregistration.');
assert.ok(about.includes(scoreV3MetricContract), 'About page must link the Score v3 metric contract.');
assert.ok(about.includes(scoreV3EngineLock), 'About page must link the Score v3 engine lock.');
assert.match(about, /no candidate can be selected before 52 completed future weeks/);
assert.match(about, /Score v2 remains the unchanged production methodology/);
assert.ok(about.includes(vintageJson), 'About page must link the revision-audit JSON on the branded Score origin.');
assert.ok(about.includes(vintageCsv), 'About page must link the revision-audit CSV on the branded Score origin.');
assert.ok(about.includes(dataSemantics), 'About page must link the data-semantics contract on the branded Score origin.');
assert.doesNotMatch(about, new RegExp(legacyScoreOrigin.replaceAll('.', '\\.')));
assert.ok(about.includes(retentionPolicy), 'About page must link the source-retention policy.');
assert.match(about, /one same-run provider snapshot feeds the score and reproduction bundle/);
assert.match(about, /provider-derived daily histories before forward fill/);
assert.match(about, /complete weekly matrix/);
assert.match(about, /Complete raw provider responses remain unarchived and are not publicly redistributed/);
assert.doesNotMatch(about, /Partially implemented: dated publications exist/);

assert.ok(methodology.includes(vintageJson), 'Methodology page must link the revision-audit JSON on the branded Score origin.');
assert.ok(methodology.includes(vintageCsv), 'Methodology page must link the revision-audit CSV on the branded Score origin.');
assert.doesNotMatch(methodology, new RegExp(legacyScoreOrigin.replaceAll('.', '\\.')));
assert.match(methodology, /As-published revision audit: published/);
assert.match(methodology, /cannot separate expanding-sample normalization effects from upstream provider revisions/);
assert.match(methodology, /not independently audited performance or evidence of future predictive power/);
assert.match(methodology, /one same-run provider snapshot creates the score/);
assert.ok(methodology.includes(retentionPolicy), 'Methodology page must link the source-retention policy.');
assert.match(methodology, /a hashes-only daily receipt and the weekly input matrix/);
assert.match(methodology, /per-driver and complete-matrix SHA-256 fingerprints/);
assert.match(methodology, /Original transport bytes are not hashed/);
assert.match(methodology, /provider-derived daily values are not published/);
assert.match(methodology, /complete raw provider responses are not archived or publicly redistributed/);
assert.match(methodology, /cannot independently reconstruct a changed provider history/);
assert.match(methodology, /True predictive out-of-sample test: preregistered, not started/);
assert.match(methodology, /requires 52 consecutive resolved predictions/);
assert.match(methodology, /have not begun; neither supplies present performance evidence/);
assert.ok(methodology.includes(predictiveProtocol), 'Methodology page must link the predictive preregistration.');
assert.ok(methodology.includes(predictiveContract), 'Methodology page must link the predictive implementation contract.');
assert.ok(methodology.includes(predictiveEngineLock), 'Methodology page must link the predictive engine lock.');
assert.ok(methodology.includes(scoreV3Protocol), 'Methodology page must link the Score v3 preregistration.');
assert.ok(methodology.includes(scoreV3MetricContract), 'Methodology page must link the Score v3 metric contract.');
assert.ok(methodology.includes(scoreV3EngineLock), 'Methodology page must link the Score v3 engine lock.');
assert.match(methodology, /Score v3 descriptive research: preregistered, not started/);
assert.match(methodology, /does not test predictive power, does not change production Score v2 and cannot automatically promote a candidate/);
assert.match(methodology, /neither supplies present performance evidence/);
assert.doesNotMatch(methodology, /raw provider (responses|payloads) are archived/i);
assert.doesNotMatch(
  methodology,
  /The research files are current-vintage recalculations[\s\S]*not as-published historical vintages/,
);

assert.match(score, /const vintageAuditUrl = scorePipelineUrl\('\/data\/research\/score_v2_vintage_comparison_latest\.html', scorePipelineOrigin\)/);
assert.match(score, /Audit historical revisions/);
assert.match(score, /valid as-published readings compare with the same weeks in the current recalculated history/);
assert.match(score, /Compare published vintages/);
assert.match(score, /PUBLIC_SCORE_PIPELINE_ORIGIN/);
assert.doesNotMatch(score, /https:\/\/usd-impact-pipeline\.pages\.dev/);
assert.doesNotMatch(score, /predictive performance|proven predictive power/i);

assert.match(compliance, /### Editorial and factual sourcing/);
assert.match(compliance, /### Quantitative model input providers/);
assert.match(compliance, /Yahoo Finance/);
assert.match(compliance, /accessible and reproducible market-data proxy/);
assert.match(compliance, /not represented as an exchange-official, primary-source, or licensed institutional market-data feed/);
assert.match(compliance, /DX-Y\.NYB/);
assert.match(compliance, /CL=F/);
assert.match(compliance, /\^GSPC/);
assert.match(compliance, /\^VIX/);
assert.match(compliance, /BTC-USD/);
assert.match(compliance, /GC=F/);
assert.match(compliance, /Two U\.S\. Treasury yield series are obtained through FRED/);
assert.match(compliance, /does not operate a real-time market-data feed/);
assert.match(compliance, /model output/);

assert.match(reports, /Completed input gate:<\/strong> 4 of 4 validated weekly briefs included in this published report/);
assert.match(reports, /Next monthly review cycle/);
assert.match(reports, /briefs collected for/);
assert.match(reports, /This counter starts a new cycle and includes only published weekly briefs after that completed period/);
assert.match(reports, /Next-cycle eligible briefs/);
assert.doesNotMatch(reports, /\{monthlyProgress\} of 4 briefs available/);

// Three-Dial framework boundaries: exactly three dials; broad USD is confirmation,
// real rates require TIPS, liquidity uses multiple evidence channels, and the Score is separate.
assert.match(threeDialsFramework, /Dial 1 — Dollar direction/);
assert.match(threeDialsFramework, /Do not create a separate “fourth dial” for broad USD/);
assert.match(threeDialsFramework, /Dial 2 — Real-rate pressure/);
assert.match(threeDialsFramework, /10-year TIPS yield direction/);
assert.match(threeDialsFramework, /Do not infer real-rate pressure from the nominal 10-year yield alone/);
assert.match(threeDialsFramework, /Dial 3 — Liquidity stress/);
assert.match(threeDialsFramework, /credit spreads widening or tightening/);
assert.match(threeDialsFramework, /funding-market or banking stress/);
assert.match(threeDialsFramework, /confidence label is a note about evidence quality, not a probability of future returns/);
assert.match(threeDialsFramework, /weekly USD Impact Score[\s\S]*separate systematic cross-asset indicator/);
assert.match(threeDialsFramework, /qualitative framework should not be presented as the Score formula/);

// Only the canonical Three-Dial framework route receives the current snapshot component.
assert.match(frameworkPage, /import ThreeDialsSnapshot from '\.\.\/components\/ThreeDialsSnapshot\.astro'/);
assert.match(frameworkPage, /const threeDialsSlug = '\/framework\/three-dial-dashboard'/);
assert.match(frameworkPage, /\{isThreeDialsPage && <ThreeDialsSnapshot \/>\}/);

// The public surface must keep evidence classes visually and semantically separate.
assert.match(threeDialsComponent, /Dated snapshot · not real-time/);
assert.match(threeDialsComponent, />Fact</);
assert.match(threeDialsComponent, />Interpretation</);
assert.match(threeDialsComponent, />Model output</);
assert.match(threeDialsComponent, /Completed observations with actual source dates and source links/);
assert.match(threeDialsComponent, /Open machine-readable snapshot JSON/);
assert.match(threeDialsComponent, /Read Score methodology/);
assert.match(threeDialsComponent, /Publication gate pending/);

// Display thresholds are fixed, transparent heuristics—not probabilities or Score inputs.
assert.match(threeDialsLib, /dollarFlatPct: 0\.10/);
assert.match(threeDialsLib, /yieldFlatBps: 5/);
assert.match(threeDialsLib, /hyOasFlatBps: 10/);
assert.match(threeDialsLib, /vixFlatPoints: 1\.0/);
assert.match(threeDialsLib, /fundingFlatBps: 3/);
assert.match(threeDialsLib, /Stress-led firm-dollar environment/);
assert.match(threeDialsLib, /Rate-led firm-dollar environment/);
assert.match(threeDialsLib, /Easier soft-dollar environment/);
assert.match(threeDialsLib, /Mixed \/ transitional environment/);
assert.match(threeDialsLib, /Descriptive interpretation of completed observations; not a forecast or trading signal/);
assert.doesNotMatch(threeDialsLib, /probability|expected return|buy|sell/i);

// Generator source and immutability contract.
for (const requiredSeries of ['DTWEXBGS', 'DFII10', 'DGS10', 'BAMLH0A0HYM2', 'VIXCLS', 'SOFR', 'IORB', 'DX-Y.NYB']) {
  assert.ok(threeDialsGenerator.includes(requiredSeries), `Three-Dials generator must bind ${requiredSeries}.`);
}
assert.match(threeDialsGenerator, /const FRED_ORIGIN = 'https:\/\/fred\.stlouisfed\.org'/);
assert.match(threeDialsGenerator, /const YAHOO_ORIGIN = 'https:\/\/query1\.finance\.yahoo\.com'/);
assert.match(threeDialsGenerator, /const SCORE_ORIGIN = 'https:\/\/score\.usd-impact\.com'/);
assert.match(threeDialsGenerator, /sourceClass: 'accessible_proxy'/);
assert.match(threeDialsGenerator, /not represented as exchange-official or a licensed institutional feed/);
assert.match(threeDialsGenerator, /third_party_via_fred/);
assert.match(threeDialsGenerator, /SOFR minus IORB funding spread/);
assert.match(threeDialsGenerator, /funding context, not a standalone liquidity measure/);
assert.match(threeDialsGenerator, /Immutable Three-Dials archive/);
assert.match(threeDialsGenerator, /archive\/\$\{targetWeek\}\.json/);
assert.match(threeDialsGenerator, /Weekly Score bridge is .* expected/);
assert.match(threeDialsGenerator, /Separate descriptive model output/);
assert.match(threeDialsGenerator, /Dated snapshot, not real-time market data/);
assert.doesNotMatch(threeDialsGenerator, new RegExp(legacyScoreOrigin.replaceAll('.', '\\.')));

// Scheduled publication must remain bounded, validated, PR-based, protected and fail-closed.
assert.match(threeDialsWorkflow, /name: Three Dials snapshot publication/);
assert.match(threeDialsWorkflow, /cron: '45 22 \* \* 1,2'/);
assert.match(threeDialsWorkflow, /workflow_dispatch:/);
assert.match(threeDialsWorkflow, /src\/data\/three-dials-latest\.json\|public\/data\/three-dials\/latest\.json\|public\/data\/three-dials\/archive\/\*\.json/);
assert.match(threeDialsWorkflow, /npm run validate/);
assert.match(threeDialsWorkflow, /npm run build/);
assert.match(threeDialsWorkflow, /generated-data-dependency-review\.yml/);
assert.match(threeDialsWorkflow, /gh run watch .* --exit-status/);
assert.match(threeDialsWorkflow, /gh pr create/);
assert.match(threeDialsWorkflow, /gh pr merge[\s\S]*--squash[\s\S]*--delete-branch[\s\S]*--match-head-commit/);
assert.doesNotMatch(threeDialsWorkflow, /gh pr merge[^\n]*--auto/);
assert.match(threeDialsWorkflow, /normal PR-triggered copies of those workflows ignore Three-Dials generated-data-only diffs/);
assert.match(threeDialsWorkflow, /workflow remained fail-closed/);
assert.doesNotMatch(threeDialsWorkflow, /git push origin main|git push .*HEAD:main/);

// The source-render copy and public machine-readable copy are always synchronized.
assert.equal(threeDialsSourceLatest, threeDialsPublicLatest, 'Three-Dials source/public latest JSON must be byte-identical.');
const threeDialsLatest = JSON.parse(threeDialsSourceLatest);
assert.equal(threeDialsLatest.version, 1);
assert.ok(['pending', 'published'].includes(threeDialsLatest.status));
if (threeDialsLatest.status === 'pending') {
  assert.match(threeDialsLatest.message, /No dated Three-Dials snapshot has been published yet/);
  assert.match(threeDialsLatest.scope, /source-freshness checks/);
  assert.match(threeDialsLatest.scope, /exact-week USD Impact Score bridge check/);
} else {
  assert.match(threeDialsLatest.week_ending, /^20\d{2}-\d{2}-\d{2}$/);
  assert.equal(threeDialsLatest.model_output.week_ending, threeDialsLatest.week_ending);
  assert.ok(threeDialsLatest.dials?.dollar);
  assert.ok(threeDialsLatest.dials?.real_rates);
  assert.ok(threeDialsLatest.dials?.liquidity_stress);
  assert.ok(Array.isArray(threeDialsLatest.disclosures) && threeDialsLatest.disclosures.length >= 5);
}

console.log('Transparency-page contract passed.');
