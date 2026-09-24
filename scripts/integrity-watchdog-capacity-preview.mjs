/**
 * Review-only adapter. Not registered with the watchdog and not executable by CLI.
 * Explicit activation + the dedicated credential + an explicitly supplied fetch
 * are all required. Never requests decrypted values; never issues a write.
 */
import { OUTCOME, SEVERITY, result } from './integrity-watchdog-policy.mjs';

export const PREVIEW_TARGET = Object.freeze({
  projectId: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
  teamId: 'team_1LuMlacGuM198mRjoID4O3Ct',
  branch: 'agent/video-progress-combined-693-694-ee62273',
});
export const COLLECTION_BUDGET_MS = 5000;
export const MAX_RESPONSE_BYTES = 750000;
const MAX_VARIABLES = 1000;
const MAX_URL_RECORDS = 20;
const own = (x, k) => Object.hasOwn(x, k);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const validId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{3,100}$/.test(x)
  && !/^(?:sb_|sk-|re_|whsec_|eyJ)/.test(x);
function timestamp(n) {
  return Number.isSafeInteger(n) && n >= 0 && n <= 8640000000000000
    ? new Date(n).toISOString() : null;
}
const missing = code => ({ status: 'UNKNOWN', code, records: [] });

/** Native JSON is used transiently. Arbitrary value, creator, comment and hint
 * fields never enter the returned record, even when the key is SUPABASE_URL. */
export function normalizePreviewMetadata(payload, observedAt) {
  const observedMs = Date.parse(observedAt);
  if (typeof observedAt !== 'string' || !Number.isFinite(observedMs)
    || new Date(observedMs).toISOString() !== observedAt) return missing('INVALID_OBSERVATION_TIME');
  if (!object(payload) || !Array.isArray(payload.envs)
    || payload.envs.length > MAX_VARIABLES) return missing('NATIVE_ENVELOPE_UNSUPPORTED');
  // Do not silently ignore new pagination/error/completeness semantics.
  if (Object.keys(payload).some(k => k !== 'envs')) return missing('NATIVE_ENVELOPE_REQUIRES_REVIEW');
  const records = [], ids = new Set();
  for (const row of payload.envs) {
    if (!object(row) || typeof row.key !== 'string') return missing('NATIVE_ROW_UNCLASSIFIABLE');
    if (row.key !== 'SUPABASE_URL') continue; // Not a substring match.
    if (!validId(row.id) || ids.has(row.id)) return missing('NATIVE_ID_INVALID_OR_DUPLICATE');
    ids.add(row.id);
    if (records.length >= MAX_URL_RECORDS) return missing('URL_RECORD_LIMIT');
    if (!Array.isArray(row.target) || row.target.length < 1 || row.target.length > 3
      || new Set(row.target).size !== row.target.length
      || row.target.some(t => !['preview', 'production', 'development'].includes(t))) {
      return missing('TARGET_METADATA_UNSUPPORTED');
    }
    // Omitted/null means the provider supplied no branch restriction. The literal
    // strings "undefined" and "null" are not normalized into a general entry.
    const branch = own(row, 'gitBranch') ? row.gitBranch : null;
    if (!(branch === null || (typeof branch === 'string' && branch.length > 0 && branch.length <= 128
      && /^[A-Za-z0-9._/-]+$/.test(branch) && !['undefined', 'null'].includes(branch)))) {
      return missing('BRANCH_METADATA_UNSUPPORTED');
    }
    if (row.customEnvironmentIds != null && (!Array.isArray(row.customEnvironmentIds)
      || row.customEnvironmentIds.length > 0)) return missing('CUSTOM_ENVIRONMENT_REQUIRES_REVIEW');
    const createdAt = timestamp(row.createdAt), updatedAt = timestamp(row.updatedAt);
    if (!createdAt || !updatedAt || row.updatedAt < row.createdAt || row.updatedAt > observedMs) {
      return missing('NATIVE_TIMESTAMPS_UNSUPPORTED');
    }
    const relation = branch === PREVIEW_TARGET.branch ? 'exact_approved_branch'
      : branch === 'video-progress-combined' ? 'previously_reported_short_branch'
        : branch === null ? 'no_branch_restriction_returned' : 'other_branch';
    // Arbitrary branch strings are not copied to artifacts. Native IDs provide a
    // lookup anchor; the exact two relevant branch strings are constants above.
    records.push({ id: row.id, key: 'SUPABASE_URL', targets: [...row.target].sort(),
      branchRelation: relation,
      gitBranch: relation === 'other_branch' ? null : branch,
      otherBranchNameOmitted: relation === 'other_branch', createdAt, updatedAt });
  }
  records.sort((a, b) => a.id.localeCompare(b.id));
  return { status: 'COLLECTED', code: 'NATIVE_METADATA_FIELDS_COLLECTED', records,
    exactKeyRecordCount: records.length, returnedVariableCount: payload.envs.length,
    responseBodyComplete: true, exhaustiveHistoricalInventoryProved: false,
    environmentValuesRead: false, effectiveDeploymentBindingProved: false,
    priorMutationReconciled: false };
}

function contracts(normalized, observedAt, requestCount) {
  const evidence = [{ id: 'CAPACITY-PREVIEW-URL-RECEIPT', source: 'vercel_native_or_fixture',
    project_id: PREVIEW_TARGET.projectId, team_id: PREVIEW_TARGET.teamId,
    approved_branch: PREVIEW_TARGET.branch, observation_code: normalized.code,
    request_count: requestCount, request_method: 'GET', decrypt_requested: false,
    values_persisted: false, records: normalized.records,
    exhaustive_historical_inventory_proved: false, prior_mutation_reconciled: false,
    effective_deployment_binding_proved: false, capacity_validated: false }];
  const collected = normalized.status === 'COLLECTED';
  const exact = normalized.records.filter(r => r.branchRelation === 'exact_approved_branch');
  let isolationOutcome = OUTCOME.UNKNOWN;
  let isolationSummary = 'The effective Development destination and earlier mutation remain unverified.';
  if (exact.some(r => r.targets.length !== 1 || r.targets[0] !== 'preview')) {
    isolationOutcome = OUTCOME.FAIL;
    isolationSummary = 'Returned exact-branch metadata widens the approved Preview-only scope.';
  } else if (exact.length > 1) {
    isolationSummary = 'Multiple exact-branch URL records require native reconciliation; no record was selected.';
  } else if (exact.length === 0) {
    isolationSummary = 'No exact approved branch record was established by this response; do not add or delete by inference.';
  }
  const base = { workflowId: 'VERCEL-DRIFT-02', domain: 'vercel', severity: SEVERITY.P1,
    observedAt, evidence, goldEligible: false };
  return [
    result({ ...base, id: 'CAPACITY-VERCEL-URL-METADATA', title: 'Native Preview URL scope metadata',
      outcome: collected ? OUTCOME.PASS : OUTCOME.UNKNOWN,
      summary: collected ? 'Bounded native metadata fields were parsed; values and deployment binding were not verified.'
        : 'Native metadata unavailable or unsupported; no provider write is permitted.' }),
    result({ ...base, id: 'CAPACITY-PREVIEW-ISOLATION', title: 'Preview isolation remains separately gated',
      outcome: isolationOutcome, summary: isolationSummary,
      remediation: { proposed_changes: ['Obtain reliable native reconciliation and separately verified non-secret destination evidence.'],
        prohibited_actions: ['No save, delete, decryption, credential fallback, deployment or member test from this receipt.'] } }),
  ];
}

function cancel(body) {
  try { void body?.cancel?.().catch(() => {}); } catch { /* best-effort cleanup */ }
}

/** Not invoked automatically. fetchImpl must be a trusted transport, not a
 * browser summary adapter. Tests supply synthetic transports only. */
export async function collectPreviewMetadata({ activationApproved = false, env = {}, fetchImpl,
  now = () => new Date().toISOString() } = {}) {
  const receipt = (normalized, count) => ({ normalized,
    contracts: contracts(normalized, now(), count), installed: false,
    writesOrDeploymentsAuthorized: false, capacityValidated: false });
  if (activationApproved !== true) return receipt(missing('ACTIVATION_NOT_APPROVED'), 0);
  if (env.USDIMPACT_WATCHDOG_VERCEL_PROJECT_ID !== PREVIEW_TARGET.projectId
    || env.USDIMPACT_WATCHDOG_VERCEL_TEAM_ID !== PREVIEW_TARGET.teamId) {
    return receipt(missing('DEDICATED_SCOPE_NOT_VERIFIED'), 0);
  }
  const credential = env.USDIMPACT_WATCHDOG_VERCEL_TOKEN;
  if (typeof credential !== 'string' || !/^[\x21-\x7e]{20,4096}$/.test(credential)) {
    return receipt(missing('DEDICATED_CREDENTIAL_UNAVAILABLE'), 0);
  }
  if (typeof fetchImpl !== 'function') return receipt(missing('TRUSTED_TRANSPORT_UNAVAILABLE'), 0);
  const url = `https://api.vercel.com/v10/projects/${PREVIEW_TARGET.projectId}/env?decrypt=false&teamId=${PREVIEW_TARGET.teamId}`;
  const controller = new AbortController(), started = performance.now();
  let active = true, timer, reader, response;
  const ensureActive = () => {
    if (!active || controller.signal.aborted || performance.now() - started >= COLLECTION_BUDGET_MS) throw new Error('budget');
  };
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { active = false; controller.abort(); cancel(reader || response?.body); reject(new Error('budget')); }, COLLECTION_BUDGET_MS);
  });
  const task = async () => {
    response = await fetchImpl(url, { method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` },
      signal: controller.signal, redirect: 'error', cache: 'no-store' });
    ensureActive();
    if (!response || response.status !== 200 || response.redirected || response.url !== url) {
      return missing('NATIVE_HTTP_RESPONSE_UNVERIFIED');
    }
    if ((response.headers?.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json'
      || !response.body?.getReader) return missing('NATIVE_CONTENT_TYPE_UNSUPPORTED');
    // A paginated/partial contract needs explicit review, not another request.
    if (response.headers.get('link') || response.headers.get('content-range')) return missing('NATIVE_PARTIAL_RESPONSE');
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) return missing('NATIVE_RESPONSE_TOO_LARGE');
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0, text = '';
    while (true) {
      const { done, value } = await reader.read();
      ensureActive();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('stream');
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) return missing('NATIVE_RESPONSE_TOO_LARGE');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    ensureActive();
    const parsed = JSON.parse(text);
    text = '';
    const normalized = normalizePreviewMetadata(parsed, now());
    ensureActive();
    return normalized;
  };
  try {
    return receipt(await Promise.race([Promise.resolve().then(task), deadline]), 1);
  } catch {
    // Provider messages, raw responses and error properties must not leak.
    return receipt(missing('NATIVE_COLLECTION_FAILED_OR_TIMED_OUT'), 1);
  } finally {
    active = false;
    clearTimeout(timer);
    controller.abort();
    cancel(reader || response?.body);
    try { reader?.releaseLock(); } catch { /* cancellation may still be pending */ }
  }
}
