import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const accessMap = JSON.parse(await fs.readFile(path.join(webRoot, 'src/data/quiz-access-map.json'), 'utf8'));
const engineSource = await fs.readFile(path.join(webRoot, 'src/components/QuizEngine.astro'), 'utf8');
const routeSource = await fs.readFile(path.join(webRoot, 'src/pages/[...lesson]/quiz.astro'), 'utf8');
const catalogSource = await fs.readFile(path.join(webRoot, 'src/pages/quiz/index.astro'), 'utf8');
const availabilityCtaSource = await fs.readFile(
  path.join(webRoot, 'src/components/LibraryPassAvailabilityCTA.astro'),
  'utf8',
);

assert.deepEqual(accessMap.quizzes.filter((item) => item.released).map((item) => item.canonicalId), [
  'quiz-start-here','quiz-what-is-us-dollar','quiz-fx-depreciation-vs-inflation','quiz-dxy-explained','quiz-dxy-vs-broad-usd','quiz-dollar-regime-framework','quiz-usd-and-gold','quiz-usd-and-wti','quiz-usd-and-lng-natural-gas','quiz-usd-and-equities','quiz-usd-and-bitcoin','quiz-usd-and-fx-currency-risk',
]);
assert.equal(accessMap.purchaseFallbackUrl, '/checkout/');
const quiz12 = accessMap.quizzes[11];
assert.equal(quiz12.released, true);
assert.equal(quiz12.lessonReleased, true);
assert.equal(quiz12.relatedLessonUrl, '/fx/usd-and-currency-risk');
assert.equal(quiz12.unlocksChapter, null);
assert.equal(quiz12.nextQuizUrl, null);
assert.equal(quiz12.completionUrl, '/book/read-the-dollar-first/');

assert.match(engineSource, /Math\.min\(currentIndex, questionElements\.length - 1\)/);
assert.match(engineSource, /currentIndex >= questionElements\.length - 1/);
assert.match(engineSource, /nextButton\.hidden = isLast/);
assert.match(engineSource, /submitButton\.hidden = !isLast/);
assert.match(engineSource, /currentIndex = 0/);
assert.match(engineSource, /localStorage\.getItem\(storageKey\)/);
assert.match(engineSource, /localStorage\.setItem\(storageKey/);
assert.match(engineSource, /data-quiz-completion-link/);
assert.match(engineSource, /Completed —/);
assert.match(engineSource, /completionLink\.href = payload\.completionUrl/);
assert.match(routeSource, /access\.lessonReleased/);
assert.match(routeSource, /Return to the lesson/);
assert.match(routeSource, /View all quizzes/);

for (const [label, source] of [
  ['quiz engine', engineSource],
  ['quiz route', routeSource],
  ['quiz catalog', catalogSource],
]) {
  assert.match(
    source,
    /import LibraryPassAvailabilityCTA from ['"](?:\.\.\/)*\.\.\/components\/LibraryPassAvailabilityCTA\.astro['"]|import LibraryPassAvailabilityCTA from ['"]\.\/LibraryPassAvailabilityCTA\.astro['"]/,
    `${label} must use the shared readiness-aware Library Pass CTA.`,
  );
  assert.match(source, /<LibraryPassAvailabilityCTA className="button (?:primary|secondary)" \/>/);
  assert.doesNotMatch(source, />Join the book waitlist<\/a>/);
}
assert.match(routeSource, /const purchaseUrl = accessMap\.purchaseFallbackUrl;/);
assert.doesNotMatch(routeSource, /PUBLIC_BOOK_PURCHASE_URL/);
assert.match(engineSource, /data-purchase-url=\{purchaseUrl\}/);
assert.match(availabilityCtaSource, /href="\/checkout\/"/);
assert.match(availabilityCtaSource, />Check Library Pass availability<\/a>/);
assert.match(availabilityCtaSource, /bookPurchasePresentation\(body\.commerce\)/);
assert.match(availabilityCtaSource, /if \(!presentation\.available\) continue;/);

console.log('Quiz UI and Library Pass CTA regression contract passed.');
