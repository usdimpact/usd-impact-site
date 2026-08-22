import fs from 'node:fs';
import path from 'node:path';
import { getDailyCard, validateDailyCards } from '../src/lib/daily-card-schedule.js';
import { buildChannelPack } from '../src/lib/daily-card-adapters.js';

const requested = process.argv[2] || process.env.DAILY_CARD_DATE || new Date().toISOString().slice(0, 10);
const date = new Date(`${requested}T12:00:00Z`);
if (Number.isNaN(date.getTime())) {
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

const channels = buildChannelPack(card, { baseUrl: 'https://www.usd-impact.com' });
const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  publishDate: requested,
  source: {
    id: card.id,
    slug: card.slug,
    title: card.title,
    collectionId: card.collectionId,
    format: card.format,
    level: card.level,
    access: card.access,
    lastReviewed: card.lastReviewed,
    sourceNames: card.sourceNames,
  },
  channels,
};

const dir = path.resolve('artifacts/daily-card', requested);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(output, null, 2)}\n`);
fs.writeFileSync(path.join(dir, 'email.txt'), `${channels.email.text}\n`);
fs.writeFileSync(path.join(dir, 'telegram.txt'), `${channels.telegram}\n`);
fs.writeFileSync(path.join(dir, 'whatsapp.txt'), `${channels.whatsapp}\n`);
fs.writeFileSync(path.join(dir, 'social.txt'), `${channels.social}\n`);

console.log(`Generated Daily Card package for ${requested}: ${card.title}`);
console.log(dir);
