import { defineConfig } from 'astro/config';

// QA-ONLY sandbox overlay: never ship with Production. Reject real GA4 IDs.
if (process.env.PUBLIC_GA4_MEASUREMENT_ID && process.env.PUBLIC_GA4_MEASUREMENT_ID !== 'G-TEST1234') {
  throw new Error('GA4 QA-only sandbox refuses non-synthetic analytics measurement IDs.');
}
import sitemap from '@astrojs/sitemap';
import { SEARCH_UTILITY_PATHS } from './src/lib/search-utility-policy.js';
import { canonicalUrlForRequest } from './src/lib/canonical-url.js';
import accessMap from './src/data/quiz-access-map.json' with { type: 'json' };
import { isUnpublishedLocalePath } from './src/lib/localization-policy.js';

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
  ...SEARCH_UTILITY_PATHS,
  '/internal/checklist-analytics',
  '/internal/ask-usd-impact',
  '/internal/localization/spanish-privacy-review',
]);

const previewOnlySitemapPrefixes = [
  '/book/read-the-dollar-first/companion',
  '/practice/dxy-vs-broad-usd',
  '/practice/weekly-regime',
  '/go',
];

const isWithinPrefix = (pathname, prefix) => (
  pathname === prefix || pathname.startsWith(`${prefix}/`)
);

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
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-src 'self'",
        "media-src 'self' blob:",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ],
      scriptDirective: {
        resources: [
          { resource: "'self'", kind: 'element' },
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
      filter: (page) => {
        const pathname = normalizePath(new URL(page).pathname);
        return !privatePaths.has(pathname)
          && !isUnpublishedLocalePath(pathname)
          && !previewOnlySitemapPrefixes.some((prefix) => isWithinPrefix(pathname, prefix));
      },
      serialize: (item) => {
        item.url = canonicalUrlForRequest(new URL(item.url));
        return item;
      },
    }),
  ],
});
