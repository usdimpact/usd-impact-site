import { requestHeader, getVerifiedSupabaseUser, sendJson } from '../src/lib/supabase-server.js';
import { readSessionAccessToken } from '../src/lib/supabase-auth.js';
import { validCronAuthorization } from '../src/lib/account-deletion-finalizer.js';
import {
  createCommerceCheckout,
  processLemonSqueezyWebhook,
  publicCommerceRuntimeError,
  readLemonSqueezyCommerceRuntimeConfig,
  runDueLemonSqueezyReconciliation,
} from '../src/lib/lemon-squeezy-commerce-runtime.js';
import {
  processResearchMembershipWebhook,
  publicResearchMembershipWebhookError,
} from '../src/lib/research-membership-webhook-handler.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_CHECKOUT_BODY_BYTES = 16 * 1024;
const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;

function action(request) {
  return new URL(request.url || '/api/commerce', 'https://usd-impact.invalid')
    .searchParams.get('action')?.trim().toLowerCase() || '';
}

function methodNotAllowed(response, allowed) {
  response.setHeader('Allow', allowed);
  return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, {
    'X-Robots-Tag': 'noindex, nofollow',
  });
}

function rejectCrossSite(request, response) {
  if (requestHeader(request, 'sec-fetch-site').trim().toLowerCase() !== 'cross-site') return false;
  sendJson(response, 403, { error: 'Cross-site requests are not allowed.', code: 'CROSS_SITE_REQUEST' }, {
    'X-Robots-Tag': 'noindex, nofollow',
  });
  return true;
}

async function readRawBody(request, maximumBytes, { allowParsedBody = true } = {}) {
  if (!request) return Buffer.alloc(0);

  // Vercel's Node.js request.body helper lazily parses application/json. Webhook
  // signatures must instead be computed over the exact bytes received from the
  // provider, so webhook paths explicitly skip this parsed-body helper and
  // consume the request stream directly.
  if (allowParsedBody) {
    if (Buffer.isBuffer(request.body)) {
      if (request.body.length > maximumBytes) throw new Error('REQUEST_BODY_TOO_LARGE');
      return request.body;
    }
    if (typeof request.body === 'string') {
      const buffer = Buffer.from(request.body, 'utf8');
      if (buffer.length > maximumBytes) throw new Error('REQUEST_BODY_TOO_LARGE');
      return buffer;
    }
    if (request.body && typeof request.body === 'object') {
      const buffer = Buffer.from(JSON.stringify(request.body), 'utf8');
      if (buffer.length > maximumBytes) throw new Error('REQUEST_BODY_TOO_LARGE');
      return buffer;
    }
  }

  if (typeof request[Symbol.asyncIterator] !== 'function') return Buffer.alloc(0);

  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maximumBytes) throw new Error('REQUEST_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function parseJsonBody(buffer) {
  try {
    const parsed = JSON.parse(buffer.toString('utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return null;
  }
}

function runtimeConfig(response) {
  try {
    const runtime = readLemonSqueezyCommerceRuntimeConfig(process.env);
    if (!runtime.enabled) {
      sendJson(response, 503, {
        error: 'Commerce is disabled.',
        code: 'COMMERCE_DISABLED',
      }, { 'X-Robots-Tag': 'noindex, nofollow' });
      return null;
    }
    return runtime;
  } catch (error) {
    const safe = publicCommerceRuntimeError(error);
    sendJson(response, safe.status, safe.payload, { 'X-Robots-Tag': 'noindex, nofollow' });
    return null;
  }
}

async function handleCheckout(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (rejectCrossSite(request, response)) return;
  if (!requestHeader(request, 'content-type').toLowerCase().includes('application/json')) {
    return sendJson(response, 415, {
      error: 'Content type must be application/json.',
      code: 'INVALID_CONTENT_TYPE',
    }, { 'X-Robots-Tag': 'noindex, nofollow' });
  }
  const runtime = runtimeConfig(response);
  if (!runtime) return;

  let rawBody;
  try {
    rawBody = await readRawBody(request, MAX_CHECKOUT_BODY_BYTES);
  } catch {
    return sendJson(response, 413, { error: 'Request body is too large.', code: 'REQUEST_BODY_TOO_LARGE' }, {
      'X-Robots-Tag': 'noindex, nofollow',
    });
  }
  const payload = parseJsonBody(rawBody);
  if (!payload) {
    return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' }, {
      'X-Robots-Tag': 'noindex, nofollow',
    });
  }
  const idempotencyKey = String(
    requestHeader(request, 'idempotency-key') || payload.idempotencyKey || '',
  ).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,254}$/.test(idempotencyKey)) {
    return sendJson(response, 400, {
      error: 'A valid idempotency key is required.',
      code: 'INVALID_IDEMPOTENCY_KEY',
    }, { 'X-Robots-Tag': 'noindex, nofollow' });
  }

  try {
    const accessToken = readSessionAccessToken(request);
    if (!accessToken) {
      return sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' }, {
        'X-Robots-Tag': 'noindex, nofollow',
      });
    }
    const user = await getVerifiedSupabaseUser(accessToken, { config: runtime.supabase });
    const result = await createCommerceCheckout({
      config: runtime,
      user,
      idempotencyKey,
    });
    return sendJson(response, 201, {
      ok: true,
      testMode: runtime.testMode,
      checkoutUrl: result.checkout.url,
      purchaseIntent: result.purchaseIntent,
    }, {
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    });
  } catch (error) {
    const safe = publicCommerceRuntimeError(error);
    return sendJson(response, safe.status, safe.payload, { 'X-Robots-Tag': 'noindex, nofollow' });
  }
}

async function handleWebhook(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  const runtime = runtimeConfig(response);
  if (!runtime) return;

  let rawBody;
  try {
    rawBody = await readRawBody(request, MAX_WEBHOOK_BODY_BYTES, { allowParsedBody: false });
  } catch {
    return sendJson(response, 413, { error: 'Request body is too large.', code: 'REQUEST_BODY_TOO_LARGE' }, {
      'X-Robots-Tag': 'noindex, nofollow',
    });
  }

  try {
    const result = await processLemonSqueezyWebhook({
      config: runtime,
      rawBody,
      signature: requestHeader(request, 'x-signature'),
    });
    return sendJson(response, 200, { ok: true, duplicate: result.duplicate === true }, {
      'X-Robots-Tag': 'noindex, nofollow',
    });
  } catch (error) {
    const safe = publicCommerceRuntimeError(error);
    return sendJson(response, safe.status, safe.payload, { 'X-Robots-Tag': 'noindex, nofollow' });
  }
}

async function handleResearchMembershipWebhook(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requestHeader(request, 'content-type').toLowerCase().includes('application/json')) {
    return sendJson(response, 415, {
      error: 'Content type must be application/json.',
      code: 'INVALID_CONTENT_TYPE',
    }, { 'X-Robots-Tag': 'noindex, nofollow' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(request, MAX_WEBHOOK_BODY_BYTES, { allowParsedBody: false });
  } catch {
    return sendJson(response, 413, { error: 'Request body is too large.', code: 'REQUEST_BODY_TOO_LARGE' }, {
      'X-Robots-Tag': 'noindex, nofollow',
    });
  }

  try {
    const result = await processResearchMembershipWebhook({
      rawBody,
      signature: requestHeader(request, 'x-signature'),
    });
    return sendJson(response, 200, { ok: true, ...result }, {
      'X-Robots-Tag': 'noindex, nofollow',
    });
  } catch (error) {
    const safe = publicResearchMembershipWebhookError(error);
    return sendJson(response, safe.status, safe.payload, { 'X-Robots-Tag': 'noindex, nofollow' });
  }
}

async function handleReconciliation(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
  if (!validCronAuthorization(request, process.env)) {
    return sendJson(response, 401, { error: 'Authorization is required.', code: 'CRON_AUTHORIZATION_REQUIRED' }, {
      'X-Robots-Tag': 'noindex, nofollow',
    });
  }
  const runtime = runtimeConfig(response);
  if (!runtime) return;
  if (!runtime.reconciliationEnabled) {
    return sendJson(response, 503, {
      error: 'Commerce reconciliation is disabled.',
      code: 'COMMERCE_RECONCILIATION_DISABLED',
    }, { 'X-Robots-Tag': 'noindex, nofollow' });
  }

  try {
    const result = await runDueLemonSqueezyReconciliation({ config: runtime });
    return sendJson(response, 200, { ok: true, ...result }, { 'X-Robots-Tag': 'noindex, nofollow' });
  } catch (error) {
    const safe = publicCommerceRuntimeError(error);
    return sendJson(response, safe.status, safe.payload, { 'X-Robots-Tag': 'noindex, nofollow' });
  }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const requestedAction = action(request);
  if (requestedAction === 'checkout') return handleCheckout(request, response);
  if (requestedAction === 'webhook') return handleWebhook(request, response);
  if (requestedAction === 'research-membership-webhook') return handleResearchMembershipWebhook(request, response);
  if (requestedAction === 'reconcile') return handleReconciliation(request, response);
  return sendJson(response, 404, { error: 'Commerce action not found.', code: 'COMMERCE_ACTION_NOT_FOUND' }, {
    'X-Robots-Tag': 'noindex, nofollow',
  });
}
