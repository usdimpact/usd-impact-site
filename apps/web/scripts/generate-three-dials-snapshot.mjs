import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { assessThreeDials, THREE_DIALS_THRESHOLDS, THREE_DIALS_VERSION } from '../src/lib/three-dials.js';

const FRED_ORIGIN = 'https://fred.stlouisfed.org';
const YAHOO_ORIGIN = 'https://query1.finance.yahoo.com';
const SCORE_ORIGIN = 'https://score.usd-impact.com';
const SCORE_URL = `${SCORE_ORIGIN}/data/weekly_input_latest.json`;
const DXY_SOURCE_URL = 'https://finance.yahoo.com/quote/DX-Y.NYB/';
const TIMEOUT_MS = 20_000;
const MAX_SOURCE_BYTES = 5_000_000;

const ALLOWED_SCORE_REGIMES = new Set([
  'Strong dollar regime',
  'Firm dollar regime',
  'Neutral / transitional',
  'Soft dollar regime',
  'Weak dollar regime',
]);

const FRED_SERIES = Object.freeze({
  broadUsd: {
    id: 'DTWEXBGS',
    label: 'Nominal Broad U.S. Dollar Index',
    provider: 'Federal Reserve Board via FRED',
    sourceClass: 'primary_public',
    units: 'Index Jan 2006=100',
    maxAgeDays: 7,
    levelDigits: 4,
    changeMode: 'pct',
  },
  realYield10y: {
    id: 'DFII10',
    label: '10-year TIPS real yield',
    provider: 'Federal Reserve Board via FRED',
    sourceClass: 'primary_public',
    units: 'Percent',
    maxAgeDays: 4,
    levelDigits: 2,
    changeMode: 'bps',
  },
  nominalYield10y: {
    id: 'DGS10',
    label: '10-year nominal Treasury yield',
    provider: 'Federal Reserve Board via FRED',
    sourceClass: 'primary_public',
    units: 'Percent',
    maxAgeDays: 4,
    levelDigits: 2,
    changeMode: 'bps',
  },
  hyOas: {
    id: 'BAMLH0A0HYM2',
    label: 'ICE BofA U.S. High Yield option-adjusted spread',
    provider: 'ICE Data Indices via FRED',
    sourceClass: 'third_party_via_fred',
    units: 'Percent',
    maxAgeDays: 4,
    levelDigits: 2,
    changeMode: 'bps',
  },
  vix: {
    id: 'VIXCLS',
    label: 'CBOE Volatility Index: VIX',
    provider: 'CBOE via FRED',
    sourceClass: 'third_party_via_fred',
    units: 'Index',
    maxAgeDays: 4,
    levelDigits: 2,
    changeMode: 'points',
  },
  sofr: {
    id: 'SOFR',
    label: 'Secured Overnight Financing Rate',
    provider: 'Federal Reserve Bank of New York via FRED',
    sourceClass: 'primary_public',
    units: 'Percent',
    maxAgeDays: 4,
    levelDigits: 2,
    changeMode: 'bps',
  },
  iorb: {
    id: 'IORB',
    label: 'Interest Rate on Reserve Balances',
    provider: 'Federal Reserve Board via FRED',
    sourceClass: 'primary_public',
    units: 'Percent',
    maxAgeDays: 4,
    levelDigits: 2,
    changeMode: 'bps',
  },
});

function isoDate(value) {
  return value.toISOString().slice(0, 10);
}

function dateFromIso(value) {
  return new Date(`${value}T00:00:00Z`);
}

function addDays(value, days) {
  const copy = new Date(value.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function daysBetween(earlierIso, laterDate) {
  return Math.floor((laterDate.getTime() - dateFromIso(earlierIso).getTime()) / 86_400_000);
}

function latestCompletedFriday(now) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = today.getUTCDay();
  let daysSinceFriday = (weekday + 2) % 7;
  if (weekday === 5) daysSinceFriday = 7;
  return addDays(today, -daysSinceFriday);
}

function formatSigned(value, digits, suffix = '') {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}${suffix}`;
}

function formatLevel(value, units, digits) {
  if (units === 'Percent') return `${value.toFixed(digits)}%`;
  if (units === 'Basis points') return `${value.toFixed(digits)} bp`;
  return value.toFixed(digits);
}

function formatChange(value, unit) {
  if (unit === 'percent') return formatSigned(value, 2, '%');
  if (unit === 'basis_points') return formatSigned(value, 0, ' bp');
  if (unit === 'index_points') return formatSigned(value, 2, ' pts');
  throw new Error(`Unsupported change unit: ${unit}`);
}

async function fetchBounded(url, expectedOrigin) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/csv,text/plain;q=0.9,*/*;q=0.5',
      'user-agent': 'USD-Impact-Three-Dials/1.0 (+https://www.usd-impact.com/)',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Source request failed with HTTP ${response.status}: ${url}`);
  }
  const finalUrl = new URL(response.url);
  if (finalUrl.origin !== expectedOrigin) {
    throw new Error(`Source redirected outside the approved origin: ${response.url}`);
  }
  const text = await response.text();
  if (!text || text.length > MAX_SOURCE_BYTES) {
    throw new Error(`Source response size is invalid for ${url}`);
  }
  return text;
}

function parseFredCsv(text, seriesId) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error(`FRED ${seriesId} returned no observations.`);
  const header = lines[0].replace(/^\uFEFF/, '').split(',').map((value) => value.replaceAll('"', '').trim());
  const valueIndex = header.indexOf(seriesId);
  if (valueIndex < 1) throw new Error(`FRED ${seriesId} response header is unexpected.`);

  const points = [];
  for (const line of lines.slice(1)) {
    const fields = line.split(',').map((value) => value.replaceAll('"', '').trim());
    const date = fields[0];
    const raw = fields[valueIndex];
    const value = Number(raw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || raw === '.' || !Number.isFinite(value)) continue;
    points.push({ date, value });
  }
  if (points.length < 2) throw new Error(`FRED ${seriesId} did not provide two usable observations.`);
  return points;
}

async function fetchFredSeries(config, startDate, endDate) {
  const url = new URL('/graph/fredgraph.csv', FRED_ORIGIN);
  url.searchParams.set('id', config.id);
  url.searchParams.set('cosd', isoDate(startDate));
  url.searchParams.set('coed', isoDate(endDate));
  return parseFredCsv(await fetchBounded(url.toString(), FRED_ORIGIN), config.id);
}

async function fetchDxySeries(startDate, endDate) {
  const url = new URL('/v8/finance/chart/DX-Y.NYB', YAHOO_ORIGIN);
  url.searchParams.set('period1', String(Math.floor(startDate.getTime() / 1000)));
  url.searchParams.set('period2', String(Math.floor(addDays(endDate, 2).getTime() / 1000)));
  url.searchParams.set('interval', '1d');
  url.searchParams.set('includePrePost', 'false');
  url.searchParams.set('events', 'div,splits');

  const payload = JSON.parse(await fetchBounded(url.toString(), YAHOO_ORIGIN));
  const result = payload?.chart?.result?.[0];
  if (!result || payload?.chart?.error) throw new Error('Yahoo Finance did not return DXY history.');
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const closes = Array.isArray(result.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : [];
  const points = timestamps.map((timestamp, index) => ({
    date: new Date(Number(timestamp) * 1000).toISOString().slice(0, 10),
    value: Number(closes[index]),
  })).filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.value));
  if (points.length < 2) throw new Error('Yahoo Finance DXY history did not contain two usable observations.');
  return points;
}

function selectAtOrBefore(points, cutoffDate) {
  const cutoff = isoDate(cutoffDate);
  const eligible = points.filter((point) => point.date <= cutoff);
  if (!eligible.length) throw new Error(`No observation exists on or before ${cutoff}.`);
  return eligible.reduce((latest, point) => point.date > latest.date ? point : latest);
}

function calculateChange(latestValue, previousValue, mode) {
  if (mode === 'pct') return { value: ((latestValue / previousValue) - 1) * 100, unit: 'percent' };
  if (mode === 'bps') return { value: (latestValue - previousValue) * 100, unit: 'basis_points' };
  if (mode === 'points') return { value: latestValue - previousValue, unit: 'index_points' };
  if (mode === 'bp_points') return { value: latestValue - previousValue, unit: 'basis_points' };
  throw new Error(`Unsupported change mode: ${mode}`);
}

function buildObservation({
  id,
  label,
  provider,
  sourceClass,
  sourceUrl,
  sourceNote,
  units,
  maxAgeDays,
  levelDigits,
  changeMode,
  points,
  currentCutoff,
  previousCutoff,
}) {
  const latest = selectAtOrBefore(points, currentCutoff);
  const previous = selectAtOrBefore(points, previousCutoff);
  const latestAgeDays = daysBetween(latest.date, currentCutoff);
  const previousAgeDays = daysBetween(previous.date, previousCutoff);
  if (latestAgeDays < 0 || latestAgeDays > maxAgeDays) {
    throw new Error(`${id} latest observation is ${latestAgeDays} days from the current cutoff; max is ${maxAgeDays}.`);
  }
  if (previousAgeDays < 0 || previousAgeDays > maxAgeDays) {
    throw new Error(`${id} previous observation is ${previousAgeDays} days from the prior cutoff; max is ${maxAgeDays}.`);
  }

  const change = calculateChange(latest.value, previous.value, changeMode);
  if (!Number.isFinite(change.value)) throw new Error(`${id} produced a non-finite change.`);
  return {
    id,
    label,
    provider,
    source_class: sourceClass,
    source_url: sourceUrl,
    source_note: sourceNote,
    units,
    latest: {
      date: latest.date,
      value: latest.value,
      display: formatLevel(latest.value, units, levelDigits),
      age_days_from_cutoff: latestAgeDays,
    },
    previous: {
      date: previous.date,
      value: previous.value,
      display: formatLevel(previous.value, units, levelDigits),
      age_days_from_cutoff: previousAgeDays,
    },
    change: {
      value: change.value,
      unit: change.unit,
      display: formatChange(change.value, change.unit),
    },
  };
}

function buildFundingSpread(sofrPoints, iorbPoints, currentCutoff, previousCutoff) {
  const iorbByDate = new Map(iorbPoints.map((point) => [point.date, point.value]));
  const common = sofrPoints
    .filter((point) => iorbByDate.has(point.date))
    .map((point) => ({ date: point.date, value: (point.value - iorbByDate.get(point.date)) * 100 }));
  return buildObservation({
    id: 'SOFR_IORB_SPREAD',
    label: 'SOFR minus IORB funding spread',
    provider: 'New York Fed and Federal Reserve Board via FRED',
    sourceClass: 'derived_from_primary_public',
    sourceUrl: 'https://fred.stlouisfed.org/series/SOFR',
    sourceNote: 'Derived as SOFR minus IORB (FRED series IORB) in basis points. It is funding context, not a standalone liquidity measure.',
    units: 'Basis points',
    maxAgeDays: 4,
    levelDigits: 0,
    changeMode: 'bp_points',
    points: common,
    currentCutoff,
    previousCutoff,
  });
}

async function fetchScoreModelOutput(targetWeek) {
  const payload = JSON.parse(await fetchBounded(SCORE_URL, SCORE_ORIGIN));
  if (payload?.week_ending !== targetWeek) {
    throw new Error(`Weekly Score bridge is ${payload?.week_ending ?? 'missing'}; expected ${targetWeek}.`);
  }
  const score = Number(payload.score);
  if (!Number.isFinite(score) || !ALLOWED_SCORE_REGIMES.has(payload.regime)) {
    throw new Error('Weekly Score bridge contains an invalid score or regime.');
  }
  return {
    name: 'USD Impact Score v2',
    week_ending: targetWeek,
    score,
    score_display: formatSigned(score, 2),
    regime: payload.regime,
    source_url: SCORE_URL,
    methodology_url: 'https://www.usd-impact.com/score/methodology/',
    scope: 'Separate descriptive model output. It is not an input to the Three-Dial interpretation and is not a forecast.',
  };
}

async function fileExists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const now = process.env.THREE_DIALS_NOW ? new Date(process.env.THREE_DIALS_NOW) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error('THREE_DIALS_NOW is not a valid date.');
  const currentCutoff = latestCompletedFriday(now);
  const previousCutoff = addDays(currentCutoff, -7);
  const startDate = addDays(previousCutoff, -14);
  const targetWeek = isoDate(currentCutoff);

  const archiveUrl = new URL(`../public/data/three-dials/archive/${targetWeek}.json`, import.meta.url);
  const sourceLatestUrl = new URL('../src/data/three-dials-latest.json', import.meta.url);
  const publicLatestUrl = new URL('../public/data/three-dials/latest.json', import.meta.url);

  if (await fileExists(archiveUrl)) {
    const [archiveText, sourceText, publicText] = await Promise.all([
      readFile(archiveUrl, 'utf8'),
      readFile(sourceLatestUrl, 'utf8'),
      readFile(publicLatestUrl, 'utf8'),
    ]);
    if (archiveText !== sourceText || archiveText !== publicText) {
      throw new Error(`Immutable Three-Dials archive ${targetWeek} exists but latest copies do not match it.`);
    }
    console.log(`Three-Dials snapshot ${targetWeek} is already published; no rewrite performed.`);
    return;
  }

  const fredEntries = await Promise.all(Object.entries(FRED_SERIES).map(async ([key, config]) => {
    const points = await fetchFredSeries(config, startDate, currentCutoff);
    return [key, points];
  }));
  const fred = Object.fromEntries(fredEntries);
  const dxyPoints = await fetchDxySeries(startDate, currentCutoff);

  const dxy = buildObservation({
    id: 'DXY',
    label: 'U.S. Dollar Index (DXY proxy)',
    provider: 'Yahoo Finance',
    sourceClass: 'accessible_proxy',
    sourceUrl: DXY_SOURCE_URL,
    sourceNote: 'Accessible/reproducible Yahoo Finance proxy for DX-Y.NYB; not represented as exchange-official or a licensed institutional feed.',
    units: 'Index',
    maxAgeDays: 3,
    levelDigits: 2,
    changeMode: 'pct',
    points: dxyPoints,
    currentCutoff,
    previousCutoff,
  });

  const fredObservation = (key, sourceNote) => {
    const config = FRED_SERIES[key];
    return buildObservation({
      id: config.id,
      label: config.label,
      provider: config.provider,
      sourceClass: config.sourceClass,
      sourceUrl: `https://fred.stlouisfed.org/series/${config.id}`,
      sourceNote,
      units: config.units,
      maxAgeDays: config.maxAgeDays,
      levelDigits: config.levelDigits,
      changeMode: config.changeMode,
      points: fred[key],
      currentCutoff,
      previousCutoff,
    });
  };

  const broadUsd = fredObservation('broadUsd', 'Federal Reserve H.10 broad-dollar confirmation inside Dial 1; it is not a separate fourth dial.');
  const realYield10y = fredObservation('realYield10y', '10-year inflation-indexed Treasury yield; the primary real-rate observation for Dial 2.');
  const nominalYield10y = fredObservation('nominalYield10y', 'Nominal 10-year Treasury yield shown only as rate context for Dial 2.');
  const hyOas = fredObservation('hyOas', 'ICE BofA series displayed through FRED. Only the two observations used by this snapshot are republished.');
  const vix = fredObservation('vix', 'CBOE VIX displayed through FRED. Only the two observations used by this snapshot are republished.');
  const fundingSpread = buildFundingSpread(fred.sofr, fred.iorb, currentCutoff, previousCutoff);

  const assessment = assessThreeDials({
    dxyChangePct: dxy.change.value,
    broadUsdChangePct: broadUsd.change.value,
    realYieldChangeBps: realYield10y.change.value,
    nominalYieldChangeBps: nominalYield10y.change.value,
    hyOasChangeBps: hyOas.change.value,
    vixChangePoints: vix.change.value,
    fundingSpreadChangeBps: fundingSpread.change.value,
  });
  const modelOutput = await fetchScoreModelOutput(targetWeek);

  const snapshot = {
    version: THREE_DIALS_VERSION,
    status: 'published',
    week_ending: targetWeek,
    retrieved_at: now.toISOString(),
    observation_policy: {
      description: 'Compare the latest usable observation on or before the completed Friday with the latest usable observation on or before the prior Friday. Every fact retains its actual observation date.',
      current_cutoff: targetWeek,
      previous_cutoff: isoDate(previousCutoff),
      thresholds: THREE_DIALS_THRESHOLDS,
      threshold_scope: 'Display/interpretation heuristics only. They are not estimated probabilities, optimized trading rules, or inputs to USD Impact Score v2.',
    },
    labels: {
      fact: 'Externally sourced or transparently derived completed observations.',
      interpretation: 'Deterministic qualitative reading of the three dials using the published display thresholds.',
      model_output: 'Separate USD Impact Score v2 output; not evidence that the qualitative interpretation is predictive.',
    },
    dials: {
      dollar: {
        ...assessment.dials.dollar,
        title: 'Dial 1 — Dollar direction',
        facts: [dxy, broadUsd],
      },
      real_rates: {
        ...assessment.dials.real_rates,
        title: 'Dial 2 — Real-rate pressure',
        facts: [realYield10y, nominalYield10y],
      },
      liquidity_stress: {
        ...assessment.dials.liquidity_stress,
        title: 'Dial 3 — Liquidity stress',
        facts: [hyOas, vix, fundingSpread],
      },
    },
    interpretation: assessment.interpretation,
    model_output: modelOutput,
    disclosures: [
      'Dated snapshot, not real-time market data. Observation dates are shown for every fact.',
      'Broad USD is a confirmation layer inside Dial 1, not a fourth dial.',
      'The SOFR-minus-IORB spread is one funding-context indicator and is not treated as a complete measure of liquidity.',
      'VIX and ICE BofA High Yield OAS are third-party series accessed through FRED; this snapshot republishes only the two observations needed for the completed-week comparison, not their full histories.',
      'The Three-Dial interpretation is descriptive and deterministic. It is not investment advice, a trading signal, a probability, or a return forecast.',
    ],
  };

  // All external fields above are reduced to finite numbers, ISO dates, exact-week values,
  // or fixed allow-listed labels before reaching these fixed repository destinations.
  const text = `${JSON.stringify(snapshot, null, 2)}\n`;
  await Promise.all([
    mkdir(new URL('../public/data/three-dials/archive/', import.meta.url), { recursive: true }),
    mkdir(new URL('../public/data/three-dials/', import.meta.url), { recursive: true }),
    mkdir(new URL('../src/data/', import.meta.url), { recursive: true }),
  ]);
  await writeFile(archiveUrl, text, 'utf8');
  await writeFile(sourceLatestUrl, text, 'utf8');
  await writeFile(publicLatestUrl, text, 'utf8');
  console.log(`Generated immutable Three-Dials snapshot for ${targetWeek}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
