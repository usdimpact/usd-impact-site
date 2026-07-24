import { QUIZ_RUNTIME } from './_quiz-runtime.generated.js';

const MAX_BODY_BYTES = 16_384;

function send(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  if (request.body && typeof request.body === 'object') {
    const encoded = JSON.stringify(request.body);
    if (Buffer.byteLength(encoded, 'utf8') > MAX_BODY_BYTES) {
      throw new Error('Request body is too large.');
    }
    return request.body;
  }
  if (typeof request.body === 'string') {
    if (Buffer.byteLength(request.body, 'utf8') > MAX_BODY_BYTES) {
      throw new Error('Request body is too large.');
    }
    return JSON.parse(request.body);
  }
  throw new Error('A JSON request body is required.');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return send(response, 405, { error: 'Method not allowed.' });
  }

  let payload;
  try {
    payload = parseBody(request);
  } catch (error) {
    return send(response, 400, { error: error instanceof Error ? error.message : 'Invalid JSON.' });
  }

  const canonicalId = typeof payload.canonicalId === 'string' ? payload.canonicalId : '';
  const answers = payload.answers;
  const quiz = QUIZ_RUNTIME[canonicalId];

  if (!quiz || !quiz.released) {
    return send(response, 404, { error: 'Quiz is unavailable.' });
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return send(response, 400, { error: 'answers must be an object keyed by question number.' });
  }

  const details = [];
  let score = 0;

  for (const question of quiz.questions) {
    const selectedAnswer = answers[String(question.number)];
    if (
      typeof selectedAnswer !== 'string' ||
      selectedAnswer.length > 16 ||
      !question.allowedAnswerKeys.includes(selectedAnswer)
    ) {
      return send(response, 400, { error: `Question ${question.number} is unanswered or invalid.` });
    }
    const correct = selectedAnswer === question.correctAnswer;
    if (correct) score += 1;
    details.push({
      number: question.number,
      selectedAnswer,
      correctAnswer: question.correctAnswer,
      correct,
      explanation: question.explanation,
    });
  }

  const passed = score >= quiz.passScore;
  return send(response, 200, {
    canonicalId,
    score,
    questionCount: quiz.questionCount,
    passScore: quiz.passScore,
    passed,
    relatedLessonUrl: quiz.relatedLessonUrl,
    unlocksChapter: passed && quiz.unlocksChapterAvailable ? quiz.unlocksChapter : null,
    nextChapterStatus: passed
      ? (quiz.unlocksChapterAvailable ? 'available' : (quiz.completionUrl ? 'complete' : 'coming-soon'))
      : 'locked',
    nextQuizUrl: passed ? quiz.nextQuizUrl : null,
    completionUrl: passed ? quiz.completionUrl : null,
    details,
  });
}
