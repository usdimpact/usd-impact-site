import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [about, methodology] = await Promise.all([
  readFile(new URL('../src/pages/about.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/score/methodology.astro', import.meta.url), 'utf8'),
]);

const vintageJson = 'https://usd-impact-pipeline.pages.dev/data/research/score_v2_vintage_comparison_latest.json';
const vintageCsv = 'https://usd-impact-pipeline.pages.dev/data/research/score_v2_vintage_comparison_latest.csv';
const dataSemantics = 'https://usd-impact-pipeline.pages.dev/data/score_v2_data_semantics.json';
const retentionPolicy = 'https://github.com/usdimpact/usd-impact-pipeline/blob/main/docs/source-retention-policy.md';

assert.match(about, /SC Kela Leads SRL/);
assert.match(about, /Mircea Albulescu/);
assert.match(about, /Exact product revenue and customers/);
assert.match(about, /Not publicly disclosed/);
assert.match(about, /Meaningful predictive power[\s\S]*Not established and not claimed/);
assert.match(about, /Genuine predictive out-of-sample test[\s\S]*Not completed/);
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
assert.doesNotMatch(methodology, /raw provider (responses|payloads) are archived/i);
assert.doesNotMatch(
  methodology,
  /The research files are current-vintage recalculations[\s\S]*not as-published historical vintages/,
);

console.log('Transparency-page contract passed.');
