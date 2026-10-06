# Spanish Edition 1.3 construction controls — Candidate 1 checkpoint

Status: **CONSTRUCTION IN PROGRESS — RELEASE HOLD**  
Checkpoint date: 2026-10-07  
Production impact: **NONE**

## Candidate 1 working source

Canonical working Google Doc:

- title: `USD Impact — Read the Dollar First — Spanish Edition 1.3 Candidate 1 — WORKING HOLD`
- Drive ID: `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`
- current observed revision ID: `AHj4eMRY71rsbvAMde0tek5YL50y4_xasCfjgleD1mhC9ejaEWgrbH9M3a4wNpeDKra22jGV7v2kgQRR_bcwyxw9okxsBdwJzUk1B6TRNIQ`
- sharing state at checkpoint: private / `shared=false`
- historical Spanish Edition 1.2 remains unchanged and is not the working release source.

## Candidate 1 construction-state verification

Native Google Docs readback shows:

- 1 document tab;
- 1,139 extracted paragraphs at this checkpoint;
- Appendix B is present;
- governed bridges are present:
  - `usd-impact.com/go/c03`
  - `usd-impact.com/go/score`
  - `usd-impact.com/go/c11`
  - `usd-impact.com/go/methodology`
- methodology authority hashes are present:
  - `a86e57dafe91da67553e73e01bb0c703a868c949`
  - `f51f7abf2d4ec99890eb5537424f6faab885ef32`

## High-risk regression scan

Candidate 1 readback returned **zero** matches for:

- `84.5%` / `84,5 %`;
- `79.7%` / `79,7 %`;
- `73.2%` / `73,2 %`;
- historical `100%` regime-performance claims;
- moving-standard-deviation methodology wording;
- historical `tasa de descuento` hurdle-rate translation;
- `en tiempo real — no reconstruidos con visión retrospectiva`;
- historical Figure 3.1;
- historical Figure 4.1;
- historical Figure 11.1;
- malformed `sobrelectoreando`;
- malformed `infralectoreando`;
- malformed `precio de referenciaing`;
- malformed `reprecios`;
- malformed `reprecioando`.

## Terminology lock — hurdle rate

Approved construction term:

**`rentabilidad mínima exigida`**

Definition intent:

> minimum required/threshold return an asset must justify versus the next-best alternative.

Do not use `tasa de descuento` as the Spanish equivalent for English `hurdle rate`.

Candidate 1 currently uses `rentabilidad mínima exigida` consistently in the audited occurrences, including Chapter 7, Chapter 10/11/13 carryover context, and Appendix A.

This term should also govern later:

- tables;
- captions;
- audiobook script;
- companion lessons;
- any Spanish website copy derived from this edition.

## Score v2 immutable readback

Candidate 1 contains the current formulas:

`z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`

`Score(t,T) = 0.125 × (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`

Candidate 1 also contains the current five regime thresholds:

- `>= +1.0`
- `+0.3 a < +1.0`
- `-0.3 a < +0.3`
- `-1.0 a < -0.3`
- `< -1.0`

Spanish prose may describe the bands, but the numerical boundaries remain immutable.

## Chapter 13 cadence correction

A direct read of English Candidate 2 confirms this source-authoritative sentence:

- the companion recomputes the USD Impact Score every Friday at **22:00 UTC**.

Therefore:

- Friday 22:00 UTC is **not** retired;
- Candidate 1 is correct to retain it;
- the historical material that must be retired/rebuilt is the old rolling-archive / “read in real time, not reconstructed with hindsight” interpretation and the longer prescriptive use wording.

The Chapter 13 unit map and rollups have been corrected accordingly. Unit counts do not change.

## Construction rule from this checkpoint

Do not reopen discovery unless new source evidence appears.

Proceed by:

1. preserve the 500 `REUSE_VERIFIED` units unless final QA finds a concrete defect;
2. resolve the 91 `REVISE` actions in Candidate 1;
3. ensure all 91 `NEW_TRANSLATION` units are represented from Candidate 2 authority;
4. ensure all 22 `RETIRE` units are absent;
5. run current-source/reference QA;
6. run compliance-tail consistency QA;
7. render stable layout;
8. regenerate TOC/page references/index/bookmarks;
9. run visual/page-by-page QA;
10. require explicit owner release approval.

## Release boundary

Candidate 1 remains **WORKING — HOLD**.

This checkpoint does not authorize:

- public Spanish routes;
- sitemap/hreflang;
- Spanish book/audiobook member delivery;
- default Spanish captions;
- marketing email;
- entitlement changes;
- commerce changes;
- auth/passkey changes;
- database changes;
- public sharing of the working manuscript.
