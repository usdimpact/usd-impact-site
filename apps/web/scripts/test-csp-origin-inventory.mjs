import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(
  fs.readFileSync(new URL('../../../docs/operations/hardening-csp-origin-inventory-2026-10-24.json', import.meta.url), 'utf8'),
);
const astro = fs.readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8');
const score = fs.readFileSync(new URL('../src/lib/score-pipeline-origin.js', import.meta.url), 'utf8');
const video = fs.readFileSync(new URL('../src/lib/video-library-page.js', import.meta.url), 'utf8');
const stream = fs.readFileSync(new URL('../src/lib/cloudflare-stream.js', import.meta.url), 'utf8');
const visualQa = fs.readFileSync(new URL('../src/lib/localization-visual-qa-token.js', import.meta.url), 'utf8');
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

assert.ok(video.includes('https://embed.cloudflarestream.com'));
assert.ok(video.includes('https://customer-${customerCode}.cloudflarestream.com'));
assert.equal(manifest.browser_surfaces.protected_video_library.isolated_response_policy, true);
assert.equal(manifest.browser_surfaces.protected_video_library.global_csp_expansion_required, false);

assert.ok(stream.includes('https://api.cloudflare.com/client/v4/accounts/'));
assert.ok(visualQa.includes('https://customer-${customerCode}.cloudflarestream.com/'));

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
