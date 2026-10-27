# Three Dials rights-safe source transition plan — 2026-10-27

Status: **REVIEW-ONLY DESIGN. CURRENT PRODUCTION RIGHTS HOLD REMAINS IN FORCE.**

This document proposes a zero-paid-license source architecture for Three Dials. It does not authorize a
methodology change, re-enable numeric snapshots, alter Score v2, merge code, deploy, or change Production.

## 1. Current rights state

Issue #845 remains the source-rights authority.

Current Production behavior is correct and fail-closed:

- public Three Dials numeric snapshots are withheld;
- public JSON/archive surfaces return rights-hold notices rather than market observations;
- the scheduled generator stops before third-party network fetches or writes;
- PR #839 remains draft/unmerged.

The restricted/unverified inputs that must not be restored without a separate grant are:

| Existing input | Current disposition |
| --- | --- |
| Yahoo Finance `DX-Y.NYB` DXY proxy | Do not redistribute. Yahoo-based numeric publication is not part of this plan. |
| ICE BofA HY OAS `BAMLH0A0HYM2` | Do not redistribute without applicable written ICE authorization. No grant is recorded. |
| Cboe VIX / `VIXCLS` | Do not redistribute under the old path. The paid licensing inquiry was closed; no grant is recorded. |

As of 2026-10-27, no provider grant is recorded that would justify removing the existing hold.

## 2. Recommended zero-paid-license candidate

This is a **methodology change**, not a substitute under the old metric IDs.

### Dial 1 — Broad USD direction

**Candidate source:** Federal Reserve Board H.10, Nominal Broad Dollar Index — Daily Index.

- Direct Board source, not Yahoo and not DXY.
- Public label must be **Broad USD direction**, not DXY.
- DXY may remain in educational text as a separate concept or outbound source link, but no DXY observation is
  copied into the public snapshot under this plan.
- The Federal Reserve Board disclaimer states that, unless otherwise indicated, information on the Board website
  is in the public domain and may be copied/distributed with the Board cited as source.

Suggested source identifier: Board H.10 daily nominal broad dollar index (`JRXWTFB_N.B`).
Existing FRED alias `DTWEXBGS` may be used for cross-checking only; the public snapshot should cite/fetch the
Board source directly so FRED is not the rights basis.

### Dial 2 — Real-rate pressure

**Candidate source:** Federal Reserve Board H.15, 10-year inflation-indexed Treasury constant maturity rate.

- Direct Board source.
- Public label remains **10-year real yield / real-rate pressure**.
- Optional nominal 10-year Treasury context may also come from H.15.
- Use the same Board public-domain/citation posture described above.
- Do not replace a real yield with a nominal Treasury yield.

### Dial 3 — Funding pressure

**Candidate inputs:**
- SOFR — Federal Reserve Bank of New York reference-rate data.
- IORB — Federal Reserve Board.
- Derived metric: **SOFR minus IORB**, in basis points.

Public label must be **Funding pressure** (or **Funding spread**), not the broader **Liquidity / stress** label.
This spread is funding context; it is not a substitute for HY OAS, VIX, GVZ, or OVX.

The New York Fed Terms of Use expressly permit using, copying, distributing, modifying and creating derivative
works from website Content for business purposes, subject to the stated conditions. Reference-rate reuse requires
the specific New York Fed notice/disclaimer. Any implementation must reproduce the current required notice
verbatim from the terms at build/release review time and include the required source attribution.

IORB should be sourced from the Federal Reserve Board directly.

## 3. What this candidate deliberately gives up

The candidate does **not** claim to recreate the old Three Dials data contract.

It removes from public numeric output:

- DXY;
- ICE BofA HY OAS;
- VIX;
- GVZ;
- OVX.

Therefore it also removes any classification logic that depends on those observations.

Reader-facing copy must not say that Broad USD is DXY, that SOFR-minus-IORB is a credit spread, or that the
funding spread by itself measures the full liquidity/stress regime.

The old numeric history and the new candidate history must not be spliced into one apparently continuous series.
If approved later, the new methodology needs a new version/effective-date boundary.

## 4. Proposed public contract

A future implementation should use a new schema/methodology version and include, for every observation:

- exact source;
- exact observation date;
- retrieval timestamp;
- unit;
- current and previous completed-week observations;
- derived change with formula;
- source-rights class;
- attribution/disclaimer requirements;
- explicit methodology version.

Recommended rights classes:

- `federal_reserve_board_public_domain`
- `new_york_fed_terms_permitted_with_notice`
- `derived_from_permitted_primary_sources`

Do not use a generic `primary_public` label as a substitute for an actual rights determination.

## 5. Required implementation changes if the owner selects this design

1. Fetch Broad USD directly from Federal Reserve Board H.10.
2. Fetch 10-year inflation-indexed yield directly from Federal Reserve Board H.15.
3. Fetch SOFR from the New York Fed and IORB from the Federal Reserve Board.
4. Remove all Three Dials runtime/public-output requests for Yahoo DXY, ICE HY OAS and Cboe volatility indexes.
5. Replace the old classifier with a separately versioned classifier based only on the three approved measures.
6. Rename reader-facing dial labels to match the measures.
7. Add New York Fed reference-rate attribution/disclaimer exactly as required by the then-current Terms of Use.
8. Preserve the existing rights hold until exact-head Preview acceptance proves the new implementation contains
   none of the restricted observations.

## 6. Regression / acceptance tests

Before any release request:

- fail if Yahoo Finance, `DX-Y.NYB`, `BAMLH0A0HYM2`, `VIXCLS`, GVZ or OVX appears in generated public data;
- fail if Dial 1 is labeled DXY while using the Board broad-dollar series;
- fail if Dial 3 is labeled full liquidity/stress while using only SOFR-minus-IORB;
- verify source hosts/paths are allow-listed;
- verify exact observation dates and completed-Friday comparison logic;
- verify the required New York Fed notice/disclaimer is rendered with any SOFR-derived publication;
- verify no restricted legacy numeric field survives in HTML, source JSON, public JSON or archives;
- use synthetic fixtures for deterministic classifier tests;
- keep Score v2 source/model tests separate and unchanged;
- validate accessibility and no-data behavior;
- exact-head CI + CodeQL + Preview route inspection before any owner release decision.

## 7. Decision gates

A future implementation PR may be prepared only as a separate candidate. Publication remains blocked until:

1. source-rights review confirms the exact Board and New York Fed pages/terms used by the implementation;
2. the owner explicitly approves the methodology change from DXY / broad stress confirmation to
   Broad USD / funding pressure;
3. editorial copy and book/practice references are audited for old metric names;
4. exact-head Preview proves restricted values are absent;
5. a separate Production release authorization is recorded.

## 8. Alternatives

If preserving the original DXY + HY OAS + volatility methodology is mandatory, keep the current hold and obtain
provider-specific redistribution licenses. Do not weaken the rights gate to preserve continuity.

An OFR Financial Stress Index could be evaluated in a separate proposal, but it is not approved here: OFR itself
warns that some non-OFR inputs can have third-party reuse restrictions. It must receive its own provenance and
rights review before numeric republication.

## 9. Source references checked 2026-10-27

- Federal Reserve Board H.10 — Nominal Broad Dollar Index.
- Federal Reserve Board H.15 — Selected Interest Rates, including 10-year inflation-indexed Treasury yield.
- Federal Reserve Board website disclaimer — Board information public domain unless otherwise indicated;
  cite the Board as source.
- Federal Reserve Bank of New York — SOFR data and Markets Data APIs.
- Federal Reserve Bank of New York Terms of Use — business copying/distribution/derivative use permitted subject
  to conditions; reference-rate data requires the specified notice/disclaimer.
- Issue #845 — existing provider-rights evidence and current Production hold.

No provider license, fee, contract, Production configuration, runtime source, public JSON, or current snapshot is
changed by this document.

## 10. Vercel project ownership checkpoint — 2026-10-27

Preview/release evidence for this repository must use the established Vercel project
`usd-impact/usd-impact-site` (`prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`).

A duplicate project, `usd-impact-team/web` (`prj_ZFYanJAO5S1pY9uwkhTTXFOk1skA`), was verified to have no custom
domains, no environment variables, no Production deployment, and a misconfigured repository root. It was deleted on
2026-10-27. Historical GitHub status entries produced by that deleted project are not release evidence for new commits.
