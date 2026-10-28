import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import {
  auditResearchPrivatePublicBuild,
  PRIVATE_RESEARCH_OUTPUT_MARKERS,
} from './audit-research-private-public-build.mjs';

const PRIVATE_PATH = '/research/member/reports/weekly/2026-11-06';
const MARKER = PRIVATE_RESEARCH_OUTPUT_MARKERS[0];
const PRIVATE_MARKER = PRIVATE_RESEARCH_OUTPUT_MARKERS[1];

function write(root, relative, content) {
  const dest = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  return dest;
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'usd-research-dist-audit-'));
  write(root, 'index.html', '<!doctype html><title>Public</title><a href="' +
    PRIVATE_PATH + '">Members can sign in</a>');
  write(root, 'sitemap-0.xml', '<urlset><url><loc>https://usd-impact.com/research/</loc></url></urlset>');
  write(root, 'sitemap-index.xml', '<sitemapindex><sitemap><loc>https://usd-impact.com/sitemap-0.xml</loc></sitemap></sitemapindex>');
  write(root, 'news/feed.xml', '<rss><channel><item><link>https://usd-impact.com/news/</link></item></channel></rss>');
  write(root, 'research/sample/index.html', '<!doctype html><h1>Public sample</h1>');
  write(root, 'reports/weekly/2026-07-31/index.html', '<!doctype html><h1>Existing public weekly</h1>');
  write(root, 'reports/monthly/2026-10-16/index.html', '<!doctype html><h1>Existing public monthly</h1>');
  return root;
}

async function verifyMutation(mutate, expected) {
  const root = fixture();
  try {
    mutate(root);
    const r = await auditResearchPrivatePublicBuild(root);
    assert.equal(r.status, 'HOLD');
    assert.ok(r.findings.includes(expected), JSON.stringify(r.findings));
    assert.equal(r.releaseAuthorized, false);
    // Do not log sensitive body data, private blob names or actual source IDs.
    assert.ok(r.findings.every(x => /^[a-z-]+$/.test(x)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('known public sample, legacy reports and ordinary navigation remain allowed', async () => {
  const root = fixture();
  try {
    const r = await auditResearchPrivatePublicBuild(root);
    assert.equal(r.status, 'PASS');
    assert.deepEqual(r.findings, []);
    assert.equal(r.checkedFiles, 7);
    assert.equal(r.releaseAuthorized, false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('missing public build or missing required discovery is HOLD, not a false PASS', async () => {
  const missing = await auditResearchPrivatePublicBuild(path.join(os.tmpdir(), 'nonexistent-usd-research-build-audit'));
  assert.deepEqual(missing.findings, ['public-build-missing']);
  await verifyMutation(root => fs.rmSync(path.join(root, 'news', 'feed.xml')), 'required-public-output-missing');
  await verifyMutation(root => fs.rmSync(path.join(root, 'research', 'sample', 'index.html')), 'required-public-output-missing');
});

test('any generated private weekly or monthly report URL is rejected by path', async () => {
  await verifyMutation(root => write(root, 'research/member/reports/weekly/2026-11-06/index.html', 'private'), 'private-report-output-path');
  await verifyMutation(root => write(root, 'research/member/reports/monthly/2026-11-20.html', 'private'), 'private-report-output-path');
  await verifyMutation(root => write(root, 'private/research/member/reports/weekly/2026-11-06/data.json', '{}'), 'private-report-output-path');
});

test('renamed private research artifact paths are rejected even without body marker', async () => {
  await verifyMutation(root => write(root, '_astro/research-private-report-2026.js', 'export default 1'), 'private-report-output-path');
  await verifyMutation(root => write(root, 'assets/private_research_report_2026.json', '{}'), 'private-report-output-path');
});

test('HTML, JavaScript, CSS and JSON public assets reject private body markers', async () => {
  for (const [file, content] of [
    ['index.html', '<!doctype html>' + MARKER],
    ['_astro/a.js', 'const leaked = "' + PRIVATE_MARKER + '"'],
    ['_astro/a.css', '/* data-usd-impact-private-report=1 */'],
    ['news/latest.json', '{"body":"' + MARKER + '"}'],
    ['images/diagram.svg', '<svg><!--' + MARKER + '--></svg>'],
    ['images/render.png', Buffer.from('PNG MOCK ' + MARKER)],
  ]) {
    await verifyMutation(root => write(root, file, content), 'private-report-body-marker-in-public-asset');
  }
});

test('marker split across 64 KiB stream boundaries is still rejected', async () => {
  const leading = 'A'.repeat(65536 - 7);
  await verifyMutation(root => write(root, 'download.bin', leading + MARKER), 'private-report-body-marker-in-public-asset');
});

test('gzip and brotli static assets are inspected after decompression', async () => {
  await verifyMutation(root => write(root, 'news/feed.xml.gz',
    gzipSync(Buffer.from('<item>' + MARKER + '</item>'))),
  'private-report-body-marker-in-public-asset');
  await verifyMutation(root => write(root, 'archive.json.br',
    brotliCompressSync(Buffer.from('{"body":"' + MARKER + '"}'))),
  'private-report-body-marker-in-public-asset');
});

test('encoded private output filenames and symlinked build root fail closed', async () => {
  await verifyMutation(root => write(root,
    'research%2Fmember%2Freports%2Fweekly%2F2026-11-06.html', 'renamed'),
  'private-report-output-path');
  const root = fixture();
  const alias = root + '-symlink';
  try {
    fs.symlinkSync(root, alias, 'dir');
    const audit = await auditResearchPrivatePublicBuild(alias);
    assert.equal(audit.status, 'HOLD');
    assert.deepEqual(audit.findings, ['public-build-missing']);
  } finally {
    fs.rmSync(alias, { force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('compressed public feeds reject private URL references, not just body markers', async () => {
  await verifyMutation(root => write(root, 'news/feed.xml.gz',
    gzipSync(Buffer.from('<item><link>' + PRIVATE_PATH + '</link></item>'))),
  'private-report-url-in-public-discovery');
  await verifyMutation(root => write(root, 'news/feed.json.br',
    brotliCompressSync(Buffer.from(JSON.stringify({ url: PRIVATE_PATH })))),
  'private-report-url-in-public-discovery');
});

test('sitemaps, RSS and JSON feed surfaces cannot advertise private report URLs', async () => {
  await verifyMutation(root => write(root, 'sitemap-0.xml',
    '<loc>https://usd-impact.com' + PRIVATE_PATH + '</loc>'), 'private-report-url-in-public-discovery');
  await verifyMutation(root => write(root, 'sitemap-index.xml',
    '<loc>https://usd-impact.com' + PRIVATE_PATH + '</loc>'), 'private-report-url-in-public-discovery');
  await verifyMutation(root => write(root, 'news/feed.xml',
    '<item><link>https://usd-impact.com' + PRIVATE_PATH + '</link></item>'), 'private-report-url-in-public-discovery');
  await verifyMutation(root => write(root, 'news/feed.json',
    JSON.stringify({ items: [{ url: 'https://usd-impact.com' + PRIVATE_PATH }] })),
  'private-report-url-in-public-discovery');
  await verifyMutation(root => write(root, 'news/latest.json',
    JSON.stringify({ href: PRIVATE_PATH })), 'private-report-url-in-public-discovery');
});

test('encoded and JSON-escaped member paths fail the public-discovery scan', async () => {
  await verifyMutation(root => write(root, 'sitemap-0.xml',
    '<loc>https://usd-impact.com/research%2Fmember%2Freports%2Fweekly%2F2026-11-06</loc>'),
  'private-report-url-in-public-discovery');
  await verifyMutation(root => write(root, 'news/feed.json',
    '{"path":"\\/research\\/member\\/reports\\/monthly\\/2026-11-20"}'),
  'private-report-url-in-public-discovery');
  await verifyMutation(root => write(root, 'news/feed.xml',
    '<link>&#47;research&#47;member&#47;reports&#47;weekly&#47;2026-11-06</link>'),
  'private-report-url-in-public-discovery');
});

test('public HTML structured data and canonical headers cannot claim member report URLs', async () => {
  await verifyMutation(root => write(root, 'index.html',
    '<script type="application/ld+json">{"url":"https://usd-impact.com' + PRIVATE_PATH + '"}</script>'),
  'private-report-url-in-structured-data');
  await verifyMutation(root => write(root, 'index.html',
    '<meta rel="canonical" href="https://usd-impact.com' + PRIVATE_PATH + '">'),
  'private-report-url-in-structured-data');
  await verifyMutation(root => write(root, 'index.html',
    '<meta property="og:url" content="https://usd-impact.com' + PRIVATE_PATH + '">'),
  'private-report-url-in-structured-data');
});

test('robots disallow declarations are not mistaken for discovery or private content', async () => {
  const root = fixture();
  try {
    write(root, 'robots.txt', 'User-agent: *\nDisallow: ' + PRIVATE_PATH);
    const r = await auditResearchPrivatePublicBuild(root);
    assert.equal(r.status, 'PASS');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('invalid compressed assets cause HOLD instead of bypassing inspection', async () => {
  await verifyMutation(root => write(root, 'assets/not-compressed.json.gz', 'garbled'), 'public-artifact-unreadable-or-invalid');
});

test('symlink output is never silently followed outside the public build', async () => {
  const root = fixture();
  try {
    fs.symlinkSync(path.join(root, 'index.html'), path.join(root, 'leaked-link.html'));
    const r = await auditResearchPrivatePublicBuild(root);
    assert.equal(r.status, 'HOLD');
    assert.ok(r.findings.includes('public-build-symlink-not-audited'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
