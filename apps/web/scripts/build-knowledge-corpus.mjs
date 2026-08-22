import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const ROOT = resolve(new URL('../', import.meta.url).pathname);
const CONTENT_ROOT = join(ROOT, 'src', 'content');
const MAX_CHUNK_CHARS = 6_000;

const COLLECTIONS = Object.freeze([
  { directory: 'pages', sourceType: 'lesson', accessTier: 'open' },
  { directory: 'frameworks', sourceType: 'framework', accessTier: 'open' },
  { directory: 'glossary', sourceType: 'glossary', accessTier: 'open' },
  { directory: 'news', sourceType: 'daily', accessTier: 'open' },
  { directory: 'catalyst-briefs', sourceType: 'other', accessTier: 'open' },
  { directory: 'lead-magnets', sourceType: 'other', accessTier: 'open' },
  { directory: 'benchmark-modules', sourceType: 'lesson', accessTier: 'research' },
  { directory: 'weekly-reports', sourceType: 'weekly_report', accessTier: 'research' },
  { directory: 'monthly-reports', sourceType: 'monthly_report', accessTier: 'research' },
]);

function parseArgs(argv) {
  const args = { output: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--output') {
      args.output = argv[index + 1] ? resolve(argv[index + 1]) : null;
      index += 1;
    }
  }
  return args;
}

function unquote(value) {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      return trimmed.startsWith('"') ? JSON.parse(trimmed) : trimmed.slice(1, -1).replace(/''/g, "'");
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parseFrontmatter(source) {
  if (!source.startsWith('---\n')) return { data: {}, body: source };
  const end = source.indexOf('\n---\n', 4);
  if (end < 0) return { data: {}, body: source };
  const block = source.slice(4, end);
  const data = {};
  for (const line of block.split('\n')) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) continue;
    data[match[1]] = unquote(match[2]);
  }
  return { data, body: source.slice(end + 5).trim() };
}

function normalizeRoute(slug, collection, filename) {
  const raw = String(slug || '').trim();
  if (raw.startsWith('/')) return raw.endsWith('/') ? raw : `${raw}/`;
  const stem = basename(filename, '.md');
  const fallback = collection === 'news'
    ? `/news/${stem}/`
    : collection === 'weekly-reports'
      ? `/reports/weekly/${stem}/`
      : collection === 'monthly-reports'
        ? `/reports/monthly/${stem}/`
        : `/${raw || stem}/`;
  return fallback.replace(/\/+/g, '/');
}

function normalizePublishedAt(data) {
  const value = data.date || data.periodEnd || data.lastReviewed || null;
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function splitLongText(text, maximum = MAX_CHUNK_CHARS) {
  if (text.length <= maximum) return [text];
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (paragraph.length > maximum) {
      if (current) chunks.push(current);
      current = '';
      for (let offset = 0; offset < paragraph.length; offset += maximum) {
        chunks.push(paragraph.slice(offset, offset + maximum));
      }
      continue;
    }
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maximum) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function markdownChunks(body) {
  const sections = body
    .split(/(?=^#{1,3}\s+)/m)
    .map((section) => section.trim())
    .filter(Boolean);
  const sourceSections = sections.length ? sections : [body.trim()];
  return sourceSections.flatMap((section) => splitLongText(section)).filter(Boolean);
}

async function markdownFiles(directory) {
  const output = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return output;
    throw error;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) output.push(path);
  }
  return output.sort();
}

function cleanTitle(value, filename) {
  const title = String(value || '').trim();
  return title || basename(filename, '.md').replace(/[-_]+/g, ' ');
}

export async function buildKnowledgeCorpus() {
  const rows = [];
  for (const collection of COLLECTIONS) {
    const files = await markdownFiles(join(CONTENT_ROOT, collection.directory));
    for (const filename of files) {
      const raw = await readFile(filename, 'utf8');
      const { data, body } = parseFrontmatter(raw);
      if (String(data.status || '').toLowerCase() !== 'published') continue;
      if (!body.trim()) continue;

      const sourceId = String(data.slug || relative(CONTENT_ROOT, filename).replaceAll(sep, '/').replace(/\.md$/, '')).trim();
      const title = cleanTitle(data.title, filename);
      const sourcePath = normalizeRoute(data.slug, collection.directory, filename);
      const publishedAt = normalizePublishedAt(data);
      const chunks = markdownChunks(body);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        rows.push({
          source_type: collection.sourceType,
          source_id: sourceId.slice(0, 240),
          source_path: sourcePath.slice(0, 1000),
          title: title.slice(0, 500),
          content: chunks[chunkIndex],
          language: 'en',
          access_tier: collection.accessTier,
          chunk_index: chunkIndex,
          published_at: publishedAt,
          metadata: {
            collection: collection.directory,
            repositoryPath: relative(ROOT, filename).replaceAll(sep, '/'),
          },
        });
      }
    }
  }

  rows.sort((a, b) =>
    a.source_type.localeCompare(b.source_type)
    || a.source_id.localeCompare(b.source_id)
    || a.language.localeCompare(b.language)
    || a.chunk_index - b.chunk_index);
  return rows;
}

async function main() {
  const { output } = parseArgs(process.argv.slice(2));
  const rows = await buildKnowledgeCorpus();
  const counts = rows.reduce((accumulator, row) => {
    const key = `${row.access_tier}:${row.source_type}`;
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify({ version: 1, rows }, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify({
    rows: rows.length,
    counts,
    output,
  }));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  await main();
}
