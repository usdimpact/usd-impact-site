import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const importer = fileURLToPath(new URL('./import-catalyst-brief.mjs', import.meta.url));
const root = await mkdtemp(path.join(os.tmpdir(), 'usd-impact-catalyst-import-'));
const bundlePath = path.join(root, 'bundle.json');
const slug = '2026-08-07-us-employment-situation-july-2026-preview';
const outputPath = path.join(root, 'src', 'content', 'catalyst-briefs', `${slug}.md`);
const bundle = {
  publishable: true,
  title: 'U.S. Employment Situation — What to Watch',
  metaTitle: 'U.S. Employment Situation — What to Watch | USD Impact',
  metaDescription: 'A source-backed preview of the Employment Situation release.',
  slug: `/news/catalysts/${slug}`,
  eventKey: '2026-08-07-us-employment-situation-july-2026',
  event: 'U.S. Employment Situation — July 2026',
  eventDate: '2026-08-07',
  sourceEditionDate: '2026-08-05',
  phase: 'preview',
  generatedAt: '2026-08-05T06:50:00Z',
  lastReviewed: '2026-08-05',
  statusLabel: 'scheduled-confirmed',
  summary: 'A previously dated official employment report and independent reporting provide illustrative background for a future release.',
  assets: ['DXY', 'U.S. rates', 'S&P 500'],
  verifiedFacts: [
    { statement: 'The prior Employment Situation release was published July 2.', verification: 'verified-primary', sourceIds: ['bls'] },
    { statement: 'Reporting identifies rates sensitivity.', verification: 'verified-multiple', sourceIds: ['reuters', 'ap'] },
  ],
  transmissionChannels: [
    { channel: 'Rates and dollar', conditionalImpact: 'A policy-path repricing may transmit through yields and DXY.' },
    { channel: 'Risk assets', conditionalImpact: 'Changes in discount-rate expectations may affect equities.' },
  ],
  whatToWatch: ['Payrolls', 'Unemployment', 'Wages'],
  sources: [
    { id: 'bls', title: 'Prior Employment Situation release (dated)', publisher: 'BLS', url: 'https://www.bls.gov/news.release/archives/empsit_07022026.htm', publishedAt: '2026-07-02', sourceType: 'primary' },
    { id: 'reuters', title: 'Jobs preview', publisher: 'Reuters', url: 'https://www.reuters.com/example', publishedAt: '2026-08-05', sourceType: 'reporting' },
    { id: 'ap', title: 'Jobs preview', publisher: 'AP', url: 'https://apnews.com/example', publishedAt: '2026-08-05', sourceType: 'reporting' },
  ],
  complianceNote: 'Educational and informational only. This content is not investment advice.',
  body: '## Event map\n\nRead the release with revisions and participation data.',
};

const run = (...args) => spawnSync(process.execPath, [importer, bundlePath, ...args], { cwd: root, encoding: 'utf8' });

try {
  await writeFile(bundlePath, JSON.stringify(bundle), 'utf8');
  const review = run();
  assert.equal(review.status, 0, review.stderr);
  assert.match(await readFile(outputPath, 'utf8'), /^status:\s*"review"\s*$/m);
  await rm(outputPath);
  const published = run('--publish');
  assert.equal(published.status, 0, published.stderr);
  const content = await readFile(outputPath, 'utf8');
  assert.match(content, /^status:\s*"published"\s*$/m);
  const duplicate = run('--publish');
  assert.notEqual(duplicate.status, 0);
  const noop = run('--publish', '--skip-published');
  assert.equal(noop.status, 0, noop.stderr);
  await rm(outputPath);

  await writeFile(bundlePath, JSON.stringify({ publishable: false, holdReason: 'Official result is not available.' }), 'utf8');
  const held = run('--publish');
  assert.equal(held.status, 0, held.stderr);
  assert.match(held.stdout, /held/i);

  // No paid calls: every candidate is synthetic and runs in a disposable cwd.
  // Mutability checks must fail before any publication file is created.
  const blockedUrls = [
    'https://www.eia.gov/petroleum/supply/weekly/schedule.php',
    'https://www.eia.gov/petroleum/supply/weekly',
    'https://www.eia.gov/petroleum/supply/weekly/index.php',
    'https://www.eia.gov/petroleum/supply/weekly/pdf/wpsrall.pdf',
    'https://www.eia.gov/petroleum/supply/weekly/pdf/table14.pdf?date=2026-11-12',
    'https://WWW.EIA.GOV/petroleum/supply/weekly/pdf/table%31%34.pdf',
    'https://www.bls.gov/news.release/cpi.htm',
    'https://www.bls.gov/schedule/',
  ];
  for (const url of blockedUrls) {
    await writeFile(bundlePath, JSON.stringify({
      ...bundle, sources: [{ ...bundle.sources[0], url, publishedAt: '2026-11-12' }, ...bundle.sources.slice(1)],
    }), 'utf8');
    const rejected = run('--publish');
    assert.notEqual(rejected.status, 0, `Mutable URL was imported: ${url}`);
    assert.match(rejected.stderr, /Source bls:|Source bls uses mutable/, url);
    await assert.rejects(readFile(outputPath, 'utf8'), { code: 'ENOENT' });
  }

  const badDates = ['2026-02-30', '2026-13-01'];
  for (const publishedAt of badDates) {
    await writeFile(bundlePath, JSON.stringify({
      ...bundle, sources: [{ ...bundle.sources[0], publishedAt }, ...bundle.sources.slice(1)],
    }), 'utf8');
    const rejected = run('--publish');
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /real YYYY-MM-DD date/);
  }

  await writeFile(bundlePath, JSON.stringify({
    ...bundle, sources: [{ ...bundle.sources[0] }, { ...bundle.sources[1], url: bundle.sources[0].url },
      bundle.sources[2]],
  }), 'utf8');
  const duplicateUrl = run('--publish');
  assert.notEqual(duplicateUrl.status, 0);
  assert.match(duplicateUrl.stderr, /duplicate source URL/);

  // Archived frontmatter dates are immutable evidence and may not be rebadged.
  const newsDir = path.join(root, 'src', 'content', 'news');
  await mkdir(newsDir, { recursive: true });
  const archivalPath = path.join(newsDir, '2026-07-30.md');
  await writeFile(archivalPath, `sources:\n  - id: "prior-july-release"\n    url: "${bundle.sources[0].url}"\n    publishedAt: "2026-07-01"\n`, 'utf8');
  await writeFile(bundlePath, JSON.stringify(bundle), 'utf8');
  const contradicted = run('--publish');
  assert.notEqual(contradicted.status, 0);
  assert.match(contradicted.stderr, /conflicts with previously verified 2026-07-01/);
  await assert.rejects(readFile(outputPath, 'utf8'), { code: 'ENOENT' });
  await writeFile(archivalPath, `sources:\n  - id: "prior-july-release"\n    url: "${bundle.sources[0].url}"\n    publishedAt: "2026-07-02"\n`, 'utf8');
  const matchingOriginal = run('--publish');
  assert.equal(matchingOriginal.status, 0, matchingOriginal.stderr);
  assert.match(await readFile(outputPath, 'utf8'), /empsit_07022026\.htm/);

  console.log('catalyst brief importer dates and historical-provenance tests pass');
} finally {
  await rm(root, { recursive: true, force: true });
}
