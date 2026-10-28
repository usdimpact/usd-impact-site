# Three Dials Board-direct source adapter candidate — 2026-10-28

Status: **REVIEW-ONLY / NOT MERGED / NOT PUBLISHED / NO SOURCE-RIGHTS CONCLUSION**

Repository: `usdimpact/usd-impact-site`  
Base: `674d2661a0caa4845ad1a650e813368b54857837`  
Branch: `review/three-dials-board-direct-20261028-v2`

## Purpose

Prepare a reversible candidate that removes FRED as the transport for **new Three Dials generator fetches** and instead reads the three Federal Reserve Board-origin inputs directly from the Board's Data Download Program (DDP).

This record does not authorize publication, does not resolve the long-term source-rights decision, and does not alter any existing immutable snapshot.

## Candidate source map

| Dial input | Board release | Exact Board source series | Current DDP package id used by candidate |
| --- | --- | --- | --- |
| Broad USD | H.10 | `H10/H10/JRXWTFB_N.B` | `122e3bcb627e8e53f1bf72a1a09cfb81` |
| 10-year real yield | H.15 | `H15/H15/RIFLGFCY10_XII_N.B` | `0b98a66d3ff5e1ea0fbf88adc59b387f` |
| IORB | Policy Rates | `PRATES/PRATES_POLICY_RATES/RESBM_N.D` | `c27939ee810cb2e929a920a6bd77d9f6` |

SOFR remains fetched directly from the Federal Reserve Bank of New York API. The funding dial remains the USD Impact-derived SOFR-minus-IORB spread.

## Fail-closed controls added

The candidate:

- accepts Board responses only from `https://www.federalreserve.gov`;
- requests CSV through the Board DDP `/datadownload/Output.aspx` endpoint using the Board's current download query shape (no `type=package` parameter);
- requires the live Board `seriescolumn` header shape: `Series`, `Series Description`, followed by date columns;
- requires all observation columns to be valid ISO dates;
- requires exactly one row with the expected Board series code and rejects missing or duplicate series rows;
- binds the release and package IDs in the first-party Board request URL rather than inferring identity from unavailable metadata rows;
- rejects a response with fewer than two usable observations in the requested window;
- keeps the existing bounded response size, redirect-origin and request-timeout controls;
- keeps the existing NY Fed SOFR origin restriction;
- adds tests that reject `fred.stlouisfed.org` and `/graph/fredgraph.csv` across the generator/source adapter;
- adds synthetic no-network parser tests for quoted CSV fields, exact series-row identity, required `Series`/`Series Description` plus date-column headers, usable-observation bounds and DDP URL construction;
- records a 2026-10-28 live-browser verification that the Board H.10 download flow resolves to `Output.aspx?...&filetype=csv&label=include&layout=seriescolumn` without `type=package`; the exact `type=package` variant failed and is regression-blocked;
- records a second 2026-10-28 live-browser check of the downloaded H.10 CSV: current `seriescolumn` output is row-oriented with `Series`, `Series Description`, then date columns, and does not contain a `Unique Identifier` metadata row.

## Important lifecycle limitation

The Board currently exposes these releases through DDP, but the Board has announced that the DDP **Build Your Package** feature will be removed in the week of November 9, 2026, in preparation for eventual DDP retirement.

Therefore this adapter is deliberately a **temporary stopgap candidate**, not the selected long-term data architecture. A changed or retired package must fail closed until a replacement source adapter is separately reviewed.

Official references:

- Federal Reserve Board H.10: https://www.federalreserve.gov/releases/h10/current/
- Federal Reserve Board H.15: https://www.federalreserve.gov/releases/h15/
- Federal Reserve Board Policy Rates / DDP: https://www.federalreserve.gov/datadownload/Choose.aspx?rel=PRATES
- Federal Reserve Board data-download notice: https://www.federalreserve.gov/datadownload/

## What this branch does not do

- does **not** rewrite `apps/web/src/data/three-dials-latest.json`;
- does **not** rewrite `apps/web/public/data/three-dials/latest.json`;
- does **not** create or update any dated Three Dials archive;
- does **not** invoke the snapshot generator against live sources;
- does **not** publish or redistribute a new numeric observation;
- does **not** change the Three Dials methodology, thresholds or interpretation rules;
- does **not** change the USD Impact Score;
- does **not** contact the Board, St. Louis Fed or another provider;
- does **not** decide whether the Board-direct route is the approved long-term source.

## Remaining human decision

Decision 3 remains open.

The owner/legal/source-governance decision must choose a durable source route before this can become a publication path. The present candidate only proves that the generator can be separated from FRED transport while remaining fail-closed.

## Control statement

No merge, publication, scheduled generation, archive creation, provider contact or Production change is authorized by this record.
