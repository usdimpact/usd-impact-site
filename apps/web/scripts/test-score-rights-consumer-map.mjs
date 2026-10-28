import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const pagesRoot = path.join(webRoot, 'src', 'pages');
const manifest = JSON.parse(
  await readFile(path.join(scriptDir, 'score-rights-consumer-manifest.json'), 'utf8'),
);

async function listAstroFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...await listAstroFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.astro')) {
      out.push(full);
    }
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
    while (
      end < source.length
      && !["'", '"', ' ', '\n', '<', ')', '`'].includes(source[end])
    ) {
      end += 1;
    }
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
      discovered[relativePagePath(fullPath)] = {
        direct_score_paths: direct,
        dynamic_score_paths: dynamic,
      };
    }
  }

  const expectedFiles = Object.keys(manifest.files).sort();
  const actualFiles = Object.keys(discovered).sort();
  assert.deepEqual(actualFiles, expectedFiles);

  for (const file of expectedFiles) {
    const expected = manifest.files[file];
    const actual = discovered[file];

    assert.deepEqual(
      actual.direct_score_paths,
      [...expected.direct_score_paths].sort(),
      'direct Score links changed in ' + file,
    );
    assert.deepEqual(
      actual.dynamic_score_paths,
      [...expected.dynamic_score_paths].sort(),
      'dynamic Score links changed in ' + file,
    );
  }
});

test('every discovered Score path has an explicit rights class', () => {
  const referenced = new Set();
  for (const entry of Object.values(manifest.files)) {
    for (const value of entry.direct_score_paths) referenced.add(value);
    for (const value of entry.dynamic_score_paths) referenced.add(value);
  }

  assert.deepEqual(
    [...referenced].sort(),
    Object.keys(manifest.path_classes).sort(),
    'path classification has missing or unused entries',
  );

  for (const [scorePath, className] of Object.entries(manifest.path_classes)) {
    assert.ok(scorePath.startsWith('/'), 'invalid Score path: ' + scorePath);
    assert.ok(
      manifest.classes[className],
      'unknown rights class ' + className + ' for ' + scorePath,
    );
  }
});

test('site consumer map remains fail-closed while pipeline issue 155 is HOLD', () => {
  assert.equal(manifest.version, 1);
  assert.equal(manifest.state, 'hold');
  assert.equal(manifest.production_change_authorized, false);
  assert.match(manifest.pipeline_issue, /\/usdimpact\/usd-impact-pipeline\/issues\/155$/);

  const sensitive = Object.entries(manifest.path_classes)
    .filter(([, className]) => ['C', 'D', 'E', 'F'].includes(className))
    .map(([scorePath]) => scorePath);

  assert.ok(sensitive.length > 0);
  assert.ok(sensitive.includes('/data/weekly_input_latest.json'));
  assert.ok(sensitive.includes('/data/usd_impact_score_v2.json'));
  assert.ok(sensitive.includes('/data/research/score_v2_robustness_latest.json'));
  assert.ok(sensitive.includes('/data/research/score_v2_vintage_comparison_latest.html'));
});
