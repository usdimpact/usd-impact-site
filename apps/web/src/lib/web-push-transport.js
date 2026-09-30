import { sendPushNotification } from '@mmmike/web-push/send';

export class WebPushTransportError extends Error {
  constructor(message, statusCode = null) {
    super(message);
    this.name = 'WebPushTransportError';
    this.statusCode = statusCode;
  }
}

function parsePayload(payload) {
  let parsed;
  try {
    parsed = JSON.parse(String(payload));
  } catch {
    throw new TypeError('Web Push transport payload must be valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Web Push transport payload must be a JSON object.');
  }
  if (parsed.tag === null) delete parsed.tag;
  return parsed;
}

export async function sendWebPushNotification(
  { subscription, payload, vapid },
  { sendImpl = sendPushNotification } = {},
) {
  if (typeof sendImpl !== 'function') throw new TypeError('Web Push send implementation is required.');
  const delivered = await sendImpl(subscription, parsePayload(payload), vapid);
  if (delivered === false) {
    throw new WebPushTransportError('Web Push subscription is no longer valid.', 410);
  }
  return delivered;
}
