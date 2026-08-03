import { validatePaddleDeploymentConfig } from '../src/lib/paddle-deployment-config.js';

try {
  const result = validatePaddleDeploymentConfig();
  if (result.skipped) {
    console.log('Paddle deployment configuration check skipped outside Vercel Preview/Production.');
  } else {
    console.log(`Paddle ${result.vercelEnvironment} deployment configuration passed.`);
  }
} catch (error) {
  console.error(`Paddle deployment configuration failed: ${error.message}`);
  process.exitCode = 1;
}
