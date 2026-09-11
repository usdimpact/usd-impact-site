import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parse } from '@astrojs/compiler-rs';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { load, FAILSAFE_SCHEMA } from 'js-yaml';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import { dailyCardGlossaryResolutions } from '../src/data/daily-card-glossary-resolutions.js';

const files = {
  component: 'src/components/FrameworkEvidenceChain.astro',
  homepage: 'src/pages/index.astro',
  reportsIndex: 'src/pages/reports/index.astro',
  daily: 'src/pages/news/[date].astro',
  score: 'src/pages/score.astro',
  weekly: 'src/pages/reports/weekly/[date].astro',
  startHere: 'src/content/pages/start-here.md',
  starterGuide: 'src/content/pages/starter-guide.md',
  dollarFramework: 'src/content/frameworks/dollar-framework.md',
  transmission: 'src/content/frameworks/framework-dollar-transmission-chain.md',
};

const read = (relativePath) => fs.readFileSync(path.resolve(relativePath), 'utf8');
const sources = Object.fromEntries(Object.entries(files).map(([key, value]) => [key, read(value)]));
const failures = [];

// Use the compiler and Markdown processor already locked with Astro. A URL in
// a comment, code example, or frontmatter is not evidence of a working anchor.
const concepts = [
  { slug: '/glossary/dxy', label: 'DXY', cardId: 'card-dxy-signal-system' },
  { slug: '/glossary/broad-usd', label: 'Broad USD', cardId: 'card-dxy-signal-system' },
  { slug: '/glossary/real-rates', label: 'Real rates', cardId: 'card-real-yield' },
  { slug: '/glossary/liquidity-stress', label: 'Liquidity stress', cardId: 'card-dollar-yields-liquidity' },
];

function resolveTargets(cards = dailyCards, resolutions = dailyCardGlossaryResolutions) {
  return concepts.map((concept) => {
    const matches = resolutions.filter((item) => item.sourceSlug === concept.slug);
    assert.equal(matches.length, 1, `Missing or ambiguous resolution: ${concept.slug}`);
    assert.equal(matches[0].primaryCardId, concept.cardId, `Changed concept mapping: ${concept.slug}`);
    const targets = cards.filter((card) => card.id === concept.cardId);
    assert.equal(targets.length, 1, `Missing or ambiguous card: ${concept.cardId}`);
    const card = targets[0];
    // Keep this eligibility contract aligned with src/pages/learn/[slug].astro.
    assert.equal(card.access, 'open', `Non-public destination: ${concept.cardId}`);
    assert.equal(card.status, 'ready-for-build', `Unbuilt destination: ${concept.cardId}`);
    assert.match(card.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid Learn slug');
    return { ...concept, href: `/learn/${card.slug}` };
  });
}

function elements(source) {
  assert.ok(typeof source === 'string' && Buffer.byteLength(source) <= 200000, 'Invalid source size');
  const result = parse(source);
  assert.deepEqual(result.diagnostics, [], 'Invalid or unsupported navigation markup');
  const found = [];
  function visit(nodes) {
    for (const node of nodes) {
      if (node.type === 'JSXFragment') visit(node.children);
      if (node.type !== 'JSXElement') continue;
      const name = node.openingElement.name;
      if (name.type !== 'JSXIdentifier' || ['script', 'style', 'template'].includes(name.name)) continue;
      found.push(node);
      visit(node.children);
    }
  }
  // Exclude frontmatter, comments and expression containers, including JS decoys.
  visit(result.ast.body);
  return found;
}

function attribute(node, name) {
  const attrs = node.openingElement.attributes;
  assert.ok(!attrs.some((item) => item.type === 'JSXSpreadAttribute'), 'Dynamic navigation attributes');
  const matches = attrs.filter((item) => item.type === 'JSXAttribute' && item.name.name === name);
  assert.ok(matches.length <= 1, `Duplicate ${name} attribute`);
  if (matches.length === 0) return undefined;
  assert.equal(matches[0].value?.type, 'Literal', `Nonliteral ${name} attribute`);
  assert.equal(typeof matches[0].value.value, 'string', `Invalid ${name} attribute`);
  return matches[0].value.value;
}

function anchorText(nodes) {
  return nodes.map((node) => {
    if (node.type === 'JSXText') return node.value;
    if (node.type === 'JSXElement') return anchorText(node.children);
    if (node.type === 'AstroComment') return '';
    throw new Error('Unsupported navigation label');
  }).join('');
}

function anchors(nodes) {
  return nodes.filter((node) => node.openingElement.name.name === 'a').map((node) => ({
    href: attribute(node, 'href'),
    label: anchorText(node.children).replace(/\s+/g, ' ').trim(),
  }));
}

function rejectObsolete(href) {
  assert.equal(typeof href, 'string', 'Missing navigation destination');
  const url = new URL(href, 'https://www.usd-impact.com');
  if (!['www.usd-impact.com', 'usd-impact.com'].includes(url.hostname)) return;
  const pathname = url.pathname.replace(/\/+$/, '');
  assert.ok(!concepts.some((concept) => concept.slug === pathname), `Obsolete glossary destination: ${href}`);
}

function verifyAnchors(actual, expected) {
  for (const link of actual) rejectObsolete(link.href);
  for (const link of expected) {
    const matches = actual.filter((item) => item.label === link.label);
    assert.equal(matches.length, 1, `Missing or duplicate concept anchor: ${link.label}`);
    assert.equal(matches[0].href, link.href, `Incorrect concept destination: ${link.label}`);
  }
}

function verifyComponent(source, expected) {
  const groups = elements(source).filter((node) => node.openingElement.name.name === 'div'
    && attribute(node, 'aria-label') === 'Framework learning links');
  assert.equal(groups.length, 1, 'Missing or duplicate learning-lenses group');
  const group = groups[0];
  const links = anchors(elements(source.slice(group.start, group.end)));
  verifyAnchors(links, expected);
}

const markdown = await createSatteriMarkdownProcessor({ syntaxHighlight: false });
const targetLinks = resolveTargets();
const markdownContracts = [
  { key: 'startHere', body: targetLinks, metadata: [0, 2, 3] },
  { key: 'starterGuide', body: [
    { ...targetLinks[0], label: 'DXY Learn guide' },
    { ...targetLinks[2], label: 'real-rates Learn guide' },
  ], metadata: [0, 2] },
  { key: 'dollarFramework', body: targetLinks, metadata: [0, 1, 2, 3] },
  { key: 'transmission', body: targetLinks, metadata: [0, 2, 3] },
];

async function verifyMarkdown(source, contract) {
  assert.ok(Buffer.byteLength(source) <= 200000, 'Invalid Markdown size');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  assert.ok(match, 'Missing Markdown frontmatter');
  const metadata = load(match[1], { schema: FAILSAFE_SCHEMA, json: false,
    maxDepth: 50, onWarning: (warning) => { throw warning; } });
  assert.ok(Array.isArray(metadata?.internalLinks), 'Missing internalLinks array');
  for (const href of metadata.internalLinks) rejectObsolete(href);
  const targetHrefs = new Set(targetLinks.map((link) => link.href));
  assert.deepEqual(metadata.internalLinks.filter((href) => targetHrefs.has(href)).sort(),
    contract.metadata.map((index) => targetLinks[index].href).sort(), 'Incorrect concept metadata links');
  const rendered = await markdown.render(source.slice(match[0].length));
  verifyAnchors(anchors(elements(rendered.code)), contract.body);
}

verifyComponent(sources.component, targetLinks);
for (const contract of markdownContracts) await verifyMarkdown(sources[contract.key], contract);

// Negative cases exercise the same checks as the real source files, without
// editing files, making requests, or depending on a running browser/deployment.
let regressionCount = 0;
function rejects(name, work) {
  assert.throws(work, undefined, name);
  regressionCount += 1;
}
const dxyAnchor = `<a href="${targetLinks[0].href}">DXY</a>`;
assert.ok(sources.component.includes(dxyAnchor), 'Missing DXY mutation fixture');
rejects('a commented-out correct href is not a live anchor', () => verifyComponent(
  sources.component.replace(dxyAnchor, `<!-- ${dxyAnchor} -->`), targetLinks));
rejects('a duplicate concept anchor fails', () => verifyComponent(
  sources.component.replace(dxyAnchor, dxyAnchor + dxyAnchor), targetLinks));
rejects('another valid Learn card is not the right concept', () => verifyComponent(
  sources.component.replace(dxyAnchor, `<a href="${targetLinks[2].href}">DXY</a>`), targetLinks));
rejects('obsolete href with correct href in a comment fails', () => verifyComponent(
  sources.component.replace(dxyAnchor, `<a href="/glossary/dxy/">DXY</a><!-- ${dxyAnchor} -->`), targetLinks));
rejects('dynamic concept href requires review', () => verifyComponent(
  sources.component.replace(dxyAnchor, '<a href={destination}>DXY</a>'), targetLinks));
for (const [field, value] of [['access', 'paid'], ['status', 'draft'], ['slug', '../account']]) {
  rejects(`reject ${field} drift`, () => resolveTargets(dailyCards.map((card) =>
    card.id === concepts[0].cardId ? { ...card, [field]: value } : card)));
}
rejects('missing target card fails', () => resolveTargets(dailyCards.filter((card) => card.id !== concepts[0].cardId)));
rejects('changed resolution fails', () => resolveTargets(dailyCards, dailyCardGlossaryResolutions.map((item) =>
  item.sourceSlug === concepts[0].slug ? { ...item, primaryCardId: concepts[2].cardId } : item)));
const start = sources.startHere;
const bodyLink = `[DXY](${targetLinks[0].href})`;
assert.ok(start.includes(bodyLink), 'Missing Markdown mutation fixture');
for (const [name, changed] of [
  ['body regression with correct metadata', start.replace(bodyLink, '[DXY](/glossary/dxy/)')],
  ['wrong body concept', start.replace(bodyLink, `[DXY](${targetLinks[2].href})`)],
  ['metadata regression with correct body', start.replace(`  - "${targetLinks[0].href}"`, '  - "/glossary/dxy"')],
  ['duplicate YAML key', start.replace('internalLinks:', 'internalLinks: []\ninternalLinks:')],
]) {
  assert.notEqual(changed, start, `Missing fixture: ${name}`);
  await assert.rejects(() => verifyMarkdown(changed, markdownContracts[0]), undefined, name);
  regressionCount += 1;
}
await verifyMarkdown(start.replace(bodyLink, '[DXY][dxy-learning]')
  + `\n[dxy-learning]: ${targetLinks[0].href}\n`, markdownContracts[0]);
regressionCount += 1;
console.log(`Glossary destinations: five source files verified; ${regressionCount} regression cases passed.`);

for (const label of ['Learn', 'Daily', 'Score', 'Weekly']) {
  if (!sources.component.includes(`label: '${label}'`)) failures.push(`Evidence Chain missing stage ${label}.`);
}
for (const href of [
  '/start-here/',
  '/news/',
  '/score/',
  '/framework/dollar-transmission-chain/',
]) {
  if (!sources.component.includes(href)) failures.push(`Evidence Chain missing required link ${href}.`);
}
if (!sources.component.includes('Learn → Daily → Score → Weekly')) failures.push('Evidence Chain heading changed unexpectedly.');
if (!sources.component.includes("current?: 'learn' | 'daily' | 'score' | 'weekly'")) failures.push('Evidence Chain must support a neutral overview state.');
if (!sources.component.includes("not a substitute for the Score's published eight-variable formula")) {
  failures.push('Evidence Chain must distinguish learning lenses from the Score formula.');
}

if (!sources.homepage.includes("FrameworkEvidenceChain from '../components/FrameworkEvidenceChain.astro'")) failures.push('Homepage must import the Evidence Chain.');
if (!sources.homepage.includes('<FrameworkEvidenceChain />')) failures.push('Homepage must show the neutral Evidence Chain overview.');
if (!sources.homepage.includes('Learn a repeatable way to tell whether a market move is mainly dollar-led')) failures.push('Homepage must retain a plain-English learner outcome.');
if (sources.homepage.includes('A premium educational framework for understanding')) failures.push('Homepage must not revert to the abstract premium-framework hero copy.');

if (!sources.reportsIndex.includes("FrameworkEvidenceChain from '../../components/FrameworkEvidenceChain.astro'")) failures.push('Reports landing must import the Evidence Chain.');
if (!sources.reportsIndex.includes('<FrameworkEvidenceChain current="weekly" />')) failures.push('Reports landing must identify the Weekly synthesis stage.');
for (const required of ['/news/', '/score/methodology/']) {
  if (!sources.reportsIndex.includes(required)) failures.push(`Reports landing must retain direct provenance/navigation link ${required}.`);
}

if (!sources.daily.includes("FrameworkEvidenceChain from '../../components/FrameworkEvidenceChain.astro'")) failures.push('Daily route must import the Evidence Chain.');
if (!sources.daily.includes('<FrameworkEvidenceChain current="daily" />')) failures.push('Daily route must identify the Daily stage.');

if (!sources.score.includes("FrameworkEvidenceChain from '../components/FrameworkEvidenceChain.astro'")) failures.push('Score route must import the Evidence Chain.');
if (!sources.score.includes('current="score"')) failures.push('Score route must identify the Score stage.');
if (!sources.score.includes("latestWeeklyReport?.data.slug ?? '/reports/'")) failures.push('Score route must link the Weekly stage to the latest Weekly Brief when available.');
if (!sources.score.includes('/score/methodology/')) failures.push('Score route must retain the methodology link.');

if (!sources.weekly.includes("FrameworkEvidenceChain from '../../../components/FrameworkEvidenceChain.astro'")) failures.push('Weekly route must import the Evidence Chain.');
if (!sources.weekly.includes('current="weekly" weeklyHref={entry.data.slug}')) failures.push('Weekly route must identify its current Weekly stage.');
if (!sources.weekly.includes('entry.data.sourceEditions.map')) failures.push('Weekly route must retain exact Daily-edition provenance.');
if (!sources.weekly.includes('entry.data.score.sourceUrl')) failures.push('Weekly route must retain the archived Score provenance link.');

for (const required of ['/news/', '/score/', '/reports/']) {
  if (!sources.startHere.includes(required)) failures.push(`Start Here must retain the broader learning-path link ${required}.`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('framework evidence-chain navigation contract pass');
