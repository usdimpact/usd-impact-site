import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifySyntheticEvidence, planMethodologyDryRun, SYNTHETIC_PROBE_SOURCES } from './methodology-schedule.mjs';

const run = (clock, kind = 'quiet') => planMethodologyDryRun({ asOfUtc: clock, sources: SYNTHETIC_PROBE_SOURCES[kind] });

test('EST and EDT use a 17:00 America/New_York cutoff', () => {
  assert.equal(run('2026-11-03T21:59:00Z').dry_run_state, 'BEFORE_CUTOFF_HOLD');
  assert.equal(run('2026-11-03T22:37:00Z').dry_run_state, 'DRAFT_ELIGIBLE');
  assert.equal(run('2026-07-02T20:59:00Z').dry_run_state, 'BEFORE_CUTOFF_HOLD');
  assert.equal(run('2026-07-02T21:37:00Z').dry_run_state, 'DRAFT_ELIGIBLE');
});

test('on Friday, a Weekly method review can be proposed without a real Score', () => {
  const r = run('2026-11-06T22:37:00Z', 'single');
  assert.deepEqual(r.proposed_candidates, { daily: true, weekly: true, monthly: false });
  assert.equal(r.constraints.existing_weekly_score_gate_unchanged, true);
  assert.equal(r.constraints.public_release_authorized, false);
});

test('calendar-month final weekday is a proposed month review only', () => {
  const a = run('2026-11-30T22:37:00Z', 'single');
  assert.equal(a.proposed_candidates.monthly, true);
  const b = run('2027-01-29T22:37:00Z', 'multi');
  assert.equal(b.proposed_candidates.weekly, true);
  assert.equal(b.proposed_candidates.monthly, true);
  assert.equal(b.constraints.existing_monthly_four_weeklies_gate_unchanged, true);
  assert.equal(b.constraints.actual_holidays_not_verified, true);
});

test('weekends cannot generate even a fictional draft candidate', () => {
  const r = run('2026-11-07T22:37:00Z', 'multi');
  assert.equal(r.dry_run_state, 'WEEKEND_HOLD');
  assert.deepEqual(r.proposed_candidates, { daily: false, weekly: false, monthly: false });
});

test('zero new evidence is a quiet-day educational exercise, not fabricated news', () => {
  const r = run('2026-11-03T22:37:00Z');
  assert.equal(r.hypothetical_review.kind, 'QUIET_DAY_EXERCISE_DRAFT');
  assert.equal(r.hypothetical_review.count, 0);
  assert.equal(r.proposed_candidates.daily, true);
  assert.equal(r.constraints.existing_news_source_minimum_unchanged, true);
});

test('one invented evidence item can prompt analysis but never publication', () => {
  const r = run('2026-11-03T22:37:00Z', 'single');
  assert.equal(r.hypothetical_review.kind, 'SINGLE_SOURCE_METHOD_DRAFT');
  assert.equal(r.constraints.public_release_authorized, false);
});

test('multiple invented items can prompt a comparison draft without causal claims', () => {
  const r = run('2026-11-03T22:37:00Z', 'multi');
  assert.equal(r.hypothetical_review.kind, 'MULTI_SOURCE_COMPARISON_DRAFT');
  assert.equal(r.proposed_candidates.daily, true);
});

test('unverified or denied source means explicit source HOLD', () => {
  const r = run('2026-11-03T22:37:00Z', 'denied');
  assert.equal(r.hypothetical_review.kind, 'SOURCE_HOLD');
  assert.deepEqual(r.proposed_candidates, { daily: false, weekly: false, monthly: false });
});

test('real or provider data, excess source count, duplicate IDs and schema changes fail', () => {
  assert.throws(() => classifySyntheticEvidence([{id:'ICE:USDX', kind:'real', verified:true, permitted:true}]), /real or provider/);
  assert.throws(() => classifySyntheticEvidence([...SYNTHETIC_PROBE_SOURCES.multi, ...SYNTHETIC_PROBE_SOURCES.multi]), /duplicate/);
  assert.throws(() => classifySyntheticEvidence(Array.from({length:13}, (_,i)=>({id:`SYNTHETIC:SOURCE:AB${i}`,kind:'invented',verified:true,permitted:true}))), /list required/);
  assert.throws(() => classifySyntheticEvidence([{id:'SYNTHETIC:SOURCE:THREE',kind:'invented',verified:true,permitted:true,market_price:22}]), /unexpected source/);
});

test('idempotent date identity and non-mutating output contract', () => {
  const a = run('2026-11-03T22:37:00Z', 'multi');
  const b = run('2026-11-03T22:37:00Z', 'multi');
  assert.deepEqual(a, b);
  assert.equal(a.edition_key, 'SYNTHETIC:EOD:2026-11-03');
  assert.equal(a.constraints.rights_not_granted, true);
  assert.equal(a.constraints.editorial_review_required, true);
});

test('workflow contract is read-only, not a disguised new News publisher', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/eod-methodology-dry-run.yml', import.meta.url), 'utf8');
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(workflow, /USD_IMPACT_EOD_RESEARCH_ENABLE/);
  assert.match(workflow, /America\/New_York/);
  assert.match(workflow, /37 17 \* \* 1-5/);
  assert.match(workflow, /node --test research\/eod-methodology-offline\/test\.mjs research\/eod-methodology-offline\/methodology-schedule\.test\.mjs/);
  assert.doesNotMatch(workflow, /NEWSFEED_|gh pr create|curl\s|api\.vercel|contents: write|pull-requests: write|workflow_run:/);
});
