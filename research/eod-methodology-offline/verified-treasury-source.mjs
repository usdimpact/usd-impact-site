// RESEARCH HOLD: exact-origin issuer-source candidate generator, never a publisher.
// Real Treasury input needs explicit fetch invocation; all outputs remain private Drafts.
// This is NOT a replacement for the protected original USD Impact Score v2.
import { createHash } from 'node:crypto';

export const TREASURY_METHOD_VERSION = 'METHOD-TREASURY-SOURCE-V0';
export const TREASURY_SOURCE_DOCUMENT =
  'https://home.treasury.gov/treasury-daily-interest-rate-xml-feed';
export const TREASURY_ENDPOINT =
  'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml';
const MAX_XML_BYTES = 500_000;
const MAX_ENTRIES = 45;
const NEW_YORK = 'America/New_York';

function assert(value, reason) { if (!value) throw new Error(reason); }

function dayIsValid(day) {
  if (typeof day !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day)) return false;
  const d = new Date(day + 'T00:00:00Z');
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === day;
}

function utcInstant(instant) {
  assert(typeof instant === 'string' &&
    /(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(instant), 'offset-aware as-of timestamp required');
  const d = new Date(instant);
  assert(Number.isFinite(d.valueOf()), 'invalid as-of timestamp');
  return d;
}

export function validateTreasuryClock(day, asOfUtc) {
  assert(dayIsValid(day), 'invalid requested observation day');
  const instant = utcInstant(asOfUtc);
  const local = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: NEW_YORK, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant).map(p => [p.type, p.value]));
  const localDay = local.year + '-' + local.month + '-' + local.day;
  assert(localDay === day, 'the requested observation day must match New York as-of day');
  assert(!['Sat', 'Sun'].includes(local.weekday), 'weekend observation requires separate policy');
  assert(Number(local.hour) >= 17, 'methodology source check is before 17:00 New York cutoff');
  return instant.toISOString();
}

export function treasuryMonthlyUrl(day) {
  assert(dayIsValid(day), 'invalid requested observation day');
  return TREASURY_ENDPOINT + '?data=daily_treasury_yield_curve&field_tdr_date_value_month=' +
    day.slice(0, 7).replace('-', '');
}

function uniqueTagValue(content, name) {
  const match = new RegExp('<(?:[A-Za-z][\\w.-]*:)?' + name +
    '\\b[^>]*>\\s*([^<>]*?)\\s*<\\/(?:[A-Za-z][\\w.-]*:)?' + name + '\\s*>', 'g');
  const found = [...content.matchAll(match)];
  assert(found.length <= 1, 'duplicate ' + name + ' XML field');
  return found.length === 0 ? null : found[0][1].trim();
}

function parseRate(s, label) {
  assert(s !== null && /^-?[0-9]{1,2}(?:\.[0-9]{1,4})?$/.test(s),
    label + ' missing, empty or not a numeric Treasury par yield');
  const value = Number(s);
  assert(Number.isFinite(value) && value >= -5 && value <= 40,
    label + ' is outside the supported research plausibility range');
  return value;
}

export function readTreasuryObservation(xml, day) {
  assert(dayIsValid(day), 'invalid requested observation day');
  assert(typeof xml === 'string' && Buffer.byteLength(xml, 'utf8') <= MAX_XML_BYTES,
    'Treasury XML exceeds bounded source size');
  assert(!/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<script\b/i.test(xml),
    'unsupported active or external XML construct');
  const feed = xml.trim().replace(/^\uFEFF/, '').match(
    /^(?:<\?xml\b[^>]*\?>\s*)?<(?:[A-Za-z][\w.-]*:)?feed\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z][\w.-]*:)?feed\s*>\s*$/,
  );
  assert(feed, 'not a complete Atom-style Treasury XML feed');
  const entryPattern = /<(?:[A-Za-z][\w.-]*:)?entry\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z][\w.-]*:)?entry\s*>/g;
  const entries = [...feed[1].matchAll(entryPattern)];
  assert(entries.length <= MAX_ENTRIES, 'unexpectedly large Treasury month feed');
  let found = null;
  const dates = new Set();
  for (const match of entries) {
    const dateValue = uniqueTagValue(match[1], 'NEW_DATE');
    assert(dateValue && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(dateValue) &&
      dayIsValid(dateValue.slice(0, 10)), 'bad or missing Treasury observation date');
    const observationDay = dateValue.slice(0, 10);
    assert(observationDay.slice(0, 7) === day.slice(0, 7),
      'Treasury monthly feed includes an observation from a different month');
    assert(!dates.has(observationDay), 'duplicate Treasury observation date in feed');
    dates.add(observationDay);
    if (observationDay !== day) continue;
    found = {
      observation_date: day,
      bc_2year_percent: parseRate(uniqueTagValue(match[1], 'BC_2YEAR'), 'BC_2YEAR'),
      bc_10year_percent: parseRate(uniqueTagValue(match[1], 'BC_10YEAR'), 'BC_10YEAR'),
    };
  }
  // The feed may be refreshed after a day is originally published. We therefore
  // do NOT infer an issuer release instant from feed/updated or entry/updated.
  return found;
}

function conciseNumber(n, locale) {
  return new Intl.NumberFormat(locale, {minimumFractionDigits: 2, maximumFractionDigits: 4}).format(n);
}

function buildCandidateInternal({ xml, day, asOfUtc, transport }) {
  const clock = validateTreasuryClock(day, asOfUtc);
  assert(['UNVERIFIED_FIXTURE', 'EXACT_ISSUER_RESPONSE'].includes(transport),
    'unrecognized source transport');
  const sourceUrl = treasuryMonthlyUrl(day);
  const observation = readTreasuryObservation(xml, day);
  const spread = observation === null ? null :
    Math.round((observation.bc_10year_percent - observation.bc_2year_percent) * 10000) / 10000;
  const record = {
    schema: TREASURY_METHOD_VERSION,
    edition_key: 'METHOD-TREASURY:' + day,
    kind: 'DAILY_METHOD_CANDIDATE',
    observation_date: day,
    captured_as_of_utc: clock,
    status: observation === null ? 'NO_MATCHING_OBSERVATION_DRAFT' : 'AWAITING_EDITORIAL_REVIEW',
    source: {
      publisher: 'U.S. Department of the Treasury',
      dataset: 'Daily Treasury Par Yield Curve Rates',
      canonical_url: sourceUrl,
      documentation_url: TREASURY_SOURCE_DOCUMENT,
      transport,
      source_sha256: createHash('sha256').update(xml, 'utf8').digest('hex'),
      source_observation_date: observation?.observation_date ?? null,
      publisher_release_instant: null,
      publisher_release_instant_verified: false,
      exact_original_score_input: false,
      public_redistribution_rights_granted: false,
      source_rights_status: 'SEPARATE_LEGAL_EDITORIAL_REVIEW_REQUIRED',
    },
    facts: observation === null ? [] : [
      {id: 'TREASURY:PAR:' + day + ':2Y', name: 'US Treasury 2Y par yield',
        value: observation.bc_2year_percent, unit: 'percent'},
      {id: 'TREASURY:PAR:' + day + ':10Y', name: 'US Treasury 10Y par yield',
        value: observation.bc_10year_percent, unit: 'percent'},
      {id: 'TREASURY:PAR:' + day + ':10Y_MINUS_2Y', name: '10Y minus 2Y par yield',
        value: spread, unit: 'percentage_point', method: '10Y par yield minus 2Y par yield'},
    ],
    permitted_claim_class: 'DATED_ISSUER_OBSERVATIONS_AND_ARITHMETIC_ONLY',
    interpretation_level: 'NO_CAUSAL_INFERENCE',
    publisher_release_verification_pending: true,
    human_editorial_review_required: true,
    live_issuer_fetch_does_not_grant_licence: true,
    original_score_reconstruction_authorized: false,
    public_release_authorized: false,
    existing_news_workflow_untouched: true,
  };
  return { record, en: renderTreasuryCandidate(record, 'en'), es: renderTreasuryCandidate(record, 'es') };
}

// Public test/fixture API always treats local XML as UNVERIFIED, regardless of extra props.
export function buildTreasuryCandidate({xml, day, asOfUtc}) {
  return buildCandidateInternal({xml, day, asOfUtc, transport: 'UNVERIFIED_FIXTURE'});
}

export function renderTreasuryCandidate(record, language) {
  assert(['en', 'es'].includes(language), 'unapproved candidate locale');
  assert(record?.schema === TREASURY_METHOD_VERSION && record.public_release_authorized === false,
    'only non-public Treasury research candidates may render');
  assert(record.kind === 'DAILY_METHOD_CANDIDATE' &&
    record.original_score_reconstruction_authorized === false &&
    record.human_editorial_review_required === true &&
    record.source?.public_redistribution_rights_granted === false &&
    record.source.exact_original_score_input === false &&
    record.source.canonical_url === treasuryMonthlyUrl(record.observation_date),
    'candidate status, rights or issuer provenance is inconsistent');
  const facts = record.facts;
  assert(Array.isArray(facts) && (facts.length === 0 || facts.length === 3),
    'candidate fact shape is inconsistent');
  if (facts.length === 3) {
    const prefix = 'TREASURY:PAR:' + record.observation_date;
    assert(record.source.source_observation_date === record.observation_date &&
      facts[0].id === prefix + ':2Y' && facts[1].id === prefix + ':10Y' &&
      facts[2].id === prefix + ':10Y_MINUS_2Y' &&
      facts[0].unit === 'percent' && facts[1].unit === 'percent' &&
      facts[2].unit === 'percentage_point' &&
      facts.every(f => typeof f.value === 'number' && Number.isFinite(f.value)),
      'candidate source facts, date or units are inconsistent');
    const expectedSpread = Math.round((facts[1].value - facts[0].value) * 10000) / 10000;
    assert(facts[2].value === expectedSpread,
      'candidate derived 10Y-minus-2Y value is inconsistent');
  } else {
    assert(record.source.source_observation_date === null &&
      record.status === 'NO_MATCHING_OBSERVATION_DRAFT',
      'candidate no-observation status is inconsistent');
  }
  const es = language === 'es';
  const name = es ? 'Nota diaria del método: curva del Tesoro' :
    'Daily Method Note: U.S. Treasury yield curve';
  const caution = es ?
    'BORRADOR NO PUBLICABLE. Fuente y fecha deben pasar revisión editorial y de derechos.' :
    'NON-PUBLISHABLE DRAFT. Source and dates require editorial and rights review.';
  const guidance = es ?
    'Para análisis reales, utilice datos actuales, verificados y con licencia o permiso apropiado para su uso. No sustituya el Score original por estos tipos del Tesoro.' :
    'For real-world analysis use current, verified, appropriately licensed or permitted data. These Treasury rates are not the original USD Impact Score inputs.';
  const lines = ['# ' + name + ' — ' + record.observation_date, '', '**' + caution + '**',
    '', guidance, '', (es ? 'Fuente primaria: ' : 'Primary source: ') + record.source.canonical_url,
    (es ? 'Consultado a las ' : 'Captured as of ') + record.captured_as_of_utc, ''];
  if (record.facts.length === 0) {
    lines.push(es ?
      'El feed mensual consultado no contenía una observación para esa fecha en el momento de la consulta. Esto no demuestra que no hubiera actividad en los mercados.' :
      'The retrieved monthly feed had no observation for this date at capture. This does not demonstrate that markets had no activity.');
  } else {
    const [two, ten, spread] = record.facts;
    lines.push(es ? '## Observaciones y cálculo verificable' : '## Source observations and reproducible arithmetic');
    lines.push((es ? 'Rentabilidad par del Tesoro a 2 años: ' : 'Treasury two-year par yield: ') +
      conciseNumber(two.value, es ? 'es-ES' : 'en-US') + '%.');
    lines.push((es ? 'Rentabilidad par del Tesoro a 10 años: ' : 'Treasury ten-year par yield: ') +
      conciseNumber(ten.value, es ? 'es-ES' : 'en-US') + '%.');
    lines.push((es ? 'Diferencia 10 años − 2 años: ' : 'Ten-year minus two-year spread: ') +
      conciseNumber(spread.value, es ? 'es-ES' : 'en-US') +
      (es ? ' puntos porcentuales.' : ' percentage points.'));
    lines.push(es ?
      'Estos datos describen una curva publicada por el Tesoro. No prueban por sí solos un movimiento del dólar, oro, petróleo, Bitcoin ni acciones.' :
      'These observations describe the Treasury par curve. Alone, they do not establish movements in the dollar, gold, oil, Bitcoin or equities.');
  }
  lines.push('', es ?
    'La hora de publicación original no está certificada. No se afirma que estos datos estuvieran disponibles antes de la hora de consulta.' :
    'The original publisher release instant is not certified. No availability before the capture time is asserted.');
  lines.push(es ? 'Solo uso educativo; sin recomendaciones de inversión.' :
    'Educational use only; not investment advice.');
  return {
    language, markdown: lines.join('\n'), fact_ids: record.facts.map(f => f.id),
    canonical_values: record.facts.map(f => f.value),
    canonical_source_url: record.source.canonical_url,
    public_release_authorized: false,
    review_required: true,
  };
}

// Deliberately redacted receipt for source-schema QA. A real-data CLI must not
// accidentally publish rates or translated fact narratives in CI or terminal logs.
export function redactedIssuerProbeReceipt(candidate) {
  assert(candidate?.record?.schema === TREASURY_METHOD_VERSION &&
    candidate.record.source?.transport === 'EXACT_ISSUER_RESPONSE' &&
    candidate.record.public_release_authorized === false &&
    candidate.record.source.public_redistribution_rights_granted === false &&
    candidate.record.original_score_reconstruction_authorized === false,
    'not a rights-held exact-issuer private candidate');
  // Revalidate fact and bilingual integrity before acknowledging the response.
  const en = renderTreasuryCandidate(candidate.record, 'en');
  const es = renderTreasuryCandidate(candidate.record, 'es');
  assert(JSON.stringify(en.fact_ids) === JSON.stringify(es.fact_ids) &&
    JSON.stringify(en.canonical_values) === JSON.stringify(es.canonical_values),
    'inconsistent bilingual candidate');
  return {
    schema: candidate.record.schema,
    scenario: 'PRIVATE_ISSUER_SCHEMA_RECEIPT_ONLY',
    observation_date: candidate.record.observation_date,
    captured_as_of_utc: candidate.record.captured_as_of_utc,
    issuer_url: candidate.record.source.canonical_url,
    source_sha256: candidate.record.source.source_sha256,
    parsed_field_ids: candidate.record.facts.map(f => f.id),
    parsed_field_count: candidate.record.facts.length,
    original_publisher_release_time_verified: false,
    issuer_raw_values_redacted: true,
    issuer_numerical_data_not_logged: true,
    public_release_authorized: false,
    original_score_reconstruction_authorized: false,
    rights_and_editorial_hold: true,
  };
}

// Exact-origin fetch remains opt-in and never authorizes a public output.
// The capture timestamp is recorded AFTER the response was actually received.
export async function fetchTreasuryCandidate({day, fetchImpl, clock = () => new Date()}) {
  assert(typeof clock === 'function', 'explicit clock provider required');
  const started = clock();
  assert(started instanceof Date && Number.isFinite(started.valueOf()), 'invalid request clock');
  validateTreasuryClock(day, started.toISOString());
  assert(typeof fetchImpl === 'function', 'explicit issuer fetch capability required');
  const url = treasuryMonthlyUrl(day);
  const response = await fetchImpl(url, {
    method: 'GET', redirect: 'error', credentials: 'omit',
    headers: {accept: 'application/xml, application/atom+xml;q=0.9, text/xml;q=0.8'},
    signal: AbortSignal.timeout(8000),
  });
  assert(response && response.ok === true && response.status === 200,
    'Treasury issuer request did not return HTTP 200');
  assert(response.url === url && response.redirected !== true,
    'issuer URL or redirect changed; refusing source');
  const mime = response.headers?.get('content-type') ?? '';
  assert(/^(?:application\/(?:xml|atom\+xml)|text\/xml)(?:;|$)/i.test(mime),
    'unexpected Treasury content type');
  const length = Number(response.headers?.get('content-length') ?? 0);
  assert(Number.isFinite(length) && length >= 0 && length <= MAX_XML_BYTES,
    'issuer response length outside bound');
  let text;
  if (response.body && typeof response.body.getReader === 'function') {
    // Actual HTTP streams are limited before full buffering. Fixture responses
    // without streams may use the text() fallback for injected tests only.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parts = [];
    let bytes = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      assert(bytes <= MAX_XML_BYTES, 'issuer stream exceeds bounded XML size');
      parts.push(decoder.decode(value, {stream:true}));
    }
    parts.push(decoder.decode());
    text = parts.join('');
  } else {
    text = await response.text();
    assert(Buffer.byteLength(text, 'utf8') <= MAX_XML_BYTES, 'issuer body exceeds bound');
  }
  const captured = clock();
  assert(captured instanceof Date && Number.isFinite(captured.valueOf()), 'invalid capture clock');
  assert(captured.getTime() >= started.getTime(), 'capture clock moved backwards');
  const capturedAsOfUtc = validateTreasuryClock(day, captured.toISOString());
  return buildCandidateInternal({
    xml: text, day, asOfUtc: capturedAsOfUtc, transport: 'EXACT_ISSUER_RESPONSE',
  });
}
