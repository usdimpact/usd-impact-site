import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(
  new URL('../public/assets/video-library-player.js', import.meta.url),
  'utf8',
);

async function loadPlayer({ initialDuration = 120 } = {}) {
  const listeners = new Map();
  const label = { textContent: '' };
  const bar = { style: { width: '' } };
  const player = {
    currentTime: 0,
    duration: initialDuration,
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
  };
  const script = { dataset: { videoSlug: 'resume-race', videoDuration: '120' } };
  const iframe = {};
  const windowListeners = new Map();
  const context = {
    console,
    Date,
    encodeURIComponent,
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') return { ok: true };
      assert.match(String(url), /^\/api\/video-progress\?slug=/);
      return {
        ok: true,
        async json() {
          return { progress: { resume_position: 45, status: 'in_progress' } };
        },
      };
    },
    document: {
      querySelector: () => script,
      getElementById(id) {
        return {
          'stream-player': iframe,
          'video-progress-label': label,
          'video-progress-bar': bar,
        }[id] || null;
      },
    },
    window: {
      Stream: () => player,
      addEventListener(name, listener) {
        windowListeners.set(name, listener);
      },
      setInterval() {
        throw new Error('The SDK is available, so attach should not retry.');
      },
      clearInterval() {},
    },
  };

  vm.runInNewContext(source, context, { filename: 'video-library-player.js' });
  await new Promise((resolve) => setImmediate(resolve));
  return { bar, label, listeners, player, windowListeners };
}

const metadataAlreadyLoaded = await loadPlayer();
assert.equal(metadataAlreadyLoaded.player.currentTime, 45);
assert.equal(metadataAlreadyLoaded.label.textContent, '38% complete');
assert.equal(metadataAlreadyLoaded.bar.style.width, '38%');

metadataAlreadyLoaded.player.currentTime = 70;
metadataAlreadyLoaded.listeners.get('loadedmetadata')();
assert.equal(metadataAlreadyLoaded.player.currentTime, 70, 'resume must be applied only once');

const metadataStillPending = await loadPlayer({ initialDuration: 0 });
assert.equal(metadataStillPending.player.currentTime, 0);
metadataStillPending.player.duration = 120;
metadataStillPending.listeners.get('durationchange')();
assert.equal(metadataStillPending.player.currentTime, 45);

console.log('Video library player resume-race tests passed.');
