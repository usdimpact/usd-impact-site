import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 2_000;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

function requireIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Expected an ISO edition date (YYYY-MM-DD), received: ${value || '(empty)'}`);
  }
  return value;
}

async function fetchWithRetry(url, {
  fetchImpl,
  attempts,
  retryDelayMs,
}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          accept: 'application/json, application/rss+xml, text/html;q=0.9, */*;q=0.8',
          'cache-control': 'no-cache',
          'user-agent': 'usd-impact-daily-health/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts && retryDelayMs > 0) {
        await sleep(retryDelayMs);
      }
    }
  }

  throw new Error(`Unable to fetch ${url} after ${attempts} attempts: ${lastError?.message ?? 'unknown error'}`);
}

export async function verifyDailyNewsDeployment({
  expectedDate,
  baseUrl = 'https://www.usd-impact.com',
  fetchImpl = globalThis.fetch,
  attempts = DEFAULT_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
} = {}) {
  requireIsoDate(expectedDate);
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.');
  }
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error('attempts must be a positive integer.');
  }

  const origin = trimTrailingSlash(baseUrl);
  const expectedSlug = `/news/${expectedDate}`;
  const latestUrl = `${origin}/news/latest.json`;
  const editionUrl = `${origin}${expectedSlug}/`;
  const feedUrl = `${origin}/news/feed.xml`;

  const latestResponse = await fetchWithRetry(latestUrl, { fetchImpl, attempts, retryDelayMs });
  let latest;
  try {
    latest = await latestResponse.json();
  } catch (error) {
    throw new Error(`Latest edition JSON is invalid: ${error.message}`);
  }

  const edition = latest?.edition;
  if (!edition || typeof edition !== 'object') {
    throw new Error('Latest edition JSON does not contain an edition object.');
  }
  if (edition.date !== expectedDate) {
    throw new Error(`Latest deployed edition is ${edition.date ?? '(missing)'}, expected ${expectedDate}.`);
  }
  if (edition.slug !== expectedSlug) {
    throw new Error(`Latest deployed edition slug is ${edition.slug ?? '(missing)'}, expected ${expectedSlug}.`);
  }
  if (!edition.title || typeof edition.title !== 'string') {
    throw new Error('Latest deployed edition does not contain a title.');
  }

  const editionResponse = await fetchWithRetry(editionUrl, { fetchImpl, attempts, retryDelayMs });
  const editionHtml = await editionResponse.text();
  if (!editionHtml.includes(edition.title)) {
    throw new Error(`Edition page does not contain the deployed title: ${edition.title}`);
  }

  const feedResponse = await fetchWithRetry(feedUrl, { fetchImpl, attempts, retryDelayMs });
  const feedXml = await feedResponse.text();
  if (!feedXml.includes(`${origin}${expectedSlug}/`)) {
    throw new Error(`RSS feed does not contain the expected edition URL: ${origin}${expectedSlug}/`);
  }

  return {
    expectedDate,
    title: edition.title,
    latestUrl,
    editionUrl,
    feedUrl,
  };
}

export function formatDeploymentHealthReport(result, baseUrl = 'https://www.usd-impact.com') {
  const origin = trimTrailingSlash(baseUrl);
  return [
    '',
    '## Deployed edition checks',
    '',
    `- Base URL: ${origin}`,
    `- Expected edition: \`${result.expectedDate}\``,
    `- Latest JSON: [healthy](${result.latestUrl})`,
    `- Edition page: [healthy](${result.editionUrl})`,
    `- RSS feed: [healthy](${result.feedUrl})`,
    `- Published title: ${result.title}`,
  ].join('\n');
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--expected-date') options.expectedDate = argv[++index];
    else if (argument === '--base-url') options.baseUrl = argv[++index];
    else if (argument === '--report') options.reportPath = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.expectedDate) throw new Error('--expected-date is required.');
  if (!options.reportPath) throw new Error('--report is required.');
  return options;
}

async function main() {
  const { expectedDate, baseUrl = 'https://www.usd-impact.com', reportPath } = parseArguments(process.argv.slice(2));

  try {
    const result = await verifyDailyNewsDeployment({ expectedDate, baseUrl });
    const report = formatDeploymentHealthReport(result, baseUrl);
    await appendFile(reportPath, `${report}\n`, 'utf8');
    console.log(report);
  } catch (error) {
    const failure = `\n## Deployed edition checks\n\n- Failure: ${error.message}\n`;
    await appendFile(reportPath, failure, 'utf8');
    console.error(failure);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
