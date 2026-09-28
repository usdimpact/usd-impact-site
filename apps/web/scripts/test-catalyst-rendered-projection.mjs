import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { projectCatalystHtml as project, compareCatalystHtml as compare, PROJECTION_SCHEME, MAX_HTML_BYTES } from './lib/catalyst-rendered-projection.mjs';
import { verifyGeneratedCatalystPages as verifyBuild } from './verify-catalyst-rendered-projection.mjs';

globalThis.fetch = () => { throw new Error('NETWORK_DISABLED_IN_OFFLINE_TESTS'); };
const CANONICAL = 'https://www.usd-impact.com/news/catalysts/2026-09-16-synthetic-event-outcome';
const SHA = s => createHash('sha256').update(s, 'utf8').digest('hex');
// Deliberately synthetic HTML, not a captured response or substituted Astro reference.
function fixture() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Synthetic outcome | USD Impact</title><meta name="description" content="Synthetic description &amp; limits"><link rel="canonical" href="${CANONICAL}"></head><body>
<header><nav><a href="/news/">News navigation</a></nav></header>
<section class="hero news-hero"><div class="container"><div class="eyebrow">USD Impact Catalyst Brief \u00b7 Outcome</div><h1>Synthetic headline</h1><p class="lead">Synthetic summary with limitations.</p><p class="edition-meta">Event date 16 September 2026 \u00b7 Last reviewed 2026-09-17</p></div></section>
<main class="container">
<section class="regime-panel"><span>Verification status</span><strong>released</strong><div class="asset-tags" aria-label="Affected assets"><span>USD</span><span>U.S. rates</span></div></section>
<section class="catalyst-section"><div class="section-heading"><h2>What is confirmed</h2></div><div class="news-grid">
<article class="card"><span class="verification">Primary-source verified</span><p>First synthetic fact.</p><p class="card-sources">Sources: <a href="https://www.federalreserve.gov/example-a" target="_blank" rel="noreferrer">Federal Reserve</a></p></article>
<article class="card"><span class="verification">Primary-source verified</span><p>Second synthetic fact.</p><p class="card-sources">Sources: <a href="https://www.federalreserve.gov/example-b" target="_blank" rel="noreferrer">Federal Reserve</a></p></article>
</div></section>
<section class="catalyst-section"><div class="section-heading"><h2>Transmission</h2></div><div class="news-grid"><article class="card"><h3>Rates</h3><p>Conditional rate channel.</p></article><article class="card"><h3>Dollar</h3><p>Conditional dollar channel.</p></article></div></section>
<section class="catalyst-section card"><div class="eyebrow">Monitoring checklist</div><h2>What to watch next</h2><ul><li>Review first evidence.</li><li>Review second evidence.</li><li>Review third evidence.</li></ul></section>
<article class="edition-analysis"><h2 id="executive-view">Executive view</h2><p>Alpha <strong>beta</strong> gamma. <a href="https://example.org/observation?q=1#details">Observation</a></p><p>A&amp;B; 0.25%; caf\u00e9.</p><pre><code>x  =  1\ny = 2</code></pre></article>
<section class="source-ledger" aria-labelledby="source-ledger-title"><div class="section-heading"><div><div class="eyebrow">Verification</div><h2 id="source-ledger-title">Source ledger</h2></div><p>2 sources used in this edition.</p></div><ol>
<li id="source-a"><a href="https://www.federalreserve.gov/example-a" target="_blank" rel="noreferrer"><strong>First synthetic source</strong></a><span>Federal Reserve \u00b7 Primary source \u00b7 2026-09-16</span></li>
<li id="source-b"><a href="https://www.federalreserve.gov/example-b" target="_blank" rel="noreferrer"><strong>Second synthetic source</strong></a><span>Federal Reserve \u00b7 Primary source \u00b7 2026-09-16</span></li>
</ol></section>
<section class="compliance" aria-label="Compliance note"><strong>Compliance note:</strong> Educational only; not investment advice.</section>
</main><footer>Footer is not the article compliance region.</footer></body></html>`;
}
const BASE = fixture();
function safe(result) {
  for (const key of ['sourceAuthenticityVerified', 'acquisitionVerified', 'publicationVerified', 'publicationAuthorized', 'incidentClosureAuthorized', 'enforcementActive']) assert.equal(result[key], false);
  assert.ok(Object.isFrozen(result));
}
function rejects(html, canonical = CANONICAL) {
  const result = project(html, canonical); safe(result); assert.equal(result.status, 'PROJECTION_HOLD');
}
function detects(html) {
  const result = compare(BASE, html, CANONICAL); safe(result); assert.notEqual(result.status, 'CONTENT_MATCH_NOT_VERIFIED');
}
function matches(html) {
  const result = compare(BASE, html, CANONICAL); safe(result); assert.equal(result.status, 'CONTENT_MATCH_NOT_VERIFIED');
}
test('synthetic complete fixture has explicit, non-authorizing coverage', () => {
  const result = project(BASE, CANONICAL); safe(result);
  assert.equal(result.status, 'PROJECTION_READY_NOT_VERIFIED');
  assert.deepEqual(result.coverage, { facts: 2, sources: 2, assets: 2, channels: 2, watchItems: 3, archiveNotices: 0 });
  assert.equal(result.scheme, PROJECTION_SCHEME); assert.notEqual(PROJECTION_SCHEME, 'catalyst-projection-v1');
  assert.equal(result.suppliedUtf8Sha256, SHA(BASE));
  assert.ok(Object.isFrozen(result.projection.article[2]));
});
test('comparison of the same supplied document is not publication proof', () => matches(BASE));
test('deterministic projection and no input mutation', () => assert.deepEqual(project(BASE, CANONICAL), project(BASE, CANONICAL)));
for (const [name, before, after] of [
  ['head title', 'Synthetic outcome |', 'Altered outcome |'],
  ['description', 'Synthetic description', 'Changed description'],
  ['headline outside main', 'Synthetic headline', 'Changed headline'],
  ['summary outside main', 'Synthetic summary', 'Changed summary'],
  ['event date', 'Event date 16 September', 'Event date 17 September'],
  ['review date', 'Last reviewed 2026-09-17', 'Last reviewed 2026-09-18'],
  ['phase', 'Brief \u00b7 Outcome', 'Brief \u00b7 Pre-event'],
  ['status', '<strong>released</strong>', '<strong>cancelled</strong>'],
  ['asset', '<span>USD</span>', '<span>EUR</span>'],
  ['asset order', '<span>USD</span><span>U.S. rates</span>', '<span>U.S. rates</span><span>USD</span>'],
  ['fact', 'First synthetic fact.', 'Different synthetic fact.'],
  ['fact verification', 'Primary-source verified', 'Multi-source verified'],
  ['fact href only', 'href="https://www.federalreserve.gov/example-a"', 'href="https://www.federalreserve.gov/wrong"'],
  ['transmission heading', '<h3>Rates</h3>', '<h3>Liquidity</h3>'],
  ['conditional interpretation', 'Conditional rate channel.', 'Unconditional rate channel.'],
  ['watch item', 'Review first evidence.', 'Ignore first evidence.'],
  ['watch order', '<li>Review first evidence.</li><li>Review second evidence.</li>', '<li>Review second evidence.</li><li>Review first evidence.</li>'],
  ['analysis text', 'Alpha ', 'Changed '],
  ['analysis heading', '>Executive view</h2>', '>Different view</h2>'],
  ['inline semantics', '<strong>beta</strong>', '<em>beta</em>'],
  ['meaningful inline boundary', 'Alpha <strong>', 'Alpha<strong>'],
  ['link query', '?q=1#details', '?q=2#details'],
  ['link fragment', '?q=1#details', '?q=1#other'],
  ['code spacing', 'x  =  1', 'x = 1'],
  ['punctuation', '0.25%', '0,25%'],
  ['Unicode distinction', 'caf\u00e9', 'cafe\u0301'],
  ['non-breaking space', 'Alpha ', 'Alpha\u00a0'],
  ['source title', 'First synthetic source', 'Different synthetic source'],
  ['source classification', 'Primary source \u00b7 2026', 'Independent reporting \u00b7 2026'],
  ['source date', 'source \u00b7 2026-09-16', 'source \u00b7 2026-09-15'],
  ['source ID', 'id="source-a"', 'id="source-c"'],
  ['article compliance', 'Educational only; not investment advice.', 'Informational only; not investment advice.'],
  ['indexing metadata', '</head>', '<meta name="robots" content="index,follow"></head>'],
]) test(`detect ${name}`, () => detects(BASE.replace(before, after)));
test('all source destinations change but displayed labels remain the same', () => detects(BASE.replaceAll('https://www.federalreserve.gov/example-a', 'https://example.org/different')));
for (const [name, convert] of [
  ['ordinary paragraph whitespace', s => s.replace('First synthetic fact.', 'First   synthetic\n fact.')],
  ['equivalent entity spelling', s => s.replace('A&amp;B', 'A&#38;B')],
  ['class token order', s => s.replace('class="hero news-hero"', 'class="news-hero hero"')],
  ['attribute order and quote style', s => s.replace('class="hero news-hero"', "class='hero news-hero'")],
  ['compiler empty scope marker', s => s.replace('<h1>', '<h1 data-astro-cid-synthetic>')],
  ['comment without word boundary', s => s.replace('First synthetic fact.', 'First syn<!-- note -->thetic fact.')],
  ['outside navigation text', s => s.replace('News navigation', 'Different navigation')],
  ['outside footer text', s => s.replace('Footer is not', 'Different footer is not')],
  ['outside script text', s => s.replace('</body>', '<script>const unused = "Synthetic headline";</script></body>')],
]) test(`allow only defined equivalence: ${name}`, () => matches(convert(BASE)));
test('normalized content and supplied-HTML hashes mean different things', () => {
  const x = compare(BASE, BASE.replace('First synthetic', 'First    synthetic'), CANONICAL);
  assert.equal(x.status, 'CONTENT_MATCH_NOT_VERIFIED');
  assert.equal(x.referenceSha256, x.observedSha256);
  assert.notEqual(x.referenceSuppliedUtf8Sha256, x.observedSuppliedUtf8Sha256);
});
for (const [name, convert] of [
  ['missing hero', s => s.replace(/<section class="hero news-hero">[\s\S]*?<\/section>/, '')],
  ['missing main', s => s.replace(/<main[\s\S]*?<\/main>/, '')],
  ['missing analysis', s => s.replace(/<article class="edition-analysis">[\s\S]*?<\/article>/, '')],
  ['missing article compliance', s => s.replace(/<section class="compliance"[\s\S]*?<\/section>/, '')],
  ['duplicate hero', s => s.replace('</body>', s.match(/<section class="hero news-hero">[\s\S]*?<\/section>/)[0] + '</body>')],
  ['duplicate main', s => s.replace('</body>', '<main></main></body>')],
  ['duplicate canonical', s => s.replace('</head>', `<link rel="canonical" href="${CANONICAL}"></head>`)],
  ['duplicate description', s => s.replace('</head>', '<meta name="description" content="extra"></head>')],
  ['duplicate head title', s => s.replace('</head>', '<title>extra</title></head>')],
  ['duplicate indexing metadata', s => s.replace('</head>', '<meta name="robots" content="index"><meta name="robots" content="follow"></head>')],
  ['duplicate attribute', s => s.replace('<h1>', '<h1 id="a" id="b">')],
  ['duplicate document ID', s => s.replace('id="source-b"', 'id="source-a"')],
  ['missing mandatory ending tag', s => s.replace('</h1>', '')],
  ['implicit p closing', s => s.replace('First synthetic fact.</p>', 'First synthetic fact.')],
  ['missing doctype', s => s.replace('<!doctype html>', '')],
  ['missing html ending', s => s.replace('</html>', '')],
  ['missing main ending', s => s.replace('</main>', '')],
  ['wrong language', s => s.replace('lang="en"', 'lang="es"')],
  ['wrong charset', s => s.replace('charset="utf-8"', 'charset="iso-8859-1"')],
  ['noindex response', s => s.replace('</head>', '<meta name="robots" content="noindex,follow"></head>')],
  ['hidden hero', s => s.replace('class="hero news-hero"', 'hidden class="hero news-hero"')],
  ['hidden body', s => s.replace('<body>', '<body hidden>')],
  ['inert main', s => s.replace('<main ', '<main inert ')],
  ['aria-hidden fact', s => s.replace('class="card"', 'aria-hidden="true" class="card"')],
  ['inline style', s => s.replace('<h1>', '<h1 style="display:none">')],
  ['unknown attribute', s => s.replace('<h1>', '<h1 data-unknown="yes">')],
  ['nonempty compiler marker', s => s.replace('<h1>', '<h1 data-astro-cid-synthetic="changed">')],
  ['script in article', s => s.replace('Alpha ', '<script>Alpha</script> ')],
  ['template in article', s => s.replace('Alpha ', '<template>Alpha</template> ')],
  ['noscript in article', s => s.replace('Alpha ', '<noscript>Alpha</noscript> ')],
  ['SVG in article', s => s.replace('Alpha ', '<svg><text>Alpha</text></svg> ')],
  ['event-handler attribute', s => s.replace('<h1>', '<h1 onclick="alert(1)">')],
  ['unsafe link scheme', s => s.replace('https://example.org/observation?q=1#details', 'javascript:alert(1)')],
  ['credential-bearing link', s => s.replace('https://example.org/observation', 'https://u:p@example.org/observation')],
  ['link whitespace', s => s.replace('https://example.org/observation', ' https://example.org/observation')],
  ['wrong canonical', s => s.replace(`href="${CANONICAL}"`, `href="${CANONICAL}-other"`)],
  ['root wrapper move', s => s.replace('<main class=', '<div><main class=').replace('</main>', '</main></div>')],
  ['empty summary', s => s.replace('Synthetic summary with limitations.', '')],
  ['empty fact', s => s.replace('First synthetic fact.', '')],
  ['too few watch items', s => s.replace('<li>Review first evidence.</li>', '')],
  ['reordered governed regions', s => s.replace(/(<article class="edition-analysis">[\s\S]*?<\/article>)(\s*)(<section class="source-ledger"[\s\S]*?<\/section>)/, '$3$2$1')],
  ['bidi control', s => s.replace('Alpha ', 'Alpha\u202e ')],
  ['NUL', s => s.replace('Alpha ', 'Alpha\0 ')],
  ['oversized document', s => s + ' '.repeat(MAX_HTML_BYTES)],
  ['excessive nesting', s => s.replace('Alpha ', '<span>'.repeat(130) + 'Alpha' + '</span>'.repeat(130))],
]) test(`hold ${name}`, () => rejects(convert(BASE)));
for (const value of [null, undefined, '', 1, {}, [], Buffer.from('html'), '\ud800']) test(`reject unsupported input ${typeof value}:${String(value)}`, () => rejects(value));
for (const value of [null, '', '/relative', 'http://www.usd-impact.com/news/catalysts/test-outcome', `${CANONICAL}/`, `${CANONICAL}?q=1`, `${CANONICAL}#x`, CANONICAL.replace('www.', ''), CANONICAL.replace('www.', 'u:p@www.')]) test(`reject canonical ${value}`, () => rejects(BASE, value));
test('reference failure cannot be overridden by a valid observed document', () => {
  const result = compare('', BASE, CANONICAL); safe(result); assert.equal(result.status, 'CONTENT_COMPARISON_HOLD');
});
test('footer compliance cannot replace the missing article region', () => rejects(BASE.replace(/<section class="compliance"[\s\S]*?<\/section>/, '').replace('<footer>', '<footer>Compliance note: not investment advice.')));
test('a complete archive notice is covered, not ignored', () => {
  const archiveCanonical = CANONICAL.replace(/-outcome$/, '-preview');
  const x = BASE.replace(CANONICAL, archiveCanonical).replace('Brief \u00b7 Outcome', 'Brief \u00b7 Pre-event').replace('<strong>released</strong>', '<strong>scheduled confirmed</strong>').replace('</h1>', '</h1><aside class="catalyst-archive-note" aria-labelledby="archive"><h2 id="archive">Archive note</h2><p>Later outcome: <a href="/news/catalysts/later-outcome">Read later</a>.</p></aside>');
  const result = project(x, archiveCanonical); assert.equal(result.status, 'PROJECTION_READY_NOT_VERIFIED');
  assert.equal(result.coverage.archiveNotices, 1);
  assert.equal(compare(x, x.replace('Read later', 'Different label'), archiveCanonical).status, 'CONTENT_MISMATCH');
});
test('source-only metadata is never invented as an HTML observation', () => {
  const result = project(BASE, CANONICAL);
  const json = JSON.stringify(result.projection);
  for (const key of ['generatedAt', 'eventKey', 'sourceEditionDate', 'generationSourceSha']) assert.ok(!json.includes(key));
});
test('core imports only the reviewed parser and built-in hashing, with no IO or action entry point', () => {
  const source = readFileSync(new URL('./lib/catalyst-rendered-projection.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]);
  assert.deepEqual(imports, ['node:crypto', 'parse5']);
  assert.doesNotMatch(source, /\b(?:fetch|eval|setInterval|setTimeout)\s*\(|process\.env|Date\.now|new Date\(/);
});
function tempBuild(callback) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'catalyst-projection-'));
  const page = path.join(root, 'news/catalysts/2026-09-16-synthetic-event-outcome');
  mkdirSync(page, { recursive: true }); writeFileSync(path.join(page, 'index.html'), BASE);
  try { return callback(root, page); } finally { rmSync(root, { recursive: true, force: true }); }
}
test('generated-output inspection reports structure, never independent comparison or complete inventory', () => tempBuild(root => {
  const result = verifyBuild(root); assert.equal(result.inspectedPageCount, 1);
  assert.equal(result.independentContentComparisonPerformed, false); assert.equal(result.expectedPublicationInventoryVerified, false);
  assert.equal(result.publicationAuthorized, false); assert.equal(result.liveAcquisitionPerformed, false);
}));
test('generated files are read without modification', () => tempBuild((root, page) => {
  const before = readFileSync(path.join(page, 'index.html')); verifyBuild(root);
  assert.deepEqual(readFileSync(path.join(page, 'index.html')), before);
}));
test('empty generated inventory fails', () => tempBuild((root, page) => { rmSync(page, { recursive: true }); assert.throws(() => verifyBuild(root)); }));
test('missing generated page fails', () => tempBuild((root, page) => { rmSync(path.join(page, 'index.html')); assert.throws(() => verifyBuild(root)); }));
test('unknown generated file is not silently skipped', () => tempBuild((root, page) => { writeFileSync(path.join(page, 'other.txt'), 'x'); assert.throws(() => verifyBuild(root)); }));
test('page symlink fails', () => tempBuild((root, page) => { const p = path.join(page, 'index.html'); rmSync(p); symlinkSync('/etc/hosts', p); assert.throws(() => verifyBuild(root)); }));
test('directory symlink fails', () => tempBuild((root, page) => { rmSync(page, { recursive: true }); symlinkSync(root, page); assert.throws(() => verifyBuild(root)); }));
test('invalid UTF-8 fails without replacement decoding', () => tempBuild((root, page) => { writeFileSync(path.join(page, 'index.html'), Buffer.from([0xc3, 0x28])); assert.throws(() => verifyBuild(root)); }));
test('actual page missing mandatory article structure fails', () => tempBuild((root, page) => { writeFileSync(path.join(page, 'index.html'), '<!doctype html><html lang="en"><head></head><body>Login</body></html>'); assert.throws(() => verifyBuild(root)); }));

// Document-level URL overrides and decoded controls must not hide outside regions.
for (const [name, change] of [
  ['base href before existing head metadata', s => s.replace('<head>', '<head><base href="https://example.org/">')],
  ['base target without href', s => s.replace('</head>', '<base target="_blank"></head>')],
  ['base equal to the canonical origin is still unsupported', s => s.replace('</head>', '<base href="https://www.usd-impact.com/"></head>')],
  ['head refresh', s => s.replace('</head>', '<meta http-equiv="refresh" content="0;url=https://example.org/"></head>')],
  ['mixed-case refresh', s => s.replace('</head>', '<meta http-equiv="ReFrEsH" content="60"></head>')],
  ['hex entity control in body', s => s.replace('Alpha ', 'Alpha&#x202e; ')],
  ['decimal entity control in body', s => s.replace('Alpha ', 'Alpha&#8238; ')],
  ['entity control in title', s => s.replace('Synthetic outcome |', 'Synthetic&#x2066; outcome |')],
  ['entity control in description', s => s.replace('Synthetic description', 'Synthetic&#x202d; description')],
  ['entity control in link attribute', s => s.replace('https://example.org/observation', 'https://example.org/obser&#x202e;vation')],
  ['entity control in hero attribute', s => s.replace('<h1>', '<h1 title="Synthetic&#x2069;">')],
]) test(`hold document-wide override or decoded control: ${name}`, () => rejects(change(BASE)));
test('relative observed link cannot inherit an unexamined base element', () => {
  const relative = BASE.replace('https://example.org/observation?q=1#details', '/news/');
  const altered = relative.replace('</head>', '<base href="https://example.org/"></head>');
  const result = compare(relative, altered, CANONICAL);
  safe(result);
  assert.equal(result.status, 'CONTENT_COMPARISON_HOLD');
  assert.equal(result.observedCode, 'UNSUPPORTED_DOCUMENT_BASE');
});
test('ordinary CSP metadata is not confused with an automatic refresh', () => {
  matches(BASE.replace('</head>', '<meta http-equiv="Content-Security-Policy" content="default-src &apos;self&apos;"></head>'));
});
