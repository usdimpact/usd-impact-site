import fs from 'node:fs';
import path from 'node:path';

const contentRoot = path.resolve('src/content');
const routeCollections = {
  pages: 'pages',
  products: 'products',
  frameworks: 'frameworks',
  leadMagnets: 'lead-magnets',
  benchmarkModules: 'benchmark-modules',
  news: 'news',
};
const staticRoutes = new Map([
  ['/news', path.resolve('src/pages/news/index.astro')],
  ['/score', path.resolve('src/pages/score.astro')],
]);
const navigationPath = path.resolve('src/layouts/BaseLayout.astro');

function normalizeSlug(value) {
  const slug = value.trim().replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');
  return slug ? `/${slug}` : '/';
}

function frontmatterValue(source, key) {
  const match = source.match(new RegExp(`^${key}:\\s*["']?([^"'\\r\\n]+)["']?\\s*$`, 'm'));
  return match?.[1]?.trim();
}

function contentFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? contentFiles(entryPath) : entry.name.endsWith('.md') ? [entryPath] : [];
  });
}

const entries = Object.entries(routeCollections).flatMap(([collection, directory]) =>
  contentFiles(path.join(contentRoot, directory)).map((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return {
      collection,
      file: path.relative(process.cwd(), file),
      slug: frontmatterValue(source, 'slug'),
      status: frontmatterValue(source, 'status'),
    };
  }),
);

const failures = [];
const slugEntries = new Map();

for (const entry of entries) {
  if (!entry.slug || !entry.status) {
    failures.push(`${entry.collection} | ${entry.file} | slug: ${entry.slug ?? '(missing)'} | status: ${entry.status ?? '(missing)'}`);
    continue;
  }

  const normalizedSlug = normalizeSlug(entry.slug);
  entry.slug = normalizedSlug;
  slugEntries.set(normalizedSlug, [...(slugEntries.get(normalizedSlug) ?? []), entry]);
}

for (const [slug, collisions] of slugEntries) {
  if (collisions.length > 1) {
    failures.push(`Duplicate slug ${slug}:\n${collisions.map((entry) => `  ${entry.collection} | ${entry.file} | slug: ${entry.slug} | status: ${entry.status}`).join('\n')}`);
  }
}

for (const [route, file] of staticRoutes) {
  if (!fs.existsSync(file)) failures.push(`Static route source missing for ${route}: ${path.relative(process.cwd(), file)}`);
  if (slugEntries.has(route)) failures.push(`Static route ${route} collides with dynamic content.`);
}

const layoutSource = fs.readFileSync(navigationPath, 'utf8');
const mainNavigation = layoutSource.match(/<nav\b[^>]*class="nav"[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? '';

if (!mainNavigation) {
  failures.push(`Main navigation block not found in ${path.relative(process.cwd(), navigationPath)}`);
}

const requiredRoutes = [...mainNavigation.matchAll(/<a\s+href="(\/[^"]*)"/g)]
  .map((match) => normalizeSlug(match[1]))
  .filter((slug) => slug !== '/');

for (const route of new Set(requiredRoutes)) {
  if (staticRoutes.has(route)) continue;

  const matchingEntries = slugEntries.get(route) ?? [];
  if (matchingEntries.length === 0) {
    failures.push(`Required route missing from dynamic content or static route registry: ${route}`);
    continue;
  }

  for (const entry of matchingEntries) {
    if (entry.status !== 'published') {
      failures.push(`Required route is not published: ${route}\n  ${entry.collection} | ${entry.file} | slug: ${entry.slug} | status: ${entry.status}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Publishing validation failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log(`publishing validation pass (${entries.length} dynamic entries; ${staticRoutes.size} static routes; ${new Set(requiredRoutes).size} required main-navigation routes)`);
