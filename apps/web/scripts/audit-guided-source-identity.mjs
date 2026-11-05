/**
 * Read-only Edition 1.3 Guided Reader source-identity audit.
 *
 * This script NEVER queries a database, changes content, or checks accessible
 * equivalence. It accepts only source-release metadata exported separately
 * through a specifically authorized read-only query.
 *
 * CLI (from apps/web):
 *   node scripts/audit-guided-source-identity.mjs --self-test
 *   node scripts/audit-guided-source-identity.mjs --input /path/to/release-metadata.json
 *
 * Input shape:
 *   {"chapters":[{"content_id":"guided-edition:chapter-1", "chapter_number":1,
 *                 "version":1, "status":"published", "source_sha256":"..."},...],
 *    "supplements":[{"content_id":"guided-supplement:further-reading",
 *                    "slug":"further-reading", "supplement_type":"further-reading",
 *                    "sort_order":1, "version":1, "status":"published", "source_sha256":"..."},...]}
 *
 * No protected payload, account identifier, tokens, or learning progress is
 * permitted in the input. Never claim EAA/WCAG compliance from this audit.
 */

import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_MANIFEST = new URL('../src/lib/private-book.js', import.meta.url);
const SHA256 = /^[a-f0-9]{64}$/;
const CHAPTERS = Object.freeze(Array.from({ length: 13 }, (_, index) => ({
  content_id: `guided-edition:chapter-${index + 1}`,
  chapter_number: index + 1,
})));
const SUPPLEMENTS = Object.freeze([
  { content_id: 'guided-supplement:further-reading', slug: 'further-reading', supplement_type: 'further-reading', sort_order: 1 },
  { content_id: 'guided-supplement:appendix-a-quick-glossary', slug: 'appendix-a-quick-glossary', supplement_type: 'appendix', sort_order: 2 },
  { content_id: 'guided-supplement:appendix-b-usd-impact-score-methodology', slug: 'appendix-b-usd-impact-score-methodology', supplement_type: 'appendix', sort_order: 3 },
]);
const CHAPTER_FIELDS = new Set(['content_id', 'chapter_number', 'version', 'status', 'source_sha256']);
const SUPPLEMENT_FIELDS = new Set(['content_id', 'slug', 'supplement_type', 'sort_order', 'version', 'status', 'source_sha256']);

export async function readPrivateBookAuthority() {
  // Read manifest source as plain text. Do not execute a Supabase-using module.
  const source = await readFile(SOURCE_MANIFEST, 'utf8');
  const block = source.match(/export\s+const\s+privateBookDocument\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/);
  const edition = block?.[1].match(/\bedition\s*:\s*['"]([^'"]+)['"]/);
  const fingerprint = block?.[1].match(/\bsha256\s*:\s*['"]([a-f0-9]{64})['"]/);
  if (!block || !edition || !fingerprint || !SHA256.test(fingerprint[1])) {
    throw new Error('Private book source authority is missing or malformed.');
  }
  return Object.freeze({ edition: edition[1], source_sha256: fingerprint[1] });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function auditGroup(rows, specs, fields, kind, authority) {
  if (!Array.isArray(rows) || rows.length > 40) {
    throw new TypeError(`${kind} must be a bounded metadata array (at most 40 rows).`);
  }
  for (const row of rows) {
    if (!isRecord(row) || Object.keys(row).some((key) => !fields.has(key))) {
      // No unexpected/private field names or values are echoed to logs.
      throw new TypeError(`${kind} contains an unexpected or private field.`);
    }
  }
  const byId = new Map();
  for (const row of rows) {
    const key = typeof row.content_id === 'string' ? row.content_id : '';
    byId.set(key, [...(byId.get(key) ?? []), row]);
  }
  const expected = new Set(specs.map((spec) => spec.content_id));
  const missing = [];
  const duplicate = [];
  const invalid = [];
  const wrongSource = [];
  let matchingSource = 0;

  for (const spec of specs) {
    const matches = byId.get(spec.content_id) ?? [];
    if (matches.length === 0) {
      missing.push(spec.content_id);
      continue;
    }
    if (matches.length !== 1) {
      duplicate.push(spec.content_id);
      continue;
    }
    const row = matches[0];
    const shapeValid = Object.entries(spec).every(([key, value]) => row[key] === value)
      && row.status === 'published'
      && Number.isInteger(row.version) && row.version >= 1
      && typeof row.source_sha256 === 'string' && SHA256.test(row.source_sha256);
    if (!shapeValid) {
      invalid.push(spec.content_id);
      continue;
    }
    if (row.source_sha256 !== authority.source_sha256) {
      wrongSource.push(spec.content_id);
      continue;
    }
    matchingSource += 1;
  }
  const unexpected = [...byId.keys()].filter((id) => !expected.has(id));
  return Object.freeze({
    expectedCount: specs.length,
    receivedCount: rows.length,
    matchingSource,
    missing,
    duplicate,
    invalid,
    wrongSource,
    unexpected,
    sourceIdentityPass: matchingSource === specs.length && rows.length === specs.length
      && [missing, duplicate, invalid, wrongSource, unexpected].every((items) => items.length === 0),
  });
}

export function auditGuidedSourceIdentity(input, authority) {
  if (!isRecord(input) || Object.keys(input).some((key) => !['chapters', 'supplements'].includes(key))) {
    throw new TypeError('Input must contain only chapters and supplements metadata arrays.');
  }
  if (!isRecord(authority) || !SHA256.test(authority.source_sha256 ?? '')
    || typeof authority.edition !== 'string' || !authority.edition.trim()) {
    throw new TypeError('A valid current private-book authority is required.');
  }
  const chapters = auditGroup(input.chapters, CHAPTERS, CHAPTER_FIELDS, 'chapters', authority);
  const supplements = auditGroup(input.supplements, SUPPLEMENTS, SUPPLEMENT_FIELDS, 'supplements', authority);
  const sourceIdentityPass = chapters.sourceIdentityPass && supplements.sourceIdentityPass;
  return Object.freeze({
    expectedEdition: authority.edition,
    expectedSourceSha256: authority.source_sha256,
    sourceIdentityStatus: sourceIdentityPass ? 'MATCH' : 'HOLD',
    chapters,
    supplements,
    // Source hash equality is NEVER substantive content parity or AT evidence.
    contentEquivalence: 'NOT_EVALUATED',
    accessibilityConformance: 'NOT_EVALUATED',
    scoreRights: 'HOLD',
    publicationAuthorized: false,
  });
}

async function selfTest() {
  const authority = await readPrivateBookAuthority();
  assert.match(authority.source_sha256, SHA256);
  assert.equal(authority.edition, '1.3');
  const chapters = CHAPTERS.map((row) => ({ ...row, version: 1, status: 'published', source_sha256: authority.source_sha256 }));
  const supplements = SUPPLEMENTS.map((row) => ({ ...row, version: 1, status: 'published', source_sha256: authority.source_sha256 }));
  const original = { chapters, supplements };
  const valid = auditGuidedSourceIdentity(original, authority);
  assert.equal(valid.sourceIdentityStatus, 'MATCH');
  assert.equal(valid.chapters.matchingSource, 13);
  assert.equal(valid.supplements.matchingSource, 3);
  assert.equal(valid.publicationAuthorized, false);
  assert.equal(valid.contentEquivalence, 'NOT_EVALUATED');
  const oldSha = 'ca3f7d14f5fe4e863e1e83562034cf1d8bacfe6cf6a71fe612a2446f82d9b5da';
  const oldRelease = { chapters: chapters.map((row) => ({ ...row, source_sha256: oldSha })), supplements: supplements.map((row) => ({ ...row, source_sha256: oldSha })) };
  const held = auditGuidedSourceIdentity(oldRelease, authority);
  assert.equal(held.sourceIdentityStatus, 'HOLD');
  assert.equal(held.chapters.wrongSource.length, 13);
  assert.equal(held.supplements.wrongSource.length, 3);
  const missing = auditGuidedSourceIdentity({ chapters: chapters.slice(1), supplements }, authority);
  assert.deepEqual(missing.chapters.missing, ['guided-edition:chapter-1']);
  assert.equal(missing.sourceIdentityStatus, 'HOLD');
  const duplicate = auditGuidedSourceIdentity({ chapters: [...chapters, chapters[0]], supplements }, authority);
  assert.deepEqual(duplicate.chapters.duplicate, ['guided-edition:chapter-1']);
  const invalid = auditGuidedSourceIdentity({ chapters: chapters.map((row, i) => i === 0 ? { ...row, version: 0 } : row), supplements }, authority);
  assert.deepEqual(invalid.chapters.invalid, ['guided-edition:chapter-1']);
  const mixed = auditGuidedSourceIdentity({ chapters, supplements: supplements.map((row, i) => i === 2 ? { ...row, source_sha256: oldSha } : row) }, authority);
  assert.equal(mixed.supplements.wrongSource.length, 1);
  const unexpected = auditGuidedSourceIdentity({ chapters: [...chapters, { ...chapters[0], content_id: 'guided-edition:chapter-14', chapter_number: 14 }], supplements }, authority);
  assert.deepEqual(unexpected.chapters.unexpected, ['guided-edition:chapter-14']);
  assert.throws(() => auditGuidedSourceIdentity({ chapters: [{ ...chapters[0], payload: { privateText: 'do-not-log' } }, ...chapters.slice(1)], supplements }, authority), /unexpected or private field/);
  assert.throws(() => auditGuidedSourceIdentity({ ...original, accounts: [] }, authority), /only chapters and supplements/);
  assert.throws(() => auditGuidedSourceIdentity({ chapters: new Array(41).fill(chapters[0]), supplements }, authority), /bounded metadata array/);
  assert.equal(auditGuidedSourceIdentity(original, authority).publicationAuthorized, false);
  console.log('PASS: 11 fail-closed source-identity assertions (synthetic metadata only); accessibility/release remain HOLD.');
}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === '--self-test') {
    await selfTest();
    return;
  }
  if (process.argv.length !== 4 || process.argv[2] !== '--input') {
    throw new Error('Usage: node scripts/audit-guided-source-identity.mjs --self-test | --input metadata.json');
  }
  const inputPath = resolve(process.argv[3]);
  const fileInfo = await stat(inputPath);
  if (!fileInfo.isFile() || fileInfo.size > 200000) {
    throw new Error('Metadata input must be a regular file under 200 kB.');
  }
  const text = await readFile(inputPath, 'utf8');
  const report = auditGuidedSourceIdentity(JSON.parse(text), await readPrivateBookAuthority());
  console.log(JSON.stringify(report, null, 2));
  if (report.sourceIdentityStatus !== 'MATCH') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Source-identity audit unavailable: ${error.message}`);
    process.exitCode = 2;
  });
}
