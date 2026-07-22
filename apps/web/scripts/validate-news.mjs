import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const newsDir = path.resolve('src/content/news');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS_URL = /^https:\/\/[^\s"']+$/;
const allowedStatus = new Set(['draft', 'review', 'ready-for-build', 'published']);
const publishedVerification = new Set(['verified-primary', 'verified-multiple']);

function topLevel(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(?:"([^"]*)"|'([^']*)'|([^\\n#]+))`, 'm'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '').trim() : '';
}

function fieldValues(frontmatter, key) {
  return [...frontmatter.matchAll(new RegExp(`^[ \\t]+(?:-\\s*)?${key}:\\s*"([^"]+)"[ \\t]*$`, 'gm'))].map((match) => match[1]);
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
  const date = topLevel(frontmatter, 'date');
  const status = topLevel(frontmatter, 'status');
  const lastReviewed = topLevel(frontmatter, 'lastReviewed');
  const complianceNote = topLevel(frontmatter, 'complianceNote');
  const slug = topLevel(frontmatter, 'slug');

  if (!ISO_DATE.test(date)) fail(file, 'date must use YYYY-MM-DD');
  if (path.basename(file, '.md') !== date) fail(file, 'filename must match the edition date');
  if (!allowedStatus.has(status)) fail(file, `unsupported status "${status}"`);
  if (!lastReviewed) fail(file, 'lastReviewed is required');
  if (slug !== `/news/${date}`) fail(file, `slug must be /news/${date}`);
  if (!/not investment/i.test(complianceNote)) fail(file, 'compliance note must explicitly reject investment advice');
  if (/(example\.com|localhost|127\.0\.0\.1)/i.test(frontmatter)) fail(file, 'placeholder or local source URL detected');

  const sourceIds = fieldValues(frontmatter, 'id');
  const sourceUrls = fieldValues(frontmatter, 'url');
  const sourceTypes = fieldValues(frontmatter, 'sourceType');
  const verification = fieldValues(frontmatter, 'verification');
  const headlines = fieldValues(frontmatter, 'headline');

  if (new Set(sourceIds).size !== sourceIds.length) fail(file, 'source IDs must be unique');
  for (const url of sourceUrls) {
    if (!HTTPS_URL.test(url)) fail(file, `source URL must be HTTPS: ${url}`);
  }
  for (const type of sourceTypes) {
    if (!['primary', 'reporting'].includes(type)) fail(file, `invalid source type "${type}"`);
  }

  const sourceIdBlocks = [...frontmatter.matchAll(/^[ \t]+sourceIds:[ \t]*\n((?:^[ \t]+-[ \t]*"[^"]+"[ \t]*\n?)+)/gm)];
  const serializedReferences = sourceIdBlocks.flatMap((match) => [...match[1].matchAll(/^\s*-\s*"([^"]+)"\s*$/gm)].map((item) => item[1]));
  for (const id of serializedReferences) {
    if (!sourceIds.includes(id)) fail(file, `unknown source ID "${id}"`);
  }

  if (headlines.length < 3 || headlines.length > 7) fail(file, 'editions require 3-7 highlights');
  if (verification.length !== headlines.length) fail(file, 'every highlight needs a verification state');

  if (status === 'published') {
    if (sourceIds.length < 3) fail(file, 'published editions require at least three sources');
    if (!sourceTypes.includes('primary')) fail(file, 'published editions require at least one primary source');
    for (const state of verification) {
      if (!publishedVerification.has(state)) fail(file, `published highlight has invalid verification "${state}"`);
    }
  }

  if (/\b(guaranteed return|risk-free profit|must buy|must sell|will definitely rise|will definitely fall)\b/i.test(raw)) {
    fail(file, 'prohibited promotional or deterministic market language detected');
  }
}

console.log(`Validated ${files.length} Daily USD Impact edition${files.length === 1 ? '' : 's'}.`);
