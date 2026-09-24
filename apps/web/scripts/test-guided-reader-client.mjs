import assert from 'node:assert/strict';
import vm from 'node:vm';
import { test } from 'node:test';
import { renderGuidedReaderScript } from '../src/lib/guided-reader-client.js';

// No real HTTP, accounts, storage or browser is used by this suite.
// Native Node Response/streams/AbortController are used with a mocked DOM.
const chapter = {
  contentId: 'guided-edition:fixture',
  sections: [{ id: 'section-one' }, { id: 'section-two' }],
  mastery: { questions: Array.from({ length: 5 }, (_, i) => ({
    questionId: `q-${i + 1}`, correctOptionId: 'NEVER_RENDER_ANSWER', prompt: 'Not sent to this script',
  })) },
};
const rendered = renderGuidedReaderScript(chapter);
const script = rendered.slice('<script>'.length, -'</script>'.length);
const checkpoint = (extra = {}) => ({
  contentId: chapter.contentId, status: 'in_progress', progressPercent: 60,
  resumePosition: 'section-one', attemptCount: 0, ...extra,
});
const success = (mastery = false, passed = true) => mastery ? {
  ok: true, passed, score: passed ? 100 : 60,
  feedback: passed ? 'Mastery passed: 5 of 5 answers correct.' : 'Mastery not yet passed: 3 of 5 answers correct.',
  questionResults: chapter.mastery.questions.map(({ questionId }, i) => ({
    questionId, correct: passed || i < 3, feedback: 'Synthetic feedback', reviewSectionId: 'section-two',
  })),
  progress: checkpoint({ status: passed ? 'completed' : 'in_progress', progressPercent: passed ? 100 : 98, attemptCount: 2 }),
} : { ok: true, progress: checkpoint() };

function element() {
  return {
    disabled: false, textContent: '', value: 25, dataset: {}, children: [], listeners: {},
    addEventListener(name, fn) { this.listeners[name] = fn; },
    append(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
  };
}
function response(body, { status = 200, contentType = 'application/json', raw = false } = {}) {
  return new Response(raw ? body : JSON.stringify(body), { status, headers: { 'content-type': contentType } });
}
function setup(fetchImpl, { realTimers = false, formDataThrows = false } = {}) {
  const elements = Object.fromEntries(['chapter-progress', 'chapter-percent', 'reader-status',
    'mastery-status', 'mastery-feedback', 'mastery-form'].map((id) => [id, element()]));
  elements['chapter-percent'].textContent = '25%';
  elements['mastery-feedback'].children = ['previous confirmed feedback'];
  const saves = [element(), element()];
  saves[0].dataset = { position: 'section-one', progress: '60' };
  saves[1].dataset = { position: 'section-two', progress: '80' };
  const submit = element();
  elements['mastery-form'].querySelector = () => submit;
  const calls = [];
  const timers = new Map();
  let nextTimer = 0;
  const document = {
    getElementById: (id) => elements[id] ?? null,
    querySelectorAll: (selector) => selector === '.save-place' ? saves : [],
    createElement: () => element(),
  };
  const context = vm.createContext({
    document, AbortController, TextDecoder, Uint8Array, Response, ReadableStream,
    setTimeout: realTimers ? setTimeout : (fn, ms) => {
      const id = ++nextTimer; timers.set(id, { fn, ms }); return id;
    },
    clearTimeout: realTimers ? clearTimeout : (id) => timers.delete(id),
    fetch: async (url, options) => { calls.push({ url, options }); return fetchImpl(url, options, calls.length); },
    FormData: class {
      constructor(target) {
        assert.equal(target, elements['mastery-form']);
        if (formDataThrows) throw new Error('Synthetic preparation failure');
      }
      entries() { return chapter.mastery.questions.map(({ questionId }) => [questionId, 'option-one'])[Symbol.iterator](); }
    },
  });
  vm.runInContext(script, context, { timeout: 1000 });
  return {
    elements, saves, submit, calls, timers, document,
    click: (index = 0) => saves[index].listeners.click(),
    mastery: () => elements['mastery-form'].listeners.submit({ preventDefault() {}, currentTarget: elements['mastery-form'] }),
    timeout() {
      assert.equal(timers.size, 1);
      const timer = [...timers.values()][0];
      assert.equal(timer.ms, 15_000);
      timer.fn();
    },
  };
}
const drain = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function restored(ui) {
  assert.equal(ui.saves[0].disabled, false);
  assert.equal(ui.saves[1].disabled, false);
  assert.equal(ui.submit.disabled, false);
  assert.equal(ui.timers.size, 0);
}
function unchanged(ui) {
  assert.equal(ui.elements['chapter-progress'].value, 25);
  assert.equal(ui.elements['chapter-percent'].textContent, '25%');
  assert.deepEqual(ui.elements['mastery-feedback'].children, ['previous confirmed feedback']);
}
async function uncertain(mastery, replyFactory) {
  const ui = setup(replyFactory);
  await (mastery ? ui.mastery() : ui.click());
  restored(ui);
  unchanged(ui);
  const status = ui.elements[mastery ? 'mastery-status' : 'reader-status'];
  assert.equal(status.dataset.state, 'error');
  assert.match(status.textContent, /could not be confirmed/);
  assert.match(status.textContent, /Reload this chapter/);
  assert.doesNotMatch(status.textContent, /SECRET_SENTINEL|Bearer|synthetic private/);
  await ui.click();
  await ui.mastery();
  assert.equal(ui.calls.length, 1, 'No replay in the same page after an uncertain result');
  return ui;
}

await test('Renderer includes public identifiers only and escapes script-ending input', () => {
  assert.doesNotMatch(rendered, /NEVER_RENDER_ANSWER|Not sent to this script/);
  const hostile = renderGuidedReaderScript({ ...chapter, contentId: '</script><script>attack()</script>' });
  assert.equal((hostile.match(/<\/script>/g) || []).length, 1);
  assert.ok(hostile.includes('\\u003c/script>'));
  assert.equal(rendered, renderGuidedReaderScript(chapter));
});

for (const mastery of [false, true]) {
  const label = mastery ? 'mastery' : 'save';
  await test(`${label}: valid success restores controls and uses confirmed progress`, async () => {
    const ui = setup(() => response(success(mastery)));
    await (mastery ? ui.mastery() : ui.click());
    restored(ui);
    assert.equal(ui.calls.length, 1);
    assert.equal(ui.elements['chapter-progress'].value, mastery ? 100 : 60);
    assert.equal(ui.elements[mastery ? 'mastery-status' : 'reader-status'].dataset.state, 'success');
    const { url, options } = ui.calls[0];
    assert.equal(url, '/api/guided-edition?action=' + (mastery ? 'mastery' : 'progress'));
    assert.equal(options.method, mastery ? 'POST' : 'PATCH');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Content-Type'], 'application/json');
    const payload = JSON.parse(options.body);
    assert.equal(payload.contentId, chapter.contentId);
    assert.equal(options.signal.aborted, true, 'Request resource cleanup after completion');
    assert.equal(Object.keys(payload).sort().join(','), mastery ? 'answers,contentId' : 'contentId,progressPercent,resumePosition');
  });
  await test(`${label}: network rejection restores controls without a false confirmation`, async () => {
    await uncertain(mastery, () => { throw new TypeError('SECRET_SENTINEL synthetic private'); });
  });
  await test(`${label}: HTTP 401 does not become save success or expose diagnostics`, async () => {
    await uncertain(mastery, () => response({ error: 'SECRET_SENTINEL' }, { status: 401 }));
  });
  await test(`${label}: HTTP 503 is unconfirmed and is not automatically retried`, async () => {
    await uncertain(mastery, () => response({ error: 'SECRET_SENTINEL' }, { status: 503 }));
  });
  await test(`${label}: malformed JSON is unconfirmed`, async () => {
    await uncertain(mastery, () => response('{', { raw: true }));
  });
  await test(`${label}: HTML login response cannot confirm a save`, async () => {
    await uncertain(mastery, () => response('<html>Sign in</html>', { raw: true, contentType: 'text/html' }));
  });
  await test(`${label}: redirected response is rejected`, async () => {
    await uncertain(mastery, () => {
      const reply = response(success(mastery)); Object.defineProperty(reply, 'redirected', { value: true }); return reply;
    });
  });
  await test(`${label}: missing checkpoint is unconfirmed`, async () => {
    await uncertain(mastery, () => response({ ok: true }));
  });
  await test(`${label}: wrong chapter checkpoint is rejected`, async () => {
    await uncertain(mastery, () => {
      const body = success(mastery); body.progress.contentId = 'guided-edition:other'; return response(body);
    });
  });
  await test(`${label}: numeric strings are not accepted as progress`, async () => {
    await uncertain(mastery, () => {
      const body = success(mastery); body.progress.progressPercent = '60'; return response(body);
    });
  });
  await test(`${label}: timeout at headers restores controls with no late UI change`, async () => {
    let resolveReply;
    const ui = setup(() => new Promise((resolve) => { resolveReply = resolve; }));
    const pending = mastery ? ui.mastery() : ui.click();
    await drain(); ui.timeout(); await pending;
    restored(ui); unchanged(ui);
    assert.equal(ui.calls[0].options.signal.aborted, true);
    resolveReply(response(success(mastery)));
    await drain(); unchanged(ui);
    await ui.mastery(); await ui.click();
    assert.equal(ui.calls.length, 1);
  });
  await test(`${label}: timeout while reading a stalled body restores controls`, async () => {
    let stream;
    const ui = setup(() => new Response(new ReadableStream({ start(c) { stream = c; } }), {
      headers: { 'content-type': 'application/json' },
    }));
    const pending = mastery ? ui.mastery() : ui.click();
    await drain(); ui.timeout(); await pending;
    restored(ui); unchanged(ui);
    stream.enqueue(new TextEncoder().encode(JSON.stringify(success(mastery)))); stream.close();
    await drain(); unchanged(ui);
    assert.equal(ui.calls.length, 1);
  });
}

await test('Shared in-flight guard blocks double-click and save/mastery overlap', async () => {
  let finish;
  const ui = setup(() => new Promise((resolve) => { finish = resolve; }));
  const first = ui.click();
  await drain();
  assert.ok(ui.saves.every((s) => s.disabled) && ui.submit.disabled);
  await ui.click(1); await ui.mastery();
  assert.equal(ui.calls.length, 1);
  finish(response(success())); await first;
  restored(ui);
});
await test('Prior disabled state is restored instead of enabling unrelated controls', async () => {
  const ui = setup(() => response(success()));
  ui.saves[1].disabled = true;
  await ui.click();
  assert.equal(ui.saves[1].disabled, true);
  assert.equal(ui.saves[0].disabled, false);
});
await test('FormData preparation failure restores controls and dispatches nothing', async () => {
  const ui = setup(() => { throw new Error('must not fetch'); }, { formDataThrows: true });
  await ui.mastery();
  restored(ui); unchanged(ui); assert.equal(ui.calls.length, 0);
  assert.match(ui.elements['mastery-status'].textContent, /could not be prepared/);
});
await test('Body at exactly 16384 bytes is accepted', async () => {
  const text = JSON.stringify(success());
  const ui = setup(() => response(text.padEnd(16_384, ' '), { raw: true }));
  await ui.click(); restored(ui);
  assert.equal(ui.elements['reader-status'].dataset.state, 'success');
});
await test('Body of 16385 bytes is rejected', async () => {
  await uncertain(false, () => response(JSON.stringify(success()).padEnd(16_385, ' '), { raw: true }));
});
await test('UTF-8 byte limit counts bytes, not JavaScript characters', async () => {
  await uncertain(false, () => response({ ...success(), padding: '\u20ac'.repeat(6000) }));
});
await test('Broken response stream cannot produce success', async () => {
  await uncertain(false, () => new Response(new ReadableStream({
    start(c) { c.error(new Error('SECRET_SENTINEL')); },
  }), { headers: { 'content-type': 'application/json' } }));
});
await test('Default/fabricated zero checkpoint does not acknowledge requested save', async () => {
  await uncertain(false, () => response({ ok: true, progress: checkpoint({ status: 'started', progressPercent: 0 }) }));
});
await test('Save must acknowledge the selected section', async () => {
  await uncertain(false, () => response({ ok: true, progress: checkpoint({ resumePosition: 'section-two' }) }));
});
await test('Previously completed progress can remain 100 on a later save', async () => {
  const ui = setup(() => response({ ok: true, progress: checkpoint({ status: 'completed', progressPercent: 100 }) }));
  await ui.click(); restored(ui);
  assert.equal(ui.elements['chapter-progress'].value, 100);
});
await test('A recorded unsuccessful mastery attempt displays its feedback, not a transport failure', async () => {
  const ui = setup(() => response(success(true, false)));
  await ui.mastery(); restored(ui);
  assert.equal(ui.elements['chapter-progress'].value, 98);
  assert.match(ui.elements['mastery-status'].textContent, /Mastery not yet passed/);
  assert.equal(ui.elements['mastery-feedback'].children.length, 5);
  assert.equal(ui.elements['mastery-feedback'].children[4].children[0].href, '#section-two');
});
await test('An unsuccessful retake may preserve previously completed progress', async () => {
  const body = success(true, false); body.progress.status = 'completed'; body.progress.progressPercent = 100;
  const ui = setup(() => response(body));
  await ui.mastery(); restored(ui);
  assert.equal(ui.elements['chapter-progress'].value, 100);
});
for (const [label, mutate] of [
  ['inconsistent score', (body) => { body.score = 80; }],
  ['wrong passed flag', (body) => { body.passed = false; }],
  ['duplicate question', (body) => { body.questionResults[1].questionId = 'q-1'; }],
  ['missing question', (body) => { body.questionResults.pop(); }],
  ['unknown review section', (body) => { body.questionResults[0].reviewSectionId = 'other'; }],
  ['unrecorded attempt', (body) => { body.progress.attemptCount = 0; }],
]) {
  await test(`Mastery rejects ${label} before changing the confirmed display`, async () => {
    await uncertain(true, () => { const body = success(true); mutate(body); return response(body); });
  });
}
await test('Feedback is inserted as text, never HTML', async () => {
  const body = success(true); body.feedback = '<img src=x onerror=attack()>';
  body.questionResults[0].feedback = '<script>attack()</script>';
  const ui = setup(() => response(body));
  await ui.mastery();
  assert.equal(ui.elements['mastery-status'].textContent, body.feedback);
  assert.equal(ui.elements['mastery-feedback'].children[0].textContent, body.questionResults[0].feedback);
});
await test('A completed success allows a later deliberate action without auto replay', async () => {
  const ui = setup((url) => response(success(url.endsWith('mastery'))));
  await ui.click(); await ui.mastery(); restored(ui);
  assert.equal(ui.calls.length, 2);
});
console.log('Guided reader recovery: offline VM/DOM fixtures; no live HTTP, database, browser or capacity test.');

// Focus is restored only when native disabling lost it and no later navigation occurred.
function focusFixture(ui, target) {
  const documentEvents = new Map();
  const windowEvents = new Map();
  const install = (map) => ({
    addEventListener(name, listener) { map.set(name, listener); },
    removeEventListener(name, listener) { assert.equal(map.get(name), listener); map.delete(name); },
  });
  Object.assign(ui.document, install(documentEvents), {
    body: {}, documentElement: {}, activeElement: target, hasFocus: () => true,
    defaultView: install(windowEvents),
  });
  const focusCalls = [];
  let disabled = target.disabled;
  target.isConnected = true;
  target.focus = (options) => { focusCalls.push(options); ui.document.activeElement = target; };
  Object.defineProperty(target, 'disabled', {
    get: () => disabled,
    set(value) {
      disabled = value;
      if (value && ui.document.activeElement === target) ui.document.activeElement = ui.document.body;
    },
  });
  return {
    focusCalls,
    move(name) { (name === 'blur' ? windowEvents : documentEvents).get(name)?.(); },
    cleaned() { assert.equal(documentEvents.size, 0); assert.equal(windowEvents.size, 0); },
  };
}
for (const mastery of [false, true]) {
  for (const failure of [false, true]) {
    await test(`focus: ${mastery ? 'mastery' : 'save'} ${failure ? 'uncertain' : 'success'} restores original control`, async () => {
      const ui = setup(() => { if (failure) throw new TypeError('synthetic'); return response(success(mastery)); });
      const target = mastery ? ui.submit : ui.saves[0];
      const f = focusFixture(ui, target);
      await (mastery ? ui.mastery() : ui.click());
      assert.equal(ui.document.activeElement, target);
      assert.equal(f.focusCalls.length, 1);
      assert.equal(f.focusCalls[0].preventScroll, true);
      f.cleaned(); restored(ui);
    });
  }
}
for (const event of ['focusin', 'pointerdown', 'keydown', 'blur']) {
  await test(`focus: later ${event} prevents recovery from stealing focus`, async () => {
    let release;
    const ui = setup(() => new Promise((resolve) => { release = resolve; }));
    const f = focusFixture(ui, ui.saves[0]);
    const pending = ui.click(); await drain();
    f.move(event); release(response(success())); await pending;
    assert.equal(f.focusCalls.length, 0); f.cleaned(); restored(ui);
  });
}
for (const reason of ['removed', 'different-control', 'background']) {
  await test(`focus: ${reason} suppresses unsafe restoration`, async () => {
    let release;
    const ui = setup(() => new Promise((resolve) => { release = resolve; }));
    const f = focusFixture(ui, ui.saves[0]);
    const pending = ui.click(); await drain();
    if (reason === 'removed') ui.saves[0].isConnected = false;
    if (reason === 'different-control') ui.document.activeElement = {};
    if (reason === 'background') ui.document.hasFocus = () => false;
    release(response(success())); await pending;
    assert.equal(f.focusCalls.length, 0); f.cleaned(); restored(ui);
  });
}
await test('focus: timeout restores once and late completion never refocuses', async () => {
  let release;
  const ui = setup(() => new Promise((resolve) => { release = resolve; }));
  const f = focusFixture(ui, ui.saves[0]);
  const pending = ui.click(); await drain(); ui.timeout(); await pending;
  assert.equal(f.focusCalls.length, 1); f.cleaned(); restored(ui); unchanged(ui);
  release(response(success())); await drain();
  assert.equal(f.focusCalls.length, 1); unchanged(ui);
});
