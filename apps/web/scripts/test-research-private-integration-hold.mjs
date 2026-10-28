import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { auditResearchPrivateIntegrationHold } from './audit-research-private-integration-hold.mjs';

const GATE = {
  version: 1, state: 'hold',
  issue: 'https://github.com/usdimpact/usd-impact-pipeline/issues/155',
  approved_by: null, decision_receipt: null,
};
const VERCEL = {
  git: { deploymentEnabled: { 'agent/*': false } },
  rewrites: [{ source: '/score/member/:path*',
    destination: '/api/account?action=score-member-content&path=:path*' }],
  headers: [{ source: '/score/member/(.*)', headers: [
    { key: 'Cache-Control', value: 'private, no-store' },
    { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  ] }],
};

function write(root, relative, contents) {
  const full = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, typeof contents === 'string' ? contents : JSON.stringify(contents));
  return full;
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'usd-research-hold-synthetic-'));
  write(root, 'governance/score-derived-publication-rights-gate.json', GATE);
  write(root, 'apps/web/vercel.json', VERCEL);
  write(root, 'apps/web/astro.config.mjs', "export default { output: 'static' };");
  write(root, 'apps/web/middleware.js', 'export default () => null;');
  write(root, 'apps/web/src/pages/research/sample/index.astro',
    "---\nconst PUBLIC_SAMPLE_DATE = '2026-08-07';\nconst PUBLIC_SAMPLE_MIN_AGE_DAYS = 30;\n---\n");
  write(root, 'apps/web/src/lib/placeholder.js', 'export const safe = true;');
  write(root, 'apps/web/api/account.js', "export const action = 'score-member-content';");
  for (const script of [
    'research-private-report-synthetic-contract.mjs',
    'research-private-report-synthetic-origin.mjs',
    'audit-research-private-public-build.mjs',
    'audit-research-report-inventory.mjs',
  ]) write(root, 'apps/web/scripts/' + script, '// safe fixture\n');
  return root;
}
async function mutation(change, expected) {
  const root = fixture();
  try {
    change(root);
    const result = auditResearchPrivateIntegrationHold({ root });
    assert.equal(result.status, 'HOLD');
    assert.equal(result.rightsState, 'HOLD');
    assert.equal(result.releaseAuthorized, false);
    assert.ok(result.findings.includes(expected), JSON.stringify(result.findings));
    assert.ok(result.findings.every(s => /^[a-z-]+$/.test(s)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('safe held configuration remains non-activating without authorizing release', () => {
  const root = fixture();
  try {
    const result = auditResearchPrivateIntegrationHold({ root });
    assert.equal(result.status, 'SAFETY_PASS');
    assert.deepEqual(result.findings, []);
    assert.equal(result.rightsState, 'HOLD');
    assert.equal(result.releaseAuthorized, false);
    assert.ok(result.checkedRuntimeFiles >= 4);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('rights approval, issue mutation and missing gate stop safe integration', async () => {
  await mutation(root => write(root, 'governance/score-derived-publication-rights-gate.json',
    { ...GATE, state: 'allow' }), 'rights-hold-changed-without-separate-review');
  await mutation(root => write(root, 'governance/score-derived-publication-rights-gate.json',
    { ...GATE, approved_by: 'fabricated-reviewer' }), 'rights-hold-changed-without-separate-review');
  await mutation(root => write(root, 'governance/score-derived-publication-rights-gate.json',
    { ...GATE, issue: 'https://github.com/example/issue' }),
  'rights-hold-changed-without-separate-review');
  await mutation(root => fs.rmSync(path.join(root,
    'governance/score-derived-publication-rights-gate.json')), 'rights-gate-missing-or-invalid');
});

test('private report rewrites and API actions cannot be activated', async () => {
  for (const route of [
    { source: '/research/member/reports/:path*',
      destination: '/api/account?action=research-report-content' },
    { source: '/api/research-report', destination: '/api/account?action=research-report-content' },
    { source: '/preview/reports', destination: '/api/account?action=research-private-report' },
  ]) {
    await mutation(root => write(root, 'apps/web/vercel.json',
      { ...VERCEL, rewrites: [...VERCEL.rewrites, route] }),
    'private-research-route-activated');
  }
  await mutation(root => write(root, 'apps/web/api/account.js',
    "const action = 'research-report-content';"), 'private-report-runtime-action-activated');
});

test('draft auto-deploy, existing Score protection or private headers cannot change', async () => {
  await mutation(root => write(root, 'apps/web/vercel.json', {
    ...VERCEL, git: { deploymentEnabled: { 'agent/*': true } },
  }), 'agent-draft-auto-deployment-not-disabled');
  await mutation(root => write(root, 'apps/web/vercel.json', {
    ...VERCEL, rewrites: [],
  }), 'score-protected-rewrite-changed');
  await mutation(root => write(root, 'apps/web/vercel.json', {
    ...VERCEL, headers: [],
  }), 'score-private-headers-changed');
});

test('private public-source directories and new report functions are blocked', async () => {
  for (const dir of [
    'apps/web/src/pages/research/member/reports',
    'apps/web/public/research/member/reports',
    'apps/web/src/content/research-private-reports',
    'apps/web/src/content/member-reports',
  ]) {
    await mutation(root => write(root, dir + '/fabricated-placeholder.txt', 'synthetic'),
      'private-research-public-source-created');
  }
  await mutation(root => write(root, 'apps/web/api/research-report.js',
    'export default () => null;'), 'unapproved-private-report-api-function');
});

test('synthetic modules and release-candidate policy cannot enter runtime', async () => {
  for (const statement of [
    "import '../../../scripts/research-private-report-synthetic-contract.mjs';",
    "import '../../../scripts/research-private-report-synthetic-origin.mjs';",
    "import './research-report-publication-boundary.js';",
    "import '../../../scripts/audit-research-private-public-build.mjs';",
  ]) {
    await mutation(root => write(root, 'apps/web/src/lib/unsafe-loader.js', statement),
      'synthetic-or-candidate-imported-into-runtime');
  }
  await mutation(root => write(root, 'apps/web/middleware.js',
    "const privateRoute = '/research/member/reports/weekly/2026-11-06';"),
  'private-research-middleware-activated');
});

test('static Astro and approved historical public sample remain unchanged', async () => {
  await mutation(root => write(root, 'apps/web/astro.config.mjs',
    "export default { output: 'server' };"), 'astro-static-mode-changed');
  await mutation(root => write(root, 'apps/web/src/pages/research/sample/index.astro',
    "---\nconst PUBLIC_SAMPLE_DATE = '2026-10-23';\n---\n"),
  'public-sample-contract-changed');
});

test('missing or unreadable test-only guards and runtime trees fail closed', async () => {
  await mutation(root => fs.rmSync(path.join(root,
    'apps/web/scripts/research-private-report-synthetic-origin.mjs')),
  'security-script-missing');
  await mutation(root => fs.rmSync(path.join(root, 'apps/web/api'), { recursive: true }),
    'runtime-tree-missing-or-unreadable');
});

test('symlinked runtime source never bypasses the audit', async () => {
  await mutation(root => fs.symlinkSync(path.join(root, 'apps/web/api/account.js'),
    path.join(root, 'apps/web/src/lib/synthetic-link.js')), 'runtime-tree-symlink');
});

test('finding codes are privacy safe even if source contains fabricated secrets', async () => {
  await mutation(root => write(root, 'apps/web/src/lib/unsafe-loader.js',
    "const fakeSecret = 'synthetic-only';\nimport '../../../scripts/research-private-report-synthetic-origin.mjs';"),
  'synthetic-or-candidate-imported-into-runtime');
});
