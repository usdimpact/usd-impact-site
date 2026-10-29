import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const file=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const candidate=file('../src/content/pages/es/dxy-vs-broad-usd.md');
const english=file('../src/content/pages/dxy-vs-broad-usd.md');
const route=file('../src/pages/es/[...slug].astro');
const counterpart=file('../src/pages/[...slug].astro');
const previewRoute=file('../src/pages/internal/localization/[...slug].astro');
const manifest=file('../src/data/localization-manifest.js');
const astroConfig=file('../astro.config.mjs');
const sha=(text)=>createHash('sha1').update('blob '+Buffer.byteLength(text,'utf8')+'\0').update(text,'utf8').digest('hex');
const expectedEnglish='3c4a3820b9cc0ddc094aa1862f738e231dc0f398';
const expectedBody='4476112d6d09c4cbcbae761517af1cb5f1855842';
const yaml=candidate.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
test('canonical English DXY article is unchanged and matches owner-accepted private source',()=>{
 assert.equal(sha(english),expectedEnglish);
});
test('Spanish Development candidate is valid frontmatter and immutable original approved body',()=>{
 assert.ok(yaml,'Required YAML frontmatter/body missing');
 assert.equal(sha(yaml[2]),expectedBody,'Spanish body diverged from approved extracted body');
 assert.match(yaml[1],/^slug: "\/es\/dxy\/dxy-vs-broad-usd"$/m);
 assert.match(yaml[1],/^status: "review"$/m);
 assert.match(yaml[1],/^readingLevel: "/m);
 assert.match(yaml[1],/^complianceNote: "/m);
 assert.doesNotMatch(yaml[1],/^status: "published"$/m);
 assert.doesNotMatch(candidate,/NO PUBLICAR, NO INDEXAR|Estado de esta traducción:/);
});
test('all source references, original English quiz links and disclaimer are preserved',()=>{
 assert.match(candidate,/Federal Reserve — H\.10/);
 assert.match(candidate,/ICE — U\.S\. Dollar Index/);
 assert.match(candidate,/Puntuación mínima para aprobar: \*\*8 de 10\*\*/);
 assert.match(candidate,/\/dxy\/dxy-vs-broad-usd\/quiz/);
 assert.match(candidate,/No constituye asesoramiento de inversión/);
 assert.match(candidate,/Las relaciones entre índices son condicionales/);
});
test('five existing public Spanish routes remain exact and new DXY URL remains unpublished',()=>{
 const m=route.match(/const AUTHORIZED_SPANISH_PUBLIC_SLUGS = Object\.freeze\(\[([\s\S]*?)\]\);/);
 assert.ok(m,'Spanish route allowlist missing');
 const slugs=[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
 assert.deepEqual(slugs,['/es','/es/start-here','/es/dollar-framework','/es/framework/dollar-transmission-chain','/es/framework/three-dial-dashboard']);
 assert.ok(!slugs.includes('/es/dxy/dxy-vs-broad-usd'));
 assert.doesNotMatch(counterpart,/['"]\/dxy\/dxy-vs-broad-usd['"]:\s*['"]\/es/);
 assert.doesNotMatch(manifest,/"contentId": "web:dxy-vs-broad-usd"/);
});
test('internal private preview is built only for Vercel Preview and is noindexed',()=>{
 assert.match(previewRoute,/process\.env\.VERCEL_ENV !== 'preview'\) return \[\]/);
 assert.match(previewRoute,/entry\.data\.status === 'review'/);
 assert.match(previewRoute,/entry\.data\.slug === '\/es\/dxy\/dxy-vs-broad-usd'/);
 assert.match(previewRoute,/noindex=\{true\}/);
 assert.ok(astroConfig.includes("'/internal/localization/dxy-broad-usd'"),'Preview-only page must be excluded from the public sitemap');
 assert.match(previewRoute,/currentPath="\/internal\/localization\/dxy-broad-usd"/);
 assert.doesNotMatch(previewRoute,/status === 'published'/);
});
test('private preview exposes proposed source metadata for review without approving attribution',()=>{
 assert.match(previewRoute,/Fuentes propuestas en los metadatos/);
 assert.match(previewRoute,/pendientes de comprobación/);
 assert.match(previewRoute,/entry\.data\.sources\.map/);
 assert.match(previewRoute,/No acredita enlaces, atribución, permisos ni una validación jurídica/);
 assert.doesNotMatch(previewRoute,/status: "published"/);
});

test('no Production-release flag, provider call, or entitlement manipulation is introduced',()=>{
 assert.ok(!candidate.includes('publicationAllowed: true'));
 assert.ok(!candidate.includes('entitlement'));
 assert.ok(!previewRoute.includes('fetch('));
 assert.ok(!previewRoute.includes('externalProvider'));
});

test('DXY private preview mounts first-party consent while Spanish analytics stays disabled',()=>{
 const layout=file('../src/layouts/BaseLayout.astro');
 const consent=file('../src/components/ConsentClient.astro');
 assert.match(layout, /<ConsentClient\s+locale=\{locale\}/);
 assert.match(layout, /Opciones de privacidad/);
 assert.doesNotMatch(layout, /\{analyticsEnabled && \(\s*<ConsentClient/);
 assert.match(layout, /\{analyticsEnabled && <GoogleAnalyticsClient \/>}/);
 assert.match(layout, /\{analyticsEnabled && <TelemetryClient \/>}/);
 assert.match(consent, /SameSite=Lax/);
 assert.match(consent, /id="privacy-consent-accept"/);
 assert.match(consent, /id="privacy-consent-reject"/);
 assert.doesNotMatch(consent, /localStorage|sessionStorage/);
});
