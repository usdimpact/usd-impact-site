import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { getLearnSourceLinks, validateLearnSourceLinks } from '../src/lib/learn-source-links.mjs';

const real = { id: 'card-real-yield', slug: 'real-yield', access: 'open', status: 'ready-for-build' };
const dxy = { id: 'card-dxy-broad-purpose', slug: 'dxy-vs-broad-usd-what-each-index-answers', access: 'open', status: 'ready-for-build' };
const ref = () => ({ ...getLearnSourceLinks(real)[0] });

test('two Real Yield references', () => assert.equal(getLearnSourceLinks(real).length, 2));
test('three DXY comparison references', () => assert.equal(getLearnSourceLinks(dxy).length, 3));
test('reference arrays and entries are immutable', () => {
  const refs = getLearnSourceLinks(real);
  assert.ok(Object.isFrozen(refs));
  assert.ok(refs.every(Object.isFrozen));
  assert.throws(() => refs.push(ref()));
  assert.throws(() => { refs[0].url = 'https://example.invalid'; });
});
test('unknown card keeps empty reference fallback', () => assert.deepEqual(getLearnSourceLinks({ ...real, id: 'other' }), []));
test('identity and slug must match', () => assert.deepEqual(getLearnSourceLinks({ ...real, slug: dxy.slug }), []));
test('private access never gains public references', () => {
  for (const access of ['library', 'research', undefined, 'OPEN']) assert.deepEqual(getLearnSourceLinks({ ...real, access }), []);
});
test('unpublished status never gains references', () => {
  for (const status of ['draft', 'review', 'published', undefined]) assert.deepEqual(getLearnSourceLinks({ ...real, status }), []);
});
test('null and invalid inputs are excluded', () => {
  for (const value of [null, undefined, '', 4, [], {}]) assert.deepEqual(getLearnSourceLinks(value), []);
});
test('source object is not changed and private provenance is not read', () => {
  const card = { ...real, hook: 'Original hook', title: 'Original title', lastReviewed: '2026-08-22' };
  Object.defineProperty(card, 'sourcePath', { get() { throw new Error('Private path accessed'); } });
  Object.freeze(card);
  const before = JSON.stringify(card);
  assert.equal(getLearnSourceLinks(card).length, 2);
  assert.equal(JSON.stringify(card), before);
});
test('only explicit source fields returned', () => {
  for (const card of [real, dxy]) for (const entry of getLearnSourceLinks(card)) {
    assert.deepEqual(Object.keys(entry).sort(), ['label', 'scope', 'url']);
  }
});
test('invalid URL schemes, credentials, ports and unreviewed origins rejected', () => {
  for (const url of ['javascript:alert(1)', '//example.invalid', 'http://www.federalreserve.gov/', 'https://user:secret@www.federalreserve.gov/', 'https://www.federalreserve.gov:444/', 'https://www.federalreserve.gov.evil.invalid/']) {
    assert.throws(() => validateLearnSourceLinks([{ ...ref(), url }]));
  }
});
test('query and fragment variants rejected', () => {
  for (const suffix of ['?utm_source=test', '#section', '?_vercel_share=synthetic']) {
    assert.throws(() => validateLearnSourceLinks([{ ...ref(), url: ref().url + suffix }]));
  }
});
test('empty and oversized reference sets rejected', () => {
  for (const entries of [null, {}, [], [ref(), ref(), ref(), ref()]]) assert.throws(() => validateLearnSourceLinks(entries));
});
test('duplicate and extra-field references rejected', () => {
  assert.throws(() => validateLearnSourceLinks([ref(), ref()]));
  assert.throws(() => validateLearnSourceLinks([{ ...ref(), sourcePath: 'private' }]));
});
test('markup, controls and missing descriptions rejected', () => {
  for (const label of ['', '<b>name</b>', 'x\nscript', 'x'.repeat(241)]) assert.throws(() => validateLearnSourceLinks([{ ...ref(), label }]));
  assert.throws(() => validateLearnSourceLinks([{ ...ref(), scope: '' }]));
});
test('renderer patch leaves the original template reversible byte-for-byte', () => {
  const candidate = fs.readFileSync(new URL('../src/pages/learn/[slug].astro', import.meta.url), 'utf8');
  let restored = candidate.replace("import { getLearnSourceLinks } from '../../lib/learn-source-links.mjs';\n", '');
  restored = restored.replace('const sourceLinks = getLearnSourceLinks(card);\n', '');
  restored = restored.replace(/      \{sourceLinks\.length > 0 && \([\s\S]*?      \)\}\n/, '');
  // Reviewed Learn-template snapshot at main@dd9f908; not a rendered-page test.
  const bytes = Buffer.from(restored);
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(blob, '4c6b99e37c31918b04dee545d4c4cf304d0173ea');
  assert.ok(!candidate.includes('set:html'));
});

// Generated-output fixtures exercise the checker; actual Astro output is checked in the build.
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { inspectLearnSourceLinksHtml, verifyLearnSourceLinksBuild } from './verify-learn-source-links-build.mjs';
const cardFixture = (identity) => ({ ...identity, title: 'Fixture title', hook: 'Fixture hook', definition: 'Fixture definition', whyItMatters: 'Fixture reason', example: 'Fixture example', commonMistake: 'Fixture caution', keyTakeaway: 'Fixture conclusion', whatToWatch: ['Fixture watch'], sourceNames: ['First source', 'Second source'], videoSlug: 'fixture-video' });
const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
function htmlFixture(card) {
  const links = getLearnSourceLinks(card).map((r) => `<li><a href="${esc(r.url)}" rel="noreferrer">${esc(r.label)}</a><p>${esc(r.scope)}</p></li>`).join('');
  return `<html><head><title>${esc(card.title)} | USD Impact Learn</title><meta name="description" content="${esc(card.hook)}"></head><body><h1>${esc(card.title)}</h1>${[card.hook,card.definition,card.whyItMatters,card.example,card.commonMistake,card.keyTakeaway,...card.whatToWatch].map((v) => `<p>${esc(v)}</p>`).join('')}<div data-card-id="${card.id}"></div><a href="/guided-edition/video-library/${card.videoSlug}/">Video</a><section class="dc-source-list"><h2>Sources</h2><p>${esc(card.sourceNames.join(' \u00b7 '))}</p><ul aria-label="Primary references" data-learn-primary-references>${links}</ul><p>Educational and informational purposes only. Not investment advice.</p></section></body></html>`;
}
test('both escaped generated-page fixtures pass', () => {
  for (const id of [real, dxy]) { const c = cardFixture(id); assert.deepEqual(inspectLearnSourceLinksHtml(htmlFixture(c), c), []); }
});
test('generated checker rejects missing, duplicate and unreviewed references', () => {
  const c = cardFixture(real), html = htmlFixture(c);
  for (const bad of [html.replace(/<ul[^>]*>[\s\S]*?<\/ul>/, ''), html.replace('</ul>', '<a href="https://example.invalid/">Extra</a></ul>'), html.replace(getLearnSourceLinks(c)[0].url, 'https://example.invalid/')]) {
    assert.ok(inspectLearnSourceLinksHtml(bad, c).length);
  }
});
test('generated checker rejects lost copy, provenance, identity and scope', () => {
  const c = cardFixture(real), html = htmlFixture(c);
  for (const value of [c.definition, c.title, c.hook, c.sourceNames[0], c.id, getLearnSourceLinks(c)[0].scope, 'Not investment advice.', '/guided-edition/video-library/fixture-video/', 'noreferrer', 'Primary references']) {
    assert.ok(inspectLearnSourceLinksHtml(html.replaceAll(esc(value), 'REMOVED'), c).length, value);
  }
});
test('commented and script-contained reference fixtures cannot pass', () => {
  const c = cardFixture(real);
  for (const html of [`<!--${htmlFixture(c)}-->`, `<script>${JSON.stringify(htmlFixture(c))}</script>`]) assert.ok(inspectLearnSourceLinksHtml(html, c).length);
  assert.ok(inspectLearnSourceLinksHtml(htmlFixture(c), { ...c, id: 'unknown' }).length);
});
test('removed blocks cannot manufacture required tags and reference attributes', () => {
  for (const identity of [real, dxy]) {
    const card = cardFixture(identity), html = htmlFixture(card);
    for (const block of ['<!-- seam -->', '<script>ignored</script>', '<style>ignored</style>']) {
      for (const invalid of [
        html.replace('<h1>', `<h${block}1>`),
        html.replace('name="description"', `name="descrip${block}tion"`),
        html.replace('data-learn-primary-references', `data-learn-primary-refe${block}rences`),
        html.replace(getLearnSourceLinks(card)[0].url, getLearnSourceLinks(card)[0].url.replace('https:', `htt${block}ps:`)),
      ]) assert.ok(inspectLearnSourceLinksHtml(invalid, card).length, `${identity.id}: ${block}`);
    }
  }
});
test('removed blocks cannot manufacture preserved identity or protected destinations', () => {
  const card = cardFixture(real), html = htmlFixture(card);
  for (const block of ['<!-- seam -->', '<script>ignored</script>', '<style>ignored</style>']) {
    for (const invalid of [
      html.replace(`data-card-id="${card.id}"`, `data-card-id="card-real${block}-yield"`),
      html.replace('/guided-edition/video-library/fixture-video/', `/guided-edition/video${block}-library/fixture-video/`),
    ]) assert.ok(inspectLearnSourceLinksHtml(invalid, card).length, block);
  }
});
test('inert blocks between complete nodes preserve valid pilot evidence', () => {
  for (const identity of [real, dxy]) {
    const card = cardFixture(identity);
    const decoy = '<ul data-learn-primary-references><li>not rendered</li></ul>';
    const inert = `<!--${decoy}--><script>${JSON.stringify(decoy)}</script><style>/* ${decoy} */</style>`;
    const html = htmlFixture(card).replace('<body>', `<body>${inert}`).replace('</body>', `${inert}</body>`);
    assert.deepEqual(inspectLearnSourceLinksHtml(html, card), []);
  }
});
test('build traversal rejects missing pilots and stray lists', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-sources-'));
  const cards = [cardFixture(real), cardFixture(dxy)];
  try {
    for (const c of cards) { const dir = path.join(root,'learn',c.slug); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'index.html'), htmlFixture(c)); }
    fs.writeFileSync(path.join(root,'index.html'), '<html><body>Legacy page</body></html>');
    assert.deepEqual(verifyLearnSourceLinksBuild(root,cards), {pilots:2,references:5,htmlFiles:3});
    fs.writeFileSync(path.join(root,'index.html'), '<ul data-learn-primary-references></ul>');
    assert.throws(() => verifyLearnSourceLinksBuild(root,cards), /Unexpected references/);
    fs.writeFileSync(path.join(root,'index.html'), '<html></html>');
    fs.unlinkSync(path.join(root,'learn',real.slug,'index.html'));
    assert.throws(() => verifyLearnSourceLinksBuild(root,cards), /Pilot HTML missing/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('source-link module has no production import outside the Learn detail renderer', () => {
  const root = fileURLToPath(new URL('../src/',import.meta.url));
  function walk(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap((e) => { const p=path.join(dir,e.name); return e.isDirectory()?walk(p):/\.(astro|mjs|js|ts)$/.test(e.name)?[p]:[]; }); }
  const matches=walk(root).filter((p) => fs.readFileSync(p,'utf8').includes('learn-source-links.mjs'));
  assert.deepEqual(matches.map((p) => p.replaceAll('\\','/').split('/src/')[1]).sort(), ['pages/learn/[slug].astro']);
});
