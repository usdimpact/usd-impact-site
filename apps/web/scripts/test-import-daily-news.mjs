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
  catalysts: [],
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

try {
  await writeFile(bundlePath, JSON.stringify(bundle), 'utf8');

  const initial = runImporter('--replace');
  assert.equal(initial.status, 0, initial.stderr);
  assert.match(initial.stdout, /Imported Daily USD Impact bundle/);

  const reviewContent = await readFile(editionPath, 'utf8');
  assert.match(reviewContent, /^status:\s*"review"\s*$/m);

  const publishedContent = reviewContent.replace(/^status:\s*"review"\s*$/m, 'status: "published"');
  await writeFile(editionPath, publishedContent, 'utf8');

  const protectedFailure = runImporter('--replace');
  assert.notEqual(protectedFailure.status, 0);
  assert.match(protectedFailure.stderr, /already published and cannot be replaced by automation/);

  const scheduledNoop = runImporter('--replace', '--skip-published');
  assert.equal(scheduledNoop.status, 0, scheduledNoop.stderr);
  assert.match(scheduledNoop.stdout, /already exists.*no changes made/i);
  assert.equal(await readFile(editionPath, 'utf8'), publishedContent);

  console.log('daily news importer published-edition tests pass');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
