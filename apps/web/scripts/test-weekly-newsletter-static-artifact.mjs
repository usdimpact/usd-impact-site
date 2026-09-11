import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { verifyWeeklyNewsletterEditionArtifact } from '../src/lib/weekly-newsletter-edition.js';

const expected = new URL('../dist/newsletter/weekly/2026-09-04.json', import.meta.url);
assert.equal(
  existsSync(expected),
  true,
  'Production build must emit the known published Weekly Newsletter JSON artifact.',
);

const raw = readFileSync(expected, 'utf8');
const artifact = JSON.parse(raw);
const verified = verifyWeeklyNewsletterEditionArtifact(artifact);

assert.equal(verified.schemaVersion, 1);
assert.equal(verified.payload.weekEnding, '2026-09-04');
assert.equal(verified.payload.messageId, 'weekly_newsletter');
assert.equal(verified.payload.consentPurpose, 'weekly_newsletter');
assert.equal(verified.payload.classification, 'marketing');
assert.equal(verified.payload.locale, 'en');
assert.equal(verified.payload.highlights.length, 3);
assert.ok(verified.payload.links.length >= 4);
assert.match(verified.payload.score.note, /not a forecast or trading signal/i);
assert.match(verified.checksum, /^[0-9a-f]{64}$/);

console.log('Built Weekly Newsletter static artifact verified.');
