import { OUTCOME, result } from './integrity-watchdog-policy.mjs';
import { observe } from './integrity-watchdog-http.mjs';

export async function jsonRequest(args) {
  const observation = await observe(args);
  if (!observation.ok) return { observation, json: null };
  try { return { observation, json: JSON.parse(observation.body) }; } catch { return { observation, json: null }; }
}

export function missingProvider({ id, workflowId, title, domain, severity, names }) {
  return result({ id, workflowId, title, domain, severity, outcome: OUTCOME.UNKNOWN, summary: `${title}: dedicated read-only provider configuration is unavailable.`, evidence: [{ id: `${id}-CONFIG`, source: 'environment', configured: false, required_environment_names: names }], remediation: { proposed_changes: ['Provision a dedicated least-privilege read-only credential and identifiers through the approved secret store.'], prohibited_actions: ['Do not reuse a write-capable Production credential solely to remove UNKNOWN.'] } });
}
