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

const quiz1 = QUIZ_RUNTIME[quiz1Id];
const quiz2 = QUIZ_RUNTIME[quiz2Id];

const quiz1Pass = await request({ canonicalId: quiz1Id, answers: answersFor(quiz1Id, true) });
assert.equal(quiz1Pass.status, 200);
assert.equal(quiz1Pass.json.score, 10);
assert.equal(quiz1Pass.json.passed, true);
assert.equal(quiz1Pass.json.unlocksChapter, '/dollar/what-is-the-us-dollar/quiz');
assert.equal(quiz1Pass.json.nextChapterStatus, 'available');
assert.equal(quiz1Pass.json.details.length, 10);

const quiz2Pass = await request({ canonicalId: quiz2Id, answers: answersFor(quiz2Id, true) });
assert.equal(quiz2Pass.status, 200);
assert.equal(quiz2Pass.json.score, 10);
assert.equal(quiz2Pass.json.passed, true);
assert.equal(quiz2Pass.json.unlocksChapter, null);
assert.equal(quiz2Pass.json.nextChapterStatus, 'coming-soon');
assert.equal(quiz2Pass.json.details.length, 10);

const quiz2Fail = await request({ canonicalId: quiz2Id, answers: answersFor(quiz2Id, false) });
assert.equal(quiz2Fail.status, 200);
assert.equal(quiz2Fail.json.score, 0);
assert.equal(quiz2Fail.json.passed, false);
assert.equal(quiz2Fail.json.unlocksChapter, null);
assert.equal(quiz2Fail.json.nextChapterStatus, 'locked');

const invalidOption = { ...answersFor(quiz2Id, true), '1': 'NOT_AN_OPTION' };
const invalid = await request({ canonicalId: quiz2Id, answers: invalidOption });
assert.equal(invalid.status, 400);
assert.match(invalid.json.error, /Question 1/);

const incomplete = await request({
  canonicalId: quiz2Id,
  answers: { '1': quiz2.questions[0].correctAnswer },
});
assert.equal(incomplete.status, 400);
assert.match(incomplete.json.error, /Question 2/);

const unreleased = await request({ canonicalId: quiz3Id, answers: answersFor(quiz1Id, true) });
assert.equal(unreleased.status, 404);

const method = await request({}, 'GET');
assert.equal(method.status, 405);

assert.equal(quiz1.released, true);
assert.equal(quiz2.released, true);
assert.equal(QUIZ_RUNTIME[quiz3Id].released, false);

console.log('Quiz submit function tests passed.');
