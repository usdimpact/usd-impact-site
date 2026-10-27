# Three Dials — owner decision record — 2026-10-27

Status: **DECISION SUPPORT ONLY. NO METHODOLOGY OR PRODUCTION CHANGE IS AUTHORIZED.**

The current Production rights hold remains the safe default. This record converts the remaining Three Dials question
into an explicit owner decision so engineering does not infer a product-methodology choice from implementation convenience.

## Decision required

Choose one of the following paths.

### Option A — preserve the original methodology and keep the hold

Keep the original conceptual stack:

1. DXY / ICE U.S. Dollar Index direction;
2. 10-year real yield;
3. broad liquidity/stress confirmation using proprietary credit/volatility observations.

Operational consequence:

- public Three Dials numeric snapshots remain withheld;
- obtain provider-specific redistribution licenses before restoring restricted values;
- no continuity break in the conceptual framework once licenses exist;
- timing, price and provider terms remain external dependencies.

This is the correct choice if preserving the existing book/framework semantics is more important than publishing a
zero-paid-license public numeric dashboard now.

### Option B — approve the rights-safe methodology transition

Adopt a new, separately versioned public framework:

1. **Broad USD direction** — Federal Reserve Board H.10 Nominal Broad Dollar Index;
2. **Real-rate pressure** — Federal Reserve Board H.15 10-year inflation-indexed Treasury constant-maturity yield;
3. **Funding pressure** — derived SOFR minus IORB spread.

Operational consequence:

- no Yahoo DXY, ICE HY OAS, VIX, GVZ or OVX observations in public Three Dials output;
- no paid redistribution license is required for the selected primary-source architecture, subject to the documented
  Board attribution and New York Fed reference-rate notice/disclaimer conditions;
- the public labels, classifier and explanatory copy must change;
- historical old-methodology observations and new-methodology observations must not be joined as one continuous series;
- a new methodology/schema version and effective date are mandatory;
- book, Daily, framework and educational references that say "DXY" or "liquidity/stress" must be audited and updated
  where they describe the live Three Dials product rather than the broader educational concept.

This is the recommended engineering path if the owner accepts a product-methodology change in exchange for a
rights-safe, primary-source public implementation.

### Option C — keep numeric Three Dials permanently private / link-only

Retain the educational Three Dials framework but do not publish a first-party numeric dashboard.

Operational consequence:

- public pages explain the three concepts and link readers to primary/provider source pages;
- internal workflows may continue to use separately authorized observations;
- no public numeric continuity or classifier is promised;
- lowest redistribution risk and lowest implementation burden;
- weaker product differentiation versus a first-party current-state dashboard.

This is the correct choice if the educational framework matters more than maintaining a public numeric feature.

## Decision comparison

| Criterion | A — original + licenses | B — rights-safe transition | C — link-only |
| --- | --- | --- | --- |
| Keeps original DXY/stress methodology | Yes | No | Conceptually only |
| Paid provider dependency | Likely | No paid license in proposed stack | No |
| Public numeric Three Dials | After licenses | Yes, after implementation approval | No |
| Historical continuity | Best | Requires hard version boundary | Not applicable |
| Rights risk | Depends on contracts | Low if conditions are implemented exactly | Lowest |
| Product change required | Minimal | Material | Material simplification |
| Engineering work | Deferred pending licenses | New sources + classifier + labels + tests | Small |
| Editorial/book audit | Small | Required | Required for live-product wording |
| Current safe state until decision | HOLD | HOLD | HOLD |

## If Option B is selected

Selection of Option B authorizes **design/implementation work on an isolated branch only** unless the owner separately
authorizes a Production release.

Implementation sequence:

1. freeze the old public schema/methodology version;
2. define the new Three Dials schema and exact labels;
3. select durable official Board transport paths independently of the retiring DDP package builder;
4. implement Board H.10 Broad USD;
5. implement Board H.15 10-year inflation-indexed Treasury yield;
6. implement New York Fed SOFR + Board IORB and derive the spread transparently;
7. remove restricted legacy observations from all public-output code paths;
8. create synthetic classifier fixtures;
9. add required New York Fed notice/disclaimer and Board attribution;
10. audit public copy, book/framework references and Daily language;
11. exact-head CI, security, Preview and route inspection;
12. independent review confirms no DXY / ICE HY OAS / VIX-family numeric leakage;
13. request a separate Production authorization.

## Acceptance conditions for Option B

A release candidate must fail closed unless all of the following are true:

- exact source identifiers and observation dates are present;
- methodology version/effective date is explicit;
- Broad USD is never labeled DXY;
- SOFR-minus-IORB is never labeled a credit spread or full-market stress measure;
- old and new histories are visibly separated;
- Yahoo Finance, `DX-Y.NYB`, `BAMLH0A0HYM2`, `VIXCLS`, GVZ and OVX are absent from generated public observations;
- the New York Fed reference-rate notice/disclaimer is current and rendered;
- Board attribution is present;
- no provider endorsement is implied;
- Score v2 behavior remains unchanged unless separately approved;
- Production remains fail-closed until exact-head acceptance and release authorization.

## Non-decision

Silence, CI success, Preview readiness, this document, or the existence of PR #870 does **not** select an option.

Until the owner explicitly selects A, B or C, the current rights hold remains the authoritative Production behavior.
