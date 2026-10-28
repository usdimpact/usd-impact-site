import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  SAFE_MONTHLY_INPUT_SCHEMA_VERSION,
  SAFE_WEEKLY_SCHEMA_VERSION,
  assertPublicSafeMonthlyInput,
  assertPublicSafeWeeklyReport,
  buildPublicSafeMonthlyInput,
  buildPublicSafeWeeklyReport,
  validatePublicSafeScore,
} from './score-public-safe-report-prototype.mjs';

const weeks = [
  { periodStart: '2026-07-06', periodEnd: '2026-07-10', score: -0.10, regime: 'Balanced regime' },
  { periodStart: '2026-07-13', periodEnd: '2026-07-17', score: -0.20, regime: 'Balanced regime' },
  { periodStart: '2026-07-20', periodEnd: '2026-07-24', score: -0.40, regime: 'Soft dollar regime' },
  { periodStart: '2026-07-27', periodEnd: '2026-07-31', score: -0.50, regime: 'Soft dollar regime' },
];

const componentWeights = {
  DXY: 0.125,
  WTI: -0.125,
  SPX: -0.125,
  VIX: 0.125,
  BTC: -0.125,
  GOLD: -0.125,
  UST_2Y: 0.125,
  UST_10Y: 0.125,
};

function dateSequence(monday) {
  const start = new Date(`${monday}T12:00:00Z`);
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function safeScore(week, index) {
  const previous = index === 0 ? week.score : weeks[index - 1].score;
  return {
    schema_version: 'score-public-v2-safe-1',
    metadata: {
      pipeline: 'usd_impact_score_v2',
      generated_at_utc: `${week.periodEnd}T22:00:00Z`,
      n_weeks: index + 5,
      // Methodology weights may remain in the safe upstream contract. The
      // report contract must not copy these component names into publication.
      weights: componentWeights,
    },
    latest: {
      week_ending: week.periodEnd,
      score: week.score,
      regime: week.regime,
      week_over_week_change: week.score - previous,
      four_week_change: index === 0 ? 0 : week.score - weeks[0].score,
    },
    history: [
      { date: '2026-06-12', score: -0.05, regime: 'Balanced regime' },
      { date: '2026-06-19', score: -0.06, regime: 'Balanced regime' },
      { date: '2026-06-26', score: -0.07, regime: 'Balanced regime' },
      { date: '2026-07-03', score: -0.08, regime: 'Balanced regime' },
      { date: week.periodEnd, score: week.score, regime: week.regime },
    ],
    release_evidence: {
      aggregate_history_sha256: String(index + 1).repeat(64),
    },
  };
}

function dailyFixture(date, index) {
  const catalyst = index === 4
    ? [
        'catalysts:',
        '  - date: "2026-08-03"',
        '    event: "Scheduled official release"',
      ]
    : ['catalysts: []'];
  return [
    '---',
    `title: "Daily USD Impact — ${date}"`,
    `date: "${date}"`,
    'status: "published"',
    `summary: "Verified source-led evidence for ${date}; aggregate transmission remains conditional."`,
    ...catalyst,
    '---',
    '',
  ].join('\n');
}

async function writeDailyWeek(root, week) {
  const dates = dateSequence(week.periodStart);
  await Promise.all(dates.map((date, index) => writeFile(
    path.join(root, `${date}.md`),
    dailyFixture(date, index),
    'utf8',
  )));
}

function assertNoComponentEvidence(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    '"drivers"',
    '"source_provenance"',
    '"sourceProvenance"',
    '"weekly_level"',
    '"z_clipped"',
    '"contribution"',
    '"contributions"',
    '"nearestRegimeBoundary"',
    '"sourceUrl"',
    'weekly_input.json',
    'score_repro_bundle',
    'Yahoo Finance',
    'DX-Y.NYB',
    'CL=F',
    '^GSPC',
    '^VIX',
    'GC=F',
    'BTC-USD',
  ]) {
    assert.equal(serialized.includes(forbidden), false, `unexpected component evidence: ${forbidden}`);
  }
}

test('accepts #162-shaped aggregate Score but never copies component methodology names', async () => {
  const normalized = validatePublicSafeScore(safeScore(weeks[0], 0));
  assert.equal(normalized.weekEnding, '2026-07-10');
  assert.equal(normalized.score, -0.10);

  const newsRoot = await mkdtemp(path.join(os.tmpdir(), 'usd-impact-safe-weekly-'));
  try {
    await writeDailyWeek(newsRoot, weeks[0]);
    const report = buildPublicSafeWeeklyReport({
      week: weeks[0].periodEnd,
      score: safeScore(weeks[0], 0),
      newsRoot,
      generatedAt: '2026-07-11T08:00:00Z',
    });

    assert.equal(report.schemaVersion, SAFE_WEEKLY_SCHEMA_VERSION);
    assert.equal(report.periodStart, weeks[0].periodStart);
    assert.equal(report.periodEnd, weeks[0].periodEnd);
    assert.equal(report.score.value, weeks[0].score);
    assert.equal(report.score.regime, weeks[0].regime);
    assert.equal(report.rightsSafety.componentValuesPublished, false);
    assert.equal(report.rightsSafety.componentContributionsPublished, false);
    assert.equal(report.rightsSafety.providerProvenancePublished, false);
    assert.equal(report.sourceEditions.length, 5);
    assert.equal(report.themes.length, 3);
    assert.equal(report.catalysts.length, 1);
    assertPublicSafeWeeklyReport(report);
    assertNoComponentEvidence(report);

    const serialized = JSON.stringify(report);
    for (const componentName of Object.keys(componentWeights)) {
      assert.equal(
        serialized.includes(`"${componentName}"`),
        false,
        `methodology weight name leaked into report: ${componentName}`,
      );
    }
  } finally {
    await rm(newsRoot, { recursive: true, force: true });
  }
});

test('fails closed when the upstream aggregate-safe Score contract grows unexpectedly', () => {
  const topLevel = safeScore(weeks[0], 0);
  topLevel.new_public_field = true;
  assert.throws(
    () => validatePublicSafeScore(topLevel),
    /fields do not match the reviewed public-safe contract/,
  );

  const latest = safeScore(weeks[0], 0);
  latest.latest.experimental = 1;
  assert.throws(
    () => validatePublicSafeScore(latest),
    /fields do not match the reviewed public-safe contract/,
  );

  const history = safeScore(weeks[0], 0);
  history.history[0].component = 'DXY';
  assert.throws(
    () => validatePublicSafeScore(history),
    /fields do not match the reviewed public-safe contract/,
  );
});

test('rejects unsafe upstream Score fields before report construction', async () => {
  const unsafe = safeScore(weeks[0], 0);
  unsafe.source_provenance = { DXY: { provider: 'Yahoo Finance' } };
  assert.throws(() => validatePublicSafeScore(unsafe), /forbidden Score field/);

  const unsafeDriver = safeScore(weeks[0], 0);
  unsafeDriver.drivers = [{ name: 'DXY', contribution: 0.1 }];
  assert.throws(() => validatePublicSafeScore(unsafeDriver), /forbidden Score field/);

  const unsafeBoundary = safeScore(weeks[0], 0);
  unsafeBoundary.latest.nearestRegimeBoundary = -0.3;
  assert.throws(() => validatePublicSafeScore(unsafeBoundary), /forbidden Score field/);
});

test('builds a four-week aggregate-only Monthly input without inventing prose', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'usd-impact-safe-monthly-'));
  try {
    const weeklyReports = [];
    for (const [index, week] of weeks.entries()) {
      const newsRoot = path.join(root, week.periodEnd);
      await mkdir(newsRoot);
      await writeDailyWeek(newsRoot, week);
      weeklyReports.push(buildPublicSafeWeeklyReport({
        week: week.periodEnd,
        score: safeScore(week, index),
        newsRoot,
        generatedAt: `${week.periodEnd}T23:00:00Z`,
      }));
    }

    const monthly = buildPublicSafeMonthlyInput({
      weeklyReports,
      generatedAt: '2026-08-03T12:00:00Z',
    });

    assert.equal(monthly.schemaVersion, SAFE_MONTHLY_INPUT_SCHEMA_VERSION);
    assert.equal(monthly.periodStart, '2026-07-06');
    assert.equal(monthly.periodEnd, '2026-07-31');
    assert.equal(monthly.scorePath.length, 4);
    assert.equal(monthly.sourceWeeklyReports.length, 4);
    assert.ok(monthly.themeEvidence.length >= 12);
    assert.match(monthly.editorialRule, /not publishable prose/i);
    assertPublicSafeMonthlyInput(monthly);
    assertNoComponentEvidence(monthly);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Monthly input rejects gaps and component-derived weekly fields', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'usd-impact-safe-monthly-reject-'));
  try {
    const weeklyReports = [];
    for (const [index, week] of weeks.entries()) {
      const newsRoot = path.join(root, week.periodEnd);
      await mkdir(newsRoot);
      await writeDailyWeek(newsRoot, week);
      weeklyReports.push(buildPublicSafeWeeklyReport({
        week: week.periodEnd,
        score: safeScore(week, index),
        newsRoot,
      }));
    }

    const gap = structuredClone(weeklyReports);
    gap[2].periodEnd = '2026-07-23';
    assert.throws(
      () => buildPublicSafeMonthlyInput({ weeklyReports: gap }),
      /Friday|consecutive/,
    );

    const contaminated = structuredClone(weeklyReports[0]);
    contaminated.score.contributions = [{ name: 'SPX', value: -0.3 }];
    assert.throws(() => assertPublicSafeWeeklyReport(contaminated), /unexpected field|forbidden token/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('review schemas encode the same fail-closed rights contract', async () => {
  const weeklySchema = JSON.parse(await readFile(
    new URL('./schemas/weekly-report-public-safe-v1.schema.json', import.meta.url),
    'utf8',
  ));
  const monthlySchema = JSON.parse(await readFile(
    new URL('./schemas/monthly-report-public-safe-input-v1.schema.json', import.meta.url),
    'utf8',
  ));

  assert.equal(weeklySchema.properties.schemaVersion.const, SAFE_WEEKLY_SCHEMA_VERSION);
  assert.equal(monthlySchema.properties.schemaVersion.const, SAFE_MONTHLY_INPUT_SCHEMA_VERSION);

  for (const schema of [weeklySchema, monthlySchema]) {
    const serialized = JSON.stringify(schema);
    assert.equal(serialized.includes('nearestRegimeBoundary'), false);
    assert.equal(serialized.includes('sourceUrl'), false);
    assert.equal(serialized.includes('contribution'), false);
    assert.equal(serialized.includes('source_provenance'), false);
  }

  for (const key of [
    'componentValuesPublished',
    'componentZScoresPublished',
    'componentContributionsPublished',
    'providerProvenancePublished',
    'componentSourceUrlPublished',
  ]) {
    assert.equal(weeklySchema.properties.rightsSafety.properties[key].const, false);
    assert.equal(monthlySchema.properties.rightsSafety.properties[key].const, false);
  }
});

test('prototype is isolated from the live component-based Weekly generator', async () => {
  const liveGenerator = await readFile(
    new URL('./generate-weekly-report.mjs', import.meta.url),
    'utf8',
  );

  assert.match(liveGenerator, /driver\.contribution/);
  assert.match(liveGenerator, /weekly_input\.json/);
  assert.match(liveGenerator, /source_provenance/);

  const prototype = await readFile(
    new URL('./score-public-safe-report-prototype.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(prototype, /score\.drivers|driver\.contribution|source_provenance\s*\?/);
});
