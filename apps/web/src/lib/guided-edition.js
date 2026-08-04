export const GUIDED_EDITION_CONTENT_PREFIX = 'guided-edition:';
export const GUIDED_EDITION_PASSING_SCORE = 80;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const chapters = [
  {
    slug: 'chapter-1',
    contentId: `${GUIDED_EDITION_CONTENT_PREFIX}chapter-1`,
    version: 1,
    number: 1,
    title: 'Chapter 1 reader foundation',
    shortTitle: 'Reader foundation',
    description: 'A protected implementation fixture for navigation, progress, resume, and mastery checks.',
    fixture: true,
    sections: [
      {
        id: 'orientation',
        title: 'How this guided reader works',
        progressPercent: 25,
        paragraphs: [
          'This draft chapter contains system-orientation copy only. Canonical manuscript text is intentionally not included in this implementation slice.',
          'Your reading position is stored in your account so you can resume on another signed-in device.',
        ],
      },
      {
        id: 'access-boundary',
        title: 'What protects the learning experience',
        progressPercent: 60,
        paragraphs: [
          'A checkout redirect never grants access. The protected route opens only when the account has a durable active entitlement created from verified payment processing.',
          'Progress and mastery updates are recorded by a verified server route. Browser-supplied scores are never trusted.',
        ],
      },
      {
        id: 'next-step',
        title: 'What comes next',
        progressPercent: 90,
        paragraphs: [
          'After this foundation is approved, canonical chapter content can be integrated without changing the authorization, progress, or mastery boundaries.',
        ],
      },
    ],
    mastery: {
      questionId: 'chapter-1-access-proof',
      prompt: 'What is authoritative proof that a customer may open the Guided Interactive Edition?',
      options: [
        { id: 'checkout-redirect', label: 'The browser returned from checkout successfully.' },
        { id: 'verified-entitlement', label: 'The account has a durable active entitlement created from verified processing.' },
        { id: 'email-only', label: 'The customer entered an email address.' },
      ],
      correctOptionId: 'verified-entitlement',
      correctFeedback: 'Correct. Durable account entitlement—not browser state—is the access authority.',
      incorrectFeedback: 'Review the access boundary: redirects and email possession do not prove payment or grant access.',
    },
  },
];

export const GUIDED_EDITION_CHAPTERS = deepFreeze(chapters);

const chaptersBySlug = new Map(GUIDED_EDITION_CHAPTERS.map((chapter) => [chapter.slug, chapter]));
const chaptersByContentId = new Map(
  GUIDED_EDITION_CHAPTERS.map((chapter) => [chapter.contentId, chapter]),
);

export function getGuidedChapterBySlug(slug) {
  return chaptersBySlug.get(String(slug || '').trim().toLowerCase()) || null;
}

export function getGuidedChapterByContentId(contentId) {
  return chaptersByContentId.get(String(contentId || '').trim()) || null;
}

export function publicGuidedChapter(chapter) {
  if (!chapter) return null;
  return deepFreeze({
    slug: chapter.slug,
    contentId: chapter.contentId,
    version: chapter.version,
    number: chapter.number,
    title: chapter.title,
    shortTitle: chapter.shortTitle,
    description: chapter.description,
    fixture: chapter.fixture,
    sections: chapter.sections,
    mastery: {
      questionId: chapter.mastery.questionId,
      prompt: chapter.mastery.prompt,
      options: chapter.mastery.options,
    },
  });
}

function inputError(message, code) {
  const error = new TypeError(message);
  error.status = 400;
  error.code = code;
  return error;
}

export function normalizeGuidedProgressInput(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw inputError('Progress payload must be an object.', 'INVALID_PROGRESS_PAYLOAD');
  }

  const chapter = getGuidedChapterByContentId(payload.contentId);
  if (!chapter) {
    throw inputError('Choose a valid Guided Edition chapter.', 'INVALID_GUIDED_CONTENT');
  }

  const resumePosition = String(payload.resumePosition || '').trim().toLowerCase();
  const section = chapter.sections.find((candidate) => candidate.id === resumePosition);
  if (!section) {
    throw inputError('Choose a valid resume position.', 'INVALID_RESUME_POSITION');
  }
  if (!Number.isInteger(payload.progressPercent) || payload.progressPercent !== section.progressPercent) {
    throw inputError('Progress must match the selected chapter position.', 'INVALID_PROGRESS_PERCENT');
  }

  return deepFreeze({
    chapter,
    contentId: chapter.contentId,
    contentVersion: chapter.version,
    progressPercent: payload.progressPercent,
    resumePosition,
  });
}

export function evaluateGuidedMastery(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw inputError('Mastery payload must be an object.', 'INVALID_MASTERY_PAYLOAD');
  }

  const chapter = getGuidedChapterByContentId(payload.contentId);
  if (!chapter) {
    throw inputError('Choose a valid Guided Edition chapter.', 'INVALID_GUIDED_CONTENT');
  }

  if (!payload.answers || typeof payload.answers !== 'object' || Array.isArray(payload.answers)) {
    throw inputError('Submit an answer for the mastery check.', 'INVALID_MASTERY_ANSWERS');
  }

  const selectedOptionId = String(payload.answers[chapter.mastery.questionId] || '').trim();
  if (!chapter.mastery.options.some((option) => option.id === selectedOptionId)) {
    throw inputError('Choose one of the available answers.', 'INVALID_MASTERY_ANSWER');
  }

  const correct = selectedOptionId === chapter.mastery.correctOptionId;
  const score = correct ? 100 : 0;
  const passed = score >= GUIDED_EDITION_PASSING_SCORE;
  return deepFreeze({
    chapter,
    contentId: chapter.contentId,
    contentVersion: chapter.version,
    score,
    passed,
    attemptIncrement: 1,
    resumePosition: chapter.sections.at(-1).id,
    feedback: correct ? chapter.mastery.correctFeedback : chapter.mastery.incorrectFeedback,
  });
}

export function normalizeGuidedProgressRecord(row, contentId) {
  const chapter = getGuidedChapterByContentId(contentId);
  if (!chapter) return null;
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return deepFreeze({
      contentId: chapter.contentId,
      status: 'started',
      progressPercent: 0,
      resumePosition: chapter.sections[0].id,
      masteryScore: null,
      attemptCount: 0,
      completedAt: null,
      updatedAt: null,
    });
  }

  const progressPercent = Number.isInteger(row.progress_percent)
    ? Math.min(100, Math.max(0, row.progress_percent))
    : 0;
  const resumePosition = chapter.sections.some((section) => section.id === row.resume_position)
    ? row.resume_position
    : chapter.sections[0].id;
  return deepFreeze({
    contentId: chapter.contentId,
    status: ['started', 'in_progress', 'completed'].includes(row.status) ? row.status : 'started',
    progressPercent,
    resumePosition,
    masteryScore: Number.isInteger(row.mastery_score) ? row.mastery_score : null,
    attemptCount: Number.isInteger(row.attempt_count) ? Math.max(0, row.attempt_count) : 0,
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  });
}

export function guidedResumeHref(chapter, progress) {
  if (!chapter) return '/guided-edition/';
  const position = chapter.sections.some((section) => section.id === progress?.resumePosition)
    ? progress.resumePosition
    : chapter.sections[0].id;
  return `/guided-edition/${chapter.slug}/#${position}`;
}
