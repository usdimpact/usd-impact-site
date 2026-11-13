// Read-only pre-paid-request gate: all open PR pages must be examined.
// No model calls, no GitHub writes and no hidden default-to-research fallback.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function hasOpenCatalystReviewPr(payload, pages, repository) {
  const slug = payload?.candidate?.slug;
  if (typeof slug !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}-[a-z0-9-]+-(preview|outcome)$/.test(slug)) {
    throw new Error('A valid selected Catalyst slug is mandatory before paid research.');
  }
  if (typeof repository !== 'string' || !/^[a-zA-Z0-9_.-]+\\/[a-zA-Z0-9_.-]+$/.test(repository)) {
    throw new Error('A verified repository name is mandatory before paid research.');
  }
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) {
    throw new Error('Open-PR pagination is incomplete or malformed; paid research refused.');
  }

  const prefix = `automation/catalyst-brief-${slug}-`;
  let duplicate = false;
  for (const page of pages) {
    for (const pr of page) {
      if (!pr || typeof pr !== 'object' || typeof pr.head?.ref !== 'string') {
        throw new Error('Open-PR response missing a head ref; paid research refused.');
      }
      if (!pr.head.ref.startsWith(prefix)) continue;
      const suffix = pr.head.ref.slice(prefix.length);
      if (
        /^\\d+$/.test(suffix)
        && pr.state === 'open'
        && pr.base?.ref === 'main'
        && pr.head.repo?.full_name === repository
      ) duplicate = true;
    }
  }
  return duplicate;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 5) throw new Error('Expected candidate JSON, slurped PR-page JSON and repository.');
    const [candidate, pages] = await Promise.all([readFile(process.argv[2], 'utf8'), readFile(process.argv[3], 'utf8')]);
    process.stdout.write(String(hasOpenCatalystReviewPr(JSON.parse(candidate), JSON.parse(pages), process.argv[4])) + '\\n');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
