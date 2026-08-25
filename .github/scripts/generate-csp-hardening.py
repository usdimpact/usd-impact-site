from pathlib import Path
import json

web = Path('apps/web')
astro_files = sorted((web / 'src').rglob('*.astro'))
inline_count = 0

for path in astro_files:
    source = path.read_text()
    count = source.count('<script is:inline>')
    if count:
        inline_count += count
        source = source.replace('<script is:inline>', '<script>')
        path.write_text(source)

if inline_count != 11:
    raise SystemExit(f'Expected exactly 11 deterministic is:inline script bodies, found {inline_count}.')
if any('<script is:inline>' in path.read_text() for path in astro_files):
    raise SystemExit('An is:inline script body remains after CSP migration.')

astro_config = """import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import accessMap from './src/data/quiz-access-map.json' with { type: 'json' };

const normalizePath = (value) => {
  const normalized = value.replace(/\\/+$/, '');
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
  security: {
    csp: {
      algorithm: 'SHA-384',
      directives: [
        \"default-src 'self'\",
        \"img-src 'self' data: blob: https:\",
        \"font-src 'self' data:\",
        \"connect-src 'self' https://challenges.cloudflare.com\",
        \"frame-src 'self' https://challenges.cloudflare.com https://usd-impact-pipeline.pages.dev\",
        \"media-src 'self' blob: https:\",
        \"worker-src 'self' blob:\",
        \"manifest-src 'self'\",
        \"form-action 'self'\",
        'upgrade-insecure-requests',
      ],
      scriptDirective: {
        resources: [
          { resource: \"'self'\", kind: 'element' },
          { resource: 'https://challenges.cloudflare.com', kind: 'element' },
          { resource: \"'none'\", kind: 'attribute' },
        ],
      },
      styleDirective: {
        resources: [
          { resource: \"'self'\", kind: 'element' },
          { resource: \"'unsafe-inline'\", kind: 'attribute' },
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
"""
(web / 'astro.config.mjs').write_text(astro_config)

vercel_path = web / 'vercel.json'
vercel = json.loads(vercel_path.read_text())
global_headers = next((item['headers'] for item in vercel['headers'] if item['source'] == '/(.*)'), None)
if global_headers is None:
    raise SystemExit('Global Vercel header block was not found.')

additions = {
    'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
    'X-Permitted-Cross-Domain-Policies': 'none',
}
existing = {item['key']: item for item in global_headers}
for key, value in additions.items():
    if key in existing:
        existing[key]['value'] = value
    else:
        global_headers.append({'key': key, 'value': value})
vercel_path.write_text(json.dumps(vercel, indent=2) + '\n')

Path('.github/workflows/agent-astro-csp-hardening.yml').unlink()
Path('.github/scripts/generate-csp-hardening.py').unlink()
print(f'Migrated {inline_count} inline scripts and enabled native Astro CSP.')
