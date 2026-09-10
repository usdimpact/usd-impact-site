import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_CANONICAL_ORIGIN, canonicalUrlForRequest } from '../src/lib/canonical-url.js';
import { SEARCH_UTILITY_PATHS } from '../src/lib/search-utility-policy.js';

const distRoot = path.resolve('dist');
const failures = [];

function outputPath(pathname) {
  const route = pathname.replace(/^\/+|\/+$/g, '');
  return route ? path.join(distRoot, route, 'index.html') : path.join(distRoot, 'index.html');
}

function canonicalHrefs(html) {
  const text = html.replace(/<!--[\s\S]*?-->/g, ' ');
  const head = text.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1] ?? '';
  const clean = head.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  return [...clean.matchAll(/<link\b[^>]*>/gi)].flatMap(([tag]) => {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)]
      .map(([, key, , value]) => [key.toLowerCase(), value]));
    const rel = (attrs.rel ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    return rel.includes('canonical') ? [(attrs.href ?? '').replaceAll('&amp;', '&')] : [];
  });
}

const sitemapPath = path.join(distRoot, 'sitemap-0.xml');
if (!fs.existsSync(sitemapPath)) {
  failures.push('Canonical policy: generated sitemap-0.xml is missing.');
} else {
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const locations = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(([, loc]) => loc.replaceAll('&amp;', '&'));
  if (!locations.length || locations.length !== [...xml.matchAll(/<url>/g)].length) {
    failures.push('Canonical policy: sitemap locations are missing or ambiguous.');
  } else {
    for (const loc of locations) {
      let sourceUrl;
      try { sourceUrl = new URL(loc); }
      catch { failures.push(`Canonical policy: invalid sitemap URL: ${loc}.`); continue; }
      if (sourceUrl.origin !== PUBLIC_CANONICAL_ORIGIN || sourceUrl.search || sourceUrl.hash) {
        failures.push(`Canonical policy: unexpected sitemap URL: ${loc}.`);
        continue;
      }
      const file = outputPath(sourceUrl.pathname);
      if (!fs.existsSync(file)) {
        failures.push(`Canonical policy: generated page is missing for ${sourceUrl.pathname}.`);
        continue;
      }
      const hrefs = canonicalHrefs(fs.readFileSync(file, 'utf8'));
      const expected = canonicalUrlForRequest(sourceUrl);
      if (hrefs.length !== 1 || hrefs[0] !== expected) {
        failures.push(`Canonical policy: ${sourceUrl.pathname} expected one canonical ${expected}, found ${hrefs.length === 1 ? hrefs[0] : hrefs.length}.`);
        continue;
      }
      const canonical = new URL(hrefs[0]);
      if (canonical.origin !== PUBLIC_CANONICAL_ORIGIN || canonical.search || canonical.hash
          || (canonical.pathname !== '/' && /\/$/.test(canonical.pathname))) {
        failures.push(`Canonical policy: invalid canonical form on ${sourceUrl.pathname}.`);
      }
    }
  }
}

const noindexControls = ['/internal/ask-usd-impact', ...SEARCH_UTILITY_PATHS];
for (const route of noindexControls) {
  const file = outputPath(route);
  if (!fs.existsSync(file)) {
    failures.push(`Canonical policy: noindex control HTML missing: ${route}.`);
    continue;
  }
  const hrefs = canonicalHrefs(fs.readFileSync(file, 'utf8'));
  if (hrefs.length !== 0) failures.push(`Canonical policy: noindex control must not emit canonical: ${route}.`);
}

if (failures.length) {
  console.error(`Canonical build verification failed:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`Canonical build verification pass: sitemap pages self-canonical; ${noindexControls.length} noindex controls omit canonicals`);
