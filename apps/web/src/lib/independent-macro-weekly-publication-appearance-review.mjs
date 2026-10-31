// Non-public, publication-appearance review only; never use for user-supplied HTML.
// The immutable original article and previously approved Draft adapter are not modified.
import { extractIndependentMacroWeeklyDraftFragment, DRAFT_ARTICLE_SECTION_IDS } from './independent-macro-weekly-draft-shell.mjs';

export const PUBLICATION_APPEARANCE_EDITS = Object.freeze([
  {
    "id": "hero-badge",
    "old": "Draft candidate — HOLD",
    "proposed": "Coverage: October 26–30, 2026"
  },
  {
    "id": "hero-review-status",
    "old": "Draft only, never published",
    "proposed": "Official release facts checked; education only"
  },
  {
    "id": "section-seven-status",
    "old": "This page is an unpublished Draft candidate. Exact-item rights, international distribution, and public release remain on HOLD; no agency endorses the page.",
    "proposed": "This page provides original educational commentary on cited official releases; it does not report independently observed asset-price reactions or the original Score. No agency endorses this page."
  },
  {
    "id": "section-seven-heading",
    "old": "Release-candidate limitations:",
    "proposed": "Scope and limitations:"
  },
  {
    "id": "adapter-stale-presentation-notice",
    "old": "This shared-layout adaptation is not published. The standalone article has an editorial PASS; this new layout, qualified international rights review, merge and public Production release remain on HOLD.",
    "proposed": "This independent educational Weekly summarizes cited official releases, without measured market-price returns or original USD Impact Score outputs."
  }
]);
export const PUBLICATION_APPEARANCE_DISCLOSURE = "AI tools assisted with preparation of this educational review. USD Impact, operated by KELA LEADS S.R.L., is responsible for the published content. The linked Federal Reserve, BEA and BLS releases are the sources for reported official facts.";
export const PUBLICATION_APPEARANCE_SECTION_IDS = DRAFT_ARTICLE_SECTION_IDS;

function replaceOnce(text, before, after, label) {
  if (typeof before !== 'string' || text.split(before).length !== 2) {
    throw new Error('Private final-copy review needs one occurrence: ' + label);
  }
  return text.replace(before, after);
}

export function buildIndependentMacroWeeklyAppearanceReview(originalCandidate) {
  // This extraction retains the original seven sections and approved source links.
  const adapted = extractIndependentMacroWeeklyDraftFragment(originalCandidate);
  if (adapted.readyForPublicRelease || !adapted.presentationChanged) {
    throw new Error('Cannot construct a release-approved article from this review-only adapter');
  }
  let fragment = adapted.fragment;
  for (const edit of PUBLICATION_APPEARANCE_EDITS) {
    fragment = replaceOnce(fragment, edit.old, edit.proposed, edit.id);
  }
  const aiNotice = '<div class="mw-ai-review-disclosure" role="note" data-ai-disclosure-proposed="true"><strong>AI-assisted preparation:</strong> ' +
    PUBLICATION_APPEARANCE_DISCLOSURE + '</div>';
  fragment = replaceOnce(fragment,
    '<main id="main-content" class="container layout">',
    aiNotice + '\n  <main id="main-content" class="container layout">',
    'visible AI disclosure near article beginning');
  if (fragment.includes('Draft candidate — HOLD') ||
      fragment.includes('Draft only, never published') ||
      fragment.includes('Shared-layout Draft — not published') ||
      fragment.includes('This shared-layout adaptation is not published.') ||
      /<script\b|<iframe\b|<img\b|<form\b/iu.test(fragment)) {
    throw new Error('Publication-appearance review contains stale visible status or forbidden embed');
  }
  for (const id of PUBLICATION_APPEARANCE_SECTION_IDS) {
    if (fragment.split('<section aria-labelledby="' + id + '">').length !== 2) {
      throw new Error('Original section disappeared or duplicated: ' + id);
    }
  }
  return Object.freeze({
    fragment,
    sectionIds: PUBLICATION_APPEARANCE_SECTION_IDS,
    statusOnlyEdits: PUBLICATION_APPEARANCE_EDITS.length,
    aiDisclosureVisible: true,
    notRouted: true,
    releaseAuthorized: false,
    finalRenderedOwnerPass: false,
  });
}
