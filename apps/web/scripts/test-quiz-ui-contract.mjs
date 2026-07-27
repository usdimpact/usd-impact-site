import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');

const accessMap = JSON.parse(
  await fs.readFile(path.join(webRoot, 'src/data/quiz-access-map.json'), 'utf8'),
);
const engineSource = await fs.readFile(
  path.join(webRoot, 'src/components/QuizEngine.astro'),
  'utf8',
);
const routeSource = await fs.readFile(
  path.join(webRoot, 'src/pages/[...lesson]/quiz.astro'),
  'utf8',
);

const released = accessMap.quizzes.filter((item) => item.released);
assert.deepEqual(
  released.map((item) => item.canonicalId),
  [
    'quiz-start-here',
    'quiz-what-is-us-dollar',
    'quiz-fx-depreciation-vs-inflation',
    'quiz-dxy-explained',
    'quiz-dxy-vs-broad-usd',
    'quiz-dollar-regime-framework',
    'quiz-usd-and-gold',
  ],
);

const quiz1 = accessMap.quizzes[0];
const quiz2 = accessMap.quizzes[1];
const quiz3 = accessMap.quizzes[2];
const quiz4 = accessMap.quizzes[3];
const quiz5 = accessMap.quizzes[4];
const quiz6 = accessMap.quizzes[5];
const quiz7 = accessMap.quizzes[6];
const quiz8 = accessMap.quizzes[7];

assert.equal(quiz1.unlocksChapter, quiz2.slug);
assert.equal(quiz2.lessonReleased, true);
assert.equal(quiz3.released, true);
assert.equal(quiz3.unlocksChapter, '/dxy/what-is-dxy');
assert.equal(quiz4.released, true);
assert.equal(quiz4.unlocksChapter, '/dxy/dxy-vs-broad-usd');
assert.equal(quiz5.released, true);
assert.equal(quiz5.unlocksChapter, '/regime/how-to-read-the-dollar');
assert.equal(quiz6.released, true);
assert.equal(quiz6.unlocksChapter, '/gold/usd-gold');
assert.equal(quiz7.released, true);
assert.equal(quiz7.lessonReleased, true);
assert.equal(quiz7.relatedLessonUrl, '/gold/usd-gold');
assert.equal(quiz7.unlocksChapter, '/energy/usd-wti');
assert.equal(quiz8.released, false);
assert.equal(quiz8.lessonReleased, true);
assert.equal(quiz8.relatedLessonUrl, '/energy/usd-wti');

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