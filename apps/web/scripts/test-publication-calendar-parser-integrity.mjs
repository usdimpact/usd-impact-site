import assert from 'node:assert/strict';
import { parseBlsCpiSchedule } from '../src/lib/bls-cpi-calendar.js';
import { scheduleHtml } from './fixtures/publication-calendar.js';

let tests = 0;
const test = (name, fn) => { fn(); tests += 1; };
const expectSchemaHold = (html) => assert.throws(
  () => parseBlsCpiSchedule(html, '2026-08'),
  (error) => error?.code === 'HOLD_SOURCE_SCHEMA',
);

const fakeTable = '<table><tr><th>Reference Month</th><th>Release Date</th><th>Release Time</th></tr><tr><td>August 2026</td><td>Sep. 10, 2026</td><td>09:30 AM</td></tr></table>';

test('baseline schedule remains parseable', () => {
  assert.equal(parseBlsCpiSchedule(scheduleHtml, '2026-08').eventDate, '2026-09-11');
});

test('comment-contained table tokens are ignored', () => {
  assert.equal(parseBlsCpiSchedule(`<!--${fakeTable}-->${scheduleHtml}`, '2026-08').eventDate, '2026-09-11');
});

test('script-contained table tokens are ignored', () => {
  assert.equal(parseBlsCpiSchedule(`<script type="application/json">${fakeTable}</script>${scheduleHtml}`, '2026-08').eventDate, '2026-09-11');
});

test('style-contained table tokens are ignored', () => {
  assert.equal(parseBlsCpiSchedule(`<style>${fakeTable}</style>${scheduleHtml}`, '2026-08').eventDate, '2026-09-11');
});

test('template-contained table tokens are ignored', () => {
  assert.equal(parseBlsCpiSchedule(`<template>${fakeTable}</template>${scheduleHtml}`, '2026-08').eventDate, '2026-09-11');
});

test('hidden schedule notice cannot change visible schedule state', () => {
  assert.equal(parseBlsCpiSchedule(`<script>CPI is postponed.</script>${scheduleHtml}`, '2026-08').eventDate, '2026-09-11');
});

test('visible schedule notice still fails closed', () => {
  assert.throws(
    () => parseBlsCpiSchedule(`${scheduleHtml}<p>CPI is postponed.</p>`, '2026-08'),
    (error) => error?.code === 'HOLD_SCHEDULE_CONFLICT',
  );
});

test('unterminated comment fails closed', () => {
  expectSchemaHold(`<!--${fakeTable}${scheduleHtml}`);
});

test('unterminated script fails closed', () => {
  expectSchemaHold(`<script>${fakeTable}${scheduleHtml}`);
});

test('unterminated template fails closed', () => {
  expectSchemaHold(`<template>${fakeTable}${scheduleHtml}`);
});

test('script-like custom element is not treated as script', () => {
  assert.equal(parseBlsCpiSchedule(`<scripture>ordinary text</scripture>${scheduleHtml}`, '2026-08').eventDate, '2026-09-11');
});

test('fake closing table token inside script cannot corrupt table ownership', () => {
  assert.equal(parseBlsCpiSchedule(`<script></table>${fakeTable}</script>${scheduleHtml}`, '2026-08').eventDate, '2026-09-11');
});

console.log(`Publication calendar parser integrity: ${tests} adversarial regression groups passed.`);
