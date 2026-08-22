import { buildChannelPack } from '../src/lib/daily-card-adapters.js';
import { getDailyCard, validateDailyCards } from '../src/lib/daily-card-schedule.js';
import { dispatchDailyCardToTelegram } from '../src/lib/daily-card-dispatch.js';

const requested = process.argv[2] || process.env.DAILY_CARD_DATE || new Date().toISOString().slice(0, 10);
const date = new Date(`${requested}T12:00:00Z`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(requested) || Number.isNaN(date.getTime())) {
  console.error(`Invalid DAILY_CARD_DATE: ${requested}`);
  process.exit(1);
}

const validationErrors = validateDailyCards();
if (validationErrors.length) {
  console.error(validationErrors.join('\n'));
  process.exit(1);
}

const card = getDailyCard(date, { access: 'open' });
if (!card) {
  console.error(`No publishable open card for ${requested}`);
  process.exit(1);
}

const cardPackage = {
  schemaVersion: 1,
  publishDate: requested,
  source: {
    id: card.id,
    slug: card.slug,
    title: card.title,
    access: card.access,
  },
  channels: buildChannelPack(card, { baseUrl: 'https://www.usd-impact.com' }),
};

try {
  const result = await dispatchDailyCardToTelegram({ cardPackage });
  console.log(JSON.stringify({
    ok: result.ok,
    enabled: result.enabled,
    status: result.status,
    publishDate: requested,
    cardId: card.id,
    ...(result.messageId ? { providerMessageId: result.messageId } : {}),
    ...(result.existingStatus ? { existingStatus: result.existingStatus } : {}),
  }));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    publishDate: requested,
    cardId: card.id,
    code: error?.code || 'DAILY_CARD_TELEGRAM_DISPATCH_FAILED',
    message: error instanceof Error ? error.message : 'Daily Card Telegram dispatch failed.',
  }));
  process.exit(1);
}
