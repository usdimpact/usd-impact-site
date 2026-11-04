import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import {
  COPY, LANGUAGES, TOTAL_STEPS, initialState, isComplete, questionFeedback, updateState,
} from '../src/lib/five-minute-guide-model.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (relative) => readFileSync(resolve(dir, relative), 'utf8');
const route = read('../src/pages/[...slug].astro');
const view = read('../src/components/StartHereFiveMinuteGuide.astro');

const toQuiz = () => Array.from({ length: TOTAL_STEPS - 1 }).reduce(
  (state) => updateState(state, { type: 'NEXT' }), initialState()
);

for (const locale of LANGUAGES) {
  test(`${locale}: parity, answer combinations and explanations`, () => {
    assert.equal(COPY[locale].steps.length, TOTAL_STEPS);
    assert.equal(COPY[locale].questions.length, 2);
    for (const [first, second, expected] of [
      [null, null, false], ['no', null, false], [null, 'yes', false],
      ['no', 'no', true], ['no', 'yes', true], ['yes', 'no', true], ['yes', 'yes', true],
    ]) {
      let state = updateState(toQuiz(), { type: 'LOCALE', value: locale });
      if (first) state = updateState(state, { type: 'ANSWER', index: 0, value: first });
      if (second) state = updateState(state, { type: 'ANSWER', index: 1, value: second });
      assert.equal(isComplete(state), expected);
      assert.equal(Boolean(questionFeedback(state, 0)), Boolean(first));
      assert.equal(Boolean(questionFeedback(state, 1)), Boolean(second));
      if (first) assert.equal(questionFeedback(state, 0), first === 'no' ? COPY[locale].questions[0].correct : COPY[locale].questions[0].incorrect);
      if (second) assert.equal(questionFeedback(state, 1), second === 'no' ? COPY[locale].questions[1].correct : COPY[locale].questions[1].incorrect);
    }
  });

  test(`${locale}: navigation, locale and reset`, () => {
    let state = updateState(toQuiz(), { type: 'LOCALE', value: locale });
    state = updateState(state, { type: 'ANSWER', index: 0, value: 'no' });
    state = updateState(state, { type: 'ANSWER', index: 1, value: 'yes' });
    state = updateState(state, { type: 'BACK' });
    assert.equal(isComplete(state), false);
    assert.deepEqual(state.answers, ['no', 'yes']);
    state = updateState(state, { type: 'NEXT' });
    assert.equal(isComplete(state), true);
    state = updateState(state, { type: 'RESTART' });
    assert.equal(state.step, 0);
    assert.equal(state.locale, locale);
    assert.deepEqual(state.answers, [null, null]);
    assert.equal(initialState().step, 0);
    assert.deepEqual(initialState().answers, [null, null]);
    assert.equal(updateState(state, { type: 'ANSWER', index: 4, value: 'yes' }), state);
  });
}

test('fail-closed Preview-only integration; no public QA routes', () => {
  assert.match(route, /normalizedSlug === '\/start-here' && process\.env\.VERCEL_ENV === 'preview'/);
  assert.match(route, /\{isFiveMinuteGuidePreview && <StartHereFiveMinuteGuide \/>\}/);
  assert.equal((route.match(/<StartHereFiveMinuteGuide \/>/g) || []).length, 1);
  assert.doesNotMatch(route, /<StartHereFiveMinuteGuide\s*\/>\s*<ComplianceNote/);
  assert.doesNotMatch(view, /\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|\bXMLHttpRequest\b|\bWebSocket\b|<form\b/i);
  assert.match(view, /data-guide-completion role="status" aria-live="polite"/);
  assert.match(view, /container\.lang = state\.locale/);
  assert.match(view, /container\.hidden = false/);
  assert.match(view, /<progress/);
});
