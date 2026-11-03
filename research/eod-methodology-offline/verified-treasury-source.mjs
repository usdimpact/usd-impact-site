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

function treasuryReviewContext(day, asOfUtc, {allowRetrospective = false} = {}) {
  assert(dayIsValid(day), 'invalid requested observation day');
  assert(typeof allowRetrospective === 'boolean', 'retrospective flag must be boolean');
  const targetDow = new Date(day + 'T00:00:00Z').getUTCDay();
  assert(targetDow !== 0 && targetDow !== 6, 'weekend observation requires separate policy');
  const instant = utcInstant(asOfUtc);
  const local = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: NEW_YORK, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant).map(p => [p.type, p.value]));
  const localDay = local.year + '-' + local.month + '-' + local.day;
  const calendarLag = (Date.parse(localDay + 'T00:00:00Z') -
    Date.parse(day + 'T00:00:00Z')) / 86400000;
  if (calendarLag === 0) {
    // Treasury usually publishes by 18:00 ET, but delayed releases occur.
    // This is an eligibility buffer, not evidence of first publication.
    assert(Number(local.hour) * 60 + Number(local.minute) >= 1110,
      'Treasury source check is before 18:30 New York availability buffer');
  } else {
    // Retrospective only by explicit opt-in; allow weekend capture of a
    // WEEKDAY observation. Do not silently treat old data as today's data.
    assert(allowRetrospective && calendarLag >= 1 && calendarLag <= 14,
      'retrospective review requires explicit opt-in within 14 calendar days');
  }
  return {
    as_of_utc: instant.toISOString(),
    capture_mode: calendarLag === 0 ? 'SAME_DAY_AFTER_1830_ET' : 'EXPLICIT_RETROSPECTIVE',
    capture_lag_calendar_days: calendarLag,
    first_issuer_publication_time_verified: false,
  };
}

export function validateTreasuryClock(day, asOfUtc, options = {}) {
  return treasuryReviewContext(day, asOfUtc, options).as_of_utc;
}

// Pure CLI plan. The network-facing option requires an exact combination of
// flags and one fixed Treasury URL; it cannot silently choose a historical day.
export function planTreasuryProbeArgs(args) {
  assert(Array.isArray(args) && args.every(a => typeof a === 'string'),
    'CLI flags must be a string list');
  if (args.length === 1 && args[0] === '--demo') {
    return {mode:'demo', day:null, allowRetrospective:false};
  }
  if (args.length === 1 && args[0] === '--live-official') {
    return {mode:'live', day:null, allowRetrospective:false};
  }
  const prefix = '--probe-date=';
  if (args.length === 3 && args[0] === '--live-official' &&
      args[1].startsWith(prefix) && args[2] === '--allow-retrospective') {
    const day = args[1].slice(prefix.length);
    assert(dayIsValid(day), 'invalid explicit retrospective observation date');
    return {mode:'live', day, allowRetrospective:true};
  }
  throw new Error('Use --demo; --live-official; or --live-official --probe-date=YYYY-MM-DD --allow-retrospective. No implicit network requests.');
}

export function treasuryMonthlyUrl(day) {
  assert(dayIsValid(day), 'invalid requested observation day');
  return TREASURY_ENDPOINT + '?data=daily_treasury_yield_curve&field_tdr_date_value_month=' +
    day.slice(0, 7).replace('-', '');
}

function uniqueDataTagValue(properties, name) {
  // Only the issuer-declared OData 'd:' namespace is valid for yield fields.
  // A matching-looking value outside m:properties is not a source observation.
  const match = new RegExp('<d:' + name +
    '\\b[^>]*>\\s*([^<>]*?)\\s*<\\/d:' + name + '\\s*>', 'g');
  const found = [...properties.matchAll(match)];
  assert(found.length <= 1, 'duplicate ' + name + ' XML field');
  return found.length === 0 ? null : found[0][1].trim();
}

function entryProperties(entryXml) {
  const content = [...entryXml.matchAll(/<content\b([^>]*)>([\s\S]*?)<\/content\s*>/g)];
  assert(content.length === 1 && /(?:^|\s)type\s*=\s*["']application\/xml["'](?:\s|$)/.test(content[0][1]),
    'unexpected Treasury Atom entry content type or count');
  const blocks = [...content[0][2].matchAll(/<m:properties(?:\s[^>]*)?>([\s\S]*?)<\/m:properties\s*>/g)];
  assert(blocks.length === 1, 'missing or duplicate Treasury OData properties');
  return blocks[0][1];
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
    /^(?:<\?xml\b[^>]*\?>\s*)?<feed\b([^>]*)>([\s\S]*?)<\/feed\s*>\s*$/,
  );
  assert(feed, 'not a complete Atom-style Treasury XML feed');
  const attrs = feed[1];
  assert(/\bxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2005\/Atom["']/.test(attrs) &&
    /\bxmlns:d\s*=\s*["']http:\/\/schemas\.microsoft\.com\/ado\/2007\/08\/dataservices["']/.test(attrs) &&
    /\bxmlns:m\s*=\s*["']http:\/\/schemas\.microsoft\.com\/ado\/2007\/08\/dataservices\/metadata["']/.test(attrs),
    'unexpected Treasury Atom or OData namespaces');
  const entryPattern = /<entry\b[^>]*>([\s\S]*?)<\/entry\s*>/g;
  const entries = [...feed[2].matchAll(entryPattern)];
  assert(entries.length <= MAX_ENTRIES, 'unexpectedly large Treasury month feed');
  assert((feed[2].match(/<entry\b/g) ?? []).length === entries.length &&
    (feed[2].match(/<\/entry\s*>/g) ?? []).length === entries.length,
    'malformed or incomplete Treasury Atom entry');
  let found = null;
  const dates = new Set();
  for (const match of entries) {
    const properties = entryProperties(match[1]);
    const dateValue = uniqueDataTagValue(properties, 'NEW_DATE');
    // Treasury OData NEW_DATE is a date-time lexical value; a valid YYYY-MM-DD
    // prefix alone does not authorize arbitrary trailing content as a real date.
    // Treasury's documented Edm.DateTime allows yyyy-mm-ddThh:mm with optional
    // seconds and fractional seconds; reject broken suffixes, not valid minute-only input.
    assert(dateValue && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\.[0-9]{1,7})?)?Z?$/.test(dateValue) &&
      dayIsValid(dateValue.slice(0, 10)), 'bad or missing Treasury observation date');
    const observationDay = dateValue.slice(0, 10);
    assert(observationDay.slice(0, 7) === day.slice(0, 7),
      'Treasury monthly feed includes an observation from a different month');
    assert(!dates.has(observationDay), 'duplicate Treasury observation date in feed');
    dates.add(observationDay);
    if (observationDay !== day) continue;
    found = {
      observation_date: day,
      bc_2year_percent: parseRate(uniqueDataTagValue(properties, 'BC_2YEAR'), 'BC_2YEAR'),
      bc_10year_percent: parseRate(uniqueDataTagValue(properties, 'BC_10YEAR'), 'BC_10YEAR'),
    };
  }
  // The feed may be refreshed after a day is originally published. We therefore
  // do NOT infer an issuer release instant from feed/updated or entry/updated.
  return found;
}

function conciseNumber(n, locale) {
  return new Intl.NumberFormat(locale, {minimumFractionDigits: 2, maximumFractionDigits: 4}).format(n);
}

function buildCandidateInternal({ xml, day, asOfUtc, transport, httpChecks = null, allowRetrospective = false, rawSourceSha256 = null }) {
  const context = treasuryReviewContext(day, asOfUtc, {allowRetrospective});
  const clock = context.as_of_utc;
  assert(['UNVERIFIED_FIXTURE', 'EXACT_ISSUER_RESPONSE'].includes(transport),
    'unrecognized source transport');
  const sourceUrl = treasuryMonthlyUrl(day);
  assert(rawSourceSha256 === null || (/^[0-9a-f]{64}$/.test(rawSourceSha256) &&
    transport === 'EXACT_ISSUER_RESPONSE'), 'raw response digest is not valid for this transport');
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
      // An injected fetch capability and an asserted URL do not independently
      // authenticate the publisher; the raw-header/origin gate remains held.
      origin_provenance_level: transport === 'EXACT_ISSUER_RESPONSE' ?
        'ASSERTED_EXACT_RESPONSE_URL_NOT_INDEPENDENTLY_ATTESTED' : 'UNVERIFIED_FIXTURE',
      issuer_payload_origin_independently_attested: false,
      source_sha256: rawSourceSha256 ?? createHash('sha256').update(xml, 'utf8').digest('hex'),
      source_hash_basis: rawSourceSha256 ? 'FETCH_BODY_BYTES_POST_HTTP_DECODING' :
        (transport === 'EXACT_ISSUER_RESPONSE' ? 'REENCODED_TEXT_FALLBACK_NOT_RAW' : 'UTF8_FIXTURE_TEXT'),
      http_response_checks: transport === 'EXACT_ISSUER_RESPONSE' ? httpChecks : null,
      capture_context: context,
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
export function buildTreasuryCandidate({xml, day, asOfUtc, allowRetrospective = false}) {
  return buildCandidateInternal({xml, day, asOfUtc, transport: 'UNVERIFIED_FIXTURE', allowRetrospective});
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
    record.source.publisher_release_instant === null &&
    record.source.publisher_release_instant_verified === false &&
    record.source.issuer_payload_origin_independently_attested === false &&
    ['UNVERIFIED_FIXTURE', 'EXACT_ISSUER_RESPONSE'].includes(record.source.transport) &&
    record.source.origin_provenance_level === (
      record.source.transport === 'EXACT_ISSUER_RESPONSE' ?
        'ASSERTED_EXACT_RESPONSE_URL_NOT_INDEPENDENTLY_ATTESTED' : 'UNVERIFIED_FIXTURE'
    ) &&
    (record.source.source_hash_basis === 'UTF8_FIXTURE_TEXT' &&
      record.source.transport === 'UNVERIFIED_FIXTURE' ||
      ['FETCH_BODY_BYTES_POST_HTTP_DECODING', 'REENCODED_TEXT_FALLBACK_NOT_RAW'].includes(record.source.source_hash_basis) &&
      record.source.transport === 'EXACT_ISSUER_RESPONSE') &&
    /^[a-f0-9]{64}$/.test(record.source.source_sha256) &&
    record.source.source_rights_status === 'SEPARATE_LEGAL_EDITORIAL_REVIEW_REQUIRED' &&
    record.source.documentation_url === TREASURY_SOURCE_DOCUMENT &&
    record.source.canonical_url === treasuryMonthlyUrl(record.observation_date) &&
    record.edition_key === 'METHOD-TREASURY:' + record.observation_date &&
    record.permitted_claim_class === 'DATED_ISSUER_OBSERVATIONS_AND_ARITHMETIC_ONLY' &&
    record.interpretation_level === 'NO_CAUSAL_INFERENCE' &&
    record.publisher_release_verification_pending === true &&
    record.live_issuer_fetch_does_not_grant_licence === true &&
    record.existing_news_workflow_untouched === true,
    'candidate status, rights or issuer provenance is inconsistent');
  const ctx = record.source?.capture_context;
  assert(ctx && ['SAME_DAY_AFTER_1830_ET','EXPLICIT_RETROSPECTIVE'].includes(ctx.capture_mode),
    'missing or unauthorized source capture context');
  const expectedCtx = treasuryReviewContext(record.observation_date, record.captured_as_of_utc,
    {allowRetrospective: ctx.capture_mode === 'EXPLICIT_RETROSPECTIVE'});
  assert(ctx.capture_lag_calendar_days === expectedCtx.capture_lag_calendar_days &&
    ctx.capture_mode === expectedCtx.capture_mode &&
    ctx.as_of_utc === expectedCtx.as_of_utc &&
    ctx.first_issuer_publication_time_verified === false,
    'candidate capture date relation or issuer vintage was modified');
  const facts = record.facts;
  assert(Array.isArray(facts) && (facts.length === 0 || facts.length === 3),
    'candidate fact shape is inconsistent');
  if (facts.length === 3) {
    assert(record.status === 'AWAITING_EDITORIAL_REVIEW',
      'fact-bearing Treasury candidate is not pending editorial review');
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
  if (ctx.capture_mode === 'EXPLICIT_RETROSPECTIVE') {
    lines.push(es ?
      'Revisión retrospectiva: la fecha de consulta es posterior a la observación. No se conoce la hora de primera publicación.' :
      'Retrospective review: captured after the observation date. First publication time remains unknown.');
  }
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
    origin_provenance_level: candidate.record.source.origin_provenance_level,
    issuer_payload_origin_independently_attested: false,
    source_sha256: candidate.record.source.source_sha256,
    source_hash_basis: candidate.record.source.source_hash_basis,
    // Presence/type checks only. Header validators are not first publication times.
    http_response_checks: candidate.record.source.http_response_checks,
    capture_context: candidate.record.source.capture_context,
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
export async function fetchTreasuryCandidate({day, fetchImpl, clock = () => new Date(), allowRetrospective = false}) {
  assert(typeof clock === 'function', 'explicit clock provider required');
  const started = clock();
  assert(started instanceof Date && Number.isFinite(started.valueOf()), 'invalid request clock');
  validateTreasuryClock(day, started.toISOString(), {allowRetrospective});
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
  // Record bounded header presence/type metadata, never header payloads, rates,
  // or assumptions about the original first-publication time.
  const httpChecks = {
    http_status: response.status,
    content_type: mime.split(';')[0].trim().toLowerCase(),
    http_date_header_present: Boolean(response.headers?.get('date')),
    last_modified_header_present: Boolean(response.headers?.get('last-modified')),
    etag_header_present: Boolean(response.headers?.get('etag')),
    original_first_publication_instant_verified: false,
  };
  const length = Number(response.headers?.get('content-length') ?? 0);
  assert(Number.isFinite(length) && length >= 0 && length <= MAX_XML_BYTES,
    'issuer response length outside bound');
  let text;
  let rawSourceSha256 = null;
  if (response.body && typeof response.body.getReader === 'function') {
    // Actual HTTP streams are limited before full buffering. Fixture responses
    // without streams may use the text() fallback for injected tests only.
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', {fatal:true});
    const rawHash = createHash('sha256');
    const parts = [];
    let bytes = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      assert(value instanceof Uint8Array, 'issuer stream yielded a non-binary chunk');
      bytes += value.byteLength;
      assert(bytes <= MAX_XML_BYTES, 'issuer stream exceeds bounded XML size');
      rawHash.update(value);
      parts.push(decoder.decode(value, {stream:true}));
    }
    parts.push(decoder.decode());
    text = parts.join('');
    rawSourceSha256 = rawHash.digest('hex');
  } else {
    text = await response.text();
    assert(Buffer.byteLength(text, 'utf8') <= MAX_XML_BYTES, 'issuer body exceeds bound');
  }
  const captured = clock();
  assert(captured instanceof Date && Number.isFinite(captured.valueOf()), 'invalid capture clock');
  assert(captured.getTime() >= started.getTime(), 'capture clock moved backwards');
  const capturedAsOfUtc = validateTreasuryClock(day, captured.toISOString(), {allowRetrospective});
  return buildCandidateInternal({
    xml: text, day, asOfUtc: capturedAsOfUtc, transport: 'EXACT_ISSUER_RESPONSE',
    httpChecks, allowRetrospective, rawSourceSha256,
  });
}
