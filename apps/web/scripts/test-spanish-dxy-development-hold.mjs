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
const expectedBody='78cf51a6333b33c603359805be42fd8212188ad8';
const yaml=candidate.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
test('canonical English DXY article is unchanged and matches owner-accepted private source',()=>{
 assert.equal(sha(english),expectedEnglish);
});
test('Spanish Development candidate preserves the exact owner-approved scoped body correction',()=>{
 assert.ok(yaml,'Required YAML frontmatter/body missing');
 assert.equal(sha(yaml[2]),expectedBody,'Spanish body differs from exact owner-approved corrected body');
 assert.match(yaml[1],/^slug: "\/es\/dxy\/dxy-vs-broad-usd"$/m);
 assert.match(yaml[1],/^status: "review"$/m);
 assert.match(yaml[1],/^readingLevel: "/m);
 assert.match(yaml[1],/^complianceNote: "/m);
 assert.doesNotMatch(yaml[1],/^status: "published"$/m);
 assert.doesNotMatch(candidate,/NO PUBLICAR, NO INDEXAR|Estado de esta traducción:/);
});
test('hypothetical index-point example uses exactly the owner-approved wording',()=>{
 assert.match(yaml[2],/Supongamos que el DXY sube de 100 a 102 mientras Broad USD se mantiene cerca de 100\./);
 assert.ok(yaml[2].includes("En este ejemplo hipotético, el DXY sube dos puntos, pero eso no demuestra que el dólar se haya fortalecido en la misma magnitud frente a un conjunto más amplio de divisas ponderado por el comercio."));
 assert.ok(!yaml[2].includes("La subida del DXY es real, pero no demuestra que el dólar se haya fortalecido en la misma magnitud frente a un conjunto más amplio de divisas ponderado por el comercio."));
 assert.match(yaml[2],/Supongamos ahora que el DXY se mantiene cerca de 100 mientras Broad USD sube de 100 a 103\./);
});
test('all source references, original English quiz links and disclaimer are preserved',()=>{
 assert.match(candidate,/Federal Reserve — H\.10/);
 assert.match(candidate,/ICE — U\.S\. Dollar Index/);
 assert.match(candidate,/Puntuación mínima para aprobar: \*\*8 de 10\*\*/);
 assert.match(candidate,/\/dxy\/dxy-vs-broad-usd\/quiz/);
 assert.match(candidate,/No constituye asesoramiento de inversión/);
 assert.match(candidate,/Las relaciones entre índices son condicionales/);
});
test('owner-approved Spanish title and descriptive metadata remain exact',()=>{
 const metadata=(key)=>yaml[1].split('\n').find((line)=>line.startsWith(key+': '))?.slice(key.length+2);
 assert.equal(metadata('title'),JSON.stringify('DXY frente al dólar amplio: ¿qué señal del dólar importa?'));
 assert.equal(metadata('metaTitle'),JSON.stringify('DXY frente al dólar amplio | USD Impact'));
 assert.equal(metadata('metaDescription'),JSON.stringify('Aprende a comparar DXY con el índice amplio del dólar de la Reserva Federal, identificar divergencias y evitar conclusiones demasiado generales.'));
 assert.equal(metadata('hero'),JSON.stringify('El DXY es una referencia visible del dólar, mientras el índice amplio de la Reserva Federal cubre más divisas ponderadas por comercio. La coincidencia refuerza la señal; la divergencia muestra dónde se concentra.'));
 assert.equal(metadata('ctaPrimaryHref'),JSON.stringify('/dxy/dxy-vs-broad-usd/quiz'));
 assert.equal(metadata('ctaSecondaryHref'),JSON.stringify('/dxy/what-is-dxy'));
 assert.match(yaml[1],/^status: "review"$/m);
});

test('Quiz 5 is an internal English learning link, not an official institutional source',()=>{
 const sources=yaml[1].match(/^sources:\n((?:  - "[^\n]+"\n)+)/m);
 assert.ok(sources,'Official source list absent');
 const names=[...sources[1].matchAll(/^  - "([^"]+)"$/gm)].map((m)=>m[1]);
 assert.deepEqual(names,[
   'Federal Reserve — H.10 Foreign Exchange Rates and Dollar Indexes',
   'Federal Reserve — Revisions to the Federal Reserve Dollar Indexes',
   'ICE — U.S. Dollar Index methodology and composition',
 ]);
 assert.doesNotMatch(sources[1],/USD Impact Quiz|Quiz 5/);
 assert.match(yaml[1],/^internalLinks:\n(?:  - "[^\n]+"\n)+/m);
 assert.match(yaml[1],/^  - "\/dxy\/dxy-vs-broad-usd\/quiz"$/m);
 assert.match(previewRoute,/Recurso didáctico interno/);
 assert.match(previewRoute,/no es una fuente oficial/);
 assert.match(previewRoute,/entry\.data\.ctaPrimaryHref/);
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

test('private QA links to three official source pages without asserting reuse permission',()=>{
 const urls=[
  'https://www.federalreserve.gov/releases/h10/current/',
  'https://www.federalreserve.gov/econres/notes/feds-notes/revisions-to-the-federal-reserve-dollar-indexes-20190115.html',
  'https://www.ice.com/forex/usdx',
 ];
 for(const url of urls) assert.ok(previewRoute.includes(url),'Missing official reference: '+url);
 assert.match(previewRoute,/entry\.data\.sources\.map/);
 assert.match(previewRoute,/href=\{institutionalSourceUrl\[source\]\}/);
 assert.match(previewRoute,/target="_blank" rel="noopener noreferrer"/);
 assert.match(previewRoute,/Private DXY source URL mapping missing/);
 assert.match(previewRoute,/no reproducir materiales reservados de ICE/);
});

test('private QA explains English Quiz 5 entitlement redirect without changing access',()=>{
 assert.match(previewRoute,/El acceso al cuestionario depende del progreso/);
 assert.match(previewRoute,/Si está bloqueado, el sitio redirige a la lección pendiente/);
 assert.match(previewRoute,/entry\.data\.ctaPrimaryHref/);
 assert.doesNotMatch(previewRoute,/QUIZ_PROGRESS_SECRET|readQuizEntitlement|Response\.redirect/);
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
