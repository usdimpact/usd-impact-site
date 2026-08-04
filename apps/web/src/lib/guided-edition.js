import { createHash } from 'node:crypto';

export const GUIDED_EDITION_CONTENT_PREFIX = 'guided-edition:';
export const GUIDED_EDITION_PASSING_SCORE = 80;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const chapterDescriptors = [
  {
    slug: 'chapter-1',
    contentId: `${GUIDED_EDITION_CONTENT_PREFIX}chapter-1`,
    version: 2,
    number: 1,
  },
];

export const GUIDED_EDITION_CHAPTERS = deepFreeze(chapterDescriptors);

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

function contentError(message, code = 'GUIDED_CONTENT_UNAVAILABLE') {
  const error = new Error(message);
  error.status = 503;
  error.code = code;
  return error;
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw contentError(`Guided Edition content is missing ${field}.`, 'INVALID_GUIDED_CONTENT_RELEASE');
  }
  return value;
}

export function canonicalGuidedReaderText(chapter) {
  return [
    chapter.title,
    chapter.description,
    chapter.purpose,
    ...chapter.sections.flatMap((section) => [
      section.title,
      ...section.paragraphs,
      ...(section.groups || []).flatMap((group) => [group.title, ...group.items]),
      section.complianceNote || '',
    ]),
  ].filter(Boolean).join('\n');
}

export function normalizeGuidedContentRelease(row, descriptor) {
  if (!descriptor || !row || typeof row !== 'object' || Array.isArray(row)) {
    throw contentError('The Guided Edition chapter is temporarily unavailable.');
  }
  if (
    row.content_id !== descriptor.contentId
    || row.version !== descriptor.version
    || row.slug !== descriptor.slug
    || row.status !== 'published'
  ) {
    throw contentError('The published Guided Edition release does not match the application manifest.');
  }

  const chapter = row.payload;
  if (!chapter || typeof chapter !== 'object' || Array.isArray(chapter)) {
    throw contentError('The published Guided Edition payload is invalid.', 'INVALID_GUIDED_CONTENT_RELEASE');
  }
  if (
    chapter.contentId !== descriptor.contentId
    || chapter.version !== descriptor.version
    || chapter.slug !== descriptor.slug
    || chapter.number !== descriptor.number
    || chapter.fixture !== false
  ) {
    throw contentError('The Guided Edition payload metadata is invalid.', 'INVALID_GUIDED_CONTENT_RELEASE');
  }

  requireText(chapter.title, 'a title');
  requireText(chapter.shortTitle, 'a short title');
  requireText(chapter.description, 'a description');
  requireText(chapter.part, 'a part label');
  requireText(chapter.purpose, 'a purpose statement');
  if (
    chapter.source?.documentSha256 !== row.source_sha256
    || chapter.source?.readerTextSha256 !== row.reader_sha256
  ) {
    throw contentError('The Guided Edition source manifest does not match the stored release.', 'GUIDED_CONTENT_INTEGRITY_FAILED');
  }

  if (!Array.isArray(chapter.sections) || chapter.sections.length === 0) {
    throw contentError('The Guided Edition release has no sections.', 'INVALID_GUIDED_CONTENT_RELEASE');
  }
  const sectionIds = new Set();
  let priorProgress = -1;
  for (const section of chapter.sections) {
    requireText(section?.id, 'a section identifier');
    requireText(section?.title, 'a section title');
    if (
      sectionIds.has(section.id)
      || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(section.id)
      || !Number.isInteger(section.progressPercent)
      || section.progressPercent <= priorProgress
      || section.progressPercent < 0
      || section.progressPercent > 99
      || !Array.isArray(section.paragraphs)
      || section.paragraphs.some((paragraph) => typeof paragraph !== 'string' || !paragraph.trim())
    ) {
      throw contentError('A Guided Edition section is invalid.', 'INVALID_GUIDED_CONTENT_RELEASE');
    }
    sectionIds.add(section.id);
    priorProgress = section.progressPercent;
  }

  if (!Array.isArray(chapter.mastery?.questions) || chapter.mastery.questions.length === 0) {
    throw contentError('The Guided Edition mastery check is invalid.', 'INVALID_GUIDED_CONTENT_RELEASE');
  }
  const questionIds = new Set();
  for (const question of chapter.mastery.questions) {
    if (
      typeof question?.questionId !== 'string'
      || questionIds.has(question.questionId)
      || !Array.isArray(question.options)
      || question.options.length < 2
      || !question.options.some((option) => option.id === question.correctOptionId)
      || !sectionIds.has(question.reviewSectionId)
    ) {
      throw contentError('A Guided Edition mastery question is invalid.', 'INVALID_GUIDED_CONTENT_RELEASE');
    }
    questionIds.add(question.questionId);
    requireText(question.prompt, 'a mastery prompt');
    requireText(question.correctFeedback, 'corrective feedback');
    requireText(question.incorrectFeedback, 'corrective feedback');
  }

  const readerHash = createHash('sha256').update(canonicalGuidedReaderText(chapter)).digest('hex');
  if (readerHash !== row.reader_sha256) {
    throw contentError('The Guided Edition reader text failed its integrity check.', 'GUIDED_CONTENT_INTEGRITY_FAILED');
  }
  return deepFreeze(chapter);
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
    part: chapter.part,
    purpose: chapter.purpose,
    fixture: chapter.fixture,
    source: chapter.source,
    sections: chapter.sections,
    mastery: {
      questions: chapter.mastery.questions.map((question) => ({
        questionId: question.questionId,
        prompt: question.prompt,
        options: question.options,
      })),
    },
  });
}

function inputError(message, code) {
  const error = new TypeError(message);
  error.status = 400;
  error.code = code;
  return error;
}

export function normalizeGuidedProgressInput(payload, chapter) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw inputError('Progress payload must be an object.', 'INVALID_PROGRESS_PAYLOAD');
  }
  if (!chapter || payload.contentId !== chapter.contentId) {
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

export function evaluateGuidedMastery(payload, chapter) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw inputError('Mastery payload must be an object.', 'INVALID_MASTERY_PAYLOAD');
  }
  if (!chapter || payload.contentId !== chapter.contentId) {
    throw inputError('Choose a valid Guided Edition chapter.', 'INVALID_GUIDED_CONTENT');
  }
  if (!payload.answers || typeof payload.answers !== 'object' || Array.isArray(payload.answers)) {
    throw inputError('Submit an answer for the mastery check.', 'INVALID_MASTERY_ANSWERS');
  }

  const questionResults = chapter.mastery.questions.map((question) => {
    const selectedOptionId = String(payload.answers[question.questionId] || '').trim();
    if (!question.options.some((option) => option.id === selectedOptionId)) {
      throw inputError('Answer every mastery question using one of the available choices.', 'INVALID_MASTERY_ANSWER');
    }
    const correct = selectedOptionId === question.correctOptionId;
    return {
      questionId: question.questionId,
      correct,
      feedback: correct ? question.correctFeedback : question.incorrectFeedback,
      reviewSectionId: question.reviewSectionId,
    };
  });
  const correctCount = questionResults.filter((result) => result.correct).length;
  const score = Math.round((correctCount / chapter.mastery.questions.length) * 100);
  const passed = score >= GUIDED_EDITION_PASSING_SCORE;
  return deepFreeze({
    chapter,
    contentId: chapter.contentId,
    contentVersion: chapter.version,
    score,
    passed,
    questionResults,
    attemptIncrement: 1,
    resumePosition: chapter.sections.at(-1).id,
    progressPercent: chapter.sections.at(-1).progressPercent,
    feedback: passed
      ? `Mastery passed: ${correctCount} of ${chapter.mastery.questions.length} answers correct.`
      : `Mastery not yet passed: ${correctCount} of ${chapter.mastery.questions.length} answers correct. Review the sections below and try again.`,
  });
}

export function normalizeGuidedProgressRecord(row, chapter) {
  if (!chapter) return null;
  const freshProgress = () => deepFreeze({
    contentId: chapter.contentId,
    status: 'started',
    progressPercent: 0,
    resumePosition: chapter.sections[0].id,
    masteryScore: null,
    attemptCount: 0,
    completedAt: null,
    updatedAt: null,
  });
  if (
    !row
    || typeof row !== 'object'
    || Array.isArray(row)
    || row.data?.contentVersion !== chapter.version
  ) {
    return freshProgress();
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
