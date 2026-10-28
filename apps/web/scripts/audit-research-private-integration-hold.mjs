// Read-only integration tripwire: no private Research activation while rights HOLD.
// Does not grant access, provision resources, change the database, or approve release.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const RUNTIME_DIRS = ['apps/web/src/pages', 'apps/web/src/lib', 'apps/web/api'];
const RUNTIME_FILES = ['apps/web/middleware.js', 'apps/web/astro.config.mjs'];
const REQUIRED_SCRIPTS = [
  'research-private-report-synthetic-contract.mjs',
  'research-private-report-synthetic-origin.mjs',
  'audit-research-private-public-build.mjs',
  'audit-research-report-inventory.mjs',
];
const FORBIDDEN_RUNTIME_IMPORT =
  /research-private-report-synthetic-(?:origin|contract)(?:\.mjs)?|research-report-publication-boundary\.js|audit-research-private-public-build\.mjs/;
const FORBIDDEN_RUNTIME_ACTION =
  /research[-_]report[-_]content|researchPrivateReport(?:Delivery|Content)|RESEARCH_PRIVATE_REPORT_DELIVERY_ENABLED\s*[:=]\s*['"]?true/;

function readSource(root, relative, issues, issue) {
  try {
    const full = path.join(root, relative);
    const stat = fs.lstatSync(full);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_SOURCE_BYTES) {
      throw new Error('not-regular-source');
    }
    return fs.readFileSync(full, 'utf8');
  } catch {
    issues.add(issue);
    return null;
  }
}

function readJson(root, relative, issues, issue) {
  const s = readSource(root, relative, issues, issue);
  if (s == null) return null;
  try {
    const obj = JSON.parse(s);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('not-object');
    return obj;
  } catch {
    issues.add(issue);
    return null;
  }
}

function walkRuntime(root, relative, issues) {
  const files = [];
  function visit(next, depth) {
    if (depth > 32) {
      issues.add('runtime-tree-too-deep');
      return;
    }
    let entries;
    try { entries = fs.readdirSync(path.join(root, next), { withFileTypes: true }); }
    catch {
      issues.add('runtime-tree-missing-or-unreadable');
      return;
    }
    for (const entry of entries) {
      const rel = path.join(next, entry.name);
      if (entry.isSymbolicLink()) {
        issues.add('runtime-tree-symlink');
      } else if (entry.isDirectory()) {
        visit(rel, depth + 1);
      } else if (entry.isFile() && /\.(?:js|mjs|ts|tsx|jsx|astro)$/.test(entry.name)) {
        files.push(rel);
      } else if (!entry.isFile()) {
        issues.add('runtime-tree-unsupported-type');
      }
    }
  }
  visit(relative, 0);
  return files;
}

export function auditResearchPrivateIntegrationHold({ root = ROOT } = {}) {
  const issues = new Set();
  const gate = readJson(root, 'governance/score-derived-publication-rights-gate.json',
    issues, 'rights-gate-missing-or-invalid');
  if (gate && (gate.state !== 'hold' ||
    gate.issue !== 'https://github.com/usdimpact/usd-impact-pipeline/issues/155' ||
    gate.decision_receipt != null || gate.approved_by != null)) {
    issues.add('rights-hold-changed-without-separate-review');
  }
  const vercel = readJson(root, 'apps/web/vercel.json',
    issues, 'vercel-config-missing-or-invalid');
  if (vercel) {
    if (vercel.git?.deploymentEnabled?.['agent/*'] !== false) {
      issues.add('agent-draft-auto-deployment-not-disabled');
    }
    if (!Array.isArray(vercel.rewrites)) {
      issues.add('vercel-rewrites-invalid');
    } else {
      const active = vercel.rewrites.some(row => {
        const src = String(row?.source || '').toLowerCase();
        const dst = String(row?.destination || '').toLowerCase();
        return src.includes('/research/member') ||
          src.startsWith('/api/research-report') ||
          dst.includes('/research/member') ||
          dst.includes('research-report-content') ||
          dst.includes('research-private-report');
      });
      if (active) issues.add('private-research-route-activated');
      const score = vercel.rewrites.some(row =>
        row.source === '/score/member/:path*' &&
        row.destination === '/api/account?action=score-member-content&path=:path*');
      if (!score) issues.add('score-protected-rewrite-changed');
    }
    const scoreHeader = (vercel.headers || []).find(row => row.source === '/score/member/(.*)');
    const headers = new Map((scoreHeader?.headers || []).map(row =>
      [String(row.key).toLowerCase(), row.value]));
    if (headers.get('cache-control') !== 'private, no-store' ||
        headers.get('x-robots-tag') !== 'noindex, nofollow') {
      issues.add('score-private-headers-changed');
    }
  }
  const astro = readSource(root, 'apps/web/astro.config.mjs',
    issues, 'astro-config-missing');
  if (astro != null && !/output:\s*['"]static['"]/.test(astro)) {
    issues.add('astro-static-mode-changed');
  }
  const sample = readSource(root, 'apps/web/src/pages/research/sample/index.astro',
    issues, 'public-sample-source-missing');
  if (sample != null &&
    (!sample.includes("PUBLIC_SAMPLE_DATE = '2026-08-07'") ||
     !sample.includes('PUBLIC_SAMPLE_MIN_AGE_DAYS = 30'))) {
    issues.add('public-sample-contract-changed');
  }
  for (const script of REQUIRED_SCRIPTS) {
    readSource(root, 'apps/web/scripts/' + script, issues, 'security-script-missing');
  }
  for (const relative of [
    'apps/web/src/pages/research/member',
    'apps/web/public/research/member',
    'apps/web/src/content/research-private-reports',
    'apps/web/src/content/member-reports',
    'apps/web/src/content/private-research-reports',
  ]) {
    if (fs.existsSync(path.join(root, relative))) {
      issues.add('private-research-public-source-created');
    }
  }
  const middleware = readSource(root, 'apps/web/middleware.js',
    issues, 'middleware-missing');
  if (middleware?.includes('/research/member')) {
    issues.add('private-research-middleware-activated');
  }

  const runtime = [
    ...RUNTIME_DIRS.flatMap(dir => walkRuntime(root, dir, issues)),
    ...RUNTIME_FILES,
  ];
  if (runtime.length < 3) issues.add('runtime-sources-missing');
  let checkedRuntimeFiles = 0;
  for (const relative of new Set(runtime)) {
    const code = readSource(root, relative, issues, 'runtime-source-unreadable');
    if (code == null) continue;
    checkedRuntimeFiles += 1;
    if (FORBIDDEN_RUNTIME_IMPORT.test(code)) {
      issues.add('synthetic-or-candidate-imported-into-runtime');
    }
    if (FORBIDDEN_RUNTIME_ACTION.test(code)) {
      issues.add('private-report-runtime-action-activated');
    }
    if (/^apps\/web\/api\/research[-_](?:private[-_])?reports?\.js$/i.test(
      relative.split(path.sep).join('/'))) {
      issues.add('unapproved-private-report-api-function');
    }
  }
  const findings = Object.freeze([...issues].sort());
  return Object.freeze({
    status: findings.length === 0 ? 'SAFETY_PASS' : 'HOLD',
    rightsState: 'HOLD',
    releaseAuthorized: false,
    checkedRuntimeFiles,
    findings,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditResearchPrivateIntegrationHold();
  console.log(JSON.stringify(result));
  if (process.argv.includes('--check') && result.status !== 'SAFETY_PASS') process.exitCode = 1;
}
