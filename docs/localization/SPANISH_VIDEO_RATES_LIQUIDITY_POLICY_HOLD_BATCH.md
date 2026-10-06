# Spanish Video Localization — Rates, Liquidity & Policy HOLD Batch

Status: **HOLD / unpublished**  
Prepared: 2026-10-06  
Source authority: live Cloudflare Stream English WebVTT for each exact production Stream UID.

## Scope completed

13 films translated and technically validated:

- U.S. Treasury Yields — Policy Expectations vs Term Premium
- Credit Spreads — Default Risk vs Liquidity Stress
- U.S. Yield Curve — Policy Restriction vs Growth Expectations
- Inflation Expectations — CPI vs Market Pricing
- Repo Markets — Policy Rates vs Funding Stress
- Treasury Supply — Issuance vs Market Absorption
- Treasury General Account vs Bank Reserves
- Quantitative Tightening — Runoff vs Reserve Scarcity
- Reserve Management Purchases vs QE
- Standing Repo Facility — Backstop vs Easing
- Discount Window vs Standing Repo Facility
- Bank Reserves vs Bank Deposits
- Repo Markets — Cash vs Collateral Liquidity

## Technical gate

Every private Spanish VTT in this batch passed:

- valid WebVTT structure;
- no cue overlap;
- cue end within the live source span;
- at most two visual lines per cue;
- maximum 42 characters per line;
- maximum 20 characters per second.

## Terminology and compliance gate

- Neutral international Spanish for Retail LATAM.
- Policy-expectation vs term-premium distinctions preserved.
- CPI, breakevens, TIPS, TGA, QT, QE, repo, reverse repo, SOFR and Standing Repo Facility treated consistently.
- Temporary backstop/funding operations are not described as monetary easing unless the English source does so.
- Conditional language remains conditional.
- No investment recommendation or stronger claim added.
- English media remains unchanged.

## Private artifact

Persistent Library path:

`/USD Impact/Localization/Spanish/Video Subtitles/HOLD/USD_Impact_Spanish_Rates_Liquidity_Policy_Live_Source_HOLD_Batch.zip`

SHA-256:

`c19e08e8344ce6626a5575222002aac90b5e0dbbd5d7dabaca34440a8a51009c`

The private Spanish caption text is intentionally not stored in this public repository.

## Release boundary

This status does **not** authorize:

- Cloudflare Spanish caption upload;
- default-track changes;
- public `/es/` publication;
- Production deployment;
- merge of PR #760.

Frame-level visual QA and explicit release approval remain required before any caption upload.
