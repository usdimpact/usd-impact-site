import assert from 'node:assert/strict';

const required = (name) => {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} is required`);
  return value;
};

const repo = required('GITHUB_REPOSITORY');
const token = required('GITHUB_TOKEN');
const prNumber = Number(required('GATEKEEPER_PR_NUMBER'));
const expectedHead = required('GATEKEEPER_EXPECTED_HEAD').toLowerCase();
const mode = required('GATEKEEPER_MODE');
const evidenceRefs = required('GATEKEEPER_EVIDENCE_REFS');

assert.ok(Number.isInteger(prNumber) && prNumber > 0, 'GATEKEEPER_PR_NUMBER must be a positive integer');
assert.match(expectedHead, /^[0-9a-f]{40}$/, 'GATEKEEPER_EXPECTED_HEAD must be a full 40-character SHA');
assert.ok(['production-promotion', 'checkout-enable'].includes(mode), 'Unsupported gatekeeper mode');
assert.ok(evidenceRefs.length >= 8, 'At least one evidence reference is required');

const attestation = (name) => required(name) === 'verified';
const gates = {
  vercelProductionEnvironment: attestation('GATEKEEPER_VERCEL_PRODUCTION_ENV'),
  paddleLive: attestation('GATEKEEPER_PADDLE_LIVE'),
  productionDataPlane: attestation('GATEKEEPER_PRODUCTION_DATA_PLANE'),
  checkoutClosed: attestation('GATEKEEPER_CHECKOUT_CLOSED'),
  protectedProduction: process.env.GATEKEEPER_PROTECTED_PRODUCTION?.trim() === 'verified',
};

const api = async (path, options = {}) => {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status} for ${path}: ${text.slice(0, 500)}`);
  }
  if (response.status === 204) return null;
  return response.json();
};

const [owner, name] = repo.split('/');
assert.ok(owner && name, 'GITHUB_REPOSITORY must be owner/name');

const pr = await api(`/repos/${owner}/${name}/pulls/${prNumber}`);
const failures = [];

if (pr.state !== 'open') failures.push(`PR is ${pr.state}, not open`);
if (pr.draft !== true) failures.push('PR is not Draft');
if (pr.merged === true || pr.merged_at) failures.push('PR is already merged');
if (pr.base?.ref !== 'main') failures.push(`PR base is ${pr.base?.ref ?? 'unknown'}, not main`);
if (pr.head?.sha?.toLowerCase() !== expectedHead) {
  failures.push(`PR head ${pr.head?.sha ?? 'unknown'} does not match expected ${expectedHead}`);
}

const runs = await api(
  `/repos/${owner}/${name}/actions/runs?event=pull_request&head_sha=${expectedHead}&per_page=100`,
);
const qualityRuns = (runs.workflow_runs ?? [])
  .filter((run) => run.name === 'Web quality')
  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
const quality = qualityRuns[0];
if (!quality) failures.push('No Web quality run found for exact head');
else if (quality.status !== 'completed' || quality.conclusion !== 'success') {
  failures.push(`Web quality is ${quality.status}/${quality.conclusion ?? 'none'}, not completed/success`);
}

if (!gates.vercelProductionEnvironment) failures.push('Vercel Production environment gate is not verified');
if (!gates.paddleLive) failures.push('Paddle Live gate is not verified');
if (!gates.productionDataPlane) failures.push('Production data-plane gate is not verified');
if (!gates.checkoutClosed) failures.push('Checkout CLOSED gate is not verified');
if (mode === 'checkout-enable' && !gates.protectedProduction) {
  failures.push('Protected Production verification is required before checkout approval');
}

const approved = failures.length === 0;
const context = `release-gatekeeper/${mode}`;
const state = approved ? 'success' : 'failure';
const description = approved
  ? mode === 'production-promotion'
    ? 'APPROVED: exact candidate may be promoted with checkout CLOSED'
    : 'APPROVED: checkout may enter controlled enablement test'
  : `BLOCKED: ${failures.length} release gate${failures.length === 1 ? '' : 's'} unresolved`;

await api(`/repos/${owner}/${name}/statuses/${expectedHead}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ state, context, description: description.slice(0, 140) }),
});

const lines = [
  `### Release Gatekeeper — ${approved ? 'APPROVED' : 'BLOCKED'}`,
  '',
  `- mode: \`${mode}\``,
  `- exact head: \`${expectedHead}\``,
  `- Web quality: ${quality ? `#${quality.run_number} ${quality.status}/${quality.conclusion ?? 'none'}` : 'not found'}`,
  `- Vercel Production environment: ${gates.vercelProductionEnvironment ? 'VERIFIED' : 'UNVERIFIED'}`,
  `- Paddle Live: ${gates.paddleLive ? 'VERIFIED' : 'UNVERIFIED'}`,
  `- Production data plane: ${gates.productionDataPlane ? 'VERIFIED' : 'UNVERIFIED'}`,
  `- checkout CLOSED: ${gates.checkoutClosed ? 'VERIFIED' : 'UNVERIFIED'}`,
  `- protected Production: ${gates.protectedProduction ? 'VERIFIED' : 'UNVERIFIED'}`,
  `- evidence: ${evidenceRefs}`,
  '',
];

if (approved) {
  lines.push(
    mode === 'production-promotion'
      ? '**Approval scope:** Production promotion of this exact SHA only, with checkout remaining CLOSED. This does not authorize checkout enablement or a real charge.'
      : '**Approval scope:** controlled checkout enablement test for this exact SHA only. This does not authorize unattended rollout or bypass post-transaction entitlement verification.',
  );
} else {
  lines.push('**Blocking reasons:**');
  for (const failure of failures) lines.push(`- ${failure}`);
}

lines.push('', '_Gatekeeper is fail-closed. It does not merge, deploy, change environment variables, enable checkout, or create a Paddle transaction._');

await api(`/repos/${owner}/${name}/issues/${prNumber}/comments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ body: lines.join('\n') }),
});

console.log(`${approved ? 'APPROVED' : 'BLOCKED'} ${context} for ${expectedHead}`);
if (!approved) process.exitCode = 1;
