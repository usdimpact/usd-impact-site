import { createHash } from 'node:crypto';
import { supabaseSecretRest } from './supabase-secret-rest.js';
import { normalizeTelegramMessage, readTelegramConfig, sendTelegramMessage } from './daily-card-telegram.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CARD_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DailyCardDispatchError extends Error {
  constructor(message, code, status = 500) {
    super(message);
    this.name = 'DailyCardDispatchError';
    this.code = code;
    this.status = status;
  }
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function readDailyCardDispatchSupabaseConfig(environment = process.env) {
  const secretKey = String(environment.SUPABASE_SECRET_KEY || '').trim();
  if (!secretKey.startsWith('sb_secret_') || secretKey.length < 26) {
    throw new DailyCardDispatchError('SUPABASE_SECRET_KEY is missing or invalid.', 'DAILY_CARD_SUPABASE_CONFIG_INVALID');
  }
  let url;
  try {
    url = new URL(String(environment.SUPABASE_URL || '').trim());
  } catch {
    throw new DailyCardDispatchError('SUPABASE_URL is missing or invalid.', 'DAILY_CARD_SUPABASE_CONFIG_INVALID');
  }
  if (url.protocol !== 'https:') {
    throw new DailyCardDispatchError('SUPABASE_URL must use HTTPS.', 'DAILY_CARD_SUPABASE_CONFIG_INVALID');
  }
  return Object.freeze({ url: url.origin, secretKey });
}

function normalizePackage(cardPackage) {
  const publishDate = String(cardPackage?.publishDate || '').trim();
  const cardId = String(cardPackage?.source?.id || '').trim();
  const access = String(cardPackage?.source?.access || '').trim();
  const telegram = normalizeTelegramMessage(cardPackage?.channels?.telegram);
  if (!DATE_PATTERN.test(publishDate) || Number.isNaN(Date.parse(`${publishDate}T12:00:00Z`))) {
    throw new TypeError('Daily Card publish date is invalid.');
  }
  if (!CARD_ID_PATTERN.test(cardId)) throw new TypeError('Daily Card ID is invalid.');
  if (access !== 'open') throw new TypeError('Only open Daily Cards may be published to Telegram.');
  return Object.freeze({ publishDate, cardId, telegram });
}

function normalizeClaim(payload) {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== 'object') {
    throw new DailyCardDispatchError('Daily Card dispatch claim response is invalid.', 'DAILY_CARD_CLAIM_INVALID');
  }
  const status = String(row.claim_status || '');
  if (!['claimed', 'duplicate', 'payload_mismatch'].includes(status)) {
    throw new DailyCardDispatchError('Daily Card dispatch claim response is invalid.', 'DAILY_CARD_CLAIM_INVALID');
  }
  return Object.freeze({
    dispatchId: row.dispatch_id ? String(row.dispatch_id) : null,
    claimStatus: status,
    existingStatus: row.existing_status ? String(row.existing_status) : null,
    existingPayloadSha256: row.existing_payload_sha256 ? String(row.existing_payload_sha256) : null,
  });
}

async function claimDispatch({ config, publishDate, cardId, destinationHash, payloadSha256, fetchImpl }) {
  const payload = await supabaseSecretRest({
    config,
    path: '/rest/v1/rpc/claim_daily_card_dispatch',
    method: 'POST',
    body: {
      p_publish_date: publishDate,
      p_card_id: cardId,
      p_channel: 'telegram',
      p_destination_hash: destinationHash,
      p_payload_sha256: payloadSha256,
    },
    fetchImpl,
    errorCode: 'DAILY_CARD_CLAIM_FAILED',
    errorMessage: 'Daily Card dispatch claim failed.',
  });
  return normalizeClaim(payload);
}

async function markDispatch({ config, dispatchId, body, fetchImpl }) {
  if (!UUID_PATTERN.test(String(dispatchId || ''))) {
    throw new DailyCardDispatchError('Daily Card dispatch ID is invalid.', 'DAILY_CARD_DISPATCH_ID_INVALID');
  }
  await supabaseSecretRest({
    config,
    path: `/rest/v1/daily_card_dispatches?id=eq.${encodeURIComponent(dispatchId)}`,
    method: 'PATCH',
    body,
    prefer: 'return=minimal',
    fetchImpl,
    errorCode: 'DAILY_CARD_LEDGER_UPDATE_FAILED',
    errorMessage: 'Daily Card dispatch ledger update failed.',
  });
}

export async function dispatchDailyCardToTelegram({
  cardPackage,
  environment = process.env,
  supabaseConfig,
  telegramConfig,
  fetchImpl = fetch,
  telegramFetchImpl = fetchImpl,
  now = new Date(),
}) {
  if (environment.DAILY_CARD_DISTRIBUTION_ENABLED !== 'true' || environment.DAILY_CARD_TELEGRAM_ENABLED !== 'true') {
    return Object.freeze({ ok: true, enabled: false, status: 'disabled' });
  }

  const normalized = normalizePackage(cardPackage);
  const resolvedTelegram = telegramConfig || readTelegramConfig(environment);
  const resolvedSupabase = supabaseConfig || readDailyCardDispatchSupabaseConfig(environment);
  const destinationHash = sha256(resolvedTelegram.chatId);
  const payloadSha256 = sha256(normalized.telegram);
  const claim = await claimDispatch({
    config: resolvedSupabase,
    publishDate: normalized.publishDate,
    cardId: normalized.cardId,
    destinationHash,
    payloadSha256,
    fetchImpl,
  });

  if (claim.claimStatus === 'payload_mismatch') {
    throw new DailyCardDispatchError(
      'A Daily Card dispatch already exists for this date and destination with different content.',
      'DAILY_CARD_PAYLOAD_MISMATCH',
      409,
    );
  }
  if (claim.claimStatus === 'duplicate') {
    return Object.freeze({
      ok: true,
      enabled: true,
      status: 'duplicate-suppressed',
      existingStatus: claim.existingStatus,
    });
  }
  if (!UUID_PATTERN.test(String(claim.dispatchId || ''))) {
    throw new DailyCardDispatchError('Daily Card dispatch claim did not return an ID.', 'DAILY_CARD_CLAIM_INVALID');
  }

  let provider;
  try {
    provider = await sendTelegramMessage({
      text: normalized.telegram,
      config: resolvedTelegram,
      fetchImpl: telegramFetchImpl,
    });
  } catch (error) {
    const code = String(error?.code || 'TELEGRAM_DELIVERY_FAILED').slice(0, 96);
    try {
      await markDispatch({
        config: resolvedSupabase,
        dispatchId: claim.dispatchId,
        body: {
          status: 'failed',
          error_code: code,
          updated_at: now.toISOString(),
        },
        fetchImpl,
      });
    } catch {
      // At-most-once safety takes precedence. The claim remains durable and a
      // later automatic run will suppress a duplicate even if failure marking fails.
    }
    throw error;
  }

  try {
    await markDispatch({
      config: resolvedSupabase,
      dispatchId: claim.dispatchId,
      body: {
        status: 'sent',
        provider_message_id: provider.messageId,
        sent_at: now.toISOString(),
        updated_at: now.toISOString(),
        error_code: null,
      },
      fetchImpl,
    });
  } catch {
    throw new DailyCardDispatchError(
      'Telegram accepted the Daily Card, but the delivery ledger could not be finalized. Automatic retry is intentionally suppressed.',
      'DAILY_CARD_SENT_LEDGER_UNCONFIRMED',
      502,
    );
  }

  return Object.freeze({
    ok: true,
    enabled: true,
    status: 'sent',
    messageId: provider.messageId,
  });
}
