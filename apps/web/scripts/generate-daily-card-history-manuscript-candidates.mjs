import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import {
  dailyCardHistoryManuscriptCandidates,
  dailyCardHistoryManuscriptSource,
} from '../src/data/daily-card-history-manuscript-candidates.js';
import { dailyCardHistoryManuscriptResolutions } from '../src/data/daily-card-history-manuscript-resolutions.js';

const outputDir = path.resolve('artifacts/daily-card-history-manuscript');
const currentHistory = dailyCards.filter((card) => card.collectionId === 'history-institutions' && card.status === 'ready-for-build');

if (dailyCardHistoryManuscriptCandidates.length !== 7) {
  throw new Error(`Expected exactly 7 manuscript History source candidates, found ${dailyCardHistoryManuscriptCandidates.length}.`);
}

const ids = new Set();
const titles = new Set();
const allCandidates = dailyCardHistoryManuscriptCandidates.map((candidate) => {
  if (ids.has(candidate.id)) throw new Error(`Duplicate History candidate ID ${candidate.id}.`);
  ids.add(candidate.id);
  const titleKey = candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (titles.has(titleKey)) throw new Error(`Duplicate History candidate title ${candidate.title}.`);
  titles.add(titleKey);
  if (!candidate.sourceSection || !candidate.sourceSummary || candidate.sourceSummary.length < 40) {
    throw new Error(`${candidate.id}: source section/summary is incomplete.`);
  }
  if (!['foundation', 'intermediate'].includes(candidate.suggestedLevel)) throw new Error(`${candidate.id}: invalid suggested level.`);
  if (!['history', 'connection'].includes(candidate.suggestedFormat)) throw new Error(`${candidate.id}: invalid suggested format.`);
  if (candidate.suggestedAccess !== 'open') throw new Error(`${candidate.id}: manuscript History candidate access must remain open.`);

  return Object.freeze({
    ...candidate,
    suggestedCollectionId: 'history-institutions',
    sourceHierarchyRank: dailyCardHistoryManuscriptSource.hierarchyRank,
    sourceType: dailyCardHistoryManuscriptSource.sourceType,
    sourceDriveFileId: dailyCardHistoryManuscriptSource.driveFileId,
    sourceDriveTitle: dailyCardHistoryManuscriptSource.driveTitle,
    sourceEdition: dailyCardHistoryManuscriptSource.edition,
    sourceProductionBuild: dailyCardHistoryManuscriptSource.productionBuild,
    sourceChapter: dailyCardHistoryManuscriptSource.chapter,
    sourceReviewedOn: dailyCardHistoryManuscriptSource.reviewedOn,
    reviewDisposition: 'primary-source-verification-required',
    status: 'review',
    lastReviewed: null,
    productionNote: 'Derived from the certified USD Impact manuscript. Promotion requires primary institutional-source verification, non-duplication review, and explicit editorial approval.',
  });
});

const candidateById = new Map(allCandidates.map((candidate) => [candidate.id, candidate]));
const resolvedCandidateIds = new Set();
const resolutions = dailyCardHistoryManuscriptResolutions.map((resolution) => {
  if (resolvedCandidateIds.has(resolution.candidateId)) throw new Error(`Duplicate History resolution ${resolution.candidateId}.`);
  resolvedCandidateIds.add(resolution.candidateId);
  const sourceCandidate = candidateById.get(resolution.candidateId);
  if (!sourceCandidate) throw new Error(`Unknown History resolution candidate ${resolution.candidateId}.`);
  if (resolution.resolution !== 'promoted') throw new Error(`${resolution.candidateId}: unsupported History resolution.`);
  const card = dailyCards.find((candidate) => candidate.id === resolution.cardId);
  if (!card) throw new Error(`${resolution.candidateId}: promoted card ${resolution.cardId} is missing.`);
  if (card.collectionId !== 'history-institutions' || card.access !== 'open' || card.status !== 'ready-for-build') {
    throw new Error(`${resolution.cardId}: promoted History card violates canonical access/publication boundary.`);
  }
  if (card.sourceCandidateId !== resolution.candidateId || card.sourceDriveFileId !== dailyCardHistoryManuscriptSource.driveFileId) {
    throw new Error(`${resolution.cardId}: source candidate or certified manuscript identity mismatch.`);
  }
  if (!Array.isArray(card.sourceUrls) || card.sourceUrls.length < 2) throw new Error(`${resolution.cardId}: primary source URLs are incomplete.`);
  return Object.freeze({
    ...resolution,
    sourceSection: sourceCandidate.sourceSection,
    cardTitle: card.title,
    cardSlug: card.slug,
    sourceUrls: card.sourceUrls,
  });
});

const candidates = allCandidates.filter((candidate) => !resolvedCandidateIds.has(candidate.id));
const generatedAt = new Date().toISOString();
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'candidates.json'), `${JSON.stringify({
  generatedAt,
  sourceHierarchyRank: dailyCardHistoryManuscriptSource.hierarchyRank,
  sourceType: dailyCardHistoryManuscriptSource.sourceType,
  source: dailyCardHistoryManuscriptSource,
  targetCollectionId: 'history-institutions',
  targetCount: 10,
  currentCanonicalCount: currentHistory.length,
  originalCandidateCount: allCandidates.length,
  resolvedCount: resolutions.length,
  candidateCount: candidates.length,
  candidates,
}, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'resolved.json'), `${JSON.stringify({ generatedAt, count: resolutions.length, resolutions }, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'review.md'), `${[
  '# History & Institutions certified-manuscript review queue', '',
  `Generated: ${generatedAt}`, '',
  `Drive source: **${dailyCardHistoryManuscriptSource.driveTitle}**`,
  `Drive file ID: \`${dailyCardHistoryManuscriptSource.driveFileId}\``,
  `Source chapter: **${dailyCardHistoryManuscriptSource.chapter}**`,
  `Current canonical History cards: **${currentHistory.length} / 10**`,
  `Original manuscript candidates: **${allCandidates.length}**`,
  `Primary-source verified/promoted: **${resolutions.length}**`,
  `Remaining review-only candidates: **${candidates.length}**`, '',
  '## Remaining review items', '',
  ...(candidates.length ? candidates.map((candidate, index) => `${index + 1}. **${candidate.title}** — ${candidate.sourceSection}`) : ['- None.']), '',
  '## Resolved promotions', '',
  ...resolutions.map((resolution) => `- **${resolution.cardTitle}** — \`${resolution.candidateId}\` — ${resolution.sourceSection}`), '',
  'All promoted items retain certified-manuscript provenance plus official institutional source URLs.', '',
].join('\n')}\n`);

console.log(`History manuscript queue: ${candidates.length} unresolved from ${allCandidates.length}; ${resolutions.length} promoted; current canonical History ${currentHistory.length}/10.`);
for (const resolution of resolutions) console.log(`HISTORY-RESOLVED: ${resolution.candidateId} -> ${resolution.cardId}`);
