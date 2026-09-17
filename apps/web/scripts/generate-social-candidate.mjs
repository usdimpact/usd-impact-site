import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { generateSocialCandidate, socialCandidateConstants } from '../src/lib/social-candidate-generator.js';

function parseArgs(argv) {
  const args = { input: '', output: '', type: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--input') args.input = argv[++index] || '';
    else if (value === '--output') args.output = argv[++index] || '';
    else if (value === '--type') args.type = argv[++index] || '';
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage:\n  node scripts/generate-social-candidate.mjs --type <daily|weekly|catalyst|report> --input <source.json> [--output <candidate.json>]\n\nThe input must be a normalized governed USD Impact source object. The command creates a draft social candidate only. It cannot publish to Instagram or Meta.`);
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

if (args.help) {
  printHelp();
  process.exit(0);
}

if (!socialCandidateConstants.supportedSourceTypes.includes(args.type)) {
  console.error(`--type must be one of: ${socialCandidateConstants.supportedSourceTypes.join(', ')}`);
  process.exit(2);
}
if (!args.input) {
  console.error('--input is required');
  process.exit(2);
}

const inputPath = path.resolve(args.input);
let source;
try {
  source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (error) {
  console.error(`Unable to read normalized source JSON: ${error.message}`);
  process.exit(2);
}

const candidate = generateSocialCandidate(source, args.type);
const rendered = `${JSON.stringify(candidate, null, 2)}\n`;

if (args.output) {
  const outputPath = path.resolve(args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered, 'utf8');
  console.log(`Social candidate written to ${outputPath}`);
} else {
  process.stdout.write(rendered);
}

if (candidate.state === 'blocked') process.exitCode = 1;
