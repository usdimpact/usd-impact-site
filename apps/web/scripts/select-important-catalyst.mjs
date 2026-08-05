import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { selectImportantCatalyst } from '../src/lib/catalyst-briefs.js';

const inputPath = process.argv[2];
const phaseArg = process.argv.find((value) => value.startsWith('--phase='));
const asOfArg = process.argv.find((value) => value.startsWith('--as-of='));
const phase = phaseArg?.slice('--phase='.length);
const asOf = asOfArg?.slice('--as-of='.length) ?? new Date().toISOString().slice(0, 10);

if (!inputPath || !phase) {
  console.error('Usage: node scripts/select-important-catalyst.mjs <latest.json> --phase=preview|outcome [--as-of=YYYY-MM-DD]');
  process.exit(1);
}

const latestPayload = JSON.parse(await readFile(inputPath, 'utf8'));
const briefDirectory = path.resolve('src/content/catalyst-briefs');
let existingSlugs = [];
try {
  existingSlugs = (await readdir(briefDirectory))
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.basename(name, '.md'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const candidate = selectImportantCatalyst(latestPayload, { phase, asOf, existingSlugs });
process.stdout.write(`${JSON.stringify({ candidate }, null, 2)}\n`);
