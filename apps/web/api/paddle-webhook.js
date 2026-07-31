import {
  PaddleWebhookVerificationError,
  parseVerifiedPaddleEvent,
  verifyPaddleWebhookSignature,
} from '../src/lib/paddle-webhook.js';
import { storePaddleWebhookReceipt } from '../src/lib/paddle-supabase.js';
import { markPaddleWebhookReceipt } from '../src/lib/paddle-commerce.js';
import { processPaddleWebhookEvent } from '../src/lib/paddle-event-processor.js';
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

function isAdjustmentEvent(eventType) {
  return eventType === 'adjustment.created' || eventType === 'adjustment.updated';
}

async function markFailedSafely({ eventId, error, environment, markReceipt }) {
  try {
    await markReceipt({
      eventId,
      status: 'failed',
      lastError: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown processing error.',
      environment,
    });
  } catch (markError) {
    console.error('Unable to mark Paddle webhook receipt as failed.', markError);
  }
}

export function createPaddleWebhookHandler({
  environment = process.env,
  storeReceipt = storePaddleWebhookReceipt,
  processEvent = processPaddleWebhookEvent,
  markReceipt = markPaddleWebhookReceipt,
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
      const stored = await storeReceipt({ event, rawBody, environment });
      const replayIgnoredAdjustment = stored.duplicate
        && stored.existingStatus === 'ignored'
        && isAdjustmentEvent(event.eventType);

      if (stored.duplicate && !replayIgnoredAdjustment) {
        return jsonResponse(200, {
          ok: true,
          accepted: false,
          duplicate: true,
          processed: false,
          eventId: event.eventId,
        });
      }

      const processing = await processEvent({ event, environment });
      const responsePayload = {
        ok: true,
        accepted: !stored.duplicate,
        duplicate: stored.duplicate,
        processed: Boolean(processing?.processed),
        ignored: Boolean(processing?.ignored),
        eventId: event.eventId,
      };
      if (replayIgnoredAdjustment) responsePayload.replayed = true;
      return jsonResponse(200, responsePayload);
    } catch (error) {
      await markFailedSafely({ eventId: event.eventId, error, environment, markReceipt });
      if (error instanceof SupabaseConfigurationError) {
        console.error(error.message);
        return jsonResponse(503, {
          error: 'Webhook services are temporarily unavailable.',
          code: error.code,
        });
      }
      if (error instanceof SupabaseRequestError) {
        console.error('Unable to persist or process Paddle webhook.', {
          status: error.status,
          code: error.code,
        });
        return jsonResponse(503, {
          error: 'Webhook services are temporarily unavailable.',
          code: 'PADDLE_WEBHOOK_PROCESSING_FAILED',
        });
      }
      if (error instanceof TypeError) {
        console.error('Rejected verified Paddle event.', { message: error.message });
        return jsonResponse(422, {
          error: 'Verified Paddle event did not match a trusted purchase or adjustment.',
          code: 'PADDLE_EVENT_MISMATCH',
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
