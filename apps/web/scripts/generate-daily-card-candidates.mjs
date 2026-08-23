import fs from 'node:fs';
import path from 'node:path';
import { videos } from '../src/data/video-library.js';
import { dailyCards } from '../src/data/daily-card-catalog.js';

const coveredVideoSlugs = new Set(dailyCards.map((card) => card.videoSlug).filter(Boolean));
const existingSlugs = new Set(dailyCards.map((card) => card.slug));

const candidates = videos
  .filter((video) => !coveredVideoSlugs.has(video.slug))
  .map((video) => {
    const slug = existingSlugs.has(video.slug) ? `${video.slug}-card` : video.slug;
    return {
      id: `candidate-${video.slug}`,
      slug,
      title: video.title,
      shortTitle: video.shortTitle || video.title,
      collectionId: video.collectionId,
      format: 'concept',
      level: video.collectionId === 'core-framework' || video.collectionId === 'asset-transmission' ? 'foundation' : 'intermediate',
      access: video.collectionId === 'core-framework' || video.collectionId === 'asset-transmission' ? 'open' : 'research',
      hook: video.description,
      definition: video.description,
      whyItMatters: '',
      example: '',
      commonMistake: '',
      whatToWatch: video.concepts || [],
      keyTakeaway: '',
      assets: [],
      concepts: video.concepts || [],
      relatedCardIds: [],
      sourceNames: video.sources || [],
      videoSlug: video.slug,
      status: 'review',
      lastReviewed: null,
      productionNote: 'Auto-derived from reviewed video-library metadata. Complete editorial fields and source verification before promotion to ready-for-build.',
    };
  });

const dir = path.resolve('artifacts/daily-card-candidates');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'candidates.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), count: candidates.length, candidates }, null, 2)}\n`);
console.log(`Generated ${candidates.length} Daily Card review candidates from the video library.`);
