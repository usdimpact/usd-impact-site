# Spanish Edition 1.3 external source verification checkpoint — 2026-10-06

Status: **REFERENCE QA IN PROGRESS — HOLD**  
Purpose: independent current-source verification for selected chapter references that surfaced during Spanish parity review.  
Production impact: **NONE**

## Verified live primary / institutional destinations

### EIA crude oil — overview

Current authoritative destination:
`https://www.eia.gov/finance/markets/crudeoil/`

The EIA overview identifies multiple crude-price drivers including spot prices, non-OPEC supply, OPEC supply, inventories, financial markets and demand.

### EIA crude oil — balance

Current authoritative destination:
`https://www.eia.gov/finance/markets/crudeoil/balance.php`

This is the correct EIA `What drives crude oil prices: Balance` page.

Historical Spanish Chapter 5 incorrectly labels an entry as `Balance` while pointing it to the OPEC-supply path.

### EIA crude oil — OPEC supply

Current authoritative destination:
`https://www.eia.gov/finance/markets/crudeoil/supply-opec.php`

This is a distinct EIA source and should remain a separate reference from `Balance`.

### World Gold Council — fiscal concerns / real rates / central-bank demand

Verified destination:
`https://www.gold.org/goldhub/gold-focus/2025/06/you-asked-we-answered-are-fiscal-concerns-driving-gold`

The article is dated 24 June 2025 and discusses real rates, fiscal concerns, risk mitigation and central-bank buying.

### SEC — spot Bitcoin ETP approval statement

Verified destination:
`https://www.sec.gov/newsroom/speeches-statements/gensler-statement-spot-bitcoin-011023`

Dated 10 January 2024. It states that the Commission approved listing and trading of a number of spot bitcoin exchange-traded product shares.

### IMF — The Crypto Cycle and US Monetary Policy

Verified destination:
`https://www.imf.org/en/publications/wp/issues/2023/08/04/the-crypto-cycle-and-us-monetary-policy-534834`

Published 4 August 2023.

Historical Spanish Chapter 7 uses an older-looking IMF URL identifier. The final Spanish source block should use the verified current destination or a governed canonical equivalent.

### EIA natural gas — factors affecting prices

Verified destination:
`https://www.eia.gov/energyexplained/natural-gas/factors-affecting-natural-gas-prices.php`

Current EIA page confirms supply, storage, imports/exports, weather, economic growth and alternative-fuel availability as major price factors.

### BIS — 2025 Triennial Central Bank Survey

Verified current survey hub:
`https://www.bis.org/publications/triennial-central-bank-survey-foreign-exchange-and-over-the-counter-otc-derivatives-markets-2025`

BIS states:

- preliminary results were released in September 2025;
- complete turnover data and analysis followed in December 2025;
- final turnover data were released in June 2026.

This creates an upstream source-currentness issue in Candidate 2 Chapter 12, whose selected-reference text still says `2025 preliminary results`.

### BIS — April 2025 FX turnover

Verified BIS materials report that the U.S. dollar was on one side of 89.2% of FX trades in April 2025.

This supports the Chapter 1 reference concept and provides a current institutional source for any final citation/link layer.

## Confirmed localization/source defects

1. **Chapter 5** — `Balance` label paired with OPEC-supply URL: must be corrected.
2. **Chapter 7** — IMF Crypto Cycle legacy URL should be replaced with current verified institutional destination or governed canonical equivalent.
3. **Chapter 12** — `preliminary results` label is stale relative to current BIS publication state and requires upstream source-authority resolution before Spanish release.

## Not yet independently closed in this checkpoint

These should remain in later reference QA rather than be assumed valid:

- FASB ASU 2023-08 exact current public landing page;
- all current CME/Cboe/ICE destination variants;
- all Federal Reserve/FRED deep links;
- every WGC/IMF secondary reference in Chapters 1-13;
- all Further Reading entries;
- all Appendix B methodology/live-link destinations.

## Rule

Localization must not silently use a stale or broken source merely because it appears in the historical Spanish file.

Where Candidate 2 itself is stale, ambiguous or superseded at the source-label level, record the upstream issue and resolve it in the controlling source/reference layer before final Spanish release assembly.

Publication remains **HOLD**.
