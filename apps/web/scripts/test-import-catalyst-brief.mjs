import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const importer = fileURLToPath(new URL('./import-catalyst-brief.mjs', import.meta.url));
const root = await mkdtemp(path.join(os.tmpdir(), 'usd-impact-catalyst-import-'));
const bundlePath = path.join(root, 'bundle.json');
const slug = '2026-08-07-bls-employment-situation-july-2026-preview';
const outputPath = path.join(root, 'src', 'content', 'catalyst-briefs', `${slug}.md`);
const bundle = {
  publishable: true,
  title: 'BLS Employment Situation — What to Watch',
  metaTitle: 'BLS Employment Situation — What to Watch | USD Impact',
  metaDescription: 'A source-backed preview of the Employment Situation release.',
  slug: `/news/catalysts/${slug}`,
  eventKey: '2026-08-07-bls-employment-situation-july-2026',
  event: 'BLS Employment Situation — July 2026',
  eventDate: '2026-08-07',
  sourceEditionDate: '2026-08-05',
  phase: 'preview',
  generatedAt: '2026-08-05T06:50:00Z',
  lastReviewed: '2026-08-05',
  statusLabel: 'scheduled-confirmed',
  summary: 'The official calendar confirms the release timing and the main cross-asset transmission channels.',
  assets: ['DXY', 'U.S. rates', 'S&P 500'],
  verifiedFacts: [
    { statement: 'The release is scheduled for August 7.', verification: 'verified-primary', sourceIds: ['bls'] },
    { statement: 'Reporting identifies rates sensitivity.', verification: 'verified-multiple', sourceIds: ['reuters', 'ap'] },
  ],
  transmissionChannels: [
    { channel: 'Rates and dollar', conditionalImpact: 'A policy-path repricing may transmit through yields and DXY.' },
    { channel: 'Risk assets', conditionalImpact: 'Changes in discount-rate expectations may affect equities.' },
  ],
  whatToWatch: ['Payrolls', 'Unemployment', 'Wages'],
  sources: [
    { id: 'bls', title: 'BLS calendar', publisher: 'BLS', url: 'https://www.bls.gov/schedule/', publishedAt: '2026-08-05', sourceType: 'primary' },
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

  await writeFile(bundlePath, JSON.stringify({ publishable: false, holdReason: 'Official result is not available.' }), 'utf8');
  const held = run('--publish');
  assert.equal(held.status, 0, held.stderr);
  assert.match(held.stdout, /held/i);

  console.log('catalyst brief importer tests pass');
} finally {
  await rm(root, { recursive: true, force: true });
}
