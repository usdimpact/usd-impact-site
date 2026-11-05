import { daily, weekly, monthly, render, syntheticScore, fixtureContract } from './engine.mjs';

// February 2100 has four complete Monday-Friday weeks and no real market values.
// Later user-facing demonstrations must never mistake this invented dataset for a future forecast.
export function fixtureDay(day, index) {
  const at = `${day}T23:05:00Z`; // 18:05 America/New_York in February 2100.
  const published = `${day}T21:15:00Z`;
  return {
    fixture_marker: fixtureContract.marker, version: fixtureContract.version, day, as_of_utc: at,
    facts: [
      { fact_id: `SYNTHETIC:FACT:${day}:A`, source_id: `SYNTHETIC:SOURCE:${day}:A`,
        published_at_utc: published, license: fixtureContract.marker, kind: 'invented',
        indicator: 'DEMO_A', value: 100 + index / 4, unit: 'invented_points', relation: index % 3 === 0 ? 'unknown' : 'supports' },
      { fact_id: `SYNTHETIC:FACT:${day}:B`, source_id: `SYNTHETIC:SOURCE:${day}:B`,
        published_at_utc: published, license: fixtureContract.marker, kind: 'invented',
        indicator: 'DEMO_B', value: 20 - index / 5, unit: 'invented_points', relation: index % 2 === 0 ? 'challenges' : 'unknown' },
    ],
  };
}

export function buildFourWeeks() {
  const days = [];
  for (let d = 1; d <= 28; d++) {
    const day = `2100-02-${String(d).padStart(2, '0')}`;
    const w = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (w !== 0 && w !== 6) days.push(day);
  }
  const dailies = days.map((x, i) => daily(fixtureDay(x, i)));
  const weeks = Array.from({ length: 4 }, (_, i) => weekly(dailies.slice(i * 5, i * 5 + 5)));
  return { dailies, weeks, month: monthly(weeks, '2100-02') };
}

export const inventedScoreInputs = [112, 104, 92, 106, 105, 97, 102, 99].map((x, i) => ({
  id: `SYNTHETIC:SCORE:${i + 1}`, fixture_marker: fixtureContract.marker,
  x, mean: 100, std: 10,
  weight: [0.125, -0.125, -0.125, 0.125, -0.125, -0.125, 0.125, 0.125][i],
}));

export function demonstrate() {
  const { dailies, weeks, month } = buildFourWeeks();
  const selected = [dailies[0], weeks[0], month];
  return {
    fixture_marker: fixtureContract.marker, release_authorized: false,
    languages: selected.map(r => ({ kind: r.kind, en: render(r, 'en'), es: render(r, 'es') })),
    score: syntheticScore(inventedScoreInputs), counts: { days: dailies.length, weeks: weeks.length, months: 1 },
  };
}
