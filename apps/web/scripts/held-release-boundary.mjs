// Draft-only security contract for held Spanish and independent Monthly surfaces.
// This checks generated artifacts and exact current source invariants. It is NOT
// authorization to publish, nor a substitute for host authentication or rights review.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SPANISH_PUBLIC_REVIEW_SECTIONS,
  SPANISH_PUBLIC_REVIEW_PATHS,
  spanishPublicReviewEnabled,
  isSpanishPublicReviewPath,
} from '../src/lib/spanish-public-review-policy.js';
import { readGate } from './score-derived-publication-rights-gate.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
export const HELD_SPANISH = Object.freeze(['/es/news','/es/score','/es/reports','/es/video-library']);
export const EXISTING_PUBLIC_SPANISH = Object.freeze([
  '/es', '/es/privacy', '/es/start-here', '/es/dollar-framework',
  '/es/framework/dollar-transmission-chain', '/es/framework/three-dial-dashboard',
]);
const permittedSpanish = new Set([...EXISTING_PUBLIC_SPANISH, ...HELD_SPANISH]);
const monthlyPrefix = '/macro-reviews/monthly';
const heldIndependentWeekly = '/macro-reviews/weekly/2026-10-30';
const isMonthly = (p) => p === monthlyPrefix || p.startsWith(monthlyPrefix + '/');
const trim = (p) => p.replace(/\/+$/, '') || '/';
const exactSha = (sha) => typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha);

function read(relative) {
  return fs.readFileSync(path.join(webRoot, relative), 'utf8');
}

// Check existing source guards, without modifying their implementations.
// No test-only claim can replace live authentication or a public release permit.
export function checkHeldSourceContract() {
  const failures = [];
  if (JSON.stringify(SPANISH_PUBLIC_REVIEW_SECTIONS) !== JSON.stringify(['news','score','reports','video-library'])) {
    failures.push('Spanish review section allowlist changed');
  }
  if (JSON.stringify(SPANISH_PUBLIC_REVIEW_PATHS) !== JSON.stringify(HELD_SPANISH)) {
    failures.push('Spanish review path allowlist changed');
  }
  for (const env of [undefined,'','production','development','Preview','PRODUCTION']) {
    if (spanishPublicReviewEnabled(env)) failures.push('Spanish route generation enabled outside exact preview');
  }
  if (!spanishPublicReviewEnabled('preview')) failures.push('Spanish review preview gating unavailable');
  for (const route of HELD_SPANISH) {
    if (!isSpanishPublicReviewPath(route) || !isSpanishPublicReviewPath(route + '/')) {
      failures.push('Spanish path classifier lost held route: ' + route);
    }
  }
  for (const route of ['/es/not-authorized','/es/news/2026-10-30','/es/reports/monthly',
    '/es/video-library/new-film','/es/start-here','/es/privacy']) {
    if (isSpanishPublicReviewPath(route)) failures.push('Spanish held classifier broadened: ' + route);
  }
  const spanishPage = read('src/pages/es/[section].astro');
  if (!spanishPage.includes('if (!spanishPublicReviewEnabled(process.env.VERCEL_ENV)) return [];')
      || !spanishPage.includes('return SPANISH_PUBLIC_REVIEW_SECTIONS.map')
      || !spanishPage.includes('  noindex')) {
    failures.push('Spanish preview getStaticPaths/noindex source contract changed');
  }
  const monthlyPage = read('src/pages/macro-reviews/monthly/[period]/index.astro');
  if (!monthlyPage.includes("if (process.env.VERCEL_ENV !== 'preview') return [];")
      || !monthlyPage.includes("params: { period: '2026-10' }")
      || !monthlyPage.includes('name="robots" content="noindex,nofollow,noarchive,nosnippet"')
      || !monthlyPage.includes('data-original-score-excluded="true"')
      || !monthlyPage.includes('data-market-price-data-excluded="true"')) {
    failures.push('Independent Monthly preview/rights source contract changed');
  }
  if (fs.existsSync(path.join(webRoot,'src/pages/macro-reviews/monthly/2026-10/index.astro'))) {
    failures.push('Unconditional static Monthly route bypasses Preview gate');
  }
  const config = read('astro.config.mjs');
  if (!config.includes('!isSpanishPublicReviewPath(pathname)')
      || !config.includes("'/macro-reviews/monthly'")
      || !config.includes('!previewOnlySitemapPrefixes.some(')
      || !config.includes("'/macro-reviews/weekly/2026-10-30'")) {
    failures.push('Sitemap exclusion for held Spanish/Monthly/Weekly is missing');
  }
  const rights = JSON.parse(read('scripts/score-rights-consumer-manifest.json'));
  if (rights.state !== 'hold' || rights.production_change_authorized !== false
      || rights.weekly_report_publication_hold_required !== true
      || rights.manual_monthly_publication_requires_rights_review !== true
      || rights.historical_content_treatment_unresolved !== true) {
    failures.push('Existing Score-derived rights HOLD was relaxed or misclassified');
  }
  if (readGate().hold !== true) failures.push('Original Score rights gate is no longer fail-closed');
  const vercel = JSON.parse(read('vercel.json'));
  if (vercel.git?.deploymentEnabled?.['agent/*'] !== false) {
    failures.push('QA agent/* branch deployment exemption changed');
  }
  return failures;
}

function attributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([a-z][\w:-]*)\s*=\s*(["'])(.*?)\2/gi)) {
    attrs[match[1].toLowerCase()] = match[3];
  }
  return attrs;
}
function noindex(html, crawler) {
  return [...String(html).matchAll(/<meta\b[^>]*>/gi)].some(([tag]) => {
    const a = attributes(tag);
    return a.name?.toLowerCase() === crawler
      && String(a.content || '').toLowerCase().split(/[,\s]+/).includes('noindex');
  });
}
function canonical(html) {
  return [...String(html).matchAll(/<link\b[^>]*>/gi)].some(([tag]) => {
    const a = attributes(tag);
    return (a.rel || '').toLowerCase().split(/\s+/).includes('canonical');
  });
}
export function assessGeneratedArtifacts({ mode, pages, sitemaps }) {
  const failures = [];
  if (!['production','preview'].includes(mode)) return ['Unknown built-artifact mode (fail closed)'];
  if (!pages || typeof pages !== 'object' || Array.isArray(pages)) {
    return ['Missing built route inventory'];
  }
  if (!Array.isArray(sitemaps) || !sitemaps.length) {
    return ['Missing generated sitemap evidence'];
  }
  const seen = new Set();
  for (const [rawRoute, html] of Object.entries(pages)) {
    const route = trim(rawRoute);
    if (!rawRoute.startsWith('/') || rawRoute.includes('?') || rawRoute.includes('#')
      || seen.has(route)) {
      failures.push('Malformed or duplicate generated route: ' + rawRoute);
      continue;
    }
    seen.add(route);
    if (route === '/es' || route.startsWith('/es/')) {
      if (!permittedSpanish.has(route)) failures.push('Unknown Spanish generated route: ' + route);
      if (mode === 'production' && HELD_SPANISH.includes(route)) {
        failures.push('Held Spanish route generated in Production: ' + route);
      }
      if (mode === 'preview' && HELD_SPANISH.includes(route)) {
        if (!noindex(html, 'robots')) failures.push('Spanish review missing robots noindex: ' + route);
        if (canonical(html)) failures.push('Spanish review has public canonical: ' + route);
      }
    }
    if (isMonthly(route)) {
      if (mode !== 'preview') failures.push('Independent Monthly generated in Production: ' + route);
      if (route !== '/macro-reviews/monthly/2026-10') {
        failures.push('Unapproved independent Monthly period generated: ' + route);
      }
      if (!noindex(html, 'robots') || !noindex(html, 'googlebot') || canonical(html)) {
        failures.push('Independent Monthly missing strict Preview noindex/no-canonical: ' + route);
      }
    }
  }
  for (const xml of sitemaps) {
    for (const found of String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
      let pathname;
      try { pathname = trim(new URL(found[1].replaceAll('&amp;', '&')).pathname); }
      catch { failures.push('Invalid sitemap location'); continue; }
      if (HELD_SPANISH.includes(pathname) || isMonthly(pathname)
          || pathname === heldIndependentWeekly) {
        failures.push('Held/noindex-only route leaked into sitemap: ' + pathname);
      }
    }
  }
  return failures;
}

function collectHtml(base, subdirectory) {
  const dir = path.join(base, subdirectory);
  const pages = {};
  if (!fs.existsSync(dir)) return pages;
  function recurse(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) recurse(file);
      else if (entry.isFile() && file.endsWith('.html')) {
        const relative = path.relative(base, file).split(path.sep).join('/');
        let route = '/' + relative.replace(/(?:\/index)?\.html$/, '');
        route = trim(route);
        if (Object.hasOwn(pages,route)) throw Error('Duplicate generated HTML route: ' + route);
        pages[route] = fs.readFileSync(file,'utf8');
      }
    }
  }
  recurse(dir);
  return pages;
}
export function checkBuiltOutput(mode, root=path.join(webRoot,'dist')) {
  if (!fs.existsSync(root)) return ['Missing built output directory'];
  const pages = {
    ...collectHtml(root,'es'),
    ...collectHtml(root,'macro-reviews/monthly'),
  };
  const sitemaps = fs.readdirSync(root)
    .filter(name => /^sitemap(?:-[\w-]+)?\.xml$/.test(name))
    .map(name => fs.readFileSync(path.join(root,name),'utf8'));
  return assessGeneratedArtifacts({ mode, pages, sitemaps });
}

// Deliberately returns HOLD for ALL new held surfaces, regardless of self-reported
// approvals. A future exact-SHA, externally authorized release changes this contract
// only in a separate, explicitly approved PR. This is not a signature verifier.
export function assessPublicReleaseClaim(claim={}) {
  const blockers = [];
  if (!exactSha(claim.candidateSha) || !exactSha(claim.checkedOutSha)) {
    blockers.push('invalid_exact_commit_sha');
  } else if (claim.candidateSha !== claim.checkedOutSha) {
    blockers.push('candidate_and_verified_commit_mismatch');
  }
  if (claim.target !== 'production') blockers.push('not_an_explicit_production_release');
  const requested = Array.isArray(claim.routes) ? claim.routes : [];
  if (!requested.length) blockers.push('missing_exact_requested_routes');
  for (const route of requested) {
    if (typeof route !== 'string' || !route.startsWith('/')) {
      blockers.push('invalid_release_route');
    } else if (HELD_SPANISH.includes(trim(route)) || isMonthly(trim(route))) {
      blockers.push('H15_H16_public_release_hold');
      if (trim(route) === '/es/reports') blockers.push('score_derived_reports_rights_hold');
    } else blockers.push('unreviewed_public_release_route');
  }
  for (const area of ['owner','editorial','rights','accessibility','security','protectedPreview']) {
    const receipt=claim.receipts?.[area];
    if (receipt?.approved !== true || !exactSha(receipt.sha)
        || receipt.sha !== claim.candidateSha) blockers.push('missing_exact_sha_' + area);
  }
  // Owner text or CI can never silently set an authorization flag for held content.
  return { authorized: false, disposition: 'HOLD', blockers: [...new Set(blockers)] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = checkHeldSourceContract();
  const index = process.argv.indexOf('--built');
  if (index !== -1) {
    const mode = process.argv[index+1];
    if (process.env.VERCEL_ENV !== mode) failures.push('VERCEL_ENV does not match tested build mode');
    failures.push(...checkBuiltOutput(mode));
  }
  if (failures.length) {
    console.error('Release-boundary HOLD guard FAIL:\n- ' + failures.join('\n- '));
    process.exitCode = 1;
  } else {
    console.log('Release-boundary HOLD source and' + (index >= 0 ? ' ' + process.argv[index+1] + ' build' : ' policy') + ' checks PASS; no public-release authorization granted');
  }
}
