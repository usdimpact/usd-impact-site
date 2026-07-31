import {
  completePaddlePurchase,
  markPaddleWebhookReceipt,
} from './paddle-commerce.js';
import { applyPaddleAdjustment } from './paddle-adjustments.js';

export async function processPaddleWebhookEvent({ event, environment, config, fetchImpl }) {
  let result;

  if (event.eventType === 'transaction.completed') {
    result = await completePaddlePurchase({ event, environment, config, fetchImpl });
  } else if (event.eventType === 'adjustment.created' || event.eventType === 'adjustment.updated') {
    result = await applyPaddleAdjustment({ event, environment, config, fetchImpl });
  } else {
    result = Object.freeze({ processed: false, ignored: true });
  }

  await markPaddleWebhookReceipt({
    eventId: event.eventId,
    status: result.processed ? 'processed' : 'ignored',
    environment,
    config,
    fetchImpl,
  });

  return result;
}
