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

const privatePaths = new Set([
  ...protectedPaths,
  '/internal/checklist-analytics',
]);

export default defineConfig({
  site: 'https://www.usd-impact.com',
  output: 'static',
  markdown: {
    syntaxHighlight: false,
  },
  security: {
    csp: {
      algorithm: 'SHA-384',
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://challenges.cloudflare.com",
        "frame-src 'self' https://challenges.cloudflare.com https://usd-impact-pipeline.pages.dev",
        "media-src 'self' blob: https:",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ],
      scriptDirective: {
        resources: [
          { resource: "'self'", kind: 'element' },
          { resource: 'https://challenges.cloudflare.com', kind: 'element' },
          { resource: "'none'", kind: 'attribute' },
        ],
      },
      styleDirective: {
        resources: [
          { resource: "'self'", kind: 'element' },
          { resource: "'unsafe-inline'", kind: 'attribute' },
        ],
      },
    },
  },
  integrations: [
    sitemap({
      filter: (page) => !privatePaths.has(normalizePath(new URL(page).pathname)),
    }),
  ],
});
