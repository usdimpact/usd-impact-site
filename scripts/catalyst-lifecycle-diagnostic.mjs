/**
 * Offline diagnostic of a supplied, normalized observation snapshot.
 * No network, filesystem, environment, clock acquisition, dispatch or authority.
 * A consistent snapshot is NOT an independently verified publication receipt.
 */
const REPOSITORY = 'usdimpact/usd-impact-site';
const WORKFLOW = '.github/workflows/catalyst-brief.yml';
const HOST = 'www.usd-impact.com';
const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const KEY = /^[a-z0-9][a-z0-9-]{0,199}$/;
const PHASES = ['preview', 'outcome'];
const RUN_STATES = ['queued', 'requested', 'pending', 'waiting', 'in_progress', 'completed'];
const CONCLUSIONS = [null, 'success', 'failure', 'cancelled', 'skipped', 'timed_out', 'action_required', 'neutral', 'stale'];
const EVENTS = ['schedule', 'workflow_dispatch', 'push', 'pull_request', 'issue_comment'];
const SAFETY = Object.freeze({
  diagnosticOnly: true,
  observationAuthenticityVerified: false,
  publicationVerified: false,
  publicationAuthorized: false,
  workflowDispatched: false,
  incidentClosureAuthorized: false,
  enforcementActive: false,
});

class Invalid extends Error {}
function requireValue(condition) { if (!condition) throw new Invalid('INVALID_SNAPSHOT'); }
function object(value, keys) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value));
  requireValue([Object.prototype, null].includes(Object.getPrototypeOf(value)));
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  requireValue(actual.length === keys.length && actual.every((k) => keys.includes(k)));
  requireValue(actual.every((k) => Object.hasOwn(descriptors[k], 'value') && descriptors[k].enumerable));
}
function string(value, pattern) { requireValue(typeof value === 'string' && pattern.test(value)); }
function integer(value, min, max) { requireValue(Number.isSafeInteger(value) && value >= min && value <= max); }
function boolean(value) { requireValue(typeof value === 'boolean'); }
function timestamp(value) {
  string(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  const number = Date.parse(value);
  requireValue(Number.isFinite(number) && new Date(number).toISOString() === value);
  return number;
}
function dateOnly(value) {
  string(value, /^\d{4}-\d{2}-\d{2}$/);
  timestamp(`${value}T00:00:00.000Z`);
}
function list(value) { requireValue(Array.isArray(value) && value.length <= 200); }
function phase(value) { requireValue(PHASES.includes(value)); }
function url(value) {
  string(value, /^https:\/\/www\.usd-impact\.com\/news\/catalysts\/[a-z0-9][a-z0-9-]{0,239}$/);
}
function contentPath(value) {
  string(value, /^apps\/web\/src\/content\/catalyst-briefs\/[a-z0-9][a-z0-9-]{0,239}\.md$/);
}
function identity(value) { string(value.eventKey, KEY); dateOnly(value.eventDate); phase(value.phase); }
function sameEvent(value, expected) {
  return value.eventKey === expected.eventKey && value.eventDate === expected.eventDate && value.phase === expected.phase;
}
function fresh(observedAt, now, age) {
  const time = timestamp(observedAt);
  return time <= now && now - time <= age;
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function output(fields) {
  return freeze({ schemaVersion: 1, ...fields, safety: { ...SAFETY } });
}
function unknown(reason) {
  return output({ evidenceState: reason, scheduler: 'UNKNOWN', schedulerTiming: 'UNKNOWN', execution: 'UNKNOWN', publication: 'UNKNOWN', disposition: 'UNKNOWN', matchingRuns: [], unresolvedRunIds: [], ignoredRunIds: [] });
}

function validateCollection(collection, withWindow = false) {
  object(collection, ['observedAt', 'complete', 'nextPage', 'totalCount', 'records', ...(withWindow ? ['windowStart', 'windowEnd'] : [])]);
  timestamp(collection.observedAt); boolean(collection.complete); list(collection.records);
  requireValue(collection.nextPage === null || (Number.isSafeInteger(collection.nextPage) && collection.nextPage >= 1));
  integer(collection.totalCount, 0, 1000000);
  requireValue(collection.totalCount >= collection.records.length);
  if (withWindow) {
    requireValue(timestamp(collection.windowStart) <= timestamp(collection.windowEnd));
    requireValue(timestamp(collection.windowEnd) <= timestamp(collection.observedAt));
  }
}
function complete(collection) {
  return collection.complete === true && collection.nextPage === null && collection.totalCount === collection.records.length;
}
function validateRun(run, collection) {
  object(run, ['id', 'attempt', 'workflowPath', 'branch', 'sourceSha', 'event', 'createdAt', 'status', 'conclusion', 'association', 'decision']);
  integer(run.id, 1, Number.MAX_SAFE_INTEGER); integer(run.attempt, 1, 10000);
  string(run.workflowPath, /^\.github\/workflows\/[a-z0-9-]+\.ya?ml$/);
  string(run.branch, /^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,199}$/); string(run.sourceSha, SHA);
  requireValue(EVENTS.includes(run.event) && RUN_STATES.includes(run.status) && CONCLUSIONS.includes(run.conclusion));
  requireValue((run.status === 'completed') === (run.conclusion !== null));
  const created = timestamp(run.createdAt);
  requireValue(created >= timestamp(collection.windowStart) && created <= timestamp(collection.windowEnd));
  if (run.association !== null) {
    object(run.association, ['eventKey', 'eventDate', 'phase', 'scheduledAt', 'asOf', 'evidenceRef']);
    identity(run.association); timestamp(run.association.scheduledAt); dateOnly(run.association.asOf);
    requireValue(run.association.evidenceRef === `run:${run.id}:attempt:${run.attempt}`);
  }
  if (run.decision !== null) {
    object(run.decision, ['kind', 'runId', 'attempt', 'sourceSha', 'recordedAt', 'reasonCode']);
    requireValue(['source_hold', 'no_candidate', 'generated'].includes(run.decision.kind));
    requireValue(run.decision.runId === run.id && run.decision.attempt === run.attempt && run.decision.sourceSha === run.sourceSha);
    requireValue(run.status === 'completed');
    const recorded = timestamp(run.decision.recordedAt);
    requireValue(recorded >= created && recorded <= timestamp(collection.observedAt));
    string(run.decision.reasonCode, /^[A-Z][A-Z0-9_]{0,79}$/);
  }
}
function validatePublication(record) {
  object(record, ['prNumber', 'eventKey', 'eventDate', 'phase', 'state', 'headSha', 'mergeSha', 'contentPath', 'articleDigest', 'digestScheme', 'canonicalUrl', 'qualityHeadSha', 'qualityConclusion']);
  integer(record.prNumber, 1, Number.MAX_SAFE_INTEGER); identity(record);
  requireValue(['open', 'closed', 'merged'].includes(record.state)); string(record.headSha, SHA);
  if (record.mergeSha !== null) string(record.mergeSha, SHA);
  requireValue((record.state === 'merged') === (record.mergeSha !== null));
  contentPath(record.contentPath); string(record.articleDigest, DIGEST); url(record.canonicalUrl);
  const slug = record.canonicalUrl.split('/').at(-1);
  requireValue(record.contentPath === `apps/web/src/content/catalyst-briefs/${slug}.md`
    && slug.startsWith(`${record.eventDate}-`) && slug.endsWith(`-${record.phase}`));
  requireValue(record.digestScheme === 'catalyst-projection-v1');
  if (record.qualityHeadSha !== null) string(record.qualityHeadSha, SHA);
  requireValue([null, 'success', 'failure', 'pending'].includes(record.qualityConclusion));
  requireValue((record.qualityHeadSha === null) === (record.qualityConclusion === null));
}
function validate(snapshot) {
  object(snapshot, ['schemaVersion', 'now', 'expected', 'observations']);
  requireValue(snapshot.schemaVersion === 1); const now = timestamp(snapshot.now);
  const e = snapshot.expected;
  object(e, ['repository', 'workflowPath', 'branch', 'sourceSha', 'eventKey', 'eventDate', 'phase', 'scheduledAt', 'maxObservationAgeMs', 'executionGraceMs', 'publicationDueAt', 'hold']);
  requireValue(e.repository === REPOSITORY && e.workflowPath === WORKFLOW && e.branch === 'main');
  string(e.sourceSha, SHA); identity(e); timestamp(e.scheduledAt);
  integer(e.maxObservationAgeMs, 1, 86400000);
  if (e.executionGraceMs !== null) integer(e.executionGraceMs, 0, 86400000);
  if (e.publicationDueAt !== null) requireValue(timestamp(e.publicationDueAt) >= timestamp(e.scheduledAt));
  if (e.hold !== null) {
    object(e.hold, ['eventKey', 'eventDate', 'phase', 'reference', 'validUntil']); identity(e.hold);
    requireValue(sameEvent(e.hold, e)); string(e.hold.reference, /^issue:[1-9][0-9]*:comment:[1-9][0-9]*$/); timestamp(e.hold.validUntil);
  }
  const o = snapshot.observations;
  object(o, ['repositoryHeadSha', 'runs', 'publications', 'deployment', 'livePage']); string(o.repositoryHeadSha, SHA);
  validateCollection(o.runs, true); validateCollection(o.publications);
  o.runs.records.forEach((run) => validateRun(run, o.runs));
  requireValue(new Set(o.runs.records.map((run) => run.id)).size === o.runs.records.length);
  o.publications.records.forEach(validatePublication);
  requireValue(new Set(o.publications.records.map((record) => record.prNumber)).size === o.publications.records.length);
  if (o.deployment !== null) {
    const d = o.deployment;
    object(d, ['observedAt', 'deploymentId', 'gitSha', 'target', 'state', 'canonicalHost']); timestamp(d.observedAt);
    string(d.deploymentId, /^dpl_[a-zA-Z0-9]{1,100}$/); string(d.gitSha, SHA);
    requireValue(['production', 'preview'].includes(d.target) && ['READY', 'BUILDING', 'ERROR'].includes(d.state));
    string(d.canonicalHost, /^[a-z0-9.-]{1,253}$/);
  }
  if (o.livePage !== null) {
    const p = o.livePage;
    object(p, ['observedAt', 'statusCode', 'finalUrl', 'eventKey', 'eventDate', 'phase', 'articleDigest', 'digestScheme', 'deploymentId', 'accessMode', 'complete']);
    timestamp(p.observedAt); integer(p.statusCode, 100, 599); identity(p);
    // A wrong but syntactically ordinary URL is a mismatch, not approval.
    string(p.finalUrl, /^https:\/\/[a-z0-9.-]+\/[a-zA-Z0-9/_-]{0,300}$/);
    string(p.articleDigest, DIGEST); requireValue(p.digestScheme === 'catalyst-projection-v1');
    string(p.deploymentId, /^dpl_[a-zA-Z0-9]{1,100}$/);
    requireValue(['anonymous', 'authenticated', 'unknown'].includes(p.accessMode)); boolean(p.complete);
  }
  return { now, e, o };
}

/** Accept already-decoded plain records. This function is not a raw JSON parser. */
export function diagnoseCatalystLifecycle(snapshot) {
  let checked;
  try { checked = validate(snapshot); } catch { return unknown('INVALID_SNAPSHOT'); }
  const { now, e, o } = checked;
  if (o.repositoryHeadSha !== e.sourceSha) return unknown('SCOPE_DRIFT');
  const slot = timestamp(e.scheduledAt);
  const result = {
    evidenceState: 'SUPPLIED_RECORDS_ONLY', scheduler: 'UNKNOWN', schedulerTiming: 'UNKNOWN',
    execution: 'UNKNOWN', publication: 'UNKNOWN', disposition: 'REQUIRED',
    publicationTiming: e.publicationDueAt === null ? 'POLICY_UNSPECIFIED' : (now < timestamp(e.publicationDueAt) ? 'BEFORE_DEADLINE' : 'DEADLINE_REACHED'),
    matchingRuns: [], unresolvedRunIds: [], ignoredRunIds: [],
  };
  if (e.hold !== null) result.disposition = now < timestamp(e.hold.validUntil) ? 'INTENTIONALLY_HELD_REPORTED' : 'HOLD_EXPIRED';
  const runsUsable = fresh(o.runs.observedAt, now, e.maxObservationAgeMs) && complete(o.runs)
    && fresh(o.runs.windowEnd, now, e.maxObservationAgeMs)
    && timestamp(o.runs.windowStart) <= slot && timestamp(o.runs.windowEnd) >= Math.min(slot, now);
  const relevant = o.runs.records.filter((r) => r.workflowPath === e.workflowPath && r.branch === e.branch && ['schedule', 'workflow_dispatch'].includes(r.event));
  const matched = relevant.filter((r) => r.association !== null && sameEvent(r.association, e) && r.association.scheduledAt === e.scheduledAt);
  result.unresolvedRunIds = relevant.filter((r) => r.association === null).map((r) => r.id).sort((a,b) => a-b);
  result.ignoredRunIds = o.runs.records.filter((r) => !matched.includes(r) && !result.unresolvedRunIds.includes(r.id)).map((r) => r.id).sort((a,b) => a-b);
  result.matchingRuns = matched.map((r) => ({ id: r.id, attempt: r.attempt, event: r.event, status: r.status, conclusion: r.conclusion })).sort((a,b) => a.id-b.id);
  if (!runsUsable) {
    result.scheduler = result.execution = 'EXECUTION_EVIDENCE_INCOMPLETE';
  } else if (result.unresolvedRunIds.length) {
    result.scheduler = result.execution = 'RUN_ASSOCIATION_UNKNOWN';
  } else if (matched.some((r) => r.sourceSha !== e.sourceSha)) {
    result.scheduler = result.execution = 'RUN_SOURCE_DRIFT';
  } else if (matched.some((r) => r.event === 'schedule' && timestamp(r.createdAt) < slot)) {
    result.scheduler = result.execution = 'SLOT_CONFLICT';
  } else if (now < slot) {
    if (matched.length) result.scheduler = result.execution = 'SLOT_CONFLICT';
    else { result.scheduler = 'NOT_DUE'; result.execution = 'NOT_STARTED'; }
  } else {
    const scheduled = matched.filter((r) => r.event === 'schedule');
    result.scheduler = scheduled.length > 1 ? 'DUPLICATE_SCHEDULED_RUNS' : scheduled.length === 1 ? 'SCHEDULED_RUN_REPORTED' : 'EXPECTED_RUN_NOT_OBSERVED';
    result.schedulerTiming = e.executionGraceMs === null ? 'POLICY_UNSPECIFIED' : (now < slot + e.executionGraceMs ? 'WITHIN_GRACE' : 'GRACE_ENDED');
    if (matched.length > 1) result.execution = 'MULTIPLE_MATCHING_RUNS';
    else if (!matched.length) result.execution = 'NOT_STARTED';
    else {
      const r = matched[0];
      if (r.status !== 'completed') result.execution = r.status === 'in_progress' ? 'IN_PROGRESS' : 'QUEUED_OR_WAITING';
      else if (r.decision?.kind === 'source_hold') result.execution = 'SOURCE_HOLD_REPORTED';
      else if (r.decision?.kind === 'no_candidate') result.execution = 'NO_CANDIDATE_REPORTED';
      else if (r.conclusion !== 'success') result.execution = 'COMPLETED_WITHOUT_SUCCESS';
      else if (r.decision?.kind === 'generated') result.execution = 'GENERATION_REPORTED';
      else result.execution = 'SUCCESS_WITHOUT_PUBLICATION_EVIDENCE';
    }
  }
  const pubsUsable = fresh(o.publications.observedAt, now, e.maxObservationAgeMs) && complete(o.publications);
  const pubs = o.publications.records.filter((p) => sameEvent(p, e) && p.state !== 'closed');
  if (!pubsUsable) result.publication = 'PUBLICATION_EVIDENCE_INCOMPLETE';
  else if (pubs.length > 1) result.publication = 'CONFLICTING_PUBLICATION_RECORDS';
  else if (!pubs.length) result.publication = o.livePage !== null && sameEvent(o.livePage, e)
    ? 'LIVE_OBSERVATION_WITHOUT_CANDIDATE_BINDING' : 'NO_CANDIDATE_IN_OBSERVATION';
  else {
    const p = pubs[0];
    const quality = p.qualityHeadSha === p.headSha && p.qualityConclusion === 'success';
    if (!quality) result.publication = 'EXACT_HEAD_QUALITY_NOT_CONFIRMED';
    else if (p.state === 'open') result.publication = 'CANDIDATE_AWAITING_REVIEW';
    else {
      const d = o.deployment;
      if (!d) result.publication = 'MERGED_DEPLOYMENT_EVIDENCE_MISSING';
      else if (!fresh(d.observedAt, now, e.maxObservationAgeMs)) result.publication = 'DEPLOYMENT_EVIDENCE_STALE';
      else if (d.gitSha !== p.mergeSha || d.target !== 'production' || d.canonicalHost !== HOST || d.state !== 'READY') result.publication = 'MERGED_AWAITING_MATCHING_PRODUCTION';
      else {
        const live = o.livePage;
        if (!live) result.publication = 'DEPLOYED_LIVE_EVIDENCE_MISSING';
        else if (!fresh(live.observedAt, now, e.maxObservationAgeMs) || live.complete !== true) result.publication = 'LIVE_EVIDENCE_INCOMPLETE';
        else if (live.statusCode !== 200 || live.accessMode !== 'anonymous' || !sameEvent(live, e)
          || live.finalUrl !== p.canonicalUrl || live.deploymentId !== d.deploymentId || live.articleDigest !== p.articleDigest
          || live.digestScheme !== p.digestScheme) result.publication = 'LIVE_BINDING_MISMATCH';
        else result.publication = 'LIVE_MATCH_REPORTED_NOT_VERIFIED';
      }
    }
  }
  // An editorial exception does not silently erase scheduler or publication facts.
  if (result.disposition === 'INTENTIONALLY_HELD_REPORTED' && result.publication === 'LIVE_MATCH_REPORTED_NOT_VERIFIED') result.evidenceState = 'HOLD_PUBLICATION_CONFLICT';
  return output(result);
}
