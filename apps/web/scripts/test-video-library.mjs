import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  collections,
  getCollectionVideos,
  libraryMeta,
  videos,
} from '../src/data/video-library.js';
import { STREAM_CUSTOMER_CODE, VIDEO_STREAM_UIDS } from '../src/lib/video-stream-map.js';
import { renderProtectedVideoCatalog } from '../src/lib/video-library-page.js';

assert.equal(videos.length, 51);
assert.equal(collections.length, 5);
assert.deepEqual(collections.map((collection) => getCollectionVideos(collection.id).length), [3, 6, 13, 22, 7]);
assert.equal(new Set(videos.map((video) => video.slug)).size, 51);
assert.equal(Object.keys(VIDEO_STREAM_UIDS).length, 51);
assert.deepEqual(new Set(Object.keys(VIDEO_STREAM_UIDS)), new Set(videos.map((video) => video.slug)));
assert.equal(new Set(Object.values(VIDEO_STREAM_UIDS)).size, 51);
assert.match(STREAM_CUSTOMER_CODE, /^[a-z0-9]+$/i);
for (const [slug, uid] of Object.entries(VIDEO_STREAM_UIDS)) {
  assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.match(uid, /^[a-f0-9]{32}$/i);
}
const duration = videos.reduce((total, video) => total + video.durationSeconds, 0);
assert.ok(Math.abs(duration - libraryMeta.totalDurationSeconds) < 0.01);
const publicSource = fs.readFileSync(new URL('../src/pages/video-library/index.astro', import.meta.url), 'utf8');
assert.doesNotMatch(publicSource, /[a-f0-9]{32}/i);
assert.doesNotMatch(publicSource, /CLOUDFLARE_STREAM_/);
assert.match(publicSource, /aria-label="Filter videos by collection"/);
assert.match(publicSource, /data-video-result-count/);
assert.match(publicSource, /data-video-collection=\{collection\.id\}/);
assert.match(publicSource, /src="\/assets\/video-library-progress\.js"/);

const protectedCatalog = renderProtectedVideoCatalog();
assert.equal((protectedCatalog.match(/data-video-filter="[^"]+"/g) || []).length, collections.length + 1);
assert.equal((protectedCatalog.match(/data-video-collection="[^"]+"/g) || []).length, collections.length);
assert.equal((protectedCatalog.match(/data-video-card/g) || []).length, videos.length);
assert.match(protectedCatalog, /data-video-continue hidden/);
assert.match(protectedCatalog, /data-video-result-count role="status" aria-live="polite"/);

const progressSource = fs.readFileSync(new URL('../public/assets/video-library-progress.js', import.meta.url), 'utf8');
assert.match(progressSource, /if \(!status\) return;/);
assert.match(progressSource, /row\?\.status !== 'completed'/);
assert.match(progressSource, /updatedAt\(right\) - updatedAt\(left\)/);
assert.match(progressSource, /encodeURIComponent\(slug\)/);

class FakeElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.hidden = false;
    this.textContent = '';
    this.href = '';
    this.attributes = new Map();
    this.listeners = new Map();
    this.cards = [];
    this.parts = new Map();
  }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector(selector) { return this.parts.get(selector) || null; }
  querySelectorAll(selector) { return selector === '[data-video-card]' ? this.cards : []; }
}

const filterAll = new FakeElement({ videoFilter: 'all' });
const filterCore = new FakeElement({ videoFilter: 'core-framework' });
const filterAssets = new FakeElement({ videoFilter: 'asset-transmission' });
const core = new FakeElement({ videoCollection: 'core-framework', collectionTitle: 'Core Dollar Framework' });
const assets = new FakeElement({ videoCollection: 'asset-transmission', collectionTitle: 'Asset Transmission' });
const firstCard = new FakeElement({ videoSlug: 'dxy-the-signal-vs-the-system', videoNumber: '01', videoTitle: 'DXY: The Signal vs the System' });
const secondCard = new FakeElement({ videoSlug: 'dollar-yields-liquidity', videoNumber: '02', videoTitle: 'Dollar • Yields • Liquidity' });
const completedCard = new FakeElement({ videoSlug: 'gold-dollar-vs-real-yields', videoNumber: '04', videoTitle: 'Gold: Dollar vs Real Yields' });
for (const card of [firstCard, secondCard, completedCard]) {
  card.parts.set('[data-progress-label]', new FakeElement());
  card.parts.set('[data-progress-bar]', { style: {} });
}
core.cards = [firstCard, secondCard];
assets.cards = [completedCard];
const statusElement = new FakeElement();
const resultElement = new FakeElement();
const continuePanel = new FakeElement();
continuePanel.hidden = true;
const continueLink = new FakeElement();
const continueTitle = new FakeElement();
const cards = [firstCard, secondCard, completedCard];
const hashListeners = new Map();
const document = {
  getElementById: (id) => id === 'library-progress-status' ? statusElement : null,
  querySelectorAll: (selector) => {
    if (selector === '[data-video-filter]') return [filterAll, filterCore, filterAssets];
    if (selector === '[data-video-collection]') return [core, assets];
    if (selector === '[data-video-card]') return cards;
    return [];
  },
  querySelector: (selector) => {
    if (selector === '[data-video-result-count]') return resultElement;
    if (selector === '[data-video-continue]') return continuePanel;
    if (selector === '[data-video-continue-link]') return continueLink;
    if (selector === '[data-video-continue-title]') return continueTitle;
    const slug = selector.match(/^\[data-video-slug="(.+)"\]$/)?.[1];
    return cards.find((card) => card.dataset.videoSlug === slug) || null;
  },
};
const progressRows = [
  { content_id: 'video:dxy-the-signal-vs-the-system', status: 'in_progress', progress_percent: 35, updated_at: '2026-09-01T12:00:00.000Z' },
  { content_id: 'video:dollar-yields-liquidity', status: 'in_progress', progress_percent: 62, updated_at: '2026-09-02T12:00:00.000Z' },
  { content_id: 'video:gold-dollar-vs-real-yields', status: 'completed', progress_percent: 100, updated_at: '2026-09-03T12:00:00.000Z' },
];
vm.runInNewContext(progressSource, {
  document,
  window: {
    location: { hash: '' },
    addEventListener: (type, callback) => hashListeners.set(type, callback),
  },
  fetch: async () => ({ ok: true, json: async () => ({ progress: progressRows }) }),
  CSS: { escape: (value) => value },
  console,
  decodeURIComponent,
  encodeURIComponent,
  Date,
  Number,
  Promise,
});
await new Promise((resolve) => setTimeout(resolve, 0));

assert.equal(resultElement.textContent, 'Showing 3 films across all 2 collections.');
filterCore.listeners.get('click')();
assert.equal(core.hidden, false);
assert.equal(assets.hidden, true);
assert.equal(filterCore.attributes.get('aria-current'), 'location');
assert.equal(resultElement.textContent, 'Showing 2 films in Core Dollar Framework.');
assert.equal(continuePanel.hidden, false);
assert.equal(continueTitle.textContent, 'Film 02 · Dollar • Yields • Liquidity');
assert.equal(continueLink.href, '/guided-edition/video-library/dollar-yields-liquidity/');
assert.equal(continueLink.textContent, 'Continue from 62%');
assert.equal(statusElement.textContent, '1 of 51 films completed.');

let publicProgressRequests = 0;
vm.runInNewContext(progressSource, {
  document: { ...document, getElementById: () => null },
  window: { location: { hash: '' }, addEventListener: () => {} },
  fetch: async () => {
    publicProgressRequests += 1;
    return { ok: true, json: async () => ({ progress: [] }) };
  },
  CSS: { escape: (value) => value },
  console,
  decodeURIComponent,
  encodeURIComponent,
  Date,
  Number,
  Promise,
});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(publicProgressRequests, 0, 'The public catalog must not request private progress.');

console.log('Video library catalog and signed-delivery map tests passed.');
