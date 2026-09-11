import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ARTICLE = /^\/news\/(?:\d{4}-\d{2}-\d{2}|catalysts\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const SITE_ORIGIN = 'https://www.usd-impact.com';
const OUTPUT_RELATIVE = path.join('src', 'generated', 'publication-render-inputs.generated.js');
const MAX_BUNDLE_BYTES = 20_000_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_SOURCE_BYTES = 4_000_000;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function contentFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return contentFiles(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

function frontmatterValue(source, key) {
  const match = source.match(new RegExp(`^${key}:\\s*(?:"([^"]*)"|'([^']*)'|([^\\r\\n#]+))\\s*$`, 'm'));
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function firstExisting(candidates, label) {
  const matches = candidates.filter((candidate) => fs.existsSync(candidate));
  if (matches.length !== 1) {
    throw new Error(`${label}: expected exactly one build artifact, found ${matches.length}`);
  }
  return matches[0];
}

function articleArtifact(distRoot, slug) {
  const relative = slug.slice(1);
  return firstExisting([
    path.join(distRoot, `${relative}.html`),
    path.join(distRoot, relative, 'index.html'),
  ], `article ${slug}`);
}

function readUtf8(file, label, maxBytes = MAX_RESPONSE_BYTES) {
  const value = fs.readFileSync(file, 'utf8');
  if (Buffer.byteLength(value) > maxBytes) throw new Error(`${label}: artifact exceeds ${maxBytes} bytes`);
  return value;
}

function sitemapBaseEntries(source) {
  const entries = [...source.matchAll(/<url>[^]*?<\/url>/g)].map((match) => match[0]);
  if (!entries.length) throw new Error('sitemap: no <url> entries found');
  return entries.filter((entry) => {
    const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!loc) throw new Error('sitemap: url entry missing loc');
    const pathname = new URL(loc).pathname.replace(/\/$/, '') || '/';
    return !ARTICLE.test(pathname);
  });
}

export function generatePublicationServingInputs({ root = process.cwd(), outputFile = null } = {}) {
  const distRoot = path.resolve(root, 'dist');
  if (!fs.existsSync(distRoot)) throw new Error('dist/ is missing; build publication inputs after astro build');
  const sourceRoots = [
    path.resolve(root, 'src/content/news'),
    path.resolve(root, 'src/content/catalyst-briefs'),
  ];
  const publications = [];
  const seen = new Set();
  let sourceBytes = 0;
  for (const file of sourceRoots.flatMap(contentFiles).sort()) {
    const source = fs.readFileSync(file, 'utf8');
    if (frontmatterValue(source, 'status') !== 'published') continue;
    sourceBytes += Buffer.byteLength(source);
    if (sourceBytes > MAX_SOURCE_BYTES) throw new Error('published publication sources exceed 4 MB serving-policy bound');
    const slug = frontmatterValue(source, 'slug');
    const category = frontmatterValue(source, 'category');
    if (!ARTICLE.test(slug)) throw new Error(`${path.relative(root, file)}: published publication slug is outside guarded routes`);
    if (!['Daily USD Impact', 'USD Impact Catalyst Brief'].includes(category)) {
      throw new Error(`${path.relative(root, file)}: published publication category is outside guarded contract`);
    }
    if (seen.has(slug)) throw new Error(`${path.relative(root, file)}: duplicate publication slug ${slug}`);
    seen.add(slug);
    const html = readUtf8(articleArtifact(distRoot, slug), `article ${slug}`);
    publications.push({
      path: slug,
      source,
      sourceSha256: sha256(source),
      html,
      htmlSha256: sha256(html),
    });
  }
  if (!publications.length || publications.length > 500) throw new Error(`publication input count out of bounds: ${publications.length}`);

  const homepageHtml = readUtf8(firstExisting([path.join(distRoot, 'index.html')], 'homepage'), 'homepage');
  const newsHtml = readUtf8(firstExisting([
    path.join(distRoot, 'news.html'),
    path.join(distRoot, 'news', 'index.html'),
  ], 'news index'), 'news index');
  const sitemapSource = readUtf8(firstExisting([path.join(distRoot, 'sitemap-0.xml')], 'sitemap'), 'sitemap');

  const bundle = {
    schema: 'publication-render-inputs/v1',
    siteOrigin: SITE_ORIGIN,
    buildCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
    publications,
    static: {
      homepageHtml,
      homepageSha256: sha256(homepageHtml),
      newsHtml,
      newsSha256: sha256(newsHtml),
      sitemapBaseEntries: sitemapBaseEntries(sitemapSource),
    },
  };
  const payload = JSON.stringify(bundle);
  if (Buffer.byteLength(payload) > MAX_BUNDLE_BYTES) throw new Error('publication render bundle exceeds 20 MB');
  const moduleSource = `// Generated after Astro build. Do not edit or commit.\n`
    + `const value = ${payload};\n`
    + `function freeze(input) { if (input && typeof input === 'object') { for (const item of Object.values(input)) freeze(item); Object.freeze(input); } return input; }\n`
    + `export const PUBLICATION_RENDER_INPUTS = freeze(value);\n`;
  const output = outputFile ? path.resolve(outputFile) : path.resolve(root, OUTPUT_RELATIVE);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, moduleSource, 'utf8');
  return Object.freeze({
    output,
    publicationCount: publications.length,
    bundleSha256: sha256(payload),
    generatedModuleSha256: sha256(moduleSource),
    buildCommitSha: bundle.buildCommitSha,
  });
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  const result = generatePublicationServingInputs();
  console.log(`publication serving inputs generated (${result.publicationCount} publications; bundle ${result.bundleSha256})`);
}
