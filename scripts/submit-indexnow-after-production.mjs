import fs from 'node:fs/promises';
import path from 'node:path';

const SITE_ORIGIN = 'https://www.usd-impact.com';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const INDEXNOW_KEY = 'usdimpact-indexnow-20261007-9f3c7e2a6b14d580';
const CONTENT_ROOT = 'apps/web/src/content';

function toUrl(file) {
  const rel = file.replace(/^apps\/web\/src\/content\//, '');
  const ext = path.extname(rel);
  const stem = rel.slice(0, -ext.length);

  if (stem.startsWith('news/')) {
    return `${SITE_ORIGIN}/news/${stem.slice('news/'.length)}`;
  }
  if (stem.startsWith('catalyst-briefs/')) {
    return `${SITE_ORIGIN}/news/catalysts/${stem.slice('catalyst-briefs/'.length)}`;
  }
  if (stem.startsWith('weekly-reports/')) {
    return `${SITE_ORIGIN}/reports/weekly/${stem.slice('weekly-reports/'.length)}`;
  }
  if (stem.startsWith('monthly-reports/')) {
    return `${SITE_ORIGIN}/reports/monthly/${stem.slice('monthly-reports/'.length)}`;
  }
  return null;
}

async function publishedPageUrl(file) {
  const text = await fs.readFile(file, 'utf8');
  const slugMatch = text.match(/^slug:\s*['"]?([^'"\n]+)['"]?\s*$/m);
  const statusMatch = text.match(/^status:\s*['"]?([^'"\n]+)['"]?\s*$/m);
  if (statusMatch?.[1]?.trim() !== 'published' || !slugMatch?.[1]) return null;
  const slug = slugMatch[1].trim().replace(/^\//, '').replace(/\/$/, '');
  return `${SITE_ORIGIN}/${slug}`;
}

async function main() {
  const changed = process.argv.slice(2);
  if (!changed.length) {
    console.log('No changed files; skipping IndexNow.');
    return;
  }

  const urls = new Set();
  for (const file of changed) {
    if (!file.startsWith(CONTENT_ROOT + '/')) continue;

    if (file.startsWith(CONTENT_ROOT + '/pages/') ||
        file.startsWith(CONTENT_ROOT + '/products/') ||
        file.startsWith(CONTENT_ROOT + '/frameworks/') ||
        file.startsWith(CONTENT_ROOT + '/lead-magnets/') ||
        file.startsWith(CONTENT_ROOT + '/benchmark-modules/')) {
      try {
        const url = await publishedPageUrl(file);
        if (url) urls.add(url);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      continue;
    }

    const url = toUrl(file);
    if (url) urls.add(url);
  }

  if (!urls.size) {
    console.log('No public SEO URLs changed; skipping IndexNow.');
    return;
  }

  const ready = [];
  for (const url of urls) {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (response.ok) ready.push(url);
    else console.log(`Skipping non-live URL ${url}: HTTP ${response.status}`);
  }

  if (!ready.length) {
    console.log('No changed URLs are live yet; skipping IndexNow.');
    return;
  }

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: 'www.usd-impact.com',
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
      urlList: ready.slice(0, 100),
    }),
  });

  if (![200, 202].includes(response.status)) {
    const body = await response.text();
    throw new Error(`IndexNow rejected submission: HTTP ${response.status} ${body.slice(0, 500)}`);
  }

  console.log(`IndexNow accepted ${ready.length} URL(s) with HTTP ${response.status}.`);
}

await main();
