import fs from 'node:fs';
import path from 'node:path';
import { resolveScorePipelineOrigin } from '../src/lib/score-pipeline-origin.js';

const root = process.cwd();
const distRoot = path.join(root, 'dist');
const sourceRoot = path.join(root, 'src');
const failures = [];
const scorePipelineOrigin = resolveScorePipelineOrigin(process.env.PUBLIC_SCORE_PIPELINE_ORIGIN);

const walk = (dir, predicate) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
};

const decodeHtmlAttribute = (value) => value
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&#x27;', "'")
  .replaceAll('&amp;', '&');

const parseMetaCsp = (html) => {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((candidate) => /http-equiv=["']content-security-policy["']/i.test(candidate));
  if (!tag) return null;
  const match = tag.match(/content=(["'])([\s\S]*?)\1/i);
  return match ? decodeHtmlAttribute(match[2]) : null;
};

const hasNoindexMeta = (html) => {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((candidate) => /name=["']robots["']/i.test(candidate));
  return Boolean(tag && /content=(["'])[^"']*\bnoindex\b[^"']*\1/i.test(tag));
};

const normalizePath = (value) => {
  const normalized = value.replace(/\/+$/, '');
  return normalized || '/';
};

const isWithinPrefix = (pathname, prefix) => (
  pathname === prefix || pathname.startsWith(`${prefix}/`)
);

if (!fs.existsSync(distRoot)) failures.push('dist/ is missing; CSP output cannot be verified.');

let htmlFiles = [];
if (fs.existsSync(distRoot)) {
  htmlFiles = walk(distRoot, (file) => file.endsWith('.html'));
  if (htmlFiles.length === 0) failures.push('No generated HTML files were found for CSP verification.');
}

let sha384Seen = false;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const csp = parseMetaCsp(html);
  const relative = path.relative(distRoot, file);
  if (!csp) {
    failures.push(`Generated page is missing Astro CSP metadata: ${relative}.`);
    continue;
  }

  for (const required of [
    "default-src 'self'",
    "form-action 'self'",
    "script-src-attr 'none'",
    "style-src-attr 'unsafe-inline'",
    `frame-src 'self' https://challenges.cloudflare.com ${scorePipelineOrigin}`,
    "img-src 'self' data: blob: https:",
  ]) {
    if (!csp.includes(required)) failures.push(`${relative} CSP is missing: ${required}.`);
  }

  if (/script-src(?:-elem)?[^;]*'unsafe-inline'/i.test(csp)) {
    failures.push(`${relative} CSP permits unsafe-inline JavaScript.`);
  }
  if (/sha384-[A-Za-z0-9+/=]+/.test(csp)) sha384Seen = true;
}

if (!sha384Seen) failures.push('No SHA-384 CSP hash was emitted in the generated HTML corpus.');

const astroFiles = walk(sourceRoot, (file) => file.endsWith('.astro'));
for (const file of astroFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const inlineBodies = source.match(/<script\s+is:inline(?![^>]*\bsrc=)[^>]*>/gi) || [];
  if (inlineBodies.length > 0) {
    failures.push(`${path.relative(root, file)} contains an unhashed script is:inline body.`);
  }
}

const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const globalBlock = (vercel.headers || []).find((entry) => entry.source === '/(.*)');
const headers = new Map((globalBlock?.headers || []).map((entry) => [entry.key.toLowerCase(), entry.value]));
const structuralCsp = headers.get('content-security-policy');
if (structuralCsp !== "frame-ancestors 'none'; base-uri 'self'; object-src 'none'") {
  failures.push('Vercel structural CSP must be exactly frame-ancestors/base-uri/object-src and must not duplicate Astro script/style policy.');
}
if (headers.get('x-permitted-cross-domain-policies') !== 'none') {
  failures.push('Vercel global headers must deny cross-domain policy files.');
}

const previewOnlySitemapPrefixes = [
  '/book/read-the-dollar-first/companion',
  '/practice/dxy-vs-broad-usd',
  '/practice/weekly-regime',
  '/go',
];
const printLinks = JSON.parse(fs.readFileSync(
  path.join(sourceRoot, 'data/book-site-bridge/print-links.json'),
  'utf8',
));
const previewOnlyRoutes = [
  '/book/read-the-dollar-first/companion',
  ...Array.from(
    { length: 13 },
    (_, index) => `/book/read-the-dollar-first/companion/chapter/${String(index + 1).padStart(2, '0')}`,
  ),
  '/practice/dxy-vs-broad-usd',
  '/practice/weekly-regime',
  ...printLinks.map((link) => `/go/${link.code}`),
];

for (const route of previewOnlyRoutes) {
  const file = path.join(distRoot, route.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(file)) {
    failures.push(`Preview-only bridge route was not generated: ${route}.`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  if (!hasNoindexMeta(html)) failures.push(`Preview-only bridge route is missing noindex metadata: ${route}.`);
}

const sitemapPath = path.join(distRoot, 'sitemap-0.xml');
if (!fs.existsSync(sitemapPath)) {
  failures.push('Generated sitemap-0.xml is missing; Preview-only route exclusion cannot be verified.');
} else {
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (locations.length === 0) failures.push('Generated sitemap-0.xml contains no locations.');

  for (const location of locations) {
    let pathname;
    try {
      pathname = normalizePath(new URL(location).pathname);
    } catch {
      failures.push(`Generated sitemap contains an invalid URL: ${location}.`);
      continue;
    }

    const excludedPrefix = previewOnlySitemapPrefixes.find((prefix) => isWithinPrefix(pathname, prefix));
    if (excludedPrefix) {
      failures.push(`Preview-only route appears in the generated sitemap: ${pathname} (prefix ${excludedPrefix}).`);
    }
  }
}

if (failures.length > 0) {
  console.error(`CSP and sitemap build verification failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log(`CSP build verification passed across ${htmlFiles.length} generated HTML pages using Score origin ${scorePipelineOrigin}.`);
console.log(`Book-site bridge sitemap exclusion verification passed for ${previewOnlyRoutes.length} generated noindex routes.`);
