import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  inspectPublicationDiff, parseAddedPublications, planPublicationCI, publicationContext,
  simplePublicationMarkdown, successfulFullBaseline,
} from './publication-ci-plan.mjs';
import { publicationCommands, runPublicationCommands, PUBLICATION_CONTRACTS } from './validate-publication-content.mjs';

const repository = 'usdimpact/usd-impact-site';
const now = Date.parse('2026-09-21T12:00:00Z');
const sample = '---\ntitle: "Synthetic fixture; not a real publication"\nslug: "/news/2026-09-21"\nstatus: "review"\nsources:\n  - id: "synthetic"\n    url: "https://www.federalreserve.gov/"\ncomplianceNote: "Education; not investment advice"\n---\n\nSynthetic test only.\n';
const daily = 'apps/web/src/content/news/2026-09-21.md';
const catalyst = 'apps/web/src/content/catalyst-briefs/2026-09-22-test-event-preview.md';
const zero = '0'.repeat(40);
const a = 'a'.repeat(40);
let count = 0;
function check(label, fn) {
  fn();
  count += 1;
  console.log(`PASS ${label}`);
}
function baseline(base, changes = {}) {
  return { total_count: 1, workflow_runs: [{ id: 100, path: '.github/workflows/quality.yml', name: 'Web quality',
    head_sha: base, head_branch: 'main', event: 'push', repository: { full_name: repository },
    status: 'completed', conclusion: 'success', updated_at: '2026-09-21T11:00:00Z', ...changes }] };
}
const temporary = mkdtempSync(join(tmpdir(), 'publication-ci-test-'));
const cwd = join(temporary, 'repo');
mkdirSync(cwd);
function git(...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}
function write(path, text = sample) { mkdirSync(dirname(join(cwd, path)), { recursive: true }); writeFileSync(join(cwd, path), text); }
function commit(message) { git('add', '-A'); git('commit', '-m', message); return git('rev-parse', 'HEAD'); }
let base;
function reset() { git('reset', '--hard', base); git('clean', '-fd'); git('update-ref', 'refs/remotes/origin/main', base); }
function context(head) { return { base, head, checkout: head, event: 'workflow_dispatch' }; }
function environment(head, changes = {}) {
  return { GITHUB_REPOSITORY: repository, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: head,
    PUBLICATION_POLICY_BASE_SHA: base, PUBLICATION_BASE_SHA: base, PUBLICATION_HEAD_SHA: head, ...changes };
}
function plan(head, changes = {}) {
  return planPublicationCI({ env: environment(head), cwd, now, loadRuns: () => baseline(base), ...changes });
}
try {
  git('init', '-b', 'main'); git('config', 'user.name', 'synthetic-test'); git('config', 'user.email', 'test@example.invalid');
  write('README.md', 'Synthetic repository.\n'); write('apps/web/src/content/news/2026-09-20.md', sample);
  base = commit('base'); git('update-ref', 'refs/remotes/origin/main', base);
  check('plain importer-style Markdown recognized', () => assert.equal(simplePublicationMarkdown(Buffer.from(sample)), true));
  for (const [label, value] of [
    ['raw HTML', sample + '<script>alert(1)</script>'],
    ['layout key', sample.replace('title:', 'layout: "../../evil.js"\ntitle:')],
    ['duplicate root key', sample.replace('title:', 'title: "duplicate"\ntitle:')],
    ['quoted root key', sample.replace('title:', '"title":')],
    ['YAML merge alias', sample.replace('title:', '<<: *defaults\ntitle:')],
    ['YAML tag', sample.replace('title: "Synthetic fixture; not a real publication"', 'title: !unsafe payload')],
    ['folded root scalar', sample.replace('title: "Synthetic fixture; not a real publication"', 'title: >\n  payload')],
    ['nested YAML tag', sample.replace('    url: "https://www.federalreserve.gov/"', '    url: !unsafe payload')],
    ['nested YAML alias', sample.replace('    url: "https://www.federalreserve.gov/"', '    url: *other')],
    ['nested folded scalar', sample.replace('    url: "https://www.federalreserve.gov/"', '    url: >\n      payload')],
    ['nested tab indentation', sample.replace('    url:', '\turl:')],
    ['nested malformed quoted scalar', sample.replace('    url: "https://www.federalreserve.gov/"', '    url: "unfinished')],
    ['missing frontmatter', 'plain content'],
    ['missing required field', sample.replace('sources:', 'assets:')],
    ['NUL byte', sample + '\0'],
    ['oversized content', sample + 'x'.repeat(262145)],
  ]) check(`non-fast content: ${label}`, () => assert.equal(simplePublicationMarkdown(Buffer.from(value)), false));
  check('nested lists, scores and calendar JSON recognized', () => assert.equal(simplePublicationMarkdown(Buffer.from(sample.replace('sources:',
    'assets:\n  - "USD"\ncatalysts:\n  - date: "2026-09-22"\n    impactScore: 4\n    extraBrief: true\n    calendar: {"series":"synthetic"}\n    sourceIds:\n      - "synthetic"\nsources:'))), true));
  check('invalid UTF-8 is not eligible', () => assert.equal(simplePublicationMarkdown(Buffer.from([255, 254])), false));
  const raw = `:000000 100644 ${zero} ${a} A\0${daily}\0`;
  check('exact NUL-delimited added file parsed', () => assert.equal(parseAddedPublications(raw)?.length, 1));
  for (const [label, text] of [
    ['truncated', raw.slice(0, -1)], ['empty', ''], ['duplicate path', raw + raw],
    ['more than 10 files', Array.from({ length: 11 }, (_, i) => raw.replace('2026-09-21', `2026-10-${String(i + 1).padStart(2, '0')}`)).join('')],
    ['modification', raw.replace(' A\0', ' M\0')], ['executable', raw.replace('100644', '100755')],
    ['symlink', raw.replace('100644', '120000')], ['MDX', raw.replace('.md\0', '.mdx\0')],
    ['newline path', raw.replace('.md\0', '\n.md\0')], ['path traversal', raw.replace('news/', 'news/../news/')],
    ['root file', raw.replace(daily, 'package.json')], ['renamed', raw.replace(' A\0', ' R100\0')],
  ]) check(`non-fast diff: ${label}`, () => assert.equal(parseAddedPublications(text), null));

  write(daily); let head = commit('add new Daily');
  check('new Daily with exact green full base gets content route', () => assert.equal(plan(head).route, 'content-only'));
  check('evidence binds base, head, paths and baseline run', () => assert.deepEqual(plan(head), {
    route: 'content-only', reason: 'verified-addition-only-diff', base, head, files: [daily], baselineRunId: 100,
  }));
  check('API outage selects full route', () => assert.equal(plan(head, { loadRuns: () => { throw new Error('unavailable'); } }).route, 'full'));
  check('red base selects full route', () => assert.equal(plan(head, { loadRuns: () => baseline(base, { conclusion: 'failure' }) }).route, 'full'));
  check('main push never opts into fast route', () => assert.equal(plan(head, { env: environment(head, { GITHUB_EVENT_NAME: 'push' }) }).route, 'full'));
  check('dispatch without exact inputs stays full', () => assert.equal(plan(head, { env: environment(head, { PUBLICATION_HEAD_SHA: '' }) }).route, 'full'));
  check('forged dispatch base stays full', () => assert.equal(plan(head, { env: environment(head, { PUBLICATION_BASE_SHA: a }) }).route, 'full'));
  check('other repository stays full', () => assert.equal(plan(head, { env: environment(head, { GITHUB_REPOSITORY: 'other/repo' }) }).route, 'full'));
  check('unknown event stays full', () => assert.equal(plan(head, { env: environment(head, { GITHUB_EVENT_NAME: 'merge_group' }) }).route, 'full'));
  check('checkout drift selects full', () => assert.equal(inspectPublicationDiff({ ...context(head), checkout: base }, cwd).route, 'full'));
  check('injection-shaped revision selects full', () => assert.equal(inspectPublicationDiff({ ...context(head), base: '--help' }, cwd).route, 'full'));
  git('update-ref', 'refs/remotes/origin/main', head);
  check('fetched base drift selects full', () => assert.equal(plan(head).route, 'full'));
  git('update-ref', 'refs/remotes/origin/main', base);

  const event = { pull_request: { state: 'open', base: { ref: 'main', sha: base, repo: { full_name: repository } }, head: { sha: head, repo: { full_name: repository } } } };
  check('same-repository current-base PR recognized', () => assert.equal(publicationContext(environment(head, { GITHUB_EVENT_NAME: 'pull_request' }), event)?.head, head));
  check('fork PR stays full', () => assert.equal(publicationContext(environment(head, { GITHUB_EVENT_NAME: 'pull_request' }), {
    pull_request: { ...event.pull_request, head: { ...event.pull_request.head, repo: { full_name: 'fork/repo' } } },
  }), null));
  check('stale PR base stays full', () => assert.equal(publicationContext(environment(head, { GITHUB_EVENT_NAME: 'pull_request' }), {
    pull_request: { ...event.pull_request, base: { ...event.pull_request.base, sha: a } },
  }), null));
  const merge = git('commit-tree', `${head}^{tree}`, '-p', base, '-p', head, '-m', 'synthetic PR merge');
  git('checkout', '--detach', merge);
  check('PR merge tree bound to base and content head is eligible', () => assert.equal(planPublicationCI({
    env: environment(head, { GITHUB_EVENT_NAME: 'pull_request', GITHUB_SHA: merge }), event, cwd, now, loadRuns: () => baseline(base),
  }).route, 'content-only'));
  const badMerge = git('commit-tree', `${base}^{tree}`, '-p', base, '-p', head, '-m', 'bad synthetic merge');
  git('checkout', '--detach', badMerge);
  check('PR merge tree drift stays full', () => assert.equal(inspectPublicationDiff({ ...context(head), checkout: badMerge, event: 'pull_request' }, cwd).route, 'full'));

  reset(); write(catalyst); head = commit('add Catalyst');
  check('new dated Catalyst preview is eligible', () => assert.equal(plan(head).route, 'content-only'));
  reset(); write(daily); write('apps/web/src/lib/changed.js', 'export const changed = true;\n'); head = commit('mixed content and code');
  check('mixed code and content stays full', () => assert.equal(plan(head).route, 'full'));
  reset(); write('apps/web/src/content/news/2026-09-20.md', sample + '\ncorrection'); head = commit('edit existing article');
  check('corrections stay full', () => assert.equal(plan(head).route, 'full'));
  reset(); rmSync(join(cwd, 'apps/web/src/content/news/2026-09-20.md')); head = commit('delete article');
  check('deletions stay full', () => assert.equal(plan(head).route, 'full'));
  reset(); git('mv', 'apps/web/src/content/news/2026-09-20.md', daily); head = commit('rename article');
  check('rename cannot masquerade as an addition', () => assert.equal(plan(head).route, 'full'));
  reset(); mkdirSync(dirname(join(cwd, daily)), { recursive: true }); symlinkSync('../../../../README.md', join(cwd, daily)); head = commit('symlink article');
  check('symlink stays full', () => assert.equal(plan(head).route, 'full'));
  reset(); write(daily); chmodSync(join(cwd, daily), 0o755); head = commit('executable article');
  check('executable content stays full', () => assert.equal(plan(head).route, 'full'));
  reset(); write(daily, sample + '<iframe src="https://example.invalid"></iframe>'); head = commit('HTML article');
  check('raw HTML real Git blob stays full', () => assert.equal(plan(head).route, 'full'));
  reset();
  check('empty diff stays full', () => assert.equal(plan(base).route, 'full'));
  const oldBase = base; write('README.md', 'changed base'); const futureBase = commit('base advanced');
  git('reset', '--hard', oldBase); write(daily); head = commit('diverged content');
  git('update-ref', 'refs/remotes/origin/main', futureBase);
  check('non-ancestor base stays full without throwing', () => assert.equal(planPublicationCI({
    env: environment(head, { PUBLICATION_BASE_SHA: futureBase, PUBLICATION_POLICY_BASE_SHA: futureBase }), cwd, now, loadRuns: () => baseline(futureBase),
  }).route, 'full'));

  check('green base accepted', () => assert.equal(successfulFullBaseline(baseline(base), base, now), 100));
  for (const [label, changes] of [
    ['wrong SHA', { head_sha: a }], ['wrong branch', { head_branch: 'topic' }], ['PR instead of full main push', { event: 'pull_request' }],
    ['manual instead of full main push', { event: 'workflow_dispatch' }], ['pending', { status: 'in_progress', conclusion: null }],
    ['failure', { conclusion: 'failure' }], ['cancelled', { conclusion: 'cancelled' }], ['action_required', { conclusion: 'action_required' }],
    ['skipped', { conclusion: 'skipped' }], ['neutral', { conclusion: 'neutral' }], ['future timestamp', { updated_at: '2026-09-22T12:00:00Z' }],
    ['stale timestamp', { updated_at: '2026-09-17T12:00:00Z' }], ['wrong repository', { repository: { full_name: 'other/repo' } }],
  ]) check(`base refused: ${label}`, () => assert.equal(successfulFullBaseline(baseline(base, changes), base, now), null));
  check('newest failed quality run cannot reuse older green', () => {
    const payload = baseline(base); payload.workflow_runs.push({ ...payload.workflow_runs[0], id: 101, conclusion: 'failure' }); payload.total_count = 2;
    assert.equal(successfulFullBaseline(payload, base, now), null);
  });
  check('truncated API evidence cannot opt in', () => assert.equal(successfulFullBaseline({ ...baseline(base), total_count: 2 }, base, now), null));
  check('over-limit API evidence cannot opt in', () => assert.equal(successfulFullBaseline({ ...baseline(base), total_count: 101 }, base, now), null));
  check('malformed API evidence cannot opt in', () => assert.equal(successfulFullBaseline({}, base, now), null));
  check('preflight retains all five factual/content groups', () => assert.deepEqual(publicationCommands('--preflight').map(([, args]) => args[1]),
    ['validate:content', 'validate:news', 'validate:compliance', 'validate:links', 'validate:publishing']));
  check('ten publishing source/importer contracts are retained', () => assert.equal(PUBLICATION_CONTRACTS.length, 10));
  check('unknown runner modes are rejected', () => assert.throws(() => publicationCommands('--skip-facts')));
  check('runner stops on first failed command', () => {
    let calls = 0;
    assert.throws(() => runPublicationCommands(publicationCommands('--preflight'), () => ({ status: ++calls === 2 ? 1 : 0 })));
    assert.equal(calls, 2);
  });
  check('runner treats signals and missing commands as failures', () => assert.throws(() => runPublicationCommands(publicationCommands('--contracts'), () => ({ status: null, error: new Error('missing') }))));
  console.log(`publication CI plan: ${count} checks passed; synthetic local Git fixtures only`);
} finally { rmSync(temporary, { recursive: true, force: true }); }
