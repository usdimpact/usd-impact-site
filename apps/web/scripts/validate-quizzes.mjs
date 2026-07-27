import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const quizDir = path.join(webRoot, 'src/content/quizzes/en');
const contentRoot = path.join(webRoot, 'src/content');
const accessMapPath = path.join(webRoot, 'src/data/quiz-access-map.json');

function fail(message) { throw new Error(message); }
function normalizeRoute(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) fail(`Invalid route: ${String(value)}`);
  return value === '/' ? value : value.replace(/\/+$/, '');
}
async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

const accessMap = JSON.parse(await fs.readFile(accessMapPath, 'utf8'));
if (!Number.isInteger(accessMap.passScore) || accessMap.passScore < 1 || accessMap.passScore > 10) fail('passScore must be an integer from 1 to 10.');
if (!Array.isArray(accessMap.quizzes) || accessMap.quizzes.length !== 12) fail('Access map must contain exactly 12 quizzes.');

const quizFiles = (await fs.readdir(quizDir)).filter((name) => name.endsWith('.json')).sort();
if (quizFiles.length !== 12) fail(`Expected 12 quiz JSON files, found ${quizFiles.length}.`);
const quizzes = await Promise.all(quizFiles.map(async (name) => ({ name, data: JSON.parse(await fs.readFile(path.join(quizDir, name), 'utf8')) })));

const seenQuizIds = new Set();
const seenCanonicalIds = new Set();
const seenSlugs = new Set();
const quizByCanonicalId = new Map();
for (const { name, data: quiz } of quizzes) {
  for (const key of ['quizId','canonicalId','language','title','slug','relatedLessonUrl','difficulty','estimatedTime','audience','format','questionCount','learningObjective','conceptsTested','frameworkNote','questions','answerKey','scoreInterpretation','followUpReadingPath','complianceNote','status','version']) {
    if (!(key in quiz)) fail(`${name}: missing ${key}`);
  }
  if (quiz.language !== 'en') fail(`${name}: language must be en.`);
  if (quiz.questionCount !== 10 || quiz.questions.length !== 10) fail(`${name}: expected exactly 10 questions.`);
  if (quiz.answerKey.length !== 10) fail(`${name}: expected 10 answer-key entries.`);
  if (seenQuizIds.has(quiz.quizId)) fail(`${name}: duplicate quizId ${quiz.quizId}`);
  if (seenCanonicalIds.has(quiz.canonicalId)) fail(`${name}: duplicate canonicalId ${quiz.canonicalId}`);
  const normalizedSlug = normalizeRoute(quiz.slug);
  if (seenSlugs.has(normalizedSlug)) fail(`${name}: duplicate slug ${normalizedSlug}`);
  seenQuizIds.add(quiz.quizId); seenCanonicalIds.add(quiz.canonicalId); seenSlugs.add(normalizedSlug); quizByCanonicalId.set(quiz.canonicalId, quiz);
  const numbers = new Set();
  const keyByNumber = new Map(quiz.answerKey.map((item) => [item.question, item.correctAnswer]));
  for (const question of quiz.questions) {
    if (!Number.isInteger(question.number) || question.number < 1 || question.number > 10) fail(`${name}: invalid question number ${question.number}`);
    if (numbers.has(question.number)) fail(`${name}: duplicate question ${question.number}`);
    numbers.add(question.number);
    if (!['multiple-choice','true-false'].includes(question.type)) fail(`${name}: unsupported question type ${question.type}`);
    if (!Array.isArray(question.options) || question.options.length < 2) fail(`${name}: question ${question.number} needs at least two options.`);
    const optionKeys = new Set(question.options.map((option) => option.key));
    if (optionKeys.size !== question.options.length) fail(`${name}: question ${question.number} has duplicate option keys.`);
    if (!optionKeys.has(question.correctAnswer)) fail(`${name}: question ${question.number} correctAnswer is not an option.`);
    if (keyByNumber.get(question.number) !== question.correctAnswer) fail(`${name}: question ${question.number} does not match answerKey.`);
    if (!question.explanation || !question.sourceReference) fail(`${name}: question ${question.number} needs an explanation and sourceReference.`);
  }
}

const seenOrders = new Set();
for (const access of accessMap.quizzes) {
  const quiz = quizByCanonicalId.get(access.canonicalId);
  if (!quiz) fail(`Access map references missing quiz ${access.canonicalId}`);
  if (seenOrders.has(access.order)) fail(`Duplicate access-map order ${access.order}`);
  seenOrders.add(access.order);
  if (normalizeRoute(access.slug) !== normalizeRoute(quiz.slug)) fail(`${access.canonicalId}: access-map slug does not match quiz.`);
  if (normalizeRoute(access.relatedLessonUrl) !== normalizeRoute(quiz.relatedLessonUrl)) fail(`${access.canonicalId}: access-map lesson route does not match quiz.`);
  if (typeof access.released !== 'boolean') fail(`${access.canonicalId}: released must be boolean.`);
  if (typeof access.lessonReleased !== 'boolean') fail(`${access.canonicalId}: lessonReleased must be boolean.`);
}

const contentFiles = (await walk(contentRoot)).filter((file) => /\.mdx?$/.test(file) && !file.includes(`${path.sep}quizzes${path.sep}`));
const contentSlugs = new Set();
for (const file of contentFiles) {
  const text = await fs.readFile(file, 'utf8');
  const match = text.match(/^slug:\s*["']?([^\n"']+)["']?\s*$/m);
  if (match) contentSlugs.add(normalizeRoute(match[1].trim()));
}
const releasedQuizzes = accessMap.quizzes.filter((item) => item.released);
const releasedQuizSlugs = new Set(releasedQuizzes.map((item) => normalizeRoute(item.slug)));
const availableRoutes = new Set([...contentSlugs, ...releasedQuizSlugs]);
for (const access of releasedQuizzes) {
  const lesson = normalizeRoute(access.relatedLessonUrl);
  if (access.lessonReleased && !contentSlugs.has(lesson)) fail(`Released quiz ${access.canonicalId} points to missing lesson ${lesson}.`);
  if (access.unlocksChapter && !availableRoutes.has(normalizeRoute(access.unlocksChapter))) fail(`Released quiz ${access.canonicalId} unlocks unavailable route ${access.unlocksChapter}.`);
}

const releasedIds = releasedQuizzes.map((item) => item.canonicalId);
const expectedReleasedIds = ['quiz-start-here','quiz-what-is-us-dollar','quiz-fx-depreciation-vs-inflation','quiz-dxy-explained','quiz-dxy-vs-broad-usd','quiz-dollar-regime-framework','quiz-usd-and-gold','quiz-usd-and-wti','quiz-usd-and-lng-natural-gas','quiz-usd-and-equities'];
if (JSON.stringify(releasedIds) !== JSON.stringify(expectedReleasedIds)) fail(`Expected released quizzes ${expectedReleasedIds.join(', ')}, found ${releasedIds.join(', ')}.`);
console.log(`Validated ${quizzes.length} quizzes, ${quizzes.length * 10} questions, ${releasedQuizzes.length} released route(s).`);