import {
  PaddleWebhookVerificationError,
  parseVerifiedPaddleEvent,
  verifyPaddleWebhookSignature,
} from '../src/lib/paddle-webhook.js';
import { storePaddleWebhookReceipt } from '../src/lib/paddle-supabase.js';
import {
  SupabaseConfigurationError,
  SupabaseRequestError,
} from '../src/lib/supabase-server.js';

function jsonResponse(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function readTolerance(environment) {
  const value = environment.PADDLE_WEBHOOK_TOLERANCE_SECONDS;
  if (value == null || value === '') return 5;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 300) {
    throw new PaddleWebhookVerificationError(
      'Paddle webhook tolerance is invalid.',
      'PADDLE_WEBHOOK_CONFIGURATION_ERROR',
    );
  }
  return parsed;
}

export function createPaddleWebhookHandler({
  environment = process.env,
  storeReceipt = storePaddleWebhookReceipt,
  now = () => Date.now(),
} = {}) {
  return async function fetchHandler(request) {
    if (request.method !== 'POST') {
      return jsonResponse(405, {
        error: 'Method not allowed.',
        code: 'METHOD_NOT_ALLOWED',
      }, { Allow: 'POST' });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return jsonResponse(415, {
        error: 'Content type must be application/json.',
        code: 'INVALID_CONTENT_TYPE',
      });
    }

    const rawBody = await request.text();
    try {
      verifyPaddleWebhookSignature({
        rawBody,
        signatureHeader: request.headers.get('paddle-signature') || '',
        secret: environment.PADDLE_WEBHOOK_SECRET,
        nowMs: now(),
        toleranceSeconds: readTolerance(environment),
      });
    } catch (error) {
      if (error instanceof PaddleWebhookVerificationError) {
        const configurationError = error.code === 'PADDLE_WEBHOOK_CONFIGURATION_ERROR';
        if (configurationError) console.error(error.message);
        return jsonResponse(configurationError ? 503 : 401, {
          error: configurationError
            ? 'Webhook services are temporarily unavailable.'
            : 'Invalid webhook signature.',
          code: error.code,
        });
      }
      console.error(error);
      return jsonResponse(500, {
        error: 'Webhook services are temporarily unavailable.',
        code: 'INTERNAL_ERROR',
      });
    }

    let event;
    try {
      event = parseVerifiedPaddleEvent(rawBody);
    } catch {
      return jsonResponse(400, {
        error: 'Invalid Paddle event payload.',
        code: 'INVALID_PADDLE_EVENT',
      });
    }

    try {
      const stored = await storeReceipt({
        event,
        rawBody,
        environment,
      });
      return jsonResponse(200, {
        ok: true,
        accepted: stored.inserted,
        duplicate: stored.duplicate,
        eventId: event.eventId,
      });
    } catch (error) {
      if (error instanceof SupabaseConfigurationError) {
        console.error(error.message);
        return jsonResponse(503, {
          error: 'Webhook services are temporarily unavailable.',
          code: error.code,
        });
      }
      if (error instanceof SupabaseRequestError) {
        console.error('Unable to store Paddle webhook receipt.', {
          status: error.status,
          code: error.code,
        });
        return jsonResponse(503, {
          error: 'Webhook services are temporarily unavailable.',
          code: 'PADDLE_WEBHOOK_RECEIPT_FAILED',
        });
      }
      console.error(error);
      return jsonResponse(500, {
        error: 'Webhook services are temporarily unavailable.',
        code: 'INTERNAL_ERROR',
      });
    }
  };
}

const fetchHandler = createPaddleWebhookHandler();

export default Object.freeze({ fetch: fetchHandler });
