import { createHash } from 'node:crypto';
import {
  readSupabaseServerConfig,
  SupabaseRequestError,
} from './supabase-server.js';

const JSON_HEADERS = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function readExistingReceipt({ eventId, config, fetchImpl }) {
  const query = new URLSearchParams({
    provider: 'eq.paddle',
    provider_event_id: `eq.${eventId}`,
    select: 'id,status,event_type',
    limit: '1',
  });
  const response = await fetchImpl(`${config.url}/rest/v1/webhook_receipts?${query}`, {
    method: 'GET',
    headers: {
      ...JSON_HEADERS,
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
    },
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.message || payload?.error || 'Unable to read existing Paddle webhook receipt.',
      {
        status: response.status,
        code: payload?.code || 'PADDLE_WEBHOOK_RECEIPT_READ_FAILED',
        details: payload,
      },
    );
  }
  return Array.isArray(payload) && payload.length > 0 ? payload[0] : null;
}

export async function storePaddleWebhookReceipt({
  event,
  rawBody,
  environment,
  config,
  fetchImpl = fetch,
}) {
  if (!event?.eventId || !event?.eventType) {
    throw new TypeError('A verified Paddle event is required.');
  }
  if (typeof rawBody !== 'string' || rawBody.length === 0) {
    throw new TypeError('rawBody is required.');
  }

  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const payloadSha256 = createHash('sha256').update(rawBody, 'utf8').digest('hex');
  const query = new URLSearchParams({ on_conflict: 'provider,provider_event_id' });
  const response = await fetchImpl(
    `${resolvedConfig.url}/rest/v1/webhook_receipts?${query}`,
    {
      method: 'POST',
      headers: {
        ...JSON_HEADERS,
        apikey: resolvedConfig.secretKey,
        Authorization: `Bearer ${resolvedConfig.secretKey}`,
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify({
        provider: 'paddle',
        provider_event_id: event.eventId,
        event_type: event.eventType,
        payload_sha256: payloadSha256,
        status: 'received',
      }),
    },
  );
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.message || payload?.error || 'Unable to store Paddle webhook receipt.',
      {
        status: response.status,
        code: payload?.code || 'PADDLE_WEBHOOK_RECEIPT_FAILED',
        details: payload,
      },
    );
  }

  const receipt = Array.isArray(payload) && payload.length > 0 ? payload[0] : null;
  const existing = receipt
    ? null
    : await readExistingReceipt({
      eventId: event.eventId,
      config: resolvedConfig,
      fetchImpl,
    });

  return Object.freeze({
    inserted: Boolean(receipt),
    duplicate: !receipt,
    receiptId: receipt?.id ?? existing?.id ?? null,
    existingStatus: existing?.status ?? null,
    existingEventType: existing?.event_type ?? null,
    payloadSha256,
  });
}
