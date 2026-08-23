import assert from 'node:assert/strict';
import { dailyCardHistoryPrimaryBatch01 } from '../src/data/daily-card-history-primary-batch-01.js';
import { dailyCardHistoryManuscriptCandidates, dailyCardHistoryManuscriptSource } from '../src/data/daily-card-history-manuscript-candidates.js';
import { dailyCardHistoryManuscriptResolutions } from '../src/data/daily-card-history-manuscript-resolutions.js';
import { dailyCards } from '../src/data/daily-card-catalog.js';

const expectedIds = new Set([
  'card-bretton-woods-architecture',
  'card-imf-bretton-woods-role',
  'card-dollar-liquidity-gold-tension',
  'card-1971-legal-break-transition',
  'card-smithsonian-repair',
  'card-float-jamaica-formalization',
  'card-fiat-market-discipline',
]);
const allowedSourceHosts = new Set([
  'www.federalreservehistory.org',
  'www.imf.org',
  'www.elibrary.imf.org',
  'history.state.gov',
]);

assert.equal(dailyCardHistoryPrimaryBatch01.length, 7, 'History primary Batch 01 must contain exactly seven promotions.');
assert.deepEqual(new Set(dailyCardHistoryPrimaryBatch01.map((card) => card.id)), expectedIds, 'History primary Batch 01 IDs changed unexpectedly.');
assert.equal(dailyCardHistoryManuscriptCandidates.length, 7, 'Certified manuscript source queue must remain seven items.');
assert.equal(dailyCardHistoryManuscriptResolutions.length, 7, 'All seven manuscript candidates must have an explicit resolution.');

const allCardIds = new Set(dailyCards.map((card) => card.id));
const sourceCandidateById = new Map(dailyCardHistoryManuscriptCandidates.map((candidate) => [candidate.id, candidate]));
const resolutionByCard = new Map(dailyCardHistoryManuscriptResolutions.map((resolution) => [resolution.cardId, resolution]));
const ids = new Set();
const slugs = new Set();
const sourceCandidateIds = new Set();

for (const card of dailyCardHistoryPrimaryBatch01) {
  assert.equal(ids.has(card.id), false, `${card.id}: duplicate ID.`);
  assert.equal(slugs.has(card.slug), false, `${card.slug}: duplicate slug.`);
  ids.add(card.id);
  slugs.add(card.slug);

  assert.equal(card.collectionId, 'history-institutions', `${card.id}: must remain History & Institutions.`);
  assert.equal(card.access, 'open', `${card.id}: History Batch 01 must remain open.`);
  assert.equal(card.status, 'ready-for-build', `${card.id}: must remain ready-for-build.`);
  assert.equal(card.lastReviewed, '2026-08-23', `${card.id}: explicit review date changed.`);
  assert.equal(['foundation', 'intermediate'].includes(card.level), true, `${card.id}: invalid reviewed level.`);
  assert.equal(['history', 'connection'].includes(card.format), true, `${card.id}: invalid reviewed format.`);
  assert.equal(Boolean(card.definition && card.whyItMatters && card.keyTakeaway), true, `${card.id}: editorial fields incomplete.`);
  assert.equal(Array.isArray(card.whatToWatch) && card.whatToWatch.length >= 4, true, `${card.id}: whatToWatch must remain substantive.`);
  assert.equal(Array.isArray(card.sourceNames) && card.sourceNames.includes('USD Impact certified manuscript'), true, `${card.id}: certified manuscript source label missing.`);
  assert.equal(Array.isArray(card.sourceUrls) && card.sourceUrls.length >= 2, true, `${card.id}: at least two institutional source URLs required.`);
  assert.equal(card.sourceDriveFileId, dailyCardHistoryManuscriptSource.driveFileId, `${card.id}: certified Drive file identity changed.`);
  assert.equal(card.sourceChapter, dailyCardHistoryManuscriptSource.chapter, `${card.id}: certified chapter identity changed.`);

  for (const sourceUrl of card.sourceUrls) {
    const url = new URL(sourceUrl);
    assert.equal(url.protocol, 'https:', `${card.id}: source URL must use HTTPS.`);
    assert.equal(allowedSourceHosts.has(url.hostname), true, `${card.id}: unapproved institutional source host ${url.hostname}.`);
  }

  const sourceCandidate = sourceCandidateById.get(card.sourceCandidateId);
  assert.ok(sourceCandidate, `${card.id}: manuscript source candidate missing.`);
  assert.equal(sourceCandidateIds.has(sourceCandidate.id), false, `${card.id}: duplicate manuscript source candidate resolution.`);
  sourceCandidateIds.add(sourceCandidate.id);
  assert.equal(card.sourceSection, sourceCandidate.sourceSection, `${card.id}: source section drifted from certified manuscript review item.`);

  const resolution = resolutionByCard.get(card.id);
  assert.ok(resolution, `${card.id}: manuscript resolution missing.`);
  assert.equal(resolution.candidateId, card.sourceCandidateId, `${card.id}: resolution source candidate mismatch.`);
  assert.equal(resolution.resolution, 'promoted', `${card.id}: resolution must remain promoted.`);

  for (const relatedId of card.relatedCardIds) {
    assert.equal(allCardIds.has(relatedId), true, `${card.id}: related card ${relatedId} does not exist.`);
  }
}

const canonicalHistory = dailyCards.filter((card) => card.collectionId === 'history-institutions' && card.status === 'ready-for-build');
assert.equal(canonicalHistory.length, 10, `Expected 10 canonical History & Institutions cards, found ${canonicalHistory.length}.`);
assert.equal(canonicalHistory.filter((card) => card.access === 'open').length, 10, 'History & Institutions must be fully open at the 10-card target.');

console.log('Daily Card History primary-source Batch 01: PASS (7 promoted, 10/10 canonical History, open access).');
