import { deliverWebPushBatch } from './web-push-delivery.js';
import { sendWebPushNotification } from './web-push-transport.js';

export const WEB_PUSH_CANARY_CONFIRMATION = 'SEND_ONE_OWNER_WEB_PUSH_CANARY';

function requiredText(value, name, maximumLength) {
  const text = String(value || '').trim();
  if (!text || text.length > maximumLength || /[\u0000-\u001F\u007F]/.test(text)) {
    throw new TypeError(`${name} is missing or invalid.`);
  }
  return text;
}

export function readWebPushCanaryPayload(environment = process.env) {
  const title = requiredText(environment.WEB_PUSH_CANARY_TITLE, 'WEB_PUSH_CANARY_TITLE', 80);
  const body = requiredText(environment.WEB_PUSH_CANARY_BODY, 'WEB_PUSH_CANARY_BODY', 240);
  const url = requiredText(environment.WEB_PUSH_CANARY_URL, 'WEB_PUSH_CANARY_URL', 2048);
  const tag = String(environment.WEB_PUSH_CANARY_TAG || 'owner-canary').trim();
  return Object.freeze({ title, body, url, tag });
}

export async function runWebPushOwnerCanary({
  environment = process.env,
  deliver = deliverWebPushBatch,
  sendNotification = sendWebPushNotification,
} = {}) {
  if (environment.WEB_PUSH_CANARY_CONFIRMATION !== WEB_PUSH_CANARY_CONFIRMATION) {
    throw new Error('Explicit Web Push canary confirmation is required.');
  }
  if (environment.WEB_PUSH_DELIVERY_ENABLED !== 'true') {
    throw new Error('Web Push delivery must be explicitly enabled for the owner canary.');
  }
  const payload = readWebPushCanaryPayload(environment);
  return deliver({
    payload,
    sendNotification,
    environment,
    limit: 1,
  });
}
