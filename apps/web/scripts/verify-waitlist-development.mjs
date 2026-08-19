import { pathToFileURL } from 'node:url';
import {
  WaitlistDevelopmentVerificationError,
  verifyWaitlistDevelopmentLifecycle,
} from '../src/lib/waitlist-development-verifier.js';

function requireEnvironmentValue(environment, name) {
  const value = String(environment[name] ?? '').trim();
  if (!value) {
    throw new WaitlistDevelopmentVerificationError(
      `${name} is required for Development lifecycle verification.`,
      'VERIFIER_INPUT_MISSING',
    );
  }
  return value;
}

export async function runWaitlistDevelopmentVerification({
  environment = process.env,
  fetchImpl = fetch,
  write = (value) => process.stdout.write(`${value}\n`),
} = {}) {
  const result = await verifyWaitlistDevelopmentLifecycle({
    email: requireEnvironmentValue(environment, 'WAITLIST_TEST_EMAIL'),
    submissionId: requireEnvironmentValue(environment, 'WAITLIST_TEST_SUBMISSION_ID'),
    expectedState: String(environment.WAITLIST_EXPECTED_STATE || 'delivered'),
    environment,
    fetchImpl,
  });

  write(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  try {
    await runWaitlistDevelopmentVerification();
  } catch (error) {
    const code = typeof error?.code === 'string'
      ? error.code
      : 'WAITLIST_DEVELOPMENT_VERIFICATION_FAILED';
    const message = error instanceof Error
      ? error.message
      : 'Waitlist Development verification failed.';

    process.stderr.write(`${JSON.stringify({ verified: false, code, message }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (entrypoint === import.meta.url) {
  await main();
}
