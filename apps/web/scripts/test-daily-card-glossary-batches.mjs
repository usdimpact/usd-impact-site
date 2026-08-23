import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dailyCardGlossaryBatch01 } from '../src/data/daily-card-glossary-batch-01.js';

const expectedAuthorityById = Object.freeze({
  'card-benchmark': 'U.S. Securities and Exchange Commission / Investor.gov',
  'card-eia': 'U.S. Energy Information Administration',
  'card-federal-reserve': 'Federal Reserve Board',
  'card-risk-off-environment': 'Bank for International Settlements',
  'card-btcusd': 'CME Group',
  'card-usd': 'Bank for International Settlements',
  'card-vix': 'Cboe Global Markets',
  'card-wti': 'U.S. Energy Information Administration',
  'card-xauusd': 'World Gold Council',
});

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

assert.equal(dailyCardGlossaryBatch01.length, 9, 'Glossary Batch 01 must remain exactly nine reviewed promotions.');
assert.deepEqual(
  new Set(dailyCardGlossaryBatch01.map((card) => card.id)),
  new Set(Object.keys(expectedAuthorityById)),
  'Glossary Batch 01 IDs must match the reviewed authority map.',
);

const sourcePaths = new Set();
for (const card of dailyCardGlossaryBatch01) {
  assert.equal(card.access, 'open', `${card.id} must remain open.`);
  assert.equal(card.status, 'ready-for-build', `${card.id} must remain ready-for-build.`);
  assert.equal(card.lastReviewed, '2026-08-23', `${card.id} must preserve its explicit review date.`);
  assert.equal(card.sourceNames.includes('USD Impact Glossary'), true, `${card.id} must retain glossary provenance.`);
  assert.equal(card.sourceNames.includes(expectedAuthorityById[card.id]), true, `${card.id} must retain its reviewed authoritative source.`);
  assert.equal(typeof card.sourcePath, 'string', `${card.id} must retain sourcePath.`);
  assert.equal(sourcePaths.has(card.sourcePath), false, `${card.sourcePath} is duplicated in glossary promotions.`);
  sourcePaths.add(card.sourcePath);

  const absolutePath = path.resolve(card.sourcePath);
  assert.equal(fs.existsSync(absolutePath), true, `${card.id} references missing glossary source ${card.sourcePath}.`);
  const frontmatter = parseFrontmatter(fs.readFileSync(absolutePath, 'utf8'), card.sourcePath);
  assert.equal(frontmatter.status, 'ready-for-build', `${card.sourcePath} must remain ready-for-build.`);
  assert.equal(Boolean(frontmatter.title), true, `${card.sourcePath} must retain a title.`);
  assert.equal(Boolean(frontmatter.definition), true, `${card.sourcePath} must retain a definition.`);
  assert.equal(Boolean(frontmatter.slug), true, `${card.sourcePath} must retain a slug.`);
}

console.log('Daily Card glossary provenance: PASS (9 promoted cards in Batch 01).');
