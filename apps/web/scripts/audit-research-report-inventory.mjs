// Read-only inventory of the existing public/static Weekly and Monthly report
// source files. A matching baseline is inventory agreement, not rights approval.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BASELINE = fileURLToPath(new URL('./fixtures/research-report-public-baseline-2026-10-28.json', import.meta.url));
const TYPES = ['weekly', 'monthly'];
const FILE_RE = /^\d{4}-\d{2}-\d{2}\.md$/;

function scalar(frontmatter, key) {
  return frontmatter.match(new RegExp(`^\\s*${key}:\\s*["']?([^"'\\r\\n]+)["']?\\s*$`, 'm'))?.[1]?.trim() ?? null;
}

function gitBlobSha(markdown) {
  const bytes = Buffer.from(String(markdown), 'utf8');
  const header = Buffer.from('blob ' + bytes.length + '\0', 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

export function inspectResearchReportSource({ type, filename, markdown }) {
  if (!TYPES.includes(type) || !FILE_RE.test(filename)) {
    throw new TypeError('Research report type or filename is invalid');
  }
  const periodEnd = filename.replace(/\.md$/, '');
  const parts = String(markdown).split(/^---\s*$/m);
  if (parts.length < 3) throw new TypeError('Research report frontmatter is missing');
  const frontmatter = parts[1], body = parts.slice(2).join('---');
  if (scalar(frontmatter, 'periodEnd') !== periodEnd) {
    throw new TypeError('Research report periodEnd does not match filename');
  }
  const publicRoute = `/reports/${type}/${periodEnd}`;
  if (scalar(frontmatter, 'slug') !== publicRoute) {
    throw new TypeError('Research report public slug does not match filename');
  }
  const published = scalar(frontmatter, 'status') === 'published';
  return {
    type, periodEnd, publicRoute, published,
    // Broad risk markers. They are not legal findings or leakage proofs.
    hasComponentDiscussion: /\bcontributions?\b/i.test(body),
    hasWeeklyInputReference: /weekly_input\.json/i.test(markdown),
    hasNearestRegimeBoundary: /^\s+nearestRegimeBoundary:\s*\S+/m.test(frontmatter),
    approvedSampleRoute: type === 'weekly' && periodEnd === '2026-08-07' ? '/research/sample/' : null,
    rightsStatus: 'HOLD_UNREVIEWED',
    sourceGitBlobSha: gitBlobSha(markdown),
  };
}

export function inspectResearchReportTree(root = ROOT) {
  const reports = [];
  for (const type of TYPES) {
    const dir = path.join(root, 'src', 'content', `${type}-reports`);
    const filenames = fs.readdirSync(dir).filter(name => name.endsWith('.md')).sort();
    for (const filename of filenames) {
      const markdown = fs.readFileSync(path.join(dir, filename), 'utf8');
      reports.push(inspectResearchReportSource({ type, filename, markdown }));
    }
  }
  return reports;
}

export function compareResearchReportInventory(observed, baseline) {
  if (baseline?.schemaVersion !== 'research-report-public-baseline-v1' ||
      baseline?.disposition?.startsWith('HOLD') !== true ||
      !Array.isArray(baseline?.entries) || !Array.isArray(observed)) {
    return Object.freeze({ status: 'HOLD', reason: 'invalid-baseline', releaseAuthorized: false });
  }
  const observedKeys = observed.map(row => `${row.type}/${row.periodEnd}`);
  const baselineKeys = baseline.entries.map(row => `${row.type}/${row.periodEnd}`);
  if (new Set(observedKeys).size !== observedKeys.length ||
      new Set(baselineKeys).size !== baselineKeys.length) {
    return Object.freeze({ status: 'HOLD', reason: 'duplicate-report-key', releaseAuthorized: false });
  }
  if (JSON.stringify(observed) !== JSON.stringify(baseline.entries)) {
    return Object.freeze({
      status: 'HOLD', reason: 'public-report-inventory-drift', releaseAuthorized: false,
      expectedReports: baseline.entries.length, observedReports: observed.length,
    });
  }
  return Object.freeze({
    status: 'INVENTORY_MATCH_ONLY', reason: 'rights-approval-still-required', releaseAuthorized: false,
    weekly: observed.filter(row => row.type === 'weekly').length,
    monthly: observed.filter(row => row.type === 'monthly').length,
    contributionLanguage: observed.filter(row => row.hasComponentDiscussion).length,
    weeklyInputReferences: observed.filter(row => row.hasWeeklyInputReference).length,
    publicSamples: observed.filter(row => row.approvedSampleRoute !== null).length,
  });
}

export function runInventoryCheck({
  root = ROOT, baselinePath = BASELINE,
} = {}) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const observed = inspectResearchReportTree(root);
  return compareResearchReportInventory(observed, baseline);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = runInventoryCheck();
  console.log(JSON.stringify(result));
  if (process.argv.includes('--check') && result.status !== 'INVENTORY_MATCH_ONLY') process.exitCode = 1;
}
