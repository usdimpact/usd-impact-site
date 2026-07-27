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
const quiz7Id = 'quiz-usd-and-gold';

const releasedQuizzes = [
  [quiz1Id, '/dollar/what-is-the-us-dollar/quiz'],
  [quiz2Id, '/fx/fx-depreciation-vs-inflation'],
  [quiz3Id, '/dxy/what-is-dxy'],
  [quiz4Id, '/dxy/dxy-vs-broad-usd'],
  [quiz5Id, '/regime/how-to-read-the-dollar'],
  [quiz6Id, '/gold/usd-gold'],
];

for (const [canonicalId, expectedUnlock] of releasedQuizzes) {
  const pass = await request({ canonicalId, answers: answersFor(canonicalId, true) });
  assert.equal(pass.status, 200);
  assert.equal(pass.json.score, 10);
  assert.equal(pass.json.passed, true);
  assert.equal(pass.json.unlocksChapter, expectedUnlock);
  assert.equal(pass.json.nextChapterStatus, 'available');
  assert.equal(pass.json.details.length, 10);
}

const quiz6 = QUIZ_RUNTIME[quiz6Id];
const quiz6Fail = await request({ canonicalId: quiz6Id, answers: answersFor(quiz6Id, false) });
assert.equal(quiz6Fail.status, 200);
assert.equal(quiz6Fail.json.score, 0);
assert.equal(quiz6Fail.json.passed, false);
assert.equal(quiz6Fail.json.unlocksChapter, null);
assert.equal(quiz6Fail.json.nextChapterStatus, 'locked');

const invalidOption = { ...answersFor(quiz6Id, true), '1': 'NOT_AN_OPTION' };
const invalid = await request({ canonicalId: quiz6Id, answers: invalidOption });
assert.equal(invalid.status, 400);
assert.match(invalid.json.error, /Question 1/);

const incomplete = await request({
  canonicalId: quiz6Id,
  answers: { '1': quiz6.questions[0].correctAnswer },
});
assert.equal(incomplete.status, 400);
assert.match(incomplete.json.error, /Question 2/);

const unreleased = await request({ canonicalId: quiz7Id, answers: answersFor(quiz1Id, true) });
assert.equal(unreleased.status, 404);

const method = await request({}, 'GET');
assert.equal(method.status, 405);

for (const [canonicalId] of releasedQuizzes) {
  assert.equal(QUIZ_RUNTIME[canonicalId].released, true);
}
assert.equal(QUIZ_RUNTIME[quiz7Id].released, false);

console.log('Quiz submit function tests passed.');