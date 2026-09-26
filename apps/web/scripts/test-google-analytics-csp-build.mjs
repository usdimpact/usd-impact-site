import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'parse5';
import { inspectInlineScriptCsp } from './csp-inline-script-contract.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const nodeModules = path.join(webRoot, 'node_modules');
const astroRoot = path.join(nodeModules, 'astro');
const astroPackage = JSON.parse(readFileSync(path.join(astroRoot, 'package.json'), 'utf8'));
const cli = path.join(astroRoot, typeof astroPackage.bin === 'string' ? astroPackage.bin : astroPackage.bin.astro);
const source = readFileSync(path.join(webRoot, 'src/components/GoogleAnalyticsClient.astro'), 'utf8');
const parent = mkdtempSync(path.join(tmpdir(), 'usd-impact-ga4-csp-'));
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
const fixtureOrigin = 'https://ga4-csp-fixture.invalid';
const sameOriginScript = (src) => src === undefined || new URL(src, fixtureOrigin).origin === fixtureOrigin;
assert(sameOriginScript(undefined));
assert(sameOriginScript('/_astro/client.js'));
for (const src of [
  'https://www.googletagmanager.com/gtag/js',
  '//www.googletagmanager.com/gtag/js',
  'https://www.googletagmanager.com.other.invalid/script.js',
  'https://other.invalid/path/www.googletagmanager.com/script.js',
  'https://ga4-csp-fixture.invalid.other.invalid/script.js',
]) assert.equal(sameOriginScript(src), false, 'Only an exact fixture origin is permitted');
const allNodes = (document) => {
  const result = [];
  function walk(node) { result.push(node); for (const child of node.childNodes ?? []) walk(child); }
  walk(document);
  return result;
};
let cases = 0;
try {
  for (const [label, measurementId, succeeds] of [
    ['configured', 'G-CSPTEST01', true],
    ['unconfigured', '', true],
    ['invalid', 'NOT-A-GA4-ID', false],
  ]) {
    const root = path.join(parent, label);
    mkdirSync(path.join(root, 'src/components'), { recursive: true });
    mkdirSync(path.join(root, 'src/pages'), { recursive: true });
    mkdirSync(path.join(root, 'home'));
    symlinkSync(nodeModules, path.join(root, 'node_modules'), 'dir');
    writeFileSync(path.join(root, 'package.json'), '{"name":"ga4-csp-fixture","type":"module","private":true}');
    // Copy the actual component without replacing its environment-variable expression.
    writeFileSync(path.join(root, 'src/components/GoogleAnalyticsClient.astro'), source);
    const originalConfig = pathToFileURL(path.join(webRoot, 'astro.config.mjs')).href;
    writeFileSync(path.join(root, 'astro.config.mjs'),
      `import original from ${JSON.stringify(originalConfig)};\n`
      + 'export default { output: "static", site: original.site, security: original.security };\n');
    writeFileSync(path.join(root, 'src/pages/index.astro'),
      '---\nimport GoogleAnalyticsClient from "../components/GoogleAnalyticsClient.astro";\n---\n'
      + '<html lang="en"><head><meta charset="utf-8" /><title>Synthetic CSP test</title></head>'
      + '<body><GoogleAnalyticsClient /></body></html>');
    // A synthetic reproduction of the former implicit-inline form must remain detectable.
    writeFileSync(path.join(root, 'src/pages/legacy.astro'),
      '---\nconst measurementId = import.meta.env.PUBLIC_GA4_MEASUREMENT_ID ?? "";\n---\n'
      + '<html><head><title>Negative fixture</title></head><body>'
      + '{measurementId && (<script define:vars={{ measurementId }}>window.__legacyCspFixture = measurementId;</script>)}'
      + '</body></html>');
    const build = spawnSync(process.execPath, [cli, 'build', '--root', root], {
      cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024,
      // No provider tokens, customer data, real analytics ID or original .env files are copied.
      env: { PATH: process.env.PATH, HOME: path.join(root, 'home'), TMPDIR: parent,
        CI: 'true', ASTRO_TELEMETRY_DISABLED: '1', PUBLIC_GA4_MEASUREMENT_ID: measurementId },
    });
    assert.ifError(build.error);
    if (!succeeds) {
      assert.notEqual(build.status, 0, 'Invalid measurement ID must fail the build');
      assert.match(build.stdout + build.stderr, /PUBLIC_GA4_MEASUREMENT_ID must be a GA4 Measurement ID/);
      cases += 1;
      continue;
    }
    assert.equal(build.status, 0, `${label} Astro fixture build failed:\n${build.stdout}\n${build.stderr}`);
    const html = readFileSync(path.join(root, 'dist/index.html'), 'utf8');
    const inspection = inspectInlineScriptCsp(html);
    assert.deepEqual(inspection.failures, [], `${label}: ${inspection.failures.join('; ')}`);
    const nodes = allNodes(parse(html));
    const config = nodes.filter((node) => attr(node, 'id') === 'usd-impact-ga4-config');
    assert.equal(config.length, measurementId ? 1 : 0, 'Only configured builds emit the inert configuration');
    if (measurementId) {
      assert.equal(config[0].tagName, 'span');
      assert.notEqual(attr(config[0], 'hidden'), undefined);
      assert.equal(attr(config[0], 'data-measurement-id'), measurementId);
    }
    const scripts = nodes.filter((node) => node.tagName === 'script');
    let clients = 0;
    for (const script of scripts) {
      const src = attr(script, 'src');
      let body;
      if (src !== undefined) {
        assert(src.startsWith('/_astro/') && !src.includes('..') && !/[?#]/.test(src),
          'Fixture executable resources must be local Astro build assets');
        body = readFileSync(path.join(root, 'dist', src.slice(1)), 'utf8');
      } else {
        body = (script.childNodes ?? []).map((node) => node.value ?? '').join('');
      }
      if (body.includes('usd-impact-ga4-config')) clients += 1;
    }
    assert.equal(clients, 1, 'The actual processed GA4 client must be emitted exactly once');
    assert(scripts.every((script) => sameOriginScript(attr(script, 'src'))),
      'Static HTML must not load any third-party script before consent');
    const mutation = html.replace('</body>', '<script>window.__unhashedFixture = true;</script></body>');
    assert(inspectInlineScriptCsp(mutation).failures.some((message) => message.includes('lacks an exact CSP hash')),
      'Adding one unhashed executable script must fail the rendered check');
    if (measurementId) {
      const legacy = readFileSync(path.join(root, 'dist/legacy/index.html'), 'utf8');
      assert(inspectInlineScriptCsp(legacy).failures.some((message) => message.includes('lacks an exact CSP hash')),
        'The old define:vars shape must reproduce the rejected inline-script condition');
    }
    cases += 1;
  }
} finally {
  rmSync(parent, { recursive: true, force: true });
}
console.log(`GA4 CSP build: ${cases} real Astro fixture cases passed; no browser, Google requests or persistent fixtures.`);
