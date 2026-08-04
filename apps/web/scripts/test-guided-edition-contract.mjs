import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  GUIDED_EDITION_CHAPTERS,
  canonicalGuidedReaderText,
  evaluateGuidedMastery,
  getGuidedChapterByContentId,
  getGuidedChapterBySlug,
  guidedResumeHref,
  normalizeGuidedContentRelease,
  normalizeGuidedProgressInput,
  normalizeGuidedProgressRecord,
  publicGuidedChapter,
} from '../src/lib/guided-edition.js';

const [descriptor] = GUIDED_EDITION_CHAPTERS;
assert.equal(GUIDED_EDITION_CHAPTERS.length, 1);
assert.equal(Object.isFrozen(GUIDED_EDITION_CHAPTERS), true);
assert.equal(descriptor.version, 2);
assert.equal(getGuidedChapterBySlug('CHAPTER-1'), descriptor);
assert.equal(getGuidedChapterByContentId('guided-edition:chapter-1'), descriptor);
assert.equal(getGuidedChapterBySlug('missing'), null);

const testPayload = {
  ...descriptor,
  title: 'Protected test chapter',
  shortTitle: 'Test chapter',
  description: 'Synthetic content used only by automated tests.',
  part: 'Test part',
  purpose: 'Verify protected reader behavior without storing paid manuscript content in Git.',
  fixture: false,
  source: {
    documentSha256: 'a'.repeat(64),
    readerTextSha256: '',
    productionBuild: 'test-build',
    edition: 'test-edition',
    printedPages: '1-2',
  },
  sections: [
    { id: 'test-start', title: 'Test start', progressPercent: 20, paragraphs: ['First synthetic paragraph.'] },
    { id: 'test-middle', title: 'Test middle', progressPercent: 50, paragraphs: ['Second synthetic paragraph.'] },
    { id: 'test-review', title: 'Test review', progressPercent: 98, paragraphs: ['Final synthetic paragraph.'] },
  ],
  mastery: {
    questions: Array.from({ length: 5 }, (_, index) => ({
      questionId: `test-question-${index + 1}`,
      prompt: `Synthetic question ${index + 1}?`,
      options: [
        { id: 'correct', label: 'Correct test answer' },
        { id: 'incorrect', label: 'Incorrect test answer' },
      ],
      correctOptionId: 'correct',
      correctFeedback: 'Correct synthetic feedback.',
      incorrectFeedback: 'Review the synthetic test section.',
      reviewSectionId: index < 2 ? 'test-start' : 'test-middle',
    })),
  },
};
testPayload.source.readerTextSha256 = createHash('sha256')
  .update(canonicalGuidedReaderText(testPayload))
  .digest('hex');
const releaseRow = {
  content_id: descriptor.contentId,
  version: descriptor.version,
  slug: descriptor.slug,
  status: 'published',
  source_sha256: testPayload.source.documentSha256,
  reader_sha256: testPayload.source.readerTextSha256,
  payload: testPayload,
};
const chapter = normalizeGuidedContentRelease(releaseRow, descriptor);
assert.equal(Object.isFrozen(chapter), true);

assert.throws(
  () => normalizeGuidedContentRelease({ ...releaseRow, status: 'draft' }, descriptor),
  (error) => error.code === 'GUIDED_CONTENT_UNAVAILABLE',
);
assert.throws(
  () => normalizeGuidedContentRelease({ ...releaseRow, reader_sha256: 'b'.repeat(64) }, descriptor),
  (error) => error.code === 'GUIDED_CONTENT_INTEGRITY_FAILED',
);

const publicChapter = publicGuidedChapter(chapter);
assert.equal(Object.isFrozen(publicChapter), true);
assert.equal(publicChapter.mastery.questions.length, 5);
for (const question of publicChapter.mastery.questions) {
  assert.equal('correctOptionId' in question, false);
  assert.equal('correctFeedback' in question, false);
  assert.equal('incorrectFeedback' in question, false);
  assert.equal('reviewSectionId' in question, false);
}

const progressInput = normalizeGuidedProgressInput({
  contentId: chapter.contentId,
  progressPercent: 50,
  resumePosition: 'test-middle',
}, chapter);
assert.equal(progressInput.contentVersion, 2);
assert.equal(progressInput.chapter, chapter);
assert.throws(
  () => normalizeGuidedProgressInput({
    contentId: chapter.contentId,
    progressPercent: 100,
    resumePosition: 'test-middle',
  }, chapter),
  (error) => error.code === 'INVALID_PROGRESS_PERCENT',
);

const correctAnswers = Object.fromEntries(
  chapter.mastery.questions.map((question) => [question.questionId, 'correct']),
);
const passed = evaluateGuidedMastery({ contentId: chapter.contentId, answers: correctAnswers }, chapter);
assert.equal(passed.score, 100);
assert.equal(passed.passed, true);
assert.equal(passed.attemptIncrement, 1);
assert.equal(passed.questionResults.length, 5);

const eightyPercent = evaluateGuidedMastery({
  contentId: chapter.contentId,
  answers: { ...correctAnswers, 'test-question-4': 'incorrect' },
}, chapter);
assert.equal(eightyPercent.score, 80);
assert.equal(eightyPercent.passed, true);

const failed = evaluateGuidedMastery({
  contentId: chapter.contentId,
  answers: {
    ...correctAnswers,
    'test-question-4': 'incorrect',
    'test-question-5': 'incorrect',
  },
}, chapter);
assert.equal(failed.score, 60);
assert.equal(failed.passed, false);
assert.equal(failed.progressPercent, 98);
assert.match(failed.feedback, /Review the sections/);
assert.throws(
  () => evaluateGuidedMastery({ contentId: chapter.contentId, answers: {} }, chapter),
  (error) => error.code === 'INVALID_MASTERY_ANSWER',
);

const emptyProgress = normalizeGuidedProgressRecord(null, chapter);
assert.deepEqual(emptyProgress, {
  contentId: chapter.contentId,
  status: 'started',
  progressPercent: 0,
  resumePosition: 'test-start',
  masteryScore: null,
  attemptCount: 0,
  completedAt: null,
  updatedAt: null,
});
assert.equal(guidedResumeHref(chapter, emptyProgress), '/guided-edition/chapter-1/#test-start');

const staleProgress = normalizeGuidedProgressRecord({
  status: 'completed',
  progress_percent: 100,
  resume_position: 'old-section',
  mastery_score: 100,
  attempt_count: 3,
  completed_at: '2026-08-04T16:45:00.000Z',
  updated_at: '2026-08-04T16:45:00.000Z',
  data: { contentVersion: 1 },
}, chapter);
assert.deepEqual(staleProgress, emptyProgress);

const savedProgress = normalizeGuidedProgressRecord({
  status: 'in_progress',
  progress_percent: 50,
  resume_position: 'test-middle',
  mastery_score: 60,
  attempt_count: 2,
  completed_at: null,
  updated_at: '2026-08-04T16:45:00.000Z',
  data: { contentVersion: 2 },
}, chapter);
assert.equal(savedProgress.progressPercent, 50);
assert.equal(guidedResumeHref(chapter, savedProgress), '/guided-edition/chapter-1/#test-middle');

const accountPage = await readFile(new URL('../src/pages/account/index.astro', import.meta.url), 'utf8');
assert.match(accountPage, /id="learning-progress"/);
assert.match(accountPage, /\/api\/guided-progress\?contentId=guided-edition%3Achapter-1/);

const manifest = await readFile(
  new URL('../../../docs/content/guided-edition-source-manifest.md', import.meta.url),
  'utf8',
);
assert.match(manifest, /Printed pages: 8-11/);
assert.match(manifest, /Physical PDF pages: 9-12/);
assert.match(manifest, /ca3f7d14f5fe4e863e1e83562034cf1d8bacfe6cf6a71fe612a2446f82d9b5da/);
assert.match(manifest, /919554b9255ba0e5a2da48e1c9fd326e8d1757378a7561e87b3151b1d93ee7a8/);

const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const rewrites = new Map(vercel.rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));
assert.equal(rewrites.get('/api/guided-progress'), '/api/guided-edition?action=progress');
assert.equal(rewrites.get('/api/guided-mastery'), '/api/guided-edition?action=mastery');

console.log('Guided Edition private-content domain contract tests passed.');
