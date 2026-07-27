import assert from 'node:assert/strict';
import handler from '../api/quiz-submit.js';
import { QUIZ_RUNTIME } from '../api/_quiz-runtime.generated.js';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value = '') {
      this.body = value;
    },
  };
}

async function request(body, method = 'POST') {
  const response = createResponse();
  await handler({ method, body }, response);
  return {
    status: response.statusCode,
    headers: response.headers,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

function answersFor(canonicalId, correct) {
  const quiz = QUIZ_RUNTIME[canonicalId];
  return Object.fromEntries(
    quiz.questions.map((question) => [
      String(question.number),
      correct
        ? question.correctAnswer
        : question.allowedAnswerKeys.find((key) => key !== question.correctAnswer),
    ]),
  );
}

const quiz1Id = 'quiz-start-here';
const quiz2Id = 'quiz-what-is-us-dollar';
const quiz3Id = 'quiz-fx-depreciation-vs-inflation';
const quiz4Id = 'quiz-dxy-explained';
const quiz5Id = 'quiz-dxy-vs-broad-usd';
const quiz6Id = 'quiz-dollar-regime-framework';

const quiz1 = QUIZ_RUNTIME[quiz1Id];
const quiz2 = QUIZ_RUNTIME[quiz2Id];
const quiz3 = QUIZ_RUNTIME[quiz3Id];
const quiz4 = QUIZ_RUNTIME[quiz4Id];
const quiz5 = QUIZ_RUNTIME[quiz5Id];

for (const [canonicalId, expectedUnlock] of [
  [quiz1Id, '/dollar/what-is-the-us-dollar/quiz'],
  [quiz2Id, '/fx/fx-depreciation-vs-inflation'],
  [quiz3Id, '/dxy/what-is-dxy'],
  [quiz4Id, '/dxy/dxy-vs-broad-usd'],
  [quiz5Id, '/regime/how-to-read-the-dollar'],
]) {
  const pass = await request({ canonicalId, answers: answersFor(canonicalId, true) });
  assert.equal(pass.status, 200);
  assert.equal(pass.json.score, 10);
  assert.equal(pass.json.passed, true);
  assert.equal(pass.json.unlocksChapter, expectedUnlock);
  assert.equal(pass.json.nextChapterStatus, 'available');
  assert.equal(pass.json.details.length, 10);
}

const quiz5Fail = await request({ canonicalId: quiz5Id, answers: answersFor(quiz5Id, false) });
assert.equal(quiz5Fail.status, 200);
assert.equal(quiz5Fail.json.score, 0);
assert.equal(quiz5Fail.json.passed, false);
assert.equal(quiz5Fail.json.unlocksChapter, null);
assert.equal(quiz5Fail.json.nextChapterStatus, 'locked');

const invalidOption = { ...answersFor(quiz5Id, true), '1': 'NOT_AN_OPTION' };
const invalid = await request({ canonicalId: quiz5Id, answers: invalidOption });
assert.equal(invalid.status, 400);
assert.match(invalid.json.error, /Question 1/);

const incomplete = await request({
  canonicalId: quiz5Id,
  answers: { '1': quiz5.questions[0].correctAnswer },
});
assert.equal(incomplete.status, 400);
assert.match(incomplete.json.error, /Question 2/);

const unreleased = await request({ canonicalId: quiz6Id, answers: answersFor(quiz1Id, true) });
assert.equal(unreleased.status, 404);

const method = await request({}, 'GET');
assert.equal(method.status, 405);

assert.equal(quiz1.released, true);
assert.equal(quiz2.released, true);
assert.equal(quiz3.released, true);
assert.equal(quiz4.released, true);
assert.equal(quiz5.released, true);
assert.equal(QUIZ_RUNTIME[quiz6Id].released, false);

console.log('Quiz submit function tests passed.');