import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, '..');
const config = JSON.parse(readFileSync(resolve(appRoot, 'vercel.json'), 'utf8'));

const reconciliationPath = '/api/commerce-reconciliation';
const reconciliationJobs = (config.crons || []).filter((job) => job.path === reconciliationPath);

assert.equal(
  reconciliationJobs.length,
  1,
  'Production commerce reconciliation must have exactly one Vercel cron entry.',
);
assert.deepEqual(
  reconciliationJobs[0],
  { path: reconciliationPath, schedule: '0 5 * * *' },
  'Commerce reconciliation must run once daily at 05:00 UTC.',
);

const reconciliationRewrite = (config.rewrites || [])
  .find((rewrite) => rewrite.source === reconciliationPath);
assert.deepEqual(
  reconciliationRewrite,
  {
    source: reconciliationPath,
    destination: '/api/commerce?action=reconcile',
  },
  'The scheduled path must resolve only to the guarded commerce reconciliation action.',
);

const reconciliationHeaderRule = (config.headers || [])
  .find((rule) => rule.source === reconciliationPath);
assert.ok(reconciliationHeaderRule, 'Commerce reconciliation must have an explicit private header rule.');

const reconciliationHeaders = Object.fromEntries(
  reconciliationHeaderRule.headers.map(({ key, value }) => [key.toLowerCase(), value]),
);
assert.equal(
  reconciliationHeaders['cache-control'],
  'private, no-store',
  'Commerce reconciliation responses must not be cached.',
);
assert.equal(
  reconciliationHeaders['x-robots-tag'],
  'noindex, nofollow',
  'Commerce reconciliation must remain outside search indexing.',
);
assert.equal(
  reconciliationHeaders['referrer-policy'],
  'no-referrer',
  'Commerce reconciliation must not disclose request context through referrers.',
);

console.log('Commerce reconciliation scheduler contract passed.');
