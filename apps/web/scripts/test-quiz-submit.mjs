import assert from 'node:assert/strict';
import handler from '../api/quiz-submit.js';
import { QUIZ_RUNTIME } from '../api/_quiz-runtime.generated.js';

const secret = 'test-secret-that-is-longer-than-thirty-two-characters';
process.env.QUIZ_PROGRESS_SECRET = secret;

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value = '') { this.body = value; },
  };
}

async function request(body, { method = 'POST', cookie = '' } = {}) {
  const response = createResponse();
  await handler({ method, body, headers: cookie ? { cookie } : {} }, response);
  return {
    status: response.statusCode,
    headers: response.headers,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

function answersFor(canonicalId, correctCount) {
  const quiz = QUIZ_RUNTIME[canonicalId];
  return Object.fromEntries(quiz.questions.map((question, index) => {
    const correct = index < correctCount;
    const selected = correct
      ? question.correctAnswer
      : question.allowedAnswerKeys.find((key) => key !== question.correctAnswer);
    return [String(question.number), selected];
  }));
}

function cookieFrom(response) {
  const header = response.headers['set-cookie'];
  assert.equal(typeof header, 'string');
  return header.split(';', 1)[0];
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
  'quiz-usd-and-bitcoin',
  'quiz-usd-and-fx-currency-risk',
];
const unlocks = [
  '/dollar/what-is-the-us-dollar',
  '/fx/fx-depreciation-vs-inflation',
  '/dxy/what-is-dxy',
  '/dxy/dxy-vs-broad-usd',
  '/regime/how-to-read-the-dollar',
  '/gold/usd-gold',
  '/energy/usd-wti',
  '/energy/lng-natural-gas',
  '/equities/usd-equities',
  '/bitcoin/usd-bitcoin',
  '/fx/usd-and-currency-risk',
];

const futureWithoutProgress = await request({
  canonicalId: ids[1],
  answers: answersFor(ids[1], 10),
});
assert.equal(futureWithoutProgress.status, 403);
assert.equal(futureWithoutProgress.json.highestUnlockedOrder, 1);

const failed = await request({ canonicalId: ids[0], answers: answersFor(ids[0], 7) });
assert.equal(failed.status, 200);
assert.equal(failed.json.passed, false);
assert.equal(failed.json.progress.highestUnlockedOrder, 1);
assert.equal(failed.headers['set-cookie'], undefined);

const passedQuiz1 = await request({ canonicalId: ids[0], answers: answersFor(ids[0], 8) });
assert.equal(passedQuiz1.status, 200);
assert.equal(passedQuiz1.json.score, 8);
assert.equal(passedQuiz1.json.passed, true);
assert.equal(passedQuiz1.json.unlocksChapter, unlocks[0]);
assert.equal(passedQuiz1.json.progress.highestUnlockedOrder, 2);
let cookie = cookieFrom(passedQuiz1);

const tamperedFuture = await request(
  { canonicalId: ids[1], answers: answersFor(ids[1], 10) },
  { cookie: `${cookie.slice(0, -1)}x` },
);
assert.equal(tamperedFuture.status, 403);

const repeatedQuiz1 = await request(
  { canonicalId: ids[0], answers: answersFor(ids[0], 10) },
  { cookie },
);
assert.equal(repeatedQuiz1.status, 200);
assert.equal(repeatedQuiz1.json.progress.highestUnlockedOrder, 2);

for (let index = 1; index < ids.length; index += 1) {
  const canonicalId = ids[index];
  const pass = await request(
    { canonicalId, answers: answersFor(canonicalId, 10) },
    { cookie },
  );
  assert.equal(pass.status, 200);
  assert.equal(pass.json.score, 10);
  assert.equal(pass.json.passed, true);
  assert.equal(pass.json.details.length, 10);

  if (index < unlocks.length) {
    assert.equal(pass.json.unlocksChapter, unlocks[index]);
    assert.equal(pass.json.nextChapterStatus, 'available');
    assert.equal(pass.json.progress.highestUnlockedOrder, index + 2);
  } else {
    assert.equal(pass.json.unlocksChapter, null);
    assert.equal(pass.json.nextChapterStatus, 'complete');
    assert.equal(pass.json.nextQuizUrl, null);
    assert.equal(pass.json.completionUrl, '/book/read-the-dollar-first/');
    assert.equal(pass.json.progress.highestUnlockedOrder, 12);
    assert.equal(pass.json.progress.sequenceCompleted, true);
  }

  cookie = cookieFrom(pass);
}

const finalId = ids[11];
const finalQuiz = QUIZ_RUNTIME[finalId];
const invalid = await request(
  { canonicalId: finalId, answers: { ...answersFor(finalId, 10), '1': 'NOT_AN_OPTION' } },
  { cookie },
);
assert.equal(invalid.status, 400);
assert.match(invalid.json.error, /Question 1/);

const incomplete = await request(
  { canonicalId: finalId, answers: { '1': finalQuiz.questions[0].correctAnswer } },
  { cookie },
);
assert.equal(incomplete.status, 400);
assert.match(incomplete.json.error, /Question 2/);

const method = await request({}, { method: 'GET' });
assert.equal(method.status, 405);
for (const canonicalId of ids) assert.equal(QUIZ_RUNTIME[canonicalId].released, true);
console.log('Quiz submit function tests passed.');
