import assert from 'node:assert/strict';
import { inspectInlineScriptCsp, scriptHash } from './csp-inline-script-contract.mjs';

const body = 'window.fixture = "no network";';
const tag = (value = body, attributes = '') => `<script${attributes}>${value}</script>`;
const policy = (value) => `<meta http-equiv="Content-Security-Policy" content="${value}">`;
const page = (scripts, directive = `script-src-elem 'self' '${scriptHash(body)}'`) =>
  `<!doctype html><html><head>${policy(directive)}</head><body>${scripts}</body></html>`;
let checks = 0;
function check(label, html, valid, count) {
  const result = inspectInlineScriptCsp(html);
  assert.equal(result.failures.length === 0, valid, `${label}: ${result.failures.join('; ')}`);
  if (count !== undefined) assert.equal(result.inlineCount, count, label);
  checks += 1;
}
for (const algorithm of ['sha256', 'sha384', 'sha512']) {
  check(algorithm, page(tag(), `script-src-elem '${scriptHash(body, algorithm)}'`), true, 1);
}
check('module', page(tag(body, ' type="module"')), true, 1);
check('classic MIME', page(tag(body, ' type="text/javascript"')), true, 1);
check('unquoted attribute', page(tag(body, ' type=module')), true, 1);
check('case-insensitive MIME', page(tag(body, ' type="TEXT/JAVASCRIPT"')), true, 1);
check('wrong hash', page(tag(), "script-src-elem 'sha384-incorrect'"), false);
check('one authorized does not cover a second script', page(tag() + tag('window.second = 1;')), false, 2);
check('whitespace is significant', page(tag(` ${body}`)), false);
check('trailing newline significant', page(tag(`${body}\n`)), false);
const multiline = `${body}\nwindow.second = 1;`;
check('HTML newline normalization', page(tag(multiline.replaceAll('\n', '\r\n')),
  `script-src-elem '${scriptHash(multiline)}'`), true);
const entityBody = 'window.fixture = "&amp;";';
check('script raw text is not entity-decoded', page(tag(entityBody),
  `script-src-elem '${scriptHash(entityBody)}'`), true);
check('script-src fallback', page(tag(), `script-src '${scriptHash(body)}'`), true);
check('default-src fallback', page(tag(), `default-src '${scriptHash(body)}'`), true);
check('element directive overrides script directive', page(tag(),
  `script-src '${scriptHash(body)}'; script-src-elem 'self'`), false);
check('empty element directive cannot fallback', page(tag(),
  `script-src '${scriptHash(body)}'; script-src-elem`), false);
check('style hash is not script authority', page(tag(),
  `script-src-elem 'self'; style-src '${scriptHash(body)}'`), false);
check('unrestricted inline is not a repair', page(tag(), "script-src-elem 'unsafe-inline'"), false);
check('unsafe-eval is forbidden even with exact hash', page(tag(),
  `script-src-elem '${scriptHash(body)}' 'unsafe-eval'`), false);
check('duplicate directives rejected', page(tag(),
  `script-src-elem '${scriptHash(body)}'; script-src-elem 'self'`), false);
check('nonce is not a static-site hash substitute', page(tag(body, ' nonce="test-nonce"'),
  "script-src-elem 'nonce-test-nonce'"), false);
check('JSON-LD is inert', page(tag('{"@context":"https://schema.org"}', ' type="application/ld+json"')), true, 0);
check('configuration JSON is inert', page(tag('{}', ' type="application/json"')), true, 0);
check('unknown type does not silently pass', page(tag(body, ' type="importmap"')), false);
check('external script is not an inline body', page(tag(body, ' src="/client.js"')), true, 0);
check('comments do not create scripts', page(`<!--${tag('not executable')}-->${tag()}`), true, 1);
check('quoted tag-like attribute does not create script', page(`<div title='${tag('not executable')}'></div>${tag()}`), true, 1);
check('template is inert until separately activated', page(`<template>${tag('not executable')}</template>${tag()}`), true, 1);
check('empty scripts', page(tag(' \n\t')), true, 0);
check('no meta', `<!doctype html><html><body>${tag()}</body></html>`, false);
check('policy in comment not accepted', `<!doctype html><html><head><!--${policy('script-src-elem self')}--></head><body>${tag()}</body></html>`, false);
check('multiple policies fail closed', page(tag()).replace('</head>', `${policy("script-src-elem 'self'")}</head>`), false);
check('late policy', `<!doctype html><html><head>${tag()}${policy(`script-src-elem '${scriptHash(body)}'`)}</head></html>`, false);
console.log(`Inline CSP contract: ${checks} cases passed (no script execution).`);
