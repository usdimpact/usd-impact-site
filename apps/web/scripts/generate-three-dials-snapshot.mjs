import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { assessThreeDials, THREE_DIALS_THRESHOLDS, THREE_DIALS_VERSION } from '../src/lib/three-dials.js';
import { fetchBoardReleaseSeries } from '../src/lib/three-dials-board-release-xml.js';

const NYFED_ORIGIN = 'https://markets.newyorkfed.org';
const TIMEOUT_MS = 20_000;
const MAX_SOURCE_BYTES = 5_000_000;

const BOARD_DISCLAIMER_URL = 'https://www.federalreserve.gov/disclaimer.htm';
const NYFED_TERMS_URL = 'https://www.newyorkfed.org/privacy/termsofuse';
const NYFED_SOFR_URL = 'https://www.newyorkfed.org/markets/reference-rates/sofr';
const NYFED_SOFR_NOTICE = 'The SOFR reference rate data is subject to the Terms of Use posted at newyorkfed.org. The New York Fed is not responsible for publication of the SOFR data by USD Impact, does not sanction or endorse any particular republication, and has no liability for your use.';
const NYFED_AFFILIATION_NOTICE = 'USD Impact is not affiliated with the New York Fed. The New York Fed does not sanction, endorse, or recommend any products or services offered by USD Impact.';


const BOARD_SERIES = Object.freeze({
  broadUsd: {
    outputId: 'FED_BROAD_USD',
    sourceSeriesId: 'H10/H10/JRXWTFB_N.B',
    label: 'Federal Reserve nominal broad dollar index',
    provider: 'Board of Governors of the Federal Reserve System',
    sourceClass: 'federal_reserve_board_public_domain',
    sourceUrl: 'https://www.federalreserve.gov/releases/h10/current/',
    releaseXml: Object.freeze({
      releaseId: 'H10',
      zipUrl: 'https://www.federalreserve.gov/releases/h10/data/FRB_h10_xml.zip',
      dataFile: 'H10_data.xml',
      seriesName: 'JRXWTFB_N.B',
      requiredAttributes: Object.freeze({
        FREQ: '9',
        UNIT: 'Index:_1997_Jan_100',
      }),
    }),
    units: 'Index',
    maxAgeDays: 7,
    levelDigits: 4,
    changeMode: 'pct',
  },
  realYield10y: {
    outputId: 'FED_10Y_REAL_YIELD',
    sourceSeriesId: 'H15/H15/RIFLGFCY10_XII_N.B',
    label: '10-year inflation-indexed Treasury constant-maturity yield',
    provider: 'Board of Governors of the Federal Reserve System',
    sourceClass: 'federal_reserve_board_public_domain',
    sourceUrl: 'https://www.federalreserve.gov/releases/h15/',
    releaseXml: Object.freeze({
      releaseId: 'H15',
      zipUrl: 'https://www.federalreserve.gov/releases/h15/data/FRB_h15_xml.zip',
      dataFile: 'H15_data.xml',
      seriesName: 'RIFLGFCY10_XII_N.B',
      requiredAttributes: Object.freeze({
        FREQ: '9',
        INSTRUMENT: 'TCMII',
        MATURITY: 'Y10',
        UNIT: 'Percent:_Per_Year',
      }),
    }),
    units: 'Percent',
    maxAgeDays: 4,
    levelDigits: 2,
    changeMode: 'bps',
  },
  iorb: {
    outputId: 'FED_IORB',
    sourceSeriesId: 'PRATES/PRATES_POLICY_RATES/RESBM_N.D',
    label: 'Interest rate on reserve balances',
    provider: 'Board of Governors of the Federal Reserve System',
    sourceClass: 'federal_reserve_board_public_domain',
    sourceUrl: 'https://www.federalreserve.gov/releases/prates/',
    releaseXml: Object.freeze({
      releaseId: 'PRATES',
      zipUrl: 'https://www.federalreserve.gov/releases/prates/data/FRB_PRATES_xml.zip',
      dataFile: 'PRATES_data.xml',
      seriesName: 'RESBM_N.D',
      requiredAttributes: Object.freeze({
        FREQ: '8',
        UNIT: 'Percent',
      }),
    }),
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
  throw new Error(`Unsupported change unit: ${unit}`);
}

async function fetchBounded(url, expectedOrigin) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/csv,text/plain;q=0.9,*/*;q=0.5',
      'user-agent': 'USD-Impact-Three-Dials/2.0 (+https://www.usd-impact.com/)',
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

async function fetchSofrSeries(startDate, endDate) {
  const url = new URL('/api/rates/secured/sofr/search.json', NYFED_ORIGIN);
  url.searchParams.set('startDate', isoDate(startDate));
  url.searchParams.set('endDate', isoDate(endDate));
  const payload = JSON.parse(await fetchBounded(url.toString(), NYFED_ORIGIN));
  const records = Array.isArray(payload?.refRates) ? payload.refRates : [];
  const points = records.map((record) => ({
    date: String(record?.effectiveDate ?? ''),
    value: Number(record?.percentRate),
  })).filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.value));
  if (points.length < 2) throw new Error('New York Fed SOFR API did not provide two usable observations.');
  return points.sort((a, b) => a.date.localeCompare(b.date));
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
  if (mode === 'bp_points') return { value: latestValue - previousValue, unit: 'basis_points' };
  throw new Error(`Unsupported change mode: ${mode}`);
}

function buildObservation({
  id,
  label,
  provider,
  sourceClass,
  sourceUrl,
  sourceSeriesId,
  transport,
  sourceNote,
  units,
  maxAgeDays,
  levelDigits,
  changeMode,
  points,
  currentCutoff,
  previousCutoff,
  sourceUrls,
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
    source_urls: sourceUrls ?? [sourceUrl],
    source_series_id: sourceSeriesId,
    transport,
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

function buildBoardObservation(key, points, currentCutoff, previousCutoff, sourceNote) {
  const config = BOARD_SERIES[key];
  return buildObservation({
    id: config.outputId,
    label: config.label,
    provider: config.provider,
    sourceClass: config.sourceClass,
    sourceUrl: config.sourceUrl,
    sourceSeriesId: config.sourceSeriesId,
    transport: {
      provider: 'Board of Governors of the Federal Reserve System',
      method: 'full_release_xml_zip',
      release_id: config.releaseXml.releaseId,
      url: config.releaseXml.zipUrl,
      data_file: config.releaseXml.dataFile,
      series_name: config.releaseXml.seriesName,
      role: 'First-party full-release XML linked from the Federal Reserve release page.',
    },
    sourceNote,
    units: config.units,
    maxAgeDays: config.maxAgeDays,
    levelDigits: config.levelDigits,
    changeMode: config.changeMode,
    points,
    currentCutoff,
    previousCutoff,
  });
}

function buildFundingSpread(sofrPoints, iorbPoints, currentCutoff, previousCutoff) {
  const iorbByDate = new Map(iorbPoints.map((point) => [point.date, point.value]));
  const common = sofrPoints
    .filter((point) => iorbByDate.has(point.date))
    .map((point) => ({ date: point.date, value: (point.value - iorbByDate.get(point.date)) * 100 }));

  return buildObservation({
    id: 'SOFR_IORB_SPREAD',
    label: 'SOFR minus IORB funding spread',
    provider: 'Federal Reserve Bank of New York + Federal Reserve Board; calculation by USD Impact',
    sourceClass: 'derived_from_permitted_primary_sources',
    sourceUrl: NYFED_SOFR_URL,
    sourceUrls: [NYFED_SOFR_URL, BOARD_SERIES.iorb.sourceUrl],
    sourceSeriesId: 'NYFED_SOFR minus PRATES/PRATES_POLICY_RATES/RESBM_N.D',
    transport: {
      sofr: `${NYFED_ORIGIN}/api/rates/secured/sofr/search.json`,
      iorb: BOARD_SERIES.iorb.releaseXml.zipUrl,
      iorb_data_file: BOARD_SERIES.iorb.releaseXml.dataFile,
      iorb_series_name: BOARD_SERIES.iorb.releaseXml.seriesName,
      role: 'SOFR fetched directly from the New York Fed API; IORB fetched directly from the Federal Reserve Board release-page XML.',
    },
    sourceNote: 'USD Impact derived calculation: SOFR minus IORB in basis points. It is a funding-pressure indicator, not a credit spread or a complete liquidity/stress measure.',
    units: 'Basis points',
    maxAgeDays: 4,
    levelDigits: 0,
    changeMode: 'bp_points',
    points: common,
    currentCutoff,
    previousCutoff,
  });
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

  const [broadUsdPoints, realYieldPoints, iorbPoints, sofrPoints] = await Promise.all([
    fetchBoardReleaseSeries(BOARD_SERIES.broadUsd.releaseXml, startDate, currentCutoff),
    fetchBoardReleaseSeries(BOARD_SERIES.realYield10y.releaseXml, startDate, currentCutoff),
    fetchBoardReleaseSeries(BOARD_SERIES.iorb.releaseXml, startDate, currentCutoff),
    fetchSofrSeries(startDate, currentCutoff),
  ]);

  const broadUsd = buildBoardObservation(
    'broadUsd',
    broadUsdPoints,
    currentCutoff,
    previousCutoff,
    'Federal Reserve Board H.10 nominal broad dollar index fetched directly from the Board full-release XML linked on the H.10 release page.',
  );
  const realYield10y = buildBoardObservation(
    'realYield10y',
    realYieldPoints,
    currentCutoff,
    previousCutoff,
    'Federal Reserve Board H.15 10-year inflation-indexed Treasury constant-maturity yield fetched directly from the Board full-release XML linked on the H.15 release page.',
  );
  const fundingSpread = buildFundingSpread(sofrPoints, iorbPoints, currentCutoff, previousCutoff);

  const assessment = assessThreeDials({
    broadUsdChangePct: broadUsd.change.value,
    realYieldChangeBps: realYield10y.change.value,
    fundingSpreadChangeBps: fundingSpread.change.value,
  });
  const snapshot = {
    version: THREE_DIALS_VERSION,
    methodology: {
      id: 'three-dials-rights-safe-v2',
      effective_from: targetWeek,
      break_from_v1: true,
      history_policy: 'Do not splice v1 and v2 observations into one continuous series. Version 2 uses different public measures.',
    },
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
      fact: 'Primary-source observations or a transparently derived funding spread.',
      interpretation: 'Deterministic qualitative reading of the three v2 dials using published display thresholds.',
    },
    dials: {
      dollar: {
        ...assessment.dials.dollar,
        title: 'Dial 1 — Broad USD direction',
        facts: [broadUsd],
      },
      real_rates: {
        ...assessment.dials.real_rates,
        title: 'Dial 2 — Real-rate pressure',
        facts: [realYield10y],
      },
      funding_pressure: {
        ...assessment.dials.funding_pressure,
        title: 'Dial 3 — Funding pressure',
        facts: [fundingSpread],
      },
    },
    interpretation: assessment.interpretation,
    source_rights: {
      federal_reserve_board: {
        class: 'public_domain_unless_otherwise_indicated',
        attribution: 'Board of Governors of the Federal Reserve System',
        terms_url: BOARD_DISCLAIMER_URL,
      },
      new_york_fed_sofr: {
        class: 'permitted_with_reference_rate_notice',
        terms_url: NYFED_TERMS_URL,
        notice: NYFED_SOFR_NOTICE,
        affiliation_notice: NYFED_AFFILIATION_NOTICE,
      },
    },
    disclosures: [
      'Three Dials v2 is a methodology break from the prior DXY/credit/volatility implementation. Historical v1 and v2 observations are not a continuous series.',
      'Dial 1 uses the Federal Reserve Board nominal broad dollar index. It must not be labeled DXY.',
      'Dial 2 uses the Federal Reserve Board 10-year inflation-indexed Treasury constant-maturity yield.',
      'Dial 3 uses the USD Impact-derived SOFR-minus-IORB spread as a funding-pressure indicator. It is not a credit spread or a complete measure of market liquidity/stress.',
      NYFED_SOFR_NOTICE,
      NYFED_AFFILIATION_NOTICE,
      'Federal Reserve Board information is attributed to the Board; Board-origin inputs are fetched directly from the full-release XML linked on the Board release pages.',
      'The USD Impact Score remains a separate product with separate source governance and is intentionally not embedded in the Three Dials v2 snapshot.',
      'The Three-Dial interpretation is descriptive and deterministic. It is not investment advice, a trading signal, a probability, or a return forecast.',
    ],
  };

  const text = `${JSON.stringify(snapshot, null, 2)}\n`;
  await Promise.all([
    mkdir(new URL('../public/data/three-dials/archive/', import.meta.url), { recursive: true }),
    mkdir(new URL('../public/data/three-dials/', import.meta.url), { recursive: true }),
    mkdir(new URL('../src/data/', import.meta.url), { recursive: true }),
  ]);
  await writeFile(archiveUrl, text, 'utf8');
  await writeFile(sourceLatestUrl, text, 'utf8');
  await writeFile(publicLatestUrl, text, 'utf8');
  console.log(`Generated immutable Three-Dials v2 snapshot for ${targetWeek}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
