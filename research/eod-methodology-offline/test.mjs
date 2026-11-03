import test from 'node:test';
import assert from 'node:assert/strict';
import { daily, weekly, monthly, render, validateDailyFixture, syntheticScore, fixtureContract } from './engine.mjs';
import { fixtureDay, buildFourWeeks, inventedScoreInputs, demonstrate } from './fixtures.mjs';

const base = () => fixtureDay('2100-02-01', 0);
const modified = (change) => { const f = base(); change(f); return f; };
const rejected = (fn, rx) => assert.throws(fn, rx);

test('full fictional February has 20 valid Dailies, four Weeklies and a calendar Monthly', () => {
  const { dailies, weeks, month } = buildFourWeeks();
  assert.equal(dailies.length, 20); assert.equal(weeks.length, 4);
  assert.equal(month.from, '2100-02-01'); assert.equal(month.to, '2100-02-28');
  assert.equal(month.facts.length, 40); assert.equal(month.status, 'SYNTHETIC_ONLY_HOLD');
  assert.equal(month.public_release_authorized, false);
});

test('daily output is deterministic and contains no network actions', () => {
  assert.deepEqual(daily(base()), daily(base()));
  assert.deepEqual(demonstrate(), demonstrate());
});

test('New York cutoff applies independently of UTC and DST', () => {
  const nov = fixtureDay('2026-11-02', 1);
  nov.facts.forEach(f => { f.published_at_utc = '2026-11-02T20:15:00Z'; });
  nov.as_of_utc = '2026-11-02T21:59:00Z';
  rejected(() => daily(nov), /before proposed/);
  nov.as_of_utc = '2026-11-02T22:00:00Z';
  assert.doesNotThrow(() => daily(nov));
  const oct = fixtureDay('2026-10-23', 1);
  oct.facts.forEach(f => { f.published_at_utc = '2026-10-23T20:15:00Z'; });
  oct.as_of_utc = '2026-10-23T20:59:00Z';
  rejected(() => daily(oct), /before proposed/);
  oct.as_of_utc = '2026-10-23T21:00:00Z';
  assert.doesNotThrow(() => daily(oct));
});

test('weekends, invalid dates and as-of dates are rejected', () => {
  rejected(() => daily(modified(f => { f.day = '2100-02-06'; f.as_of_utc = '2100-02-06T23:05:00Z'; })), /weekend/);
  rejected(() => daily(modified(f => { f.day = '2100-02-30'; })), /calendar date/);
  rejected(() => daily(modified(f => { f.as_of_utc = '2100-02-02T23:05:00Z'; })), /as-of date/);
});

test('real, commercial, missing or unauthorized provenance cannot pass', () => {
  rejected(() => daily(modified(f => { f.facts[0].source_id = 'FRED:DGS10'; })), /real provider/);
  rejected(() => daily(modified(f => { f.facts[0].kind = 'real'; })), /unauthorized/);
  rejected(() => daily(modified(f => { f.facts[0].license = 'paid_vendor'; })), /unauthorized/);
  rejected(() => daily(modified(f => { f.fixture_marker = 'RIGHTS_CLEARED'; })), /non-synthetic/);
  rejected(() => daily(modified(f => { f.facts[0].url = 'https://example.com'; })), /unexpected/);
});

test('future releases, duplicate IDs and unsupported units fail', () => {
  rejected(() => daily(modified(f => { f.facts[0].published_at_utc = '2100-02-02T21:00:00Z'; })), /future source/);
  rejected(() => daily(modified(f => { f.facts[1].fact_id = f.facts[0].fact_id; })), /duplicate fact/);
  rejected(() => daily(modified(f => { f.facts[0].unit = 'bps'; })), /invalid synthetic value\/unit/);
});

test('Weekly requires exactly five contiguous Monday-Friday days, no duplicates', () => {
  const { dailies } = buildFourWeeks();
  rejected(() => weekly(dailies.slice(0, 4)), /five days/);
  rejected(() => weekly([dailies[0], dailies[1], dailies[2], dailies[3], dailies[5]]), /weekday/);
  rejected(() => weekly([dailies[0], dailies[0], dailies[2], dailies[3], dailies[4]]), /weekday/);
});

test('Monthly fails closed on incomplete, nonconsecutive and partial-month coverage', () => {
  const { weeks } = buildFourWeeks();
  rejected(() => monthly(weeks.slice(0, 3), '2100-02'), /closing/);
  rejected(() => monthly([weeks[0], weeks[2], weeks[3]], '2100-02'), /gap/);
  rejected(() => monthly(weeks, '2100-03'), /opening/);
});

test('language outputs share IDs, values, source provenance, counts and review state', () => {
  const { dailies, weeks, month } = buildFourWeeks();
  for (const report of [dailies[0], weeks[0], month]) {
    const en = render(report, 'en'), es = render(report, 'es');
    assert.deepEqual(en.canonical_fact_ids, es.canonical_fact_ids);
    assert.deepEqual(en.canonical_values, es.canonical_values);
    assert.deepEqual(en.source_ids, es.source_ids);
    assert.deepEqual(en.counts, es.counts);
    assert.equal(en.publish_allowed, false); assert.equal(es.publish_allowed, false);
    assert.match(es.markdown, /SOLO DATOS INVENTADOS/);
    assert.match(en.markdown, /INVENTED DATA ONLY/);
  }
});

test('EN/ES Daily, Weekly, Monthly and example Score direct readers to licensed, verified real data', () => {
  const { dailies, weeks, month } = buildFourWeeks();
  for (const record of [dailies[0], weeks[0], month]) {
    const en = render(record, 'en'), es = render(record, 'es');
    assert.match(en.markdown, /verified current data/);
    assert.match(en.markdown, /licensed or otherwise permitted/);
    assert.match(en.markdown, /release vintages/);
    assert.match(es.markdown, /datos actuales y verificados/);
    assert.match(es.markdown, /licencia o permiso válido/);
    assert.match(es.markdown, /versiones publicadas/);
    assert.ok(en.markdown.includes(en.data_guidance));
    assert.ok(es.markdown.includes(es.data_guidance));
    assert.equal(en.publish_allowed, false);
    assert.equal(es.publish_allowed, false);
  }
  const example = syntheticScore(inventedScoreInputs);
  assert.match(example.data_guidance.en, /licensed or otherwise permitted/);
  assert.match(example.data_guidance.es, /licencia o permiso válido/);
  assert.equal(example.status, 'SYNTHETIC_ONLY_HOLD');
  assert.equal(example.public_release_authorized, false);
});

test('translated rendering uses locale-safe precision, not translated source data', () => {
  const report = daily(fixtureDay('2100-02-02', 1));
  assert.match(render(report, 'en').markdown, /100\.25/);
  assert.match(render(report, 'es').markdown, /100,25/);
  rejected(() => render(report, 'pt'), /unapproved locale/);
  rejected(() => render({ ...report, public_release_authorized: true }, 'en'), /unapproved or mutated review/);
});

test('synthetic eight-input weighted and clipped Score reproduces existing private teaching value', () => {
  const result = syntheticScore(inventedScoreInputs);
  assert.equal(result.total, 0.2625); assert.equal(result.public_release_authorized, false);
  assert.equal(result.rows.length, 8);
  assert.ok(result.rows.every(x => Math.abs(x.clipped) <= 3.5));
  const clipping = inventedScoreInputs.map(x => ({ ...x }));
  clipping[0].x = 150;
  assert.equal(syntheticScore(clipping).rows[0].clipped, 3.5);
});

test('Score rejects real data, changed weights, incomplete histories and invalid std', () => {
  rejected(() => syntheticScore(inventedScoreInputs.slice(0, 7)), /eight/);
  rejected(() => syntheticScore(inventedScoreInputs.map((x, i) => i === 0 ? { ...x, fixture_marker: 'REAL' } : x)), /real or duplicate/);
  rejected(() => syntheticScore(inventedScoreInputs.map((x, i) => i === 0 ? { ...x, weight: 0.5 } : x)), /changed weights/);
  rejected(() => syntheticScore(inventedScoreInputs.map((x, i) => i === 0 ? { ...x, std: 0 } : x)), /invalid synthetic/);
});

test('attempted real-data injection into validated weekly/monthly inputs or render is rejected', () => {
  const { dailies, weeks, month } = buildFourWeeks();
  const wrong = structuredClone(dailies.slice(0, 5));
  wrong[0].facts[0].source_id = 'FRED:DGS10';
  rejected(() => weekly(wrong), /real provider/);
  const changed = structuredClone(weeks);
  changed[0].facts[0].license = 'commercial';
  rejected(() => monthly(changed, '2100-02'), /unauthorized/);
  rejected(() => render({ ...month, facts: [{ ...month.facts[0], source_id: 'CBOE:VIX' }, ...month.facts.slice(1)] }, 'es'), /real provider/);
});

test('a tampered period, contradictory count or unknown key cannot pass render', () => {
  const r = daily(base());
  rejected(() => render({ ...r, counts: { supports: 50, challenges: 0, unknown: 0 } }, 'en'), /review counts/);
  rejected(() => render({ ...r, debug: 'external' }, 'en'), /unexpected review/);
  rejected(() => weekly([r, r, r, r, r]), /duplicate/);
});

test('fixture metadata never purports to grant production rights', () => {
  assert.equal(fixtureContract.marker, 'SYNTHETIC_DO_NOT_PUBLISH');
  assert.equal(demonstrate().release_authorized, false);
  assert.deepEqual(demonstrate().counts, { days: 20, weeks: 4, months: 1 });
});
