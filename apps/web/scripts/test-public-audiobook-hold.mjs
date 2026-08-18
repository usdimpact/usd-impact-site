import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(
  new URL('../src/pages/audiobook/read-the-dollar-first.astro', import.meta.url),
  'utf8',
);

assert.doesNotMatch(page, /AudiobookPlayer/);
assert.doesNotMatch(page, /<audio\b/i);
assert.doesNotMatch(page, /\.public\.blob\.vercel-storage\.com/);
assert.doesNotMatch(page, /https:\/\/[^\s'"]+\.mp3/i);
assert.match(page, /Full playback is available only through an eligible, signed-in Library Pass account\./);
assert.match(page, /The Library Pass is a one-time purchase/);
assert.match(page, /the audiobook is not part of Research Membership and does not require a recurring subscription\./);

console.log('Public audiobook HOLD contract passed.');
