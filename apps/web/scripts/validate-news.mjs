import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { load, FAILSAFE_SCHEMA } from 'js-yaml';
import { sourceClassification } from '../api/daily-news-source.js';

const newsDir = path.resolve('src/content/news');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS_URL = /^https:\/\/[^\s"']+$/;
const allowedStatus = new Set(['draft', 'review', 'ready-for-build', 'published']);
const publishedVerification = new Set(['verified-primary', 'verified-multiple']);

function topLevel(data, key) {
  return typeof data[key] === 'string' ? data[key].trim() : '';
}

function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}

let files;
try {
  files = (await readdir(newsDir)).filter((file) => file.endsWith('.md')).sort();
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.log('No Daily USD Impact content directory yet.');
    process.exit(0);
  }
  throw error;
}

for (const file of files) {
  const raw = await readFile(path.join(newsDir, file), 'utf8');
  const parts = raw.split(/^---\s*$/m);
  if (parts.length < 3) fail(file, 'missing YAML frontmatter delimiters');

  const frontmatter = parts[1];
  let data;
  try {
    data = load(frontmatter, { schema: FAILSAFE_SCHEMA });
  } catch (error) {
    fail(file, `invalid YAML frontmatter: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(file, 'YAML frontmatter must be a mapping');
  const date = topLevel(data, 'date');
  const status = topLevel(data, 'status');
  const lastReviewed = topLevel(data, 'lastReviewed');
  const complianceNote = topLevel(data, 'complianceNote');
  const slug = topLevel(data, 'slug');

  if (!ISO_DATE.test(date)) fail(file, 'date must use YYYY-MM-DD');
  if (path.basename(file, '.md') !== date) fail(file, 'filename must match the edition date');
  if (!allowedStatus.has(status)) fail(file, `unsupported status "${status}"`);
  if (!lastReviewed) fail(file, 'lastReviewed is required');
  if (slug !== `/news/${date}`) fail(file, `slug must be /news/${date}`);
  if (!/not investment/i.test(complianceNote)) fail(file, 'compliance note must explicitly reject investment advice');
  if (/(example\.com|localhost|127\.0\.0\.1)/i.test(frontmatter)) fail(file, 'placeholder or local source URL detected');

  const { sources, highlights, catalysts = [] } = data;
  if (!Array.isArray(sources) || !Array.isArray(highlights) || !Array.isArray(catalysts)) {
    fail(file, 'sources, highlights and catalysts must be arrays');
  }
  const sourceIds = sources.map((source) => source?.id);
  const sourceUrls = sources.map((source) => source?.url);
  const sourceTypes = sources.map((source) => source?.sourceType);
  const verification = highlights.map((highlight) => highlight?.verification).filter((value) => typeof value === 'string');
  const headlines = highlights.map((highlight) => highlight?.headline).filter((value) => typeof value === 'string');

  if (sourceIds.some((id) => typeof id !== 'string' || !id.trim())) fail(file, 'source IDs must be nonempty strings');
  if (new Set(sourceIds).size !== sourceIds.length) fail(file, 'source IDs must be unique');
  for (const url of sourceUrls) {
    if (!HTTPS_URL.test(url)) fail(file, `source URL must be HTTPS: ${url}`);
  }
  for (const type of sourceTypes) {
    if (!['primary', 'reporting'].includes(type)) fail(file, `invalid source type "${type}"`);
  }

  for (const [kind, entries] of [['highlight', highlights], ['catalyst', catalysts]]) {
    for (const [index, entry] of entries.entries()) {
      if (!Array.isArray(entry?.sourceIds) || entry.sourceIds.length === 0) {
        fail(file, `${kind} ${index + 1} requires source IDs`);
      }
      for (const id of entry.sourceIds) {
        if (typeof id !== 'string' || !sourceIds.includes(id)) fail(file, `unknown source ID "${id}"`);
      }
    }
  }

  if (headlines.length < 3 || headlines.length > 7) fail(file, 'editions require 3-7 highlights');
  if (verification.length !== headlines.length) fail(file, 'every highlight needs a verification state');

  if (status === 'published') {
    if (sourceIds.length < 3) fail(file, 'published editions require at least three sources');
    if (!sourceTypes.includes('primary')) fail(file, 'published editions require at least one primary source');
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    for (const [index, highlight] of highlights.entries()) {
      const state = highlight?.verification;
      if (!publishedVerification.has(state)) {
        fail(file, `published highlight ${index + 1} has invalid verification "${state}"`);
      }
      const cited = highlight.sourceIds.map((id) => sourceById.get(id));
      if (state === 'verified-primary' && !cited.some((source) => source.sourceType === 'primary')) {
        fail(file, `published highlight ${index + 1} is verified-primary but cites no primary source`);
      }
      if (state === 'verified-multiple') {
        const reportingDomains = new Set(cited
          .filter((source) => source.sourceType === 'reporting')
          .map((source) => sourceClassification(source.url)?.domain
            ?? new URL(source.url).hostname.toLowerCase().replace(/^www\\./, '')));
        if (reportingDomains.size < 2) {
          fail(file, `published highlight ${index + 1} is verified-multiple but cites fewer than two independent reporting domains`);
        }
      }
    }
  }

  if (/\b(guaranteed return|risk-free profit|must buy|must sell|will definitely rise|will definitely fall)\b/i.test(raw)) {
    fail(file, 'prohibited promotional or deterministic market language detected');
  }
}

console.log(`Validated ${files.length} Daily USD Impact edition${files.length === 1 ? '' : 's'}.`);
