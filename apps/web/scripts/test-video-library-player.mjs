import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(
  new URL('../public/assets/video-library-player.js', import.meta.url),
  'utf8',
);

async function loadPlayer({ initialDuration = 120, initiallySeekable = false } = {}) {
  const listeners = new Map();
  const label = { textContent: '' };
  const bar = { style: { width: '' } };
  const posts = [];
  let currentTime = 0;
  let seekable = initiallySeekable;
  const player = {
    duration: initialDuration,
    get currentTime() {
      return currentTime;
    },
    set currentTime(value) {
      if (seekable) currentTime = Number(value) || 0;
    },
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
      if (options.method === 'POST') {
        posts.push(JSON.parse(options.body));
        return { ok: true };
      }
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
  return {
    bar,
    label,
    listeners,
    player,
    posts,
    setSeekable(value) {
      seekable = value;
    },
    windowListeners,
  };
}

const metadataAlreadyLoaded = await loadPlayer();
assert.equal(metadataAlreadyLoaded.player.currentTime, 0, 'the SDK may reject a pre-play seek');
assert.equal(metadataAlreadyLoaded.label.textContent, '38% complete');
assert.equal(metadataAlreadyLoaded.bar.style.width, '38%');

metadataAlreadyLoaded.setSeekable(true);
metadataAlreadyLoaded.listeners.get('play')();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(metadataAlreadyLoaded.player.currentTime, 45);
assert.equal(metadataAlreadyLoaded.posts[0].positionSeconds, 45, 'a rejected seek must not overwrite saved progress with zero');

metadataAlreadyLoaded.player.currentTime = 70;
metadataAlreadyLoaded.listeners.get('loadedmetadata')();
assert.equal(metadataAlreadyLoaded.player.currentTime, 70, 'resume must be applied only once');

const seekOnTimeupdate = await loadPlayer();
seekOnTimeupdate.listeners.get('play')();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(seekOnTimeupdate.player.currentTime, 0);
assert.equal(seekOnTimeupdate.posts.length, 0, 'progress must remain untouched while the SDK rejects the seek');
seekOnTimeupdate.setSeekable(true);
seekOnTimeupdate.listeners.get('timeupdate')();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(seekOnTimeupdate.player.currentTime, 45);
assert.equal(seekOnTimeupdate.posts[0].positionSeconds, 45);

const metadataStillPending = await loadPlayer({ initialDuration: 0 });
assert.equal(metadataStillPending.player.currentTime, 0);
metadataStillPending.setSeekable(true);
metadataStillPending.player.duration = 120;
metadataStillPending.listeners.get('durationchange')();
assert.equal(metadataStillPending.player.currentTime, 45);

console.log('Video library player resume-race tests passed.');
