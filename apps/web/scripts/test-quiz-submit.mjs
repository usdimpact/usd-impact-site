import assert from 'node:assert/strict';
import handler from '../api/quiz-submit.js';
import { QUIZ_RUNTIME } from '../api/_quiz-runtime.generated.js';

function createResponse() {
  return { statusCode: 200, headers: {}, body: '', setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, end(value = '') { this.body = value; } };
}
async function request(body, method = 'POST') {
  const response = createResponse();
  await handler({ method, body }, response);
  return { status: response.statusCode, headers: response.headers, json: response.body ? JSON.parse(response.body) : null };
}
function answersFor(canonicalId, correct) {
  const quiz = QUIZ_RUNTIME[canonicalId];
  return Object.fromEntries(quiz.questions.map((question) => [String(question.number), correct ? question.correctAnswer : question.allowedAnswerKeys.find((key) => key !== question.correctAnswer)]));
}

const ids = [
  'quiz-start-here','quiz-what-is-us-dollar','quiz-fx-depreciation-vs-inflation','quiz-dxy-explained','quiz-dxy-vs-broad-usd','quiz-dollar-regime-framework','quiz-usd-and-gold','quiz-usd-and-wti','quiz-usd-and-lng-natural-gas','quiz-usd-and-equities','quiz-usd-and-bitcoin','quiz-usd-and-fx-currency-risk',
];
const unlocks = [
  '/dollar/what-is-the-us-dollar/quiz','/fx/fx-depreciation-vs-inflation','/dxy/what-is-dxy','/dxy/dxy-vs-broad-usd','/regime/how-to-read-the-dollar','/gold/usd-gold','/energy/usd-wti','/energy/lng-natural-gas','/equities/usd-equities','/bitcoin/usd-bitcoin','/fx/usd-and-currency-risk',
];

for (let index = 0; index < unlocks.length; index += 1) {
  const canonicalId = ids[index];
  const pass = await request({ canonicalId, answers: answersFor(canonicalId, true) });
  assert.equal(pass.status, 200);
  assert.equal(pass.json.score, 10);
  assert.equal(pass.json.passed, true);
  assert.equal(pass.json.unlocksChapter, unlocks[index]);
  assert.equal(pass.json.nextChapterStatus, 'available');
  assert.equal(pass.json.details.length, 10);
}

const finalId = ids[11];
const finalQuiz = QUIZ_RUNTIME[finalId];
const completed = await request({ canonicalId: finalId, answers: answersFor(finalId, true) });
assert.equal(completed.status, 200);
assert.equal(completed.json.score, 10);
assert.equal(completed.json.passed, true);
assert.equal(completed.json.unlocksChapter, null);
assert.equal(completed.json.nextChapterStatus, 'complete');
assert.equal(completed.json.nextQuizUrl, null);
assert.equal(completed.json.completionUrl, '/book/read-the-dollar-first/');

const failed = await request({ canonicalId: finalId, answers: answersFor(finalId, false) });
assert.equal(failed.status, 200);
assert.equal(failed.json.score, 0);
assert.equal(failed.json.passed, false);
assert.equal(failed.json.unlocksChapter, null);
assert.equal(failed.json.nextChapterStatus, 'locked');
assert.equal(failed.json.completionUrl, null);

const invalid = await request({ canonicalId: finalId, answers: { ...answersFor(finalId, true), '1': 'NOT_AN_OPTION' } });
assert.equal(invalid.status, 400);
assert.match(invalid.json.error, /Question 1/);
const incomplete = await request({ canonicalId: finalId, answers: { '1': finalQuiz.questions[0].correctAnswer } });
assert.equal(incomplete.status, 400);
assert.match(incomplete.json.error, /Question 2/);
const method = await request({}, 'GET');
assert.equal(method.status, 405);
for (const canonicalId of ids) assert.equal(QUIZ_RUNTIME[canonicalId].released, true);
console.log('Quiz submit function tests passed.');
