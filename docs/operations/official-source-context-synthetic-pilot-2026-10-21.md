# Official-Source Context — synthetic feasibility pilot
Date: 2026-10-21
Tracking: https://github.com/usdimpact/usd-impact-site/issues/845

## Release state and business constraint

- **DRAFT / PREVIEW-ONLY. No merge to \`main\` or Production.**
- **Zero additional cost.** No contracts, subscriptions, paid market data, new packages, infrastructure, API keys, scheduled services, database tables or vendor requests.
- Fixed, **hand-authored toy values only**, using January **2031** fictitious Fridays. No data downloaded, read or inferred from a market-data provider. The references are links that explain possible future original sources, not the provenance of fixture numbers.
- No provider fetch, upload, client-side script, API endpoint, writable storage, automated task, public JSON feed, navigation change or entitlement check is added.
- The existing Three Dials rights hold from merged #847 is preserved. The held October 16 data PR #839 is not merged.
- The existing USD Impact Score v2 pipeline, its variables, output, weights, historic archives and usage terms remain **unchanged**.

## Proposed distinct educational indicators

| Pilot identifier | If licensed/cleared later, official source | Unit | Explicit semantic exclusion |
| --- | --- | --- | --- |
| \`BOARD_H10_BROAD_NOMINAL\` | Federal Reserve Board H.10 nominal Broad Dollar Index | index points | Not DXY; its broad trade-weighted composition is different. |
| \`BOARD_H15_TIPS10Y\` | Federal Reserve Board H.15 10-year inflation-indexed constant-maturity yield (Treasury-origin observations) | percent per year | Do not silently substitute a different Treasury par real yield series or claim identical source/revision methods. |
| \`STRESS_UNAVAILABLE\` | None selected | none | Cannot replace VIX or ICE HY OAS with a convenient rate spread, NFCI, or other differently defined measure. |

No third dial, dollar regime, market recommendation, predictive probability or Score v2 output is computed. A separately reviewed SOFR-minus-IORB funding-rate example could be considered later only if New York Fed conditions, attribution, commercial-use terms and the meaning of the spread are approved; it is not part of the current toy fixture.

### Publisher verification entrypoints (links only)

- Board H.10: https://www.federalreserve.gov/releases/H10/summary/default.htm
- Board H.15: https://www.federalreserve.gov/releases/h15/
- Board disclaimer and source/trademark exceptions: https://www.federalreserve.gov/disclaimer.htm

The Board's copyright notice generally allows reuse of Board information with attribution **unless otherwise marked**. This pilot does not itself establish permission for any specific live source, upstream Treasury/third-party content, onward redistribution, API delivery, or machine-readable archives. Keep source-specific review in issue #845.

## Technical contract

- Single schema \`usd-impact-official-source-context-synthetic-v1\`; input values are local and static in \`src/data/official-source-context-synthetic.json\`.
- A **closed-world** parser requires exactly the expected schema keys, exactly the two named indicator IDs/units in the prescribed order, no additional fields, both synthetic weeks exactly seven days apart on Fridays, an explicit zero source-fetch count, publisher release disabled, Score output disabled, a separate unavailable stress record and fictional provenance for each value.
- Every malformed, stale/mismatched, renamed, injected, network-sourced, partial or supposedly live candidate yields \`status: hold\`, no rows, no regime and no Score, and can never become publishable by changing a flag.
- The page is \`/lab/official-source-context/\`, marked \`noindex, nofollow\`, not promoted in navigation. Each card says **SYNTHETIC**. A legal/compliance warning and an issue #845 link explain why values cannot be marketed as a real Three Dials snapshot.
- No feature flag or environment override can lift the hold. Source links are informational only.

## Test matrix and acceptance criteria

1. Valid toy fixture displays exactly two synthetic cards and an unavailable stress panel; publication, regime and Score stay disabled.
2. Reject \`mode: live\`, permission flips, nonzero source fetches, unknown fields, altered source ID/unit, duplicate/omitted indicator, any missing/non-finite value, non-fictional origin, wrong Friday/week, and a provided stress observation.
3. Check that neither pilot module nor Astro page performs a provider fetch or references legacy public market-data archives/Score computations.
4. Assert the existing latest Three Dials JSON remains \`pending\` and \`source_rights_state: unverified\`, with no \`dials\` or \`model_output\`, and assert the locked generator rights guard is still present.
5. Run normal \`validate:compliance\`, full Web quality, CodeQL and Dependency review. Check Vercel preview only for the exact commit. Verify rendered page and two existing protected boundaries; do not promote to Production.

## A separately approved live-data implementation would require

Before requesting or storing real observations: a per-series reuse/legal decision, explicit primary publisher and series definition, rights/attribution and disclaimers, an audit ledger recording original observation time, release time, measured-as-of, retrieval, revisions and freshness, documented license scope for member/public HTML/JSON, error handling for partial/missing/mismatched source vintages and regression-proof distinction from DXY/VIX/HY OAS. New data workflows must be independently reviewed, use new IDs and routes, and cannot unfreeze the old generator without a separate release.

**This is a non-production technical feasibility experiment, not source-rights clearance.**
