import { pathToFileURL } from 'node:url';
import { createWaitlistUnsubscribeUrl } from '../src/lib/waitlist-unsubscribe.js';

function requireEnvironmentValue(environment, name) {
  const value = String(environment[name] ?? '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function generateWaitlistUnsubscribeLink(environment = process.env) {
  return createWaitlistUnsubscribeUrl({
    email: requireEnvironmentValue(environment, 'WAITLIST_TEST_EMAIL'),
    submissionId: requireEnvironmentValue(environment, 'WAITLIST_TEST_SUBMISSION_ID'),
    secret: requireEnvironmentValue(environment, 'WAITLIST_UNSUBSCRIBE_SECRET'),
    baseUrl: requireEnvironmentValue(environment, 'WAITLIST_UNSUBSCRIBE_BASE_URL'),
  });
}

async function main() {
  try {
    const url = generateWaitlistUnsubscribeLink();
    process.stdout.write(`${JSON.stringify({ url }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : 'Unsubscribe link generation failed.',
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (entrypoint === import.meta.url) await main();
