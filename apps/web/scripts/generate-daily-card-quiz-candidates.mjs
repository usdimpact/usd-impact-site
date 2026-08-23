import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';

const quizDir = path.resolve('src/content/quizzes/en');
const accessMapPath = path.resolve('src/data/quiz-access-map.json');
const outputDir = path.resolve('artifacts/daily-card-quiz-candidates');
const shortTokens = new Set(['btc', 'cpi', 'dxy', 'lng', 'tga', 'tips', 'usd', 'vix', 'wti']);

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

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function suggestedCollection(text, quiz) {
  // Classify from this candidate's authored title/explanation first. Do not use
  // quiz-wide conceptsTested here: a quiz can mention real yields, liquidity,
  // and an asset in different questions, which would otherwise contaminate every
  // question with the same collection label.
  const local = normalize(text);
  if (/repo|collateral|haircut|dealer balance|fx swap engine|swap line|fima|funding stack/.test(local)) return 'dollar-funding-stack';
  if (/1971|bretton|reserve currency|reserve asset|network effect|monetary history|dollar centrality/.test(local)) return 'history-institutions';
  if (/real rate|real yield|liquidity|credit spread|volatility|vix|fed funds|funding pressure|financial conditions|stress indicator|opportunity cost/.test(local)) return 'rates-liquidity-policy';
  if (/fx depreciation|currency risk|transaction exposure|translation|hedg|pass through|exchange rate|currency pair|competitiveness/.test(local)) return 'global-dollar-fx';
  if (/bitcoin|btc|gold|xau|oil|wti|lng|natural gas|equities|equity|earnings|margin|commodity/.test(local)) return 'asset-transmission';
  if (/regime|second signal|confirmation|dominant driver|benchmark selection|interpretation|risk appetite|signal noise|cross asset/.test(local)) return 'market-application';
  if (/dxy|broad usd|dollar index|basket|euro weight|trade weighted|us dollar|global dollar/.test(local)) return 'core-framework';

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
  const collectionId = suggestedCollection(`${title} ${excerpt}`, quiz);
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
      sourceLocator: `question:${question.number}`,
      suggestedFormat: /mistake|error|false|confus/i.test(`${question.question} ${question.explanation}`) ? 'mistake' : 'concept',
      extra: { sourceQuestion: question.question, sourceCorrectAnswer: question.correctAnswer },
    }));
    sourceCandidateCount += 1;
  }

  for (let index = 0; index < (quiz.practicalApplications || []).length; index += 1) {
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
      sourceLocator: `practicalApplication:${index + 1}`,
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
      sourceLocator: 'commonMistakeCheckpoint',
      suggestedFormat: 'mistake',
    }));
    sourceCandidateCount += 1;
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
fs.writeFileSync(path.join(outputDir, 'candidates.json'), `${JSON.stringify({ generatedAt, classifierVersion: 2, sourceHierarchyRank: 5, releasedQuizCount: sources.length, candidateCount: candidates.length, likelyNetNewCount: likelyNetNew.length, overlapCount: overlaps.length, collectionCounts, netNewCollectionCounts, sources, candidates }, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'review.md'), `${[
  '# Daily Card Quiz review queue', '',
  `Generated: ${generatedAt}`, '',
  'Classifier: **v2 candidate-local + quiz fallback**',
  `Released quizzes: **${sources.length}**`,
  `Authored candidates: **${candidates.length}**`,
  `Likely net-new: **${likelyNetNew.length}**`,
  `Potential overlaps: **${overlaps.length}**`, '',
  '## Suggested collection counts', '',
  ...Object.entries(collectionCounts).sort().map(([id, count]) => `- **${id}** — ${count} total / ${netNewCollectionCounts[id] || 0} likely net-new`), '',
  '## Quiz sources', '',
  ...sources.map((source) => `- **${source.title}** — ${source.candidateCount} candidates — fallback ${source.fallbackCollectionId} — ${source.status} ${source.version}`), '',
  'All candidates remain review-only. Classification is based on each authored candidate first; quiz topic is used only as fallback.', '',
].join('\n')}\n`);
console.log(`Quiz Daily Card queue: ${sources.length} released quizzes -> ${candidates.length} authored candidates.`);
console.log(`Classifier v2; likely net-new: ${likelyNetNew.length}; overlaps: ${overlaps.length}.`);
for (const [id, count] of Object.entries(collectionCounts).sort()) console.log(`QUIZ-COLLECTION: ${id} -> ${count} total / ${netNewCollectionCounts[id] || 0} net-new`);
for (const source of sources) console.log(`QUIZ-SOURCE: ${source.title} -> ${source.candidateCount} (fallback ${source.fallbackCollectionId})`);
