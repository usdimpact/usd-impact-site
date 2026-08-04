import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GUIDED_EDITION_CHAPTERS,
  evaluateGuidedMastery,
  getGuidedChapterByContentId,
  getGuidedChapterBySlug,
  guidedResumeHref,
  normalizeGuidedProgressInput,
  normalizeGuidedProgressRecord,
  publicGuidedChapter,
} from '../src/lib/guided-edition.js';

const [chapter] = GUIDED_EDITION_CHAPTERS;
assert.equal(GUIDED_EDITION_CHAPTERS.length, 1);
assert.equal(Object.isFrozen(GUIDED_EDITION_CHAPTERS), true);
assert.equal(chapter.fixture, true);
assert.equal(getGuidedChapterBySlug('CHAPTER-1'), chapter);
assert.equal(getGuidedChapterByContentId('guided-edition:chapter-1'), chapter);
assert.equal(getGuidedChapterBySlug('missing'), null);

const publicChapter = publicGuidedChapter(chapter);
assert.equal('correctOptionId' in publicChapter.mastery, false);
assert.equal('correctFeedback' in publicChapter.mastery, false);
assert.equal(Object.isFrozen(publicChapter), true);

const progressInput = normalizeGuidedProgressInput({
  contentId: chapter.contentId,
  progressPercent: 60,
  resumePosition: 'access-boundary',
});
assert.equal(progressInput.contentVersion, 1);
assert.equal(progressInput.chapter, chapter);
assert.throws(
  () => normalizeGuidedProgressInput({
    contentId: chapter.contentId,
    progressPercent: 100,
    resumePosition: 'access-boundary',
  }),
  (error) => error.code === 'INVALID_PROGRESS_PERCENT',
);
assert.throws(
  () => normalizeGuidedProgressInput({
    contentId: chapter.contentId,
    progressPercent: 60,
    resumePosition: 'invented',
  }),
  (error) => error.code === 'INVALID_RESUME_POSITION',
);

const failed = evaluateGuidedMastery({
  contentId: chapter.contentId,
  answers: { 'chapter-1-access-proof': 'checkout-redirect' },
});
assert.equal(failed.score, 0);
assert.equal(failed.passed, false);
assert.equal(failed.attemptIncrement, 1);

const passed = evaluateGuidedMastery({
  contentId: chapter.contentId,
  answers: { 'chapter-1-access-proof': 'verified-entitlement' },
});
assert.equal(passed.score, 100);
assert.equal(passed.passed, true);
assert.match(passed.feedback, /Durable account entitlement/);
assert.throws(
  () => evaluateGuidedMastery({ contentId: chapter.contentId, answers: {} }),
  (error) => error.code === 'INVALID_MASTERY_ANSWER',
);

const emptyProgress = normalizeGuidedProgressRecord(null, chapter.contentId);
assert.deepEqual(emptyProgress, {
  contentId: chapter.contentId,
  status: 'started',
  progressPercent: 0,
  resumePosition: 'orientation',
  masteryScore: null,
  attemptCount: 0,
  completedAt: null,
  updatedAt: null,
});
assert.equal(guidedResumeHref(chapter, emptyProgress), '/guided-edition/chapter-1/#orientation');

const savedProgress = normalizeGuidedProgressRecord({
  status: 'in_progress',
  progress_percent: 60,
  resume_position: 'access-boundary',
  mastery_score: 0,
  attempt_count: 2,
  completed_at: null,
  updated_at: '2026-08-04T16:45:00.000Z',
}, chapter.contentId);
assert.equal(savedProgress.progressPercent, 60);
assert.equal(savedProgress.attemptCount, 2);
assert.equal(guidedResumeHref(chapter, savedProgress), '/guided-edition/chapter-1/#access-boundary');

const accountPage = await readFile(new URL('../src/pages/account/index.astro', import.meta.url), 'utf8');
assert.match(accountPage, /id="learning-progress"/);
assert.match(accountPage, /\/api\/guided-progress\?contentId=guided-edition%3Achapter-1/);
assert.match(accountPage, /Resume Chapter 1/);

const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const rewrites = new Map(vercel.rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));
assert.equal(rewrites.get('/api/guided-progress'), '/api/guided-edition?action=progress');
assert.equal(rewrites.get('/api/guided-mastery'), '/api/guided-edition?action=mastery');

console.log('Guided Edition domain contract tests passed.');
