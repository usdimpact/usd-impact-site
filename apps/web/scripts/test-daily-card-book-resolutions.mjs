import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import { dailyCardBookResolutions, getDailyCardBookResolution } from '../src/data/daily-card-book-resolutions.js';

assert.equal(dailyCardBookResolutions.length, 3, 'Exactly three reviewed Book overlap resolutions are expected in this batch.');

const allCardIds = new Set(dailyCards.map((card) => card.id));
const promotedSectionKeys = new Set(
  dailyCards
    .filter((card) => card.status === 'ready-for-build' && typeof card.sourcePath === 'string' && card.sourcePath.startsWith('src/content/pages/') && typeof card.sourceHeading === 'string')
    .map((card) => `${card.sourcePath}::${card.sourceHeading}`),
);
const resolutionKeys = new Set();

for (const resolution of dailyCardBookResolutions) {
  const key = `${resolution.sourcePath}::${resolution.sourceHeading}`;
  assert.equal(resolutionKeys.has(key), false, `Duplicate Book resolution key: ${key}`);
  resolutionKeys.add(key);

  assert.equal(resolution.mode, 'overlap', `${key}: resolution mode must remain overlap.`);
  assert.equal(resolution.reviewedAt, '2026-08-24', `${key}: review date changed.`);
  assert.equal(typeof resolution.reason === 'string' && resolution.reason.length >= 80, true, `${key}: substantive editorial rationale required.`);
  assert.equal(allCardIds.has(resolution.primaryCardId), true, `${key}: primary canonical card is missing.`);
  assert.equal(Array.isArray(resolution.relatedCardIds), true, `${key}: relatedCardIds must be an array.`);
  for (const relatedId of resolution.relatedCardIds) {
    assert.equal(allCardIds.has(relatedId), true, `${key}: related canonical card ${relatedId} is missing.`);
  }
  assert.equal(promotedSectionKeys.has(key), false, `${key}: source section cannot be both promoted and resolved.`);
  assert.equal(getDailyCardBookResolution(resolution.sourcePath, resolution.sourceHeading), resolution, `${key}: lookup registry mismatch.`);

  const absolutePath = path.resolve(resolution.sourcePath);
  assert.equal(fs.existsSync(absolutePath), true, `${key}: source page does not exist.`);
  const text = fs.readFileSync(absolutePath, 'utf8');
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  assert.ok(frontmatter, `${key}: source frontmatter is missing.`);
  const slugMatch = frontmatter[1].match(/^slug:\s*"?([^"\n]+)"?\s*$/m);
  assert.ok(slugMatch, `${key}: source slug is missing.`);
  assert.equal(slugMatch[1], resolution.sourcePageSlug, `${key}: source page slug changed.`);
  assert.equal(frontmatter[2].split(/\r?\n/).some((line) => line.trim() === `## ${resolution.sourceHeading}`), true, `${key}: exact reviewed H2 no longer exists.`);
}

assert.equal(
  getDailyCardBookResolution('src/content/pages/dxy-vs-broad-usd.md', 'Four practical scenarios')?.primaryCardId,
  'card-dollar-breadth-signal-matrix',
  'DXY-vs-Broad scenario overlap must remain mapped to the breadth matrix.',
);
assert.equal(
  getDailyCardBookResolution('src/content/pages/what-is-dxy.md', 'Common mistakes')?.primaryCardId,
  'card-dollar-story-diagnostic-errors',
  'DXY common-mistakes overlap must remain mapped to the diagnostic-errors card.',
);

console.log('Daily Card Book resolutions: PASS (3 reviewed overlaps excluded from future promotion queues).');
