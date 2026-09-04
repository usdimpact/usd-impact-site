import { readFile } from 'node:fs/promises';

const routes = [
  '/',
  '/start-here/',
  '/book/read-the-dollar-first/',
  '/audiobook/read-the-dollar-first/',
  '/video-library/',
  '/checkout/',
  '/account/sign-in/',
  '/account/',
  '/about/',
  '/privacy/',
  '/terms/',
  '/refund-policy/',
  '/compliance/',
  '/contact/',
  '/accessibility/',
];

const failures = [];
const fail = (route, message) => failures.push(`${route}: ${message}`);
const count = (source, expression) => [...source.matchAll(expression)].length;
const stripMarkup = (source) => source.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();
const hasAttribute = (attributes, name) => new RegExp(`\\s${name}(?:\\s*=|\\s|$)`, 'i').test(` ${attributes}`);
const getAttribute = (attributes, name) => {
  const match = attributes.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] ?? null;
};

for (const route of routes) {
  const relativePath = route === '/' ? '../dist/index.html' : `../dist${route}index.html`;
  let html;
  try {
    html = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  } catch (error) {
    fail(route, `rendered HTML is missing (${error.code ?? 'read error'})`);
    continue;
  }

  if (!/<html\b[^>]*\blang=["']en["']/i.test(html)) fail(route, 'document language must be English');
  if (!/<title>[^<]+<\/title>/i.test(html)) fail(route, 'document must have a non-empty title');
  if (!/<a\b[^>]*class=["'][^"']*\bskip-link\b[^"']*["'][^>]*href=["']#main-content["']/i.test(html)) {
    fail(route, 'skip link must target #main-content');
  }

  const mainCount = count(html, /<main(?:\s|>)/gi);
  if (mainCount !== 1) fail(route, `expected one main landmark, found ${mainCount}`);
  const mainTargetCount = count(html, /<main\b[^>]*\bid=["']main-content["'][^>]*>/gi);
  if (mainTargetCount !== 1) fail(route, `expected one #main-content landmark, found ${mainTargetCount}`);
  const h1Count = count(html, /<h1(?:\s|>)/gi);
  if (h1Count !== 1) fail(route, `expected one H1, found ${h1Count}`);

  const ids = [...html.matchAll(/<[a-z][^>]*\sid=(["'])([^"']+)\1[^>]*>/gi)].map((match) => match[2]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length) fail(route, `duplicate IDs: ${duplicates.join(', ')}`);

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!hasAttribute(match[1], 'alt')) fail(route, 'image is missing an alt attribute');
  }

  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const attributes = match[1];
    const hasName = Boolean(stripMarkup(match[2]) || getAttribute(attributes, 'aria-label') || getAttribute(attributes, 'aria-labelledby'));
    if (!hasName) fail(route, 'button is missing an accessible name');
  }

  const labels = new Set([...html.matchAll(/<label\b[^>]*\bfor=(["'])([^"']+)\1/gi)].map((match) => match[2]));
  const nestedLabelRanges = [...html.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/gi)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  for (const match of html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const [, tag, attributes] = match;
    const type = getAttribute(attributes, 'type')?.toLowerCase();
    if (tag.toLowerCase() === 'input' && ['hidden', 'button', 'submit', 'reset'].includes(type)) continue;
    const id = getAttribute(attributes, 'id');
    const hasWrappingLabel = nestedLabelRanges.some(({ start, end }) => match.index > start && match.index < end);
    const named = Boolean(getAttribute(attributes, 'aria-label') || getAttribute(attributes, 'aria-labelledby') || (id && labels.has(id)) || hasWrappingLabel);
    if (!named) fail(route, `${tag.toLowerCase()} is missing an associated accessible name`);
  }
}

if (failures.length) {
  throw new Error(`Rendered accessibility contract failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Rendered accessibility contracts passed for ${routes.length} canonical routes.`);
