import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import { dailyCardInventoryTargets } from '../src/data/daily-card-inventory-plan.js';

const inputPath = path.resolve('artifacts/daily-card-book-candidates/candidates.json');
const outputDir = path.resolve('artifacts/daily-card-book-shortlist');
const recommendedBatchSize = 12;
const maxPerSourceLesson = 2;

if (!fs.existsSync(inputPath)) {
  throw new Error('Book candidate artifact is missing. Run generate-daily-card-book-candidates.mjs first.');
}

const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const canonicalCounts = Object.fromEntries(Object.keys(dailyCardInventoryTargets).map((id) => [id, 0]));
for (const card of dailyCards) {
  if (Object.hasOwn(canonicalCounts, card.collectionId)) canonicalCounts[card.collectionId] += 1;
}

const coverage = Object.fromEntries(Object.entries(dailyCardInventoryTargets).map(([collectionId, target]) => {
  const current = canonicalCounts[collectionId] || 0;
  const deficit = Math.max(0, target - current);
  return [collectionId, {
    target,
    current,
    deficit,
    deficitRatio: target ? deficit / target : 0,
  }];
}));

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function specificityScore(title) {
  const words = String(title || '').trim().split(/\s+/).filter(Boolean);
  let score = 0;
  if (words.length >= 3 && words.length <= 12) score += 8;
  if (/[?:]/.test(title)) score += 2;
  if (/\b(vs|versus|why|how|when|what|which|difference|channel|mechanism|risk|funding|pricing|hedging|liquidity|margin|earnings|reserve|invoic|settlement|collateral)\b/i.test(title)) score += 6;
  if (/^(the|a|an)\s+(next|main|usual|basic|simple)\b/i.test(title)) score -= 6;
  if (/^(example|scenario|case study|final check|practical example|worked example)\b/i.test(title)) score -= 8;
  return score;
}

function candidateScore(candidate) {
  const collection = coverage[candidate.suggestedCollectionId];
  if (!collection) throw new Error(`${candidate.id}: unknown collection ${candidate.suggestedCollectionId}`);
  const netNew = candidate.reviewDisposition === 'likely-net-new';
  const overlapPenalty = netNew ? 0 : 120;
  const foundationBonus = candidate.suggestedLevel === 'foundation' ? 18 : 4;
  const deficitScore = Math.round(collection.deficitRatio * 100) + collection.deficit * 2;
  const formatBonus = candidate.suggestedFormat === 'mistake' ? 4 : 0;
  const specificity = specificityScore(candidate.title);
  return deficitScore + foundationBonus + formatBonus + specificity - overlapPenalty;
}

const ranked = payload.candidates
  .map((candidate) => ({
    ...candidate,
    score: candidateScore(candidate),
    collectionCoverage: coverage[candidate.suggestedCollectionId],
  }))
  .sort((a, b) => b.score - a.score || a.sourcePageTitle.localeCompare(b.sourcePageTitle) || a.title.localeCompare(b.title));

const eligible = ranked.filter((candidate) => candidate.reviewDisposition === 'likely-net-new');
const selected = [];
const selectedIds = new Set();
const selectedTitles = new Set();
const perSource = new Map();
const provisionalCollectionCounts = { ...canonicalCounts };

while (selected.length < recommendedBatchSize) {
  let best = null;
  let bestAdjustedScore = -Infinity;
  for (const candidate of eligible) {
    if (selectedIds.has(candidate.id)) continue;
    const normalizedTitle = normalize(candidate.title);
    if (selectedTitles.has(normalizedTitle)) continue;
    const sourceCount = perSource.get(candidate.sourcePath) || 0;
    if (sourceCount >= maxPerSourceLesson) continue;

    const target = dailyCardInventoryTargets[candidate.suggestedCollectionId];
    const provisional = provisionalCollectionCounts[candidate.suggestedCollectionId] || 0;
    if (provisional >= target) continue;

    const sourceDiversityBonus = sourceCount === 0 ? 16 : 0;
    const remainingDeficit = Math.max(0, target - provisional);
    const dynamicDeficitBonus = target ? Math.round((remainingDeficit / target) * 20) : 0;
    const adjustedScore = candidate.score + sourceDiversityBonus + dynamicDeficitBonus;

    if (!best || adjustedScore > bestAdjustedScore || (adjustedScore === bestAdjustedScore && candidate.id.localeCompare(best.id) < 0)) {
      best = candidate;
      bestAdjustedScore = adjustedScore;
    }
  }
  if (!best) break;
  selected.push({ ...best, adjustedScore: bestAdjustedScore, shortlistRank: selected.length + 1 });
  selectedIds.add(best.id);
  selectedTitles.add(normalize(best.title));
  perSource.set(best.sourcePath, (perSource.get(best.sourcePath) || 0) + 1);
  provisionalCollectionCounts[best.suggestedCollectionId] = (provisionalCollectionCounts[best.suggestedCollectionId] || 0) + 1;
}

const collectionShortlistCounts = Object.fromEntries(Object.keys(dailyCardInventoryTargets).map((id) => [id, 0]));
for (const candidate of selected) collectionShortlistCounts[candidate.suggestedCollectionId] += 1;

const generatedAt = new Date().toISOString();
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'shortlist.json'), `${JSON.stringify({
  generatedAt,
  recommendedBatchSize,
  maxPerSourceLesson,
  canonicalCount: dailyCards.length,
  coverage,
  sourceCandidateCount: payload.candidateCount,
  eligibleNetNewCount: eligible.length,
  selectedCount: selected.length,
  collectionShortlistCounts,
  selected,
  topRanked: ranked.slice(0, 40),
}, null, 2)}\n`);

const markdown = [
  '# Daily Card Book shortlist',
  '',
  `Generated: ${generatedAt}`,
  '',
  `Canonical inventory: **${dailyCards.length} / 150**`,
  `Book candidates: **${payload.candidateCount}**`,
  `Eligible likely-net-new: **${eligible.length}**`,
  `Recommended first batch: **${selected.length}**`,
  '',
  '## Collection deficits before shortlist',
  '',
  ...Object.entries(coverage).map(([id, value]) => `- **${id}** — ${value.current}/${value.target}; deficit ${value.deficit}`),
  '',
  '## Recommended first batch',
  '',
  ...selected.map((candidate) => `${candidate.shortlistRank}. **${candidate.title}** — ${candidate.suggestedCollectionId} — ${candidate.sourcePageTitle} — score ${candidate.adjustedScore}`),
  '',
  'Selection is review prioritization only. Every item remains non-publishable until editorial completion and source review.',
  '',
];
fs.writeFileSync(path.join(outputDir, 'shortlist.md'), `${markdown.join('\n')}\n`);

console.log(`Book candidate shortlist: ${selected.length} selected from ${eligible.length} likely-net-new candidates.`);
for (const [id, value] of Object.entries(coverage)) console.log(`COVERAGE: ${id} ${value.current}/${value.target} deficit=${value.deficit}`);
for (const candidate of selected) console.log(`SHORTLIST ${candidate.shortlistRank}: ${candidate.title} | ${candidate.suggestedCollectionId} | ${candidate.sourcePageTitle} | score=${candidate.adjustedScore}`);
