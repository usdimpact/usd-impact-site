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

const quiz1 = QUIZ_RUNTIME[quiz1Id];
const quiz2 = QUIZ_RUNTIME[quiz2Id];
const quiz3 = QUIZ_RUNTIME[quiz3Id];
const quiz4 = QUIZ_RUNTIME[quiz4Id];

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
assert.equal(quiz2Pass.json.unlocksChapter, '/fx/fx-depreciation-vs-inflation');
assert.equal(quiz2Pass.json.nextChapterStatus, 'available');
assert.equal(quiz2Pass.json.details.length, 10);

const quiz3Pass = await request({ canonicalId: quiz3Id, answers: answersFor(quiz3Id, true) });
assert.equal(quiz3Pass.status, 200);
assert.equal(quiz3Pass.json.score, 10);
assert.equal(quiz3Pass.json.passed, true);
assert.equal(quiz3Pass.json.unlocksChapter, '/dxy/what-is-dxy');
assert.equal(quiz3Pass.json.nextChapterStatus, 'available');
assert.equal(quiz3Pass.json.details.length, 10);

const quiz4Pass = await request({ canonicalId: quiz4Id, answers: answersFor(quiz4Id, true) });
assert.equal(quiz4Pass.status, 200);
assert.equal(quiz4Pass.json.score, 10);
assert.equal(quiz4Pass.json.passed, true);
assert.equal(quiz4Pass.json.unlocksChapter, '/dxy/dxy-vs-broad-usd');
assert.equal(quiz4Pass.json.nextChapterStatus, 'available');
assert.equal(quiz4Pass.json.details.length, 10);

const quiz4Fail = await request({ canonicalId: quiz4Id, answers: answersFor(quiz4Id, false) });
assert.equal(quiz4Fail.status, 200);
assert.equal(quiz4Fail.json.score, 0);
assert.equal(quiz4Fail.json.passed, false);
assert.equal(quiz4Fail.json.unlocksChapter, null);
assert.equal(quiz4Fail.json.nextChapterStatus, 'locked');

const invalidOption = { ...answersFor(quiz4Id, true), '1': 'NOT_AN_OPTION' };
const invalid = await request({ canonicalId: quiz4Id, answers: invalidOption });
assert.equal(invalid.status, 400);
assert.match(invalid.json.error, /Question 1/);

const incomplete = await request({
  canonicalId: quiz4Id,
  answers: { '1': quiz4.questions[0].correctAnswer },
});
assert.equal(incomplete.status, 400);
assert.match(incomplete.json.error, /Question 2/);

const unreleased = await request({ canonicalId: quiz5Id, answers: answersFor(quiz1Id, true) });
assert.equal(unreleased.status, 404);

const method = await request({}, 'GET');
assert.equal(method.status, 405);

assert.equal(quiz1.released, true);
assert.equal(quiz2.released, true);
assert.equal(quiz3.released, true);
assert.equal(quiz4.released, true);
assert.equal(QUIZ_RUNTIME[quiz5Id].released, false);

console.log('Quiz submit function tests passed.');
