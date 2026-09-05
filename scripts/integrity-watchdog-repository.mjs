import fs from 'node:fs';
import path from 'node:path';
import { OUTCOME, SEVERITY, result } from './integrity-watchdog-policy.mjs';

function walk(root, predicate = () => true) {
  if (!fs.existsSync(root)) return [];
  const found = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const current = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...walk(current, predicate));
    else if (entry.isFile() && predicate(current)) found.push(current);
  }
  return found;
}

function workflowWriteScopes(text) {
  const writes = new Set();
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)permissions\s*:\s*([^#]*)/i);
    if (!match) continue;
    const baseIndent = match[1].length;
    const tail = match[2].trim();
    if (/^write-all$/i.test(tail)) writes.add('*');
    for (const inline of tail.matchAll(/([A-Za-z0-9_-]+)\s*:\s*write\b/gi)) writes.add(inline[1]);
    if (tail && tail !== '{}') continue;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (!line.trim() || /^\s*#/.test(line)) continue;
      const indent = line.match(/^\s*/)?.[0].length || 0;
      if (indent <= baseIndent) break;
      const grant = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*write\s*(?:#.*)?$/i);
      if (grant) writes.add(grant[1]);
    }
  }
  return [...writes].sort();
}

function loadWriteBaseline(workspace) {
  const root = path.join(workspace, 'docs', 'operations', 'integrity-watchdog');
  const policyFile = path.join(root, 'POLICY.json');
  const baselineFile = path.join(root, 'GITHUB_PERMISSION_BASELINE.json');
  if (!fs.existsSync(baselineFile)) {
    return fs.existsSync(policyFile)
      ? { enforced: true, version: null, expected: {}, error: 'GITHUB_PERMISSION_BASELINE.json is missing.' }
      : { enforced: false, version: null, expected: {}, error: null };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    if (parsed.schema_version !== 1 || !parsed.expected_write_permissions || typeof parsed.expected_write_permissions !== 'object' || Array.isArray(parsed.expected_write_permissions)) {
      throw new Error('invalid schema');
    }
    const expected = {};
    for (const [file, scopes] of Object.entries(parsed.expected_write_permissions)) {
      if (!Array.isArray(scopes) || scopes.some((scope) => typeof scope !== 'string' || !scope)) throw new Error(`invalid scopes for ${file}`);
      expected[file] = [...new Set(scopes)].sort();
    }
    return { enforced: true, version: parsed.baseline_version || null, expected, error: null };
  } catch (error) {
    return { enforced: true, version: null, expected: {}, error: `Invalid GITHUB_PERMISSION_BASELINE.json: ${error.message}` };
  }
}

function permissionDrift(actual, baseline) {
  if (!baseline.enforced) return { unexpected: [], missing: [] };
  const actualPairs = new Set();
  const expectedPairs = new Set();
  for (const [file, scopes] of Object.entries(actual)) for (const scope of scopes) if (scope !== '*') actualPairs.add(`${file} :: ${scope}`);
  for (const [file, scopes] of Object.entries(baseline.expected)) for (const scope of scopes) expectedPairs.add(`${file} :: ${scope}`);
  return {
    unexpected: [...actualPairs].filter((item) => !expectedPairs.has(item)).sort(),
    missing: [...expectedPairs].filter((item) => !actualPairs.has(item)).sort(),
  };
}

export function repositoryContracts({ workspace = process.cwd() } = {}) {
  const workflows = walk(path.join(workspace, '.github', 'workflows'), (file) => /\.ya?ml$/i.test(file));
  const pullRequestTarget = [];
  const writeAll = [];
  const unpinned = [];
  const writePermissions = {};
  for (const file of workflows) {
    const relative = path.relative(workspace, file).replaceAll(path.sep, '/');
    const text = fs.readFileSync(file, 'utf8');
    if (/\bpull_request_target\s*:/m.test(text)) pullRequestTarget.push(relative);
    if (/^\s*permissions\s*:\s*write-all\s*$/mi.test(text)) writeAll.push(relative);
    const scopes = workflowWriteScopes(text);
    if (scopes.length) writePermissions[relative] = scopes;
    for (const match of text.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gmi)) {
      const target = match[1];
      if (target.startsWith('./') || target.startsWith('docker://')) continue;
      const ref = target.split('@')[1] || '';
      if (!/^[0-9a-f]{40}$/i.test(ref)) unpinned.push(`${relative}: ${target}`);
    }
  }
  const baseline = loadWriteBaseline(workspace);
  const drift = permissionDrift(writePermissions, baseline);
  const unsafe = [...pullRequestTarget, ...writeAll];
  const permissionFailure = Boolean(baseline.error || drift.unexpected.length || drift.missing.length);
  const workflowOutcome = unsafe.length || permissionFailure ? OUTCOME.FAIL : (unpinned.length ? OUTCOME.WARN : OUTCOME.PASS);

  const roots = [path.join(workspace, '.github'), path.join(workspace, 'scripts'), path.join(workspace, 'docs', 'operations', 'integrity-watchdog')];
  const files = roots.flatMap((root) => walk(root, (file) => fs.statSync(file).size <= 1_000_000 && !/\.(png|jpe?g|gif|pdf|zip|lock)$/i.test(file)));
  const credentialPatterns = [/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, /\bre_[A-Za-z0-9_-]{20,}\b/g, /\bwhsec_[A-Za-z0-9_+/=-]{12,}\b/g, /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g];
  const flagged = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (credentialPatterns.some((pattern) => (pattern.lastIndex = 0, pattern.test(text)))) flagged.push(path.relative(workspace, file).replaceAll(path.sep, '/'));
  }

  let workflowSummary;
  if (unsafe.length) workflowSummary = `${unsafe.length} workflow(s) use an unsafe trigger or write-all permission.`;
  else if (baseline.error) workflowSummary = 'The governed GitHub write-permission baseline is unavailable or invalid.';
  else if (drift.unexpected.length || drift.missing.length) workflowSummary = `${drift.unexpected.length + drift.missing.length} workflow write-permission grant(s) drift from the governed baseline.`;
  else if (unpinned.length) workflowSummary = `${unpinned.length} action reference(s) are not pinned to a full SHA.`;
  else workflowSummary = `All ${workflows.length} workflows avoid pull_request_target/write-all, pin external actions, and match the governed write-permission baseline.`;

  return [
    result({ id: 'WORKFLOW-SAFE-PERMISSIONS', workflowId: 'GITHUB-CHANGE-01', title: 'GitHub Actions trigger, permission, and pinning safety', domain: 'github', severity: SEVERITY.P0, outcome: workflowOutcome, summary: workflowSummary, evidence: [{ id: 'WORKFLOW-STATIC-SCAN', source: 'repository', workflow_count: workflows.length, pull_request_target_files: pullRequestTarget, write_all_files: writeAll, unpinned_action_references: unpinned.slice(0, 100), permission_baseline_enforced: baseline.enforced, permission_baseline_version: baseline.version, permission_baseline_error: baseline.error, workflow_write_permissions: writePermissions, unexpected_write_permissions: drift.unexpected, missing_expected_write_permissions: drift.missing }], goldEligible: true, remediation: { smallest_safe_scope: ['Only flagged workflow files, the governed permission baseline, and their tests.'], proposed_changes: ['Replace privileged triggers or broad permissions where not strictly required.', 'Review every write-scope change against the governed baseline before accepting it.', 'Pin external actions to full commit SHAs.'] } }),
    result({ id: 'REPOSITORY-SECRET-SCAN', workflowId: 'SECURITY-CREDENTIAL-01', title: 'Watchdog-scope committed credential scan', domain: 'security', severity: SEVERITY.P0, outcome: flagged.length ? OUTCOME.FAIL : OUTCOME.PASS, summary: flagged.length ? `Credential-shaped material was detected in ${flagged.length} inspected file(s).` : `No credential-shaped values were detected in ${files.length} inspected control files.`, evidence: [{ id: 'CREDENTIAL-SHAPE-SCAN', source: 'repository', scanned_file_count: files.length, flagged_paths: [...new Set(flagged)].slice(0, 100) }], goldEligible: true, remediation: { smallest_safe_scope: ['Rotate first, then remove only the exposed value and add a regression guard.'], prohibited_actions: ['Never copy a credential into a report, issue, pull request, log, or chat.'] } }),
  ];
}
