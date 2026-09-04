import { OUTCOME, SEVERITY, result } from './integrity-watchdog-policy.mjs';
import { observe } from './integrity-watchdog-http.mjs';

const EXPECTED_REQUIRED_CONTEXTS = Object.freeze(['validate-and-build', 'Dependency review']);

async function jsonRequest(args) {
  const observation = await observe(args);
  if (!observation.ok) return { observation, json: null };
  try { return { observation, json: JSON.parse(observation.body) }; } catch { return { observation, json: null }; }
}

function missingProvider({ id, workflowId, title, domain, severity, names }) {
  return result({ id, workflowId, title, domain, severity, outcome: OUTCOME.UNKNOWN, summary: `${title}: dedicated read-only provider configuration is unavailable.`, evidence: [{ id: `${id}-CONFIG`, source: 'environment', configured: false, required_environment_names: names }], remediation: { proposed_changes: ['Provision a dedicated least-privilege read-only credential and identifiers through the approved secret store.'], prohibited_actions: ['Do not reuse a write-capable Production credential solely to remove UNKNOWN.'] } });
}

function rulesetAppliesToBranch(ruleset, branch) {
  const refName = ruleset?.conditions?.ref_name || {};
  const include = Array.isArray(refName.include) ? refName.include : [];
  const exclude = Array.isArray(refName.exclude) ? refName.exclude : [];
  const exactNames = new Set([branch, `refs/heads/${branch}`]);
  const matches = (value) => value === '~ALL' || value === '~DEFAULT_BRANCH' || exactNames.has(value);
  return include.some(matches) && !exclude.some(matches);
}

function analyzeRulesets(details, branch) {
  const applicable = details.filter((entry) => entry?.enforcement === 'active' && entry?.target === 'branch' && rulesetAppliesToBranch(entry, branch));
  const requiredContexts = new Set();
  let pullRequestRequired = false;
  let reviewThreadResolutionRequired = false;
  let deletionProtected = false;
  let nonFastForwardProtected = false;
  let strictRequiredStatusChecks = false;
  let bypassActorCount = 0;
  const currentUserCanBypass = new Set();

  for (const ruleset of applicable) {
    bypassActorCount += Array.isArray(ruleset?.bypass_actors) ? ruleset.bypass_actors.length : 0;
    if (ruleset?.current_user_can_bypass) currentUserCanBypass.add(String(ruleset.current_user_can_bypass));
    const rules = Array.isArray(ruleset?.rules) ? ruleset.rules : [];
    for (const rule of rules) {
      if (rule?.type === 'deletion') deletionProtected = true;
      if (rule?.type === 'non_fast_forward') nonFastForwardProtected = true;
      if (rule?.type === 'pull_request') {
        pullRequestRequired = true;
        if (rule?.parameters?.required_review_thread_resolution === true) reviewThreadResolutionRequired = true;
      }
      if (rule?.type === 'required_status_checks') {
        if (rule?.parameters?.strict_required_status_checks_policy === true) strictRequiredStatusChecks = true;
        const checks = Array.isArray(rule?.parameters?.required_status_checks) ? rule.parameters.required_status_checks : [];
        for (const check of checks) {
          if (check?.context) requiredContexts.add(String(check.context));
        }
      }
    }
  }

  const expectedContextsPresent = EXPECTED_REQUIRED_CONTEXTS.every((context) => requiredContexts.has(context));
  const bypassAllowed = [...currentUserCanBypass].some((value) => value !== 'never');
  const protectedEnough = applicable.length > 0
    && expectedContextsPresent
    && strictRequiredStatusChecks
    && pullRequestRequired
    && reviewThreadResolutionRequired
    && deletionProtected
    && nonFastForwardProtected
    && bypassActorCount === 0
    && !bypassAllowed;

  return {
    applicable,
    requiredContexts: [...requiredContexts].sort(),
    expectedContextsPresent,
    pullRequestRequired,
    reviewThreadResolutionRequired,
    deletionProtected,
    nonFastForwardProtected,
    strictRequiredStatusChecks,
    bypassActorCount,
    currentUserCanBypass: [...currentUserCanBypass].sort(),
    protectedEnough,
  };
}

async function rulesetProtection({ fetchImpl, headers, repository, branch, legacyStatus }) {
  const rulesetsData = await jsonRequest({ fetchImpl, url: `https://api.github.com/repos/${repository}/rulesets`, headers });
  if (rulesetsData.observation.status !== 200) {
    return {
      outcome: OUTCOME.UNKNOWN,
      summary: 'Legacy branch protection and repository ruleset evidence are unavailable to this connection.',
      evidence: [{
        id: 'GITHUB-PROTECTION-EVIDENCE',
        source: 'github',
        protection_source: 'unavailable',
        branch_protection_response_status: legacyStatus || null,
        rulesets_response_status: rulesetsData.observation.status || null,
      }],
    };
  }

  const listed = Array.isArray(rulesetsData.json) ? rulesetsData.json : [];
  const candidates = listed.filter((entry) => entry?.target === 'branch' && entry?.enforcement === 'active' && entry?.id).slice(0, 10);
  if (!candidates.length) {
    return {
      outcome: OUTCOME.WARN,
      summary: 'Repository rulesets are readable, but no active branch ruleset is available for default-branch verification.',
      evidence: [{
        id: 'GITHUB-RULESET-PROTECTION',
        source: 'github',
        protection_source: 'ruleset',
        branch_protection_response_status: legacyStatus || null,
        rulesets_response_status: 200,
        active_branch_ruleset_count: 0,
      }],
    };
  }

  const detailResponses = await Promise.all(candidates.map((entry) => jsonRequest({
    fetchImpl,
    url: `https://api.github.com/repos/${repository}/rulesets/${encodeURIComponent(entry.id)}`,
    headers,
  })));
  const details = detailResponses.filter((entry) => entry.observation.status === 200 && entry.json).map((entry) => entry.json);
  if (!details.length) {
    return {
      outcome: OUTCOME.UNKNOWN,
      summary: 'Repository rulesets were listed, but their active branch-rule details could not be read.',
      evidence: [{
        id: 'GITHUB-RULESET-PROTECTION',
        source: 'github',
        protection_source: 'ruleset',
        branch_protection_response_status: legacyStatus || null,
        rulesets_response_status: 200,
        active_branch_ruleset_count: candidates.length,
        readable_ruleset_detail_count: 0,
      }],
    };
  }

  const analysis = analyzeRulesets(details, branch);
  const outcome = analysis.protectedEnough ? OUTCOME.PASS : OUTCOME.WARN;
  const summary = analysis.protectedEnough
    ? 'Active default-branch ruleset evidence confirms required checks, PR enforcement, resolved review threads, and destructive-ref protections.'
    : 'Default-branch rulesets were read, but one or more expected protection controls are not affirmative.';

  return {
    outcome,
    summary,
    evidence: [{
      id: 'GITHUB-RULESET-PROTECTION',
      source: 'github',
      protection_source: 'ruleset',
      branch_protection_response_status: legacyStatus || null,
      rulesets_response_status: 200,
      active_branch_ruleset_count: candidates.length,
      readable_ruleset_detail_count: details.length,
      applicable_ruleset_count: analysis.applicable.length,
      applicable_ruleset_ids: analysis.applicable.map((entry) => entry.id),
      required_contexts: analysis.requiredContexts,
      expected_required_contexts: [...EXPECTED_REQUIRED_CONTEXTS],
      expected_contexts_present: analysis.expectedContextsPresent,
      pull_request_required: analysis.pullRequestRequired,
      review_thread_resolution_required: analysis.reviewThreadResolutionRequired,
      strict_required_status_checks: analysis.strictRequiredStatusChecks,
      force_push_protected: analysis.nonFastForwardProtected,
      deletion_protected: analysis.deletionProtected,
      bypass_actor_count: analysis.bypassActorCount,
      current_user_can_bypass: analysis.currentUserCanBypass,
    }],
  };
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

  let protectionOutcome = OUTCOME.UNKNOWN;
  let protectionSummary = 'Branch-protection evidence is unavailable to this connection.';
  let protectionEvidence;
  if (protectionData.observation.status === 200) {
    const contexts = protectionData.json?.required_status_checks?.contexts || [];
    const expectedContextsPresent = EXPECTED_REQUIRED_CONTEXTS.every((context) => contexts.includes(context));
    const protectedEnough = expectedContextsPresent
      && Boolean(protectionData.json?.required_pull_request_reviews)
      && protectionData.json?.allow_force_pushes?.enabled !== true
      && protectionData.json?.allow_deletions?.enabled !== true;
    protectionOutcome = protectedEnough ? OUTCOME.PASS : OUTCOME.WARN;
    protectionSummary = protectedEnough ? 'Main has the expected required checks, review protection, and destructive-ref protections.' : 'Branch protection was read, but one or more expected controls are not affirmative.';
    protectionEvidence = [{
      id: 'GITHUB-BRANCH-PROTECTION',
      source: 'github',
      protection_source: 'legacy_branch_protection',
      response_status: 200,
      required_contexts: contexts,
      expected_required_contexts: [...EXPECTED_REQUIRED_CONTEXTS],
      expected_contexts_present: expectedContextsPresent,
      required_pull_request_reviews: Boolean(protectionData.json?.required_pull_request_reviews),
      force_push_allowed: protectionData.json?.allow_force_pushes?.enabled === true,
      deletion_allowed: protectionData.json?.allow_deletions?.enabled === true,
    }];
  } else {
    const fallback = await rulesetProtection({ fetchImpl, headers, repository, branch, legacyStatus: protectionData.observation.status });
    protectionOutcome = fallback.outcome;
    protectionSummary = fallback.summary;
    protectionEvidence = fallback.evidence;
  }

  return [
    result({ id: 'GITHUB-CURRENT-HEAD-QUALITY', workflowId: 'GITHUB-CHANGE-01', title: 'Current-head GitHub quality state', domain: 'github', severity: SEVERITY.P0, outcome: qualityOutcome, summary: qualitySummary, evidence: [{ id: 'GITHUB-QUALITY-RUN', source: 'github', repository, branch, head_sha: head, run_id: exact?.id || null, status: exact?.status || null, conclusion: exact?.conclusion || null }], goldEligible: true }),
    result({ id: 'GITHUB-REQUIRED-CHECKS', workflowId: 'GITHUB-CHANGE-01', title: 'Main branch required-check protection', domain: 'github', severity: SEVERITY.P1, outcome: protectionOutcome, summary: protectionSummary, evidence: protectionEvidence, goldEligible: true }),
  ];
}
