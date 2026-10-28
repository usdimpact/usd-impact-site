// Offline, read-only audit of Astro dist/. No server, auth, provider or database access.
// It never authorizes publication or resolves upstream rights questions.
import fs from 'node:fs';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { createGunzip, createBrotliDecompress } from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const PRIVATE_RESEARCH_OUTPUT_MARKERS = Object.freeze([
  'SYNTHETIC_RESEARCH_REPORT_TEST_ONLY',
  'USD_IMPACT_PRIVATE_RESEARCH_REPORT_V1',
  'data-usd-impact-private-report=',
]);

const NEEDLES = PRIVATE_RESEARCH_OUTPUT_MARKERS.map(value => Buffer.from(value, 'utf8'));
const MAX_NEEDLE_BYTES = Math.max(...NEEDLES.map(value => value.length));
const MAX_EXPANDED_BYTES = 32 * 1024 * 1024;
const MAX_INSPECT_TEXT_BYTES = 8 * 1024 * 1024;
const REQUIRED_PUBLIC_OUTPUTS = Object.freeze([
  'index.html',
  'sitemap-0.xml',
  'news/feed.xml',
  'research/sample/index.html',
  'reports/weekly/2026-07-31/index.html',
  'reports/monthly/2026-10-16/index.html',
]);

function normalizeSurface(value) {
  let current = String(value || '').replaceAll('\\/', '/')
    .replace(/\\u002f/gi, '/').replace(/&sol;/gi, '/')
    .replace(/&#(?:47|x2f);/gi, '/').replace(/&amp;/gi, '&');
  for (let pass = 0; pass < 3; pass += 1) {
    let decoded;
    try { decoded = decodeURIComponent(current); } catch { break; }
    if (decoded === current) break;
    current = decoded;
  }
  return current;
}

function hasPrivateReportRoute(value) {
  return /(?:^|[^a-z0-9])\/?research\/member\/reports(?:\/|$|[?#"'\s<>&])/i
    .test(normalizeSurface(value));
}

function hasPrivateOutputName(relative) {
  const normalized = normalizeSurface(relative).replaceAll('\\', '/');
  return /(?:^|\/)research\/member\/reports(?:\/|$)/i.test(normalized) ||
    /(?:^|\/)[^/]*(?:research[-_]private[-_]report|private[-_]research[-_]report)[^/]*(?:\/|$)/i
      .test(normalized);
}

function isDiscoveryAsset(relative) {
  const logical = relative.replace(/\.(?:gz|br)$/i, '').toLowerCase();
  if (path.posix.basename(logical) === 'robots.txt') return false;
  return /\.(?:xml|json|rss|atom|webmanifest|txt)$/i.test(logical);
}

function isHtmlAsset(relative) {
  return /\.html(?:\.(?:gz|br))?$/i.test(relative);
}

function hasPrivateStructuredDataUrl(html) {
  const jsonLd = html.match(/<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi) || [];
  if (jsonLd.some(tag => hasPrivateReportRoute(tag))) return true;
  const headTags = html.match(/<(?:link|meta)\b[^>]*>/gi) || [];
  return headTags.some(tag => (
    /\brel\s*=\s*["']canonical["']/i.test(tag) ||
    /\b(?:property|name)\s*=\s*["'](?:og:url|twitter:url)["']/i.test(tag)
  ) && hasPrivateReportRoute(tag));
}

function openedStream(file) {
  const input = createReadStream(file, { highWaterMark: 64 * 1024 });
  if (/\.gz$/i.test(file)) return input.pipe(createGunzip());
  if (/\.br$/i.test(file)) return input.pipe(createBrotliDecompress());
  return input;
}

async function inspectFile(file, relative, violationCodes) {
  const inspectText = isDiscoveryAsset(relative) || isHtmlAsset(relative);
  const collected = [];
  let textBytes = 0;
  let expandedBytes = 0;
  let oversizeText = false;
  let carry = Buffer.alloc(0);
  const stream = openedStream(file);
  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      expandedBytes += buffer.length;
      if (/\.(?:gz|br)$/i.test(relative) && expandedBytes > MAX_EXPANDED_BYTES) {
        violationCodes.add('compressed-asset-expansion-limit');
        break;
      }
      const window = Buffer.concat([carry, buffer]);
      if (NEEDLES.some(marker => window.includes(marker))) {
        violationCodes.add('private-report-body-marker-in-public-asset');
      }
      carry = window.subarray(Math.max(0, window.length - MAX_NEEDLE_BYTES + 1));
      if (inspectText && !oversizeText) {
        textBytes += buffer.length;
        if (textBytes > MAX_INSPECT_TEXT_BYTES) {
          oversizeText = true;
          collected.length = 0;
          violationCodes.add('public-discovery-document-too-large');
        } else {
          collected.push(buffer);
        }
      }
    }
  } finally {
    stream.destroy();
  }
  if (!inspectText || oversizeText) return;
  const content = Buffer.concat(collected).toString('utf8');
  if (isDiscoveryAsset(relative) && hasPrivateReportRoute(content)) {
    violationCodes.add('private-report-url-in-public-discovery');
  }
  if (isHtmlAsset(relative) && hasPrivateStructuredDataUrl(content)) {
    violationCodes.add('private-report-url-in-structured-data');
  }
}

function listBuildFiles(root, violations) {
  const files = [];
  function traverse(dir, depth) {
    if (depth > 40) {
      violations.add('public-build-directory-depth-limit');
      return;
    }
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch {
      violations.add('public-build-unreadable');
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full).split(path.sep).join('/');
      if (entry.isSymbolicLink()) {
        violations.add('public-build-symlink-not-audited');
      } else if (entry.isDirectory()) {
        if (hasPrivateOutputName(relative)) violations.add('private-report-output-path');
        traverse(full, depth + 1);
      } else if (entry.isFile()) {
        if (hasPrivateOutputName(relative)) violations.add('private-report-output-path');
        files.push({ full, relative });
      } else {
        violations.add('public-build-unsupported-file-type');
      }
    }
  }
  traverse(root, 0);
  return files;
}

export async function auditResearchPrivatePublicBuild(
  root = path.resolve('dist'),
) {
  const violations = new Set();
  try {
    if (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) {
      throw new Error('invalid-build-root');
    }
  } catch {
    return Object.freeze({
      status: 'HOLD',
      findings: Object.freeze(['public-build-missing']),
      checkedFiles: 0,
      releaseAuthorized: false,
    });
  }
  for (const relative of REQUIRED_PUBLIC_OUTPUTS) {
    const expected = path.join(root, ...relative.split('/'));
    if (!fs.existsSync(expected) || !fs.statSync(expected).isFile()) {
      violations.add('required-public-output-missing');
    }
  }
  const files = listBuildFiles(root, violations);
  for (const { full, relative } of files) {
    try { await inspectFile(full, relative, violations); }
    catch { violations.add('public-artifact-unreadable-or-invalid'); }
  }
  const findings = Object.freeze([...violations].sort());
  return Object.freeze({
    status: findings.length === 0 ? 'PASS' : 'HOLD',
    findings,
    checkedFiles: files.length,
    // A PASS asserts only this finite observed public artifact contract.
    // It is never licensing, entitlement or Production release approval.
    releaseAuthorized: false,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await auditResearchPrivatePublicBuild();
  console.log(JSON.stringify(result));
  if (process.argv.includes('--check') && result.status !== 'PASS') process.exitCode = 1;
}
