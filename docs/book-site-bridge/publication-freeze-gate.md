# Read the Dollar First — publication freeze gate

Date: 2026-08-29
Status: Phase 2C preparation only.

## Objective

Prevent ISBN/barcode/publication work from starting while the certified Edition 1.2 manuscript and the current production Score v2 methodology remain materially out of alignment.

The gate separates three decisions that must not be collapsed into one:

1. website/route freeze;
2. manuscript/content freeze;
3. publication-metadata freeze.

## Pinned authorities for the next manuscript-edit phase

### Book-Site Bridge / website

Repository: `usdimpact/usd-impact-site`

Pinned release baseline:

`a86e57dafe91da67553e73e01bb0c703a868c949`

This baseline includes released PRs #383, #392 and #393.

The governed print-link registry at this baseline has blob SHA:

`6d885454138df3c8f803f953f3500871c9dec746`

No printed alias should be added, removed or retargeted during the manuscript edit without reopening the route gate.

### Score v2 production pipeline

Repository: `usdimpact/usd-impact-pipeline`

Pinned main baseline for this preparation pass:

`f51f7abf2d4ec99890eb5537424f6faab885ef32`

Authoritative production workflow:

`.github/workflows/weekly.yml`

Authoritative calculation implementation:

`usd_impact_score_v2.py`

### Manuscript source

Certified digital reader:

`USD_Impact_Read_the_Dollar_First_v5_94_Session15A_Certified_NoISBN_DigitalReader_WithBookmarks(1).pdf`

Edition 1.2 / build v5.94 / no ISBN.

## Gate A — route freeze

Status at Phase 2C preparation: **candidate PASS**, subject to final recheck immediately before book editing.

Required conditions:

- all 19 `/go/` aliases still exist;
- required print aliases `/go/c03/`, `/go/score/`, `/go/c11/`, `/go/methodology/` resolve correctly;
- optional `/go/companion/` resolves correctly if used in print;
- no alias requires authentication or purchase to reach the public explanatory/practice destination;
- `/go/**` remains outside the normal sitemap;
- Companion and practice indexing policy remains unchanged;
- the Chapter 3 and Chapter 11 tool routes remain stable enough to accept printed traffic through their aliases.

Failure rule: if any required alias must change its public short URL, stop the manuscript edit and reopen the route architecture first.

## Gate B — methodology authority freeze

Status at Phase 2C preparation: **NOT YET FROZEN FOR PRINT**.

Before applying the manuscript patch:

1. re-read the live Score methodology and the production calculation code;
2. confirm the eight inputs, weekly-level transformation, full-sample normalization, clipping, weights and five regime bands are unchanged from the patch register;
3. confirm the Friday-ended publication workflow and archival/vintage semantics;
4. record the exact website and pipeline commit SHAs in the final book QA report;
5. if production methodology changed, update the patch register before touching the master book.

Failure rule: never edit the book to a methodology that is already obsolete at the time of the edit.

## Gate C — manuscript correction

Status at Phase 2C preparation: **BLOCKED / NOT STARTED**.

Required corrections are defined in `manuscript-patch-register.md`.

The edit phase must:

- correct Chapter 10 production-methodology statements;
- remove the fixed 84.5% / per-regime performance narrative as current Score v2 evidence;
- convert 2020/2022 language from predictive/real-time proof to retrospective descriptive illustration where required;
- distinguish as-published vintage archives from current recalculated history in Chapter 13;
- replace Appendix B normalization, clipping, formula, regime-band and validation sections;
- add the four required stable print links/QRs;
- leave the conceptual framework, asset chapters and compliance boundary unchanged unless directly affected by pagination or cross-reference repair.

Failure rule: any remaining statement that teaches the earlier rolling/weekly-move Score methodology is a publication blocker.

## Gate D — layout and structural QA

Status: **NOT STARTED**.

After manuscript correction, verify:

- chapter start pages;
- table of contents page references;
- internal `p. XX` references;
- index page ranges;
- PDF bookmarks/outlines;
- internal/external hyperlinks;
- QR placement and scan reliability;
- formula rendering and symbols;
- no orphaned headings or single-line spill pages;
- no clipped tables or footers;
- selectable/extractable text remains intact;
- accessibility tags/reading order are not materially degraded by QR insertion;
- title page, copyright page, edition/build string and market-data cut-off are internally consistent.

Any pagination movement must trigger a complete cross-reference recheck rather than manual spot correction.

## Gate E — content/compliance QA

Status: **NOT STARTED**.

Required checks:

- no forecast/trading-signal claim introduced by revised Score language;
- no predictive-performance percentage presented without a specifically identified, completed evidence protocol;
- no implication that historical recalculated output is an as-published vintage;
- Score remains educational/descriptive and separate from suitability, entry, exit and position-sizing decisions;
- source/provider wording matches the public production methodology at freeze time;
- book-site companion wording remains continuation/practice, not a requirement to purchase or an outcome claim.

## Gate F — route + manuscript joint freeze

Status: **NOT STARTED**.

This is the last gate before publication metadata.

Required evidence:

- final corrected PDF hash recorded;
- final page count recorded;
- final edition/build identifier recorded;
- final route-registry blob SHA recorded;
- final Score methodology website commit recorded;
- final Score pipeline commit recorded;
- every required QR scanned from a physical or print-resolution proof;
- route checks performed after the final PDF is generated, not before;
- all prior gates PASS with no unresolved blocker.

After this point, manuscript wording, pagination and printed short URLs are frozen together.

## Gate G — ISBN, barcode and publication metadata

Status: **DEFERRED**.

Do not start this gate until Gate F passes.

Only after joint route/manuscript freeze should the publication process address:

- ISBN assignment, if the publication channel requires one;
- barcode generation/placement;
- final edition/imprint metadata;
- final copyright/colophon metadata;
- distribution-platform metadata;
- print cover/spine changes driven by final page count or print specifications.

No ISBN or barcode should be used as a substitute for a manuscript freeze.

## Change-control after freeze

After Gate F:

- editorial corrections that change meaning require a new build identifier and a new joint-freeze QA pass;
- changes to printed `/go/` short URLs require a new publication review;
- website destination improvements may be released behind the stable alias if they preserve the printed contract and remain within the approved public scope;
- production Score methodology changes must be versioned publicly; the frozen book should identify its methodology cut-off and direct readers to `/go/methodology/` for the live version.

## Current disposition

Phase 2B website integration: **PASS / released**.

Phase 2C planning documentation: **in preparation**.

Master manuscript: **unchanged and not publication-ready until the P0 corrections are applied and jointly QA'd**.

ISBN/barcode/publication metadata: **deferred**.
