import {
  TREASURY_BUYBACK_OPERATION_FIELDS,
  TREASURY_BUYBACK_OPERATIONS_ENDPOINT,
} from './treasury-buyback-operation.js';
import { discoverTreasuryBuybackOutcomeUrls } from './treasury-buyback-outcome-discovery.js';
import { verifyTreasuryBuybackEvidence } from './treasury-buyback-verifier.js';

export const TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_VERSION = 'treasury-buyback-outcome-orchestrator/v1';
const CANDIDATE_FIELDS = Object.freeze([
  'publisher', 'series', 'operationDate', 'operationIdentity', 'releaseStage', 'phase',
]);

export class TreasuryBuybackOutcomeOrchestratorHold extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TreasuryBuybackOutcomeOrchestratorHold';
    this.code = code;
  }
}

const hold = (code, message) => { throw new TreasuryBuybackOutcomeOrchestratorHold(code, message); };

function realDate(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeCandidate(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_CANDIDATE', 'A bounded plain-object Treasury buyback outcome candidate is required.');
  }
  const keys = Object.keys(value).sort();
  const expected = [...CANDIDATE_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_CANDIDATE', 'Treasury buyback outcome orchestration candidate schema changed or is incomplete.');
  }
  if (value.publisher !== 'TREASURY' || value.series !== 'BUYBACK' || value.releaseStage !== 'operation'
      || value.phase !== 'outcome' || !realDate(value.operationDate)) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_CANDIDATE', 'Treasury buyback outcome orchestration candidate identity is invalid.');
  }
  if (typeof value.operationIdentity !== 'string' || value.operationIdentity.length > 500
      || !value.operationIdentity.startsWith(`TREASURY:BUYBACK:${value.operationDate}:`)
      || /[^\x20-\x7e]/.test(value.operationIdentity)) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_CANDIDATE', 'Treasury buyback outcome operationIdentity is missing, unbounded or inconsistent with operationDate.');
  }
  return Object.freeze({ ...value });
}

function sharedMonotonicClock(now) {
  if (typeof now !== 'function') hold('HOLD_INVALID_CLOCK', 'Trusted current time is unavailable.');
  let previous = null;
  return () => {
    const current = now();
    if (!Number.isFinite(current) || (previous !== null && current < previous)) {
      hold('HOLD_INVALID_CLOCK', 'Trusted current time is unavailable or moved backwards.');
    }
    previous = current;
    return current;
  };
}

function operationRequestUrl(operationDate) {
  const url = new URL(TREASURY_BUYBACK_OPERATIONS_ENDPOINT);
  url.searchParams.set('fields', TREASURY_BUYBACK_OPERATION_FIELDS.join(','));
  url.searchParams.set('filter', `operation_date:eq:${operationDate}`);
  url.searchParams.set('page[size]', '50');
  return url.toString();
}

function assertDormant(result, label) {
  if (!result || result.publicationAttempted !== false || result.publicationAuthorized !== false
      || result.enforcementActive !== false || ('calendarLease' in result && result.calendarLease !== false)) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_BOUNDARY', `${label} crossed the dormant non-authorizing boundary.`);
  }
}

function holdResult(candidate, decision, reason, checkedAt, discovery = null, outcome = null) {
  return Object.freeze({
    verifierVersion: TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_VERSION,
    decision,
    reason,
    checkedAt,
    validUntil: null,
    operationDate: candidate?.operationDate ?? null,
    operationIdentity: candidate?.operationIdentity ?? null,
    operationStamp: null,
    preliminaryUrl: null,
    finalUrl: null,
    resultsUrl: null,
    discovery: discovery ? Object.freeze({
      decision: discovery.decision,
      checkedAt: discovery.checkedAt ?? null,
      validUntil: discovery.validUntil ?? null,
    }) : null,
    outcome: outcome ? Object.freeze({
      decision: outcome.decision,
      checkedAt: outcome.checkedAt ?? null,
      validUntil: outcome.validUntil ?? null,
    }) : null,
    evidenceVerified: false,
    resultsLinkObserved: false,
    calendarLease: false,
    publicationAttempted: false,
    publicationAuthorized: false,
    enforcementActive: false,
  });
}

function assertDiscoveredOutcome(candidate, discovery) {
  if (!discovery || discovery.discoveryVerified !== true || discovery.resultsLinkObserved !== true
      || discovery.operationDate !== candidate.operationDate
      || typeof discovery.operationStamp !== 'string' || !/^20\d{12}$/.test(discovery.operationStamp)
      || typeof discovery.preliminaryUrl !== 'string' || typeof discovery.finalUrl !== 'string'
      || typeof discovery.resultsUrl !== 'string') {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_DISCOVERY', 'Treasury buyback outcome discovery PASS result is incomplete or mismatched.');
  }
}

function assertOutcomeSources(candidate, discovery, outcome) {
  if (outcome.operationDate !== candidate.operationDate || outcome.operationIdentity !== candidate.operationIdentity) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_IDENTITY', 'Treasury buyback discovery and outcome evidence do not identify the same operation.');
  }
  if (!Array.isArray(outcome.sources) || outcome.sources.length !== 4) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_SOURCE_BINDING', 'Treasury buyback outcome verifier did not return the reviewed bounded source set.');
  }
  const expected = [
    Object.freeze({ role: 'fiscaldata-operation', url: operationRequestUrl(candidate.operationDate) }),
    Object.freeze({ role: 'treasurydirect-preliminary', url: discovery.preliminaryUrl }),
    Object.freeze({ role: 'treasurydirect-final', url: discovery.finalUrl }),
    Object.freeze({ role: 'treasurydirect-results', url: discovery.resultsUrl }),
  ];
  for (let index = 0; index < expected.length; index += 1) {
    if (outcome.sources[index]?.role !== expected[index].role || outcome.sources[index]?.url !== expected[index].url) {
      hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_SOURCE_BINDING', 'Treasury buyback outcome verifier did not consume exactly the first-party discovered source set.');
    }
  }
}

/**
 * Compose first-party TreasuryDirect BBPA/BBA/BBR discovery with the dormant
 * completed-operation verifier. The caller cannot supply artifact URLs.
 * The verifier is network-confined to the exact FiscalData operation query
 * and the three TreasuryDirect XML URLs observed in the same discovery row.
 * PASS means fresh evidence consistency only, never a calendar lease or
 * publication authorization.
 */
export async function verifyDiscoveredTreasuryBuybackOutcome(value, {
  now = Date.now,
  fetchImpl = globalThis.fetch,
  discover = discoverTreasuryBuybackOutcomeUrls,
  verifyOutcome = verifyTreasuryBuybackEvidence,
} = {}) {
  let candidate = null;
  let discovery = null;
  let outcome = null;
  let checkedAt = null;
  let blockedUrl = null;
  try {
    candidate = normalizeCandidate(value);
    const clock = sharedMonotonicClock(now);
    checkedAt = new Date(clock()).toISOString();

    if (typeof discover !== 'function' || typeof verifyOutcome !== 'function' || typeof fetchImpl !== 'function') {
      hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_INTERNAL', 'Treasury buyback outcome evidence adapters are unavailable.');
    }

    discovery = await discover({
      publisher: candidate.publisher,
      series: candidate.series,
      operationDate: candidate.operationDate,
    }, { now: clock, fetchImpl });

    if (!discovery || typeof discovery.decision !== 'string') {
      hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_DISCOVERY', 'Treasury buyback outcome discovery returned an invalid result.');
    }
    assertDormant(discovery, 'Treasury buyback outcome discovery');
    if (discovery.decision !== 'PASS') {
      return holdResult(candidate, discovery.decision, discovery.reason ?? 'Treasury buyback outcome discovery held.', checkedAt, discovery, null);
    }
    assertDiscoveredOutcome(candidate, discovery);

    const allowedUrls = new Set([
      operationRequestUrl(candidate.operationDate),
      discovery.preliminaryUrl,
      discovery.finalUrl,
      discovery.resultsUrl,
    ]);
    const confinedFetch = async (requestUrl, init) => {
      const url = String(requestUrl);
      if (!allowedUrls.has(url)) {
        blockedUrl = url;
        throw new Error('Treasury buyback outcome verifier attempted an undiscovered network source.');
      }
      return fetchImpl(requestUrl, init);
    };

    outcome = await verifyOutcome({ ...candidate }, { now: clock, fetchImpl: confinedFetch });
    if (blockedUrl !== null) {
      hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_SOURCE_BINDING', 'Treasury buyback outcome verifier attempted a source outside the discovered first-party set.');
    }
    if (!outcome || typeof outcome.decision !== 'string') {
      hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_OUTCOME', 'Treasury buyback outcome verifier returned an invalid result.');
    }
    assertDormant(outcome, 'Treasury buyback outcome verifier');
    if (outcome.decision !== 'PASS') {
      return holdResult(candidate, outcome.decision, outcome.reason ?? 'Treasury buyback outcome verification held.', checkedAt, discovery, outcome);
    }
    assertOutcomeSources(candidate, discovery, outcome);

    const closeAt = Date.parse(outcome.operationCloseAt);
    const discoveryUntil = Date.parse(discovery.validUntil);
    const outcomeUntil = Date.parse(outcome.validUntil);
    if (!Number.isFinite(closeAt) || !Number.isFinite(discoveryUntil) || !Number.isFinite(outcomeUntil)) {
      hold('HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_FRESHNESS', 'Treasury buyback outcome timing or validity window is malformed.');
    }
    const checked = clock();
    checkedAt = new Date(checked).toISOString();
    if (checked < closeAt) {
      hold('HOLD_TREASURY_BUYBACK_OUTCOME_NOT_RELEASED', 'Treasury buyback outcome evidence cannot pass before the official operation close.');
    }
    const validUntilMs = Math.min(discoveryUntil, outcomeUntil);
    if (checked >= validUntilMs) {
      hold('HOLD_EVIDENCE_STALE', 'Treasury buyback composed outcome evidence has no remaining overlapping validity window.');
    }

    return Object.freeze({
      verifierVersion: TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_VERSION,
      decision: 'PASS',
      reason: 'Fresh TreasuryDirect outcome discovery and completed-operation evidence agree on one buyback operation and exact source set.',
      checkedAt,
      validUntil: new Date(validUntilMs).toISOString(),
      eventIdentity: outcome.eventIdentity ?? null,
      operationDate: candidate.operationDate,
      operationIdentity: candidate.operationIdentity,
      operationStamp: discovery.operationStamp,
      preliminaryUrl: discovery.preliminaryUrl,
      finalUrl: discovery.finalUrl,
      resultsUrl: discovery.resultsUrl,
      operationStartAt: outcome.operationStartAt,
      operationCloseAt: outcome.operationCloseAt,
      resultsPublishedAt: outcome.resultsPublishedAt ?? null,
      discovery: Object.freeze({
        decision: discovery.decision,
        checkedAt: discovery.checkedAt,
        validUntil: discovery.validUntil,
        source: discovery.source,
      }),
      outcome: Object.freeze({
        decision: outcome.decision,
        checkedAt: outcome.checkedAt,
        validUntil: outcome.validUntil,
        sources: outcome.sources,
      }),
      evidenceVerified: true,
      resultsLinkObserved: true,
      calendarLease: false,
      publicationAttempted: false,
      publicationAuthorized: false,
      enforcementActive: false,
    });
  } catch (error) {
    const decision = typeof error?.code === 'string' && error.code.startsWith('HOLD_')
      ? error.code
      : 'HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_INTERNAL';
    return holdResult(candidate, decision, error instanceof Error ? error.message : 'Treasury buyback outcome orchestration failed closed.', checkedAt, discovery, outcome);
  }
}
