import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultGatePath = path.resolve(scriptDir, '..', '..', '..', 'governance', 'score-derived-publication-rights-gate.json');

export function evaluateGate(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { hold: true, state: 'hold', reason: 'missing_or_malformed_gate' };
  }

  const state = payload.state;
  if (state === 'hold') {
    return {
      hold: true,
      state: 'hold',
      reason: typeof payload.reason === 'string' && payload.reason ? payload.reason : 'rights_review_hold',
    };
  }

  if (state !== 'allow') {
    return { hold: true, state: 'hold', reason: 'unknown_gate_state' };
  }

  const approver = payload.approved_by;
  const receipt = payload.decision_receipt;
  const receiptOk = typeof receipt === 'string'
    && /^https:\/\/github\.com\/usdimpact\/[A-Za-z0-9_.-]+\/(?:issues|pull)\/\d+$/.test(receipt);
  const approverOk = typeof approver === 'string' && approver.trim().length > 0;

  if (!receiptOk || !approverOk) {
    return { hold: true, state: 'hold', reason: 'allow_missing_approval_receipt' };
  }

  return { hold: false, state: 'allow', reason: 'approved' };
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
