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
  'quiz-start-here',
  'quiz-what-is-us-dollar',
  'quiz-fx-depreciation-vs-inflation',
  'quiz-dxy-explained',
  'quiz-dxy-vs-broad-usd',
  'quiz-dollar-regime-framework',
  'quiz-usd-and-gold',
  'quiz-usd-and-wti',
  'quiz-usd-and-lng-natural-gas',
  'quiz-usd-and-equities',
];
const unlocks = [
  '/dollar/what-is-the-us-dollar/quiz',
  '/fx/fx-depreciation-vs-inflation',
  '/dxy/what-is-dxy',
  '/dxy/dxy-vs-broad-usd',
  '/regime/how-to-read-the-dollar',
  '/gold/usd-gold',
  '/energy/usd-wti',
  '/energy/lng-natural-gas',
  '/equities/usd-equities',
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

const quiz9Id = ids[8];
const quiz9 = QUIZ_RUNTIME[quiz9Id];
const failed = await request({ canonicalId: quiz9Id, answers: answersFor(quiz9Id, false) });
assert.equal(failed.status, 200);
assert.equal(failed.json.score, 0);
assert.equal(failed.json.passed, false);
assert.equal(failed.json.unlocksChapter, null);
assert.equal(failed.json.nextChapterStatus, 'locked');

const invalid = await request({ canonicalId: quiz9Id, answers: { ...answersFor(quiz9Id, true), '1': 'NOT_AN_OPTION' } });
assert.equal(invalid.status, 400);
assert.match(invalid.json.error, /Question 1/);
const incomplete = await request({ canonicalId: quiz9Id, answers: { '1': quiz9.questions[0].correctAnswer } });
assert.equal(incomplete.status, 400);
assert.match(incomplete.json.error, /Question 2/);

const unreleased = await request({ canonicalId: ids[9], answers: answersFor(ids[0], true) });
assert.equal(unreleased.status, 404);
const method = await request({}, 'GET');
assert.equal(method.status, 405);
for (const canonicalId of ids.slice(0, 9)) assert.equal(QUIZ_RUNTIME[canonicalId].released, true);
assert.equal(QUIZ_RUNTIME[ids[9]].released, false);
console.log('Quiz submit function tests passed.');
