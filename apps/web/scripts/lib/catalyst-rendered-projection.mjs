/**
 * Compare supplied HTML documents, never network responses or publication truth.
 * Reference HTML must be obtained separately from the reviewed, pinned Astro build.
 * This module does not fetch, read files, acquire time, or authorize any action.
 */
import { createHash } from 'node:crypto';
import { parse } from 'parse5';

export const PROJECTION_SCHEME = 'usdimpact-catalyst-rendered-v1';
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
const HTML_NS = 'http://www.w3.org/1999/xhtml';
const BLOCK = new Set(('html head body main section article aside div p h1 h2 h3 h4 h5 h6 ul ol li blockquote pre table thead tbody tfoot tr th td dl dt dd hr figure figcaption').split(' '));
const ALLOWED = new Set(('main section article aside div p h1 h2 h3 h4 h5 h6 ul ol li blockquote pre code strong em b i s del ins sub sup small span a br hr table thead tbody tfoot tr th td caption colgroup col dl dt dd abbr time kbd samp var figure figcaption').split(' '));
const VOID = new Set(['br', 'hr', 'col']);
const SAFE_ATTRIBUTES = new Set(('class id title href target rel aria-label aria-labelledby role datetime start reversed value colspan rowspan scope headers').split(' '));
const ASCII_SPACE = /[\t\n\f\r ]+/g;
const FORBIDDEN_CHARACTERS = /[\u0000-\u0008\u000b\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const authority = () => ({ sourceAuthenticityVerified: false, acquisitionVerified: false,
  publicationVerified: false, publicationAuthorized: false, incidentClosureAuthorized: false,
  enforcementActive: false });
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) freeze(v);
    Object.freeze(value);
  }
  return value;
}
const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');
const hold = code => { throw new ProjectionError(code); };
class ProjectionError extends Error { constructor(code) { super(code); this.code = code; } }
const attr = (n, key) => n.attrs?.find(a => a.name === key && !a.namespace)?.value ?? null;
const hasClass = (n, value) => (attr(n, 'class') || '').split(/[\t\n\f\r ]+/).includes(value);
const elements = n => (n.childNodes || []).filter(c => c.tagName);
const normalize = value => value.replace(ASCII_SPACE, ' ');
function text(n) {
  if (n.nodeName === '#text') return n.value;
  if (n.nodeName === '#comment') return '';
  return (n.childNodes || []).map(text).join('');
}
function one(nodes, code) { if (nodes.length !== 1) hold(code); return nodes[0]; }
function nonempty(value, code) { if (!value || !normalize(value).trim()) hold(code); return value; }
function explicit(n) {
  const loc = n.sourceCodeLocation;
  if (!loc?.startTag || (!VOID.has(n.tagName) && !['meta', 'link'].includes(n.tagName) && !loc.endTag)) hold('IMPLICIT_OR_UNCLOSED_STRUCTURE');
}
function safeUrl(value, canonical, canonicalOnly = false) {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\s\\\u0000-\u001f\u007f]/u.test(value)) hold('INVALID_URL');
  let url;
  try { url = new URL(value, canonical); } catch { hold('INVALID_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) hold('INVALID_URL');
  if (canonicalOnly && (url.origin !== 'https://www.usd-impact.com' || url.search || url.hash
      || !/^\/news\/catalysts\/[a-z0-9-]+-(?:preview|outcome)$/.test(url.pathname) || url.href !== value)) hold('INVALID_CANONICAL');
  return url.href;
}
function checkExposure(n) {
  for (let parent = n; parent?.tagName; parent = parent.parentNode) {
    if (attr(parent, 'hidden') !== null || attr(parent, 'inert') !== null
        || attr(parent, 'aria-hidden')?.toLowerCase() === 'true'
        || attr(parent, 'style') !== null) hold('HIDDEN_OR_STYLED_GOVERNED_REGION');
  }
}
// These document-level inputs change link resolution or replace the document.
// They cannot be ignored while claiming equality of governed link destinations.
function validateDocumentNode(node) {
  if (node.tagName === 'base') hold('UNSUPPORTED_DOCUMENT_BASE');
  if (node.tagName === 'meta' && normalize(attr(node, 'http-equiv') || '').trim().toLowerCase() === 'refresh') {
    hold('UNSUPPORTED_DOCUMENT_REFRESH');
  }
  // Raw HTML screening alone misses characters introduced by entity decoding.
  const values = node.nodeName === '#text' ? [node.value] : [];
  for (const attribute of node.attrs || []) values.push(attribute.value);
  for (const value of values) {
    if (typeof value !== 'string' || !value.isWellFormed() || FORBIDDEN_CHARACTERS.test(value)) {
      hold('UNSUPPORTED_DECODED_TEXT_CONTROL');
    }
  }
}
function collect(document) {
  const all = [];
  const stack = [{ node: document, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const { node, depth } = stack.pop();
    if (++count > 50000 || depth > 128) hold('DOCUMENT_COMPLEXITY_LIMIT');
    validateDocumentNode(node);
    if (node.tagName) all.push(node);
    const children = [...(node.childNodes || []), ...(node.content ? [node.content] : [])];
    for (let i = children.length - 1; i >= 0; --i) stack.push({ node: children[i], depth: depth + 1 });
  }
  return all;
}
function normalizedAttributes(n, canonical) {
  const values = [];
  for (const a of n.attrs || []) {
    // Astro compiler scoping markers are not article content. Only empty markers qualify.
    if (/^data-astro-cid-[a-z0-9]+$/.test(a.name) && a.value === '' && !a.namespace) continue;
    if (a.namespace || !SAFE_ATTRIBUTES.has(a.name)) hold('UNSUPPORTED_GOVERNED_ATTRIBUTE');
    let value = a.value;
    if (a.name === 'href') value = safeUrl(value, canonical);
    if (['class', 'rel'].includes(a.name)) value = [...new Set(value.split(/[\t\n\f\r ]+/).filter(Boolean))].sort().join(' ');
    if (a.name === 'target' && !['_blank', '_self'].includes(value)) hold('UNSUPPORTED_LINK_TARGET');
    values.push([a.name, value]);
  }
  values.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return values;
}
function projectNode(n, canonical, preserve = false) {
  if (n.nodeName === '#comment') return null;
  if (n.nodeName === '#text') return ['text', preserve ? n.value : normalize(n.value)];
  if (!ALLOWED.has(n.tagName) || n.namespaceURI !== HTML_NS) hold('UNSUPPORTED_GOVERNED_ELEMENT');
  explicit(n); checkExposure(n);
  const attributes = normalizedAttributes(n, canonical);
  if (n.tagName === 'a') nonempty(attr(n, 'href'), 'MISSING_LINK_DESTINATION');
  const keepSpace = preserve || n.tagName === 'pre' || n.tagName === 'code';
  let children = (n.childNodes || []).map(child => projectNode(child, canonical, keepSpace)).filter(Boolean);
  // Comments do not create a word boundary. Join adjacent text before whitespace handling.
  children = children.reduce((out, child) => {
    if (child[0] === 'text' && out.at(-1)?.[0] === 'text') out.at(-1)[1] += child[1];
    else out.push(child);
    return out;
  }, []);
  if (!keepSpace) {
    children = children.map((child, index, sequence) => {
      if (child[0] !== 'text') return child;
      let value = normalize(child[1]);
      const leftBlock = index === 0 ? BLOCK.has(n.tagName) : BLOCK.has(sequence[index - 1][0]);
      const rightBlock = index === sequence.length - 1 ? BLOCK.has(n.tagName) : BLOCK.has(sequence[index + 1][0]);
      if (leftBlock) value = value.replace(/^ +/, '');
      if (rightBlock) value = value.replace(/ +$/, '');
      return value ? ['text', value] : null;
    }).filter(Boolean);
  }
  return [n.tagName, attributes, children];
}
function validateCoverage(all, body, hero, main, canonical) {
  const byClass = value => all.filter(n => hasClass(n, value));
  const within = (n, ancestor) => { for (let p = n; p; p = p.parentNode) if (p === ancestor) return true; return false; };
  if (hero.parentNode !== body || main.parentNode !== body) hold('WRONG_ARTICLE_PLACEMENT');
  const directBody = elements(body);
  if (directBody.indexOf(hero) >= directBody.indexOf(main)) hold('WRONG_ARTICLE_ORDER');
  const container = one(elements(hero).filter(n => n.tagName === 'div' && hasClass(n, 'container')), 'HERO_CONTAINER_COUNT');
  const heroChildren = elements(container);
  one(heroChildren.filter(n => n.tagName === 'h1' && nonempty(text(n), 'EMPTY_TITLE')), 'HERO_TITLE_COUNT');
  const lead = one(byClass('lead').filter(n => within(n, hero)), 'HERO_SUMMARY_COUNT');
  const dates = one(byClass('edition-meta').filter(n => within(n, hero)), 'HERO_DATES_COUNT');
  if (lead.parentNode !== container || dates.parentNode !== container) hold('WRONG_HERO_STRUCTURE');
  nonempty(text(lead), 'EMPTY_SUMMARY'); nonempty(text(dates), 'EMPTY_DATES');
  const eyebrow = one(heroChildren.filter(n => hasClass(n, 'eyebrow')), 'HERO_PHASE_COUNT');
  if (!/^USD Impact Catalyst Brief\s*\u00b7\s*(Pre-event|Outcome)$/.test(normalize(text(eyebrow)).trim())) hold('INVALID_DISPLAYED_PHASE');
  const displayedPhase = normalize(text(eyebrow)).trim().endsWith('Pre-event') ? 'preview' : 'outcome';
  if (!canonical.endsWith(`-${displayedPhase}`)) hold('DISPLAYED_PHASE_PATH_MISMATCH');
  const archives = byClass('catalyst-archive-note');
  if (archives.length && displayedPhase !== 'preview') hold('ARCHIVE_NOTICE_REQUIRES_PREVIEW');
  if (archives.length > 1 || archives.some(n => n.parentNode !== container || n.tagName !== 'aside')) hold('ARCHIVE_NOTICE_PLACEMENT');
  if (heroChildren.length !== 4 + archives.length) hold('UNEXPECTED_HERO_REGION');
  const sections = elements(main);
  const expected = ['regime-panel', 'catalyst-section', 'catalyst-section', 'catalyst-section', 'edition-analysis', 'source-ledger', 'compliance'];
  if (sections.length !== expected.length || sections.some((n, i) => !hasClass(n, expected[i]) || n.tagName !== (i === 4 ? 'article' : 'section'))) hold('MISSING_OR_REORDERED_ARTICLE_REGION');
  for (const uniqueClass of ['regime-panel', 'edition-analysis', 'source-ledger', 'compliance']) {
    if (byClass(uniqueClass).length !== 1) hold('DUPLICATE_ARTICLE_REGION');
  }
  if (byClass('catalyst-section').length !== 3) hold('DUPLICATE_ARTICLE_REGION');
  const [regime, facts, channels, watch, analysis, ledger, compliance] = sections;
  const assets = one(byClass('asset-tags'), 'ASSET_REGION_COUNT');
  if (assets.parentNode !== regime || elements(assets).length < 1 || elements(assets).some(n => n.tagName !== 'span' || !text(n).trim())) hold('INVALID_ASSET_REGION');
  const status = one(elements(regime).filter(n => n.tagName === 'strong'), 'VERIFICATION_STATUS_COUNT');
  if (!['scheduled confirmed', 'rescheduled', 'cancelled', 'released'].includes(normalize(text(status)).trim())) hold('INVALID_VERIFICATION_STATUS');
  const statusText = normalize(text(status)).trim();
  if ((displayedPhase === 'preview' && statusText === 'released') || (displayedPhase === 'outcome' && statusText === 'scheduled confirmed')) hold('PHASE_STATUS_MISMATCH');
  const factGrid = one(elements(facts).filter(n => hasClass(n, 'news-grid')), 'FACT_GRID_COUNT');
  const cards = elements(factGrid);
  if (cards.length < 2 || cards.length > 6 || cards.some(n => n.tagName !== 'article' || !hasClass(n, 'card'))) hold('INVALID_FACT_CARDS');
  for (const card of cards) {
    const children = elements(card);
    if (children.length !== 3 || !hasClass(children[0], 'verification') || children[1].tagName !== 'p' || !hasClass(children[2], 'card-sources')) hold('INVALID_FACT_CARD_STRUCTURE');
    if (!['Primary-source verified', 'Multi-source verified'].includes(normalize(text(children[0])).trim())) hold('INVALID_FACT_VERIFICATION');
    nonempty(text(children[1]), 'EMPTY_FACT');
    if (!elements(children[2]).length || elements(children[2]).some(n => n.tagName !== 'a')) hold('MISSING_FACT_SOURCES');
  }
  const channelGrid = one(elements(channels).filter(n => hasClass(n, 'news-grid')), 'CHANNEL_GRID_COUNT');
  if (elements(channelGrid).length < 2 || elements(channelGrid).length > 5) hold('INVALID_CHANNEL_COUNT');
  for (const card of elements(channelGrid)) {
    const children = elements(card);
    if (card.tagName !== 'article' || !hasClass(card, 'card') || children.length !== 2 || children[0].tagName !== 'h3' || children[1].tagName !== 'p') hold('INVALID_CHANNEL_STRUCTURE');
    children.forEach(n => nonempty(text(n), 'EMPTY_CHANNEL'));
  }
  const watchList = one(elements(watch).filter(n => n.tagName === 'ul'), 'WATCH_LIST_COUNT');
  if (elements(watchList).length < 3 || elements(watchList).length > 6 || elements(watchList).some(n => n.tagName !== 'li' || !text(n).trim())) hold('INVALID_WATCH_LIST');
  nonempty(text(analysis), 'EMPTY_ANALYSIS');
  const sourceList = one(elements(ledger).filter(n => n.tagName === 'ol'), 'SOURCE_LIST_COUNT');
  const sources = elements(sourceList);
  if (sources.length < 2 || sources.length > 64) hold('INVALID_SOURCE_COUNT');
  const sourceIds = new Set();
  const sourceLinks = new Set();
  for (const source of sources) {
    const id = attr(source, 'id');
    if (source.tagName !== 'li' || !/^source-[a-z0-9-]+$/.test(id || '') || sourceIds.has(id)) hold('INVALID_SOURCE_ID');
    sourceIds.add(id);
    const children = elements(source);
    if (children.length !== 2 || children[0].tagName !== 'a' || children[1].tagName !== 'span') hold('INVALID_SOURCE_ITEM');
    nonempty(text(children[0]), 'EMPTY_SOURCE_TITLE'); nonempty(text(children[1]), 'EMPTY_SOURCE_METADATA');
    sourceLinks.add(attr(children[0], 'href'));
  }
  for (const card of cards) for (const link of elements(elements(card)[2])) {
    if (!sourceLinks.has(attr(link, 'href'))) hold('FACT_LINK_NOT_IN_LEDGER');
  }
  if (attr(compliance, 'aria-label') !== 'Compliance note' || !text(compliance).includes('Compliance note:') || !/not investment/i.test(text(compliance))) hold('MISSING_ARTICLE_COMPLIANCE');
  return { facts: cards.length, sources: sources.length, assets: elements(assets).length,
    channels: elements(channelGrid).length, watchItems: elements(watchList).length, archiveNotices: archives.length };
}

/** Strict supplied-text input; caller assertions are deliberately not accepted. */
export function projectCatalystHtml(html, canonicalUrl) {
  try {
    const canonical = safeUrl(canonicalUrl, undefined, true);
    if (typeof html !== 'string' || !html || !html.isWellFormed() || Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) hold('INVALID_OR_OVERSIZED_HTML');
    if (FORBIDDEN_CHARACTERS.test(html)) hold('UNSUPPORTED_TEXT_CONTROL');
    const document = parse(html, { scriptingEnabled: true, sourceCodeLocationInfo: true,
      onParseError: () => hold('HTML_PARSE_ERROR') });
    const all = collect(document);
    const root = one(all.filter(n => n.tagName === 'html'), 'HTML_ROOT_COUNT');
    const head = one(all.filter(n => n.tagName === 'head'), 'HEAD_COUNT');
    const body = one(all.filter(n => n.tagName === 'body'), 'BODY_COUNT');
    [root, head, body].forEach(explicit);
    if (root.namespaceURI !== HTML_NS || head.parentNode !== root || body.parentNode !== root) hold('INVALID_DOCUMENT_STRUCTURE');
    if (document.childNodes.filter(n => n.nodeName === '#documentType' && n.name === 'html').length !== 1) hold('DOCTYPE_REQUIRED');
    if (attr(root, 'lang') !== 'en') hold('UNSUPPORTED_LANGUAGE');
    checkExposure(body);
    const title = one(elements(head).filter(n => n.tagName === 'title'), 'META_TITLE_COUNT');
    explicit(title);
    if (elements(title).length) hold('INVALID_META_TITLE');
    const description = one(elements(head).filter(n => n.tagName === 'meta' && attr(n, 'name')?.toLowerCase() === 'description'), 'META_DESCRIPTION_COUNT');
    const canonicalNode = one(elements(head).filter(n => n.tagName === 'link' && (attr(n, 'rel') || '').toLowerCase().split(/\s+/).includes('canonical')), 'CANONICAL_COUNT');
    const charset = one(elements(head).filter(n => n.tagName === 'meta' && attr(n, 'charset') !== null), 'CHARSET_COUNT');
    if (attr(charset, 'charset').toLowerCase() !== 'utf-8') hold('UNSUPPORTED_CHARSET');
    if (safeUrl(attr(canonicalNode, 'href'), undefined, true) !== canonical) hold('CANONICAL_MISMATCH');
    const robots = [];
    for (const name of ['robots', 'googlebot', 'bingbot']) {
      const entries = elements(head).filter(n => n.tagName === 'meta' && attr(n, 'name')?.toLowerCase() === name);
      if (entries.length > 1) hold('DUPLICATE_INDEXING_METADATA');
      if (entries.length) {
        const value = nonempty(attr(entries[0], 'content'), 'EMPTY_INDEXING_METADATA');
        if (/(?:^|[\s,])(?:noindex|none)(?:$|[\s,])/i.test(value)) hold('NONPUBLIC_INDEXING_POLICY');
        robots.push([name, value]);
      }
    }
    const hero = one(all.filter(n => n.tagName === 'section' && hasClass(n, 'hero') && hasClass(n, 'news-hero')), 'HERO_COUNT');
    const main = one(all.filter(n => n.tagName === 'main'), 'MAIN_COUNT');
    if (!hasClass(main, 'container')) hold('MAIN_STRUCTURE');
    const coverage = validateCoverage(all, body, hero, main, canonical);
    const ids = new Set();
    for (const node of all) {
      const id = attr(node, 'id');
      if (id !== null) { if (!id || ids.has(id)) hold('DUPLICATE_DOCUMENT_ID'); ids.add(id); }
    }
    const projection = { scheme: PROJECTION_SCHEME, metadata: {
      title: normalize(nonempty(text(title), 'EMPTY_META_TITLE')).trim(),
      description: nonempty(attr(description, 'content'), 'EMPTY_META_DESCRIPTION'),
      canonical, language: 'en', charset: 'utf-8', indexing: robots,
    }, hero: projectNode(hero, canonical), article: projectNode(main, canonical) };
    return freeze({ status: 'PROJECTION_READY_NOT_VERIFIED', scheme: PROJECTION_SCHEME,
      suppliedUtf8Sha256: hash(html), contentSha256: hash(JSON.stringify(projection)),
      coverage, projection, ...authority() });
  } catch (error) {
    return freeze({ status: 'PROJECTION_HOLD', code: error instanceof ProjectionError ? error.code : 'PROJECTION_PROCESSING_ERROR', ...authority() });
  }
}

export function compareCatalystHtml(referenceHtml, observedHtml, canonicalUrl) {
  const reference = projectCatalystHtml(referenceHtml, canonicalUrl);
  const observed = projectCatalystHtml(observedHtml, canonicalUrl);
  if (reference.status !== 'PROJECTION_READY_NOT_VERIFIED' || observed.status !== 'PROJECTION_READY_NOT_VERIFIED') {
    return freeze({ status: 'CONTENT_COMPARISON_HOLD', referenceCode: reference.code ?? null,
      observedCode: observed.code ?? null, ...authority() });
  }
  const equal = JSON.stringify(reference.projection) === JSON.stringify(observed.projection);
  return freeze({ status: equal ? 'CONTENT_MATCH_NOT_VERIFIED' : 'CONTENT_MISMATCH', scheme: PROJECTION_SCHEME,
    referenceSha256: reference.contentSha256, observedSha256: observed.contentSha256,
    referenceSuppliedUtf8Sha256: reference.suppliedUtf8Sha256,
    observedSuppliedUtf8Sha256: observed.suppliedUtf8Sha256, ...authority() });
}
