import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import { dailyCardGlossaryResolutions } from '../src/data/daily-card-glossary-resolutions.js';

function parseFrontmatter(text, sourcePath) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert.ok(match, `${sourcePath}: missing frontmatter`);
  const data = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf(':');
    assert.ok(separator > 0, `${sourcePath}: unsupported frontmatter line ${line}`);
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
    data[key] = value;
  }
  return data;
}

const cardById = new Map(dailyCards.map((card) => [card.id, card]));
const resolutionPaths = new Set();
const resolutionSlugs = new Set();

assert.equal(dailyCardGlossaryResolutions.length, 9, 'Exactly nine glossary overlap resolutions are expected after Batch 01.');

for (const item of dailyCardGlossaryResolutions) {
  assert.equal(['alias', 'composite'].includes(item.mode), true, `${item.title}: invalid resolution mode.`);
  assert.equal(item.reviewedAt, '2026-08-23', `${item.title}: resolution review date must be explicit.`);
  assert.equal(resolutionPaths.has(item.sourcePath), false, `${item.sourcePath}: duplicate resolution source path.`);
  assert.equal(resolutionSlugs.has(item.sourceSlug), false, `${item.sourceSlug}: duplicate resolution source slug.`);
  resolutionPaths.add(item.sourcePath);
  resolutionSlugs.add(item.sourceSlug);

  const absolutePath = path.resolve(item.sourcePath);
  assert.equal(fs.existsSync(absolutePath), true, `${item.title}: glossary source file is missing.`);
  const frontmatter = parseFrontmatter(fs.readFileSync(absolutePath, 'utf8'), item.sourcePath);
  assert.equal(frontmatter.status, 'ready-for-build', `${item.title}: glossary source must remain ready-for-build.`);
  assert.equal(frontmatter.slug, item.sourceSlug, `${item.title}: sourceSlug must match glossary frontmatter.`);
  assert.equal(frontmatter.title, item.title, `${item.title}: title must match glossary frontmatter.`);

  assert.equal(cardById.has(item.primaryCardId), true, `${item.title}: primary canonical card ${item.primaryCardId} does not exist.`);
  assert.equal(item.relatedCardIds.includes(item.primaryCardId), false, `${item.title}: primary card cannot also be related.`);
  assert.equal(new Set(item.relatedCardIds).size, item.relatedCardIds.length, `${item.title}: related card IDs must be unique.`);
  for (const cardId of item.relatedCardIds) {
    assert.equal(cardById.has(cardId), true, `${item.title}: related canonical card ${cardId} does not exist.`);
  }
  if (item.mode === 'composite') {
    assert.equal(item.relatedCardIds.length > 0, true, `${item.title}: composite resolution requires related canonical concepts.`);
  }
  assert.equal(typeof item.reason === 'string' && item.reason.length >= 40, true, `${item.title}: resolution reason is too weak.`);
}

const promotedPaths = new Set(
  dailyCards
    .filter((card) => card.status === 'ready-for-build' && typeof card.sourcePath === 'string' && card.sourcePath.startsWith('src/content/glossary/'))
    .map((card) => card.sourcePath),
);
for (const sourcePath of resolutionPaths) {
  assert.equal(promotedPaths.has(sourcePath), false, `${sourcePath}: glossary source cannot be both promoted and resolved.`);
}

const glossaryDir = path.resolve('src/content/glossary');
const readyPaths = new Set();
for (const fileName of fs.readdirSync(glossaryDir).filter((name) => name.endsWith('.md')).sort()) {
  const sourcePath = `src/content/glossary/${fileName}`;
  const frontmatter = parseFrontmatter(fs.readFileSync(path.join(glossaryDir, fileName), 'utf8'), sourcePath);
  if (frontmatter.status === 'ready-for-build') readyPaths.add(sourcePath);
}

const coveredPaths = new Set([...promotedPaths, ...resolutionPaths]);
assert.deepEqual(coveredPaths, readyPaths, 'Every ready-for-build glossary source must be exactly promoted or explicitly resolved.');
assert.equal(promotedPaths.size, 9, 'Expected nine promoted glossary source paths.');
assert.equal(resolutionPaths.size, 9, 'Expected nine explicitly resolved glossary source paths.');
assert.equal(readyPaths.size, 18, 'Expected eighteen ready-for-build glossary source paths.');

console.log('Daily Card glossary resolution coverage: PASS (18/18 ready glossary sources covered: 9 promoted + 9 resolved).');
