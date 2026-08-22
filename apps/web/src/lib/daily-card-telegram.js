const BOT_TOKEN_PATTERN = /^\d{5,20}:[A-Za-z0-9_-]{20,160}$/;
const CHANNEL_USERNAME_PATTERN = /^@[A-Za-z][A-Za-z0-9_]{4,31}$/;
const NUMERIC_CHAT_ID_PATTERN = /^-?\d{5,24}$/;
const MAX_MESSAGE_LENGTH = 4096;

export class TelegramDeliveryError extends Error {
  constructor(message, { code = 'TELEGRAM_DELIVERY_FAILED', status = 502 } = {}) {
    super(message);
    this.name = 'TelegramDeliveryError';
    this.code = code;
    this.status = status;
  }
}

export function readTelegramConfig(environment = process.env) {
  const token = String(environment.DAILY_CARD_TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(environment.DAILY_CARD_TELEGRAM_CHAT_ID || '').trim();
  if (!BOT_TOKEN_PATTERN.test(token)) {
    throw new TelegramDeliveryError('Telegram bot token is missing or invalid.', {
      code: 'TELEGRAM_CONFIG_INVALID',
      status: 500,
    });
  }
  if (!CHANNEL_USERNAME_PATTERN.test(chatId) && !NUMERIC_CHAT_ID_PATTERN.test(chatId)) {
    throw new TelegramDeliveryError('Telegram channel identifier is missing or invalid.', {
      code: 'TELEGRAM_CONFIG_INVALID',
      status: 500,
    });
  }
  return Object.freeze({ token, chatId });
}

export function normalizeTelegramMessage(value) {
  const text = String(value || '').trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH || /\u0000/.test(text)) {
    throw new TypeError(`Telegram message must contain 1-${MAX_MESSAGE_LENGTH} characters.`);
  }
  return text;
}

export async function sendTelegramMessage({
  text,
  config,
  environment = process.env,
  fetchImpl = fetch,
}) {
  const message = normalizeTelegramMessage(text);
  const resolved = config || readTelegramConfig(environment);
  let response;
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${resolved.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: resolved.chatId,
        text: message,
        link_preview_options: { is_disabled: false },
      }),
    });
  } catch {
    throw new TelegramDeliveryError('Telegram request failed before a response was received.', {
      code: 'TELEGRAM_NETWORK_FAILED',
      status: 502,
    });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new TelegramDeliveryError('Telegram returned an invalid response.', {
      code: 'TELEGRAM_RESPONSE_INVALID',
      status: response.status || 502,
    });
  }

  if (!response.ok || payload?.ok !== true || !Number.isInteger(payload?.result?.message_id)) {
    const providerCode = Number.isInteger(payload?.error_code) ? String(payload.error_code) : 'UNKNOWN';
    throw new TelegramDeliveryError('Telegram rejected the message.', {
      code: `TELEGRAM_API_${providerCode}`,
      status: response.status || 502,
    });
  }

  return Object.freeze({
    messageId: String(payload.result.message_id),
  });
}
