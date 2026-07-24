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

const quiz = QUIZ_RUNTIME['quiz-start-here'];
const allCorrect = Object.fromEntries(
  quiz.questions.map((question) => [String(question.number), question.correctAnswer]),
);
const allWrong = Object.fromEntries(
  quiz.questions.map((question) => [
    String(question.number),
    question.allowedAnswerKeys.find((key) => key !== question.correctAnswer),
  ]),
);

const pass = await request({ canonicalId: 'quiz-start-here', answers: allCorrect });
assert.equal(pass.status, 200);
assert.equal(pass.json.score, 10);
assert.equal(pass.json.passed, true);
assert.equal(pass.json.unlocksChapter, null);
assert.equal(pass.json.nextChapterStatus, 'coming-soon');
assert.equal(pass.json.details.length, 10);

const fail = await request({ canonicalId: 'quiz-start-here', answers: allWrong });
assert.equal(fail.status, 200);
assert.equal(fail.json.score, 0);
assert.equal(fail.json.passed, false);
assert.equal(fail.json.unlocksChapter, null);


const invalidOption = { ...allCorrect, '1': 'NOT_AN_OPTION' };
const invalid = await request({ canonicalId: 'quiz-start-here', answers: invalidOption });
assert.equal(invalid.status, 400);
assert.match(invalid.json.error, /Question 1/);

const incomplete = await request({ canonicalId: 'quiz-start-here', answers: { '1': quiz.questions[0].correctAnswer } });
assert.equal(incomplete.status, 400);
assert.match(incomplete.json.error, /Question 2/);

const unreleased = await request({ canonicalId: 'quiz-what-is-us-dollar', answers: allCorrect });
assert.equal(unreleased.status, 404);

const method = await request({}, 'GET');
assert.equal(method.status, 405);

console.log('Quiz submit function tests passed.');
