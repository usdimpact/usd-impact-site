import assert from 'node:assert/strict';
import {
  isPaddleCheckoutEnabled,
  validatePaddleDeploymentConfig,
} from '../src/lib/paddle-deployment-config.js';

const price = (character) => `pri_${character.repeat(26)}`;
const apiKey = (mode) => `pdl_${mode}_apikey_${'a'.repeat(26)}_${'B'.repeat(22)}_${'C'.repeat(3)}`;
const clientToken = (mode) => `${mode}_${'D'.repeat(27)}`;
const base = {
  PADDLE_LAUNCH_PRICE_ID: price('a'),
  PADDLE_STANDARD_PRICE_ID: price('b'),
  PADDLE_WEBHOOK_SECRET: 'notification-secret-with-safe-test-length',
};

assert.equal(isPaddleCheckoutEnabled({}), false);
assert.equal(isPaddleCheckoutEnabled({ PADDLE_CHECKOUT_ENABLED: 'false' }), false);
assert.equal(isPaddleCheckoutEnabled({ PADDLE_CHECKOUT_ENABLED: 'TRUE' }), true);

assert.deepEqual(validatePaddleDeploymentConfig({}), {
  skipped: true,
  vercelEnvironment: 'local',
});

assert.deepEqual(validatePaddleDeploymentConfig({
  ...base,
  VERCEL_ENV: 'preview',
  PADDLE_ENVIRONMENT: 'sandbox',
  PADDLE_API_KEY: apiKey('sdbx'),
  PUBLIC_PADDLE_CLIENT_TOKEN: clientToken('test'),
}), {
  skipped: false,
  vercelEnvironment: 'preview',
  paddleEnvironment: 'sandbox',
  checkoutUrlConfigured: false,
  checkoutEnabled: false,
});

assert.deepEqual(validatePaddleDeploymentConfig({
  ...base,
  VERCEL_ENV: 'production',
  PADDLE_ENVIRONMENT: 'production',
  PADDLE_API_KEY: apiKey('live'),
  PUBLIC_PADDLE_CLIENT_TOKEN: clientToken('live'),
  PADDLE_CHECKOUT_URL: 'https://www.usd-impact.com/checkout/',
}), {
  skipped: false,
  vercelEnvironment: 'production',
  paddleEnvironment: 'production',
  checkoutUrlConfigured: true,
  checkoutEnabled: false,
});

assert.deepEqual(validatePaddleDeploymentConfig({
  ...base,
  VERCEL_ENV: 'production',
  PADDLE_ENVIRONMENT: 'production',
  PADDLE_API_KEY: apiKey('live'),
  PUBLIC_PADDLE_CLIENT_TOKEN: clientToken('live'),
  PADDLE_CHECKOUT_URL: 'https://www.usd-impact.com/checkout/',
  PADDLE_CHECKOUT_ENABLED: 'true',
}), {
  skipped: false,
  vercelEnvironment: 'production',
  paddleEnvironment: 'production',
  checkoutUrlConfigured: true,
  checkoutEnabled: true,
});

assert.throws(() => validatePaddleDeploymentConfig({
  ...base,
  VERCEL_ENV: 'production',
  PADDLE_ENVIRONMENT: 'production',
  PADDLE_API_KEY: apiKey('sdbx'),
  PUBLIC_PADDLE_CLIENT_TOKEN: clientToken('live'),
  PADDLE_CHECKOUT_URL: 'https://www.usd-impact.com/checkout/',
}), /production Paddle credential/);

assert.throws(() => validatePaddleDeploymentConfig({
  ...base,
  VERCEL_ENV: 'production',
  PADDLE_ENVIRONMENT: 'production',
  PADDLE_API_KEY: apiKey('live'),
  PUBLIC_PADDLE_CLIENT_TOKEN: clientToken('test'),
  PADDLE_CHECKOUT_URL: 'https://www.usd-impact.com/checkout/',
}), /production Paddle credential/);

assert.throws(() => validatePaddleDeploymentConfig({
  ...base,
  VERCEL_ENV: 'production',
  PADDLE_ENVIRONMENT: 'production',
  PADDLE_API_KEY: apiKey('live'),
  PUBLIC_PADDLE_CLIENT_TOKEN: clientToken('live'),
  PADDLE_CHECKOUT_URL: 'https://example.com/checkout/',
}), /PADDLE_CHECKOUT_URL/);

assert.throws(() => validatePaddleDeploymentConfig({
  ...base,
  VERCEL_ENV: 'preview',
  PADDLE_ENVIRONMENT: 'production',
  PADDLE_API_KEY: apiKey('live'),
  PUBLIC_PADDLE_CLIENT_TOKEN: clientToken('live'),
}), /PADDLE_ENVIRONMENT must be sandbox/);

console.log('Paddle deployment configuration tests passed.');
