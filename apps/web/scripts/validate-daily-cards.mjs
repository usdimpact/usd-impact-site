import { dailyCards } from '../src/data/daily-cards.js';
import { getDailyCard, validateDailyCards } from '../src/lib/daily-card-schedule.js';
import { buildChannelPack } from '../src/lib/daily-card-adapters.js';

const errors = validateDailyCards();

const openCards = dailyCards.filter((card) => card.access === 'open' && card.status === 'ready-for-build');
if (openCards.length < 5) errors.push(`expected at least 5 publishable open cards, found ${openCards.length}`);

for (let offset = 0; offset < 35; offset += 1) {
  const date = new Date(Date.UTC(2026, 7, 22 + offset));
  const card = getDailyCard(date, { access: 'open' });
  if (!card) {
    errors.push(`no open daily card selected for ${date.toISOString().slice(0, 10)}`);
    continue;
  }
  if (card.access !== 'open') errors.push(`${date.toISOString().slice(0, 10)} selected non-open card ${card.id}`);
  const pack = buildChannelPack(card, { baseUrl: 'https://www.usd-impact.com' });
  if (!pack.email?.text || !pack.telegram || !pack.whatsapp || !pack.social) {
    errors.push(`${card.id}: incomplete channel pack`);
  }
}

if (errors.length) {
  console.error('Daily Cards validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Daily Cards validation passed: ${dailyCards.length} canonical cards, ${openCards.length} publishable open cards.`);
