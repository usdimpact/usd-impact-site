import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/pages/checkout/index.astro', import.meta.url), 'utf8');

assert.match(source, /PUBLIC_PADDLE_CLIENT_TOKEN/);
assert.match(source, /https:\/\/cdn\.paddle\.com\/paddle\/v2\/paddle\.js/);
assert.match(source, /Paddle\.Environment\.set\('sandbox'\)/);
assert.match(source, /Paddle\.Initialize/);
assert.match(source, /Paddle\.Checkout\.open/);
assert.match(source, /transactionId/);
assert.match(source, /parameters\.get\('_ptxn'\)/);
assert.match(source, /checkout\.completed/);
assert.match(source, /\/account\/\?checkout=complete/);
assert.doesNotMatch(source, /PADDLE_API_KEY/);
assert.doesNotMatch(source, /PADDLE_WEBHOOK_SECRET/);

console.log('Paddle checkout page contract passed.');
