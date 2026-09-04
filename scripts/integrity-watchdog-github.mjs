import { OUTCOME, SEVERITY, result } from './integrity-watchdog-policy.mjs';
import { observe } from './integrity-watchdog-http.mjs';

async function jsonRequest(args) {
  const observation = await observe(args);
  if (!observation.ok) return { observation, json: null };
  try { return { observation, json: JSON.parse(observation.body) }; } catch { return { observation, json: null }; }
}

function missingProvider({ id, workflowId, title, domain, severity, names }) {
  return result({ id, workflowId, title, domain, severity, outcome: OUTCOME.UNKNOWN, summary: `${title}: dedicated read-only provider configuration is unavailable.`, evidence: [{ id: `${id}-CONFIG`, source: 'environment', configured: false, required_environment_names: names }], remediation: { proposed_changes: ['Provision a dedicated least-privilege read-only credential and identifiers through the approved secret store.'], prohibited_actions: ['Do not reuse a write-capable Production credential solely to remove UNKNOWN.'] } });
}

export async function githubContracts({ fetchImpl = globalThis.fetch, env = process.env, repository = 'usdimpact/usd-impact-site', branch = 'main' } = {}) {
  const token = env.GITHUB_TOKEN || '';
  if (!token) return [missingProvider({ id: 'GITHUB-CURRENT-HEAD-QUALITY', workflowId: 'GITHUB-CHANGE-01', title: 'Current-head GitHub quality state', domain: 'github', severity: SEVERITY.P0, names: ['GITHUB_TOKEN'] })];
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
  const branchData = await jsonRequest({ fetchImpl, url: `https://api.github.com/repos/${repository}/branches/${encodeURIComponent(branch)}`, headers });
  const head = branchData.json?.commit?.sha || null;
  if (!head) return [result({ id: 'GITHUB-CURRENT-HEAD-QUALITY', workflowId: 'GITHUB-CHANGE-01', title: 'Current-head GitHub quality state', domain: 'github', severity: SEVERITY.P0, outcome: OUTCOME.UNKNOWN, summary: 'The current default-branch head could not be established.', evidence: [{ id: 'GITHUB-BRANCH', source: 'github', status: branchData.observation.status || null }] })];
  const [runsData, protectionData] = await Promise.all([
    jsonRequest({ fetchImpl, url: `https://api.github.com/repos/${repository}/actions/workflows/quality.yml/runs?branch=${branch}&head_sha=${head}&per_page=10`, headers }),
    jsonRequest({ fetchImpl, url: `https://api.github.com/repos/${repository}/branches/${branch}/protection`, headers }),
  ]);
  const runs = Array.isArray(runsData.json?.workflow_runs) ? runsData.json.workflow_runs : [];
  const exact = runs.find((run) => run.head_sha === head) || null;
  const qualityOutcome = exact?.conclusion === 'success' ? OUTCOME.PASS : (exact?.status && exact.status !== 'completed' ? OUTCOME.WARN : (exact?.conclusion ? OUTCOME.FAIL : OUTCOME.UNKNOWN));
  const qualitySummary = exact?.conclusion === 'success' ? 'Exact-current-head quality run succeeded.' : (exact ? `Exact-current-head quality run is ${exact.status || exact.conclusion}.` : 'No exact-current-head quality run was found.');
  const contexts = protectionData.json?.required_status_checks?.contexts || [];
  let protectionOutcome = OUTCOME.UNKNOWN;
  let protectionSummary = 'Branch-protection evidence is unavailable to this connection.';
  if (protectionData.observation.status === 200) {
    const protectedEnough = contexts.length > 0 && Boolean(protectionData.json?.required_pull_request_reviews) && protectionData.json?.allow_force_pushes?.enabled !== true && protectionData.json?.allow_deletions?.enabled !== true;
    protectionOutcome = protectedEnough ? OUTCOME.PASS : OUTCOME.WARN;
    protectionSummary = protectedEnough ? 'Main has required checks, review protection, and destructive-ref protections.' : 'Branch protection was read, but one or more expected controls are not affirmative.';
  }
  return [
    result({ id: 'GITHUB-CURRENT-HEAD-QUALITY', workflowId: 'GITHUB-CHANGE-01', title: 'Current-head GitHub quality state', domain: 'github', severity: SEVERITY.P0, outcome: qualityOutcome, summary: qualitySummary, evidence: [{ id: 'GITHUB-QUALITY-RUN', source: 'github', repository, branch, head_sha: head, run_id: exact?.id || null, status: exact?.status || null, conclusion: exact?.conclusion || null }], goldEligible: true }),
    result({ id: 'GITHUB-REQUIRED-CHECKS', workflowId: 'GITHUB-CHANGE-01', title: 'Main branch required-check protection', domain: 'github', severity: SEVERITY.P1, outcome: protectionOutcome, summary: protectionSummary, evidence: [{ id: 'GITHUB-BRANCH-PROTECTION', source: 'github', response_status: protectionData.observation.status || null, required_context_count: contexts.length, required_pull_request_reviews: Boolean(protectionData.json?.required_pull_request_reviews), force_push_allowed: protectionData.json?.allow_force_pushes?.enabled === true, deletion_allowed: protectionData.json?.allow_deletions?.enabled === true }], goldEligible: true }),
  ];
}
