import assert from 'node:assert/strict';
import { evaluateReleaseGatekeeper } from './release-gatekeeper-policy.mjs';

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
const runs = await api(`/repos/${owner}/${name}/actions/runs?event=pull_request&head_sha=${expectedHead}&per_page=100`);
const quality = (runs.workflow_runs ?? [])
  .filter((run) => run.name === 'Web quality')
  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

const { approved, failures } = evaluateReleaseGatekeeper({
  mode,
  pr,
  expectedHead,
  quality,
  gates,
});

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
