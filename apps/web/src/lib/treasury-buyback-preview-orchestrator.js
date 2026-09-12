import { discoverTreasuryBuybackPreliminaryUrl } from './treasury-buyback-discovery.js';
import { verifyTreasuryBuybackPreviewEvidence } from './treasury-buyback-preview-verifier.js';

export const TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_VERSION = 'treasury-buyback-preview-orchestrator/v1';
const CANDIDATE_FIELDS = Object.freeze(['publisher', 'series', 'operationDate', 'phase']);

export class TreasuryBuybackPreviewOrchestratorHold extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TreasuryBuybackPreviewOrchestratorHold';
    this.code = code;
  }
}

const hold = (code, message) => { throw new TreasuryBuybackPreviewOrchestratorHold(code, message); };

function realDate(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeCandidate(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_CANDIDATE', 'A bounded plain-object Treasury buyback preview candidate is required.');
  }
  const keys = Object.keys(value).sort();
  const expected = [...CANDIDATE_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_CANDIDATE', 'Treasury buyback preview orchestration candidate schema changed or is incomplete.');
  }
  if (value.publisher !== 'TREASURY' || value.series !== 'BUYBACK' || value.phase !== 'preview' || !realDate(value.operationDate)) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_CANDIDATE', 'Treasury buyback preview orchestration candidate identity is invalid.');
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

function assertDormant(result, label) {
  if (!result || result.calendarLease !== false || result.publicationAttempted !== false
      || result.publicationAuthorized !== false || result.enforcementActive !== false) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_BOUNDARY', `${label} crossed the dormant non-authorizing boundary.`);
  }
}

function holdResult(candidate, decision, reason, checkedAt, discovery = null, preview = null) {
  return Object.freeze({
    verifierVersion: TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_VERSION,
    decision,
    reason,
    checkedAt,
    validUntil: null,
    operationDate: candidate?.operationDate ?? null,
    operationStamp: null,
    preliminaryUrl: null,
    discovery: discovery ? Object.freeze({
      decision: discovery.decision,
      checkedAt: discovery.checkedAt ?? null,
      validUntil: discovery.validUntil ?? null,
    }) : null,
    preview: preview ? Object.freeze({
      decision: preview.decision,
      checkedAt: preview.checkedAt ?? null,
      validUntil: preview.validUntil ?? null,
      announcementStage: preview.announcementStage ?? null,
    }) : null,
    evidenceVerified: false,
    calendarLease: false,
    publicationAttempted: false,
    publicationAuthorized: false,
    enforcementActive: false,
  });
}

/**
 * Compose first-party Treasury buyback discovery with preview verification.
 *
 * This is a dormant evidence-orchestration layer only. The caller cannot
 * supply or override a BBPA URL: discovery must obtain it from TreasuryDirect,
 * and preview verification must consume that exact URL. PASS means the two
 * fresh evidence layers agree and have a still-overlapping validity window.
 * It is never a canonical publication-calendar lease or authorization.
 */
export async function verifyDiscoveredTreasuryBuybackPreview(value, {
  now = Date.now,
  fetchImpl = globalThis.fetch,
  discover = discoverTreasuryBuybackPreliminaryUrl,
  verifyPreview = verifyTreasuryBuybackPreviewEvidence,
} = {}) {
  let candidate = null;
  let discovery = null;
  let preview = null;
  let checkedAt = null;
  try {
    candidate = normalizeCandidate(value);
    const clock = sharedMonotonicClock(now);
    checkedAt = new Date(clock()).toISOString();

    if (typeof discover !== 'function' || typeof verifyPreview !== 'function') {
      hold('HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_INTERNAL', 'Treasury buyback evidence adapters are unavailable.');
    }

    discovery = await discover({
      publisher: candidate.publisher,
      series: candidate.series,
      operationDate: candidate.operationDate,
    }, { now: clock, fetchImpl });

    if (!discovery || typeof discovery.decision !== 'string') {
      hold('HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_DISCOVERY', 'Treasury buyback discovery returned an invalid result.');
    }
    assertDormant(discovery, 'Treasury buyback discovery');
    if (discovery.decision !== 'PASS') {
      return holdResult(candidate, discovery.decision, discovery.reason ?? 'Treasury buyback discovery held.', checkedAt, discovery, null);
    }
    if (discovery.discoveryVerified !== true || discovery.operationDate !== candidate.operationDate
        || typeof discovery.preliminaryUrl !== 'string' || typeof discovery.operationStamp !== 'string') {
      hold('HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_DISCOVERY', 'Treasury buyback discovery PASS result is incomplete or mismatched.');
    }

    preview = await verifyPreview({
      publisher: candidate.publisher,
      series: candidate.series,
      operationDate: candidate.operationDate,
      phase: 'preview',
      preliminaryUrl: discovery.preliminaryUrl,
    }, { now: clock, fetchImpl });

    if (!preview || typeof preview.decision !== 'string') {
      hold('HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_PREVIEW', 'Treasury buyback preview verifier returned an invalid result.');
    }
    assertDormant(preview, 'Treasury buyback preview verifier');
    if (preview.decision !== 'PASS') {
      return holdResult(candidate, preview.decision, preview.reason ?? 'Treasury buyback preview verification held.', checkedAt, discovery, preview);
    }
    if (preview.evidenceVerified !== true || preview.operationDate !== candidate.operationDate
        || preview.operationStamp !== discovery.operationStamp) {
      hold('HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_IDENTITY', 'Treasury buyback discovery and preview evidence do not identify the same operation.');
    }
    if (!Array.isArray(preview.sources) || preview.sources.length < 1 || preview.sources[0]?.url !== discovery.preliminaryUrl) {
      hold('HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_IDENTITY', 'Treasury buyback preview evidence did not consume the discovered preliminary URL as its primary source.');
    }

    const discoveryUntil = Date.parse(discovery.validUntil);
    const previewUntil = Date.parse(preview.validUntil);
    if (!Number.isFinite(discoveryUntil) || !Number.isFinite(previewUntil)) {
      hold('HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_FRESHNESS', 'Treasury buyback evidence validity window is malformed.');
    }
    const checked = clock();
    checkedAt = new Date(checked).toISOString();
    const validUntilMs = Math.min(discoveryUntil, previewUntil);
    if (checked >= validUntilMs) {
      hold('HOLD_EVIDENCE_STALE', 'Treasury buyback composed evidence has no remaining overlapping validity window.');
    }

    return Object.freeze({
      verifierVersion: TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_VERSION,
      decision: 'PASS',
      reason: 'Fresh TreasuryDirect discovery and preview evidence agree on one buyback operation and preliminary source.',
      checkedAt,
      validUntil: new Date(validUntilMs).toISOString(),
      operationDate: candidate.operationDate,
      operationStamp: discovery.operationStamp,
      preliminaryUrl: discovery.preliminaryUrl,
      announcementStage: preview.announcementStage,
      operationStartAt: preview.operationStartAt,
      operationCloseAt: preview.operationCloseAt,
      discovery: Object.freeze({
        decision: discovery.decision,
        checkedAt: discovery.checkedAt,
        validUntil: discovery.validUntil,
        source: discovery.source,
      }),
      preview: Object.freeze({
        decision: preview.decision,
        checkedAt: preview.checkedAt,
        validUntil: preview.validUntil,
        announcementStage: preview.announcementStage,
        sources: preview.sources,
      }),
      evidenceVerified: true,
      calendarLease: false,
      publicationAttempted: false,
      publicationAuthorized: false,
      enforcementActive: false,
    });
  } catch (error) {
    const decision = typeof error?.code === 'string' && error.code.startsWith('HOLD_') ? error.code : 'HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_INTERNAL';
    return holdResult(candidate, decision, error instanceof Error ? error.message : 'Treasury buyback preview orchestration failed closed.', checkedAt, discovery, preview);
  }
}
