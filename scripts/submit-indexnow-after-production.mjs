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

async function main() {
  const changed = process.argv.slice(2);
  if (!changed.length) {
    console.log('No changed publication files; skipping IndexNow.');
    return;
  }

  const urls = [...new Set(changed.map(toIndexNowUrl).filter(Boolean))].slice(0, 100);
  if (!urls.length) {
    console.log('No supported public publication routes changed; skipping IndexNow.');
    return;
  }

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: 'www.usd-impact.com',
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  });

  if (![200, 202].includes(response.status)) {
    const body = await response.text();
    throw new Error(`IndexNow rejected submission: HTTP ${response.status} ${body.slice(0, 500)}`);
  }

  console.log(`IndexNow accepted ${urls.length} deterministic publication URL(s) with HTTP ${response.status}.`);
}

await main();
