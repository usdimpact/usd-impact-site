import { hold } from './publication-calendar.js';

/** Parse only the bounded JSON-scalar/block-container dialect emitted by the importers.
 * Reject unsupported YAML instead of inferring publication status or silently losing fields.
 * Unchanged archives never need to enter this parser in the release preflight.
 */
export function parsePublicationCalendarSource(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > 256000) hold('HOLD_SOURCE_SCHEMA', 'Publication source exceeds its bound.');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match || /\t/.test(match[1])) hold('HOLD_SOURCE_SCHEMA', 'A bounded, unambiguous publication frontmatter block is required.');
  const tokens = [];
  for (const line of match[1].split(/\r?\n/).filter((value) => value.trim())) {
    const indent = line.length - line.trimStart().length;
    const text = line.slice(indent).trimEnd();
    if (indent % 2 || indent > 24 || line.slice(0, indent) !== ' '.repeat(indent)) hold('HOLD_SOURCE_SCHEMA', 'Unsupported publication indentation.');
    if (/^- [A-Za-z][A-Za-z0-9]*:/.test(text)) {
      tokens.push({ indent, text: '-' }, { indent: indent + 2, text: text.slice(2) });
    } else tokens.push({ indent, text });
  }
  if (tokens.length > 10000 || !tokens.length || tokens[0].indent !== 0) hold('HOLD_SOURCE_SCHEMA', 'Unsupported publication source shape.');
  let index = 0;
  function scalar(value) {
    try {
      const parsed = JSON.parse(value);
      // JSON.parse alone would erase duplicate keys before the YAML consumer sees them.
      const lexical = [...value.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/g)].map((item) => item[0]);
      const stack = [];
      for (let i = 0; i < lexical.length; i++) {
        const token = lexical[i];
        if (token === '{' || token === '[') {
          if (stack.length >= 12) throw new Error('depth');
          stack.push(token === '{' ? new Set() : null);
        } else if (token === '}' || token === ']') stack.pop();
        else if (token.startsWith('"') && lexical[i + 1] === ':') {
          const key = JSON.parse(token); const keys = stack.at(-1);
          if (!keys || keys.has(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('key');
          keys.add(key);
        }
      }
      if (parsed !== null && typeof parsed === 'object') {
        const encoded = JSON.stringify(parsed);
        if (encoded.length > 16000) throw new Error('bound');
        if (/"(?:__proto__|constructor|prototype)"\s*:/.test(value)) throw new Error('key');
      }
      return parsed;
    } catch { hold('HOLD_SOURCE_SCHEMA', 'Only explicit JSON scalars and bounded JSON containers are supported in new publication metadata.'); }
  }
  function block(indent, depth) {
    if (depth > 12 || !tokens[index] || tokens[index].indent !== indent) hold('HOLD_SOURCE_SCHEMA', 'Malformed publication metadata nesting.');
    const isArray = /^-(?: |$)/.test(tokens[index].text);
    const value = isArray ? [] : {};
    while (index < tokens.length && tokens[index].indent === indent) {
      const token = tokens[index++];
      if (isArray) {
        if (!/^-(?: |$)/.test(token.text)) hold('HOLD_SOURCE_SCHEMA', 'Mixed publication list and mapping.');
        const rest = token.text.slice(1).trim();
        value.push(rest ? scalar(rest) : block(indent + 2, depth + 1));
      } else {
        const pair = token.text.match(/^([A-Za-z][A-Za-z0-9]*):(?: (.*))?$/);
        if (!pair || ['__proto__', 'prototype', 'constructor'].includes(pair[1]) || Object.hasOwn(value, pair[1])) {
          hold('HOLD_SOURCE_SCHEMA', 'Duplicate or unsupported publication metadata key.');
        }
        value[pair[1]] = pair[2]?.trim() ? scalar(pair[2]) : block(indent + 2, depth + 1);
      }
      if (tokens[index]?.indent > indent) hold('HOLD_SOURCE_SCHEMA', 'Unconsumed nested publication metadata.');
    }
    return value;
  }
  const data = block(0, 0);
  if (index !== tokens.length || Array.isArray(data)) hold('HOLD_SOURCE_SCHEMA', 'Publication metadata is not one complete mapping.');
  if (!['draft', 'review', 'ready-for-build', 'published'].includes(data.status)) hold('HOLD_SOURCE_SCHEMA', 'An explicit publication status is required.');
  return { ...data, body: source.slice(match[0].length) };
}
