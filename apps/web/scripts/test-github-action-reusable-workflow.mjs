import assert from 'node:assert/strict';

// Called by the normal runtime gate; fixtures are text only, never executed YAML.
export function runReusableWorkflowPolicyRegressions(validate, sources) {
  const caller = 'publication-oidc-rehearsal-controller.yml';
  const runner = 'publication-oidc-rehearsal-runner.yml';
  const pin = 'e0dda44455cdc6742fba2755b84f9997fecf2b7f';
  const target = `usdimpact/usd-impact-site/.github/workflows/${runner}@${pin}`;
  let count = 0;
  function test(name, work) {
    try { work(); count += 1; } catch (error) { error.message = `${name}: ${error.message}`; throw error; }
  }
  const original = new Map(sources);
  const ordinary = new Map(sources);
  ordinary.delete(caller); ordinary.delete(runner);
  test('existing workflows still pass without the optional rehearsal pair', () => {
    assert.equal(validate(ordinary).reusableWorkflowCount, 0);
  });
  function reject(name, mutate, pattern) {
    test(name, () => {
      const candidate = new Map(original);
      mutate(candidate);
      assert.throws(() => validate(candidate), pattern);
    });
  }
  function replace(candidate, file, before, after) {
    const source = candidate.get(file);
    assert.equal(typeof source, 'string');
    assert.ok(source.includes(before), `Fixture must contain ${before}`);
    const changed = source.replace(before, after);
    assert.notEqual(changed, source);
    candidate.set(file, changed);
  }
  function addUse(candidate, value) {
    candidate.set('unreviewed-caller.yml', `jobs:\n  other:\n    uses: ${value}\n`);
  }
  if (sources.has(caller) && sources.has(runner)) {
    test('exact reviewed pair has one reusable call and preserves action counts', () => {
      const baseline = validate(ordinary); const result = validate(original);
      assert.equal(result.reusableWorkflowCount, 1);
      for (const [action, n] of baseline.actionCounts) {
        assert.equal(result.actionCounts.get(action), n + (action === 'actions/setup-node' ? 1 : 0));
      }
      assert.equal(result.strictInstallCount, baseline.strictInstallCount);
      assert.equal(result.node24Count, baseline.node24Count + 1);
    });
    for (const [name, before, after] of [
      ['branch', pin, 'main'], ['tag', pin, 'v1'], ['other SHA', pin, '0'.repeat(40)],
      ['short SHA', pin, pin.slice(0, 7)], ['SHA suffix', pin, `${pin}/extra`],
      ['other path', runner, 'other.yml'], ['path traversal', runner, `../${runner}`],
      ['other owner', 'usdimpact/usd-impact-site/', 'other/usd-impact-site/'],
      ['other repository', 'usdimpact/usd-impact-site/', 'usdimpact/other/'],
      ['local unpinned call', target, `./.github/workflows/${runner}`],
      ['quoted changed reference', target, `'usdimpact/usd-impact-site/.github/workflows/${runner}@main'`],
      ['folded changed reference', target, `>\n      usdimpact/usd-impact-site/.github/workflows/${runner}@main`],
      ['flow changed reference', `uses: ${target}`, `uses: [${target}]`],
      ['caller permission', 'id-token: write', 'contents: write'],
      ['caller trigger', 'workflow_dispatch:', 'push:'],
      ['caller input pin', `runner_sha: ${pin}`, `runner_sha: ${'f'.repeat(40)}`],
      ['duplicate call', `uses: ${target}`, `uses: ${target}\n    uses: ${target}`],
    ]) {
      reject(`reject ${name}`, (x) => replace(x, caller, before, after), /differs from the reviewed/);
    }
    for (const file of [caller, runner]) {
      reject(`reject missing ${file}`, (x) => x.delete(file), /Missing reviewed rehearsal/);
      reject(`reject renamed ${file}`, (x) => { x.set(`renamed-${file}`, x.get(file)); x.delete(file); }, /Missing reviewed rehearsal/);
      reject(`reject extra bytes in ${file}`, (x) => x.set(file, `${x.get(file)}\n# changed\n`), /differs from the reviewed/);
    }
    reject('reject runner permission change', (x) => replace(x, runner, 'id-token: write', 'contents: write'), /differs from the reviewed/);
    reject('reject runner trigger change', (x) => replace(x, runner, 'workflow_call:', 'workflow_dispatch:'), /differs from the reviewed/);
    reject('reject exact reference from another caller', (x) => addUse(x, target), /restricted to the reviewed caller/);
    reject('reject other workflow in the same repository', (x) => addUse(x, target.replace(runner, 'other.yml')), /restricted to the reviewed caller/);
  }
  reject('reject unrelated action repository', (x) => addUse(x, `other/unreviewed@${'a'.repeat(40)}`), /uses unapproved action/);
  for (const action of ['actions/checkout', 'actions/setup-node', 'actions/upload-artifact', 'github/codeql-action', 'actions/dependency-review-action']) {
    reject(`preserve reviewed pin for ${action}`, (x) => {
      const file = [...ordinary.keys()].find((name) => ordinary.get(name).includes(`${action}/`) || ordinary.get(name).includes(`${action}@`));
      assert.ok(file, `Fixture needs ${action}`);
      const source = x.get(file);
      const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const changed = source.replace(new RegExp(`(${escaped}(?:/[A-Za-z0-9_./-]+)?@)[a-f0-9]{40}`), `$1${'a'.repeat(40)}`);
      assert.notEqual(changed, source);
      x.set(file, changed);
    }, /must use the reviewed/);
  }
  reject('preserve Node 24 requirement', (x) => replace(x, 'quality.yml', 'node-version: 24.x', 'node-version: 22.x'), /must use Node 24/);
  reject('preserve unsecure-runtime prohibition', (x) => x.set('quality.yml', `${x.get('quality.yml')}\nACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: true\n`), /must not bypass/);
  reject('preserve strict npm install requirement', (x) => replace(x, 'quality.yml', '--strict-allow-scripts', ''), /must fail closed on unreviewed dependency install scripts/);

  // R560-01: NEW files are not protected by the reviewed caller's fingerprint.
  const extraCaller = (entry) => `name: Additional caller\non: workflow_dispatch\njobs:\n  extra:\n    permissions: {id-token: write}\n    ${entry}\n    with: {runner_sha: '${pin}', approved_main_sha: '${'a'.repeat(40)}', approved_until: '2026-09-10T15:00:00.000Z'}\n`;
  const rejectFile = (name, text, pattern = /restricted to the reviewed caller/) =>
    reject(name, (x) => x.set('additional-caller.yml', text), pattern);
  for (const [name, entry] of [
    ['plain', `uses: ${target}`],
    ['single-quoted', `uses: '${target}'`],
    ['double-quoted', `uses: "${target}"`],
    ['quoted key', `'uses': ${target}`],
    ['escaped key', `"u\\u0073es": "${target}"`],
    ['escaped value', `uses: "${target.replace('usdimpact', '\\u0075sdimpact')}"`],
    ['folded', `uses: >-\n      ${target}`],
    ['literal', `uses: |-\n      ${target}`],
    ['explicit key', `? uses\n    : '${target}'`],
    ['scalar alias', `name: &reference '${target}'\n    uses: *reference`],
  ]) rejectFile(`reject new ${name} caller`, extraCaller(entry));
  rejectFile('reject flow-mapping caller', `jobs: {extra: {uses: '${target}', with: {runner_sha: '${pin}'}}}\n`);
  rejectFile('reject JSON caller', JSON.stringify({jobs: {extra: {uses: target}}}));
  rejectFile('reject quoted jobs and job keys', `"jobs": {"extra": {"uses": "${target}"}}\n`);
  for (const [name, value] of [
    ['local relative', `./.github/workflows/${runner}`],
    ['local dollar', `$/.github/workflows/${runner}`],
    ['branch ref', target.replace(pin, 'main')],
    ['tag ref', target.replace(pin, 'v1')],
    ['expression', '${{ inputs.runner }}'],
    ['trailing newline', `|\n      ${target}`],
    ['split folded reference', `>-\n      usdimpact/\n      usd-impact-site/.github/workflows/${runner}@${pin}`],
  ]) rejectFile(`reject unsupported ${name}`, extraCaller(`uses: ${value}`), /supported immutable/);
  for (const [name, text] of [
    ['duplicate uses', extraCaller(`uses: '${target}'\n    uses: '${target}'`)],
    ['duplicate jobs', `jobs: {one: {uses: '${target}'}}\njobs: {two: {uses: '${target}'}}`],
    ['multiple documents', `jobs: {one: {uses: '${target}'}}\n---\njobs: {two: {uses: '${target}'}}`],
    ['invalid syntax', 'jobs: {'],
    ['unknown tag', extraCaller(`uses: !unknown '${target}'`)],
  ]) rejectFile(`reject ${name}`, text, /invalid or unsupported workflow YAML/);
  for (const [name, text, pattern] of [
    ['non-scalar uses', extraCaller(`uses: ['${target}']`), /reference must be a string/],
    ['map uses', extraCaller(`uses: {value: '${target}'}`), /reference must be a string/],
    ['jobs sequence', 'jobs: []', /jobs mapping/],
    ['step map', 'jobs: {extra: {steps: {uses: anything}}}', /steps must be a sequence/],
    ['scalar job', 'jobs: {extra: nope}', /job extra must be a mapping/],
    ['merge key', `jobs: {extra: {<<: {uses: '${target}'}}}`, /unsupported merge/],
    ['cyclic alias', 'jobs: &jobs {extra: *jobs}', /cyclic or shared/],
    ['shared job alias', `jobs: {a: &job {uses: '${target}'}, b: *job}`, /cyclic or shared/],
    ['mixed job', `jobs: {extra: {uses: '${target}', steps: []}}`, /cannot mix reusable/],
    ['workflow as action', `jobs: {extra: {steps: [{uses: '${target}'}]}}`, /must be a job/],
    ['reserved key', 'jobs: {extra: {constructor: anything}}', /reserved key/],
    ['empty document', '# comment only', /jobs mapping/],
    ['oversize document', '#'.repeat(1048577), /source limit/],
  ]) rejectFile(`reject ${name}`, text, pattern);
  const checkout = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
  for (const [name, entry] of [
    ['quoted action', `uses: '${checkout}'`],
    ['escaped action key', `"u\\u0073es": "${checkout}"`],
    ['folded action', `uses: >-\n          ${checkout}`],
  ]) test(`accept reviewed ${name}`, () => {
    const candidate = new Map(original);
    candidate.set('additional-action.yml', `jobs:\n  extra:\n    steps:\n      - ${entry}\n`);
    assert.equal(validate(candidate).actionCounts.get('actions/checkout'), validate(original).actionCounts.get('actions/checkout') + 1);
  });
  test('accept reviewed flow action', () => {
    const candidate = new Map(original);
    candidate.set('additional-action.yml', `jobs: {extra: {steps: [{uses: '${checkout}'}]}}`);
    assert.equal(validate(candidate).actionCounts.get('actions/checkout'), validate(original).actionCounts.get('actions/checkout') + 1);
  });
  test('script text and comments cannot create phantom references', () => {
    const candidate = new Map(original);
    candidate.set('script-only.yml', `# uses: other/ignored@main\njobs:\n  extra:\n    steps:\n      - run: |\n          echo "uses: ${target}"\n          echo "jobs: {extra: {uses: untrusted}}"\n`);
    assert.equal(validate(candidate).reusableWorkflowCount, validate(original).reusableWorkflowCount);
  });

  test('test fixtures do not mutate the real workflow snapshot', () => assert.deepEqual(sources, original));
  return count;
}
