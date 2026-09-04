import { OUTCOME, SEVERITY, result } from './integrity-watchdog-policy.mjs';
import { jsonRequest, missingProvider } from './integrity-watchdog-provider-common.mjs';

export async function supabaseContracts({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  const token = env.USDIMPACT_WATCHDOG_SUPABASE_ACCESS_TOKEN || '';
  const projectRef = env.USDIMPACT_WATCHDOG_SUPABASE_PROJECT_REF || '';
  if (!token || !projectRef) return [missingProvider({ id: 'SUPABASE-SECURITY-ADVISORS', workflowId: 'SUPABASE-INTEGRITY-01', title: 'Supabase project and Security Advisor state', domain: 'supabase', severity: SEVERITY.P0, names: ['USDIMPACT_WATCHDOG_SUPABASE_ACCESS_TOKEN', 'USDIMPACT_WATCHDOG_SUPABASE_PROJECT_REF'] })];
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const [projectsData, advisorsData] = await Promise.all([
    jsonRequest({ fetchImpl, url: 'https://api.supabase.com/v1/projects', headers }),
    jsonRequest({ fetchImpl, url: `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/advisors/security`, headers }),
  ]);
  const projects = Array.isArray(projectsData.json) ? projectsData.json : [];
  const project = projects.find((entry) => entry.ref === projectRef || entry.id === projectRef) || null;
  const advisors = Array.isArray(advisorsData.json) ? advisorsData.json : (advisorsData.json?.lints || []);
  const levels = advisors.map((entry) => String(entry.level || entry.severity || '').toLowerCase());
  const critical = levels.filter((level) => ['error', 'critical'].includes(level)).length;
  const warnings = levels.filter((level) => ['warn', 'warning'].includes(level)).length;
  const outcome = !project || projectsData.observation.status !== 200 || advisorsData.observation.status !== 200 ? OUTCOME.UNKNOWN : (critical ? OUTCOME.FAIL : (warnings ? OUTCOME.WARN : OUTCOME.PASS));
  const summary = outcome === OUTCOME.PASS ? 'Supabase project is visible and Security Advisor reports no critical finding.' : (outcome === OUTCOME.FAIL ? `Security Advisor reports ${critical} critical/error finding(s).` : (outcome === OUTCOME.WARN ? `Security Advisor reports ${warnings} warning(s).` : 'Supabase project or Security Advisor evidence is inconclusive.'));
  return [result({ id: 'SUPABASE-SECURITY-ADVISORS', workflowId: 'SUPABASE-INTEGRITY-01', title: 'Supabase project and Security Advisor state', domain: 'supabase', severity: SEVERITY.P0, outcome, summary, evidence: [{ id: 'SUPABASE-ADVISORS', source: 'supabase', project_status: project?.status || null, database_version: project?.database?.version || null, advisor_count: advisors.length, critical_count: critical, warning_count: warnings, direct_rls_policy_rows_collected: false }], remediation: { verification_plan: ['Re-run Security Advisor and independently inspect implicated RLS, grants, views, functions, and Storage policies.'], prohibited_actions: ['Do not apply a Production migration automatically.'] } })];
}
