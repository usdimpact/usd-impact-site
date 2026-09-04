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

export function repositoryContracts({ workspace = process.cwd() } = {}) {
  const workflows = walk(path.join(workspace, '.github', 'workflows'), (file) => /\.ya?ml$/i.test(file));
  const pullRequestTarget = [];
  const writeAll = [];
  const unpinned = [];
  for (const file of workflows) {
    const relative = path.relative(workspace, file).replaceAll(path.sep, '/');
    const text = fs.readFileSync(file, 'utf8');
    if (/\bpull_request_target\s*:/m.test(text)) pullRequestTarget.push(relative);
    if (/^\s*permissions\s*:\s*write-all\s*$/mi.test(text)) writeAll.push(relative);
    for (const match of text.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gmi)) {
      const target = match[1];
      if (target.startsWith('./') || target.startsWith('docker://')) continue;
      const ref = target.split('@')[1] || '';
      if (!/^[0-9a-f]{40}$/i.test(ref)) unpinned.push(`${relative}: ${target}`);
    }
  }
  const unsafe = [...pullRequestTarget, ...writeAll];
  const workflowOutcome = unsafe.length ? OUTCOME.FAIL : (unpinned.length ? OUTCOME.WARN : OUTCOME.PASS);

  const roots = [path.join(workspace, '.github'), path.join(workspace, 'scripts'), path.join(workspace, 'docs', 'operations', 'integrity-watchdog')];
  const files = roots.flatMap((root) => walk(root, (file) => fs.statSync(file).size <= 1_000_000 && !/\.(png|jpe?g|gif|pdf|zip|lock)$/i.test(file)));
  const credentialPatterns = [/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, /\bre_[A-Za-z0-9_-]{20,}\b/g, /\bwhsec_[A-Za-z0-9_+/=-]{12,}\b/g, /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g];
  const flagged = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (credentialPatterns.some((pattern) => (pattern.lastIndex = 0, pattern.test(text)))) flagged.push(path.relative(workspace, file).replaceAll(path.sep, '/'));
  }

  return [
    result({ id: 'WORKFLOW-SAFE-PERMISSIONS', workflowId: 'GITHUB-CHANGE-01', title: 'GitHub Actions trigger, permission, and pinning safety', domain: 'github', severity: SEVERITY.P0, outcome: workflowOutcome, summary: unsafe.length ? `${unsafe.length} workflow(s) use an unsafe trigger or write-all permission.` : (unpinned.length ? `${unpinned.length} action reference(s) are not pinned to a full SHA.` : `All ${workflows.length} workflows avoid pull_request_target/write-all and pin external actions.`), evidence: [{ id: 'WORKFLOW-STATIC-SCAN', source: 'repository', workflow_count: workflows.length, pull_request_target_files: pullRequestTarget, write_all_files: writeAll, unpinned_action_references: unpinned.slice(0, 100) }], goldEligible: true, remediation: { smallest_safe_scope: ['Only flagged workflow files and their tests.'], proposed_changes: ['Replace privileged triggers or broad permissions where not strictly required.', 'Pin external actions to full commit SHAs.'] } }),
    result({ id: 'REPOSITORY-SECRET-SCAN', workflowId: 'SECURITY-CREDENTIAL-01', title: 'Watchdog-scope committed credential scan', domain: 'security', severity: SEVERITY.P0, outcome: flagged.length ? OUTCOME.FAIL : OUTCOME.PASS, summary: flagged.length ? `Credential-shaped material was detected in ${flagged.length} inspected file(s).` : `No credential-shaped values were detected in ${files.length} inspected control files.`, evidence: [{ id: 'CREDENTIAL-SHAPE-SCAN', source: 'repository', scanned_file_count: files.length, flagged_paths: [...new Set(flagged)].slice(0, 100) }], goldEligible: true, remediation: { smallest_safe_scope: ['Rotate first, then remove only the exposed value and add a regression guard.'], prohibited_actions: ['Never copy a credential into a report, issue, pull request, log, or chat.'] } }),
  ];
}
