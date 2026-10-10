# Spanish audiobook — non-audio editorial closeout (2026-10-10)

**Status: evidence review complete for the checks below; editorial/legal signoff and release remain HOLD.**

Scope: selected private Spanish Edition 1.3 Candidate 1 audiobook, draft [PR #797](https://github.com/usdimpact/usd-impact-site/pull/797). This is a textual and repository-provenance audit, **not** a whole-book transcript alignment certificate, audio listening result, mastered-file QA, legal opinion, or permission to publish.

## Sources and selection

- Manuscript: Google Doc `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU` (Spanish Edition 1.3 Candidate 1 — WORKING HOLD).
- Selected compositions: [private manifest](./SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json); [prior 20-track structural reconciliation](./SPANISH_AUDIOBOOK_FULL_20_TRACK_PRIVATE_PREFLIGHT_2026-10-10.md).
- Private Descript project: `2f542797-4a70-4d44-a164-76dee15859ca`. No Descript composition was published in the verified project inventory.
- Preserve the selected private Track 00 v2 `ebe7f026-e369-4dd4-a184-9476a6482f5b`, not the historical original.

## Reference and attribution parity: sampled selected transcripts

| Selected track | Source items inspected | TXT transcript result | Interpretation |
| --- | --- | --- | --- |
| 15 — Chapter 13 | Federal Reserve Board H.10; FRED; EIA Weekly Petroleum Status Report; CME Group/ICE WTI–USD Index contract pages; CFTC Commitments of Traders | Core institutions and reference topics present; `CME Group e ICE` appears as `CME Group EIs` in ASR | Source coverage present; exact ICE enunciation deferred |
| 16 — Further reading | 12 authors: Ray Dalio, Lyn Alden, Barry Eichengreen, Perry Mehrling, Peter Zeihan, Adam Tooze, Daniel Yergin, Saifedean Ammous, Howard Marks, Michael Mauboussin, Philip Tetlock, Dan Gardner; World Gold Council | All 12 named authors and institutional gold reference present | Named-reference presence, not full wording or pronunciation certification |
| 18 — Appendix B | ICE, CME/NYMEX, Cboe, FRED, U.S. Treasury, LBMA, World Gold Council, S&P Dow Jones Indices, institutional or disclosed BTC/USD benchmark | Institutional/reference categories present; ASR punctuation and terminology differ | Named-reference presence, not source-feed/current-data validation |
| 00 — Opening; 19 — Author | Copyright exception and educational/non-advice disclaimer; project-author profile and official contact | Key passages present in prior selected transcript readbacks | Exact legal acceptability still requires an editorial/legal decision |

The manuscript distinguishes automated production feeds from independent primary/benchmark cross-check sources in Appendix B. Do **not** interpret this textual review as verification of live market data providers, URL availability, or correctness of a current Score publication.

## Direct source-link check — 2026-10-10

Five **printed manuscript** URLs in the Chapter 13 selected references were opened against their official sites. Each resolves to the expected source/topic:

- Federal Reserve H.10: https://www.federalreserve.gov/releases/h10/
- St. Louis Fed FRED: https://fred.stlouisfed.org/
- EIA Weekly Petroleum Status Report: https://www.eia.gov/petroleum/supply/weekly/
- CME WTI crude futures: https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.html
- CFTC Commitments of Traders: https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm

**Editorial link improvement identified:** the Chapter 13 manuscript citation names both CME **and ICE** but supplies only the CME WTI link. A separate official ICE US Dollar Index futures product reference is available at https://www.ice.com/products/194/US-Dollar-Index-USDX-Futures. Consider adding it in a future editorial version if both references are intended to be clickable. This is a documented completeness suggestion, **not** a claim that the existing CME URL is broken, nor authorization to change the frozen manuscript.

These checks establish page/topic availability only, not data licensing, real-time feed integrity, current Score methodology validation or an independent audit of every hyperlink in the full book.

## Appendix B authority identifiers — source provenance resolved

The manuscript's two identifiers are genuine, distinct repository commits:

1. Website: `a86e57dafe91da67553e73e01bb0c703a868c949` — [usd-impact-site commit](https://github.com/usdimpact/usd-impact-site/commit/a86e57dafe91da67553e73e01bb0c703a868c949).
2. Score pipeline: `f51f7abf2d4ec99890eb5537424f6faab885ef32` — [usd-impact-pipeline commit](https://github.com/usdimpact/usd-impact-pipeline/commit/f51f7abf2d4ec99890eb5537424f6faab885ef32).

Both repositories/SHAs are independently pinned in [manuscript-patch-register.md](../book-site-bridge/manuscript-patch-register.md) and [publication-freeze-gate.md](../book-site-bridge/publication-freeze-gate.md). Looking up the pipeline SHA in the **website** repository is the wrong repository lookup.

The selected Appendix B Descript TXT readback writes its ending pipeline token as `F51F7ABF2D4EXE99890EB55374246FAB885F32`, which differs from the authoritative manuscript SHA. This is an **ASR discrepancy**, not proof that the selected audible recording says the wrong characters. The owner-approved 14:25–14:43 excerpt is not a character-by-character checksum signoff. **Source provenance is CLOSED; exact spoken-character review remains DEFERRED until final audio QA.** Do not change either source token or resynthesize based on ASR.

## Copyright/rights adaptation — explicit editorial decision required

The printed manuscript begins its rights notice with `Copyright © 2026`. The selected Track 00 v2 private transcript begins `USD Impact. 2026. Todos los derechos reservados`, consistent with the previously owner-selected omission of the English word `Copyright`. The remaining rights exception for brief critical-review quotations and permitted noncommercial uses, educational disclaimer, edition/cutoff and contact passages appear in transcript review. **Not verbatim parity.**

Decision still required from a responsible editor/legal reviewer: accept this intentional spoken adaptation as equivalent for the final audiobook **or** require a separately approved alternative. No change to the printed manuscript, Descript audio or canonical selected IDs follows from this register.

## Follow-up proof: Appendix B synthesis input

The selected Appendix B segment 15 source file (`docs/localization/spanish-audiobook-track-18/segment-15.txt`) was read directly at commit `cdee4bfd6a6b1bd1699d16de814dfbdd72deff14`. It contains the **exact** website and Score-pipeline commit identifiers printed in the authoritative manuscript. Therefore manuscript-to-prepared-narration-script identifier parity is verified. The selected Descript TXT remains different at character level; no inference about spoken audio is permitted without the deferred final listening/audio verification.

## Workflow HOLD enforcement — added on draft branch

The private HeyGen synthesis workflow now validates the canonical manifest **before** installing the provider CLI or invoking speech generation. It now requires a distinct `private_synthesis_approval == "APPROVED"` alongside `production_enabled == false`, `public_allowed == false`, `merge_allowed == false`, and `publication_approval == "NOT_GRANTED"`. The approval field is intentionally absent from the current canonical manifest, so the check fails closed even if the workflow is manually dispatched or its trigger JSON changes. This draft-branch guard was finalized in commit `d9138a8f05e877459aa7dec33fa9e4eb7d2bd6f7` (replacing the initial boolean approach in `df52d2550f3d4541e860f08a10306a749aff06ef`); it has been inspected statically, not exercised through a synthesis job. Do not add an approval field except for a separately authorized, scoped private repair. A private repair authorization must never toggle Production, public delivery, merge, or release approvals.

## Bounded closeout and remaining gates

| Gate | Decision |
| --- | --- |
| Manifest selection and expected durations | 20/20 previously matched live private composition metadata; structural check only |
| Reference/attribution text spot checks | COMPLETE for specified selected excerpts; full-source parity NOT certified |
| Website and pipeline commit provenance | VERIFIED; two correct repositories |
| Chapter/end-matter disclaimers | Core passages present in prior selected TXT checks; legal approval PENDING |
| Copyright spoken adaptation | OWNER PRIVATE SELECTION recorded; final editorial/legal acceptance PENDING |
| Exact spoken Appendix B pipeline SHA | PENDING final audio QA; do not infer from ASR |
| Actual selected lossless WAVs and decoded QC | DEFERRED LAST |
| Full Track 00 plus all four whole-book listening blocks | DEFERRED LAST |
| Final mastered encodes and cross-track mastering spec | PENDING explicit approval and audio evidence |
| Publication, production deploy, member delivery or PR merge | NOT AUTHORIZED |

**Invariant:** Leave PR #797 DRAFT/unmerged; `public_allowed=false`, `merge_allowed=false`, `production_enabled=false`, `mastering_approval=PENDING`. No synthesis, publishing, public Descript share link, member access or Production change.

This register captures evidence and the two outstanding editorial decisions without manufacturing an approval.
