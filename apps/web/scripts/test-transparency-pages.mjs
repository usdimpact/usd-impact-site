import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [about, methodology, onrcGate] = await Promise.all([
  readFile(new URL('../src/pages/about.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/score/methodology.astro', import.meta.url), 'utf8'),
  readFile(new URL('../../docs/operations/onrc-company-verification-gate.md', import.meta.url), 'utf8'),
]);

const vintageJson = 'https://usd-impact-pipeline.pages.dev/data/research/score_v2_vintage_comparison_latest.json';
const vintageCsv = 'https://usd-impact-pipeline.pages.dev/data/research/score_v2_vintage_comparison_latest.csv';
const dataSemantics = 'https://usd-impact-pipeline.pages.dev/data/score_v2_data_semantics.json';
const retentionPolicy = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/docs/source-retention-policy.md';
const predictiveProtocol = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/research/score_v2_predictive_preregistration.json';
const predictiveContract = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/research/score_v2_predictive_implementation_contract.json';
const predictiveEngineLock = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/research/score_v2_predictive_engine_lock.json';
const scoreV3Protocol = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/research/score_v3_preregistration.json';
const scoreV3MetricContract = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/research/score_v3_metric_implementation_contract.json';
const scoreV3EngineLock = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/research/score_v3_engine_lock.json';

assert.match(about, /SC Kela Leads SRL/);
assert.match(about, /CUI 40790448/);
assert.match(about, /J38\/820\/2020/);
assert.match(about, /Mircea Albulescu/);
assert.match(about, /first-party legal disclosure/);
assert.match(about, /current electronically issued ONRC company certificate has <strong>not yet been reviewed<\/strong>/);
assert.match(about, /Official registry verification/);
assert.match(about, /ONRC certificate review is pending/);
assert.match(about, /Current official ONRC company certificate/);
assert.match(about, /Issue #341/);
assert.match(about, /https:\/\/github\.com\/usdimpact\/usd-impact-site\/issues\/341/);
assert.match(about, /https:\/\/myportal\.onrc\.ro\//);
assert.match(about, /does not claim ONRC, registry or independent verification/);
assert.match(about, /first-party legal-operator disclosure, while clearly showing that current ONRC certificate review remains pending/);
assert.doesNotMatch(about, /<span class="status disclosed">(?:ONRC|Registry|Officially) verified<\/span>/i);
assert.doesNotMatch(about, /independently verified legal operator/i);
assert.doesNotMatch(about, /ONRC verified operator/i);

assert.match(onrcGate, /Tracking issue: #341/);
assert.match(onrcGate, /PENDING — authenticated ONRC certificate acquisition and review required/);
assert.match(onrcGate, /SHA-256 hash of the retained original/);
assert.match(onrcGate, /Do not commit it by default/);
assert.match(onrcGate, /registered-office comparison: PASS\/FAIL without printing the address/);
assert.match(onrcGate, /must not be described as independently verified, registry-verified, officially verified/);

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
assert.ok(about.includes(vintageJson), 'About page must link the revision-audit JSON.');
assert.ok(about.includes(vintageCsv), 'About page must link the revision-audit CSV.');
assert.ok(about.includes(dataSemantics), 'About page must link the data-semantics contract.');
assert.ok(about.includes(retentionPolicy), 'About page must link the source-retention policy.');
assert.match(about, /one same-run provider snapshot feeds the score and reproduction bundle/);
assert.match(about, /provider-derived daily histories before forward fill/);
assert.match(about, /complete weekly matrix/);
assert.match(about, /Complete raw provider responses remain unarchived and are not publicly redistributed/);
assert.doesNotMatch(about, /Partially implemented: dated publications exist/);

assert.ok(methodology.includes(vintageJson), 'Methodology page must link the revision-audit JSON.');
assert.ok(methodology.includes(vintageCsv), 'Methodology page must link the revision-audit CSV.');
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

console.log('Transparency-page contract passed.');
