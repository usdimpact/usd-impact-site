/** Local build-output inspection only. No network or hosted-system operations. */
import { constants, lstatSync, readdirSync, realpathSync, openSync, fstatSync, readFileSync, closeSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectCatalystHtml, compareCatalystHtml, MAX_HTML_BYTES, PROJECTION_SCHEME } from './lib/catalyst-rendered-projection.mjs';

const fail = code => { throw new Error(code); };
function directory(p) {
  const info = lstatSync(p);
  if (!info.isDirectory() || info.isSymbolicLink() || realpathSync(p) !== path.resolve(p)) fail('NONREGULAR_BUILD_DIRECTORY');
}
function readSnapshot(file) {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size === 0 || before.size > MAX_HTML_BYTES) fail('INVALID_BUILD_FILE');
    const bytes = readFileSync(fd);
    const after = fstatSync(fd);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
        || before.mtimeMs !== after.mtimeMs || bytes.length !== after.size) fail('BUILD_FILE_CHANGED_DURING_READ');
    const decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    if (!Buffer.from(decoded, 'utf8').equals(bytes)) fail('BUILD_UTF8_ROUNDTRIP_FAILED');
    return decoded;
  } finally { closeSync(fd); }
}
export function verifyGeneratedCatalystPages(distRoot) {
  if (typeof distRoot !== 'string' || !distRoot || distRoot.includes('\0')) fail('INVALID_DIST_ROOT');
  const root = path.resolve(distRoot);
  const news = path.join(root, 'news');
  const catalysts = path.join(news, 'catalysts');
  for (const p of [root, news, catalysts]) directory(p);
  const entries = readdirSync(catalysts, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  if (!entries.length || entries.length > 256) fail('INVALID_CATALYST_OUTPUT_COUNT');
  let totalBytes = 0;
  const pages = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !/^[a-z0-9-]+-(?:preview|outcome)$/.test(entry.name)) fail('UNEXPECTED_CATALYST_OUTPUT');
    const dir = path.join(catalysts, entry.name);
    directory(dir);
    const children = readdirSync(dir, { withFileTypes: true });
    if (children.length !== 1 || children[0].name !== 'index.html' || !children[0].isFile() || children[0].isSymbolicLink()) fail('UNEXPECTED_CATALYST_PAGE_FILES');
    const html = readSnapshot(path.join(dir, 'index.html'));
    totalBytes += Buffer.byteLength(html);
    if (totalBytes > 16 * 1024 * 1024) fail('TOTAL_OUTPUT_LIMIT');
    const canonical = `https://www.usd-impact.com/news/catalysts/${entry.name}`;
    const result = projectCatalystHtml(html, canonical);
    if (result.status !== 'PROJECTION_READY_NOT_VERIFIED') fail(`GENERATED_PROJECTION_HOLD:${result.code}`);
    // A deterministic self-comparison validates the mechanism, not source/publication parity.
    if (compareCatalystHtml(html, html, canonical).status !== 'CONTENT_MATCH_NOT_VERIFIED') fail('NONDETERMINISTIC_PROJECTION');
    pages.push({ canonical, suppliedUtf8Sha256: result.suppliedUtf8Sha256,
      contentSha256: result.contentSha256, coverage: result.coverage });
  }
  return { status: 'GENERATED_CATALYST_STRUCTURE_CHECKED_NOT_PUBLICATION_VERIFIED', scheme: PROJECTION_SCHEME,
    inspectedPageCount: pages.length, pages, expectedPublicationInventoryVerified: false,
    independentContentComparisonPerformed: false, liveAcquisitionPerformed: false, publicationAuthorized: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length > 3) fail('UNEXPECTED_ARGUMENT');
    console.log(JSON.stringify(verifyGeneratedCatalystPages(process.argv[2] || 'dist')));
  } catch (error) {
    const code = /^[A-Z0-9_:]+$/.test(error?.message || '') ? error.message : 'BUILD_INSPECTION_FAILED';
    console.error(`Catalyst rendered projection: ${code}`);
    process.exitCode = 1;
  }
}
