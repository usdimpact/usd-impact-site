import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOOK_EDITION,
  BRIDGE_VERSION,
  chapters,
  tools,
  printLinks,
  getChapterById,
  getToolById,
} from '../src/data/book-site-bridge/index.mjs';
import {
  classifyDxyScenario,
  compareWeeklyReading,
} from '../src/lib/book-site-bridge/practice-classifiers.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDir, '..');
const repoRoot = resolve(webRoot, '../..');

assert.equal(BOOK_EDITION, '1.2');
assert.equal(BRIDGE_VERSION, '0.1.0-preview');
assert.equal(chapters.length, 13, 'The bridge must govern all 13 book chapters.');

const chapterIds = new Set();
const chapterNumbers = new Set();
const shortCodes = new Set();

for (const chapter of chapters) {
  assert(!chapterIds.has(chapter.id), `Duplicate chapter id: ${chapter.id}`);
  assert(!chapterNumbers.has(chapter.number), `Duplicate chapter number: ${chapter.number}`);
  assert(!shortCodes.has(chapter.shortCode), `Duplicate chapter short code: ${chapter.shortCode}`);
  chapterIds.add(chapter.id);
  chapterNumbers.add(chapter.number);
  shortCodes.add(chapter.shortCode);
  assert.equal(chapter.edition, BOOK_EDITION, `${chapter.id} has an unexpected edition.`);
  assert.equal(chapter.code, String(chapter.number).padStart(2, '0'));
  assert(chapter.summary.length >= 40, `${chapter.id} needs a meaningful summary.`);
  assert(chapter.learningObjectives.length >= 2, `${chapter.id} needs learning objectives.`);
  assert(chapter.commonMistakes.length >= 1, `${chapter.id} needs a diagnostic mistake.`);
  assert(chapter.toolIds.length >= 1, `${chapter.id} must link to at least one tool.`);
  assert(chapter.practicePath.startsWith('/'), `${chapter.id} practice path must be internal.`);
}

assert.deepEqual([...chapterNumbers].sort((a, b) => a - b), Array.from({ length: 13 }, (_, index) => index + 1));

const toolIds = new Set();
for (const tool of tools) {
  assert(!toolIds.has(tool.id), `Duplicate tool id: ${tool.id}`);
  toolIds.add(tool.id);
  assert(tool.path.startsWith('/'), `${tool.id} path must be internal.`);
  assert.equal(tool.steps.length, 3, `${tool.id} must expose exactly three use steps.`);
  assert(tool.inputs.length >= 1, `${tool.id} needs declared inputs.`);
  assert(tool.dataCadence.length >= 10, `${tool.id} needs a data cadence statement.`);
  assert(tool.timestampRule.length >= 10, `${tool.id} needs a timestamp rule.`);
  assert(tool.agreement.length >= 1, `${tool.id} needs an agreement interpretation.`);
  assert(tool.divergence.length >= 1, `${tool.id} needs a divergence interpretation.`);
  assert(tool.limitations.length >= 2, `${tool.id} needs explicit limitations.`);
  assert(tool.chapterIds.length >= 1, `${tool.id} needs at least one book connection.`);
  assert(tool.currentEvidence.length >= 1, `${tool.id} needs current-evidence links.`);

  for (const chapterId of tool.chapterIds) {
    const chapter = getChapterById(chapterId);
    assert(chapter, `${tool.id} references missing ${chapterId}.`);
    assert(chapter.toolIds.includes(tool.id), `${tool.id} -> ${chapterId} is not reciprocal.`);
  }
}

for (const chapter of chapters) {
  for (const toolId of chapter.toolIds) {
    const tool = getToolById(toolId);
    assert(tool, `${chapter.id} references missing ${toolId}.`);
    assert(tool.chapterIds.includes(chapter.id), `${chapter.id} -> ${toolId} is not reciprocal.`);
  }
}

const printCodes = new Set();
for (const link of printLinks) {
  assert(!printCodes.has(link.code), `Duplicate print alias: ${link.code}`);
  printCodes.add(link.code);
  assert(link.target.startsWith('/'), `${link.code} must resolve to an internal path.`);
  assert(!link.target.includes('//'), `${link.code} target contains a duplicate slash.`);
  assert(link.purpose.length > 0, `${link.code} needs a purpose.`);
}

for (let number = 1; number <= 13; number += 1) {
  assert(printCodes.has(`c${String(number).padStart(2, '0')}`), `Missing chapter print alias c${number}.`);
}
assert(printCodes.has('book'));
assert(printCodes.has('companion'));
assert(printCodes.has('dxy-practice'));
assert(printCodes.has('weekly-practice'));
assert(printCodes.has('methodology'));

const requiredFiles = [
  'src/content/products/book-read-the-dollar-first.md',
  'src/components/BookChapterBridgeCard.astro',
  'src/components/BookToolGuide.astro',
  'src/pages/book/read-the-dollar-first/companion/index.astro',
  'src/pages/book/read-the-dollar-first/companion/chapter/[number].astro',
  'src/pages/practice/dxy-vs-broad-usd.astro',
  'src/pages/practice/weekly-regime.astro',
  'src/pages/go/[code].astro',
  'src/lib/book-site-bridge/practice-classifiers.mjs',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(webRoot, path)), `Missing bridge implementation file: ${path}`);
}

const requiredDocs = [
  'docs/book-site-bridge/current-inventory.md',
  'docs/book-site-bridge/gap-analysis.md',
  'docs/book-site-bridge/architecture-decision.md',
  'docs/book-site-bridge/route-map.md',
  'docs/book-site-bridge/chapter-tool-matrix.json',
  'docs/book-site-bridge/tool-chapter-matrix.json',
  'docs/book-site-bridge/content-model.schema.json',
  'docs/book-site-bridge/access-matrix.md',
  'docs/book-site-bridge/promotion-policy.md',
  'docs/book-site-bridge/book-patch-plan.md',
  'docs/book-site-bridge/video-map.md',
  'docs/book-site-bridge/ai-guide-design.md',
  'docs/book-site-bridge/qa-plan.md',
  'docs/book-site-bridge/release-handoff.md',
];

for (const path of requiredDocs) {
  assert(existsSync(resolve(repoRoot, path)), `Missing bridge governance file: ${path}`);
}

const bookPage = readFileSync(resolve(webRoot, 'src/content/products/book-read-the-dollar-first.md'), 'utf8');
assert(bookPage.includes('/book/read-the-dollar-first/companion/'), 'Book page must link to the companion Preview.');
assert(bookPage.includes('/practice/dxy-vs-broad-usd/'), 'Book page must link to Chapter 3 practice.');
assert(bookPage.includes('/practice/weekly-regime/'), 'Book page must link to Chapter 11 practice.');

const dxyPage = readFileSync(resolve(webRoot, 'src/pages/practice/dxy-vs-broad-usd.astro'), 'utf8');
const weeklyPage = readFileSync(resolve(webRoot, 'src/pages/practice/weekly-regime.astro'), 'utf8');
for (const [name, content] of [['DXY prototype', dxyPage], ['Weekly prototype', weeklyPage]]) {
  assert(!content.includes('fetch('), `${name} must not call a network endpoint in Phase 1.`);
  assert(!content.includes('localStorage'), `${name} must not persist a financial profile in Phase 1.`);
  assert(!content.includes('/checkout'), `${name} must not link to checkout.`);
  assert(content.includes('noindex={true}'), `${name} must remain noindex in Preview.`);
}

assert.equal(
  classifyDxyScenario({ dxy: 'firmer', broad: 'firmer', confirmation: 'tightening' }).status,
  'confirmed-firmer',
);
assert.equal(
  classifyDxyScenario({ dxy: 'firmer', broad: 'mixed', confirmation: 'mixed' }).status,
  'basket-led-firmer',
);
assert.equal(
  classifyDxyScenario({ dxy: 'mixed', broad: 'firmer', confirmation: 'tightening' }).status,
  'broad-pressure-understated',
);

const fixture = { dollar: 'firmer', realRates: 'rising', liquidity: 'mixed', driver: 'rates' };
assert.equal(compareWeeklyReading(fixture, fixture).status, 'aligned');
assert.equal(
  compareWeeklyReading(
    { dollar: 'firmer', realRates: 'falling', liquidity: 'mixed', driver: 'funding-stress' },
    fixture,
  ).status,
  'partly-aligned',
);
assert.equal(
  compareWeeklyReading(
    { dollar: 'softer', realRates: 'falling', liquidity: 'easing', driver: 'relative-growth' },
    fixture,
  ).status,
  'materially-different',
);

const matrixPath = resolve(repoRoot, 'docs/book-site-bridge/chapter-tool-matrix.json');
assert(existsSync(matrixPath), 'Missing reviewer chapter-tool matrix.');
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
assert.equal(matrix.bridgeVersion, BRIDGE_VERSION);
assert.deepEqual(
  matrix.chapters,
  chapters.map(({ id, number, toolIds }) => ({ chapterId: id, chapterNumber: number, toolIds })),
);
assert.deepEqual(
  matrix.tools,
  tools.map(({ id, chapterIds }) => ({ toolId: id, chapterIds })),
);

const reverseMatrixPath = resolve(repoRoot, 'docs/book-site-bridge/tool-chapter-matrix.json');
const reverseMatrix = JSON.parse(readFileSync(reverseMatrixPath, 'utf8'));
assert.equal(reverseMatrix.bridgeVersion, BRIDGE_VERSION);
assert.deepEqual(
  reverseMatrix.tools,
  tools.map(({ id, chapterIds }) => ({ toolId: id, chapterIds })),
);

console.log(`Book-site bridge QA passed: ${chapters.length} chapters, ${tools.length} tools, ${printLinks.length} print aliases.`);
