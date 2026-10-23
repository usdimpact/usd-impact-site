import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCloudflareStreamToken } from '../src/lib/cloudflare-stream.js';
import { handleLocalizationVisualQaFrame } from '../src/lib/localization-visual-qa-token.js';
import { videoLibraryContentSecurityPolicy } from '../src/lib/video-library-page.js';

const manifest = JSON.parse(
  fs.readFileSync(new URL('../../../docs/operations/hardening-csp-origin-inventory-2026-10-24.json', import.meta.url), 'utf8'),
);
const astro = fs.readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8');
const score = fs.readFileSync(new URL('../src/lib/score-pipeline-origin.js', import.meta.url), 'utf8');
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

assert.equal(manifest.status, 'preview_inventory_only');
assert.equal(manifest.enforcement_enabled, false);
assert.equal(manifest.report_only_header_enabled, false);
assert.equal(manifest.production_header_change_authorized, false);

for (const origin of manifest.browser_surfaces.static_site.script_element_origins) {
  assert.ok(astro.includes(origin), `Static script origin missing from Astro CSP source: ${origin}`);
}
for (const origin of manifest.browser_surfaces.static_site.connect_origins) {
  assert.ok(astro.includes(origin), `Static connect origin missing from Astro CSP source: ${origin}`);
}
for (const origin of manifest.browser_surfaces.static_site.frame_origins) {
  assert.ok(astro.includes(origin), `Static frame origin missing from Astro CSP source: ${origin}`);
}
for (const origin of manifest.browser_surfaces.static_site.score_pipeline_origin_allowlist) {
  assert.ok(score.includes(origin), `Score origin allowlist drifted: ${origin}`);
}

assert.match(astro, /img-src 'self' data: blob: https:/);
assert.match(astro, /media-src 'self' blob: https:/);
assert.equal(manifest.browser_surfaces.static_site.broad_existing_directives.img_src_https_wildcard, true);
assert.equal(manifest.browser_surfaces.static_site.broad_existing_directives.media_src_https_wildcard, true);

function parsePolicy(value) {
  return new Map(
    String(value)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.split(/\s+/);
        return [name, sources];
      }),
  );
}

const customerCode = 'inventory-test';
const videoPolicy = parsePolicy(videoLibraryContentSecurityPolicy(customerCode));
assert.deepEqual(videoPolicy.get('script-src'), ["'self'", 'https://embed.cloudflarestream.com']);
assert.deepEqual(videoPolicy.get('frame-src'), [`https://customer-${customerCode}.cloudflarestream.com`]);
assert.equal(manifest.browser_surfaces.protected_video_library.isolated_response_policy, true);
assert.equal(manifest.browser_surfaces.protected_video_library.global_csp_expansion_required, false);

let streamRequestUrl = null;
await createCloudflareStreamToken({
  videoUid: 'a'.repeat(32),
  environment: {
    CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32),
    CLOUDFLARE_STREAM_API_TOKEN: 'c'.repeat(24),
  },
  fetchImpl: async (url) => {
    streamRequestUrl = new URL(url);
    return new Response(JSON.stringify({ success: true, result: { token: 'a.b.c' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  },
});
assert.equal(streamRequestUrl?.origin, 'https://api.cloudflare.com');
assert.equal(manifest.server_to_server_origins[0].origin, streamRequestUrl?.origin);
assert.equal(manifest.server_to_server_origins[0].browser_csp_dependency, false);

let visualQaUrl = null;
const responseHeaders = new Map();
const response = {
  statusCode: 0,
  setHeader(name, value) { responseHeaders.set(String(name).toLowerCase(), String(value)); },
  end() {},
};
await handleLocalizationVisualQaFrame(
  {
    method: 'GET',
    url: 'https://preview.invalid/api/guided-edition?slug=test-video&time=10',
  },
  response,
  {
    environment: {
      VERCEL_ENV: 'preview',
      VERCEL_GIT_COMMIT_REF: 'feature/spanish-localization-foundation',
    },
    createToken: async () => 'a.b.c',
    resolveUid: () => 'd'.repeat(32),
    resolveVideo: () => ({ durationSeconds: 60 }),
    customerCode: 'visualqa',
    fetchImpl: async (url) => {
      visualQaUrl = new URL(url);
      return new Response(new Uint8Array([1, 2]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg', 'content-length': '2' },
      });
    },
  },
);
assert.equal(visualQaUrl?.origin, 'https://customer-visualqa.cloudflarestream.com');
assert.equal(response.statusCode, 200);
assert.equal(manifest.preview_only_server_fetches[0].browser_csp_dependency, false);

const globalHeaders = new Map(
  (vercel.headers || [])
    .find((entry) => entry.source === '/(.*)')
    ?.headers
    ?.map((entry) => [String(entry.key).toLowerCase(), entry.value]) || [],
);
assert.equal(
  globalHeaders.get('content-security-policy'),
  "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
);
assert.equal(
  globalHeaders.has('content-security-policy-report-only'),
  false,
  'CSP Report-Only must remain disabled during inventory-only hardening.',
);

console.log('CSP origin inventory contract passed; no CSP enforcement change authorized.');
