import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { handleGuidedEditionRequest } from '../api/guided-edition.js';
import { canonicalGuidedReaderText, canonicalGuidedSupplementText } from '../src/lib/guided-edition.js';
import { SESSION_COOKIE_NAMES } from '../src/lib/supabase-auth.js';

const host = 'usd-impact-site-test-usd-impact.vercel.app';
const accountId = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.guided-edition-test-token.signature';
const activeState = { allowed: true, reason: 'active', user: { id: accountId } };
const testContent = {
  slug: 'chapter-1',
  contentId: 'guided-edition:chapter-1',
  version: 2,
  number: 1,
  title: 'Protected test chapter',
  shortTitle: 'Test chapter',
  description: 'Synthetic content used only by automated tests.',
  part: 'Test part',
  purpose: 'Verify that content is returned only after account access is approved.',
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
testContent.source.readerTextSha256 = createHash('sha256')
  .update(canonicalGuidedReaderText(testContent))
  .digest('hex');
const testRelease = {
  content_id: testContent.contentId,
  version: testContent.version,
  chapter_number: testContent.number,
  slug: testContent.slug,
  status: 'published',
  source_sha256: testContent.source.documentSha256,
  reader_sha256: testContent.source.readerTextSha256,
  payload: testContent,
};
const testContentTwo = {
  ...structuredClone(testContent),
  slug: 'chapter-2',
  contentId: 'guided-edition:chapter-2',
  version: 1,
  number: 2,
  title: 'Protected test chapter 2',
  shortTitle: 'Test chapter 2',
  source: { ...testContent.source, readerTextSha256: '' },
};
testContentTwo.source.readerTextSha256 = createHash('sha256')
  .update(canonicalGuidedReaderText(testContentTwo))
  .digest('hex');
const testReleaseTwo = {
  content_id: testContentTwo.contentId,
  version: testContentTwo.version,
  chapter_number: testContentTwo.number,
  slug: testContentTwo.slug,
  status: 'published',
  source_sha256: testContentTwo.source.documentSha256,
  reader_sha256: testContentTwo.source.readerTextSha256,
  payload: testContentTwo,
};
const correctAnswers = Object.fromEntries(
  testContent.mastery.questions.map((question) => [question.questionId, 'correct']),
);
const testSupplement = {
  contentId: 'guided-supplement:further-reading', version: 1, slug: 'further-reading', type: 'further-reading', order: 1,
  title: 'Protected test supplement', description: 'Synthetic protected reference.', fixture: false,
  source: { documentSha256: 'a'.repeat(64), readerTextSha256: '', productionBuild: 'test-build', edition: 'test-edition', printedPages: '3', pdfPages: '4' },
  sections: [{ id: 'sources', title: 'Sources', paragraphs: ['Synthetic reference text.'] }],
};
testSupplement.source.readerTextSha256 = createHash('sha256').update(canonicalGuidedSupplementText(testSupplement)).digest('hex');
const testSupplementRelease = { content_id: testSupplement.contentId, version: 1, slug: testSupplement.slug, supplement_type: testSupplement.type, sort_order: 1, status: 'published', source_sha256: testSupplement.source.documentSha256, reader_sha256: testSupplement.source.readerTextSha256, payload: testSupplement };

function request({ method = 'GET', url = '/api/guided-edition', authenticated = false, body, headers = {} } = {}) {
  return {
    method,
    url,
    body,
    headers: {
      host,
      'x-forwarded-host': host,
      'x-forwarded-proto': 'https',
      ...(authenticated ? { cookie: `${SESSION_COOKIE_NAMES.ACCESS}=${encodeURIComponent(accessToken)}` } : {}),
      ...headers,
    },
  };
}

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = value; },
  };
}

async function run(input, dependencies = {}) {
  const response = responseRecorder();
  await handleGuidedEditionRequest(input, response, {
    readAccessState: async () => activeState,
    readCatalog: async () => [testRelease],
    readSupplementCatalog: async () => [testSupplementRelease],
    readSupplement: async ({ slug }) => slug === testSupplement.slug ? testSupplementRelease : null,
    readContent: async ({ contentId, slug }) => {
      if (contentId && contentId !== testContent.contentId) return null;
      if (slug && slug !== testContent.slug) return null;
      assert.equal(Boolean(contentId) === Boolean(slug), false);
      return testRelease;
    },
    readProgress: async () => null,
    recordProgress: async () => ({
      status: 'in_progress', progress_percent: 50, resume_position: 'test-middle',
      mastery_score: null, attempt_count: 0, completed_at: null,
      updated_at: '2026-08-04T16:45:00.000Z', data: { contentVersion: 2 },
    }),
    createSignedTrackUrl: async ({ slug }) => `https://project-ref.supabase.co/storage/v1/object/sign/library-pass-assets/audiobook/read-the-dollar-first/v1/${slug}.mp3?token=test-token`,
    ...dependencies,
  });
  return response;
}

let protectedContentReads = 0;
const trackProtectedRead = async () => { protectedContentReads += 1; return []; };
const anonymous = await run(request(), {
  readCatalog: trackProtectedRead,
  readContent: trackProtectedRead,
});
assert.equal(anonymous.statusCode, 302);
assert.equal(protectedContentReads, 0);
const anonymousLocation = new URL(anonymous.getHeader('location'), `https://${host}`);
assert.equal(anonymousLocation.pathname, '/account/sign-in/');
assert.equal(anonymousLocation.searchParams.get('next'), '/guided-edition/');

for (const reason of ['missing', 'suspended', 'suspended_dispute', 'refunded', 'charged_back', 'revoked', 'expired', 'deletion_pending', 'account_deleted', 'deleted']) {
  const denied = await run(
    request({ authenticated: true, url: '/api/guided-edition?campaign=launch' }),
    {
      readAccessState: async () => ({ allowed: false, reason }),
      readCatalog: trackProtectedRead,
      readContent: trackProtectedRead,
    },
  );
  assert.equal(denied.statusCode, 302);
  const location = new URL(denied.getHeader('location'), `https://${host}`);
  assert.equal(location.pathname, '/account/access-required/');
  assert.equal(location.searchParams.get('reason'), reason);
}
assert.equal(protectedContentReads, 0);

let protectedTrackSigns = 0;
const trackSigner = async () => { protectedTrackSigns += 1; return 'https://project-ref.supabase.co/forbidden'; };
const anonymousAudiobook = await run(
  request({ url: '/api/guided-edition?__paid_path=audiobook' }),
  { createSignedTrackUrl: trackSigner },
);
assert.equal(anonymousAudiobook.statusCode, 302);
assert.equal(
  new URL(anonymousAudiobook.getHeader('location'), `https://${host}`).searchParams.get('next'),
  '/guided-edition/audiobook',
);
const anonymousTrack = await run(
  request({ url: '/api/guided-edition?__paid_path=audiobook/track/read-the-dollar-first' }),
  { createSignedTrackUrl: trackSigner },
);
assert.equal(anonymousTrack.statusCode, 302);
assert.equal(protectedTrackSigns, 0);

for (const reason of ['missing', 'suspended_dispute', 'refunded', 'charged_back', 'revoked', 'deletion_pending', 'deleted']) {
  const deniedTrack = await run(
    request({ authenticated: true, url: '/api/guided-edition?__paid_path=audiobook/track/read-the-dollar-first' }),
    {
      readAccessState: async () => ({ allowed: false, reason }),
      createSignedTrackUrl: trackSigner,
    },
  );
  assert.equal(deniedTrack.statusCode, 302);
  assert.equal(
    new URL(deniedTrack.getHeader('location'), `https://${host}`).searchParams.get('reason'),
    reason,
  );
}
assert.equal(protectedTrackSigns, 0);

const library = await run(request({ authenticated: true }), {
  readProgress: async ({ accessToken: received, accountId: receivedAccount, contentId }) => {
    assert.equal(received, accessToken);
    assert.equal(receivedAccount, accountId);
    assert.equal(contentId, testContent.contentId);
    return {
      status: 'in_progress', progress_percent: 50, resume_position: 'test-middle',
      attempt_count: 1, data: { contentVersion: 2 },
    };
  },
});
assert.equal(library.statusCode, 200);
assert.match(library.getHeader('content-type'), /text\/html/);
assert.match(library.getHeader('cache-control'), /private, no-store/);
assert.equal(library.getHeader('vary'), 'Cookie, Authorization');
assert.match(library.body, /Protected test chapter/);
assert.match(library.body, /Resume chapter/);
assert.match(library.body, /value="50"/);
assert.match(library.body, /Protected test supplement/);
assert.match(library.body, /Library Pass audiobook/);
assert.match(library.body, /href="\/guided-edition\/audiobook\/"/);

let audiobookContentReads = 0;
const audiobook = await run(
  request({ authenticated: true, url: '/api/guided-edition?__paid_path=audiobook' }),
  {
    readAccessState: async () => ({
      ...activeState,
      productId: 'read-the-dollar-first-guided-interactive-edition',
      researchMembership: { allowed: false, reason: 'missing' },
    }),
    readContent: async () => { audiobookContentReads += 1; return null; },
  },
);
assert.equal(audiobook.statusCode, 200);
assert.equal(audiobookContentReads, 0);
assert.equal(audiobook.getHeader('referrer-policy'), 'no-referrer');
assert.match(audiobook.body, /Protected Library Pass audiobook/);
assert.match(audiobook.body, /AI-generated speech with human quality review/);
assert.match(audiobook.body, /Previous chapter/);
assert.match(audiobook.body, /Playback speed/);
assert.match(audiobook.body, /saved on this device/);
assert.equal((audiobook.body.match(/data-index="\d+"/g) || []).length, 20);
assert.match(audiobook.body, /\/guided-edition\/audiobook\/track\/read-the-dollar-first\//);
assert.match(audiobook.body, /Chapter 13 - What to Watch from Here/);
assert.doesNotMatch(audiobook.body, /\.mp3|public\.blob\.vercel-storage\.com|storage\/v1\/object\/sign|token=/);

const audiobookHead = await run(request({
  method: 'HEAD',
  authenticated: true,
  url: '/api/guided-edition?__paid_path=audiobook',
}));
assert.equal(audiobookHead.statusCode, 200);
assert.equal(audiobookHead.body, '');
assert.ok(Number(audiobookHead.getHeader('content-length')) > 1000);

let signedSlug = '';
const signedTrackUrl = 'https://project-ref.supabase.co/storage/v1/object/sign/library-pass-assets/audiobook/read-the-dollar-first/v1/00-read-the-dollar-first.mp3?token=temporary-token';
const track = await run(
  request({ authenticated: true, url: '/api/guided-edition?__paid_path=audiobook/track/read-the-dollar-first' }),
  {
    createSignedTrackUrl: async ({ slug }) => {
      signedSlug = slug;
      return signedTrackUrl;
    },
  },
);
assert.equal(track.statusCode, 302);
assert.equal(signedSlug, 'read-the-dollar-first');
assert.equal(track.getHeader('location'), signedTrackUrl);
assert.match(track.getHeader('cache-control'), /private, no-store/);
assert.equal(track.getHeader('referrer-policy'), 'no-referrer');
assert.equal(track.body, '');

let invalidTrackSigns = 0;
const invalidTrack = await run(
  request({ authenticated: true, url: '/api/guided-edition?__paid_path=audiobook/track/not-a-track' }),
  { createSignedTrackUrl: async () => { invalidTrackSigns += 1; return signedTrackUrl; } },
);
assert.equal(invalidTrack.statusCode, 404);
assert.equal(invalidTrackSigns, 0);

const originalSigningConsoleError = console.error;
let signingLog = '';
console.error = (...values) => { signingLog = values.map(String).join(' '); };
let signingFailure;
try {
  signingFailure = await run(
    request({ authenticated: true, url: '/api/guided-edition?__paid_path=audiobook/track/read-the-dollar-first' }),
    { createSignedTrackUrl: async () => {
      const error = new Error('Sensitive provider details must not reach the response.');
      error.code = 'AUDIOBOOK_SIGNING_FAILED';
      throw error;
    } },
  );
} finally {
  console.error = originalSigningConsoleError;
}
assert.equal(signingFailure.statusCode, 503);
assert.equal(signingFailure.body, 'This audiobook track is temporarily unavailable.');
assert.doesNotMatch(signingFailure.body, /Sensitive provider details/);
assert.match(signingLog, /AUDIOBOOK_SIGNING_FAILED/);

const multiChapterLibrary = await run(request({ authenticated: true }), {
  readCatalog: async () => [testReleaseTwo, testRelease],
  readProgress: async () => null,
});
assert.equal(multiChapterLibrary.statusCode, 200);
assert.ok(multiChapterLibrary.body.indexOf('Protected test chapter 1') < multiChapterLibrary.body.indexOf('Protected test chapter 2'));

const chapter = await run(request({ authenticated: true, url: '/api/guided-edition?__paid_path=chapter-1' }));
assert.equal(chapter.statusCode, 200);
assert.match(chapter.body, /Protected test chapter/);
assert.match(chapter.body, /What this chapter does/);
assert.match(chapter.body, /id="test-start"/);
assert.match(chapter.body, /id="test-review"/);
assert.match(chapter.body, /id="mastery-form"/);
assert.match(chapter.body, /Answer all five questions/);
assert.match(chapter.body, /Skip to content/);
assert.doesNotMatch(chapter.body, /correctOptionId|correctFeedback|incorrectFeedback/);

const head = await run(request({ method: 'HEAD', authenticated: true, url: '/api/guided-edition?__paid_path=chapter-1' }));
assert.equal(head.statusCode, 200);
assert.equal(head.body, '');
assert.ok(Number(head.getHeader('content-length')) > 1000);

const originalConsoleError = console.error;
let unavailableLog = '';
console.error = (...values) => { unavailableLog = values.map(String).join(' '); };
let unavailable;
try {
  unavailable = await run(
    request({ authenticated: true, url: '/api/guided-edition?__paid_path=chapter-1' }),
    { readContent: async () => { throw new Error('Synthetic content read failure.'); } },
  );
} finally {
  console.error = originalConsoleError;
}
assert.equal(unavailable.statusCode, 503);
assert.equal(unavailable.body, 'Guided Edition content is temporarily unavailable.');
assert.match(unavailableLog, /Guided Edition content read failed/);

const missing = await run(request({ authenticated: true, url: '/api/guided-edition?__paid_path=chapter-99' }));
assert.equal(missing.statusCode, 404);

const supplement = await run(request({ authenticated: true, url: '/api/guided-edition?__paid_path=further-reading' }));
assert.equal(supplement.statusCode, 200);
assert.match(supplement.body, /Protected test supplement/);
assert.match(supplement.body, /Protected reference/);
assert.doesNotMatch(supplement.body, /mastery-form|save-place/);

const anonymousProgress = await run(request({ url: '/api/guided-edition?action=progress&contentId=guided-edition%3Achapter-1' }));
assert.equal(anonymousProgress.statusCode, 401);
assert.equal(JSON.parse(anonymousProgress.body).code, 'AUTHENTICATION_REQUIRED');

const readProgress = await run(request({ authenticated: true, url: '/api/guided-edition?action=progress&contentId=guided-edition%3Achapter-1' }), {
  readProgress: async ({ accountId: receivedAccount }) => {
    assert.equal(receivedAccount, accountId);
    return {
      status: 'in_progress', progress_percent: 20, resume_position: 'test-start',
      attempt_count: 0, data: { contentVersion: 2 },
    };
  },
});
assert.equal(readProgress.statusCode, 200);
assert.equal(JSON.parse(readProgress.body).progress.progressPercent, 20);

const invalidContent = await run(request({ authenticated: true, url: '/api/guided-edition?action=progress&contentId=private%3Aother' }));
assert.equal(invalidContent.statusCode, 400);
assert.equal(JSON.parse(invalidContent.body).code, 'INVALID_GUIDED_CONTENT');

let recordedProgress;
const writeProgress = await run(request({
  method: 'PATCH', authenticated: true, url: '/api/guided-edition?action=progress',
  headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  body: { contentId: testContent.contentId, progressPercent: 50, resumePosition: 'test-middle' },
}), {
  recordProgress: async (input) => {
    recordedProgress = input;
    return {
      status: 'in_progress', progress_percent: 50, resume_position: 'test-middle',
      attempt_count: 0, data: { contentVersion: 2 },
    };
  },
});
assert.equal(writeProgress.statusCode, 200);
assert.equal(recordedProgress.accountId, accountId);
assert.equal(recordedProgress.contentVersion, 2);

const mismatchedProgress = await run(request({
  method: 'PATCH', authenticated: true, url: '/api/guided-edition?action=progress',
  headers: { 'content-type': 'application/json' },
  body: { contentId: testContent.contentId, progressPercent: 100, resumePosition: 'test-middle' },
}));
assert.equal(mismatchedProgress.statusCode, 400);
assert.equal(JSON.parse(mismatchedProgress.body).code, 'INVALID_PROGRESS_PERCENT');

const crossSite = await run(request({
  method: 'PATCH', authenticated: true, url: '/api/guided-edition?action=progress',
  headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: {},
}));
assert.equal(crossSite.statusCode, 403);

let masteryWrite;
const mastery = await run(request({
  method: 'POST', authenticated: true, url: '/api/guided-edition?action=mastery',
  headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  body: { contentId: testContent.contentId, answers: correctAnswers },
}), {
  recordProgress: async (input) => {
    masteryWrite = input;
    return {
      status: 'completed', progress_percent: 100, resume_position: 'test-review', mastery_score: 100,
      attempt_count: 1, completed_at: '2026-08-04T16:50:00.000Z', data: { contentVersion: 2 },
    };
  },
});
assert.equal(mastery.statusCode, 200);
assert.equal(JSON.parse(mastery.body).passed, true);
assert.equal(JSON.parse(mastery.body).questionResults.length, 5);
assert.equal(masteryWrite.masteryPassed, true);
assert.equal(masteryWrite.contentVersion, 2);

let failedMasteryWrite;
const failedMastery = await run(request({
  method: 'POST', authenticated: true, url: '/api/guided-edition?action=mastery',
  headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  body: {
    contentId: testContent.contentId,
    answers: { ...correctAnswers, 'test-question-4': 'incorrect', 'test-question-5': 'incorrect' },
  },
}), {
  recordProgress: async (input) => {
    failedMasteryWrite = input;
    return {
      status: 'in_progress', progress_percent: 98, resume_position: 'test-review', mastery_score: 60,
      attempt_count: 1, completed_at: null, data: { contentVersion: 2 },
    };
  },
});
assert.equal(failedMastery.statusCode, 200);
assert.equal(JSON.parse(failedMastery.body).score, 60);
assert.equal(failedMasteryWrite.progressPercent, 98);
assert.equal(failedMasteryWrite.masteryPassed, false);

const deniedApi = await run(request({ authenticated: true, url: '/api/guided-edition?action=progress&contentId=guided-edition%3Achapter-1' }), {
  readAccessState: async () => ({ allowed: false, reason: 'refunded' }),
});
assert.equal(deniedApi.statusCode, 403);
assert.equal(JSON.parse(deniedApi.body).reason, 'refunded');

const postPage = await run(request({ method: 'POST' }));
assert.equal(postPage.statusCode, 405);
assert.equal(postPage.getHeader('allow'), 'GET, HEAD');

console.log('Serverless Guided Edition private-content routing tests passed.');
