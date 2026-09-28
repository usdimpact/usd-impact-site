import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PREFLIGHT_GROUPS = Object.freeze([
  'validate:content', 'validate:news', 'validate:compliance', 'validate:links', 'validate:publishing',
]);
// These are the publishing-specific tests otherwise included in validate:functions.
// Keep the production source endpoints, editorial validator and importers unchanged.
export const PUBLICATION_CONTRACTS = Object.freeze([
  'test-daily-news-source-function.mjs',
  'test-daily-news-grounded-schema.mjs',
  'test-daily-news-editorial-validation.mjs',
  'test-daily-news-validation.mjs',
  'test-daily-news-collection-normalization.mjs',
  'test-import-daily-news.mjs',
  'test-daily-news-retry-policy.mjs',
  'test-catalyst-brief-selection.mjs',
  'test-catalyst-brief-source-function.mjs',
  'test-import-catalyst-brief.mjs',
]);

export function publicationCommands(mode) {
  if (mode === '--preflight') return PREFLIGHT_GROUPS.map((group) => ['npm', ['run', group]]);
  if (mode === '--contracts') return PUBLICATION_CONTRACTS.map((file) => [process.execPath, [`scripts/${file}`]]);
  throw new Error('Expected exactly --preflight or --contracts');
}

export function runPublicationCommands(commands, run = spawnSync) {
  for (const [command, args] of commands) {
    const started = Date.now();
    console.log(`Publication validation: ${args.join(' ')}`);
    const result = run(command, args, { stdio: 'inherit' });
    console.log(`Publication validation elapsed_ms=${Date.now() - started}`);
    if (result.error || result.status !== 0) throw new Error('Publication validation failed; later commands were not run');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Expected exactly one validation mode');
    runPublicationCommands(publicationCommands(process.argv[2]));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
