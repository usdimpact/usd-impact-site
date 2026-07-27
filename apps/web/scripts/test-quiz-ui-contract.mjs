import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const accessMap = JSON.parse(await fs.readFile(path.join(webRoot, 'src/data/quiz-access-map.json'), 'utf8'));
const engineSource = await fs.readFile(path.join(webRoot, 'src/components/QuizEngine.astro'), 'utf8');
const routeSource = await fs.readFile(path.join(webRoot, 'src/pages/[...lesson]/quiz.astro'), 'utf8');

assert.deepEqual(accessMap.quizzes.filter((item) => item.released).map((item) => item.canonicalId), [
  'quiz-start-here','quiz-what-is-us-dollar','quiz-fx-depreciation-vs-inflation','quiz-dxy-explained','quiz-dxy-vs-broad-usd','quiz-dollar-regime-framework','quiz-usd-and-gold','quiz-usd-and-wti','quiz-usd-and-lng-natural-gas',
]);
const quiz9 = accessMap.quizzes[8];
const quiz10 = accessMap.quizzes[9];
assert.equal(quiz9.released, true);
assert.equal(quiz9.lessonReleased, true);
assert.equal(quiz9.relatedLessonUrl, '/energy/lng-natural-gas');
assert.equal(quiz9.unlocksChapter, '/equities/usd-equities');
assert.equal(quiz10.released, false);
assert.equal(quiz10.lessonReleased, true);
assert.equal(quiz10.relatedLessonUrl, '/equities/usd-equities');

assert.match(engineSource, /Math\.min\(currentIndex, questionElements\.length - 1\)/);
assert.match(engineSource, /currentIndex >= questionElements\.length - 1/);
assert.match(engineSource, /nextButton\.hidden = isLast/);
assert.match(engineSource, /submitButton\.hidden = !isLast/);
assert.match(engineSource, /currentIndex = 0/);
assert.match(engineSource, /localStorage\.getItem\(storageKey\)/);
assert.match(engineSource, /localStorage\.setItem\(storageKey/);
assert.match(routeSource, /access\.lessonReleased/);
assert.match(routeSource, /Return to the lesson/);
assert.match(routeSource, /View all quizzes/);
console.log('Quiz UI regression contract passed.');
