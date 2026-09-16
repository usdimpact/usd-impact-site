import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const importer = fileURLToPath(new URL('./import-daily-news.mjs', import.meta.url));
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'usd-impact-daily-import-'));
const bundlePath = path.join(temporaryRoot, 'bundle.json');
const editionPath = path.join(temporaryRoot, 'src', 'content', 'news', '2026-07-23.md');
const historicalEditionPath = path.join(temporaryRoot, 'src', 'content', 'news', '2026-07-22.md');
const historicalCatalystPath = path.join(temporaryRoot, 'src', 'content', 'catalyst-briefs', 'living-calendar.md');

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

  const unsupportedCalendar = runImporter('--replace', '--publish');
  assert.equal(unsupportedCalendar.status, 2, 'unsupported events must not publish automatically');
  assert.match(unsupportedCalendar.stderr, /HOLD_UNSUPPORTED_EVENT/);

  await writeBundle({ ...bundle, catalysts: [] });
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

  await rm(editionPath, { force: true });
  await writeFile(historicalEditionPath, `---\ntitle: "Historical edition"\nslug: "/news/2026-07-22"\nstatus: "published"\nsources:\n  - id: "source-a"\n    title: "Primary source"\n    publisher: "Primary Publisher"\n    url: "https://example.org/primary"\n    publishedAt: "2026-07-22"\n    sourceType: "primary"\n---\n`, 'utf8');
  await writeBundle(bundle);

  const historicalDateConflict = runImporter('--replace');
  assert.notEqual(historicalDateConflict.status, 0);
  assert.match(
    historicalDateConflict.stderr,
    /publishedAt 2026-07-23 conflicts with previously verified 2026-07-22/i,
  );

  await rm(historicalEditionPath, { force: true });
  await mkdir(path.dirname(historicalCatalystPath), { recursive: true });
  const livingUrl = 'https://www.federalreserve.gov/newsevents/2026-july.htm';
  await writeFile(historicalEditionPath, `---\ntitle: "Historical living source"\nslug: "/news/2026-07-22"\nstatus: "published"\nsources:\n  - id: "fed-calendar"\n    title: "Federal Reserve July calendar"\n    publisher: "Federal Reserve"\n    url: "${livingUrl}"\n    publishedAt: "2026-06-22"\n    sourceType: "primary"\n---\n`, 'utf8');
  await writeFile(historicalCatalystPath, `---\ntitle: "Historical catalyst"\nstatus: "published"\nsources:\n  - id: "fed-calendar"\n    title: "Federal Reserve July calendar"\n    publisher: "Federal Reserve"\n    url: "${livingUrl}"\n    publishedAt: "2026-07-20"\n    sourceType: "primary"\n---\n`, 'utf8');
  const livingSourceBundle = {
    ...bundle,
    sources: [
      {
        ...bundle.sources[0],
        id: 'fed-calendar',
        title: 'Federal Reserve July 2026 calendar',
        publisher: 'Federal Reserve',
        url: livingUrl,
        publishedAt: '2026-07-22',
      },
      bundle.sources[1],
    ],
    highlights: bundle.highlights.map((highlight) => ({
      ...highlight,
      sourceIds: highlight.sourceIds.map((id) => id === 'source-a' ? 'fed-calendar' : id),
    })),
    catalysts: bundle.catalysts.map((catalyst) => ({ ...catalyst, sourceIds: ['fed-calendar'] })),
  };
  await writeBundle(livingSourceBundle);

  const livingHistoricalDates = runImporter('--replace');
  assert.equal(livingHistoricalDates.status, 0, livingHistoricalDates.stderr);
  assert.match(livingHistoricalDates.stdout, /status review/);

  await rm(editionPath, { force: true });
  const blsCpiHomeUrl = 'https://www.bls.gov/cpi';
  await writeFile(historicalEditionPath, `---\ntitle: "Historical BLS CPI homepage"\nslug: "/news/2026-07-22"\nstatus: "published"\nsources:\n  - id: "bls-cpi"\n    title: "CPI Home"\n    publisher: "U.S. Bureau of Labor Statistics"\n    url: "${blsCpiHomeUrl}"\n    publishedAt: "2026-07-15"\n    sourceType: "primary"\n---\n`, 'utf8');
  await writeFile(historicalCatalystPath, `---\ntitle: "Historical BLS CPI catalyst"\nstatus: "published"\nsources:\n  - id: "bls-cpi"\n    title: "CPI Home"\n    publisher: "U.S. Bureau of Labor Statistics"\n    url: "${blsCpiHomeUrl}"\n    publishedAt: "2026-07-14"\n    sourceType: "primary"\n---\n`, 'utf8');
  const blsCpiLivingBundle = {
    ...bundle,
    sources: [
      {
        ...bundle.sources[0],
        id: 'bls-cpi',
        title: 'CPI Home — U.S. Bureau of Labor Statistics',
        publisher: 'U.S. Bureau of Labor Statistics',
        url: blsCpiHomeUrl,
        publishedAt: '2026-07-15',
      },
      bundle.sources[1],
    ],
    highlights: bundle.highlights.map((highlight) => ({
      ...highlight,
      sourceIds: highlight.sourceIds.map((id) => id === 'source-a' ? 'bls-cpi' : id),
    })),
    catalysts: bundle.catalysts.map((catalyst) => ({ ...catalyst, sourceIds: ['bls-cpi'] })),
  };
  await writeBundle(blsCpiLivingBundle);

  const blsCpiHistoricalDates = runImporter('--replace');
  assert.equal(blsCpiHistoricalDates.status, 0, blsCpiHistoricalDates.stderr);
  assert.match(blsCpiHistoricalDates.stdout, /status review/);

  await rm(editionPath, { force: true });
  await rm(historicalEditionPath, { force: true });
  await rm(historicalCatalystPath, { force: true });
  await writeBundle({ ...bundle, body: 'Source review remains incomplete for 2026-07-??.' });

  const placeholderDateFailure = runImporter('--replace');
  assert.notEqual(placeholderDateFailure.status, 0);
  assert.match(placeholderDateFailure.stderr, /Body contains an unresolved date placeholder/i);

  await writeBundle({ ...bundle, body: 'Executive view.\n\nSources (ledger)\n\n- raw duplicate source entry' });

  const duplicateLedgerFailure = runImporter('--replace');
  assert.notEqual(duplicateLedgerFailure.status, 0);
  assert.match(duplicateLedgerFailure.stderr, /Body duplicates the structured source ledger/i);

  const treasuryBuybackBundle = {
    ...bundle,
    sources: [
      {
        id: 'treasury-buyback',
        title: 'Treasury Long-End Liquidity Support Buybacks',
        publisher: 'U.S. Department of the Treasury',
        url: 'https://home.treasury.gov/news/press-releases/sb0607',
        publishedAt: '2026-07-23',
        sourceType: 'primary',
      },
      bundle.sources[1],
    ],
    highlights: [
      {
        ...bundle.highlights[0],
        development: 'Treasury buybacks reduce net Treasury supply.',
        sourceIds: ['treasury-buyback'],
      },
      { ...bundle.highlights[1], sourceIds: ['treasury-buyback'] },
      { ...bundle.highlights[2], sourceIds: ['treasury-buyback', 'source-b'] },
    ],
    catalysts: [{ ...bundle.catalysts[0], sourceIds: ['treasury-buyback'] }],
    body: 'Treasury liquidity-support buybacks remain a market-functioning tool.',
  };
  await writeBundle(treasuryBuybackBundle);

  const buybackSupplyFailure = runImporter('--replace');
  assert.notEqual(buybackSupplyFailure.status, 0);
  assert.match(buybackSupplyFailure.stderr, /mechanically reducing or offsetting Treasury supply/i);

  // #634: use synthetic bundles only; never rewrite published archive fixtures.
  const treasuryIndex = 'https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding/most-recent-quarterly-refunding-documents';
  const treasuryDocument = 'https://home.treasury.gov/system/files/221/synthetic-refunding-document-20260909.pdf';
  const treasuryEditionPath = path.join(temporaryRoot, 'src/content/news/2026-09-16.md');
  const treasuryArchivePath = path.join(temporaryRoot, 'src/content/news/2026-09-03.md');
  const treasuryCatalystArchivePath = path.join(temporaryRoot, 'src/content/catalyst-briefs/treasury-fixture.md');
  const archiveRecord = (url, date) => `---\nstatus: "published"\nsources:\n  - id: "treasury-item"\n    url: "${url}"\n    publishedAt: "${date}"\n---\n`;
  const archive = archiveRecord(treasuryIndex, '2026-08-03');
  const catalystArchive = archiveRecord(treasuryIndex, '2026-08-05');
  await writeFile(treasuryArchivePath, archive, 'utf8');
  await writeFile(treasuryCatalystArchivePath, catalystArchive, 'utf8');
  const candidateForSource = (url, publishedAt) => ({
    ...bundle,
    date: '2026-09-16',
    generatedAt: '2026-09-16T12:00:00Z',
    catalysts: [],
    sources: [
      { ...bundle.sources[0], url, publishedAt, title: 'Synthetic Treasury document' },
      { ...bundle.sources[1], publishedAt: '2026-09-16' },
    ],
  });
  for (const url of [treasuryIndex, `${treasuryIndex}/`, `${treasuryIndex}?utm_source=fixture`, `${treasuryIndex}/?e=48669#documents`]) {
    for (const date of ['2026-08-03', '2026-09-09', '2026-09-16']) {
      await writeBundle(candidateForSource(url, date));
      const held = runImporter('--replace', '--publish');
      assert.notEqual(held.status, 0);
      assert.match(held.stderr, /directly linked dated document/);
      await assert.rejects(readFile(treasuryEditionPath), { code: 'ENOENT' });
      assert.equal(await readFile(treasuryArchivePath, 'utf8'), archive);
      assert.equal(await readFile(treasuryCatalystArchivePath, 'utf8'), catalystArchive);
    }
  }
  // A valid direct-document fixture is independent of every date on the index.
  await writeBundle(candidateForSource(treasuryDocument, '2026-09-09'));
  const directDocument = runImporter('--replace', '--publish');
  assert.equal(directDocument.status, 0, directDocument.stderr);
  const directContent = await readFile(treasuryEditionPath, 'utf8');
  assert.match(directContent, /publishedAt: "2026-09-09"/);
  // Compare the complete emitted source ledger, not URL substrings in Markdown.
  const importedSourceUrls = directContent.split('\n')
    .filter((line) => line.startsWith('    url: '))
    .map((line) => JSON.parse(line.slice('    url: '.length)));
  assert.deepEqual(importedSourceUrls, [treasuryDocument, bundle.sources[1].url]);
  assert.equal(await readFile(treasuryArchivePath, 'utf8'), archive);
  assert.equal(await readFile(treasuryCatalystArchivePath, 'utf8'), catalystArchive);
  const stillProtected = runImporter('--replace', '--publish');
  assert.notEqual(stillProtected.status, 0);
  assert.match(stillProtected.stderr, /already published and cannot be replaced/);
  const stillNoop = runImporter('--replace', '--skip-published', '--publish');
  assert.equal(stillNoop.status, 0, stillNoop.stderr);
  assert.equal(await readFile(treasuryEditionPath, 'utf8'), directContent);
  await rm(treasuryEditionPath);
  await rm(treasuryArchivePath);
  await rm(treasuryCatalystArchivePath);
  // The index is held even without a previously stored date, not just on drift.
  await writeBundle(candidateForSource(treasuryIndex, '2026-09-09'));
  const noHistory = runImporter('--replace');
  assert.notEqual(noHistory.status, 0);
  assert.match(noHistory.stderr, /directly linked dated document/);
  await assert.rejects(readFile(treasuryEditionPath), { code: 'ENOENT' });

  for (const url of [treasuryDocument, 'https://home.treasury.gov/news/press-releases/sb0607']) {
    const fixedDateArchive = archiveRecord(url, '2026-09-08');
    await writeFile(treasuryArchivePath, fixedDateArchive, 'utf8');
    await writeBundle(candidateForSource(url, '2026-09-09'));
    const immutableConflict = runImporter('--replace');
    assert.notEqual(immutableConflict.status, 0);
    assert.match(immutableConflict.stderr, /publishedAt 2026-09-09 conflicts with previously verified 2026-09-08/);
    assert.equal(await readFile(treasuryArchivePath, 'utf8'), fixedDateArchive);
    await assert.rejects(readFile(treasuryEditionPath), { code: 'ENOENT' });
    await rm(treasuryArchivePath);
  }

  console.log('daily news importer review, direct-publish, calendar, and fail-closed source guard tests pass');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
