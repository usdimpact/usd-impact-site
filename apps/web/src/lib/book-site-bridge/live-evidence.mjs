const ISO_DATE = /^20\d{2}-\d{2}-\d{2}$/;

const REQUIRED_FACT_IDS = Object.freeze([
  'FED_BROAD_USD',
  'FED_10Y_REAL_YIELD',
  'SOFR_IORB_SPREAD',
]);

const ALLOWED_FACT_SOURCE_ORIGINS = new Set([
  'https://www.federalreserve.gov',
  'https://www.newyorkfed.org',
]);

function dateFromIso(value) {
  if (!ISO_DATE.test(String(value ?? ''))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addUtcDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function latestCompletedFriday(now) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = day.getUTCDay();
  let daysSinceFriday = (weekday + 2) % 7;
  if (weekday === 5) daysSinceFriday = 7;
  return addUtcDays(day, -daysSinceFriday);
}

function collectFacts(snapshot) {
  return Object.values(snapshot?.dials ?? {}).flatMap((dial) => Array.isArray(dial?.facts) ? dial.facts : []);
}

function validateSourceUrl(value, allowedOrigins) {
  try {
    return allowedOrigins.has(new URL(value).origin);
  } catch {
    return false;
  }
}

export function validateBookLiveEvidenceSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return { valid: false, reason: 'Snapshot payload is missing.' };
  if (snapshot.status !== 'published') return { valid: false, reason: 'Snapshot publication gate is not open.' };
  if (snapshot.version !== 2) return { valid: false, reason: 'Snapshot methodology version is not Three Dials v2.' };
  if (!dateFromIso(snapshot.week_ending)) return { valid: false, reason: 'Snapshot week is invalid.' };
  const facts = collectFacts(snapshot);
  const factById = new Map(facts.map((fact) => [fact?.id, fact]));
  for (const id of REQUIRED_FACT_IDS) {
    const fact = factById.get(id);
    if (!fact) return { valid: false, reason: `Required completed-week fact is missing: ${id}.` };
    if (!validateSourceUrl(fact.source_url, ALLOWED_FACT_SOURCE_ORIGINS)) {
      return { valid: false, reason: `Fact source is outside the approved origin boundary: ${id}.` };
    }
    if (!dateFromIso(fact.latest?.date) || !dateFromIso(fact.previous?.date)) {
      return { valid: false, reason: `Fact dates are invalid: ${id}.` };
    }
    if (!Number.isFinite(Number(fact.latest?.value)) || !Number.isFinite(Number(fact.previous?.value)) || !Number.isFinite(Number(fact.change?.value))) {
      return { valid: false, reason: `Fact values are invalid: ${id}.` };
    }
  }

  return { valid: true, reason: null, facts, factById };
}

export function assessBookLiveEvidence(snapshot, now = new Date()) {
  const currentTime = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(currentTime.getTime())) {
    return {
      state: 'invalid',
      usable: false,
      message: 'Live-evidence comparison is unavailable because the build timestamp is invalid.',
      snapshotWeek: snapshot?.week_ending ?? null,
      targetWeek: null,
    };
  }

  if (snapshot?.status === 'pending' && snapshot?.source_rights_state === 'unverified') {
    return { state: 'rights-hold', usable: false, message: snapshot.message, snapshotWeek: snapshot.week_ending ?? null, targetWeek: null };
  }

  const validation = validateBookLiveEvidenceSnapshot(snapshot);
  if (!validation.valid) {
    return {
      state: 'invalid',
      usable: false,
      message: `Live-evidence comparison is disabled: ${validation.reason}`,
      snapshotWeek: snapshot?.week_ending ?? null,
      targetWeek: null,
    };
  }

  const targetFriday = latestCompletedFriday(currentTime);
  const targetWeek = isoDate(targetFriday);
  const snapshotWeek = snapshot.week_ending;

  if (snapshotWeek === targetWeek) {
    return {
      state: 'current',
      usable: true,
      message: `Using the latest published completed-week snapshot for ${snapshotWeek}.`,
      snapshotWeek,
      targetWeek,
    };
  }

  const previousTargetWeek = isoDate(addUtcDays(targetFriday, -7));
  const publicationDeadline = addUtcDays(targetFriday, 5);
  if (snapshotWeek === previousTargetWeek && currentTime.getTime() < publicationDeadline.getTime()) {
    return {
      state: 'publication-pending',
      usable: true,
      message: `The ${targetWeek} publication is still inside the normal Monday/Tuesday publication window. Practice uses the latest published completed week, ${snapshotWeek}.`,
      snapshotWeek,
      targetWeek,
    };
  }

  return {
    state: 'stale',
    usable: false,
    message: `Live-evidence comparison is disabled because the latest published snapshot (${snapshotWeek}) is outside the approved publication cadence for ${targetWeek}.`,
    snapshotWeek,
    targetWeek,
  };
}

function mapDollarDirection(value) {
  if (value === 'firmer' || value === 'softer') return value;
  if (value === 'rangebound') return 'mixed';
  throw new Error(`Unsupported dollar direction: ${value}`);
}

function mapRealRateDirection(value) {
  if (value === 'rising' || value === 'falling') return value;
  if (value === 'flat') return 'mixed';
  throw new Error(`Unsupported real-rate direction: ${value}`);
}

function mapFundingDirection(value) {
  if (value === 'tightening' || value === 'easing') return value;
  if (value === 'contained') return 'mixed';
  throw new Error(`Unsupported funding direction: ${value}`);
}

export function getDxyEvidenceReference(snapshot) {
  const validation = validateBookLiveEvidenceSnapshot(snapshot);
  if (!validation.valid) throw new Error(validation.reason);
  throw new Error('DXY live comparison is intentionally unavailable under Three Dials v2.');
}

export function getWeeklyDialReference(snapshot) {
  const validation = validateBookLiveEvidenceSnapshot(snapshot);
  if (!validation.valid) throw new Error(validation.reason);
  return {
    dollar: mapDollarDirection(snapshot.dials.dollar.direction),
    realRates: mapRealRateDirection(snapshot.dials.real_rates.direction),
    liquidity: mapFundingDirection(snapshot.dials.funding_pressure.direction),
  };
}

export function getBookLiveEvidenceFacts(snapshot) {
  const validation = validateBookLiveEvidenceSnapshot(snapshot);
  if (!validation.valid) throw new Error(validation.reason);
  return validation.factById;
}
