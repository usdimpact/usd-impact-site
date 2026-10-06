# Spanish Video Localization — Live Source Inventory

Status: **SOURCE RECOVERY COMPLETE / SPANISH PUBLICATION HOLD**  
Verified: 2026-10-06  
Authority: live Cloudflare Stream English WebVTT for the exact production Stream UID

## Result

All 51 current USD Impact Video Library films returned a valid live English WebVTT through the branch-scoped, read-only Preview recovery path.

- Live films checked: **51**
- Live English VTTs returned: **51**
- Missing English caption tracks: **0**
- Source tracks reconstructed from title/duration guesses: **0**
- Cloudflare caption mutations: **0**
- Spanish caption uploads: **0**
- Default-track changes: **0**

The live Stream English VTT is now the localization source of truth for every film.

## Important supersession

The earlier private Spanish pilot assets for DXY and masterclass Parts 3–7 were produced from verified production-master/Descript timing before live caption readback was available.

The control comparison showed that the live DXY English WebVTT differs materially from the earlier source transcript and cue timing. Therefore:

- the previous DXY Spanish pilot is **SUPERSEDED**;
- the previous Parts 3–7 Spanish pilot files remain historical working drafts only;
- none of those six files may be promoted to Cloudflare without being rebuilt or reconciled cue-by-cue against the live Stream English VTT;
- the prior HOLD ZIP remains evidence of the workflow experiment, not a release candidate.

## Live source counts

### Core Dollar Framework
- `dxy-the-signal-vs-the-system` — 14 cues
- `dollar-yields-liquidity` — 28 cues
- `one-dollar-shock-four-market-reactions` — 21 cues

### Asset Transmission
- `gold-dollar-vs-real-yields` — 23 cues
- `oil-dollar-pricing-vs-physical-market` — 23 cues
- `bitcoin-dollar-liquidity-vs-crypto-flows` — 22 cues
- `equities-dollar-strength-vs-earnings` — 25 cues
- `lng-dollar-pricing-vs-regional-gas-markets` — 27 cues
- `eurusd-relative-rates-and-growth` — 23 cues

### Rates, Liquidity & Policy
- `us-treasury-yields-policy-expectations-vs-term-premium` — 26 cues
- `credit-spreads-default-risk-vs-liquidity-stress` — 27 cues
- `us-yield-curve-policy-restriction-vs-growth-expectations` — 27 cues
- `inflation-expectations-cpi-vs-market-pricing` — 26 cues
- `repo-markets-policy-rates-vs-funding-stress` — 26 cues
- `treasury-supply-issuance-vs-market-absorption` — 26 cues
- `treasury-general-account-vs-bank-reserves` — 24 cues
- `quantitative-tightening-runoff-vs-reserve-scarcity` — 26 cues
- `reserve-management-purchases-vs-qe` — 21 cues
- `standing-repo-facility-backstop-vs-easing` — 21 cues
- `discount-window-vs-standing-repo-facility` — 22 cues
- `bank-reserves-vs-bank-deposits` — 17 cues
- `repo-markets-cash-vs-collateral-liquidity` — 20 cues

### Global Dollar & FX Mechanics
- `central-bank-swaps-vs-fima-repo` — 22 cues
- `correspondent-banking` — 22 cues
- `cross-currency-basis-demand-vs-hedging-cost` — 18 cues
- `cross-currency-basis-vs-spot-fx` — 22 cues
- `currency-mismatch-dollar-liabilities-vs-local-cash-flow` — 22 cues
- `currency-pegs-stability-vs-monetary-independence` — 20 cues
- `dollar-debt-service-interest-vs-refinancing` — 21 cues
- `dollar-funding-fx-swaps-vs-unsecured-borrowing` — 24 cues
- `dollar-funding-onshore-vs-offshore` — 21 cues
- `dollar-funding-stress-basis-vs-commercial-paper` — 19 cues
- `economic-fx-exposure-contracts-vs-competitiveness` — 19 cues
- `fx-exposure-transaction-vs-translation` — 23 cues
- `fx-hedging-demand-forward-points-vs-direction` — 20 cues
- `fx-hedging-natural-vs-financial` — 20 cues
- `fx-intervention-sterilized-vs-unsterilized` — 21 cues
- `fx-pass-through-invoice-vs-producer-currency` — 20 cues
- `fx-reserves-liquidity-buffer-vs-defense` — 22 cues
- `fx-swap-rollovers-short-vs-long-horizon` — 20 cues
- `fx-swaps-currency-exchange-vs-funding-obligation` — 20 cues
- `global-dollar-credit-bank-loans-vs-debt-securities` — 20 cues
- `the-eurodollar-system` — 20 cues
- `when-dollars-disappear-global-liquidity-stress` — 21 cues

### Dollar Funding Stack
- `part-1-foundations` — 186 cues
- `part-2-fx-swap-engine` — 174 cues
- `part-3-repo-collateral-and-haircuts` — 187 cues
- `part-4-dealers-and-balance-sheet-intermediation` — 185 cues
- `part-5-funding-stress-and-market-transmission` — 168 cues
- `part-6-global-dollar-funding-and-fx-swaps` — 170 cues
- `part-7-dollar-liquidity-backstops-and-policy-facilities` — 97 cues

## Timestamp compatibility

The live Part 6 track uses valid WebVTT short timestamps such as `00:00.000`, while the other tracks generally use `HH:MM:SS.mmm`.

The localization validator has been updated to accept both valid WebVTT timestamp forms.

## Translation rule from this point forward

Every Spanish caption file must be derived from the corresponding live English WebVTT above.

Do not translate from:
- historical HeyGen render timing;
- Descript timing derived from an older source;
- title/duration similarity;
- the historical Batch 01 Spanish pilot;
- a script that has not been proven identical to the live Stream caption track.

## Temporary source-recovery route

The branch contains a temporary Preview-only English caption readback action.

It is:
- GET-only;
- English-only;
- limited to known Video Library slugs;
- enabled only when `VERCEL_ENV=preview` and the exact localization branch is active;
- private/no-store/noindex;
- unable to execute in Production or on `main`.

**It must be removed before PR #760 can be considered for merge.**

## Release state

Spanish video publication remains **HOLD**.

This inventory authorizes translation/QA work only. It does not authorize:
- Spanish Cloudflare caption upload;
- changing the default caption track;
- publishing `/es/`;
- merging PR #760;
- Production deployment.
