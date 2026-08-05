import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('src/content/catalyst-briefs');
const allowedStatus = new Set(['draft', 'review', 'ready-for-build', 'published']);
const topLevel = (frontmatter, key) => frontmatter.match(new RegExp(`^${key}:\\s*"?([^"\\r\\n]+)"?\\s*$`, 'm'))?.[1]?.trim() ?? '';
const fieldValues = (frontmatter, key) => [...frontmatter.matchAll(new RegExp(`^[ \\t]+(?:-\\s*)?${key}:\\s*"([^"]+)"[ \\t]*$`, 'gm'))].map((match) => match[1]);

let files = [];
try {
  files = (await readdir(directory)).filter((file) => file.endsWith('.md')).sort();
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

for (const file of files) {
  const raw = await readFile(path.join(directory, file), 'utf8');
  const parts = raw.split(/^---\s*$/m);
  if (parts.length < 3) throw new Error(`${file}: missing YAML frontmatter`);
  const frontmatter = parts[1];
  const status = topLevel(frontmatter, 'status');
  const phase = topLevel(frontmatter, 'phase');
  const eventKey = topLevel(frontmatter, 'eventKey');
  const slug = topLevel(frontmatter, 'slug');
  const eventDate = topLevel(frontmatter, 'eventDate');
  const statusLabel = topLevel(frontmatter, 'statusLabel');
  if (!allowedStatus.has(status)) throw new Error(`${file}: unsupported status`);
  if (!['preview', 'outcome'].includes(phase)) throw new Error(`${file}: unsupported phase`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new Error(`${file}: invalid eventDate`);
  if (slug !== `/news/catalysts/${path.basename(file, '.md')}`) throw new Error(`${file}: slug must match filename`);
  if (!path.basename(file, '.md').endsWith(`${eventKey}-${phase}`)) throw new Error(`${file}: eventKey/phase mismatch`);
  if (!['scheduled-confirmed', 'rescheduled', 'cancelled', 'released'].includes(statusLabel)) throw new Error(`${file}: unsupported statusLabel`);
  if (phase === 'preview' && statusLabel === 'released') throw new Error(`${file}: preview cannot be released`);
  if (phase === 'outcome' && statusLabel === 'scheduled-confirmed') throw new Error(`${file}: outcome cannot be scheduled-confirmed`);
  if (!/not investment/i.test(topLevel(frontmatter, 'complianceNote'))) throw new Error(`${file}: compliance note is incomplete`);
  const ids = fieldValues(frontmatter, 'id');
  const urls = fieldValues(frontmatter, 'url');
  const sourceTypes = fieldValues(frontmatter, 'sourceType');
  const factStates = fieldValues(frontmatter, 'verification');
  if (new Set(ids).size !== ids.length) throw new Error(`${file}: source IDs must be unique`);
  if (urls.some((url) => !url.startsWith('https://'))) throw new Error(`${file}: sources must use HTTPS`);
  if (status === 'published' && (!sourceTypes.includes('primary') || ids.length < 2)) throw new Error(`${file}: published brief lacks primary-source coverage`);
  if (factStates.length < 2 || factStates.some((state) => !['verified-primary', 'verified-multiple'].includes(state))) {
    throw new Error(`${file}: invalid verified-fact coverage`);
  }
  if (/\b(guaranteed return|risk-free profit|must buy|must sell|will definitely rise|will definitely fall)\b/i.test(raw)) {
    throw new Error(`${file}: prohibited deterministic market language`);
  }
}

console.log(`Validated ${files.length} Catalyst Brief${files.length === 1 ? '' : 's'}.`);
