// Offline execution of the *actual* GitHub Actions pre-paid step.
// Fake gh is the only executable named gh on PATH; no network or paid model calls.
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const wf = yaml.load(readFileSync(new URL('../../../.github/workflows/catalyst-brief.yml', import.meta.url), 'utf8'));
const steps = wf.jobs['research-and-publish'].steps;
const dedupe = steps.find(step => step.id === 'pending_catalyst');
const paid = steps.find(step => step.name === 'Fetch and analyze the catalyst');
const eligibility = steps.find(step => step.id === 'eligibility');
assert.ok(dedupe?.run && dedupe.run.includes('gh api --paginate --slurp'));
assert.equal(dedupe.if, "steps.candidate.outputs.has_candidate == 'true'");
assert.equal(paid?.if, "steps.candidate.outputs.has_candidate == 'true' && steps.pending_catalyst.outputs.needs_research == 'true'");
assert.equal(eligibility?.if, paid.if);

const work = mkdtempSync(path.join(os.tmpdir(), 'usd-catalyst-no-paid-'));
try {
  const bin = path.join(work, 'bin');
  mkdirSync(bin);
  const gh = path.join(bin, 'gh');
  writeFileSync(gh, [
    '#!/usr/bin/env node',
    "const args = process.argv.slice(2);",
    "if (args[0] !== 'api' || !args.includes('--paginate') || !args.includes('--slurp') || !args.includes('repos/usdimpact/usd-impact-site/pulls?state=open&per_page=100')) process.exit(7);",
    "if (process.env.MOCK_GH_FAIL === '1') process.exit(9);",
    "process.stdout.write(process.env.MOCK_GH_RESPONSE ?? '[]');",
    '',
  ].join('\n'));
  chmodSync(gh, 0o700);

  const slug = '2026-11-12-eia-wpsr-outcome';
  const candidatePath = path.join(work, 'catalyst-candidate.json');
  const outputPath = path.join(work, 'output');
  writeFileSync(candidatePath, JSON.stringify({ candidate: { slug } }));
  const own = ref => ({
    state: 'open',
    head: { ref, repo: { full_name: 'usdimpact/usd-impact-site' } },
    base: { ref: 'main' },
  });

  function scenario(label, response, expectedOutput, failGh = false) {
    writeFileSync(outputPath, '');
    const result = spawnSync('bash', ['-c', dedupe.run], {
      cwd: appRoot,
      encoding: 'utf8',
      timeout: 15000,
      env: {
        ...process.env,
        PATH: bin + path.delimiter + process.env.PATH,
        GITHUB_REPOSITORY: 'usdimpact/usd-impact-site',
        RUNNER_TEMP: work,
        GITHUB_OUTPUT: outputPath,
        MOCK_GH_RESPONSE: response,
        MOCK_GH_FAIL: failGh ? '1' : '0',
      },
    });
    const output = readFileSync(outputPath, 'utf8');
    if (expectedOutput === null) {
      assert.notEqual(result.status, 0, label + ': incomplete check must fail closed; ' + result.stderr);
      assert.doesNotMatch(output, /needs_research=true/, label + ': no paid research permission');
    } else {
      assert.equal(result.status, 0, label + ': unexpected shell error: ' + result.stderr);
      assert.match(output, new RegExp('^needs_research=' + expectedOutput + '$', 'm'), label);
    }
  }

  // Slurped GitHub pagination is an array of page arrays. A duplicate can
  // appear on page three and must still prevent the paid POST.
  const pages = [
    Array.from({ length: 100 }, (_, i) => own('unrelated-a-' + i)),
    Array.from({ length: 100 }, (_, i) => own('unrelated-b-' + i)),
    Array.from({ length: 37 }, (_, i) => own('unrelated-c-' + i)),
  ];
  pages[2][36] = own('automation/catalyst-brief-' + slug + '-4340012345');
  scenario('match on page three of 237 open PRs', JSON.stringify(pages), 'false');
  pages[2][36] = own('automation/catalyst-brief-' + slug.replace('-outcome', '-preview') + '-4340012345');
  scenario('different phase does not suppress valid event', JSON.stringify(pages), 'true');
  scenario('a full empty page is valid', JSON.stringify([[]]), 'true');

  // Empty *response* is not an empty *page*. Malformed output, partial gh API
  // failure and raw concatenated pages all block paid generation.
  scenario('zero pages', '[]', null);
  scenario('malformed response', '{"message":"rate limited"}', null);
  scenario('non-slurped page stream', '[][]', null);
  scenario('gh fails on pagination', JSON.stringify([[]]), null, true);
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log('Catalyst actual-shell pre-paid dedupe: 7 synthetic non-network cases PASS');
