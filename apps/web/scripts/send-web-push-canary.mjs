import { runWebPushOwnerCanary } from '../src/lib/web-push-canary.js';

try {
  const result = await runWebPushOwnerCanary();
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error?.message || 'Web Push owner canary failed.'}\n`);
  process.exitCode = 1;
}
