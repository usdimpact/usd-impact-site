# Spanish Edition 1.3 Candidate 1 — reference and layout-readiness QA checkpoint

Status: **CONSTRUCTION QA IN PROGRESS — RELEASE HOLD**  
Checkpoint date: 2026-10-07  
Production impact: **NONE**

## Working source

Canonical private Google Doc:

- Drive ID: `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`
- title: `USD Impact — Read the Dollar First — Spanish Edition 1.3 Candidate 1 — WORKING HOLD`
- revision after source-QA, hyperlink-metadata and legacy-visual cleanup: `ANLCKQlaF9o0RNeTOfJwd9sZrZAti7lAnWcmcjgXiG-0kY9qxh3dmuFg2np6JPc_QkUsd-fh8V0kaCyoiv86Afg3MAPIhm3Qf3thrsxj56s`
- sharing: private at the construction checkpoint

Historical Spanish Edition 1.2 remains unchanged.

## Content-construction QA state

Verified in Candidate 1:

- full chapter architecture through Chapter 13;
- Further Reading;
- Appendix A;
- Appendix B;
- About the Author;
- Index placeholder;
- all four governed print bridges;
- Score v2 formulas, bands and authority hashes;
- current `rentabilidad mínima exigida` terminology;
- current compliance language;
- retired Score hit-rate/performance claims absent;
- retired historical figures absent;
- retired old archive/hindsight language absent;
- retired historical glossary-only expansions absent.

## Table structure

Native Google Docs readback contains **5 semantic tables**:

1. Chapter 3 DXY cross-check — 5 rows × 4 columns;
2. weekly discipline/source table — 6 × 3;
3. Chapter 13 checklist confirmation table — 7 × 4;
4. final one-page discipline table — 6 × 3;
5. Appendix B regime-band table — 6 × 2.

The table content is present natively and no longer depends on out-of-order DOCX extraction.

## Printed-page reference state

Candidate 1 currently contains **zero** stale explicit printed page references such as `(p. 44)`.

This is the intended pre-layout state.

Do not insert final page numbers until:

1. content/source QA is frozen;
2. stable layout is rendered;
3. TOC, page ranges, index, bookmarks and internal destinations are regenerated from final pagination.

## External reference inventory

Candidate 1 currently exposes **45 unique HTTP(S) references**.

The current QA pass externally verified active/current institutional destinations across:

- BIS;
- FASB;
- IMF;
- SEC;
- EIA;
- World Gold Council;
- OPEC;
- ICE;
- CME/NYMEX;
- Cboe;
- CFTC;
- Federal Reserve / Federal Reserve History;
- FRED;
- Bitcoin white paper.

### Confirmed current-source observations

- BIS 2025 Triennial page exposes final turnover results released in June 2026.
- EIA `Balance` and `Supply OPEC` are separate live sources and Candidate 1 keeps them separate.
- current IMF Crypto Cycle URL is present.
- current SEC spot Bitcoin ETP statement is present.
- current WGC fiscal-concerns/real-rates/central-bank source is present.

## Candidate 1 source-QA mutations

Two bounded link mismatches/ambiguities were corrected in the private working document.

Historical Candidate 1 reference text:

`Fondo Monetario Internacional, Spillovers between Crypto and Equity Markets (2022).`

was paired with:

`https://www.imf.org/en/Publications/WP/Issues/2022/10/14/Cryptic-Connections-Spillovers-between-Crypto-and-Equity-Markets-524104`

Current IMF authority for that title is:

`https://www.imf.org/en/publications/global-financial-stability-notes/issues/2022/01/10/cryptic-connections-511776`

The working Google Doc was updated with revision control and read back successfully:

- occurrences changed: **1**
- old `524104` path remaining: **0**
- current `511776` path present: **1**

No other manuscript text was changed by that mutation.

### IMF dominant-currencies generic topic URL

The generic destination:

`https://www.imf.org/en/Topics/dominant-currencies`

returned crawler-level internal errors and was not needed because Candidate 1 already cites the current title-specific IMF publication that directly supports the dominant-currency point.

It was replaced with:

`https://www.imf.org/en/publications/staff-discussion-notes/issues/2020/07/16/dominant-currencies-and-external-adjustment-48618`

Readback result:

- occurrences changed: **1**
- old generic topic URL remaining: **0**
- canonical title-specific publication URL present in the affected reference: **1**

No prose or analytical claim changed.

## Crawler-ambiguous URLs

A small number of IMF URLs returned crawler-level internal errors during direct open despite valid related canonical publication search results.

Do not classify these as broken solely from the crawler response.

Where the exact cited title has a confirmed canonical current publication page, prefer the canonical title-specific destination during final link normalization.

## Layout gate

Native-structure QA is sufficiently clean to proceed toward layout QA, but **final visual layout has not yet been certified**.

Still required:

- stable PDF/render export from the private Candidate 1 source;
- page-by-page visual inspection;
- table wrapping/break checks;
- heading/orphan/widow checks;
- TOC pagination;
- index generation;
- bookmark/internal-link QA;
- final reference click-through check;
- whole-manuscript compliance readback.

## Release boundary

Publication remains **HOLD**.

No public Spanish route, sitemap/hreflang, member delivery, audiobook release, caption-default change, marketing email, entitlement change, commerce change, auth/passkey change or Production localization activation is authorized by this checkpoint.

## Hyperlink metadata verification

A PDF export exposed an important Google Docs behavior: `replaceAllText` updated visible URL text but initially preserved the prior hyperlink target in the text style.

The two corrected IMF references were therefore repaired a second time at the **link metadata** layer using exact text ranges and revision control.

### Corrected targets

1. Crypto/equity spillovers:
   - old target removed: `...Cryptic-Connections...524104`
   - current target: `https://www.imf.org/en/publications/global-financial-stability-notes/issues/2022/01/10/cryptic-connections-511776`

2. Dominant-currencies generic topic link:
   - old target removed: `https://www.imf.org/en/Topics/dominant-currencies`
   - current target: `https://www.imf.org/en/publications/staff-discussion-notes/issues/2020/07/16/dominant-currencies-and-external-adjustment-48618`

### Re-export proof

A fresh private PDF export after the metadata repair shows:

- old `524104` target: **0**
- old `Topics/dominant-currencies` target: **0**
- current `511776` target: **1**
- title-specific Dominant Currencies target: present in the affected Chapter 6 reference

This verifies the clickable PDF links, not only the visible manuscript text.

## PDF structural preflight

Fresh Candidate 1 PDF export:

- pages: **129**
- page size: **612 × 792 pt** on all pages
- encrypted: **no**
- openable: **yes**
- scanned/image-only: **no**
- outline items: **300**
- annotations: **70**
- external URI link annotations: **70**
- invalid internal page-link targets detected: **0**
- fonts: embedded/subset in the inspected font inventory

The visual screenshot route could not fetch the private signed PDF URL. Therefore page-by-page visual certification remains explicitly **NOT COMPLETE** and must not be inferred from structural preflight.

## Legacy visual cleanup

Supplemental rendered-page comparison against the actual English Candidate 2 PDF found three visual artifacts in Candidate 1 that text extraction alone had not exposed:

1. Chapter 3 DXY composition donut;
2. Chapter 4 five-channel transmission diagram;
3. Chapter 13 seven-step weekly-flow graphic.

English Candidate 2 does **not** contain these visuals in the corresponding release locations.

Native Google Docs object inventory before cleanup showed exactly four inline images:

- `i.0` — cover branding;
- `i.1` — Chapter 3 legacy DXY visual;
- `i.2` — Chapter 4 legacy transmission visual;
- `i.4` — Chapter 13 legacy weekly-flow visual.

The three non-cover objects were deleted by exact document ranges in descending index order with revision control.

Post-cleanup native readback:

- inline image objects remaining: **1**
- remaining object: `i.0` cover branding only

Fresh PDF export confirms:

- pages: **129** (down from 131 after legacy-visual removal/reflow)
- image-bearing pages: **page 1 only**
- outline items: **300**
- external URI annotations: **70**
- invalid internal page targets: **0**
- old IMF `524104` link target: **0**
- old IMF generic dominant-currencies topic target: **0**
- current `511776` link target: **1**
- current Dominant Currencies publication target: present

### Supplemental rendered-page QA

Local render spot-checks were performed on:

- cover/front matter;
- Chapter 3 DXY table and reflow;
- Chapter 4 transmission section;
- Chapter 13 checklist/table area;
- Appendix B methodology/regime table;
- author/index placeholder.

Observed result:

- no clipping or overlap in the sampled pages;
- the Chapter 3 table now reflows without the unauthorized donut visual;
- Chapter 4 and Chapter 13 prose/tables reflow cleanly after visual removal;
- Appendix B sampled layout is readable;
- one trailing blank page remains after the pre-layout index placeholder.

The trailing blank page is a **layout-finalization item**, not a content error. Remove it when final index/pagination/bookmarks are generated.

This local render inspection is supplemental only. The required web screenshot path still could not fetch the private signed PDF, so final screenshot-based page-by-page visual certification remains **NOT COMPLETE**.
