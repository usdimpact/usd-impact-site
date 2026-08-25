import fs from 'node:fs';
import path from 'node:path';

const paths = {
  preview: 'src/content/pages/book-read-the-dollar-first-preview.md',
  product: 'src/content/products/book-read-the-dollar-first.md',
  lesson: 'src/content/pages/start-here.md',
  quiz: 'src/content/quizzes/en/quiz-start-here.json',
  quizAccess: 'src/data/quiz-access-map.json',
  publicVideoCatalog: 'src/pages/video-library/index.astro',
};

const read = (relativePath) => fs.readFileSync(path.resolve(relativePath), 'utf8');
const failures = [];
const preview = read(paths.preview);
const product = read(paths.product);
const lesson = read(paths.lesson);
const quiz = JSON.parse(read(paths.quiz));
const quizAccess = JSON.parse(read(paths.quizAccess));
const publicVideoCatalog = read(paths.publicVideoCatalog);

if (!/^status:\s+"published"/m.test(preview)) failures.push('Product sample preview must remain published.');
if (!/^slug:\s+"\/book\/read-the-dollar-first\/preview"/m.test(preview)) failures.push('Product sample preview slug changed unexpectedly.');
const previewBody = preview.split('---').slice(2).join('---').trim();
if (previewBody.length < 3500) failures.push('Product sample preview has regressed to a thin sales shell.');

for (const required of [
  '/start-here/',
  '/start-here/quiz/',
  '/video-library/',
  '/book/read-the-dollar-first/',
]) {
  if (!preview.includes(required)) failures.push(`Product sample preview missing required path ${required}`);
}

if (!preview.includes('ctaPrimaryHref: "/start-here/"')) failures.push('Preview primary CTA must open the real public lesson.');
if (!preview.includes('ctaSecondaryHref: "/start-here/quiz/"')) failures.push('Preview secondary CTA must open the real public quiz.');
if (!preview.includes('Video playback remains protected.')) failures.push('Preview must state the protected video-playback boundary.');
if (!preview.includes('does **not** unlock paid chapters')) failures.push('Preview must state the paid-content boundary.');
if (/cloudflarestream\.com|signedToken|<iframe/i.test(preview)) failures.push('Preview page must not embed or reference protected Stream playback.');

if (!/^status:\s+"published"/m.test(lesson)) failures.push('Sample lesson must remain published.');
if (quiz.canonicalId !== 'quiz-start-here' || quiz.slug !== '/start-here/quiz' || quiz.questionCount !== 10 || quiz.questions?.length !== 10) {
  failures.push('Start Here sample quiz contract changed unexpectedly.');
}
const sampleQuizAccess = quizAccess.quizzes?.find((item) => item.canonicalId === 'quiz-start-here');
if (!sampleQuizAccess || sampleQuizAccess.released !== true || sampleQuizAccess.lessonReleased !== true || sampleQuizAccess.order !== 1) {
  failures.push('Start Here sample quiz must remain a released first checkpoint.');
}

if (!product.includes('ctaSecondary: "Try a free sample"')) failures.push('Book product page must retain the free-sample CTA label.');
if (!product.includes('ctaSecondaryHref: "/book/read-the-dollar-first/preview/"')) failures.push('Book product page must point its secondary CTA to the free sample.');
if (!product.includes('[free Read the Dollar First sample](/book/read-the-dollar-first/preview/)')) failures.push('Book product body must explain the free sample.');

for (const required of [
  'Open the protected library',
  'Playback is available only inside the secure Guided Interactive Edition',
  '/guided-edition/video-library/',
]) {
  if (!publicVideoCatalog.includes(required)) failures.push(`Public video catalog missing protection signal: ${required}`);
}
if (/cloudflarestream\.com|signedToken|<iframe/i.test(publicVideoCatalog)) {
  failures.push('Public video catalog must remain metadata-only and must not embed protected playback.');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('controlled product sample preview contract pass');
