import assert from 'node:assert/strict';
import { dispatchDailyCardToTelegram } from '../src/lib/daily-card-dispatch.js';
import { normalizeTelegramMessage, readTelegramConfig, sendTelegramMessage } from '../src/lib/daily-card-telegram.js';

const supabaseConfig = {
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_example',
  secretKey: 'sb_secret_example',
};
const telegramConfig = {
  token: '123456789:abcdefghijklmnopqrstuvwxyz_ABCDE',
  chatId: '@usdimpactdaily',
};
const enabledEnvironment = {
  DAILY_CARD_DISTRIBUTION_ENABLED: 'true',
  DAILY_CARD_TELEGRAM_ENABLED: 'true',
};
const cardPackage = {
  schemaVersion: 1,
  publishDate: '2026-08-22',
  source: { id: 'dxy-signal-system', access: 'open' },
  channels: { telegram: 'USD Impact Daily — DXY\n\nDXY is a dollar index.\n\nhttps://www.usd-impact.com/learn/dxy' },
};
const dispatchId = '123e4567-e89b-42d3-a456-426614174000';

function restResponse({ ok = true, status = 200, payload = null } = {}) {
  return {
    ok,
    status,
    async text() {
      return payload === null ? '' : JSON.stringify(payload);
    },
  };
}
function telegramResponse({ ok = true, status = 200, payload = null } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

assert.equal(normalizeTelegramMessage(' hello '), 'hello');
assert.throws(() => normalizeTelegramMessage('x'.repeat(4097)), /1-4096/);
assert.deepEqual(readTelegramConfig({
  DAILY_CARD_TELEGRAM_BOT_TOKEN: telegramConfig.token,
  DAILY_CARD_TELEGRAM_CHAT_ID: telegramConfig.chatId,
}), telegramConfig);
assert.throws(() => readTelegramConfig({
  DAILY_CARD_TELEGRAM_BOT_TOKEN: 'invalid',
  DAILY_CARD_TELEGRAM_CHAT_ID: telegramConfig.chatId,
}), /bot token is missing or invalid/);

let disabledTouched = false;
const disabled = await dispatchDailyCardToTelegram({
  cardPackage,
  environment: {},
  supabaseConfig,
  telegramConfig,
  fetchImpl: async () => { disabledTouched = true; throw new Error('unexpected'); },
  telegramFetchImpl: async () => { disabledTouched = true; throw new Error('unexpected'); },
});
assert.deepEqual(disabled, { ok: true, enabled: false, status: 'disabled' });
assert.equal(disabledTouched, false);

const directTelegramCalls = [];
const directTelegram = await sendTelegramMessage({
  text: 'Daily card',
  config: telegramConfig,
  fetchImpl: async (url, options) => {
    directTelegramCalls.push({ url, options });
    return telegramResponse({ payload: { ok: true, result: { message_id: 101 } } });
  },
});
assert.deepEqual(directTelegram, { messageId: '101' });
assert.equal(directTelegramCalls.length, 1);
assert.match(directTelegramCalls[0].url, /^https:\/\/api\.telegram\.org\/bot123456789:/);
assert.deepEqual(JSON.parse(directTelegramCalls[0].options.body), {
  chat_id: '@usdimpactdaily',
  text: 'Daily card',
  link_preview_options: { is_disabled: false },
});

const successfulRestCalls = [];
let successfulTelegramCalls = 0;
const sent = await dispatchDailyCardToTelegram({
  cardPackage,
  environment: enabledEnvironment,
  supabaseConfig,
  telegramConfig,
  fetchImpl: async (url, options = {}) => {
    successfulRestCalls.push({ url, options });
    assert.equal(options.headers.apikey, supabaseConfig.secretKey);
    assert.equal(Object.hasOwn(options.headers, 'Authorization'), false);
    if (url.endsWith('/rest/v1/rpc/claim_daily_card_dispatch')) {
      return restResponse({ payload: [{
        dispatch_id: dispatchId,
        claim_status: 'claimed',
        existing_status: 'claimed',
        existing_payload_sha256: 'a'.repeat(64),
      }] });
    }
    return restResponse({ status: 204 });
  },
  telegramFetchImpl: async () => {
    successfulTelegramCalls += 1;
    return telegramResponse({ payload: { ok: true, result: { message_id: 202 } } });
  },
  now: new Date('2026-08-22T14:30:00.000Z'),
});
assert.deepEqual(sent, { ok: true, enabled: true, status: 'sent', messageId: '202' });
assert.equal(successfulTelegramCalls, 1);
assert.equal(successfulRestCalls.length, 2);
const claimBody = JSON.parse(successfulRestCalls[0].options.body);
assert.equal(claimBody.p_publish_date, '2026-08-22');
assert.equal(claimBody.p_card_id, 'dxy-signal-system');
assert.equal(claimBody.p_channel, 'telegram');
assert.match(claimBody.p_destination_hash, /^[a-f0-9]{64}$/);
assert.match(claimBody.p_payload_sha256, /^[a-f0-9]{64}$/);
assert.equal(Object.hasOwn(claimBody, 'chat_id'), false);
assert.deepEqual(JSON.parse(successfulRestCalls[1].options.body), {
  status: 'sent',
  provider_message_id: '202',
  sent_at: '2026-08-22T14:30:00.000Z',
  updated_at: '2026-08-22T14:30:00.000Z',
  error_code: null,
});

let duplicateTelegramCalls = 0;
const duplicate = await dispatchDailyCardToTelegram({
  cardPackage,
  environment: enabledEnvironment,
  supabaseConfig,
  telegramConfig,
  fetchImpl: async () => restResponse({ payload: [{
    dispatch_id: dispatchId,
    claim_status: 'duplicate',
    existing_status: 'sent',
    existing_payload_sha256: 'b'.repeat(64),
  }] }),
  telegramFetchImpl: async () => { duplicateTelegramCalls += 1; throw new Error('should not send'); },
});
assert.deepEqual(duplicate, {
  ok: true,
  enabled: true,
  status: 'duplicate-suppressed',
  existingStatus: 'sent',
});
assert.equal(duplicateTelegramCalls, 0);

await assert.rejects(
  () => dispatchDailyCardToTelegram({
    cardPackage,
    environment: enabledEnvironment,
    supabaseConfig,
    telegramConfig,
    fetchImpl: async () => restResponse({ payload: [{
      dispatch_id: dispatchId,
      claim_status: 'payload_mismatch',
      existing_status: 'sent',
      existing_payload_sha256: 'c'.repeat(64),
    }] }),
    telegramFetchImpl: async () => { throw new Error('should not send'); },
  }),
  (error) => error?.code === 'DAILY_CARD_PAYLOAD_MISMATCH',
);

const failureMarks = [];
await assert.rejects(
  () => dispatchDailyCardToTelegram({
    cardPackage,
    environment: enabledEnvironment,
    supabaseConfig,
    telegramConfig,
    fetchImpl: async (url, options = {}) => {
      if (url.endsWith('/rest/v1/rpc/claim_daily_card_dispatch')) {
        return restResponse({ payload: [{
          dispatch_id: dispatchId,
          claim_status: 'claimed',
          existing_status: 'claimed',
          existing_payload_sha256: 'd'.repeat(64),
        }] });
      }
      failureMarks.push(JSON.parse(options.body));
      return restResponse({ status: 204 });
    },
    telegramFetchImpl: async () => telegramResponse({
      ok: false,
      status: 403,
      payload: { ok: false, error_code: 403, description: 'Forbidden' },
    }),
    now: new Date('2026-08-22T14:31:00.000Z'),
  }),
  (error) => error?.code === 'TELEGRAM_API_403',
);
assert.deepEqual(failureMarks, [{
  status: 'failed',
  error_code: 'TELEGRAM_API_403',
  updated_at: '2026-08-22T14:31:00.000Z',
}]);

let acceptedSendCount = 0;
let phase = 'claim';
await assert.rejects(
  () => dispatchDailyCardToTelegram({
    cardPackage,
    environment: enabledEnvironment,
    supabaseConfig,
    telegramConfig,
    fetchImpl: async (url) => {
      if (url.endsWith('/rest/v1/rpc/claim_daily_card_dispatch')) {
        return restResponse({ payload: [{
          dispatch_id: dispatchId,
          claim_status: 'claimed',
          existing_status: 'claimed',
          existing_payload_sha256: 'e'.repeat(64),
        }] });
      }
      phase = 'ledger-failed';
      return restResponse({ ok: false, status: 500, payload: { message: 'ledger unavailable' } });
    },
    telegramFetchImpl: async () => {
      acceptedSendCount += 1;
      return telegramResponse({ payload: { ok: true, result: { message_id: 303 } } });
    },
  }),
  (error) => error?.code === 'DAILY_CARD_SENT_LEDGER_UNCONFIRMED',
);
assert.equal(phase, 'ledger-failed');
assert.equal(acceptedSendCount, 1);

const rerun = await dispatchDailyCardToTelegram({
  cardPackage,
  environment: enabledEnvironment,
  supabaseConfig,
  telegramConfig,
  fetchImpl: async () => restResponse({ payload: [{
    dispatch_id: dispatchId,
    claim_status: 'duplicate',
    existing_status: 'claimed',
    existing_payload_sha256: 'e'.repeat(64),
  }] }),
  telegramFetchImpl: async () => {
    acceptedSendCount += 1;
    throw new Error('duplicate send should be suppressed');
  },
});
assert.equal(rerun.status, 'duplicate-suppressed');
assert.equal(acceptedSendCount, 1);

console.log('Daily Card Telegram at-most-once dispatch contract verified.');
