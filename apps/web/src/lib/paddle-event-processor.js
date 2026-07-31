import {
  completePaddlePurchase,
  markPaddleWebhookReceipt,
} from './paddle-commerce.js';
import { applyPaddleAdjustment } from './paddle-adjustments.js';
import { applyPaddleTransactionLifecycle } from './paddle-transactions.js';

const TRANSACTION_LIFECYCLE_EVENTS = new Set([
  'transaction.updated',
  'transaction.ready',
  'transaction.paid',
  'transaction.payment_failed',
  'transaction.past_due',
  'transaction.canceled',
]);

export async function processPaddleWebhookEvent({ event, environment, config, fetchImpl }) {
  let result;

  if (event.eventType === 'transaction.completed') {
    result = await completePaddlePurchase({ event, environment, config, fetchImpl });
  } else if (TRANSACTION_LIFECYCLE_EVENTS.has(event.eventType)) {
    result = await applyPaddleTransactionLifecycle({ event, environment, config, fetchImpl });
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
