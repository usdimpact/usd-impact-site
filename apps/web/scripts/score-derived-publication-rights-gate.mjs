import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultGatePath = path.resolve(scriptDir, '..', '..', '..', 'governance', 'score-derived-publication-rights-gate.json');

export function evaluateGate(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { hold: true, state: 'hold', reason: 'missing_or_malformed_gate' };
  }

  if (payload.version !== 1) {
    return { hold: true, state: 'hold', reason: 'unsupported_rights_gate_version' };
  }

  const state = payload.state;
  if (state === 'hold') {
    return {
      hold: true,
      state: 'hold',
      reason: typeof payload.reason === 'string' && payload.reason ? payload.reason : 'rights_review_hold',
    };
  }

  if (state === 'allow') {
    // Version 1 has no source-specific, derivative-distribution, retention,
    // or owner Production authorization contract. A GitHub issue receipt is
    // review evidence, never a market-data license or publication release.
    return { hold: true, state: 'hold', reason: 'v1_allow_not_an_authorized_release_contract' };
  }

  return { hold: true, state: 'hold', reason: 'unknown_gate_state' };
}

export function readGate(gatePath = defaultGatePath) {
  try {
    const raw = fs.readFileSync(gatePath, 'utf8');
    return evaluateGate(JSON.parse(raw));
  } catch {
    return { hold: true, state: 'hold', reason: 'missing_or_malformed_gate' };
  }
}

function writeGithubOutput(result) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required for --github-output');
  const safeReason = String(result.reason).replace(/[\r\n]+/g, ' ');
  fs.appendFileSync(outputPath, `hold=${result.hold ? 'true' : 'false'}\nstate=${result.state}\nreason=${safeReason}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = readGate();
  if (process.argv.includes('--github-output')) writeGithubOutput(result);
  console.log(JSON.stringify(result));
}
