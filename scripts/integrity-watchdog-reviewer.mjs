import { OUTCOME, SEVERITY, result, sanitize, sha256 } from './integrity-watchdog-policy.mjs';
import { observe } from './integrity-watchdog-collectors.mjs';

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'summary', 'challenged_contract_ids', 'findings'],
  properties: {
    verdict: { type: 'string', enum: ['CONFIRM', 'CHALLENGE', 'INSUFFICIENT_EVIDENCE'] },
    summary: { type: 'string', minLength: 1, maxLength: 1500 },
    challenged_contract_ids: { type: 'array', maxItems: 50, items: { type: 'string', minLength: 1, maxLength: 120 } },
    findings: {
      type: 'array', maxItems: 50,
      items: {
        type: 'object', additionalProperties: false,
        required: ['contract_id', 'assessment', 'rationale', 'required_evidence'],
        properties: {
          contract_id: { type: 'string', minLength: 1, maxLength: 120 },
          assessment: { type: 'string', enum: ['SUPPORTED', 'OVERSTATED', 'UNDERSTATED', 'INCONCLUSIVE'] },
          rationale: { type: 'string', minLength: 1, maxLength: 1500 },
          required_evidence: { type: 'array', maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 500 } },
        },
      },
    },
  },
};

function responseText(json) {
  if (typeof json?.output_text === 'string') return json.output_text;
  const parts = [];
  for (const item of json?.output || []) for (const content of item?.content || []) if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
  return parts.join('\n');
}

function responseRefusal(json) {
  for (const item of json?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'refusal' && typeof content.refusal === 'string') return true;
    }
  }
  return false;
}

function validReviewShape(review) {
  return Boolean(
    review
    && ['CONFIRM', 'CHALLENGE', 'INSUFFICIENT_EVIDENCE'].includes(review.verdict)
    && typeof review.summary === 'string'
    && Array.isArray(review.challenged_contract_ids)
    && Array.isArray(review.findings)
  );
}

export function reviewerConfigured(env = process.env) {
  return Boolean(env.USDIMPACT_WATCHDOG_OPENAI_API_KEY && env.USDIMPACT_WATCHDOG_OPENAI_MODEL);
}

export async function independentReview({ fetchImpl = globalThis.fetch, env = process.env, results = [], projectSummary = {}, fixReadyPackets = [], enabled = false } = {}) {
  const observedAt = new Date().toISOString();
  if (!enabled) return result({ id: 'INTEGRITY-INDEPENDENT-REVIEW', workflowId: 'WATCHDOG-CROSS-01', title: 'Independent integrity review', domain: 'openai', severity: SEVERITY.P2, outcome: OUTCOME.SKIP, summary: 'Independent AI review was not requested for this run.', observedAt, evidence: [{ id: 'OPENAI-REVIEW-MODE', source: 'openai', enabled: false }], material: false });
  const apiKey = env.USDIMPACT_WATCHDOG_OPENAI_API_KEY || '';
  const model = env.USDIMPACT_WATCHDOG_OPENAI_MODEL || '';
  if (!reviewerConfigured(env)) return result({ id: 'INTEGRITY-INDEPENDENT-REVIEW', workflowId: 'WATCHDOG-CROSS-01', title: 'Independent integrity review', domain: 'openai', severity: SEVERITY.P2, outcome: OUTCOME.UNKNOWN, summary: 'Independent AI review was requested, but its dedicated OpenAI key and explicit reviewer model are not both configured.', observedAt, evidence: [{ id: 'OPENAI-REVIEW-CONFIG', source: 'environment', configured: false, api_key_configured: Boolean(apiKey), model_configured: Boolean(model), required_environment_names: ['USDIMPACT_WATCHDOG_OPENAI_API_KEY', 'USDIMPACT_WATCHDOG_OPENAI_MODEL'] }], material: false, remediation: { proposed_changes: ['Install a project-scoped key and explicitly configure an approved reviewer model in the approved secret/variable stores.'], prohibited_actions: ['Do not print, commit, summarize, or expose the key value.', 'Do not silently substitute a model when the configured reviewer model is absent.'] } });

  const input = sanitize({
    project_summary: projectSummary,
    contract_results: results.map((entry) => ({ id: entry.id, workflow_id: entry.workflow_id, severity: entry.severity, outcome: entry.outcome, classification: entry.classification, summary: entry.summary, evidence_digest: entry.evidence_digest, evidence: entry.evidence })),
    fix_ready_packets: fixReadyPackets,
  });
  const request = {
    model,
    store: false,
    tools: [],
    tool_choice: 'none',
    parallel_tool_calls: false,
    instructions: [
      'You are the independent USD Impact Integrity Reviewer.',
      'Challenge the watchdog conclusions instead of restating them.',
      'Treat missing evidence as missing evidence, not proof of success or failure.',
      'Do not recommend automatic merges, deployments, email sends, customer mutations, entitlement mutations, database writes, Drive changes, or secret changes.',
      'Identify overstatement, understatement, contradictions, and the smallest additional evidence needed.',
      'Return only the required structured JSON.',
    ].join(' '),
    input: JSON.stringify(input),
    text: { format: { type: 'json_schema', name: 'usd_impact_integrity_review', strict: true, schema: REVIEW_SCHEMA } },
  };
  const observation = await observe({ fetchImpl, url: 'https://api.openai.com/v1/responses', method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request), timeoutMs: 60_000 });
  if (!observation.ok || observation.status !== 200) return result({ id: 'INTEGRITY-INDEPENDENT-REVIEW', workflowId: 'WATCHDOG-CROSS-01', title: 'Independent integrity review', domain: 'openai', severity: SEVERITY.P2, outcome: OUTCOME.UNKNOWN, summary: `Independent AI review did not return a successful response (${observation.status || observation.error_name || 'no response'}).`, observedAt, evidence: [{ id: 'OPENAI-REVIEW-HTTP', source: 'openai', status: observation.status || null, duration_ms: observation.duration_ms, response_body_sha256: observation.body_sha256 || null, response_body_bytes: observation.body_bytes || null }], material: false });
  let responseJson;
  try {
    responseJson = JSON.parse(observation.body);
  } catch {
    return result({ id: 'INTEGRITY-INDEPENDENT-REVIEW', workflowId: 'WATCHDOG-CROSS-01', title: 'Independent integrity review', domain: 'openai', severity: SEVERITY.P2, outcome: OUTCOME.UNKNOWN, summary: 'Independent AI review response envelope was not valid JSON.', observedAt, evidence: [{ id: 'OPENAI-REVIEW-PARSE', source: 'openai', status: observation.status, response_body_sha256: observation.body_sha256 }], material: false });
  }
  if (responseJson?.status && responseJson.status !== 'completed') return result({ id: 'INTEGRITY-INDEPENDENT-REVIEW', workflowId: 'WATCHDOG-CROSS-01', title: 'Independent integrity review', domain: 'openai', severity: SEVERITY.P2, outcome: OUTCOME.UNKNOWN, summary: `Independent AI review response was not completed (${responseJson.status}).`, observedAt, evidence: [{ id: 'OPENAI-REVIEW-STATUS', source: 'openai', status: observation.status, response_status: responseJson.status, response_body_sha256: observation.body_sha256 }], material: false });
  if (responseRefusal(responseJson)) return result({ id: 'INTEGRITY-INDEPENDENT-REVIEW', workflowId: 'WATCHDOG-CROSS-01', title: 'Independent integrity review', domain: 'openai', severity: SEVERITY.P2, outcome: OUTCOME.UNKNOWN, summary: 'Independent AI review returned a refusal instead of the required structured assessment.', observedAt, evidence: [{ id: 'OPENAI-REVIEW-REFUSAL', source: 'openai', status: observation.status, refusal_detected: true, response_body_sha256: observation.body_sha256 }], material: false });

  let review;
  try {
    review = JSON.parse(responseText(responseJson));
  } catch {
    return result({ id: 'INTEGRITY-INDEPENDENT-REVIEW', workflowId: 'WATCHDOG-CROSS-01', title: 'Independent integrity review', domain: 'openai', severity: SEVERITY.P2, outcome: OUTCOME.UNKNOWN, summary: 'Independent AI review response was not valid structured JSON.', observedAt, evidence: [{ id: 'OPENAI-REVIEW-PARSE', source: 'openai', status: observation.status, response_body_sha256: observation.body_sha256 }], material: false });
  }
  if (!validReviewShape(review)) return result({ id: 'INTEGRITY-INDEPENDENT-REVIEW', workflowId: 'WATCHDOG-CROSS-01', title: 'Independent integrity review', domain: 'openai', severity: SEVERITY.P2, outcome: OUTCOME.UNKNOWN, summary: 'Independent AI review response did not satisfy the required review shape.', observedAt, evidence: [{ id: 'OPENAI-REVIEW-SHAPE', source: 'openai', status: observation.status, response_body_sha256: observation.body_sha256 }], material: false });

  const safe = sanitize(review);
  const outcome = safe.verdict === 'CONFIRM' ? OUTCOME.PASS : (safe.verdict === 'CHALLENGE' ? OUTCOME.WARN : OUTCOME.UNKNOWN);
  return result({ id: 'INTEGRITY-INDEPENDENT-REVIEW', workflowId: 'WATCHDOG-CROSS-01', title: 'Independent integrity review', domain: 'openai', severity: SEVERITY.P2, outcome, summary: `Independent reviewer verdict: ${safe.verdict}. ${safe.summary}`, observedAt, evidence: [{ id: 'OPENAI-INDEPENDENT-REVIEW', source: 'openai', model, response_id: responseJson?.id || null, verdict: safe.verdict, challenged_contract_count: safe.challenged_contract_ids?.length || 0, review_digest: sha256(JSON.stringify(safe)), review: safe, input_stored_by_request: false, tools_enabled: false }], material: false });
}
