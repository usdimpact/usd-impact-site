// Standalone automation policy prototype. Synthetic metadata only: no market-data I/O.
// A successful draft eligibility evaluation never authorizes publication.
export const METHOD_DRY_RUN_VERSION = 'EOD-METHOD-RESEARCH-V1';
export const AUTOMATION_RIGHTS = 'SYNTHETIC_ONLY_HOLD';
const ZONE = 'America/New_York';
const DAY_MS = 86400000;

function requireValid(ok, reason) {
  if (!ok) throw new Error(reason);
}

function localParts(asOfUtc) {
  requireValid(typeof asOfUtc === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(asOfUtc), 'offset-aware clock required');
  const instant = new Date(asOfUtc);
  requireValid(Number.isFinite(instant.valueOf()), 'invalid clock');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant).map(p => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday,
    hour: Number(parts.hour), minute: Number(parts.minute) };
}

function nextWeekday(day) {
  let instant = new Date(`${day}T00:00:00Z`).getTime();
  do {
    instant += DAY_MS;
  } while ([0, 6].includes(new Date(instant).getUTCDay()));
  return new Date(instant).toISOString().slice(0, 10);
}

export function classifySyntheticEvidence(sources) {
  requireValid(Array.isArray(sources) && sources.length <= 12, 'synthetic evidence list required');
  const ids = new Set();
  for (const source of sources) {
    requireValid(source && typeof source === 'object' && !Array.isArray(source), 'invalid source');
    const keys = Object.keys(source).sort();
    requireValid(JSON.stringify(keys) === JSON.stringify(['id', 'kind', 'permitted', 'verified']), 'unexpected source fields');
    requireValid(source.kind === 'invented' && typeof source.id === 'string' && /^SYNTHETIC:SOURCE:[A-Z][A-Z0-9_-]*$/.test(source.id), 'real or provider source denied');
    requireValid(!ids.has(source.id), 'duplicate source');
    ids.add(source.id);
    requireValid(typeof source.verified === 'boolean' && typeof source.permitted === 'boolean', 'invalid synthetic source gates');
  }
  if (sources.some(s => !s.verified || !s.permitted)) {
    return { kind: 'SOURCE_HOLD', count: sources.length, reason: 'synthetic gate marked unverified or denied' };
  }
  if (sources.length === 0) {
    return { kind: 'QUIET_DAY_EXERCISE_DRAFT', count: 0,
      reason: 'no new eligible evidence; no claim of a market change' };
  }
  if (sources.length === 1) {
    return { kind: 'SINGLE_SOURCE_METHOD_DRAFT', count: 1,
      reason: 'explain one hypothetical item and disclose what it cannot establish' };
  }
  return { kind: 'MULTI_SOURCE_COMPARISON_DRAFT', count: sources.length,
    reason: 'compare hypothetical evidence without asserting causation' };
}

export function planMethodologyDryRun({ asOfUtc, sources = [] }) {
  const local = localParts(asOfUtc);
  const weekDay = !['Sat', 'Sun'].includes(local.weekday);
  const afterCutoff = local.hour >= 17;
  const state = !weekDay ? 'WEEKEND_HOLD' : !afterCutoff ? 'BEFORE_CUTOFF_HOLD' : 'DRAFT_ELIGIBLE';
  const evidence = classifySyntheticEvidence(sources);
  const lastWeekdayOfMonth = nextWeekday(local.day).slice(0, 7) !== local.day.slice(0, 7);
  const canPrepare = state === 'DRAFT_ELIGIBLE' && evidence.kind !== 'SOURCE_HOLD';
  return {
    version: METHOD_DRY_RUN_VERSION, status: AUTOMATION_RIGHTS,
    as_of_utc: new Date(asOfUtc).toISOString(), business_timezone: ZONE,
    local_day: local.day, dry_run_state: state,
    hypothetical_review: evidence,
    edition_key: `SYNTHETIC:EOD:${local.day}`,
    proposed_candidates: {
      daily: canPrepare, weekly: canPrepare && local.weekday === 'Fri',
      monthly: canPrepare && lastWeekdayOfMonth,
    },
    constraints: {
      synthetic_fixture_only: true, actual_holidays_not_verified: true,
      issuer_vintages_not_ingested: true, editorial_review_required: true,
      market_values_not_ingested: true, rights_not_granted: true,
      real_data_reconstruction_not_authorized: true, public_release_authorized: false,
      existing_news_source_minimum_unchanged: true, existing_weekly_score_gate_unchanged: true,
      existing_monthly_four_weeklies_gate_unchanged: true,
    },
  };
}

export const SYNTHETIC_PROBE_SOURCES = Object.freeze({
  quiet: [],
  single: [{ id: 'SYNTHETIC:SOURCE:ONE', kind: 'invented', verified: true, permitted: true }],
  multi: [
    { id: 'SYNTHETIC:SOURCE:ONE', kind: 'invented', verified: true, permitted: true },
    { id: 'SYNTHETIC:SOURCE:TWO', kind: 'invented', verified: true, permitted: true },
  ],
  denied: [{ id: 'SYNTHETIC:SOURCE:DENIED', kind: 'invented', verified: false, permitted: false }],
});
