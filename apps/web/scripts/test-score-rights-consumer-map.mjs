import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(webRoot, '..', '..');
const pagesRoot = path.join(webRoot, 'src', 'pages');
const manifest = JSON.parse(
  await readFile(path.join(scriptDir, 'score-rights-consumer-manifest.json'), 'utf8'),
);

async function listAstroFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...await listAstroFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.astro')) out.push(full);
  }
  return out;
}

function extractDirectScorePaths(source) {
  const needle = 'https://score.usd-impact.com';
  const values = [];
  let cursor = 0;
  while (true) {
    const index = source.indexOf(needle, cursor);
    if (index < 0) break;
    const start = index + needle.length;
    let end = start;
    while (end < source.length && !["'", '"', ' ', '\n', '<', ')', '`'].includes(source[end])) end += 1;
    values.push(source.slice(start, end));
    cursor = end + 1;
  }
  return [...new Set(values)].sort();
}

function extractDynamicScorePaths(source) {
  const needle = "scorePipelineUrl('";
  const values = [];
  let cursor = 0;
  while (true) {
    const index = source.indexOf(needle, cursor);
    if (index < 0) break;
    const start = index + needle.length;
    const end = source.indexOf("'", start);
    assert.notEqual(end, -1, 'unterminated scorePipelineUrl path');
    values.push(source.slice(start, end));
    cursor = end + 1;
  }
  return [...new Set(values)].sort();
}

function relativePagePath(fullPath) {
  return path.relative(webRoot, fullPath).split(path.sep).join('/');
}

test('every Score-origin page consumer is declared exactly in the HOLD manifest', async () => {
  const files = await listAstroFiles(pagesRoot);
  const discovered = {};
  for (const fullPath of files) {
    const source = await readFile(fullPath, 'utf8');
    const direct = extractDirectScorePaths(source);
    const dynamic = extractDynamicScorePaths(source);
    if (direct.length || dynamic.length) {
      discovered[relativePagePath(fullPath)] = { direct_score_paths: direct, dynamic_score_paths: dynamic };
    }
  }

  assert.deepEqual(Object.keys(discovered).sort(), Object.keys(manifest.page_link_consumers).sort());
  for (const file of Object.keys(manifest.page_link_consumers)) {
    const expected = manifest.page_link_consumers[file];
    const actual = discovered[file];
    assert.deepEqual(actual.direct_score_paths, [...expected.direct_score_paths].sort(), 'direct Score links changed in ' + file);
    assert.deepEqual(actual.dynamic_score_paths, [...expected.dynamic_score_paths].sort(), 'dynamic Score links changed in ' + file);
  }
});

test('every discovered Score path has an explicit rights class', () => {
  const referenced = new Set();
  for (const entry of Object.values(manifest.page_link_consumers)) {
    for (const value of entry.direct_score_paths) referenced.add(value);
    for (const value of entry.dynamic_score_paths) referenced.add(value);
  }
  assert.deepEqual([...referenced].sort(), Object.keys(manifest.path_classes).sort());
  for (const [scorePath, className] of Object.entries(manifest.path_classes)) {
    assert.ok(scorePath.startsWith('/'), 'invalid Score path: ' + scorePath);
    assert.ok(manifest.classes[className], 'unknown rights class ' + className + ' for ' + scorePath);
  }
});

test('Weekly Report automation and historical reports remain classified as Class C', async () => {
  const workflow = await readFile(path.join(repoRoot, '.github', 'workflows', 'weekly-report.yml'), 'utf8');
  const generator = await readFile(path.join(webRoot, 'scripts', 'generate-weekly-report.mjs'), 'utf8');
  assert.ok(workflow.includes('https://score.usd-impact.com/archive/$WEEK/weekly_input.json'));
  assert.ok(generator.includes('https://score.usd-impact.com/archive/${week}/weekly_input.json'));
  assert.ok(generator.includes('driver.contribution'));
  assert.ok(generator.includes('drivers.slice(0, 3)'));
  assert.ok(generator.includes('source_provenance'));
  assert.equal(manifest.runtime_consumers['.github/workflows/weekly-report.yml'].class, 'C');
  assert.equal(manifest.runtime_consumers['apps/web/scripts/generate-weekly-report.mjs'].class, 'C');

  const reportRoot = path.join(webRoot, 'src', 'content', 'weekly-reports');
  const reports = (await readdir(reportRoot)).filter((name) => name.endsWith('.md'));
  const sourcePattern = /https:\/\/(?:score\.usd-impact\.com|usd-impact-pipeline\.pages\.dev)\/archive\/\d{4}-\d{2}-\d{2}\/weekly_input\.json/;
  const scoreDerived = [];
  for (const name of reports) {
    const source = await readFile(path.join(reportRoot, name), 'utf8');
    if (sourcePattern.test(source)) scoreDerived.push(name);
  }
  assert.ok(scoreDerived.length > 0, 'expected Score-derived Weekly Reports');
  assert.ok(scoreDerived.includes('2026-07-31.md'), 'legacy-origin Weekly Report must remain in inventory');
  assert.ok(scoreDerived.includes('2026-10-23.md'), 'latest branded-origin Weekly Report must remain in inventory');
  const current = await readFile(path.join(reportRoot, '2026-10-23.md'), 'utf8');
  assert.match(current, /largest absolute component contributions/i);
});

test('Monthly Report and methodology embedded component diagnostics are inventoried', async () => {
  assert.equal(manifest.manual_monthly_publication_requires_rights_review, true);
  assert.equal(manifest.runtime_consumers['apps/web/src/content/monthly-reports/*.md'].class, 'C');
  assert.equal(manifest.runtime_consumers['apps/web/src/pages/score/methodology.astro'].class, 'E');

  const monthly = await readFile(path.join(webRoot, 'src', 'content', 'monthly-reports', '2026-10-16.md'), 'utf8');
  assert.match(monthly, /largest absolute contributions/i);
  assert.match(monthly, /SPX [−-]0\.300/);

  const methodology = await readFile(path.join(webRoot, 'src', 'pages', 'score', 'methodology.astro'), 'utf8');
  assert.match(methodology, /rolling component diagnostic/i);
  assert.match(methodology, /largest absolute contributor/i);
});

test('Weekly Newsletter is inventoried as an indirect Class-C reference, not component-value republication', async () => {
  const contract = await readFile(path.join(webRoot, 'src', 'lib', 'weekly-newsletter-contract.js'), 'utf8');
  const route = await readFile(path.join(webRoot, 'src', 'pages', 'newsletter', 'weekly', '[date].json.ts'), 'utf8');
  const contractEntry = manifest.runtime_consumers['apps/web/src/lib/weekly-newsletter-contract.js'];
  const routeEntry = manifest.runtime_consumers['apps/web/src/pages/newsletter/weekly/[date].json.ts'];
  assert.equal(contractEntry.class, 'R');
  assert.equal(contractEntry.republishes_component_values, false);
  assert.equal(contractEntry.carries_score_source_url, true);
  assert.equal(routeEntry.class, 'R');
  assert.match(contract, /sourceUrl: report\.score\.sourceUrl/);
  assert.doesNotMatch(contract, /driver\.contribution|drivers\.slice\(0, 3\)/);
  assert.match(route, /buildWeeklyNewsletterPayload/);
});

test('site Score-derived consumer map remains fail-closed while issue 155 is HOLD', () => {
  assert.equal(manifest.version, 2);
  assert.equal(manifest.state, 'hold');
  assert.equal(manifest.production_change_authorized, false);
  assert.equal(manifest.weekly_report_publication_hold_required, true);
  assert.equal(manifest.historical_content_treatment_unresolved, true);
  assert.match(manifest.pipeline_issue, /\/usdimpact\/usd-impact-pipeline\/issues\/155$/);
  for (const entry of Object.values(manifest.runtime_consumers)) {
    assert.ok(manifest.classes[entry.class], 'runtime consumer has unknown class');
  }
});
