import { OUTCOME, SEVERITY, result } from './integrity-watchdog-policy.mjs';
import { jsonRequest, missingProvider } from './integrity-watchdog-provider-common.mjs';

export async function vercelContracts({ fetchImpl = globalThis.fetch, env = process.env, expectedGitSha = null } = {}) {
  const token = env.USDIMPACT_WATCHDOG_VERCEL_TOKEN || '';
  const projectId = env.USDIMPACT_WATCHDOG_VERCEL_PROJECT_ID || '';
  const teamId = env.USDIMPACT_WATCHDOG_VERCEL_TEAM_ID || '';
  if (!token || !projectId || !teamId) return [missingProvider({ id: 'VERCEL-SOURCE-IDENTITY', workflowId: 'VERCEL-DRIFT-02', title: 'Vercel Production source identity', domain: 'vercel', severity: SEVERITY.P1, names: ['USDIMPACT_WATCHDOG_VERCEL_TOKEN', 'USDIMPACT_WATCHDOG_VERCEL_PROJECT_ID', 'USDIMPACT_WATCHDOG_VERCEL_TEAM_ID'] })];
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = `teamId=${encodeURIComponent(teamId)}`;
  const [projectData, deploymentsData, envData] = await Promise.all([
    jsonRequest({ fetchImpl, url: `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}?${suffix}`, headers }),
    jsonRequest({ fetchImpl, url: `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&target=production&limit=5&${suffix}`, headers }),
    jsonRequest({ fetchImpl, url: `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env?${suffix}`, headers }),
  ]);
  const latest = deploymentsData.json?.deployments?.[0] || projectData.json?.latestDeployment || null;
  const deploymentSha = latest?.meta?.githubCommitSha || latest?.gitSource?.sha || null;
  const ready = ['READY', 'ready'].includes(latest?.state || latest?.readyState);
  let sourceOutcome = OUTCOME.PASS;
  let sourceSummary = 'Latest Vercel Production deployment is READY and source identity is coherent.';
  if (!latest || projectData.observation.status !== 200) { sourceOutcome = OUTCOME.UNKNOWN; sourceSummary = 'Vercel project or Production deployment evidence could not be collected.'; }
  else if (!ready) { sourceOutcome = OUTCOME.FAIL; sourceSummary = `Latest Production deployment is not READY (${latest?.state || latest?.readyState || 'unknown'}).`; }
  else if (expectedGitSha && deploymentSha && deploymentSha !== expectedGitSha) { sourceOutcome = OUTCOME.FAIL; sourceSummary = 'Vercel Production source does not match the expected GitHub head.'; }
  else if (expectedGitSha && !deploymentSha) { sourceOutcome = OUTCOME.WARN; sourceSummary = 'Production is READY, but its Git SHA is unavailable for reconciliation.'; }
  const requiredNames = ['OPENAI_API_KEY', 'NEWSFEED_BEARER_TOKEN', 'RESEND_API_KEY'];
  const entries = Array.isArray(envData.json?.envs) ? envData.json.envs : [];
  const productionNames = new Set(entries.filter((entry) => entry.target?.includes('production')).map((entry) => entry.key));
  const missing = requiredNames.filter((name) => !productionNames.has(name));
  const envOutcome = envData.observation.status !== 200 ? OUTCOME.UNKNOWN : (missing.length ? OUTCOME.WARN : OUTCOME.PASS);
  return [
    result({ id: 'VERCEL-SOURCE-IDENTITY', workflowId: 'VERCEL-DRIFT-02', title: 'Vercel Production source identity', domain: 'vercel', severity: SEVERITY.P1, outcome: sourceOutcome, summary: sourceSummary, evidence: [{ id: 'VERCEL-PRODUCTION', source: 'vercel', project_name: projectData.json?.name || null, latest_deployment_id: latest?.uid || latest?.id || null, latest_deployment_state: latest?.state || latest?.readyState || null, deployment_git_sha: deploymentSha, expected_git_sha: expectedGitSha, source_matches: expectedGitSha && deploymentSha ? expectedGitSha === deploymentSha : null }] }),
    result({ id: 'VERCEL-CONFIG-PRESENCE', workflowId: 'VERCEL-DRIFT-02', title: 'Vercel Production required-variable presence', domain: 'vercel', severity: SEVERITY.P1, outcome: envOutcome, summary: envOutcome === OUTCOME.PASS ? 'Required Production variable names are present; values were not collected.' : (envOutcome === OUTCOME.WARN ? `Required names are missing: ${missing.join(', ')}.` : 'Vercel environment metadata could not be inspected.'), evidence: [{ id: 'VERCEL-ENV-METADATA', source: 'vercel', response_status: envData.observation.status || null, production_variable_count: productionNames.size, required_variable_names: requiredNames, missing_variable_names: missing, values_collected: false }] }),
  ];
}
