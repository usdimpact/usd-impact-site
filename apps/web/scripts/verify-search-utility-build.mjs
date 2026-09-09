import fs from 'node:fs';
import path from 'node:path';
import { SEARCH_UTILITY_PATHS, isSearchUtilityPath } from '../src/lib/search-utility-policy.js';

export const PUBLIC_DISCOVERY_CONTROLS = Object.freeze([
  '/', '/learn', '/news', '/score', '/score/methodology', '/reports',
  '/book/read-the-dollar-first', '/book/read-the-dollar-first/preview',
  '/audiobook/read-the-dollar-first', '/video-library', '/research',
  '/research/sample', '/research/evidence-map', '/research/independent-replication',
  '/learn/real-yield', '/learn/dxy-vs-broad-usd-what-each-index-answers',
]);

// Extract the fixed Astro sitemap output contract, not arbitrary external XML.
export function sitemapPathSet(xml) {
  const text = xml.replace(/<!--[\s\S]*?-->/g, '');
  if (/<!DOCTYPE|<!\[CDATA\[/i.test(text) || !/<urlset\b/.test(text)
      || !/<\/urlset>\s*$/.test(text)) throw new Error('Unexpected sitemap format.');
  const locations = [...text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)];
  if (!locations.length || locations.length !== [...text.matchAll(/<url>/g)].length) {
    throw new Error('Missing or ambiguous sitemap locations.');
  }
  return new Set(locations.map(([, loc]) => {
    const url = new URL(loc.replaceAll('&amp;', '&'));
    if (url.origin !== 'https://www.usd-impact.com' || url.username || url.password) {
      throw new Error('Unexpected sitemap origin.');
    }
    return url.pathname.replace(/\/+$/, '') || '/';
  }));
}

export function robotsValues(html) {
  const text = html.replace(/<!--[\s\S]*?-->/g, '');
  const head = text.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1] ?? '';
  const clean = head.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  return [...clean.matchAll(/<meta\b[^>]*>/gi)].flatMap(([tag]) => {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)]
      .map(([, key, , value]) => [key.toLowerCase(), value.toLowerCase()]));
    return attrs.name === 'robots' ? [attrs.content ?? ''] : [];
  });
}

export function verifySearchUtilityBuild(distRoot, readText = (rel) => fs.readFileSync(path.join(distRoot, rel), 'utf8')) {
  const failures = [];
  let paths;
  try { paths = sitemapPathSet(readText('sitemap-0.xml')); }
  catch { failures.push('Search utility policy: sitemap could not be validated.'); }
  if (paths) {
    for (const route of paths) {
      if (isSearchUtilityPath(route)) failures.push(`Search utility appears in sitemap: ${route}.`);
    }
    for (const route of PUBLIC_DISCOVERY_CONTROLS) {
      if (!paths.has(route)) failures.push(`Public discovery control missing from sitemap: ${route}.`);
    }
  }
  for (const route of SEARCH_UTILITY_PATHS) {
    try {
      const values = robotsValues(readText(`${route.slice(1)}/index.html`));
      const tokens = (values[0] ?? '').split(/[\s,]+/).filter(Boolean).sort();
      if (values.length !== 1 || tokens.join(',') !== 'nofollow,noindex') {
        failures.push(`Search utility needs one noindex, nofollow head directive: ${route}.`);
      }
    } catch { failures.push(`Search utility HTML missing: ${route}.`); }
  }
  for (const route of ['/', '/learn/real-yield', '/learn/dxy-vs-broad-usd-what-each-index-answers']) {
    try {
      const rel = route === '/' ? 'index.html' : `${route.slice(1)}/index.html`;
      if (robotsValues(readText(rel)).some((value) => /\b(noindex|none)\b/.test(value))) {
        failures.push(`Public learning control unexpectedly noindex: ${route}.`);
      }
    } catch { failures.push(`Public learning control HTML missing: ${route}.`); }
  }
  return failures;
}
