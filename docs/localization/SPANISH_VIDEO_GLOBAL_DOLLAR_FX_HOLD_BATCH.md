# Spanish Video Localization — Global Dollar & FX Mechanics HOLD Batch

Status: **HOLD / unpublished**  
Source authority: live Cloudflare Stream English WebVTT for the exact production Stream UID  
Prepared: 2026-10-06

## Batch result

Global Dollar & FX Mechanics is complete at the private HOLD stage:

- Films completed: **22 / 22**
- Source tracks: live Cloudflare Stream English WebVTT only
- Spanish Cloudflare uploads: **0**
- Default-track changes: **0**
- Public Spanish routes: **0**
- Production changes caused by this batch: **0**

Private subtitle text is intentionally not stored in this public repository.

## Included films

1. Central-Bank Swaps vs FIMA Repo
2. Correspondent Banking
3. Cross-Currency Basis — Dollar Demand vs Hedging Cost
4. Cross-Currency Basis vs Spot FX
5. Currency Mismatch — Dollar Liabilities vs Local Cash Flow
6. Currency Pegs — Stability vs Monetary Independence
7. Dollar Debt Service — Interest vs Refinancing
8. Dollar Funding — FX Swaps vs Unsecured Borrowing
9. Dollar Funding — Onshore vs Offshore
10. Dollar Funding Stress — Basis vs Commercial Paper
11. Economic FX Exposure — Contracts vs Competitiveness
12. FX Exposure — Transaction vs Translation
13. FX Hedging Demand — Forward Points vs Direction
14. FX Hedging — Natural vs Financial
15. FX Intervention — Sterilized vs Unsterilized
16. FX Pass-Through — Invoice vs Producer Currency
17. FX Reserves — Liquidity Buffer vs Defense
18. FX Swap Rollovers — Short vs Long Horizon
19. FX Swaps — Currency Exchange vs Funding Obligation
20. Global Dollar Credit — Bank Loans vs Debt Securities
21. The Eurodollar System
22. When Dollars Disappear — Global Liquidity Stress

## QA gate

Every private VTT in the batch passed:

- valid WebVTT structure;
- no overlapping cues;
- no cue beyond its live English source span;
- maximum two visual lines;
- maximum 42 characters per line;
- maximum 20 characters per second.

Maximum observed CPS across the batch: **18.4**.  
Maximum observed line length across the batch: **42** characters.

## Terminology / compliance controls

The batch preserves the distinctions among:

- spot FX and cross-currency funding basis;
- covered interest parity and basis dislocations;
- forward points and directional FX forecasts;
- contractual transaction exposure and translation exposure;
- currency mismatch and total foreign-currency debt;
- natural and financial hedging;
- sterilized and unsterilized FX intervention;
- reserve buffers, central-bank swaps, FIMA Repo and other official backstops;
- onshore and offshore dollar funding;
- FX-swap rollover risk and longer-horizon asset exposure;
- bank loans, debt securities and off-balance-sheet FX-swap obligations.

Conditional source language remains conditional. No investment recommendation or stronger market claim was added.

## Program status after this batch

Live-source Spanish HOLD progress:

- Core Dollar Framework: 3 / 3
- Asset Transmission: 6 / 6
- Rates, Liquidity & Policy: 13 / 13
- Global Dollar & FX Mechanics: 22 / 22
- Dollar Funding Stack masterclass: 0 / 7 release-candidate live-source rebuilds

**Total: 44 / 51 films at live-source Spanish HOLD stage.**

The earlier pre-live-source masterclass pilot remains historical workflow evidence only and does not count toward release-candidate completion.

## Release boundary

This document does **not** authorize:

- Spanish caption upload to Cloudflare;
- changing the English default caption track;
- public `/es/` publication;
- email activation;
- Production deployment;
- merge or rebase of PR #760.

The temporary Preview-only source-recovery route must still be removed before PR #760 can be considered merge-ready.

Frame-level visual QA and explicit owner release approval remain required before any caption upload.
