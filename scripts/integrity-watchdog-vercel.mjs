import { OUTCOME, SEVERITY, result } from './integrity-watchdog-policy.mjs';
import { jsonRequest, missingProvider } from './integrity-watchdog-provider-common.mjs';

const WEBSITE_REPOSITORY = 'usdimpact/usd-impact-site';
const GOVERNED_PRODUCTION_VARIABLE_NAMES = Object.freeze([
  'OPENAI_API_KEY',
  'NEWSFEED_BEARER_TOKEN',
  'RESEND_API_KEY',
]);

function configurationUnknown() {
  return missingProvider({
    id: 'VERCEL-CONFIG-PRESENCE',
    workflowId: 'VERCEL-DRIFT-02',
    title: 'Vercel Production required-variable presence',
    domain: 'vercel',
    severity: SEVERITY.P1,
    names: ['USDIMPACT_WATCHDOG_VERCEL_TOKEN', 'USDIMPACT_WATCHDOG_VERCEL_PROJECT_ID', 'USDIMPACT_WATCHDOG_VERCEL_TEAM_ID'],
  });
}

async function githubStatusSourceIdentity({ fetchImpl, env, expectedGitSha }) {
  const githubToken = env.GITHUB_TOKEN || '';
  if (!githubToken || !expectedGitSha) {
    return result({
      id: 'VERCEL-SOURCE-IDENTITY',
      workflowId: 'VERCEL-DRIFT-02',
      title: 'Vercel Production source identity',
      domain: 'vercel',
      severity: SEVERITY.P1,
      outcome: OUTCOME.UNKNOWN,
      summary: 'Vercel source identity could not be checked because direct Vercel configuration and exact GitHub commit-status evidence are unavailable.',
      evidence: [{
        id: 'VERCEL-GITHUB-STATUS-CONFIG',
        source: 'environment',
        direct_vercel_configuration_available: false,
        github_token_available: Boolean(githubToken),
        expected_git_sha_available: Boolean(expectedGitSha),
      }],
      remediation: {
        proposed_changes: ['Retain exact-head GitHub/Vercel status evidence or provision a dedicated read-only Vercel credential for direct deployment inspection.'],
        prohibited_actions: ['Do not reuse a write-capable Vercel credential solely to remove UNKNOWN.'],
      },
    });
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${githubToken}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const statusData = await jsonRequest({
    fetchImpl,
    url: `https://api.github.com/repos/${WEBSITE_REPOSITORY}/commits/${encodeURIComponent(expectedGitSha)}/status`,
    headers,
  });
  const statuses = Array.isArray(statusData.json?.statuses) ? statusData.json.statuses : [];
  const vercelStatus = statuses.find((entry) => String(entry?.context || '').trim().toLowerCase().startsWith('vercel')) || null;
  const state = String(vercelStatus?.state || '').trim().toLowerCase();
  let targetHost = null;
  try { targetHost = vercelStatus?.target_url ? new URL(vercelStatus.target_url).hostname : null; } catch { targetHost = null; }

  let outcome = OUTCOME.UNKNOWN;
  let summary = 'No exact-head Vercel commit status was available from GitHub.';
  if (statusData.observation.status !== 200) {
    summary = `GitHub could not provide exact-head Vercel status evidence (HTTP ${statusData.observation.status || 'unknown'}).`;
  } else if (state === 'success') {
    outcome = OUTCOME.PASS;
    summary = 'GitHub reports a successful Vercel status for the exact current head; direct Vercel configuration metadata remains unverified.';
  } else if (state === 'pending') {
    outcome = OUTCOME.WARN;
    summary = 'The exact-current-head Vercel status is still pending.';
  } else if (['failure', 'error'].includes(state)) {
    outcome = OUTCOME.FAIL;
    summary = `The exact-current-head Vercel status is ${state}.`;
  }

  return result({
    id: 'VERCEL-SOURCE-IDENTITY',
    workflowId: 'VERCEL-DRIFT-02',
    title: 'Vercel Production source identity',
    domain: 'vercel',
    severity: SEVERITY.P1,
    outcome,
    summary,
    evidence: [{
      id: 'VERCEL-GITHUB-COMMIT-STATUS',
      source: 'github',
      repository: WEBSITE_REPOSITORY,
      expected_git_sha: expectedGitSha,
      response_status: statusData.observation.status || null,
      matching_context: vercelStatus?.context || null,
      state: state || null,
      target_host: targetHost,
      direct_vercel_api_used: false,
      direct_environment_metadata_collected: false,
    }],
    remediation: outcome === OUTCOME.PASS ? null : {
      proposed_changes: ['Confirm the Vercel status attached to the exact GitHub head and independently verify the Production alias/runtime.'],
      prohibited_actions: ['Do not manually redeploy solely to change the watchdog result.'],
    },
  });
}

function targetsProduction(entry) {
  const target = entry?.target;
  if (Array.isArray(target)) return target.includes('production');
  return target === 'production';
}

export async function vercelContracts({ fetchImpl = globalThis.fetch, env = process.env, expectedGitSha = null } = {}) {
  const token = env.USDIMPACT_WATCHDOG_VERCEL_TOKEN || '';
  const projectId = env.USDIMPACT_WATCHDOG_VERCEL_PROJECT_ID || '';
  const teamId = env.USDIMPACT_WATCHDOG_VERCEL_TEAM_ID || '';
  if (!token || !projectId || !teamId) {
    return [
      await githubStatusSourceIdentity({ fetchImpl, env, expectedGitSha }),
      configurationUnknown(),
    ];
  }

  const headers = { Authorization: `Bearer ${token}` };
  const suffix = `teamId=${encodeURIComponent(teamId)}`;
  const [projectData, deploymentsData, envData] = await Promise.all([
    jsonRequest({ fetchImpl, url: `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}?${suffix}`, headers }),
    jsonRequest({ fetchImpl, url: `https://api.vercel.com/v13/deployments?projectId=${encodeURIComponent(projectId)}&target=production&limit=5&${suffix}`, headers }),
    jsonRequest({ fetchImpl, url: `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?decrypt=false&${suffix}`, headers }),
  ]);

  const latest = deploymentsData.json?.deployments?.[0] || projectData.json?.latestDeployment || null;
  const deploymentSha = latest?.meta?.githubCommitSha || latest?.gitSource?.sha || null;
  const ready = ['READY', 'ready'].includes(latest?.state || latest?.readyState);
  let sourceOutcome = OUTCOME.PASS;
  let sourceSummary = 'Latest Vercel Production deployment is READY and source identity is coherent.';
  if (!latest || projectData.observation.status !== 200) {
    sourceOutcome = OUTCOME.UNKNOWN;
    sourceSummary = 'Vercel project or Production deployment evidence could not be collected.';
  } else if (!ready) {
    sourceOutcome = OUTCOME.FAIL;
    sourceSummary = `Latest Production deployment is not READY (${latest?.state || latest?.readyState || 'unknown'}).`;
  } else if (expectedGitSha && deploymentSha && deploymentSha !== expectedGitSha) {
    sourceOutcome = OUTCOME.FAIL;
    sourceSummary = 'Vercel Production source does not match the expected GitHub head.';
  } else if (expectedGitSha && !deploymentSha) {
    sourceOutcome = OUTCOME.WARN;
    sourceSummary = 'Production is READY, but its Git SHA is unavailable for reconciliation.';
  }

  const entries = Array.isArray(envData.json?.envs) ? envData.json.envs : [];
  const productionEntries = entries.filter(targetsProduction);
  const productionNames = new Set(productionEntries.map((entry) => String(entry?.key || '')).filter(Boolean));
  const missing = GOVERNED_PRODUCTION_VARIABLE_NAMES.filter((name) => !productionNames.has(name));
  const providerReturnedValueFields = productionEntries.some((entry) => Object.prototype.hasOwnProperty.call(entry || {}, 'value'));
  const envOutcome = envData.observation.status !== 200 ? OUTCOME.UNKNOWN : (missing.length ? OUTCOME.WARN : OUTCOME.PASS);

  return [
    result({
      id: 'VERCEL-SOURCE-IDENTITY',
      workflowId: 'VERCEL-DRIFT-02',
      title: 'Vercel Production source identity',
      domain: 'vercel',
      severity: SEVERITY.P1,
      outcome: sourceOutcome,
      summary: sourceSummary,
      evidence: [{
        id: 'VERCEL-PRODUCTION',
        source: 'vercel',
        project_name: projectData.json?.name || null,
        latest_deployment_id: latest?.uid || latest?.id || null,
        latest_deployment_state: latest?.state || latest?.readyState || null,
        deployment_git_sha: deploymentSha,
        expected_git_sha: expectedGitSha,
        source_matches: expectedGitSha && deploymentSha ? expectedGitSha === deploymentSha : null,
        deployment_api_version: 'v13',
        request_methods: ['GET'],
      }],
    }),
    result({
      id: 'VERCEL-CONFIG-PRESENCE',
      workflowId: 'VERCEL-DRIFT-02',
      title: 'Vercel Production required-variable presence',
      domain: 'vercel',
      severity: SEVERITY.P1,
      outcome: envOutcome,
      summary: envOutcome === OUTCOME.PASS
        ? 'Governed Production variable names are present; decryption was disabled and values were ignored.'
        : (envOutcome === OUTCOME.WARN
          ? `Governed Production names are missing: ${missing.join(', ')}.`
          : 'Vercel environment metadata could not be inspected.'),
      evidence: [{
        id: 'VERCEL-ENV-METADATA',
        source: 'vercel',
        response_status: envData.observation.status || null,
        environment_api_version: 'v10',
        decrypt_requested: false,
        production_variable_count: productionNames.size,
        required_variable_names: GOVERNED_PRODUCTION_VARIABLE_NAMES,
        missing_variable_names: missing,
        provider_returned_value_fields: providerReturnedValueFields,
        value_fields_used_for_contract: false,
        values_persisted: false,
        request_methods: ['GET'],
      }],
      remediation: envOutcome === OUTCOME.PASS ? null : {
        proposed_changes: envOutcome === OUTCOME.WARN
          ? ['Verify the governed Production variable-name contract and add any genuinely missing names only through a separately approved Vercel configuration change.']
          : ['Provision a dedicated Vercel credential with the minimum read access available for the target project and rerun read-only evidence collection.'],
        prohibited_actions: [
          'Do not reuse the general Production Vercel credential solely to remove UNKNOWN.',
          'Do not request decrypted environment-variable values for presence checks.',
        ],
      },
    }),
  ];
}
