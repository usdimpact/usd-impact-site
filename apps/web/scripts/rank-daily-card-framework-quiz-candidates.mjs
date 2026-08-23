import fs from 'node:fs';
import path from 'node:path';

const frameworkPath = path.resolve('artifacts/daily-card-framework-candidates/candidates.json');
const quizPath = path.resolve('artifacts/daily-card-quiz-candidates/candidates.json');
const outputDir = path.resolve('artifacts/daily-card-framework-quiz-shortlist');

const quotas = Object.freeze({
  'rates-liquidity-policy': 7,
  'market-application': 5,
});
const maxPerSource = 2;

for (const required of [frameworkPath, quizPath]) {
  if (!fs.existsSync(required)) throw new Error(`Missing candidate artifact: ${required}`);
}

const framework = JSON.parse(fs.readFileSync(frameworkPath, 'utf8'));
const quiz = JSON.parse(fs.readFileSync(quizPath, 'utf8'));

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function genericTitle(title) {
  return /^(?:question\s+\d+|.*common mistake checkpoint|(?:a|an|the)?\s*(?:worked|practical)?\s*(?:example|scenario|case study|final check))\b/i.test(String(title || '').trim());
}

const combined = [
  ...framework.candidates.map((candidate) => ({ ...candidate, origin: 'framework' })),
  ...quiz.candidates.map((candidate) => ({ ...candidate, origin: 'quiz' })),
];

const titleFrequency = new Map();
for (const candidate of combined) {
  const key = normalize(candidate.title);
  titleFrequency.set(key, (titleFrequency.get(key) || 0) + 1);
}

function specificityScore(candidate) {
  const title = String(candidate.title || '');
  const words = title.trim().split(/\s+/).filter(Boolean);
  let score = 0;
  if (words.length >= 2 && words.length <= 10) score += 10;
  if (/\b(real yield|liquidity|credit|volatility|confirmation|driver|benchmark|stress|rate|risk|monitoring|discipline|regime|signal|mistake)\b/i.test(title)) score += 10;
  if (/[?:]/.test(title)) score += 2;
  if (candidate.origin === 'framework') score += 22;
  if (candidate.sourceKind === 'question-explanation') score += 10;
  if (candidate.sourceKind === 'practical-application') score += 5;
  if (candidate.suggestedFormat === 'mistake') score += 4;
  if (candidate.suggestedLevel === 'foundation') score += 8;
  const repeats = Math.max(0, (titleFrequency.get(normalize(title)) || 1) - 1);
  score -= repeats * 12;
  if (genericTitle(title)) score -= 100;
  return score;
}

const eligible = combined
  .filter((candidate) => candidate.reviewDisposition === 'likely-net-new')
  .filter((candidate) => Object.hasOwn(quotas, candidate.suggestedCollectionId))
  .filter((candidate) => !genericTitle(candidate.title))
  .map((candidate) => ({ ...candidate, score: specificityScore(candidate) }))
  .sort((a, b) => b.score - a.score || a.sourcePath.localeCompare(b.sourcePath) || a.title.localeCompare(b.title));

const selected = [];
const selectedIds = new Set();
const selectedTitles = new Set();
const perSource = new Map();
const perCollection = Object.fromEntries(Object.keys(quotas).map((id) => [id, 0]));

for (const collectionId of Object.keys(quotas)) {
  while (perCollection[collectionId] < quotas[collectionId]) {
    let best = null;
    let bestScore = -Infinity;
    for (const candidate of eligible) {
      if (candidate.suggestedCollectionId !== collectionId || selectedIds.has(candidate.id)) continue;
      const titleKey = normalize(candidate.title);
      if (selectedTitles.has(titleKey)) continue;
      const sourceCount = perSource.get(candidate.sourcePath) || 0;
      if (sourceCount >= maxPerSource) continue;
      const diversityBonus = sourceCount === 0 ? 8 : 0;
      const adjustedScore = candidate.score + diversityBonus;
      if (!best || adjustedScore > bestScore || (adjustedScore === bestScore && candidate.id.localeCompare(best.id) < 0)) {
        best = candidate;
        bestScore = adjustedScore;
      }
    }
    if (!best) throw new Error(`Insufficient eligible candidates for ${collectionId}: selected ${perCollection[collectionId]} of ${quotas[collectionId]}`);
    selected.push({ ...best, adjustedScore: bestScore, shortlistRank: selected.length + 1 });
    selectedIds.add(best.id);
    selectedTitles.add(normalize(best.title));
    perSource.set(best.sourcePath, (perSource.get(best.sourcePath) || 0) + 1);
    perCollection[collectionId] += 1;
  }
}

const generatedAt = new Date().toISOString();
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'shortlist.json'), `${JSON.stringify({
  generatedAt,
  classifierVersion: quiz.classifierVersion,
  quotas,
  maxPerSource,
  deferredCollections: {
    'dollar-funding-stack': 'No genuine Tier-4/Tier-5 source candidates remain after classifier v4; defer to reviewed funding-plumbing source material.',
  },
  frameworkCandidateCount: framework.candidateCount,
  quizCandidateCount: quiz.candidateCount,
  eligibleCount: eligible.length,
  selectedCount: selected.length,
  selected,
}, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'shortlist.md'), `${[
  '# Daily Card Framework + Quiz deficit shortlist', '',
  `Generated: ${generatedAt}`, '',
  `Quiz classifier: **v${quiz.classifierVersion}**`,
  `Framework candidates: **${framework.candidateCount}**`,
  `Quiz candidates: **${quiz.candidateCount}**`,
  `Eligible targeted net-new candidates: **${eligible.length}**`,
  `Recommended batch: **${selected.length}**`, '',
  '## Fixed high-value allocation', '',
  ...Object.entries(quotas).map(([id, count]) => `- **${id}** — ${count}`), '',
  '## Deferred deficit', '',
  '- **dollar-funding-stack** — no genuine Framework/Quiz source candidates after classifier v4; use reviewed funding-plumbing sources instead of forcing weak taxonomy.', '',
  '## Recommended review order', '',
  ...selected.map((candidate) => `${candidate.shortlistRank}. **${candidate.title}** — ${candidate.suggestedCollectionId} — ${candidate.origin} — ${candidate.sourcePath} — score ${candidate.adjustedScore}`), '',
  'This shortlist is review prioritization only. Every selected item remains status=review and requires editorial inspection before promotion.', '',
].join('\n')}\n`);

console.log(`Framework/Quiz shortlist: ${selected.length} selected from ${eligible.length} targeted likely-net-new candidates.`);
for (const [id, count] of Object.entries(quotas)) console.log(`SHORTLIST-QUOTA: ${id} -> ${count}`);
console.log('SHORTLIST-DEFER: dollar-funding-stack -> no genuine Tier-4/Tier-5 candidates');
for (const candidate of selected) console.log(`SHORTLIST ${candidate.shortlistRank}: ${candidate.title} | ${candidate.suggestedCollectionId} | ${candidate.origin} | ${candidate.sourcePath} | ${candidate.sourceLocator || candidate.sourceHeading || ''} | score=${candidate.adjustedScore}`);
