import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

// Network-free tests: the real versioned script runs in a simulated DOM/Stream SDK.
// This suite does not certify browser rendering, customer incidence, or capacity.
const source = await readFile(new URL('../public/assets/video-library-player.v2.js', import.meta.url), 'utf8');
const renderer = await readFile(new URL('../src/lib/video-library-page.js', import.meta.url), 'utf8');
const legacy = await readFile(new URL('../public/assets/video-library-player.js', import.meta.url));
const settle = async () => { for (let i = 0; i < 4; i += 1) await new Promise((r) => setImmediate(r)); };
const response = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), {
  status, headers: { 'content-type': 'application/json', ...headers },
});
const row = (position = 45, status = 'in_progress') => ({
  content_id: 'video:resume-race', resume_position: Number(position).toFixed(1), status,
});
const acknowledgement = (body) => response({ progress: row(body.positionSeconds, body.status) });
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

async function harness({ getPayload = { progress: row() }, getImpl, postImpl,
  initialDuration = 120, initiallySeekable = true, sdkDelay = false, startPlayback = true, nowMs = 1000000 } = {}) {
  const listeners = new Map();
  const windowListeners = new Map();
  const timers = new Map();
  const posts = [];
  const elements = {
    'stream-player': {}, 'video-progress-label': { textContent: '' },
    'video-progress-bar': { style: {} }, 'video-progress-sync': { textContent: '', dataset: {} },
  };
  let currentTime = 0;
  let seekable = initiallySeekable;
  let now = nowMs;
  let timerId = 0;
  let activePosts = 0;
  let maxActivePosts = 0;
  let sdkAvailable = !sdkDelay;
  const player = {
    duration: initialDuration,
    get currentTime() { return currentTime; },
    set currentTime(value) { if (seekable) currentTime = value; },
    addEventListener: (name, fn) => listeners.set(name, fn),
  };
  const addTimer = (fn, delay, interval = 0) => {
    const id = ++timerId;
    timers.set(id, { at: now + delay, fn, interval });
    return id;
  };
  class ClockDate extends Date { static now() { return now; } }
  const context = {
    console, Date: ClockDate, TextDecoder, AbortController,
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    document: {
      querySelector: () => ({ dataset: { videoSlug: 'resume-race', videoDuration: '120' } }),
      getElementById: (id) => elements[id] || null,
    },
    window: {
      get Stream() { return sdkAvailable ? () => player : undefined; },
      addEventListener: (name, fn) => windowListeners.set(name, fn),
      setTimeout: (fn, ms) => addTimer(fn, ms),
      clearTimeout: (id) => timers.delete(id),
      setInterval: (fn, ms) => addTimer(fn, ms, ms),
      clearInterval: (id) => timers.delete(id),
    },
    fetch: async (url, options = {}) => {
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      if (options.method !== 'POST') {
        assert.equal(url, '/api/video-progress?slug=resume-race');
        return getImpl ? getImpl(options) : response(getPayload);
      }
      assert.equal(url, '/api/video-progress');
      const body = JSON.parse(options.body);
      assert.deepEqual(Object.keys(body).sort(), ['durationSeconds', 'positionSeconds', 'slug', 'status']);
      assert.equal(body.slug, 'resume-race');
      assert.equal(body.durationSeconds, 120);
      assert.equal(options.headers['Content-Type'], 'application/json');
      posts.push({ body, options, at: now });
      activePosts += 1;
      maxActivePosts = Math.max(maxActivePosts, activePosts);
      try { return await (postImpl ? postImpl(body, posts.length, options) : acknowledgement(body)); }
      finally { activePosts -= 1; }
    },
  };
  vm.runInNewContext(source, context, { filename: 'video-library-player.v2.js' });
  await settle();
  if (startPlayback) { listeners.get('play')?.(); await settle(); }
  return {
    player, posts, elements,
    sync: elements['video-progress-sync'],
    label: elements['video-progress-label'],
    bar: elements['video-progress-bar'],
    fire: (event) => listeners.get(event)?.(),
    windowFire: (event, args = {}) => windowListeners.get(event)?.(args),
    setSeekable: (value) => { seekable = value; },
    setSdk: (value) => { sdkAvailable = value; },
    maxActive: () => maxActivePosts,
    async tick(ms) {
      const target = now + ms;
      let guard = 0;
      while (true) {
        const entry = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        assert.ok(++guard < 20000, 'timer loop must be bounded');
        const [id, t] = entry;
        now = t.at;
        timers.delete(id);
        if (t.interval) timers.set(id, { ...t, at: now + t.interval });
        t.fn();
        await settle();
      }
      now = target;
      await settle();
    },
  };
}

const results = [];
async function check(name, fn) {
  await fn();
  results.push(name);
  console.log(`PASS ${name}`);
}

await check('new URL and accessible separate sync indicator; legacy bytes preserved', async () => {
  assert.match(renderer, /src="\/assets\/video-library-player\.v2\.js"/);
  assert.doesNotMatch(renderer, /src="\/assets\/video-library-player\.js"/);
  assert.match(renderer, /id="video-progress-sync" role="status" aria-live="polite" aria-atomic="true"/);
  assert.equal(createHash('sha1').update(`blob ${legacy.length}\0`).update(legacy).digest('hex'), '110d0b0997b73b5c0e5ea749f2a31d1bfa234d75');
  assert.doesNotMatch(source, /localStorage|sessionStorage|BroadcastChannel|sendBeacon|\/api\/telemetry/);
});

await check('preloaded metadata resumes once without redundant saves', async () => {
  const h = await harness({ startPlayback: false });
  assert.equal(h.player.currentTime, 45);
  assert.equal(h.label.textContent, '38% complete');
  assert.equal(h.bar.style.width, '38%');
  h.fire('play'); h.fire('playing'); await settle();
  assert.equal(h.posts.length, 0, 'already loaded durable checkpoint needs no duplicate POST');
  h.player.currentTime = 70; h.fire('loadedmetadata');
  assert.equal(h.player.currentTime, 70);
  h.fire('pause'); await settle();
  assert.equal(h.posts[0].body.positionSeconds, 70);
  assert.equal(h.sync.dataset.state, 'saved');
});

for (const readiness of ['playing', 'timeupdate']) {
  await check(`rejected early seek resumes on ${readiness} without overwriting checkpoint`, async () => {
    const h = await harness({ initiallySeekable: false });
    h.fire('play'); await settle();
    assert.equal(h.player.currentTime, 0); assert.equal(h.posts.length, 0);
    h.setSeekable(true); h.fire(readiness); await settle();
    assert.equal(h.player.currentTime, 45); assert.equal(h.posts.length, 0);
    h.player.currentTime = 60; h.fire('pause'); await settle();
    assert.equal(h.posts[0].body.positionSeconds, 60);
  });
}

await check('late duration metadata and delayed SDK attach retain resume behavior', async () => {
  const h = await harness({ initialDuration: 0, initiallySeekable: false, sdkDelay: true });
  h.setSdk(true); await h.tick(250);
  h.player.duration = 120; h.setSeekable(true); h.fire('durationchange');
  assert.equal(h.player.currentTime, 45); assert.equal(h.posts.length, 0);
});

await check('save is not acknowledged before a valid response; latest backward seek survives', async () => {
  const pending = deferred();
  const h = await harness({ postImpl: (b, n) => n === 1 ? pending.promise : acknowledgement(b) });
  h.player.currentTime = 80; h.fire('pause'); await settle();
  assert.equal(h.sync.dataset.state, 'saving');
  h.player.currentTime = 20;
  for (let i = 0; i < 100; i += 1) { h.fire('play'); h.fire('playing'); h.fire('pause'); }
  await settle(); assert.equal(h.posts.length, 1); assert.equal(h.maxActive(), 1);
  pending.resolve(acknowledgement(h.posts[0].body)); await settle();
  assert.equal(h.sync.textContent, 'Last confirmed save: 1:20.');
  await h.tick(1000);
  assert.equal(h.posts.length, 2); assert.equal(h.posts[1].body.positionSeconds, 20);
  assert.equal(h.sync.textContent, 'Last confirmed save: 0:20.');
  assert.equal(h.maxActive(), 1);
});

await check('play/playing/pause event flood is coalesced behind a one-second send gap', async () => {
  const h = await harness({ getPayload: { progress: null } });
  h.fire('play'); h.fire('playing'); h.fire('pause'); await settle();
  assert.equal(h.posts.length, 1);
  for (let i = 1; i <= 500; i += 1) { h.player.currentTime = i / 10; h.fire('pause'); }
  await settle(); assert.equal(h.posts.length, 1);
  await h.tick(999); assert.equal(h.posts.length, 1);
  await h.tick(1); assert.equal(h.posts.length, 2);
  assert.equal(h.posts[1].body.positionSeconds, 50);
  assert.equal(h.maxActive(), 1);
});

for (const code of [401, 403, 400]) {
  await check(`HTTP ${code} stops automatic writes without stopping playback`, async () => {
    const h = await harness({ postImpl: () => response({}, code) });
    h.player.currentTime = 60; h.fire('pause'); await settle();
    assert.equal(h.sync.dataset.state, code === 400 ? 'unavailable' : 'access-required');
    for (let i = 0; i < 50; i += 1) { h.player.currentTime = 65; h.fire('play'); h.fire('timeupdate'); }
    await h.tick(120000);
    assert.equal(h.posts.length, 1); assert.equal(h.player.currentTime, 65);
  });
}

for (const code of [408, 429, 500, 503]) {
  await check(`HTTP ${code} has at most three attempts during sustained failure`, async () => {
    const h = await harness({ postImpl: () => response({}, code) });
    h.player.currentTime = 60; h.fire('pause'); await settle();
    assert.equal(h.sync.dataset.state, 'retrying');
    for (let i = 0; i < 25; i += 1) h.fire('pause');
    await h.tick(1999); assert.equal(h.posts.length, 1);
    await h.tick(1); assert.equal(h.posts.length, 2);
    await h.tick(4000); assert.equal(h.posts.length, 3);
    assert.equal(h.sync.dataset.state, 'unavailable');
    await h.tick(120000); h.fire('play'); await settle();
    assert.equal(h.posts.length, 3);
  });
}

await check('offline failure is bounded and a successful retry restores acknowledgement', async () => {
  const h = await harness({ postImpl: (b, n) => { if (n < 3) throw new TypeError('offline'); return acknowledgement(b); } });
  h.player.currentTime = 60; h.fire('pause'); await settle();
  h.player.currentTime = 70; h.fire('timeupdate');
  await h.tick(6000);
  assert.equal(h.posts.length, 3); assert.equal(h.posts[2].body.positionSeconds, 70);
  assert.equal(h.sync.textContent, 'Last confirmed save: 1:10.');
});

await check('Retry-After is respected and long waits do not cause early retries', async () => {
  const h = await harness({ postImpl: () => response({}, 429, { 'retry-after': '20' }) });
  h.player.currentTime = 60; h.fire('pause'); await settle();
  h.player.currentTime = 70; h.fire('pause');
  await h.tick(19999); assert.equal(h.posts.length, 1);
  await h.tick(1); assert.equal(h.posts.length, 2);
  const long = await harness({ postImpl: () => response({}, 429, { 'retry-after': '120' }) });
  long.player.currentTime = 60; long.fire('pause'); await settle(); await long.tick(180000);
  assert.equal(long.posts.length, 1); assert.equal(long.sync.dataset.state, 'unavailable');
});

const malformed = [
  ['empty object', {}], ['missing row', { progress: null }],
  ['wrong video', { progress: { ...row(60), content_id: 'video:someone-else' } }],
  ['wrong position', { progress: row(10) }],
  ['null position', { progress: { ...row(60), resume_position: null } }],
  ['invalid status', { progress: row(60, 'unknown') }],
];
for (const [name, payload] of malformed) {
  await check(`malformed HTTP 200 (${name}) is not acknowledged or retried indefinitely`, async () => {
    const h = await harness({ postImpl: () => response(payload) });
    h.player.currentTime = 60; h.fire('pause'); await settle();
    assert.equal(h.sync.dataset.state, 'unavailable');
    await h.tick(120000); assert.equal(h.posts.length, 1);
  });
}

await check('invalid JSON, HTML response and oversized response fail closed', async () => {
  for (const make of [
    () => new Response('{', { headers: { 'content-type': 'application/json' } }),
    () => new Response('<html>sign in</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response(' '.repeat(16385), { headers: { 'content-type': 'application/json' } }),
  ]) {
    const h = await harness({ postImpl: make });
    h.player.currentTime = 60; h.fire('pause'); await settle();
    assert.equal(h.sync.dataset.state, 'unavailable');
    assert.equal(h.posts.length, 1);
  }
});

await check('missing or failed initial progress read never overwrites an unknown checkpoint', async () => {
  for (const getImpl of [() => response({}, 503), () => response({}), () => Promise.reject(new TypeError('offline'))]) {
    const h = await harness({ getImpl });
    assert.equal(h.sync.dataset.state, 'unavailable');
    h.player.currentTime = 60; h.fire('play'); h.fire('timeupdate'); h.fire('pause');
    await h.tick(30000); assert.equal(h.posts.length, 0); assert.equal(h.player.currentTime, 60);
  }
});

await check('hung initial read times out and still attaches playback without sync writes', async () => {
  const h = await harness({ getImpl: () => new Promise(() => {}) });
  await h.tick(8000);
  assert.equal(h.sync.dataset.state, 'unavailable');
  h.player.currentTime = 40; h.fire('play'); await settle();
  assert.equal(h.posts.length, 0);
});

await check('hung save times out; late response cannot acknowledge newer intent', async () => {
  const first = deferred();
  const h = await harness({ postImpl: (b, n) => n === 1 ? first.promise : acknowledgement(b) });
  h.player.currentTime = 80; h.fire('pause'); await settle();
  h.player.currentTime = 20; h.fire('pause');
  await h.tick(8000); assert.equal(h.sync.dataset.state, 'retrying');
  // Simulates a provider whose first promise resolves after the client deadline.
  first.resolve(acknowledgement(h.posts[0].body)); await settle();
  assert.equal(h.sync.dataset.state, 'retrying');
  await h.tick(2000);
  assert.equal(h.posts[1].body.positionSeconds, 20);
  assert.equal(h.sync.textContent, 'Last confirmed save: 0:20.');
});

await check('completion remains sticky across queued events and later backward seeks', async () => {
  const first = deferred();
  const h = await harness({ postImpl: (b, n) => n === 1 ? first.promise : acknowledgement(b) });
  h.player.currentTime = 90; h.fire('pause');
  h.player.currentTime = 120; h.fire('ended'); h.fire('pause');
  first.resolve(acknowledgement(h.posts[0].body)); await settle(); await h.tick(1000);
  assert.equal(h.posts[1].body.status, 'completed');
  h.player.currentTime = 20; h.fire('pause'); await h.tick(1000);
  assert.equal(h.posts[2].body.status, 'completed'); assert.equal(h.posts[2].body.positionSeconds, 20);
  assert.equal(h.label.textContent, 'Completed');
});

await check('server-reported completed state is retained; completed downgrade acknowledgement is rejected', async () => {
  const h = await harness({ postImpl: (b) => response({ progress: row(b.positionSeconds, 'completed') }) });
  h.player.currentTime = 60; h.fire('pause'); await settle();
  h.player.currentTime = 30; h.fire('pause'); await h.tick(1000);
  assert.equal(h.posts[1].body.status, 'completed');
  const bad = await harness({ postImpl: (b) => response({ progress: row(b.positionSeconds, 'in_progress') }) });
  bad.player.currentTime = 120; bad.fire('ended'); await settle();
  assert.equal(bad.sync.dataset.state, 'unavailable');
});

await check('page exit is one best-effort attempt; no follow-up retry or saved guarantee', async () => {
  const h = await harness();
  h.player.currentTime = 50; h.windowFire('pagehide'); h.windowFire('pagehide'); await settle();
  assert.equal(h.posts.length, 1); assert.equal(h.posts[0].options.keepalive, true);
  assert.equal(h.sync.dataset.state, 'unconfirmed');
  await h.tick(60000); assert.equal(h.posts.length, 1);
  h.windowFire('pageshow', { persisted: true });
  h.player.currentTime = 60; h.fire('pause'); await h.tick(30000);
  assert.equal(h.posts.length, 1); assert.match(h.sync.textContent, /Reload to revalidate/);
});

await check('exit does not overlap an in-flight save or bypass cooldown/retry wait', async () => {
  const pending = deferred();
  const h = await harness({ postImpl: () => pending.promise });
  h.player.currentTime = 60; h.fire('pause');
  h.player.currentTime = 70; h.windowFire('pagehide'); await settle();
  assert.equal(h.posts.length, 1); assert.equal(h.maxActive(), 1);
  pending.resolve(acknowledgement(h.posts[0].body)); await settle(); await h.tick(10000);
  assert.equal(h.posts.length, 1);
  const cooldown = await harness(); cooldown.player.currentTime = 60; cooldown.fire('pause'); await settle();
  cooldown.player.currentTime = 70; cooldown.windowFire('pagehide'); await settle();
  assert.equal(cooldown.posts.length, 1);
});

await check('exit before resume and invalid playback positions do not create saves', async () => {
  const h = await harness({ initiallySeekable: false }); h.windowFire('pagehide'); await settle();
  assert.equal(h.posts.length, 0);
  const invalid = await harness();
  for (const value of [NaN, Infinity, -1]) { invalid.player.currentTime = value; invalid.fire('pause'); }
  await settle(); assert.equal(invalid.posts.length, 0);
});

await check('periodic cadence is retained at normal and double playback speed', async () => {
  for (const rate of [1, 2]) {
    const h = await harness({ getPayload: { progress: null } });
    for (let wallSecond = 1; wallSecond <= 60; wallSecond += 1) {
      await h.tick(1000);
      h.player.currentTime = wallSecond * rate;
      h.fire('timeupdate'); await settle();
    }
    assert.equal(h.posts.length, rate === 1 ? 6 : 11, 'initial checkpoint plus existing 12-media-second cadence');
    for (let i = 1; i < h.posts.length; i += 1) assert.ok(h.posts[i].at - h.posts[i - 1].at >= 1000);
  }
});

await check('HTTP-date Retry-After and numeric acknowledgement are accepted', async () => {
  const h = await harness({ postImpl: (b, n) => n === 1
    ? response({}, 429, { 'retry-after': new Date(1020000).toUTCString() })
    : response({ progress: { ...row(b.positionSeconds), resume_position: b.positionSeconds } }) });
  h.player.currentTime = 60; h.fire('pause'); await settle();
  await h.tick(19999); assert.equal(h.posts.length, 1);
  await h.tick(1); assert.equal(h.posts.length, 2); assert.equal(h.sync.dataset.state, 'saved');
});

await check('failed exit save has no automatic retries or success indicator', async () => {
  const h = await harness({ postImpl: () => response({}, 503) });
  h.player.currentTime = 50; h.windowFire('pagehide'); await settle();
  await h.tick(120000);
  assert.equal(h.posts.length, 1); assert.equal(h.sync.dataset.state, 'unconfirmed');
});

await check('bfcache restore during a pending initial read keeps reload gate', async () => {
  const initial = deferred();
  const h = await harness({ getImpl: () => initial.promise });
  h.windowFire('pagehide'); h.windowFire('pageshow', { persisted: true });
  initial.resolve(response({ progress: row() })); await settle();
  assert.match(h.sync.textContent, /Reload to revalidate/);
  h.fire('play'); h.player.currentTime = 60; h.fire('pause'); await h.tick(10000);
  assert.equal(h.posts.length, 0);
});

await check('declared oversized acknowledgement is rejected before body parsing', async () => {
  const h = await harness({ postImpl: (b) => response({ progress: row(b.positionSeconds) }, 200, { 'content-length': '16385' }) });
  h.player.currentTime = 60; h.fire('pause'); await settle();
  assert.equal(h.sync.dataset.state, 'unavailable'); assert.equal(h.posts.length, 1);
});


// Review regressions: include a realistic clock so permissive date parsing cannot hide a retry defect.
await check('late attachment detects already-playing SDK state without repeated rewinds', async () => {
  const initial = deferred();
  const h = await harness({ getImpl: () => initial.promise, startPlayback: false });
  h.player.paused = false;
  h.player.currentTime = 10;
  initial.resolve(response({ progress: row(45) })); await settle();
  h.player.currentTime = 60; h.fire('timeupdate'); await settle();
  assert.equal(h.player.currentTime, 60, 'do not rewind an already-resumed playing iframe');
  h.fire('pause'); await settle();
  assert.ok(h.posts.some((p) => p.body.positionSeconds === 60));
});

await check('paused or unknown SDK state does not infer playback from a metadata event', async () => {
  for (const paused of [true, undefined]) {
    const h = await harness({ startPlayback: false });
    h.player.paused = paused;
    h.fire('loadedmetadata'); h.fire('timeupdate'); await settle();
    assert.equal(h.posts.length, 0);
    h.player.paused = false; h.player.currentTime = 45; h.fire('timeupdate'); await settle();
    h.player.currentTime = 60; h.fire('timeupdate'); await settle();
    assert.equal(h.player.currentTime, 60);
    assert.ok(h.posts.some((p) => p.body.positionSeconds === 60));
  }
});

const interruptedBody = () => new Response(new ReadableStream({
  start(controller) { controller.error(new TypeError('test transport interruption')); },
}), { headers: { 'content-type': 'application/json' } });

await check('response-body transport interruption retries and then confirms the latest position', async () => {
  const h = await harness({ postImpl: (body, n) => n === 1 ? interruptedBody() : acknowledgement(body) });
  h.player.currentTime = 60; h.fire('pause'); await settle();
  assert.equal(h.sync.dataset.state, 'retrying');
  h.player.currentTime = 70; h.fire('timeupdate');
  await h.tick(2000);
  assert.equal(h.posts.length, 2); assert.equal(h.posts[1].body.positionSeconds, 70);
  assert.equal(h.sync.textContent, 'Last confirmed save: 1:10.');
});

await check('repeated response-body transport interruptions stay within the three-attempt budget', async () => {
  const h = await harness({ postImpl: interruptedBody });
  h.player.currentTime = 60; h.fire('pause'); await settle();
  await h.tick(6000);
  assert.equal(h.posts.length, 3); assert.equal(h.sync.dataset.state, 'unavailable');
  h.player.currentTime = 70; h.fire('pause'); await h.tick(120000);
  assert.equal(h.posts.length, 3); assert.equal(h.player.currentTime, 70);
});

await check('invalid UTF-8 remains a non-retryable protocol failure', async () => {
  const h = await harness({ postImpl: () => new Response(new Uint8Array([255]), {
    headers: { 'content-type': 'application/json' },
  }) });
  h.player.currentTime = 60; h.fire('pause'); await settle();
  await h.tick(60000);
  assert.equal(h.posts.length, 1); assert.equal(h.sync.dataset.state, 'unavailable');
});

await check('failed write reasserts latest intent even when it returns to the previous acknowledgement', async () => {
  const pending = deferred();
  const h = await harness({ postImpl: (body, n) => n === 1 ? pending.promise : acknowledgement(body) });
  h.player.currentTime = 60; h.fire('pause'); await settle();
  h.player.currentTime = 45; h.fire('pause');
  pending.resolve(response({}, 503)); await settle();
  await h.tick(1999); assert.equal(h.posts.length, 1);
  await h.tick(1);
  assert.equal(h.posts.length, 2); assert.equal(h.posts[1].body.positionSeconds, 45);
  assert.equal(h.sync.textContent, 'Last confirmed save: 0:45.');
});

await check('return-to-ack retry honors Retry-After and retains the latest backward checkpoint', async () => {
  const pending = deferred();
  const h = await harness({ postImpl: (body, n) => n === 1 ? pending.promise : acknowledgement(body) });
  h.player.currentTime = 60; h.fire('pause'); await settle();
  h.player.currentTime = 45; h.fire('pause');
  pending.resolve(response({}, 429, { 'retry-after': '20' })); await settle();
  for (let i = 0; i < 50; i += 1) h.fire('pause');
  await h.tick(19999); assert.equal(h.posts.length, 1);
  await h.tick(1);
  assert.equal(h.posts.length, 2); assert.equal(h.posts[1].body.positionSeconds, 45);
  assert.equal(h.maxActive(), 1);
});

await check('malformed Retry-After cannot become an unrelated past date on a 2026 clock', async () => {
  for (const value of ['1.5', '-1', '2026-09-23T15:00:02Z', 'Wed, 31 Feb 2026 15:00:02 GMT']) {
    const h = await harness({ nowMs: Date.UTC(2026, 8, 23, 15),
      postImpl: () => response({}, 429, { 'retry-after': value }) });
    h.player.currentTime = 60; h.fire('pause'); await settle();
    assert.equal(h.sync.dataset.state, 'unavailable', value);
    await h.tick(60000); assert.equal(h.posts.length, 1, value);
  }
});

await check('canonical HTTP-date retry timing works on a realistic clock', async () => {
  const nowMs = Date.UTC(2026, 8, 23, 15);
  const h = await harness({ nowMs, postImpl: (body, n) => n === 1
    ? response({}, 503, { 'retry-after': new Date(nowMs + 20000).toUTCString() })
    : acknowledgement(body) });
  h.player.currentTime = 60; h.fire('pause'); await settle();
  await h.tick(19999); assert.equal(h.posts.length, 1);
  await h.tick(1); assert.equal(h.posts.length, 2); assert.equal(h.sync.dataset.state, 'saved');
});

await check('unsupported legacy Retry-After date stops automatic sync rather than guessing', async () => {
  const h = await harness({ nowMs: Date.UTC(2026, 8, 23, 15),
    postImpl: () => response({}, 503, { 'retry-after': 'Wednesday, 23-Sep-26 15:00:20 GMT' }) });
  h.player.currentTime = 60; h.fire('pause'); await settle();
  await h.tick(60000);
  assert.equal(h.posts.length, 1); assert.equal(h.sync.dataset.state, 'unavailable');
});

console.log(`Video reliability suite: ${results.length} scenarios passed (simulated DOM, SDK, clock and HTTP).`);
