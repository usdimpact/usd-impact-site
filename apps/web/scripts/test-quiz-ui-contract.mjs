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
  ['quiz-start-here', 'quiz-what-is-us-dollar'],
);

const quiz1 = accessMap.quizzes[0];
const quiz2 = accessMap.quizzes[1];
const quiz3 = accessMap.quizzes[2];

assert.equal(quiz1.unlocksChapter, quiz2.slug);
assert.equal(quiz2.lessonReleased, true);
assert.equal(quiz2.relatedLessonUrl, '/dollar/what-is-the-us-dollar');
assert.equal(quiz2.unlocksChapter, '/fx/fx-depreciation-vs-inflation');
assert.equal(quiz3.released, false);
assert.equal(quiz3.lessonReleased, true);
assert.equal(quiz3.relatedLessonUrl, '/fx/fx-depreciation-vs-inflation');

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