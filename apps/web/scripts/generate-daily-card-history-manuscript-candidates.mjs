import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import {
  dailyCardHistoryManuscriptCandidates,
  dailyCardHistoryManuscriptSource,
} from '../src/data/daily-card-history-manuscript-candidates.js';

const outputDir = path.resolve('artifacts/daily-card-history-manuscript');
const currentHistory = dailyCards.filter((card) => card.collectionId === 'history-institutions' && card.status === 'ready-for-build');

if (currentHistory.length !== 3) {
  throw new Error(`Expected 3 current canonical History & Institutions cards before manuscript promotion review, found ${currentHistory.length}.`);
}
if (dailyCardHistoryManuscriptCandidates.length !== 7) {
  throw new Error(`Expected exactly 7 manuscript History review candidates, found ${dailyCardHistoryManuscriptCandidates.length}.`);
}

const ids = new Set();
const titles = new Set();
const candidates = dailyCardHistoryManuscriptCandidates.map((candidate) => {
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
  if (candidate.suggestedAccess !== 'open') throw new Error(`${candidate.id}: manuscript History candidate access must remain open for review, not publication.`);

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
    productionNote: 'Derived from the certified USD Impact manuscript. Before promotion, verify the historical claim against the cited primary institutional sources, confirm non-duplication with canonical History cards, and explicitly approve the final card wording.',
  });
});

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
  candidateCount: candidates.length,
  candidates,
}, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'review.md'), `${[
  '# History & Institutions certified-manuscript review queue', '',
  `Generated: ${generatedAt}`, '',
  `Drive source: **${dailyCardHistoryManuscriptSource.driveTitle}**`,
  `Drive file ID: \`${dailyCardHistoryManuscriptSource.driveFileId}\``,
  `Source chapter: **${dailyCardHistoryManuscriptSource.chapter}**`,
  `Current canonical History cards: **${currentHistory.length} / 10**`,
  `Review-only manuscript candidates: **${candidates.length}**`, '',
  '## Review order', '',
  ...candidates.map((candidate, index) => `${index + 1}. **${candidate.title}** — ${candidate.sourceSection} — ${candidate.suggestedLevel}`), '',
  '## Promotion boundary', '',
  'All seven items remain review-only. Promotion requires primary institutional-source verification, explicit duplicate resolution against the current three History cards, and final editorial approval.', '',
].join('\n')}\n`);

console.log(`History manuscript queue: ${candidates.length} review-only candidates; current canonical History ${currentHistory.length}/10.`);
for (const candidate of candidates) console.log(`HISTORY-MANUSCRIPT: ${candidate.title} | ${candidate.sourceSection}`);
