import { REGISTERED_COMMERCE_ADAPTERS } from './commerce-adapters.js';
import {
  publicCommerceReadiness,
  resolveCommerceReadiness,
} from './commerce-provider.js';

function sendJson(response, body, status = 200, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

export async function handleCommerceReadinessRequest(
  request,
  response,
  {
    environment = process.env,
    adapters = REGISTERED_COMMERCE_ADAPTERS,
  } = {},
) {
  if (request.method !== 'GET') {
    return sendJson(response, {
      error: 'Method not allowed.',
      code: 'METHOD_NOT_ALLOWED',
    }, 405, { Allow: 'GET' });
  }

  try {
    const readiness = resolveCommerceReadiness(environment, adapters);
    return sendJson(response, {
      ok: true,
      commerce: publicCommerceReadiness(readiness),
    });
  } catch (error) {
    console.error('Commerce readiness configuration failed.', {
      code: typeof error?.code === 'string' ? error.code : 'COMMERCE_CONFIGURATION_ERROR',
    });
    return sendJson(response, {
      ok: false,
      commerce: {
        contractVersion: null,
        productId: null,
        state: 'blocked',
        message: 'Commerce configuration could not be verified. Public checkout remains disabled.',
        mode: null,
        provider: null,
        providerConfigured: false,
        adapterVersion: null,
        disclosuresComplete: false,
        sellerDisclosure: null,
        checkoutEnabled: false,
      },
    }, 503);
  }
}
