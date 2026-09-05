import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA_VERSION, assertSafeArtifact, compareResults, fixPacket, health, register, sanitize, sha256 } from './integrity-watchdog-policy.mjs';
import { driveContracts, githubContracts, publicContracts, repositoryContracts, resendContracts, supabaseContracts, vercelContracts } from './integrity-watchdog-collectors.mjs';
import { independentReview } from './integrity-watchdog-reviewer.mjs';
import { writeEvidenceArtifacts } from './integrity-watchdog-artifacts.mjs';

const CANONICAL_BASE_URL = 'https://www.usd-impact.com';
const APEX_BASE_URL = 'https://usd-impact.com';
const WEBSITE_REPOSITORY = 'usdimpact/usd-impact-site';
const PRODUCTION_BRANCH = 'main';

function args(argv) {
  const config = {
    scope: process.env.WATCHDOG_SCOPE || 'critical',
    mode: process.env.WATCHDOG_MODE || 'fix_ready',
    aiReview: process.env.WATCHDOG_AI_REVIEW || 'false',
    outputDir: process.env.WATCHDOG_OUTPUT_DIR || 'artifacts/integrity-watchdog',
    workspace: process.cwd(),
  };
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [key, ...rest] = item.slice(2).split('=');
    const value = rest.join('=');
    if (key === 'scope' && value) config.scope = value;
    if (key === 'mode' && value) config.mode = value;
    if (key === 'ai-review' && value) config.aiReview = value;
    if (key === 'output-dir' && value) config.outputDir = value;
    if (key === 'workspace' && value) config.workspace = path.resolve(value);
  }
  if (!['critical', 'full'].includes(config.scope)) throw new Error(`Unsupported scope: ${config.scope}`);
  if (!['audit_only', 'fix_ready'].includes(config.mode)) throw new Error(`Unsupported mode: ${config.mode}`);
  if (!['true', 'false', 'auto'].includes(config.aiReview)) throw new Error(`Unsupported AI review mode: ${config.aiReview}`);
  config.outputDir = path.resolve(config.workspace, config.outputDir);
  return config;
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function classificationCounts(entries) { const counts = {}; for (const entry of entries) counts[entry.current_classification] = (counts[entry.current_classification] || 0) + 1; return counts; }
function escape(value) { return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' '); }
function aiEnabled(mode) { return mode === 'true' || (mode === 'auto' && Boolean(process.env.USDIMPACT_WATCHDOG_OPENAI_API_KEY)); }

function assertCanonicalTargets(policy) {
  const actual = {
    canonical_base_url: policy?.targets?.public_web?.canonical_base_url,
    apex_base_url: policy?.targets?.public_web?.apex_base_url,
    website_repository: policy?.targets?.github?.website_repository,
    production_branch: policy?.targets?.github?.production_branch,
  };
  const expected = {
    canonical_base_url: CANONICAL_BASE_URL,
    apex_base_url: APEX_BASE_URL,
    website_repository: WEBSITE_REPOSITORY,
    production_branch: PRODUCTION_BRANCH,
  };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Policy targets do not match the immutable watchdog network and repository targets.');
  }
}

function markdown(report) {
  const lines = [
    '# USD Impact Integrity Watchdog',
    '',
    `- Generated: ${report.generated_at}`,
    `- Mode: ${report.mode}`,
    `- Scope: ${report.scope}`,
    `- Health: **${report.health.status}**`,
    `- Release gate: **${report.health.release_gate}**`,
    `- Evidence coverage: ${report.health.evidence_coverage_percent}%`,
    `- Material contracts: ${report.health.material_contracts}`,
    `- Fix-ready packets: ${report.fix_ready_packets.length}`,
    '',
    '## Contract results',
    '',
    '| Severity | Contract | Outcome | Classification | Summary |',
    '|---|---|---|---|---|',
  ];
  for (const entry of report.results) lines.push(`| ${entry.severity} | ${escape(entry.id)} | ${entry.outcome} | ${entry.classification} | ${escape(entry.summary)} |`);
  lines.push('', '## Workflow register', '', '| Workflow | Classification | Contracts |', '|---|---|---|');
  for (const workflow of report.workflow_register) lines.push(`| ${escape(workflow.id)} - ${escape(workflow.name)} | ${workflow.current_classification} | ${workflow.contract_ids.join(', ') || 'Not directly tested in this run'} |`);
  if (report.fix_ready_packets.length) {
    lines.push('', '## Fix-ready queue', '');
    for (const packet of report.fix_ready_packets) lines.push(`### ${packet.severity} ${packet.id}`, '', packet.problem_statement, '', `Status: ${packet.status}. Human approval required: ${packet.human_approval_required}.`, '');
  }
  lines.push(
    '## Safety boundary',
    '',
    'This run collected read-only evidence and wrote local artifacts only. It did not merge, deploy, dispatch publication workflows, send email, alter Supabase, mutate customers or entitlements, change payments, rotate secrets, or modify Google Drive.',
    '',
  );
  return `${lines.join('\n')}\n`;
}

async function main() {
  const config = args(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const policy = readJson(path.join(config.workspace, 'docs/operations/integrity-watchdog/POLICY.json'));
  const inventory = readJson(path.join(config.workspace, 'docs/operations/integrity-watchdog/WORKFLOW_INVENTORY.json'));
  if (policy.schema_version !== SCHEMA_VERSION || inventory.schema_version !== SCHEMA_VERSION) throw new Error('Policy or inventory schema mismatch.');
  assertCanonicalTargets(policy);

  const results = repositoryContracts({ workspace: config.workspace });
  const [publicResults, githubResults] = await Promise.all([
    publicContracts({ baseUrl: CANONICAL_BASE_URL, apexUrl: APEX_BASE_URL }),
    githubContracts({ repository: WEBSITE_REPOSITORY, branch: PRODUCTION_BRANCH }),
  ]);
  results.push(...publicResults, ...githubResults);
  if (config.scope === 'full') {
    const expectedGitSha = process.env.GITHUB_SHA || null;
    for (const group of await Promise.all([
      vercelContracts({ expectedGitSha }),
      supabaseContracts(),
      resendContracts(),
      driveContracts(),
    ])) results.push(...group);
  }

  results.sort(compareResults);
  const initialHealth = health(results);
  const initialRegister = register(inventory.workflows, results, generatedAt);
  const packets = config.mode === 'fix_ready'
    ? results.map((entry) => fixPacket(entry, generatedAt)).filter(Boolean)
    : [];
  results.push(await independentReview({
    results,
    projectSummary: {
      generated_at: generatedAt,
      health: initialHealth,
      workflow_classifications: classificationCounts(initialRegister),
    },
    fixReadyPackets: packets,
    enabled: aiEnabled(config.aiReview),
  }));
  results.sort(compareResults);

  const workflowRegister = register(inventory.workflows, results, generatedAt);
  const resendKeyPresent = Boolean(process.env.USDIMPACT_WATCHDOG_RESEND_API_KEY);
  const resendFullAccessApproved = process.env.USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED === 'true';
  const report = sanitize({
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    generated_by: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
    mode: config.mode,
    scope: config.scope,
    policy_version: policy.policy_version,
    policy_digest: sha256(JSON.stringify(policy)),
    inventory_digest: sha256(JSON.stringify(inventory)),
    health: health(results),
    workflow_classification_counts: classificationCounts(workflowRegister),
    results,
    workflow_register: workflowRegister,
    fix_ready_packets: packets,
    provider_configuration: {
      github: Boolean(process.env.GITHUB_TOKEN),
      vercel: Boolean(process.env.USDIMPACT_WATCHDOG_VERCEL_TOKEN),
      supabase: Boolean(process.env.USDIMPACT_WATCHDOG_SUPABASE_ACCESS_TOKEN),
      resend: resendKeyPresent && resendFullAccessApproved,
      resend_api_key_present: resendKeyPresent,
      resend_full_access_approved: resendFullAccessApproved,
      google_drive: Boolean(process.env.USDIMPACT_WATCHDOG_GOOGLE_SERVICE_ACCOUNT_JSON),
      openai_reviewer: Boolean(process.env.USDIMPACT_WATCHDOG_OPENAI_API_KEY),
    },
    safety: {
      external_writes_performed: false,
      email_sent: false,
      deployment_started: false,
      workflow_dispatched: false,
      database_mutated: false,
      customer_or_entitlement_mutated: false,
      drive_content_read: false,
      drive_mutated: false,
      secret_values_persisted: false,
    },
  });
  assertSafeArtifact(report);

  const reportMarkdown = markdown(report);
  writeEvidenceArtifacts({
    outputDir: config.outputDir,
    report,
    workflowRegister,
    results,
    packets,
    generatedAt,
    reportMarkdown,
  });
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, reportMarkdown);
  console.log(`USD Impact watchdog: ${report.health.status}; ${report.health.release_gate}; ${results.length} contracts; ${packets.length} fix-ready packets.`);
  if (report.health.status === 'RED') process.exitCode = 2;
}

main().catch((error) => {
  console.error(`USD Impact integrity watchdog failed closed: ${error?.message || error}`);
  process.exitCode = 1;
});
