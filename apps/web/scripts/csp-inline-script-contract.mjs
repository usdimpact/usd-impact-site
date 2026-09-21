import { createHash } from 'node:crypto';
import { parse } from 'parse5';

// Build-only inspection. Parsing never executes scripts or fetches their URLs.
const DATA_TYPES = new Set(['application/ld+json', 'application/json']);
const SCRIPT_TYPES = new Set([
  '', 'module', 'text/javascript', 'application/javascript',
  'text/ecmascript', 'application/ecmascript', 'application/x-javascript',
  'application/x-ecmascript', 'text/x-javascript', 'text/x-ecmascript',
  'text/jscript', 'text/livescript',
  ...['1.0', '1.1', '1.2', '1.3', '1.4', '1.5'].map((v) => `text/javascript${v}`),
]);
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;

export function scriptHash(body, algorithm = 'sha384') {
  return `${algorithm}-${createHash(algorithm).update(body, 'utf8').digest('base64')}`;
}

export function inspectInlineScriptCsp(html) {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    // Template content and noscript text are inert in a scripting-enabled document.
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(document);
  const policies = nodes.filter((node) => node.tagName === 'meta'
    && attr(node, 'http-equiv')?.toLowerCase() === 'content-security-policy');
  const failures = [];
  if (policies.length !== 1 || policies[0].parentNode?.tagName !== 'head') {
    return { failures: ['Expected exactly one CSP meta element in head.'], inlineCount: 0 };
  }
  const policy = policies[0];
  const directives = new Map();
  for (const part of (attr(policy, 'content') ?? '').split(';')) {
    const tokens = part.trim().split(/\s+/);
    const name = tokens.shift().toLowerCase();
    if (!name) continue;
    if (directives.has(name)) failures.push(`Duplicate CSP directive: ${name}.`);
    else directives.set(name, tokens);
  }
  const allowed = directives.get('script-src-elem')
    ?? directives.get('script-src') ?? directives.get('default-src');
  if (!allowed) failures.push('No effective script-element CSP directive.');
  for (const name of ['script-src-elem', 'script-src', 'default-src']) {
    const tokens = directives.get(name) ?? [];
    if (tokens.some((token) => ["'unsafe-inline'", "'unsafe-eval'"].includes(token.toLowerCase()))) {
      failures.push(`Unsafe JavaScript permission in ${name}.`);
    }
  }
  let inlineCount = 0;
  for (const node of nodes.filter((item) => item.tagName === 'script')) {
    if (attr(node, 'src') !== undefined) continue; // External resources have a separate policy boundary.
    const type = (attr(node, 'type') ?? '').trim().toLowerCase();
    if (DATA_TYPES.has(type)) continue;
    if (!SCRIPT_TYPES.has(type)) {
      failures.push('Unclassified inline script type; explicit policy review required.');
      continue;
    }
    const body = (node.childNodes ?? []).map((child) => child.value ?? '').join('');
    if (!body.trim()) continue;
    inlineCount += 1;
    if (node.sourceCodeLocation?.startOffset < policy.sourceCodeLocation?.endOffset) {
      failures.push(`Inline script ${inlineCount} precedes the CSP meta element.`);
    }
    // This static-site contract requires exact hashes; a static nonce is not a substitute.
    const authorized = ['sha256', 'sha384', 'sha512']
      .some((algorithm) => allowed?.includes(`'${scriptHash(body, algorithm)}'`));
    if (!authorized) {
      failures.push(`Inline script ${inlineCount} lacks an exact CSP hash (${scriptHash(body)}).`);
    }
  }
  return { failures, inlineCount };
}
