/** Explicit one-shot command. Writes JSON to stdout only; no scheduler or repository writes. */
import { pathToFileURL } from 'node:url';
import { collectDailyDelivery } from './publishing-deadline-collector.mjs';

export async function main(args = [], { env = process.env, stdout = process.stdout, stderr = process.stderr,
  collect = collectDailyDelivery } = {}) {
  if (args.length === 1 && args[0] === '--help') {
    stdout.write('Usage: node scripts/publishing-deadline-read.mjs --collect YYYY-MM-DD\nOne-shot GET-only evidence collection; no approval, publishing or scheduled activation.\n');
    return 0;
  }
  if (args.length !== 2 || args[0] !== '--collect' || !/^\d{4}-\d{2}-\d{2}$/.test(args[1])) {
    stderr.write('Explicit --collect YYYY-MM-DD is required. No collection started.\n'); return 2;
  }
  try {
    const result = await collect({ edition: args[1], githubToken: env.GITHUB_TOKEN || '', vercelToken: env.VERCEL_TOKEN || '' });
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    // Exit success means only that JSON was produced, never publication permission.
    return result.gaps.length ? 3 : 0;
  } catch {
    stderr.write('Read-only collection did not complete. Credentials and response bodies are not logged.\n'); return 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
