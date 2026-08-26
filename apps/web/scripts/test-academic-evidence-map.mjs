import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/data/academic-evidence-map.json', import.meta.url);
const publicUrl = new URL('../public/data/research/academic-evidence-map.json', import.meta.url);
const pageUrl = new URL('../src/pages/research/evidence-map.astro', import.meta.url);
const replicationPageUrl = new URL('../src/pages/research/independent-replication.astro', import.meta.url);
const layoutUrl = new URL('../src/layouts/BaseLayout.astro', import.meta.url);

const [sourceText, publicText, page, replicationPage, layout] = await Promise.all([
  readFile(sourceUrl, 'utf8'),
  readFile(publicUrl, 'utf8'),
  readFile(pageUrl, 'utf8'),
  readFile(replicationPageUrl, 'utf8'),
  readFile(layoutUrl, 'utf8'),
]);

assert.equal(publicText, sourceText, 'Public academic evidence JSON must exactly match the source-controlled contract.');

const map = JSON.parse(sourceText);
assert.equal(map.version, 1);
assert.match(map.as_of, /^20\d{2}-\d{2}-\d{2}$/);
assert.match(map.scope, /does not claim/i);
assert.match(map.scope, /reviewed, validated, endorsed, audited, or approved/i);
assert.match(map.score_boundary, /signs, variables, weights, normalization and regime thresholds remain USD Impact specification choices/i);
assert.match(map.score_boundary, /does not establish predictive power/i);
assert.ok(Array.isArray(map.entries));
assert.equal(map.entries.length, 8, 'Academic evidence map must contain the reviewed eight-concept baseline.');

const ids = new Set();
const allowedHosts = new Set([
  'www.bis.org',
  'www.federalreserve.gov',
  'www.nber.org',
]);

function normalizeSources(entry) {
  if (entry.external_source) return [entry.external_source];
  if (Array.isArray(entry.external_sources)) return entry.external_sources;
  return [];
}

for (const entry of map.entries) {
  assert.equal(typeof entry.id, 'string');
  assert.match(entry.id, /^[a-z0-9-]+$/);
  assert.equal(ids.has(entry.id), false, `Duplicate evidence-map id: ${entry.id}`);
  ids.add(entry.id);

  for (const field of ['concept', 'usd_impact_area', 'external_finding', 'supports', 'does_not_support', 'usd_impact_status']) {
    assert.equal(typeof entry[field], 'string', `${entry.id}.${field} must be a string.`);
    assert.ok(entry[field].trim().length >= 12, `${entry.id}.${field} is unexpectedly short.`);
  }

  const sources = normalizeSources(entry);
  assert.ok(sources.length >= 1, `${entry.id} must have at least one external source.`);
  for (const source of sources) {
    assert.equal(typeof source.institution, 'string');
    assert.equal(typeof source.title, 'string');
    assert.equal(Number.isInteger(source.year), true);
    const parsed = new URL(source.url);
    assert.equal(parsed.protocol, 'https:', `${entry.id} source must use HTTPS.`);
    assert.equal(allowedHosts.has(parsed.hostname), true, `${entry.id} source host is outside the reviewed allow-list: ${parsed.hostname}`);
  }

  assert.match(entry.does_not_support, /(does not|not |or |a claim|a fixed|a universal|treating|permanent|stable inverse)/i);
  assert.doesNotMatch(entry.supports, /predictive power|validated by|endorsed by|proven alpha|forecast returns/i);
}

assert.equal(ids.has('global-dollar-funding'), true);
assert.equal(ids.has('dominant-currency-pricing'), true);
assert.equal(ids.has('broad-dollar-measurement'), true);
assert.equal(ids.has('dollar-financial-channel'), true);
assert.equal(ids.has('global-financial-cycle'), true);
assert.equal(ids.has('gold-real-rates'), true);
assert.equal(ids.has('oil-multicausal'), true);
assert.equal(ids.has('foreign-currency-funding-risk'), true);

assert.match(page, /Academic Evidence Map/);
assert.match(page, /Concept support is not Score validation/);
assert.match(page, /External finding/);
assert.match(page, /Does not support/);
assert.match(page, /Internal assumption/);
assert.match(page, /0[\s\S]*external endorsements claimed/);
assert.ok(page.includes('/data/research/academic-evidence-map.json'));
assert.ok(page.includes('/score/methodology/'));
assert.ok(page.includes('/about/'));
assert.ok(page.includes('/framework/three-dial-dashboard/'));
assert.doesNotMatch(page, /our research proves|externally validated score|academic validation of USD Impact|endorsed by (?:BIS|the Federal Reserve|NBER)/i);

const protocolUrl = 'https://score.usd-impact.com/data/research/independent_replication_protocol.json';
const trackerUrl = 'https://github.com/usdimpact/usd-impact-pipeline/issues/70';
assert.match(replicationPage, /Independent Score Replication/);
assert.match(replicationPage, /Prepared — not executed/);
assert.match(replicationPage, /No independent result yet/);
assert.match(replicationPage, /has <strong>not<\/strong> yet been completed/);
assert.match(replicationPage, /August 28, 2026/);
assert.match(replicationPage, /First-party controls stay first-party/);
assert.match(replicationPage, /MATCH/);
assert.match(replicationPage, /MISMATCH/);
assert.match(replicationPage, /AMBIGUOUS/);
assert.match(replicationPage, /NOT TESTABLE/);
assert.match(replicationPage, /does not claim independent validation, audit, endorsement or verified model performance/i);
assert.match(replicationPage, /would not establish predictive power, future returns or trading value/i);
assert.match(replicationPage, /Complete original Yahoo\/FRED response payloads and full provider-derived histories are not publicly redistributed/i);
assert.ok(replicationPage.includes(protocolUrl));
assert.ok(replicationPage.includes(trackerUrl));
assert.ok(replicationPage.includes('/research/evidence-map/'));
assert.ok(replicationPage.includes('/score/methodology/'));
assert.ok(replicationPage.includes('/about/'));
assert.doesNotMatch(replicationPage, /independently validated|independent validation complete|externally audited|verified predictive power/i);
assert.ok(layout.includes('/research/independent-replication/'), 'Global footer must expose independent replication status.');

console.log('Academic evidence and independent replication transparency contracts passed.');
