import fs from 'node:fs';
import path from 'node:path';

const contentRoot = path.resolve('src/content');
const routeCollections = {
  pages: 'pages',
  products: 'products',
  frameworks: 'frameworks',
  leadMagnets: 'lead-magnets',
  benchmarkModules: 'benchmark-modules',
};
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

const navigation = fs.readFileSync(navigationPath, 'utf8');
const requiredRoutes = [...navigation.matchAll(/<a\s+href="(\/[^"]*)"/g)]
  .map((match) => normalizeSlug(match[1]))
  .filter((slug) => slug !== '/');

for (const route of new Set(requiredRoutes)) {
  const matchingEntries = slugEntries.get(route) ?? [];
  if (matchingEntries.length === 0) {
    failures.push(`Required route missing from dynamic content: ${route}`);
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

console.log(`publishing validation pass (${entries.length} dynamic entries; ${new Set(requiredRoutes).size} required navigation routes)`);
