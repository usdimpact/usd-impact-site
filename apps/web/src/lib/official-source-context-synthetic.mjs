// Official-Source Context: a non-publishing, offline educational feasibility model.
// NEVER import a live provider payload here or treat the toy numbers as market data.
// Scope and source-rights assessment: https://github.com/usdimpact/usd-impact-site/issues/845

export const OFFICIAL_CONTEXT_SCHEMA = 'usd-impact-official-source-context-synthetic-v1';
export const OFFICIAL_CONTEXT_ROUTE = '/lab/official-source-context/';
export const OFFICIAL_CONTEXT_ISSUE = 'https://github.com/usdimpact/usd-impact-site/issues/845';

export const OFFICIAL_CONTEXT_CATALOG = Object.freeze([
  Object.freeze({
    id: 'BOARD_H10_BROAD_NOMINAL',
    label: 'Nominal Broad Dollar Index (H.10)',
    publisher: 'Federal Reserve Board',
    series: 'H.10 — nominal broad trade-weighted U.S. dollar index',
    url: 'https://www.federalreserve.gov/releases/H10/summary/default.htm',
    unit: 'index_points',
    unitLabel: 'index points',
    notEquivalentTo: 'DXY: H.10 uses trade weights across a broader partner basket.',
    rightsState: 'Source-specific reuse review needed before live publication.',
  }),
  Object.freeze({
    id: 'BOARD_H15_TIPS10Y',
    label: '10-year inflation-indexed constant-maturity yield (H.15)',
    publisher: 'Federal Reserve Board, using Treasury-origin series',
    series: 'H.15 — inflation-indexed Treasury constant maturity, 10-year',
    url: 'https://www.federalreserve.gov/releases/h15/',
    unit: 'percent_per_annum',
    unitLabel: 'percent per year',
    notEquivalentTo: 'Other real-rate constructs: validate the exact H.15 definition before comparing with Treasury par real yield series.',
    rightsState: 'Source-specific reuse review needed before live publication.',
  }),
]);

export const OFFICIAL_CONTEXT_UNAVAILABLE_STRESS = Object.freeze({
  label: 'Financial stress',
  status: 'unavailable',
  message: 'Unavailable — rights and measurement definition pending. No HY OAS, VIX or other proxy is inferred.',
  notEquivalentTo: 'A funding-rate spread is not HY OAS, VIX or a composite market-stress gauge.',
});

const expectedRootKeys = Object.freeze([
  'created_for', 'mode', 'observations', 'previous_friday', 'publication_allowed',
  'schema', 'score_model_allowed', 'source_fetch_count', 'stress', 'week_ending',
]);
const expectedObservationKeys = Object.freeze(['id', 'latest', 'origin', 'previous', 'unit']);
const expectedPointKeys = Object.freeze(['date', 'value']);
const expectedStressKeys = Object.freeze(['observations', 'reason', 'status']);
const expectedIds = OFFICIAL_CONTEXT_CATALOG.map((entry) => entry.id);

const exactKeys = (value, expected) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...expected].sort().join('|');

const fridayDate = (date) =>
  typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(Date.parse(date + 'T00:00:00Z'))
    && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date
    && new Date(date + 'T00:00:00Z').getUTCDay() === 5;

const held = (reason) => ({
  status: 'hold',
  reason,
  rows: [],
  thirdDial: OFFICIAL_CONTEXT_UNAVAILABLE_STRESS,
  publicationAllowed: false,
  scoreModelAllowed: false,
  regimeAvailable: false,
  scoreOutput: null,
});

const formatChange = (difference, unit) => {
  const n = Math.abs(difference) < 0.0000001 ? 0 : difference;
  const magnitude = Math.abs(n).toFixed(2);
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  return unit === 'percent_per_annum'
    ? sign + magnitude + ' percentage points (synthetic)'
    : sign + magnitude + ' index points (synthetic)';
};

export function assessOfficialSourceSyntheticPilot(candidate) {
  if (!exactKeys(candidate, expectedRootKeys)) return held('Unexpected or missing root fields.');
  if (candidate.schema !== OFFICIAL_CONTEXT_SCHEMA || candidate.mode !== 'synthetic'
    || candidate.created_for !== 'review-only'
    || candidate.source_fetch_count !== 0 || candidate.publication_allowed !== false
    || candidate.score_model_allowed !== false) {
    return held('Only an explicitly non-publishing, offline synthetic fixture is accepted.');
  }
  if (candidate.previous_friday !== '2031-01-03' || candidate.week_ending !== '2031-01-10'
    || !fridayDate(candidate.previous_friday) || !fridayDate(candidate.week_ending)
    || Date.parse(candidate.week_ending + 'T00:00:00Z') -
      Date.parse(candidate.previous_friday + 'T00:00:00Z') !== 7 * 86400000) {
    return held('Fictional completed-Friday fixture dates are invalid or mismatched.');
  }
  if (!Array.isArray(candidate.observations) || candidate.observations.length !== expectedIds.length
    || !exactKeys(candidate.stress, expectedStressKeys)
    || candidate.stress.status !== 'unavailable'
    || candidate.stress.reason !== 'No rights-cleared, methodologically suitable stress indicator has been selected.'
    || !Array.isArray(candidate.stress.observations)
    || candidate.stress.observations.length !== 0) {
    return held('Missing, unapproved or relabeled financial-stress evidence.');
  }
  const rows = [];
  for (let i = 0; i < OFFICIAL_CONTEXT_CATALOG.length; i += 1) {
    const definition = OFFICIAL_CONTEXT_CATALOG[i];
    const observation = candidate.observations[i];
    if (!exactKeys(observation, expectedObservationKeys)
      || observation.id !== definition.id || observation.unit !== definition.unit
      || observation.origin !== 'hand-authored-toy-data'
      || !exactKeys(observation.previous, expectedPointKeys)
      || !exactKeys(observation.latest, expectedPointKeys)
      || observation.previous.date !== candidate.previous_friday
      || observation.latest.date !== candidate.week_ending
      || !Number.isFinite(observation.previous.value)
      || !Number.isFinite(observation.latest.value)
      || observation.previous.value < 0 || observation.latest.value < 0) {
      return held('Unknown source, stale or incomplete fictional observation.');
    }
    const delta = observation.latest.value - observation.previous.value;
    rows.push({
      ...definition,
      previousDate: observation.previous.date,
      latestDate: observation.latest.date,
      previous: observation.previous.value.toFixed(2),
      latest: observation.latest.value.toFixed(2),
      change: formatChange(delta, definition.unit),
      isSynthetic: true,
    });
  }
  return {
    status: 'synthetic-demo',
    reason: 'Fictional 2031 exercise only. Not current, past or forecast market data.',
    rows,
    thirdDial: OFFICIAL_CONTEXT_UNAVAILABLE_STRESS,
    publicationAllowed: false,
    scoreModelAllowed: false,
    regimeAvailable: false,
    scoreOutput: null,
  };
}
