/**
 * Pure advisory classifier for normalized read-only evidence. No execution authority.
 * No I/O, clocks, credentials, provider calls, approval creation or action execution.
 * Receipt attestations remain independently reviewed; this is not a Health acceptance gate.
 */
export const POLICY = Object.freeze({
  version: 1,
  timeZone: 'Europe/Tirane',
  assessmentMinute: 14 * 60,
  targetMinute: 16 * 60,
  escalationMinute: 18 * 60,
  // Proposed freshness bound for this snapshot, NOT the Daily Health run-age rule.
  snapshotMaxAgeMs: 5 * 60 * 1000,
});
const SHA = /^[a-f0-9]{40}$/;
const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
const CONCLUSIONS = new Set(['success', 'failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'action_required', 'stale', 'startup_failure']);
const CHECK_NAMES = ['webQuality', 'audit', 'dependencyReview', 'codeql'];
const GATES = new Set(['pass', 'fail', 'pending', 'unknown']);
const NEXT = Object.freeze({
  UNKNOWN: 'refresh-and-reconcile-read-only-evidence',
  NOT_DUE: 'preserve-future-edition-no-placeholder',
  NOT_ELIGIBLE: 'no-weekend-daily-generation',
  HISTORICAL_HOLD: 'use-existing-historical-disposition-no-replay',
  DATE_BOUNDARY_HOLD: 'reconcile-utc-edition-and-local-date',
  ACTIVE: 'observe-existing-run-no-competing-candidate',
  CONFLICT_HOLD: 'reconcile-existing-candidates-no-new-candidate',
  EDITORIAL_HOLD: 'respect-closed-candidate-disposition',
  SOURCE_HOLD: 'review-source-evidence-in-existing-candidate',
  TECHNICAL_HOLD: 'inspect-current-head-checks-without-bypass',
  AWAITING_EDITORIAL_REVIEW: 'present-existing-copy-for-real-human-review',
  RELEASE_REVIEW: 'recheck-existing-candidate-before-authorized-release',
  PUBLICATION_VERIFICATION: 'verify-existing-merge-and-live-surfaces',
  NO_CANDIDATE: 'observe-delayed-schedule-without-dispatch',
  FALLBACK_ASSESSMENT: 'editorial-handoff-after-fresh-duplicate-check-not-permission-to-write',
  DELIVERED: 'preserve-publication-no-replay',
});
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const sha = x => typeof x === 'string' && SHA.test(x);
const realDay = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  if (!realDay(value.slice(0, 10))) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const canonical = new Date(ms).toISOString();
  return canonical === (value.length === 20 ? value.replace('Z', '.000Z') : value) ? ms : null;
}
function fresh(item, now) {
  const at = instant(item?.observedAt);
  return at !== null && at <= now && now - at <= POLICY.snapshotMaxAgeMs;
}
function receipt(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password &&
      ['github.com', 'vercel.com', 'www.usd-impact.com', 'usd-impact.com'].includes(u.hostname);
  } catch { return false; }
}
export function deadlineClock(now) {
  const ms = instant(now);
  if (ms === null) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: POLICY.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).map(part => [part.type, part.value]));
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const phase = minute >= POLICY.escalationMinute ? 'ESCALATION' :
    minute >= POLICY.targetMinute ? 'TARGET' :
    minute >= POLICY.assessmentMinute ? 'ASSESSMENT' : 'BEFORE_HANDOFF';
  return Object.freeze({
    utcDate: now.slice(0, 10), localDate: `${parts.year}-${parts.month}-${parts.day}`,
    localTime: `${parts.hour}:${parts.minute}`, timeZone: POLICY.timeZone, phase,
  });
}
function output(state, reason, clock = null) {
  const escalationRequired = clock?.phase === 'ESCALATION' &&
    !['DELIVERED', 'NOT_DUE', 'NOT_ELIGIBLE'].includes(state);
  return Object.freeze({
    policyVersion: POLICY.version, state, reason,
    clock, escalationRequired,
    nextAction: NEXT[state],
    executionAllowed: false,
    nativeAcceptance: 'NOT_EVALUATED',
    externalWakeAcceptance: 'NOT_EVALUATED',
  });
}
function validRun(run, now) {
  if (!record(run) || !['daily', 'backstop'].includes(run.workflow) || run.branch !== 'main' ||
      !['schedule', 'workflow_dispatch'].includes(run.event) || !sha(run.headSha) ||
      !Number.isSafeInteger(run.id) || run.id <= 0 || !realDay(run.edition)) return false;
  const created = instant(run.createdAt), updated = instant(run.updatedAt);
  if (created === null || updated === null || created > updated || updated > now) return false;
  return run.status === 'completed' ? CONCLUSIONS.has(run.conclusion) :
    ACTIVE.has(run.status) && run.conclusion === null;
}
function validCandidate(pr, edition) {
  return record(pr) && pr.edition === edition && Number.isSafeInteger(pr.number) && pr.number > 0 &&
    ['open', 'closed', 'merged'].includes(pr.state) && typeof pr.draft === 'boolean' &&
    typeof pr.title === 'string' && typeof pr.headRef === 'string' && sha(pr.headSha) &&
    Array.isArray(pr.files) && pr.files.every(p => typeof p === 'string');
}
function candidateGates(pr) {
  const gates = pr.gates;
  if (!record(gates) || gates.headSha !== pr.headSha || !sha(pr.contentSha)) return 'unknown';
  if (!GATES.has(gates.sourceReview) || !GATES.has(gates.preview) ||
      !CHECK_NAMES.every(k => GATES.has(gates[k]))) return 'unknown';
  if (gates.sourceReview !== 'pass') return gates.sourceReview === 'fail' ? 'source' : 'unknown';
  if ([...CHECK_NAMES, 'preview'].some(k => gates[k] !== 'pass')) return 'technical';
  if (gates.previewHeadSha !== pr.headSha || !receipt(gates.sourceReceipt) || !receipt(gates.previewReceipt) ||
      !CHECK_NAMES.every(k => receipt(gates[`${k}Receipt`]))) return 'unknown';
  return 'pass';
}
function humanApproved(pr) {
  const h = pr.humanReview;
  return record(h) && h.decision === 'approved' && typeof h.reviewer === 'string' && h.reviewer.trim().length > 0 &&
    h.approvedContentSha === pr.contentSha && sha(h.approvedHeadSha) && receipt(h.receipt);
}
function delivered(e, now, pr, edition) {
  const r = e.release;
  if (!record(r) || !fresh(r, now) || !pr || candidateGates(pr) !== 'pass' || !humanApproved(pr) ||
      pr.state !== 'merged' || !sha(pr.mergeSha) || r.prNumber !== pr.number ||
      r.mergeSha !== pr.mergeSha || r.publishedHeadSha !== pr.headSha ||
      r.publishedContentSha !== pr.contentSha || r.protectedMerge !== true || !receipt(r.mergeReceipt)) return false;
  const d = r.production, live = r.live;
  return record(d) && sha(d.sha) && d.sha === e.mainSha && d.state === 'READY' &&
    typeof d.id === 'string' && /^dpl_[A-Za-z0-9]+$/.test(d.id) && d.mergeContained === true &&
    d.contentSha === e.article.contentSha && d.contentSha === pr.contentSha &&
    Array.isArray(d.aliases) && ['www.usd-impact.com', 'usd-impact.com'].every(a => d.aliases.includes(a)) &&
    receipt(d.receipt) && record(live) &&
    ['article', 'index', 'latestJson', 'rss'].every(k => record(live[k]) &&
      live[k].edition === edition && live[k].state === 'verified' && receipt(live[k].receipt));
}

/** Accept plain JSON data from a reviewed collector, not user-authored evidence. */
export function classifyDailyDelivery(input = {}) {
  const { now, edition, evidence } = record(input) ? input : {};
  const clock = deadlineClock(now), ms = instant(now);
  if (!clock || !realDay(edition)) return output('UNKNOWN', 'invalid-clock-or-edition');
  if (edition > clock.utcDate) return output('NOT_DUE', 'future-utc-edition', clock);
  if (edition < clock.utcDate) return output('HISTORICAL_HOLD', 'past-edition-no-automatic-replay', clock);
  if ([0, 6].includes(new Date(`${edition}T12:00:00Z`).getUTCDay())) return output('NOT_ELIGIBLE', 'utc-weekend', clock);
  if (edition !== clock.localDate) return output('DATE_BOUNDARY_HOLD', 'utc-local-edition-boundary', clock);
  const e = evidence;
  if (!record(e) || e.version !== 1 || e.edition !== edition || !sha(e.mainSha) || !fresh(e, ms)) {
    return output('UNKNOWN', 'invalid-or-stale-snapshot', clock);
  }
  const article = e.article, prs = e.prs, runs = e.runs;
  if (![article, prs, runs].every(x => record(x) && fresh(x, ms)) ||
      article.edition !== edition || article.mainSha !== e.mainSha ||
      !['absent', 'review', 'published'].includes(article.state) ||
      (article.state !== 'absent' && !sha(article.contentSha)) ||
      prs.coverage !== 'open-all-closed-14d-complete' || runs.coverage !== 'all-active-and-edition-complete' ||
      !Array.isArray(prs.items) || !Array.isArray(runs.items) || prs.items.length > 100 || runs.items.length > 100 ||
      !prs.items.every(pr => validCandidate(pr, edition)) || !runs.items.every(run => validRun(run, ms)) ||
      new Set(prs.items.map(pr => pr.number)).size !== prs.items.length ||
      new Set(runs.items.map(run => run.id)).size !== runs.items.length) {
    return output('UNKNOWN', 'incomplete-stale-or-malformed-evidence', clock);
  }
  if (e.dispatchReceipt === 'unknown' || !['none', 'reconciled'].includes(e.dispatchReceipt)) {
    return output('UNKNOWN', 'ambiguous-dispatch-receipt', clock);
  }
  const candidates = prs.items;
  if (candidates.length > 1) return output('CONFLICT_HOLD', 'multiple-date-related-candidates', clock);
  const pr = candidates[0];
  if (pr && (pr.title !== `Publish Daily USD Impact \u2014 ${edition}` ||
      !pr.headRef.startsWith(`automation/daily-usd-impact-${edition}-`) ||
      pr.files.length !== 1 || pr.files[0] !== `apps/web/src/content/news/${edition}.md`)) {
    return output('CONFLICT_HOLD', 'date-related-pr-outside-publication-contract', clock);
  }
  if (article.state === 'published') {
    return delivered(e, ms, pr, edition) ? output('DELIVERED', 'bound-release-evidence-present', clock) :
      output('PUBLICATION_VERIFICATION', 'published-file-without-complete-release-evidence', clock);
  }
  if (pr?.state === 'merged') return output('PUBLICATION_VERIFICATION', 'merged-candidate-not-yet-verified-live', clock);
  if (pr?.state === 'closed') return output('EDITORIAL_HOLD', 'closed-candidate-is-not-permission-for-replacement', clock);
  if (runs.items.some(run => ACTIVE.has(run.status))) return output('ACTIVE', 'existing-active-work-no-competing-candidate', clock);
  if (pr) {
    if (pr.humanReview?.decision === 'changes_requested') return output('EDITORIAL_HOLD', 'human-changes-requested', clock);
    const gate = candidateGates(pr);
    if (gate === 'source') return output('SOURCE_HOLD', 'current-candidate-source-review-failed', clock);
    if (gate === 'technical') return output('TECHNICAL_HOLD', 'current-head-technical-gate-not-passed', clock);
    if (gate === 'unknown') return output('UNKNOWN', 'missing-or-mismatched-candidate-evidence', clock);
    if (!humanApproved(pr)) return output('AWAITING_EDITORIAL_REVIEW', 'exact-copy-human-approval-missing', clock);
    return output('RELEASE_REVIEW', 'recheck-current-candidate-before-authorized-release', clock);
  }
  if (article.state === 'review') return output('EDITORIAL_HOLD', 'review-file-already-on-main', clock);
  const latestDaily = runs.items.filter(r => r.workflow === 'daily' && r.edition === edition)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id)[0];
  if (latestDaily?.conclusion === 'success') return output('UNKNOWN', 'green-run-without-candidate-reconcile-noop', clock);
  if (latestDaily && !['failure', 'timed_out'].includes(latestDaily.conclusion)) {
    return output('UNKNOWN', 'terminal-disposition-needs-reconciliation', clock);
  }
  if (clock.phase === 'BEFORE_HANDOFF') return output('NO_CANDIDATE', 'before-editorial-handoff-not-scheduler-failure', clock);
  return output('FALLBACK_ASSESSMENT', latestDaily ? 'definitive-failure-needs-editorial-handoff' :
    'no-candidate-after-complete-snapshot-delayed-schedule-still-possible', clock);
}
