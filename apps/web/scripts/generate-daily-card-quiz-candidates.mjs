import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';

const quizDir = path.resolve('src/content/quizzes/en');
const accessMapPath = path.resolve('src/data/quiz-access-map.json');
const outputDir = path.resolve('artifacts/daily-card-quiz-candidates');
const shortTokens = new Set(['btc', 'cpi', 'dxy', 'lng', 'tga', 'tips', 'usd', 'vix', 'wti']);
const promotedSourceKeys = new Set(
  dailyCards
    .filter((card) => card.status === 'ready-for-build'
      && typeof card.sourcePath === 'string'
      && card.sourcePath.startsWith('src/content/quizzes/en/')
      && typeof card.sourceLocator === 'string')
    .map((card) => `${card.sourcePath}::${card.sourceLocator}`),
);

const QUIZ_FALLBACK_COLLECTION = Object.freeze({
  'quiz-dollar-regime-framework': 'market-application',
  'quiz-dxy-explained': 'core-framework',
  'quiz-dxy-vs-broad-usd': 'core-framework',
  'quiz-fx-depreciation-vs-inflation': 'global-dollar-fx',
  'quiz-start-here': 'core-framework',
  'quiz-usd-and-bitcoin': 'asset-transmission',
  'quiz-usd-and-equities': 'asset-transmission',
  'quiz-usd-and-fx-currency-risk': 'global-dollar-fx',
  'quiz-usd-and-gold': 'asset-transmission',
  'quiz-usd-and-lng-natural-gas': 'asset-transmission',
  'quiz-usd-and-wti': 'asset-transmission',
  'quiz-what-is-us-dollar': 'core-framework',
});

const COLLECTION_RULES = Object.freeze([
  ['dollar-funding-stack', /\b(?:repo|collateral|haircuts?|dealer balance(?: sheet)?|fx swap(?: engine)?|swap lines?|fima|funding stack)\b/],
  ['history-institutions', /\b(?:1971|bretton|reserve currency|reserve asset|network effects?|monetary history|dollar centrality)\b/],
  ['rates-liquidity-policy', /\b(?:real rates?|real yields?|liquidity|credit spreads?|volatility|vix|fed funds|funding pressure|financial conditions|stress indicators?|risk conditions|opportunity cost|discount rates?)\b/],
  ['global-dollar-fx', /\b(?:eurusd|fx depreciation|currency risk|transaction exposure|translation|hedg(?:e|ed|es|ing)?|pass through|exchange rates?|currency pairs?|competitiveness)\b/],
  ['asset-transmission', /\b(?:bitcoin|btc|gold|xau|oil|wti|lng|natural gas|gas balance|equities|equity|earnings|margins?|commodit(?:y|ies))\b/],
  ['market-application', /\b(?:regime|second signal|confirmation|dominant driver|benchmark selection|interpretation|risk appetite|signal noise|cross asset|discipline|one signal|one index|slogans?|mistake|weekly monitoring|monitoring signals?)\b/],
  ['core-framework', /\b(?:dxy|broad usd|dollar index|basket|euro weight|trade weighted|us dollar|global dollar|usd beyond forex)\b/],
]);

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function classifyTitle(value) {
  const normalized = normalize(value);
  for (const [collectionId, pattern] of COLLECTION_RULES) {
    if (pattern.test(normalized)) return collectionId;
  }
  return null;
}

function suggestedCollection(title, quiz) {
  const titleCollection = classifyTitle(title);
  if (titleCollection) return titleCollection;
  const fallback = QUIZ_FALLBACK_COLLECTION[quiz.canonicalId];
  if (!fallback) throw new Error(`${quiz.canonicalId}: missing quiz fallback collection`);
  return fallback;
}

function overlapCardIds(title, excerpt) {
  const titleNorm = normalize(title);
  const excerptNorm = normalize(excerpt);
  const tokens = [...new Set(titleNorm.split(' ').filter((token) => token.length >= 4 || shortTokens.has(token)))];
  return dailyCards.filter((card) => {
    const identity = normalize(`${card.slug} ${card.title} ${card.shortTitle || ''}`);
    const haystack = normalize(`${identity} ${(card.concepts || []).join(' ')}`);
    if (normalize(card.title) === titleNorm || normalize(card.shortTitle) === titleNorm) return true;
    const shared = tokens.filter((token) => haystack.includes(token));
    const excerptSignal = tokens.some((token) => excerptNorm.includes(token) && haystack.includes(token));
    return shared.length >= 2 || (tokens.length === 1 && shared.length === 1 && excerptSignal);
  }).map((card) => card.id).slice(0, 8);
}

function makeCandidate({ id, title, excerpt, sourceKind, sourceReference, quiz, sourcePath, sourceLocator, suggestedFormat = 'concept', extra = {} }) {
  const collectionId = suggestedCollection(title, quiz);
  const potentialOverlapCardIds = overlapCardIds(title, excerpt);
  return {
    id,
    title,
    suggestedCollectionId: collectionId,
    suggestedFormat,
    suggestedLevel: /beginner/i.test(quiz.difficulty) ? 'foundation' : 'intermediate',
    suggestedAccess: 'open',
    sourceHierarchyRank: 5,
    sourceType: 'released-quiz-authored-explanation',
    sourcePath,
    sourceQuizId: quiz.quizId,
    sourceCanonicalId: quiz.canonicalId,
    sourceQuizTitle: quiz.title,
    sourceQuizSlug: quiz.slug,
    sourceRelatedLessonUrl: quiz.relatedLessonUrl,
    sourceQuizStatus: quiz.status,
    sourceQuizVersion: quiz.version,
    sourceKind,
    sourceLocator,
    sourceReference,
    sourceExcerpt: excerpt,
    potentialOverlapCardIds,
    reviewDisposition: potentialOverlapCardIds.length ? 'resolve-overlap' : 'likely-net-new',
    status: 'review',
    lastReviewed: null,
    productionNote: 'Derived only from reviewed quiz-authored explanations/application fields. Editorial review must resolve overlap, confirm taxonomy, preserve source traceability, and explicitly approve before promotion.',
    ...extra,
  };
}

function isPromoted(sourcePath, sourceLocator) {
  return promotedSourceKeys.has(`${sourcePath}::${sourceLocator}`);
}

const accessMap = JSON.parse(fs.readFileSync(accessMapPath, 'utf8'));
const releasedIds = new Set((accessMap.quizzes || []).filter((item) => item.released).map((item) => item.canonicalId));
const files = fs.readdirSync(quizDir).filter((name) => name.endsWith('.json')).sort();
const sources = [];
const candidates = [];
const ids = new Set();

for (const fileName of files) {
  const sourcePath = `src/content/quizzes/en/${fileName}`;
  const quiz = JSON.parse(fs.readFileSync(path.join(quizDir, fileName), 'utf8'));
  if (!releasedIds.has(quiz.canonicalId)) continue;
  if (quiz.language !== 'en' || quiz.questionCount !== 10 || !Array.isArray(quiz.questions) || quiz.questions.length !== 10) throw new Error(`${fileName}: released quiz contract is incomplete`);
  if (!quiz.status || !quiz.version || !quiz.title || !quiz.slug || !quiz.relatedLessonUrl) throw new Error(`${fileName}: released quiz provenance metadata incomplete`);
  if (!QUIZ_FALLBACK_COLLECTION[quiz.canonicalId]) throw new Error(`${fileName}: missing deterministic quiz fallback collection`);
  const answerByQuestion = new Map((quiz.answerKey || []).map((item) => [item.question, item]));
  let sourceCandidateCount = 0;

  for (const question of quiz.questions) {
    const sourceLocator = `question:${question.number}`;
    if (isPromoted(sourcePath, sourceLocator)) continue;
    const answer = answerByQuestion.get(question.number);
    const title = answer?.conceptTested || question.skillTested || `Question ${question.number}`;
    const excerpt = String(question.explanation || '').trim();
    if (!excerpt || !question.sourceReference) throw new Error(`${fileName}: question ${question.number} missing authored explanation/reference`);
    const id = `candidate-quiz-${quiz.canonicalId}-q${question.number}`;
    if (ids.has(id)) throw new Error(`Duplicate quiz candidate ID ${id}`);
    ids.add(id);
    candidates.push(makeCandidate({
      id,
      title,
      excerpt,
      sourceKind: 'question-explanation',
      sourceReference: question.sourceReference,
      quiz,
      sourcePath,
      sourceLocator,
      suggestedFormat: /mistake|error|false|confus/i.test(`${question.question} ${question.explanation}`) ? 'mistake' : 'concept',
      extra: { sourceQuestion: question.question, sourceCorrectAnswer: question.correctAnswer },
    }));
    sourceCandidateCount += 1;
  }

  for (let index = 0; index < (quiz.practicalApplications || []).length; index += 1) {
    const sourceLocator = `practicalApplication:${index + 1}`;
    if (isPromoted(sourcePath, sourceLocator)) continue;
    const application = quiz.practicalApplications[index];
    if (!application.title || !application.bestInterpretation || !application.scenario) throw new Error(`${fileName}: practical application ${index + 1} incomplete`);
    const id = `candidate-quiz-${quiz.canonicalId}-application-${index + 1}`;
    if (ids.has(id)) throw new Error(`Duplicate quiz candidate ID ${id}`);
    ids.add(id);
    candidates.push(makeCandidate({
      id,
      title: application.title,
      excerpt: application.bestInterpretation,
      sourceKind: 'practical-application',
      sourceReference: 'Quiz practical application',
      quiz,
      sourcePath,
      sourceLocator,
      suggestedFormat: 'scenario',
      extra: {
        sourceScenario: application.scenario,
        sourceMistakeToAvoid: application.mistakeToAvoid,
        sourceBenchmarkThatMatters: application.benchmarkThatMatters,
        sourceLikelyDominantDriver: application.likelyDominantDriver,
        sourceSecondSignalToValidate: application.secondSignalToValidate,
      },
    }));
    sourceCandidateCount += 1;
  }

  if (quiz.commonMistakeCheckpoint) {
    const sourceLocator = 'commonMistakeCheckpoint';
    if (!isPromoted(sourcePath, sourceLocator)) {
      const id = `candidate-quiz-${quiz.canonicalId}-common-mistake`;
      if (ids.has(id)) throw new Error(`Duplicate quiz candidate ID ${id}`);
      ids.add(id);
      candidates.push(makeCandidate({
        id,
        title: `${quiz.title}: Common Mistake Checkpoint`,
        excerpt: quiz.commonMistakeCheckpoint,
        sourceKind: 'common-mistake-checkpoint',
        sourceReference: 'Quiz commonMistakeCheckpoint',
        quiz,
        sourcePath,
        sourceLocator,
        suggestedFormat: 'mistake',
      }));
      sourceCandidateCount += 1;
    }
  }

  sources.push({ sourcePath, canonicalId: quiz.canonicalId, title: quiz.title, slug: quiz.slug, status: quiz.status, version: quiz.version, fallbackCollectionId: QUIZ_FALLBACK_COLLECTION[quiz.canonicalId], candidateCount: sourceCandidateCount });
}

const likelyNetNew = candidates.filter((candidate) => candidate.reviewDisposition === 'likely-net-new');
const overlaps = candidates.filter((candidate) => candidate.reviewDisposition === 'resolve-overlap');
const collectionCounts = {};
const netNewCollectionCounts = {};
for (const candidate of candidates) {
  collectionCounts[candidate.suggestedCollectionId] = (collectionCounts[candidate.suggestedCollectionId] || 0) + 1;
  if (candidate.reviewDisposition === 'likely-net-new') netNewCollectionCounts[candidate.suggestedCollectionId] = (netNewCollectionCounts[candidate.suggestedCollectionId] || 0) + 1;
}
const generatedAt = new Date().toISOString();
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'candidates.json'), `${JSON.stringify({ generatedAt, classifierVersion: 4, sourceHierarchyRank: 5, releasedQuizCount: sources.length, promotedSourceCount: promotedSourceKeys.size, candidateCount: candidates.length, likelyNetNewCount: likelyNetNew.length, overlapCount: overlaps.length, collectionCounts, netNewCollectionCounts, sources, candidates }, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'review.md'), `${[
  '# Daily Card Quiz review queue', '',
  `Generated: ${generatedAt}`, '',
  'Classifier: **v4 curated-title + quiz-topic fallback**',
  `Released quizzes: **${sources.length}**`,
  `Promoted Quiz source identities excluded: **${promotedSourceKeys.size}**`,
  `Authored candidates remaining: **${candidates.length}**`,
  `Likely net-new: **${likelyNetNew.length}**`,
  `Potential overlaps: **${overlaps.length}**`, '',
  '## Suggested collection counts', '',
  ...Object.entries(collectionCounts).sort().map(([id, count]) => `- **${id}** — ${count} total / ${netNewCollectionCounts[id] || 0} likely net-new`), '',
  '## Quiz sources', '',
  ...sources.map((source) => `- **${source.title}** — ${source.candidateCount} candidates — fallback ${source.fallbackCollectionId} — ${source.status} ${source.version}`), '',
  'All candidates remain review-only. Promoted exact source identities are excluded before ranking. Classification uses each curated concept title first; if the title is not specific, the known quiz topic is used.', '',
].join('\n')}\n`);
console.log(`Quiz Daily Card queue: ${sources.length} released quizzes -> ${candidates.length} authored candidates after ${promotedSourceKeys.size} promoted source exclusions.`);
console.log(`Classifier v4; likely net-new: ${likelyNetNew.length}; overlaps: ${overlaps.length}.`);
for (const [id, count] of Object.entries(collectionCounts).sort()) console.log(`QUIZ-COLLECTION: ${id} -> ${count} total / ${netNewCollectionCounts[id] || 0} net-new`);
for (const source of sources) console.log(`QUIZ-SOURCE: ${source.title} -> ${source.candidateCount} (fallback ${source.fallbackCollectionId})`);
