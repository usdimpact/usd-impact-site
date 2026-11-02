# UI-40 — Original 51-film MP4 + English WebVTT archive presence audit

**Date:** 2026-11-03 | **Status:** DRAFT ONLY / RIGHTS AND PUBLICATION HOLD

## Source authority and audit boundary

- English catalog: Draft PR #1072 at commit `48929e4f5a02a7088a776ed738eee4324493e3de`, blob `e6118f969456abc3bda0e0c3fb745b5cb00056fb`; original 51 film array order is the numbered archive order (44 short films + seven Funding Stack parts).
- Evidence: read-only authenticated listing of private Google Drive root `upload`, its 44 numbered short-film folders, seven numbered `masterclass` folders, and the two nested upload folders noted below. Private Drive identifiers and file links are intentionally omitted here.
- **Result:** 51/51 archival MP4 + English WebVTT file pairs located by filename and MIME type; 48 are clean direct two-file pairs. Film 2 and Funding Stack Part 6 require nested package selection; Funding Stack Part 7 contains a direct MP4/VTT pair plus an auxiliary text file.
- **Not certified:** footage/graphic source ownership, licensed narration or music, contributor assignments, financial-data reuse rights, per-film source hashes, export-to-current-Stream binary equality, Spanish derivative/display rights, public free/paid distribution or independent 51/51 native-speaker review.
- Historic protected delivery in merged [PR #159](https://github.com/usdimpact/usd-impact-site/pull/159) and subsequent signed-only Stream provider QA remains separate authority. No Stream IDs are copied into this public-facing evidence document.

## Exact archive source-selection exceptions

1. **Short Film #2 — `dollar-yields-liquidity`:** parent `/upload/2` contains a `USD_Impact_Film_02_Cloudflare_Upload_Package` folder and ZIP. The nested folder holds `USD_Impact_Film_02_Dollar_Yields_Liquidity_FASTSTART.mp4` (3,656,930 bytes) and `USD_Impact_Film_02_Dollar_Yields_Liquidity.en.vtt` (1,887 bytes). **Present, nested**, not missing.
2. **Funding Stack Part 6 — `part-6-global-dollar-funding-and-fx-swaps`:** `/upload/masterclass/6` includes a root MP4 named `USD_Impact_Dollar_Funding_Stack_Part_7_Dollar_Liquidity_Backstops_and_Policy_Facilities_Final.mp4` (30,704,822 bytes) alongside `part-6.en.vtt` (9,703 bytes), a ZIP and a clean folder. **Do not treat the root Part-7-named MP4 as an approved Part 6 source.** The nested `USD_Impact_Film_6_Clean_Upload_Package` has `USD_Impact_Dollar_Funding_Stack_Part_6_Global_Dollar_Funding_and_FX_Swaps_Final.mp4` (34,294,415 bytes) and `part-6.en.vtt` (9,703 bytes). This is the unambiguously *Part-6-named archival candidate*, not cryptographic proof of the current hosted asset.
3. **Funding Stack Part 7 — `part-7-dollar-liquidity-backstops-and-policy-facilities`:** `/upload/masterclass/7` holds the proper `USD_Impact_Dollar_Funding_Stack_Part_7_Dollar_Liquidity_Backstops_and_Policy_Facilities_Final.mp4` (30,704,822 bytes) and `part-7.en.vtt` (9,818 bytes), plus `raw.txt`. A root MP4 with the same filename and length is also found in Part 6's parent; contents have **not** been compared byte for byte.
4. **Film #23 — `central-bank-swaps-vs-fima-repo`:** the two original archived Drive files were SHA-256 verified in separate read-only receipts (MP4 `88fb2f1c9c35ce3ad67ab947bf1a048e788a234754fc7ffbde4657b44f4f6d27`, EN VTT `2235895f4ab5aadddc859dd4f6525916e5682f36a7507fbcfa353f54f95377b2`). The owner's FULL LISTEN and LIVE FILM23 CONTENT PASS are **human meaning/content** attestations, not provider file hashes or legal rights.

## 51-film private-source locator matrix

`Source folder` uses relative positions within the already owned, private Drive upload archive; do not publish raw MP4 or VTT links. `Originals` means one MP4 and one EN VTT **found**, not authenticated as the exact Stream upload or authorized for broader distribution.

| # | Catalogue slug | Source folder | Originals found | Source-selection note |
| ---: | --- | --- | --- | --- |
| 1 | `dxy-the-signal-vs-the-system` | `short/1` | MP4 + EN VTT | Direct pair |
| 2 | `dollar-yields-liquidity` | `short/2` | MP4 + EN VTT | Use nested Film 02 package |
| 3 | `one-dollar-shock-four-market-reactions` | `short/3` | MP4 + EN VTT | Direct pair |
| 4 | `gold-dollar-vs-real-yields` | `short/4` | MP4 + EN VTT | Direct pair |
| 5 | `oil-dollar-pricing-vs-physical-market` | `short/5` | MP4 + EN VTT | Direct pair |
| 6 | `bitcoin-dollar-liquidity-vs-crypto-flows` | `short/6` | MP4 + EN VTT | Direct pair |
| 7 | `equities-dollar-strength-vs-earnings` | `short/7` | MP4 + EN VTT | Direct pair |
| 8 | `lng-dollar-pricing-vs-regional-gas-markets` | `short/8` | MP4 + EN VTT | Direct pair |
| 9 | `eurusd-relative-rates-and-growth` | `short/9` | MP4 + EN VTT | Direct pair |
| 10 | `us-treasury-yields-policy-expectations-vs-term-premium` | `short/10` | MP4 + EN VTT | Direct pair |
| 11 | `credit-spreads-default-risk-vs-liquidity-stress` | `short/11` | MP4 + EN VTT | Direct pair |
| 12 | `us-yield-curve-policy-restriction-vs-growth-expectations` | `short/12` | MP4 + EN VTT | Direct pair |
| 13 | `inflation-expectations-cpi-vs-market-pricing` | `short/13` | MP4 + EN VTT | Direct pair |
| 14 | `repo-markets-policy-rates-vs-funding-stress` | `short/14` | MP4 + EN VTT | Direct pair |
| 15 | `treasury-supply-issuance-vs-market-absorption` | `short/15` | MP4 + EN VTT | Direct pair |
| 16 | `treasury-general-account-vs-bank-reserves` | `short/16` | MP4 + EN VTT | Direct pair |
| 17 | `quantitative-tightening-runoff-vs-reserve-scarcity` | `short/17` | MP4 + EN VTT | Direct pair |
| 18 | `reserve-management-purchases-vs-qe` | `short/18` | MP4 + EN VTT | Direct pair |
| 19 | `standing-repo-facility-backstop-vs-easing` | `short/19` | MP4 + EN VTT | Direct pair |
| 20 | `discount-window-vs-standing-repo-facility` | `short/20` | MP4 + EN VTT | Direct pair |
| 21 | `bank-reserves-vs-bank-deposits` | `short/21` | MP4 + EN VTT | Direct pair |
| 22 | `repo-markets-cash-vs-collateral-liquidity` | `short/22` | MP4 + EN VTT | Direct pair |
| 23 | `central-bank-swaps-vs-fima-repo` | `short/23` | MP4 + EN VTT | Direct; exact archived hashes verified |
| 24 | `correspondent-banking` | `short/24` | MP4 + EN VTT | Direct pair |
| 25 | `cross-currency-basis-demand-vs-hedging-cost` | `short/25` | MP4 + EN VTT | Direct pair |
| 26 | `cross-currency-basis-vs-spot-fx` | `short/26` | MP4 + EN VTT | Direct pair |
| 27 | `currency-mismatch-dollar-liabilities-vs-local-cash-flow` | `short/27` | MP4 + EN VTT | Direct pair |
| 28 | `currency-pegs-stability-vs-monetary-independence` | `short/28` | MP4 + EN VTT | Direct pair |
| 29 | `dollar-debt-service-interest-vs-refinancing` | `short/29` | MP4 + EN VTT | Direct pair |
| 30 | `dollar-funding-fx-swaps-vs-unsecured-borrowing` | `short/30` | MP4 + EN VTT | Direct pair |
| 31 | `dollar-funding-onshore-vs-offshore` | `short/31` | MP4 + EN VTT | Direct pair |
| 32 | `dollar-funding-stress-basis-vs-commercial-paper` | `short/32` | MP4 + EN VTT | Direct pair |
| 33 | `economic-fx-exposure-contracts-vs-competitiveness` | `short/33` | MP4 + EN VTT | Direct pair |
| 34 | `fx-exposure-transaction-vs-translation` | `short/34` | MP4 + EN VTT | Direct pair |
| 35 | `fx-hedging-demand-forward-points-vs-direction` | `short/35` | MP4 + EN VTT | Direct pair |
| 36 | `fx-hedging-natural-vs-financial` | `short/36` | MP4 + EN VTT | Direct pair |
| 37 | `fx-intervention-sterilized-vs-unsterilized` | `short/37` | MP4 + EN VTT | Direct pair |
| 38 | `fx-pass-through-invoice-vs-producer-currency` | `short/38` | MP4 + EN VTT | Direct pair |
| 39 | `fx-reserves-liquidity-buffer-vs-defense` | `short/39` | MP4 + EN VTT | Direct pair |
| 40 | `fx-swap-rollovers-short-vs-long-horizon` | `short/40` | MP4 + EN VTT | Direct pair |
| 41 | `fx-swaps-currency-exchange-vs-funding-obligation` | `short/41` | MP4 + EN VTT | Direct pair |
| 42 | `global-dollar-credit-bank-loans-vs-debt-securities` | `short/42` | MP4 + EN VTT | Direct pair |
| 43 | `the-eurodollar-system` | `short/43` | MP4 + EN VTT | Direct pair |
| 44 | `when-dollars-disappear-global-liquidity-stress` | `short/44` | MP4 + EN VTT | Direct pair |
| 45 | `part-1-foundations` | `masterclass/1` | MP4 + EN VTT | Direct pair |
| 46 | `part-2-fx-swap-engine` | `masterclass/2` | MP4 + EN VTT | Direct pair |
| 47 | `part-3-repo-collateral-and-haircuts` | `masterclass/3` | MP4 + EN VTT | Direct pair |
| 48 | `part-4-dealers-and-balance-sheet-intermediation` | `masterclass/4` | MP4 + EN VTT | Direct pair |
| 49 | `part-5-funding-stress-and-market-transmission` | `masterclass/5` | MP4 + EN VTT | Direct pair |
| 50 | `part-6-global-dollar-funding-and-fx-swaps` | `masterclass/6` | MP4 + EN VTT | Use nested Part 6 CLEAN package; root MP4 labelled Part 7 |
| 51 | `part-7-dollar-liquidity-backstops-and-policy-facilities` | `masterclass/7` | MP4 + EN VTT | Direct pair; auxiliary raw.txt |

## Remaining gates and remediation safety

- [ ] Source-edit project, actual contributors, narrator/voice generation/account and licences, visual/font/music source documentation, executed author → KELA LEADS S.R.L. rights chain (or first-party evidence accepted after legal review).
- [ ] Written right to show translations/ES captions and publicly distribute films without changing existing member licences; confirm any third-party graphics and dataset permissions for what is actually reproduced.
- [ ] Authorized archival candidate → Cloudflare currently hosted asset provenance; match Part 6's original candidate by independent duration/content/hash only under a separate read-only evidence authority.
- [ ] Formal native Spanish editor review of 51 current title/description pairs, independent of assistant pre-screen PASS.
- [ ] Separate exact-Preview authenticated accessibility, cost/abuse, rights and explicit owner release decision; preserve Production/entitlements/Stream signing and caption defaults.

**Do not modify, delete, move, replace or re-upload any root Part 6/7 files from this audit.** No new paid generation or account-level media access is authorized. Publication remains HOLD.
