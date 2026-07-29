import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import accessMap from './src/data/quiz-access-map.json' with { type: 'json' };

const normalizePath = (value) => {
  const normalized = value.replace(/\/+$/, '');
  return normalized || '/';
};

const protectedPaths = new Set(
  accessMap.quizzes.flatMap((quiz) => [
    normalizePath(quiz.relatedLessonUrl),
    normalizePath(quiz.slug),
  ]),
);

export default defineConfig({
  site: 'https://www.usd-impact.com',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => !protectedPaths.has(normalizePath(new URL(page).pathname)),
    }),
  ],
});
