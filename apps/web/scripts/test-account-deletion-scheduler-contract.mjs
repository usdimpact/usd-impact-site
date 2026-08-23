import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, '..');
const config = JSON.parse(readFileSync(resolve(appRoot, 'vercel.json'), 'utf8'));

const finalizerPath = '/api/account-deletion-finalizer';
const finalizerJobs = (config.crons || []).filter((job) => job.path === finalizerPath);

assert.equal(
  finalizerJobs.length,
  1,
  'Production account-deletion finalizer must have exactly one Vercel cron entry.',
);
assert.deepEqual(
  finalizerJobs[0],
  { path: finalizerPath, schedule: '20 4 * * *' },
  'Account-deletion finalizer must run once daily at 04:20 UTC.',
);

const finalizerRewrite = (config.rewrites || []).find((rewrite) => rewrite.source === finalizerPath);
assert.deepEqual(
  finalizerRewrite,
  {
    source: finalizerPath,
    destination: '/api/account?action=deletion-finalizer',
  },
  'The scheduled path must resolve only to the guarded deletion-finalizer action.',
);

console.log('Account-deletion scheduler contract passed.');
