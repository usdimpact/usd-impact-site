// Draft B-1: optional Research webhook receipt evidence, default OFF.
// This is NOT an atomic payment/subscription reconciliation guarantee.
// Do not enable in Production until independent QA and receipt SQL/CAS approval.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDER = 'lemon-squeezy-research';

function evidenceError(code) {
  const error = new Error('Research Membership receipt evidence is unavailable.');
  error.code = code;
  error.status = 503;
  return error;
}

async function invokeReceiptRpc({ evidence, name, payload, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl(`${evidence.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        apikey: evidence.supabaseSecret,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw evidenceError('RESEARCH_WEBHOOK_RECEIPT_REQUEST_FAILED');
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw evidenceError('RESEARCH_WEBHOOK_RECEIPT_RESPONSE_INVALID');
  }
  if (!response.ok || !body || typeof body !== 'object' || Array.isArray(body)) {
    throw evidenceError('RESEARCH_WEBHOOK_RECEIPT_RPC_FAILED');
  }
  return body;
}

export function researchReceiptEvidenceEnabled(environment = process.env) {
  // A newly introduced flag; absent/unknown means fail closed to legacy path.
  // This flag MUST NOT be set by this Draft or a later merge automatically.
  return environment.RESEARCH_WEBHOOK_RECEIPTS_ENABLED === 'true';
}

export async function beginResearchWebhookReceipt({
  evidence,
  fetchImpl = fetch,
}) {
  if (!evidence || !evidence.providerEventId || !/^[a-f0-9]{64}$/.test(evidence.semanticSha256 || '')) {
    throw evidenceError('RESEARCH_WEBHOOK_RECEIPT_EVIDENCE_INVALID');
  }
  const result = await invokeReceiptRpc({
    evidence,
    name: 'begin_commerce_webhook_receipt',
    payload: {
      p_provider: PROVIDER,
      p_provider_event_id: evidence.providerEventId,
      p_event_type: evidence.eventType,
      p_payload_sha256: evidence.semanticSha256,
    },
    fetchImpl,
  });
  if (!UUID_PATTERN.test(result.receipt_id || '')
      || typeof result.should_process !== 'boolean'
      || !['received', 'processed', 'ignored'].includes(result.status)
      || (result.should_process && result.status !== 'received')
      || (!result.should_process && !['processed', 'ignored'].includes(result.status))) {
    const error = evidenceError('RESEARCH_WEBHOOK_RECEIPT_RESPONSE_INVALID');
    // Server-only structural diagnostics: booleans and status, never identities.
    error.validation = {
      receiptUuid: UUID_PATTERN.test(result.receipt_id || ''),
      processFlagType: typeof result.should_process,
      receiptStatus: result.status,
    };
    throw error;
  }
  return Object.freeze({
    id: result.receipt_id,
    shouldProcess: result.should_process,
    status: result.status,
  });
}

export async function finishResearchWebhookReceipt({
  evidence,
  receipt,
  status,
  errorCode = null,
  fetchImpl = fetch,
}) {
  if (!UUID_PATTERN.test(receipt?.id || '') || !['processed', 'ignored', 'failed'].includes(status)) {
    throw evidenceError('RESEARCH_WEBHOOK_RECEIPT_EVIDENCE_INVALID');
  }
  const result = await invokeReceiptRpc({
    evidence,
    name: 'finish_commerce_webhook_receipt',
    payload: {
      p_receipt_id: receipt.id,
      p_status: status,
      // Persist only a known code; never a raw DB error, buyer identity,
      // provider body, or credential-bearing exception text.
      p_last_error: status === 'failed' ? (errorCode || 'RESEARCH_WEBHOOK_UNCLASSIFIED') : null,
    },
    fetchImpl,
  });
  if (result.receipt_id !== receipt.id || result.status !== status) {
    throw evidenceError('RESEARCH_WEBHOOK_RECEIPT_FINALIZATION_INVALID');
  }
  return Object.freeze({ id: receipt.id, status });
}
