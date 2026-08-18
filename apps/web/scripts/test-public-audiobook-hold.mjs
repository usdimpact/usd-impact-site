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
assert.match(page, /Full chapter playback is available only after account and Library Pass verification\./);
assert.match(page, /Browser state, email possession and a checkout redirect do not grant access\./);
assert.match(page, /Playback will be restored here after the protected delivery path has completed release verification\./);

console.log('Public audiobook HOLD contract passed.');
