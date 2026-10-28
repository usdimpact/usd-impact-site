# Aggregate-safe Weekly / Monthly Report prototype — 2026-10-28

Status: **review-only / not wired to publication / no existing content changed**.

Related:
- pipeline issue #155;
- pipeline combined-containment Draft #164, exact accepted head `4377d5a1922d9a1d3e47f94a5271b7cb2c1348f3`;
- pipeline public-safe Score schema blob `d0f35a67f4d371df3677b59ac4e0173a6ccfe540`;
- site main Weekly Report rights HOLD;
- site Score-derived consumer inventory.

## Goal

Prove that the Reports product can continue at the aggregate Score/regime layer without requiring any public Score component level, z-score, contribution, provenance, normalization moment, or component-derived source URL.

This prototype is deliberately separate from the current production Weekly Report generator.

## Current production dependency

The live Weekly Report generator currently requires:
- eight Score drivers;
- eight source-provenance records;
- fresh provenance status;
- component contributions;
- nearest regime boundary;
- archived `weekly_input.json`.

It then publishes named component contribution rankings and a Class-C source URL.

The active site rights gate prevents new scheduled/manual Weekly Report generation while issue #155 remains HOLD.

## Upstream aggregate-safe Score contract

This prototype accepts **exactly** the public-safe Score schema carried unchanged into pipeline #164:

`score-public-v2-safe-1`

Allowed upstream structure:
- aggregate latest week;
- aggregate Score;
- regime;
- week-over-week aggregate Score change;
- four-week aggregate Score change;
- aggregate Score/regime history;
- aggregate-history SHA-256;
- generation metadata and fixed methodology weights.

The site validator fails closed if that upstream schema gains any new top-level, latest, release-evidence or history-row field before review.

Fixed methodology weights may be present upstream, but their component names are not copied into the report candidate.

## Weekly candidate contract

Schema:

`weekly-report-public-safe-v1`

Files:
- `apps/web/scripts/score-public-safe-report-prototype.mjs`;
- `apps/web/scripts/schemas/weekly-report-public-safe-v1.schema.json`;
- `apps/web/scripts/test-score-public-safe-report-prototype.mjs`.

The candidate contains:
- period start/end;
- deterministic title/summary;
- aggregate Score;
- regime;
- weekly aggregate Score change;
- four-week aggregate Score change;
- aggregate-history SHA-256;
- the five checked-in Daily source editions;
- source-bounded themes derived from those Dailies;
- future catalysts already carried by those Dailies;
- compliance and methodology notes;
- explicit rights-safety flags.

It does **not** contain:
- Score driver/component values;
- component z-scores;
- component contributions;
- softer/firmer component name lists;
- provider/source provenance;
- provider tickers;
- normalization means/std;
- `weekly_input.json`;
- strict reproduction bundles;
- nearest regime boundary;
- component-derived Score source URL.

### Why nearest regime boundary is omitted

The aggregate-safe Score schema carried into #164 does not publish it.

This prototype does not reconstruct, infer, or hard-code it. If the eventual approved public Score contract adds an aggregate-safe boundary field, that must be a separately reviewed upstream schema change.

### Why source URL is omitted

The current source URL points to Class-C `weekly_input.json`.

Until an approved aggregate-safe public URL exists, the report binds evidence using the aggregate-history SHA-256 rather than inventing a public URL.

## Monthly input contract

Schema:

`monthly-report-public-safe-input-v1`

File:
- `apps/web/scripts/schemas/monthly-report-public-safe-input-v1.schema.json`.

The Monthly artifact is intentionally an **input/evidence contract, not publishable prose**.

It requires exactly four consecutive aggregate-safe Weekly candidates and emits:
- four-point aggregate Score/regime path;
- one aggregate-history SHA-256 per source week;
- four source Weekly candidate identities;
- source-bounded theme evidence from those Weeklies;
- an explicit editorial rule forbidding reintroduction of component-derived Score values.

This avoids automatically inventing a four-week narrative.

## Existing Monthly Reports

Current published Monthly content can include named Score component contribution synthesis inherited from Weekly Reports.

The prototype does not edit or delete those historical files.

A future Monthly migration must:
1. use aggregate-safe Weekly candidates;
2. preserve the four-week aggregate Score/regime path;
3. source narrative claims only from approved Weekly/Daily evidence;
4. omit named Score component contribution rankings unless rights treatment explicitly allows them;
5. pass a separate historical-content decision.

## Weekly Newsletter dependency

The current Weekly Newsletter contract does not republish named component contribution values, but it carries the Weekly Report's Score source URL.

A future migration must update that contract after the aggregate-safe Weekly Report schema is approved.

This prototype does not change newsletter rendering, dispatch, recipients, consent, Resend, or sending behavior.

## Tests

The review tests prove:
- the exact aggregate-safe Score contract carried into #164 is accepted;
- unexpected upstream schema growth fails closed;
- unsafe driver/provenance/boundary fields are rejected;
- component methodology-weight names are not copied into report output;
- all rights-safety flags remain false;
- four consecutive Weekly candidates produce a bounded Monthly input;
- Monthly gaps are rejected;
- component-derived fields cannot be reintroduced;
- the existing component-based production generator remains unchanged and isolated;
- JSON schemas encode the same aggregate-only restrictions.

## Future migration sequence

Only after rights disposition:

1. approve the aggregate public Score schema;
2. complete the Development private-evidence rehearsal if private retention is approved;
3. choose/version the public aggregate-safe Score URL;
4. convert the current Weekly Report content schema to a new version rather than silently changing old reports;
5. update Weekly Newsletter consumers;
6. define the aggregate-safe Monthly editorial schema;
7. decide historical Weekly/Monthly treatment;
8. update the held Weekly Report workflow in a separate PR;
9. run exact-head Preview/build/security checks;
10. obtain separate Production authorization before enabling generation.

## Manual decision required before wiring

Record the rights disposition on pipeline issue #155:

https://github.com/usdimpact/usd-impact-pipeline/issues/155

Engineering must not infer approval from the existence of these prototypes.

## No-action record

This prototype does not:
- alter the live Weekly Report generator;
- alter content schemas;
- alter existing Weekly or Monthly reports;
- alter newsletter artifacts or sending;
- change the live rights gate;
- fetch provider data;
- provision storage/secrets;
- change signup, billing, auth or entitlements;
- deploy Production.
