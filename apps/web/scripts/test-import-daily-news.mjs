import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const importer = fileURLToPath(new URL('./import-daily-news.mjs', import.meta.url));
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'usd-impact-daily-import-'));
const bundlePath = path.join(temporaryRoot, 'bundle.json');
const editionPath = path.join(temporaryRoot, 'src', 'content', 'news', '2026-07-23.md');

const bundle = {
  date: '2026-07-23',
  title: 'Daily USD Impact — July 23, 2026',
  metaDescription: 'A test edition for importer behavior.',
  generatedAt: '2026-07-23T12:00:00Z',
  marketRegime: 'Test regime',
  summary: 'Test summary.',
  assets: ['DXY'],
  highlights: [
    {
      headline: 'Test highlight one',
      development: 'Verified development one.',
      whyItMatters: 'Conditional interpretation one.',
      assets: ['DXY'],
      importance: 'high',
      verification: 'verified-primary',
      sourceIds: ['source-a'],
    },
    {
      headline: 'Test highlight two',
      development: 'Verified development two.',
      whyItMatters: 'Conditional interpretation two.',
      assets: ['DXY'],
      importance: 'medium',
      verification: 'verified-primary',
      sourceIds: ['source-a'],
    },
    {
      headline: 'Test highlight three',
      development: 'Verified development three.',
      whyItMatters: 'Conditional interpretation three.',
      assets: ['DXY'],
      importance: 'low',
      verification: 'verified-multiple',
      sourceIds: ['source-a', 'source-b'],
    },
  ],
  catalysts: [
    {
      date: '2026-07-29',
      event: 'Federal Reserve policy decision and press conference',
      eventType: 'central-bank',
      assets: ['DXY', 'U.S. rates'],
      importance: 'high',
      impactScore: 5,
      extraBrief: true,
      whyItMatters: 'The decision can reprice the expected policy path across rates and the dollar.',
      sourceIds: ['source-a'],
    },
  ],
  sources: [
    {
      id: 'source-a',
      title: 'Primary source',
      publisher: 'Primary Publisher',
      url: 'https://example.org/primary',
      publishedAt: '2026-07-23',
      sourceType: 'primary',
    },
    {
      id: 'source-b',
      title: 'Reporting source',
      publisher: 'Reporting Publisher',
      url: 'https://example.net/reporting',
      publishedAt: '2026-07-23',
      sourceType: 'reporting',
    },
  ],
  body: '## Test edition\n\nImporter fixture.',
};

function runImporter(...args) {
  return spawnSync(process.execPath, [importer, bundlePath, ...args], {
    cwd: temporaryRoot,
    encoding: 'utf8',
  });
}

async function writeBundle(nextBundle) {
  await writeFile(bundlePath, JSON.stringify(nextBundle), 'utf8');
}

try {
  await writeBundle(bundle);

  const initial = runImporter('--replace');
  assert.equal(initial.status, 0, initial.stderr);
  assert.match(initial.stdout, /status review/);

  const reviewContent = await readFile(editionPath, 'utf8');
  assert.match(reviewContent, /^status:\s*"review"\s*$/m);
  assert.match(reviewContent, /^\s+impactScore:\s*5\s*$/m);
  assert.match(reviewContent, /^\s+extraBrief:\s*true\s*$/m);

  await rm(editionPath, { force: true });

  const directPublish = runImporter('--replace', '--publish');
  assert.equal(directPublish.status, 0, directPublish.stderr);
  assert.match(directPublish.stdout, /status published/);

  const publishedContent = await readFile(editionPath, 'utf8');
  assert.match(publishedContent, /^status:\s*"published"\s*$/m);

  const protectedFailure = runImporter('--replace', '--publish');
  assert.notEqual(protectedFailure.status, 0);
  assert.match(protectedFailure.stderr, /already published and cannot be replaced by automation/);

  const scheduledNoop = runImporter('--replace', '--skip-published', '--publish');
  assert.equal(scheduledNoop.status, 0, scheduledNoop.stderr);
  assert.match(scheduledNoop.stdout, /already exists.*no changes made/i);
  assert.equal(await readFile(editionPath, 'utf8'), publishedContent);

  await rm(editionPath, { force: true });
  await writeBundle({ ...bundle, catalysts: null });

  const nullCatalysts = runImporter('--replace');
  assert.equal(nullCatalysts.status, 0, nullCatalysts.stderr);
  const nullCatalystsContent = await readFile(editionPath, 'utf8');
  assert.match(nullCatalystsContent, /^catalysts:\s*\[\]\s*$/m);

  await rm(editionPath, { force: true });
  await writeBundle({ ...bundle, catalysts: { unexpected: true } });

  const malformedCatalysts = runImporter('--replace');
  assert.notEqual(malformedCatalysts.status, 0);
  assert.match(malformedCatalysts.stderr, /catalysts must be an array when provided/i);

  await rm(editionPath, { force: true });
  await writeBundle({
    ...bundle,
    assets: [],
    catalysts: [
      {
        ...bundle.catalysts[0],
        assets: [],
        importance: 'medium',
        impactScore: 3,
        extraBrief: false,
      },
    ],
  });

  const emptyNestedArrays = runImporter('--replace');
  assert.equal(emptyNestedArrays.status, 0, emptyNestedArrays.stderr);
  const emptyNestedArraysContent = await readFile(editionPath, 'utf8');
  assert.match(emptyNestedArraysContent, /^assets:\s*\n\s+- "DXY"/m);
  assert.match(emptyNestedArraysContent, /^\s{4}assets:\s*\[\]\s*$/m);
  assert.doesNotMatch(emptyNestedArraysContent, /^catalysts:\s*$/m);

  console.log('daily news importer review and direct-publish tests pass');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
