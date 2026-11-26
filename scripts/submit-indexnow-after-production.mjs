import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalystFirstPublicationIssue } from '../apps/web/src/lib/catalyst-first-publication-policy.js';

const SITE_ORIGIN = 'https://www.usd-impact.com';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const INDEXNOW_KEY = 'usdimpact-indexnow-20261007-9f3c7e2a6b14d580';

const ROUTES = Object.freeze([
  {
    pattern: /^apps\/web\/src\/content\/news\/(\d{4}-\d{2}-\d{2})\.md$/,
    pathname: (match) => `/news/${match[1]}`,
  },
  {
    pattern: /^apps\/web\/src\/content\/catalyst-briefs\/([a-z0-9-]+)\.md$/,
    pathname: (match) => `/news/catalysts/${match[1]}`,
  },
  {
    pattern: /^apps\/web\/src\/content\/weekly-reports\/(\d{4}-\d{2}-\d{2})\.md$/,
    pathname: (match) => `/reports/weekly/${match[1]}`,
  },
  {
    pattern: /^apps\/web\/src\/content\/monthly-reports\/(\d{4}-\d{2}-\d{2})\.md$/,
    pathname: (match) => `/reports/monthly/${match[1]}`,
  },
]);

function toIndexNowUrl(file) {
  for (const route of ROUTES) {
    const match = route.pattern.exec(file);
    if (!match) continue;
    const url = new URL(route.pathname(match), SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN) throw new Error('Refusing off-origin IndexNow URL');
    return url.href.replace(/\/$/, '');
  }
  return null;
}

// Resolve only Git-changed, supported paths from the checked-out deployment tree.
const readDeployedSource = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');

// Fail closed when frontmatter is missing, duplicated or non-scalar.
// Top-level-only keys avoid mistaking nested source status for publication state.
function publicationMetadata(raw) {
  if (typeof raw !== 'string') return null;
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const result = {};
  for (const name of ['status', 'slug', 'firstPublishedDate', 'eventKey', 'eventDate', 'phase', 'generatedAt', 'lastReviewed']) {
    const matches = [...match[1].matchAll(new RegExp('^' + name + ':[ \\t]*([^\\r\\n]*)$', 'gm'))];
    if (matches.length > 1) return null;
    if (!matches.length) continue;
    let value = matches[0][1].trim();
    const quoted = (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    else if (value.startsWith('"') || value.startsWith("'") || value.includes(' #')) return null;
    result[name] = value;
  }
  return result;
}

// Keep the fixed 15-record legacy exception from the site publication policy.
// Newly published Catalyst briefs require a real, reviewed firstPublishedDate.
function eligiblePublication(file, url, metadata) {
  if (!metadata || metadata.status !== 'published') return false;
  if (metadata.slug && metadata.slug !== new URL(url).pathname) return false;
  if (file.startsWith('apps/web/src/content/catalyst-briefs/')) {
    if (metadata.slug !== new URL(url).pathname) return false;
    return catalystFirstPublicationIssue(metadata) === null;
  }
  return true;
}

export async function selectIndexNowUrls(changed, { readSource = readDeployedSource } = {}) {
  const urls = [];
  const seen = new Set();
  for (const file of changed) {
    const url = toIndexNowUrl(file);
    if (!url || seen.has(url)) continue;
    let raw;
    try {
      raw = await readSource(file);
    } catch {
      // Deleted/unreadable files must not become a public notification.
      continue;
    }
    if (!eligiblePublication(file, url, publicationMetadata(raw))) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= 100) break;
  }
  return urls;
}

export async function notifyChangedPublicationUrls(changed, { readSource = readDeployedSource, send = fetch } = {}) {
  if (!changed.length) {
    console.log('No changed publication files; skipping IndexNow.');
    return 0;
  }
  const urls = await selectIndexNowUrls(changed, { readSource });
  if (!urls.length) {
    console.log('No supported public publication routes changed; skipping IndexNow.');
    return 0;
  }

  const response = await send(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: 'www.usd-impact.com',
      key: INDEXNOW_KEY,
      keyLocation: SITE_ORIGIN + '/' + INDEXNOW_KEY + '.txt',
      urlList: urls,
    }),
  });
  if (![200, 202].includes(response.status)) {
    const body = await response.text();
    throw new Error('IndexNow rejected submission: HTTP ' + response.status + ' ' + body.slice(0, 500));
  }
  console.log('IndexNow accepted ' + urls.length + ' deterministic publication URL(s) with HTTP ' + response.status + '.');
  return urls.length;
}

// Importing this module for isolated fixtures never sends network requests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await notifyChangedPublicationUrls(process.argv.slice(2));
}
