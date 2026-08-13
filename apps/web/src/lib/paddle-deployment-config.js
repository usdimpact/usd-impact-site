import { readPaddleApiConfig } from './paddle-api.js';

const LIVE_API_KEY_PATTERN = /^pdl_live_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$/;
const SANDBOX_API_KEY_PATTERN = /^pdl_sdbx_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$/;
const LIVE_CLIENT_TOKEN_PATTERN = /^live_[a-zA-Z\d]{27}$/;
const SANDBOX_CLIENT_TOKEN_PATTERN = /^test_[a-zA-Z\d]{27}$/;
const PRODUCTION_CHECKOUT_URL = 'https://www.usd-impact.com/checkout/';

function requireMatch(value, pattern, name, environmentName) {
  if (!pattern.test(String(value || '').trim())) {
    throw new Error(`${name} must be a ${environmentName} Paddle credential.`);
  }
}

function requireWebhookSecret(value) {
  if (typeof value !== 'string' || value.trim().length < 24) {
    throw new Error('PADDLE_WEBHOOK_SECRET is missing or invalid.');
  }
}

export function isPaddleCheckoutEnabled(environment = process.env) {
  return String(environment.PADDLE_CHECKOUT_ENABLED || '').trim().toLowerCase() === 'true';
}

export function validatePaddleDeploymentConfig(environment = process.env) {
  const vercelEnvironment = String(environment.VERCEL_ENV || '').trim().toLowerCase();
  if (vercelEnvironment !== 'preview' && vercelEnvironment !== 'production') {
    return Object.freeze({ skipped: true, vercelEnvironment: vercelEnvironment || 'local' });
  }

  const expectedPaddleEnvironment = vercelEnvironment === 'production' ? 'production' : 'sandbox';
  const config = readPaddleApiConfig(environment);

  if (config.mode !== expectedPaddleEnvironment) {
    throw new Error(`PADDLE_ENVIRONMENT must be ${expectedPaddleEnvironment} for a ${vercelEnvironment} deployment.`);
  }

  requireMatch(
    environment.PADDLE_API_KEY,
    vercelEnvironment === 'production' ? LIVE_API_KEY_PATTERN : SANDBOX_API_KEY_PATTERN,
    'PADDLE_API_KEY',
    expectedPaddleEnvironment,
  );
  requireMatch(
    environment.PUBLIC_PADDLE_CLIENT_TOKEN,
    vercelEnvironment === 'production' ? LIVE_CLIENT_TOKEN_PATTERN : SANDBOX_CLIENT_TOKEN_PATTERN,
    'PUBLIC_PADDLE_CLIENT_TOKEN',
    expectedPaddleEnvironment,
  );
  requireWebhookSecret(environment.PADDLE_WEBHOOK_SECRET);

  if (config.launchPriceId === config.standardPriceId) {
    throw new Error('PADDLE_LAUNCH_PRICE_ID and PADDLE_STANDARD_PRICE_ID must be different.');
  }

  if (vercelEnvironment === 'production' && config.checkoutUrl !== PRODUCTION_CHECKOUT_URL) {
    throw new Error(`PADDLE_CHECKOUT_URL must be ${PRODUCTION_CHECKOUT_URL} for Production.`);
  }

  return Object.freeze({
    skipped: false,
    vercelEnvironment,
    paddleEnvironment: config.mode,
    checkoutUrlConfigured: Boolean(config.checkoutUrl),
    checkoutEnabled: isPaddleCheckoutEnabled(environment),
  });
}
