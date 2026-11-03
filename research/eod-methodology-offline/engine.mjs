// DRAFT RESEARCH FIXTURE ONLY. No provider I/O, publishing, or runtime integration.
// A real-data source or even an authorized commercial license must fail this demo.
const MARKER = 'SYNTHETIC_DO_NOT_PUBLISH';
const VERSION = 'EOD-OFFLINE-V0';
const CUT_OFF = 17;
const dayMs = 86_400_000;
const zone = 'America/New_York';

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function isoDay(x) {
  requireThat(/^\d{4}-\d{2}-\d{2}$/.test(x), 'invalid ISO day');
  const date = new Date(`${x}T00:00:00Z`);
  requireThat(!Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === x, 'invalid calendar date');
  return date;
}

function nyParts(instant) {
  const date = new Date(instant);
  requireThat(Number.isFinite(date.valueOf()) && /Z$|[+-]\d\d:\d\d$/.test(instant), 'invalid offset-aware timestamp');
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday, hour: Number(p.hour), minute: Number(p.minute) };
}

function strictKeys(o, fields, name) {
  requireThat(o && typeof o === 'object' && !Array.isArray(o), `invalid ${name}`);
  requireThat(Object.keys(o).every(k => fields.includes(k)), `unexpected ${name} field`);
  for (const k of fields) requireThat(Object.hasOwn(o, k), `missing ${name}.${k}`);
}

function validateFact(f) {
  strictKeys(f, ['fact_id', 'source_id', 'published_at_utc', 'license', 'kind', 'indicator', 'value', 'unit', 'relation'], 'fact');
  requireThat(typeof f.fact_id === 'string' && /^SYNTHETIC:FACT:[0-9]{4}-[0-9]{2}-[0-9]{2}:[AB]$/.test(f.fact_id), 'fact not synthetic');
  requireThat(typeof f.source_id === 'string' && f.source_id.startsWith('SYNTHETIC:SOURCE:'), 'real provider source rejected');
  requireThat(f.license === MARKER && f.kind === 'invented', 'unauthorized commercial, real or licensed input rejected');
  requireThat(['supports', 'challenges', 'unknown'].includes(f.relation), 'invalid evidence classification');
  requireThat(['DEMO_A', 'DEMO_B'].includes(f.indicator), 'unexpected indicator');
  requireThat(f.unit === 'invented_points' && Number.isFinite(f.value), 'invalid synthetic value/unit');
  requireThat(typeof f.published_at_utc === 'string' && !Number.isNaN(Date.parse(f.published_at_utc)), 'missing release timestamp');
}

function validateReviewRecord(record, kind) {
  strictKeys(record, ['kind', 'version', 'fixture_marker', 'public_release_authorized', 'from', 'to', 'input_ids', 'facts', 'counts', 'complete', 'status'], 'review');
  requireThat(record.kind === kind && record.version === VERSION && record.fixture_marker === MARKER && record.status === 'SYNTHETIC_ONLY_HOLD' && record.public_release_authorized === false && record.complete === true, 'unapproved or mutated review');
  isoDay(record.from); isoDay(record.to);
  requireThat(record.from <= record.to && Array.isArray(record.input_ids) && record.input_ids.length > 0 && new Set(record.input_ids).size === record.input_ids.length, 'invalid review identity');
  requireThat(Array.isArray(record.facts) && record.facts.length > 0, 'missing review facts');
  const seen = new Set();
  const counts = { supports: 0, challenges: 0, unknown: 0 };
  for (const f of record.facts) {
    validateFact(f);
    const day = f.fact_id.split(':')[2];
    requireThat(day >= record.from && day <= record.to && !seen.has(f.fact_id), 'unmatched or duplicate review fact');
    seen.add(f.fact_id);
    counts[f.relation]++;
  }
  requireThat(JSON.stringify(counts) === JSON.stringify(record.counts), 'review counts mismatch');
}

export function validateDailyFixture(edition) {
  strictKeys(edition, ['fixture_marker', 'version', 'day', 'as_of_utc', 'facts'], 'edition');
  requireThat(edition.fixture_marker === MARKER && edition.version === VERSION, 'non-synthetic fixture rejected');
  isoDay(edition.day);
  const local = nyParts(edition.as_of_utc);
  requireThat(local.day === edition.day, 'as-of date does not match New York calendar date');
  requireThat(!['Sat', 'Sun'].includes(local.weekday), 'weekend requires a distinct policy');
  requireThat(local.hour >= CUT_OFF, 'before proposed 17:00 New York cutoff');
  requireThat(Array.isArray(edition.facts) && edition.facts.length >= 1 && edition.facts.length <= 12, 'invalid synthetic fact count');
  const seen = new Set();
  for (const f of edition.facts) {
    validateFact(f);
    requireThat(f.fact_id.startsWith(`SYNTHETIC:FACT:${edition.day}:`), 'fact from another date');
    requireThat(Date.parse(f.published_at_utc) <= Date.parse(edition.as_of_utc), 'future source release used before cutoff');
    requireThat(!seen.has(f.fact_id), 'duplicate fact id');
    seen.add(f.fact_id);
  }
  return true;
}

function orderedUniqueFacts(reviews) {
  const seen = new Set();
  const out = [];
  for (const r of reviews) for (const f of r.facts) {
    requireThat(!seen.has(f.fact_id), 'duplicate fact across periods');
    seen.add(f.fact_id);
    out.push({ ...f });
  }
  return out;
}

function review(kind, from, to, inputs, facts, complete) {
  const uniqueInputs = [...new Set(inputs)];
  requireThat(uniqueInputs.length === inputs.length, 'duplicate input edition');
  const counts = { supports: 0, challenges: 0, unknown: 0 };
  for (const f of facts) counts[f.relation]++;
  return {
    kind, version: VERSION, fixture_marker: MARKER, public_release_authorized: false,
    from, to, input_ids: uniqueInputs, facts, counts, complete,
    status: 'SYNTHETIC_ONLY_HOLD',
  };
}

export function daily(edition) {
  validateDailyFixture(edition);
  return review('daily', edition.day, edition.day, [`SYNTHETIC:DAY:${edition.day}`], edition.facts.map(f => ({ ...f })), true);
}

function nextDay(day, offset) {
  return new Date(isoDay(day).valueOf() + offset * dayMs).toISOString().slice(0, 10);
}

export function weekly(dailies) {
  requireThat(Array.isArray(dailies) && dailies.length === 5, 'weekly requires five days');
  dailies.forEach(d => { validateReviewRecord(d, 'daily'); requireThat(d.from === d.to && d.input_ids.length === 1 && d.input_ids[0] === `SYNTHETIC:DAY:${d.from}`, 'weekly requires validated daily'); }); 
  const ds = dailies.map(x => x.from).sort();
  requireThat(new Date(`${ds[0]}T00:00:00Z`).getUTCDay() === 1, 'week must start Monday');
  for (let i = 0; i < 5; i++) requireThat(ds[i] === nextDay(ds[0], i), 'missing or duplicate weekday');
  const ordered = [...dailies].sort((a, b) => a.from.localeCompare(b.from));
  return review('weekly', ds[0], ds[4], ordered.map(x => x.input_ids[0]), orderedUniqueFacts(ordered), true);
}

export function monthly(weeks, month) {
  requireThat(/^\d{4}-\d{2}$/.test(month), 'invalid month');
  requireThat(Array.isArray(weeks) && weeks.length > 0, 'month requires weekly inputs');
  weeks.forEach(w => { validateReviewRecord(w, 'weekly'); requireThat(w.input_ids.length === 5, 'month requires validated weeks'); });
  const ordered = [...weeks].sort((a, b) => a.from.localeCompare(b.from));
  const first = `${month}-01`, last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  requireThat(ordered[0].from === first, 'missing month opening');
  for (let i = 1; i < ordered.length; i++) requireThat(ordered[i].from === nextDay(ordered[i - 1].from, 7), 'gap or overlap between weeks');
  requireThat(ordered[ordered.length - 1].to >= nextDay(last, -2), 'missing month closing');
  // This v0 fixture requires a whole four-week February, not arbitrary calendar-month months.
  requireThat(first === ordered[0].from && last === nextDay(ordered[ordered.length - 1].to, 2), 'partial month held (v0 requires four complete weeks)');
  return review('monthly', first, last, ordered.map(w => `SYNTHETIC:WEEK:${w.to}`), orderedUniqueFacts(ordered), true);
}

const messages = {
  en: { daily: 'Daily method note', weekly: 'Weekly method audit', monthly: 'Monthly method review',
    caution: 'INVENTED DATA ONLY — NOT MARKET DATA, A FORECAST OR A PUBLISHED SCORE.',
    section: 'Evidence', supports: 'Supports the hypothetical condition', challenges: 'Challenges the hypothetical condition', unknown: 'Not established', source: 'Synthetic source', limit: 'No investment guidance. No production rights or publication authority.' },
  es: { daily: 'Nota diaria del método', weekly: 'Auditoría semanal del método', monthly: 'Revisión mensual del método',
    caution: 'SOLO DATOS INVENTADOS: NO SON DATOS DE MERCADO, PREVISIONES NI UN SCORE PUBLICADO.',
    section: 'Evidencia', supports: 'Respalda la condición hipotética', challenges: 'Cuestiona la condición hipotética', unknown: 'No establecido', source: 'Fuente ficticia', limit: 'Sin recomendaciones de inversión. Sin derechos ni autorización para publicación.' },
};

export function render(reviewRecord, locale) {
  requireThat(Object.hasOwn(messages, locale), 'unapproved locale');
  requireThat(['daily', 'weekly', 'monthly'].includes(reviewRecord.kind), 'unknown report type');
  validateReviewRecord(reviewRecord, reviewRecord.kind);
  const l = messages[locale];
  const line = f => `- [${f.fact_id}] ${f.indicator}: ${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-ES', {minimumFractionDigits:2,maximumFractionDigits:2}).format(f.value)} ${f.unit} — ${l[f.relation]}. (${l.source}: ${f.source_id})`;
  const markdown = [`# ${l[reviewRecord.kind]} (${reviewRecord.from} / ${reviewRecord.to})`, '', `**${l.caution}**`, '', `## ${l.section}`, ...reviewRecord.facts.map(line), '', l.limit].join('\n');
  return { locale, markdown, canonical_fact_ids: reviewRecord.facts.map(f => f.fact_id),
    canonical_values: reviewRecord.facts.map(f => f.value), source_ids: reviewRecord.facts.map(f => f.source_id),
    counts: { ...reviewRecord.counts }, status: reviewRecord.status, publish_allowed: false };
}

export function syntheticScore(inputs) {
  requireThat(Array.isArray(inputs) && inputs.length === 8, 'exactly eight invented inputs required');
  const expectedWeights = [0.125, -0.125, -0.125, 0.125, -0.125, -0.125, 0.125, 0.125];
  const seen = new Set();
  let total = 0;
  const rows = inputs.map((x, i) => {
    strictKeys(x, ['id', 'fixture_marker', 'x', 'mean', 'std', 'weight'], 'Score input');
    requireThat(x.fixture_marker === MARKER && /^SYNTHETIC:SCORE:/.test(x.id) && !seen.has(x.id), 'real or duplicate Score input');
    requireThat([x.x, x.mean, x.std, x.weight].every(Number.isFinite) && x.std > 0, 'invalid synthetic Score input');
    requireThat(x.weight === expectedWeights[i], 'changed weights require a new teaching method version');
    seen.add(x.id);
    const z = (x.x - x.mean) / x.std;
    const clipped = Math.max(-3.5, Math.min(3.5, z));
    const contribution = clipped * x.weight;
    total += contribution;
    return { id: x.id, z, clipped, contribution };
  });
  return { fixture_marker: MARKER, status: 'SYNTHETIC_ONLY_HOLD', public_release_authorized: false, total: Math.round(total * 1e8) / 1e8, rows };
}

export const fixtureContract = Object.freeze({ marker: MARKER, version: VERSION, cutoffHour: CUT_OFF });
