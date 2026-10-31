// DRAFT-ONLY adapter. The verified source is a Git-pinned, local original article.
// This is not a sanitizer for user-supplied HTML and must never process external content.
// Changing visible presentation invalidates the earlier standalone layout PASS.
const HERO_START = '<section class="hero" aria-labelledby="headline">';
const MAIN_OPEN = '<main id="main" class="container layout">';
const MAIN_CLOSE = '</main>';
const LEGACY_NOTICE = 'This page is NOT routed or published. Rights clearance, exact article PASS, merge and public Production release are still denied.';
const SHELL_NOTICE = 'This shared-layout adaptation is not published. The standalone article has an editorial PASS; this new layout, qualified international rights review, merge and public Production release remain on HOLD.';
const SECTION_IDS = Object.freeze([
  'summary', 'timeline', 'transmission', 'mistakes', 'watch', 'sources', 'compliance',
]);

export const DRAFT_ARTICLE_SECTION_IDS = SECTION_IDS;

function exactlyOnce(source, needle, label) {
  const first = source.indexOf(needle);
  if (first < 0 || source.indexOf(needle, first + needle.length) !== -1) {
    throw new Error('Independent Macro Weekly Draft requires exactly one '+label);
  }
  return first;
}

export function extractIndependentMacroWeeklyDraftFragment(source) {
  if (typeof source !== 'string' || !source.startsWith('<!doctype html>')) {
    throw new TypeError('Draft source must be the complete Git-reviewed HTML document');
  }
  const heroStart = exactlyOnce(source, HERO_START, 'hero');
  const mainStart = exactlyOnce(source, MAIN_OPEN, 'main');
  const mainEnd = exactlyOnce(source, MAIN_CLOSE, 'closing main') + MAIN_CLOSE.length;
  if (!(heroStart < mainStart && mainStart < mainEnd)) {
    throw new Error('Unexpected independently reviewed article structure');
  }
  exactlyOnce(source, LEGACY_NOTICE, 'old release-status notice');
  if (!source.includes('data-release-authorized="false"') ||
      !source.includes('data-release-candidate="draft"') ||
      !source.includes('name="robots" content="noindex,nofollow,noarchive,nosnippet"')) {
    throw new Error('Cannot adapt an authorized or indexable source as a Draft');
  }
  if (/<script\b|<iframe\b|<img\b|<form\b/iu.test(source)) {
    throw new Error('Source must be an original text-only article, without widgets or tracking');
  }

  const selected = source.slice(heroStart, mainEnd);
  const originalMain = source.slice(mainStart, mainEnd);
  for (const id of SECTION_IDS) {
    const tag = '<section aria-labelledby="'+id+'">';
    exactlyOnce(originalMain, tag, 'article section '+id);
  }
  if ((originalMain.match(/<section aria-labelledby="/g) || []).length !== SECTION_IDS.length) {
    throw new Error('The original seven article sections changed');
  }

  // Exact factual article sections and source links remain byte-for-byte unchanged.
  // The only rendered substitutions are the main ID (to match existing site skip
  // link) and the obsolete standalone status note. The standalone header, footer,
  // styles, first skip link and <html>/<body> shell are intentionally not rendered.
  const fragment = selected
    .replace(MAIN_OPEN, '<main id="main-content" class="container layout">')
    .replace(LEGACY_NOTICE, SHELL_NOTICE);
  if (fragment.includes(LEGACY_NOTICE) || !fragment.includes(SHELL_NOTICE) ||
      !fragment.includes('<main id="main-content"') ||
      fragment.includes('<header') || fragment.includes('<footer') ||
      fragment.includes('<html') || fragment.includes('<body')) {
    throw new Error('Unexpected duplicated standalone layout in Draft adapter');
  }
  return {
    fragment,
    factualSectionIds: SECTION_IDS,
    presentationChanged: true,
    readyForPublicRelease: false,
  };
}
