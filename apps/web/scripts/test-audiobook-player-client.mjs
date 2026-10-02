import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import { renderAudiobookPlayerScript } from '../src/lib/audiobook-player-client.js';

const KEY = 'usd-impact-library-pass-audiobook-progress';
const script = renderAudiobookPlayerScript();
class Element {
  constructor(dataset = {}) { this.dataset = dataset; this.handlers = new Map(); this.attrs = new Map(); this.textContent = ''; this.disabled = false; this.value = '1'; }
  addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push(fn); }
  emit(type) { for (const fn of this.handlers.get(type) || []) fn({ type, target: this }); }
  setAttribute(k, v) { this.attrs.set(k, v); }
  removeAttribute(k) { this.attrs.delete(k); }
  click() { if (!this.disabled) this.emit('click'); }
}
function setup({ saved = null, readDenied = false, writeDenied = false, missing = null, loadThrows = false, seekThrows = false } = {}) {
  const e = Object.fromEntries(['audio', 'title', 'prev', 'next', 'retry', 'restart', 'speed', 'status'].map(k => [k, new Element()]));
  const tracks = Array.from({ length: 3 }, (_, i) => new Element({ url: `/guided-edition/audiobook/track/synthetic-${i}/`, title: `Synthetic ${i}` }));
  const storage = new Map();
  if (saved !== null) storage.set(KEY, typeof saved === 'string' ? saved : JSON.stringify(saved));
  let writes = 0;
  const access = { readDenied, writeDenied };
  const audio = e.audio;
  Object.assign(audio, { readyState: 0, duration: NaN, seeking: false, ended: false, error: null, loads: 0, plays: 0, _time: 0, playbackRate: 1, seekThrows });
  Object.defineProperty(audio, 'currentTime', { get() { return this._time; }, set(v) { if (this.seekThrows) throw Error('seek denied'); this._time = v; this.seeking = true; } });
  audio.load = function () {
    this.loads++; if (loadThrows) throw Error('load denied');
    this.readyState = 0; this._time = 0; this.duration = NaN; this.error = null; this.ended = false; this.seeking = false;
    this.emit('timeupdate'); this.emit('pause'); this.emit('emptied');
  };
  audio.play = function () { this.plays++; return Promise.resolve(); };
  const root = { dataset: { key: KEY }, querySelector(selector) { const k = selector.slice(6, -1); return k === missing ? null : e[k]; }, querySelectorAll() { return tracks; } };
  const sandbox = { document: { querySelector() { return root; } }, localStorage: {
    getItem(k) { if (access.readDenied) throw Error('read denied'); return storage.get(k) ?? null; },
    setItem(k, v) { writes++; if (access.writeDenied) throw Error('write denied'); storage.set(k, v); },
  }, console, Promise, fetch() { throw Error('Network forbidden'); } };
  vm.runInNewContext(script, sandbox, { timeout: 1000 });
  const api = { e, audio, tracks, access, storage, writes: () => writes, value: () => storage.has(KEY) ? JSON.parse(storage.get(KEY)) : null,
    metadata(duration = 120, settle = true) { audio.duration = duration; audio.readyState = 1; audio.emit('loadedmetadata'); if (settle) this.settle(); },
    settle() { audio.seeking = false; audio.emit('seeked'); audio.emit('timeupdate'); },
    time(t) { audio._time = t; audio.seeking = false; audio.emit('timeupdate'); },
    fail() { audio.error = { code: 2 }; audio.emit('error'); },
  };
  return api;
}
function ready(options = {}) { const f = setup(options); f.metadata(); return f; }

test('serializer emits executable inline script without a closing script tag', () => {
  assert.doesNotThrow(() => new vm.Script(script)); assert.doesNotMatch(script, /<\/script|fetch\(|XMLHttpRequest|sendBeacon/);
});
test('missing player is a no-op', () => assert.doesNotThrow(() => vm.runInNewContext(script, { document: { querySelector: () => null } })));
for (const missing of ['audio','title','prev','next','retry','restart','speed','status']) test(`missing ${missing} is a no-op`, () => { assert.doesNotThrow(() => setup({ missing })); });
test('initial empty bookmark is not reported saved or overwritten by metadata', () => { const f = ready(); assert.equal(f.writes(), 0); assert.equal(f.value(), null); assert.doesNotMatch(f.e.status.textContent, /position is saved/); });
test('restores existing bookmark after seek completion', () => { const f = ready({ saved: { index: 1, time: 60 } }); assert.equal(f.audio.currentTime, 60); assert.deepEqual(f.value(), { index: 1, time: 60 }); assert.equal(f.e.title.textContent, 'Synthetic 1'); });
test('ignores reset events before metadata and before seek completes', () => {
  const f = setup({ saved: { index: 0, time: 75 } });
  f.time(0); f.audio.emit('pause'); assert.equal(f.value().time, 75);
  f.metadata(120, false); f.audio.emit('timeupdate'); f.audio.emit('pause'); assert.equal(f.writes(), 0);
  f.settle(); assert.equal(f.audio.currentTime, 75);
});
test('normal forward timeupdate persists progress', () => { const f = ready({ saved: { index: 0, time: 60 } }); f.time(75); assert.deepEqual(f.value(), { index: 0, time: 75 }); });
test('duplicate second does not produce duplicate storage writes', () => { const f = ready(); f.time(5.1); f.time(5.8); f.audio.emit('pause'); assert.equal(f.writes(), 1); });
test('pause saves a new valid position', () => { const f = ready(); f.audio._time = 42; f.audio.emit('pause'); assert.equal(f.value().time, 42); });
test('same-track error retry preserves 75 seconds through load and restore', () => {
  const f = ready({ saved: { index: 0, time: 60 } }); f.time(75); f.fail(); f.tracks[0].click();
  assert.equal(f.value().time, 75); assert.equal(f.audio.currentTime, 0); f.metadata(); assert.equal(f.audio.currentTime, 75); assert.equal(f.value().time, 75);
});
test('dedicated Retry preserves bookmark', () => { const f = ready({ saved: { index: 0, time: 75 } }); f.fail(); f.e.retry.click(); f.metadata(); assert.equal(f.audio.currentTime, 75); });
test('same-track selection without an error also resumes', () => { const f = ready(); f.time(25); f.tracks[0].click(); f.metadata(); assert.equal(f.audio.currentTime, 25); });
test('repeated failures during retry never overwrite the pending bookmark', () => {
  const f = ready({ saved: { index: 0, time: 75 } });
  for (let i = 0; i < 3; i++) { f.fail(); f.e.retry.click(); f.time(0); assert.equal(f.value().time, 75); }
  f.metadata(); assert.equal(f.audio.currentTime, 75);
});
test('delayed metadata leaves retry and restart controls usable', () => { const f = setup({ saved: { index: 0, time: 75 } }); f.e.retry.click(); assert.equal(f.audio.loads, 2); assert.equal(f.value().time, 75); f.metadata(); assert.equal(f.audio.currentTime, 75); });
test('wrong-position seeked event cannot overwrite the requested resume', () => { const f = setup({ saved: { index: 0, time: 75 } }); f.metadata(120, false); f.audio._time = 0; f.settle(); assert.equal(f.value().time, 75); f.audio._time = 75; f.settle(); assert.equal(f.audio.currentTime, 75); });
test('selecting another track cancels a pending old resume', () => { const f = setup({ saved: { index: 0, time: 75 } }); f.tracks[1].click(); assert.equal(f.value().time, 75); f.metadata(); assert.deepEqual(f.value(), { index: 1, time: 0 }); assert.equal(f.audio.currentTime, 0); });
test('Start chapter over deliberately resets only after readiness', () => { const f = ready({ saved: { index: 0, time: 75 } }); f.e.restart.click(); assert.equal(f.value().time, 75); f.metadata(); assert.deepEqual(f.value(), { index: 0, time: 0 }); });
test('failed deliberate restart does not claim a stored reset', () => { const f = ready({ saved: { index: 0, time: 75 } }); f.e.restart.click(); f.fail(); assert.equal(f.value().time, 75); assert.doesNotMatch(f.e.status.textContent, /position is saved/); });
test('next and previous preserve intentional new-track semantics', () => { const f = ready(); f.time(20); f.e.next.click(); f.metadata(); assert.deepEqual(f.value(), { index: 1, time: 0 }); f.e.prev.click(); f.metadata(); assert.deepEqual(f.value(), { index: 0, time: 0 }); });
test('first previous and final next remain disabled', () => { const f = ready(); assert.equal(f.e.prev.disabled, true); f.tracks[2].click(); f.metadata(); assert.equal(f.e.next.disabled, true); });
test('only one selected track has aria-current', () => { const f = ready(); f.tracks[2].click(); assert.equal(f.tracks.filter(t => t.attrs.get('aria-current') === 'true').length, 1); assert.equal(f.tracks[2].attrs.get('aria-current'), 'true'); });
test('genuine ended advances to next track', () => { const f = ready(); f.audio._time = 120; f.audio.ended = true; f.audio.emit('ended'); f.metadata(); assert.deepEqual(f.value(), { index: 1, time: 0 }); });
test('late ended during a new load does not advance another track', () => { const f = ready(); f.tracks[1].click(); f.audio.ended = true; f.audio.emit('ended'); f.audio.ended = false; f.metadata(); assert.equal(f.e.title.textContent, 'Synthetic 1'); });
test('storage-write failure replaces the saved message and preserves old stored position', () => { const f = ready({ saved: { index: 0, time: 60 } }); f.access.writeDenied = true; f.time(75); assert.equal(f.value().time, 60); assert.match(f.e.status.textContent, /not being saved/); });
test('same-second write can recover because failed write did not advance marker', () => { const f = ready(); f.access.writeDenied = true; f.time(75); assert.equal(f.value(), null); f.access.writeDenied = false; f.time(75); assert.equal(f.value().time, 75); assert.match(f.e.status.textContent, /position is saved/); });
test('retry retains latest in-memory position even if storage failed', () => { const f = ready({ saved: { index: 0, time: 60 } }); f.access.writeDenied = true; f.time(75); f.fail(); f.e.retry.click(); f.metadata(); assert.equal(f.audio.currentTime, 75); assert.equal(f.value().time, 60); assert.match(f.e.status.textContent, /not being saved/); });
test('read denial does not overwrite unread bookmark on initial zero events', () => { const f = ready({ saved: { index: 0, time: 60 }, readDenied: true }); f.time(0); f.audio.emit('pause'); assert.equal(f.value().time, 60); assert.equal(f.writes(), 0); assert.match(f.e.status.textContent, /not being saved/); });
test('read denial can recover on deliberate playback progress', () => { const f = ready({ readDenied: true }); f.time(12); assert.equal(f.value().time, 12); assert.match(f.e.status.textContent, /position is saved/); });
test('reload from successfully stored record restores last position', () => { const f = ready(); f.time(75); const g = ready({ saved: f.value() }); assert.equal(g.audio.currentTime, 75); });
test('user seek backwards is a valid new bookmark', () => { const f = ready({ saved: { index: 0, time: 75 } }); f.audio.currentTime = 20; f.settle(); assert.equal(f.value().time, 20); });
for (const value of [NaN, Infinity, -1]) test(`invalid current time ${value} cannot overwrite bookmark`, () => { const f = ready({ saved: { index: 0, time: 75 } }); f.time(value); assert.equal(f.value().time, 75); });
for (const saved of ['{broken', { index: 0.5, time: 75 }, { index: -1, time: 75 }, { index: 20, time: 75 }, { index: 0, time: -1 }, { index: 0, time: '75' }]) test(`invalid stored record is not applied or deleted: ${JSON.stringify(saved)}`, () => { const f = ready({ saved }); assert.equal(f.audio.currentTime, 0); assert.equal(f.writes(), 0); });
test('oversized saved time clamps to duration without seeking out of range', () => { const f = ready({ saved: { index: 0, time: 500 } }); assert.equal(f.audio.currentTime, 119); assert.equal(f.value().time, 119); });
test('nonfinite metadata waits without overwriting pending position', () => { const f = setup({ saved: { index: 0, time: 75 } }); f.metadata(Infinity); assert.equal(f.value().time, 75); f.metadata(); assert.equal(f.audio.currentTime, 75); });
test('failed seek preserves bookmark and exposes recovery text', () => { const f = ready({ saved: { index: 0, time: 75 }, seekThrows: true }); assert.equal(f.value().time, 75); assert.match(f.e.status.textContent, /temporarily unavailable/); });
test('failed load preserves bookmark and exposes recovery text', () => { const f = setup({ saved: { index: 0, time: 75 }, loadThrows: true }); assert.equal(f.value().time, 75); assert.match(f.e.status.textContent, /temporarily unavailable/); });
test('current play rejection shows manual Play instruction', async () => { const f = ready(); f.audio.play = () => Promise.reject(Error('policy')); f.e.retry.click(); f.metadata(); await Promise.resolve(); await Promise.resolve(); assert.match(f.e.status.textContent, /Press Play/); });
test('old play rejection cannot overwrite newer loading status', async () => { const f = ready(); let reject; f.audio.play = () => new Promise((_, r) => { reject = r; }); f.e.retry.click(); f.metadata(); f.tracks[1].click(); reject(Error('old')); await Promise.resolve(); await Promise.resolve(); assert.match(f.e.status.textContent, /Loading this chapter/); assert.doesNotMatch(f.e.status.textContent, /Press Play/); });
test('media failure alone never starts an automatic reload', () => { const f = ready(); const n = f.audio.loads; f.fail(); assert.equal(f.audio.loads, n); });
test('speed control retains existing playback-rate action', () => { const f = ready(); f.e.speed.value = '1.5'; f.e.speed.emit('change'); assert.equal(f.audio.playbackRate, 1.5); });
test('renderer wires exact serializer, explicit controls and neutral initial status', () => { const s = fs.readFileSync(new URL('../src/lib/audiobook-handler.js', import.meta.url), 'utf8'); assert.match(s, /\$\{renderAudiobookPlayerScript\(\)\}/); assert.match(s, /data-retry>Retry chapter/); assert.match(s, /data-restart>Start chapter over/); assert.match(s, /Listening progress will be saved on this device when available/); });
