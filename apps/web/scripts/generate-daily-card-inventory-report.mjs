import fs from 'node:fs';
import path from 'node:path';
import { dailyCards, dailyCardCollections } from '../src/data/daily-card-catalog.js';
import { videos } from '../src/data/video-library.js';
import {
  dailyCardInventoryTargets,
  dailyCardInventoryTargetTotal,
  dailyCardPromotionRules,
  dailyCardSourceHierarchy,
} from '../src/data/daily-card-inventory-plan.js';

const canonicalVideoSlugs = new Set(dailyCards.map((card) => card.videoSlug).filter(Boolean));
const videoByCollection = new Map();
for (const video of videos) {
  const current = videoByCollection.get(video.collectionId) || [];
  current.push(video);
  videoByCollection.set(video.collectionId, current);
}

const collectionRows = dailyCardCollections.map((collection) => {
  const cards = dailyCards.filter((card) => card.collectionId === collection.id);
  const target = dailyCardInventoryTargets[collection.id] ?? 0;
  const ready = cards.filter((card) => dailyCardPromotionRules.publishableStatuses.includes(card.status));
  const open = ready.filter((card) => card.access === 'open');
  const research = ready.filter((card) => card.access === 'research');
  const library = ready.filter((card) => card.access === 'library');
  const collectionVideos = videoByCollection.get(collection.id) || [];
  const uncoveredVideos = collectionVideos.filter((video) => !canonicalVideoSlugs.has(video.slug));
  return {
    id: collection.id,
    title: collection.title,
    target,
    canonical: cards.length,
    publishable: ready.length,
    open: open.length,
    library: library.length,
    research: research.length,
    gapToTarget: Math.max(0, target - cards.length),
    reviewedVideos: collectionVideos.length,
    uncoveredReviewedVideos: uncoveredVideos.length,
  };
});

const uncoveredReviewedVideos = videos
  .filter((video) => !canonicalVideoSlugs.has(video.slug))
  .map((video) => ({
    slug: video.slug,
    title: video.title,
    collectionId: video.collectionId,
    concepts: video.concepts || [],
    sourceNames: video.sources || [],
  }));

const report = {
  generatedAt: new Date().toISOString(),
  targetTotal: dailyCardInventoryTargetTotal,
  canonicalTotal: dailyCards.length,
  publishableTotal: dailyCards.filter((card) => dailyCardPromotionRules.publishableStatuses.includes(card.status)).length,
  gapToTarget: Math.max(0, dailyCardInventoryTargetTotal - dailyCards.length),
  reviewedVideoTotal: videos.length,
  coveredReviewedVideos: canonicalVideoSlugs.size,
  uncoveredReviewedVideoTotal: uncoveredReviewedVideos.length,
  collections: collectionRows,
  sourceHierarchy: dailyCardSourceHierarchy,
  promotionRules: dailyCardPromotionRules,
  uncoveredReviewedVideos,
};

const dir = path.resolve('artifacts/daily-card-inventory');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'coverage.json'), `${JSON.stringify(report, null, 2)}\n`);

const markdown = [
  '# USD Impact Daily Cards inventory coverage',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  `Canonical concepts: **${report.canonicalTotal}/${report.targetTotal}**`,
  `Gap to target: **${report.gapToTarget}**`,
  `Reviewed videos: **${report.reviewedVideoTotal}**`,
  `Reviewed videos not yet represented by a canonical card: **${report.uncoveredReviewedVideoTotal}**`,
  '',
  '| Collection | Target | Canonical | Publishable | Open | Library | Research | Gap | Reviewed videos | Uncovered videos |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...collectionRows.map((row) => `| ${row.title} | ${row.target} | ${row.canonical} | ${row.publishable} | ${row.open} | ${row.library} | ${row.research} | ${row.gapToTarget} | ${row.reviewedVideos} | ${row.uncoveredReviewedVideos} |`),
  '',
  '## Source hierarchy',
  '',
  ...dailyCardSourceHierarchy.map((source) => `${source.order}. ${source.label}`),
  '',
  '## Promotion boundary',
  '',
  `Machine-derived candidates remain \`${dailyCardPromotionRules.machineCandidateStatus}\` until editorial completion and source review.`,
  '',
  '## Uncovered reviewed videos',
  '',
  ...uncoveredReviewedVideos.map((video) => `- **${video.title}** — ${video.collectionId}; sources: ${video.sourceNames.join(', ') || 'missing'}`),
  '',
];
fs.writeFileSync(path.join(dir, 'coverage.md'), `${markdown.join('\n')}\n`);

console.log(`Daily Cards inventory coverage: ${report.canonicalTotal}/${report.targetTotal}; ${report.uncoveredReviewedVideoTotal} reviewed videos remain uncovered.`);
