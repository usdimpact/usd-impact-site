# Spanish Edition 1.3 Candidate 1 — reference and layout-readiness QA checkpoint

Status: **CONSTRUCTION QA IN PROGRESS — RELEASE HOLD**  
Checkpoint date: 2026-10-07  
Production impact: **NONE**

## Working source

Canonical private Google Doc:

- Drive ID: `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`
- title: `USD Impact — Read the Dollar First — Spanish Edition 1.3 Candidate 1 — WORKING HOLD`
- revision after visible-text and hyperlink-metadata source-QA mutations: `AHj4eMQSiDrZBQglWCsU_Oh9OhKwzbKG3OsMP4SKFGWP-ppCnegTr28JoneDta8tfyY8IJQb2xiX2mA4U7QTBf_FVfCwpsnbHF6SIDXVYd4`
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

- pages: **131**
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

