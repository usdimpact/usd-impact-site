import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getLearnSourceLinks } from '../src/lib/learn-source-links.mjs';

const MARKER = 'data-learn-primary-references';
const COMPLIANCE = 'Educational and informational purposes only. Not investment advice.';
const decode = (text) => text.replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const visible = (html) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
// Keep token boundaries: deleting inert blocks can manufacture tags, URLs or IDs.
// This masks the fixed generated template for inspection; it is not an HTML sanitizer.
const clean = (html) => html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
const attr = (tag, name) => decode(tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] ?? '');

/** Checks this fixed Astro template's output, not arbitrary third-party HTML. */
export function inspectLearnSourceLinksHtml(html, card) {
  const failures = [];
  const body = clean(html);
  const refs = getLearnSourceLinks(card);
  const lists = [...body.matchAll(/<ul\b[^>]*\bdata-learn-primary-references\b[^>]*>([\s\S]*?)<\/ul>/gi)];
  if (!refs.length) {
    if (body.includes(MARKER)) failures.push('Unexpected primary-reference list.');
    return failures;
  }
  const check = (value, message) => { if (!value) failures.push(message); };
  check(lists.length === 1, 'Expected one primary-reference list.');
  const section = body.match(/<section\b[^>]*class=["']dc-source-list["'][^>]*>([\s\S]*?)<\/section>/i)?.[1] ?? '';
  check(section.includes(MARKER), 'References must remain inside the Sources section.');
  check(visible(section).includes(card.sourceNames.join(' \u00b7 ')), 'Source-name provenance changed.');
  check(visible(section).includes(COMPLIANCE), 'Compliance text missing.');
  const h1s = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  check(h1s.length === 1 && visible(h1s[0][1]) === card.title, 'Card H1 changed.');
  const title = body.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  check(decode(title) === `${card.title} | USD Impact Learn`, 'Page title changed.');
  const description = [...body.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => tag).find((tag) => attr(tag, 'name') === 'description');
  check(Boolean(description) && attr(description, 'content') === card.hook, 'Page description changed.');
  const text = visible(body);
  for (const value of [card.hook, card.definition, card.whyItMatters, card.example, card.commonMistake, card.keyTakeaway, ...card.whatToWatch]) {
    check(text.includes(value.replace(/\s+/g, ' ').trim()), 'Original card text missing.');
  }
  if (card.videoSlug) check(body.includes(`/guided-edition/video-library/${card.videoSlug}/`), 'Protected video destination changed.');
  check(body.includes(`data-card-id="${card.id}"`), 'Adaptive-review identity changed.');
  const list = lists[0]?.[0] ?? '';
  check(attr(list, 'aria-label') === 'Primary references', 'Reference-list label missing.');
  const links = [...list.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  check(links.length === refs.length, 'Reference count mismatch.');
  refs.forEach((ref, index) => {
    const link = links[index];
    check(Boolean(link) && attr(link[0], 'href') === ref.url && visible(link[2]) === ref.label, 'Reference destination or label mismatch.');
    check(Boolean(link) && attr(link[0], 'rel').split(/\s+/).includes('noreferrer'), 'Reference referrer policy missing.');
    check(visible(list).includes(ref.scope), 'Reference scope missing.');
  });
  return failures;
}

function walkHtml(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? walkHtml(file) : entry.isFile() && entry.name.endsWith('.html') ? [file] : [];
  });
}

export function verifyLearnSourceLinksBuild(distRoot, cards) {
  const failures = [];
  const pilots = cards.filter((card) => getLearnSourceLinks(card).length);
  assert.deepEqual(pilots.map((card) => card.id).sort(), ['card-dxy-broad-purpose', 'card-real-yield']);
  const expected = new Map(pilots.map((card) => [path.resolve(distRoot, 'learn', card.slug, 'index.html'), card]));
  const seen = new Set();
  const files = walkHtml(distRoot);
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const card = expected.get(path.resolve(file));
    if (card) {
      seen.add(card.id);
      for (const failure of inspectLearnSourceLinksHtml(html, card)) failures.push(`${card.id}: ${failure}`);
    } else if (clean(html).includes(MARKER)) failures.push(`Unexpected references: ${path.relative(distRoot, file)}.`);
  }
  for (const card of pilots) if (!seen.has(card.id)) failures.push(`Pilot HTML missing: ${card.id}.`);
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`Learn source links build PASS: 2 pilot pages, 5 references, ${files.length} HTML files checked.`);
  return { pilots: 2, references: 5, htmlFiles: files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  execFileSync(process.execPath, ['--test', fileURLToPath(new URL('./test-learn-source-links.mjs', import.meta.url))], { stdio: 'inherit' });
  const { dailyCards } = await import('../src/data/daily-card-catalog.js');
  verifyLearnSourceLinksBuild(path.resolve('dist'), dailyCards);
}
