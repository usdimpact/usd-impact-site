# UI-40 — Owner-approved 10-film metadata wording, Draft HOLD

**Scope:** Spanish catalogue copy for ten films (11 Spanish title/description fields) and the English description for film `central-bank-swaps-vs-fima-repo` (12 fields total). Owner approved the wording in the review conversation on 2026-11-03.

**Source:** Stack only on UI-40 Draft PR #1050 at `48b4194bbc0120f2651e56973abb7b52edb0d6e9`. This is NOT a Production or release branch. Do not merge, rebase onto Production, deploy, publish/index, activate account media language, change Stream IDs/captions/audio, create paid jobs, or change entitlements or live trackers without separate review and explicit authorization.

## Content fixes

- `dxy-the-signal-vs-the-system`: distinguish DXY basket from broad trade-weighted dollar
- `inflation-expectations-cpi-vs-market-pricing`: distinguish CPI data from market-implied inflation compensation
- `currency-pegs-stability-vs-monetary-independence`: preserve policy trade-off
- `treasury-supply-issuance-vs-market-absorption`: make issuance/absorption precise
- `reserve-management-purchases-vs-qe`: distinguish reserve management from QE
- `discount-window-vs-standing-repo-facility`: distinguish facilities/US counterparties
- `dollar-funding-onshore-vs-offshore`: use onshore/offshore terminology
- `fx-hedging-natural-vs-financial`: specify natural cash-flow offsets
- `part-4-dealers-and-balance-sheet-intermediation`: clarify dealer role and balance sheets (two fields)
- `central-bank-swaps-vs-fima-repo`: clarify that Fed U.S.-dollar liquidity swap lines supply dollars to foreign central banks against foreign currency; FIMA uses Treasury collateral for temporary dollar liquidity (two fields across English and Spanish)

Official Fed source orientation: [Swap-lines FAQ](https://www.federalreserve.gov/monetarypolicy/bst_swapfaqs.htm), [FIMA FAQ](https://www.federalreserve.gov/monetarypolicy/fima-repo-facility-faqs.htm). Original archived film #23 MP4 and WebVTT are in Drive: https://drive.google.com/drive/folders/1s5ogfhtBx1W5--dlWYUHiF4ZQzE84_-L. Visual/caption evidence is NOT independently verified spoken-word parity.

## Independent gates — all remain HOLD

1. Human comparison of film #23 exact English spoken narration with English VTT and the live Stream version, preserving UID `cb6ed6180fb2091989d9627363dcbb76`.
2. All 51 individual native-speaker/editorial source-pair verdicts, still not documented as approved.
3. Rights to distribute source/translated video, AI-derived voices and subtitles; AI disclosure.
4. Authenticated keyboard/mobile/accessibility checks, separate streaming economics and owner release decision.
5. Keep original October 7 final caption QA as the authority for 51 uploaded non-default Spanish captions, but NOT rights, live narration parity or public release.

## Structural checks

The committed change updates only English/Spanish metadata, tests, and this hold record. Original `video-stream-map.js`, caption defaults, signed player, entitlements, Production, and other PRs are untouched. Run `npm run validate:localization` and `npm run validate:video-library` plus exact-head Web quality/CodeQL on this Draft head before any later integration. Preserve the unrelated Spanish Preview/Monthly work in PRs #1061, #1067 and #1068; do not overwrite their test/route/sitemap files.

**Approval scope:** approved wording only. Not a native-speaker attestation, a legal right, a security clearance, or a permission to publish.
