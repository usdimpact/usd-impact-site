import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  canonicalGuidedReaderText,
  evaluateGuidedMastery,
  getGuidedChapterByContentId,
  getGuidedChapterBySlug,
  guidedResumeHref,
  normalizeGuidedContentCatalog,
  normalizeGuidedContentRelease,
  normalizeGuidedProgressInput,
  normalizeGuidedProgressRecord,
  publicGuidedChapter,
} from '../src/lib/guided-edition.js';

function buildTestRelease(number, version = number + 1) {
  const slug = `chapter-${number}`;
  const sectionPrefix = `test-${number}`;
  const payload = {
    slug,
    contentId: `guided-edition:${slug}`,
    version,
    number,
    title: `Protected test chapter ${number}`,
    shortTitle: `Test chapter ${number}`,
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
      pdfPages: '2-3',
    },
    sections: [
      { id: `${sectionPrefix}-start`, title: 'Test start', progressPercent: 20, paragraphs: ['First synthetic paragraph.'] },
      { id: `${sectionPrefix}-middle`, title: 'Test middle', progressPercent: 50, paragraphs: ['Second synthetic paragraph.'] },
      { id: `${sectionPrefix}-review`, title: 'Test review', progressPercent: 98, paragraphs: ['Final synthetic paragraph.'] },
    ],
    mastery: {
      questions: Array.from({ length: 5 }, (_, index) => ({
        questionId: `${sectionPrefix}-question-${index + 1}`,
        prompt: `Synthetic question ${index + 1}?`,
        options: [
          { id: 'correct', label: 'Correct test answer' },
          { id: 'incorrect', label: 'Incorrect test answer' },
        ],
        correctOptionId: 'correct',
        correctFeedback: 'Correct synthetic feedback.',
        incorrectFeedback: 'Review the synthetic test section.',
        reviewSectionId: index < 2 ? `${sectionPrefix}-start` : `${sectionPrefix}-middle`,
      })),
    },
  };
  payload.source.readerTextSha256 = createHash('sha256')
    .update(canonicalGuidedReaderText(payload))
    .digest('hex');
  return {
    content_id: payload.contentId,
    version: payload.version,
    chapter_number: payload.number,
    slug: payload.slug,
    status: 'published',
    source_sha256: payload.source.documentSha256,
    reader_sha256: payload.source.readerTextSha256,
    payload,
  };
}

const releaseOne = buildTestRelease(1, 2);
const releaseTwo = buildTestRelease(2, 1);
const catalog = normalizeGuidedContentCatalog([releaseTwo, releaseOne]);
const [chapter] = catalog;
assert.equal(catalog.length, 2);
assert.equal(catalog[0].number, 1);
assert.equal(catalog[1].number, 2);
assert.equal(Object.isFrozen(catalog), true);
assert.equal(getGuidedChapterBySlug(catalog, 'CHAPTER-2'), catalog[1]);
assert.equal(getGuidedChapterByContentId(catalog, 'guided-edition:chapter-1'), chapter);
assert.equal(getGuidedChapterBySlug(catalog, 'missing'), null);
assert.equal(normalizeGuidedContentRelease(releaseOne, { slug: 'chapter-1' }), chapter);

assert.throws(
  () => normalizeGuidedContentCatalog([
    releaseOne,
    { ...releaseTwo, chapter_number: 1, payload: { ...releaseTwo.payload, number: 1 } },
  ]),
  (error) => error.code === 'INVALID_GUIDED_CONTENT_RELEASE',
);
assert.throws(
  () => normalizeGuidedContentRelease({ ...releaseOne, status: 'draft' }),
  (error) => error.code === 'INVALID_GUIDED_CONTENT_RELEASE',
);
assert.throws(
  () => normalizeGuidedContentRelease({ ...releaseOne, reader_sha256: 'b'.repeat(64) }),
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
  resumePosition: 'test-1-middle',
}, chapter);
assert.equal(progressInput.contentVersion, 2);
assert.equal(progressInput.chapter, chapter);
assert.throws(
  () => normalizeGuidedProgressInput({
    contentId: chapter.contentId,
    progressPercent: 100,
    resumePosition: 'test-1-middle',
  }, chapter),
  (error) => error.code === 'INVALID_PROGRESS_PERCENT',
);

const correctAnswers = Object.fromEntries(
  chapter.mastery.questions.map((question) => [question.questionId, 'correct']),
);
const passed = evaluateGuidedMastery({ contentId: chapter.contentId, answers: correctAnswers }, chapter);
assert.equal(passed.score, 100);
assert.equal(passed.passed, true);
const failed = evaluateGuidedMastery({
  contentId: chapter.contentId,
  answers: {
    ...correctAnswers,
    'test-1-question-4': 'incorrect',
    'test-1-question-5': 'incorrect',
  },
}, chapter);
assert.equal(failed.score, 60);
assert.equal(failed.passed, false);
assert.equal(failed.progressPercent, 98);

const emptyProgress = normalizeGuidedProgressRecord(null, chapter);
assert.deepEqual(emptyProgress, {
  contentId: chapter.contentId,
  status: 'started',
  progressPercent: 0,
  resumePosition: 'test-1-start',
  masteryScore: null,
  attemptCount: 0,
  completedAt: null,
  updatedAt: null,
});
assert.equal(guidedResumeHref(chapter, emptyProgress), '/guided-edition/chapter-1/#test-1-start');

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

const accountPage = await readFile(new URL('../src/pages/account/index.astro', import.meta.url), 'utf8');
assert.match(accountPage, /id="learning-progress"/);
assert.match(accountPage, /href="\/guided-edition\/"/);
assert.doesNotMatch(accountPage, /guided-edition%3Achapter-1|\/guided-edition\/chapter-1/);

const manifest = await readFile(
  new URL('../../../docs/content/guided-edition-source-manifest.md', import.meta.url),
  'utf8',
);
assert.match(manifest, /Printed pages: 8-11/);
assert.match(manifest, /Physical PDF pages: 9-12/);
assert.match(manifest, /Printed pages: 12-15/);
assert.match(manifest, /Physical PDF pages: 13-16/);

const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const rewrites = new Map(vercel.rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));
assert.equal(rewrites.get('/api/guided-progress'), '/api/guided-edition?action=progress');
assert.equal(rewrites.get('/api/guided-mastery'), '/api/guided-edition?action=mastery');

console.log('Guided Edition private-content catalog contract tests passed.');
