# FOMC October 28, 2026 — Post-Event Outcome Framework

Status: **DRAFT-ONLY / NOT PUBLISHABLE BEFORE VERIFIED FED RELEASES**

Purpose: prepare the evidence structure for the October 28, 2026 FOMC outcome without forecasting the decision or market reaction. This document is an editorial/operations aid only. It must not be imported as Catalyst Brief content, merged into a publication branch, or used to assert an outcome before primary Federal Reserve sources exist.

## Release boundary

Before the event:
- use the already-published preview Catalyst Brief;
- do not fill any outcome placeholder from expectations, newswire previews, market pricing, leaks, commentary, or prior meetings;
- do not convert conditional language into asserted facts.

After the event:
- verify the official FOMC statement and implementation note first;
- verify the Chair press conference separately;
- use primary Federal Reserve sources for decision facts;
- use market-data evidence only when its date/timestamp, provenance, and redistribution/use boundary are acceptable;
- preserve the distinction between **confirmed fact**, **conditional interpretation**, and **observed market reaction**.

## Canonical event identity

- Event date: `2026-10-28`
- Event: FOMC scheduled communications following the October 27–28 meeting
- Expected meeting communication time: 2:00 p.m. U.S. Eastern
- Expected press conference time: 2:30 p.m. U.S. Eastern
- Phase after verified release: `outcome`
- Required outcome status label: `released`
- Preview reference: `/news/catalysts/2026-10-28-fomc-scheduled-communications-following-the-october-27-28-meeting-press-preview`

## 1. Verified Fed decision

Fill only from the official October 28 FOMC statement.

- Target range before meeting: **VERIFY FROM PRIOR OFFICIAL STATEMENT**
- Target range after meeting: **PLACEHOLDER — DO NOT INFER**
- Change in basis points: **PLACEHOLDER — CALCULATE ONLY AFTER BOTH RANGES ARE VERIFIED**
- Vote: **PLACEHOLDER**
- Dissents: **PLACEHOLDER**
- Balance-sheet / reserves language: **PLACEHOLDER**
- Effective implementation details: **PLACEHOLDER**
- Official statement URL: **PLACEHOLDER**
- Official statement publication date/time: **PLACEHOLDER**

Acceptance:
- every number is directly supported by the statement or implementation note;
- no decision language is copied from a market report when a Fed primary source is available;
- no “surprise,” “hawkish,” or “dovish” label appears in the verified-facts section.

## 2. Statement changes versus September

Compare only against the September 16, 2026 FOMC statement already used in the preview.

Record exact substantive changes in:
- economic activity wording;
- labor-market wording;
- inflation wording;
- balance-of-risks wording;
- policy-path / reaction-function wording;
- reserves / implementation wording.

Template:

| Area | September baseline | October verified wording | Material change? | Evidence |
| --- | --- | --- | --- | --- |
| Activity | **VERIFY** | **PLACEHOLDER** | **PLACEHOLDER** | Fed statement |
| Labor | **VERIFY** | **PLACEHOLDER** | **PLACEHOLDER** | Fed statement |
| Inflation | **VERIFY** | **PLACEHOLDER** | **PLACEHOLDER** | Fed statement |
| Risks | **VERIFY** | **PLACEHOLDER** | **PLACEHOLDER** | Fed statement |
| Policy path | **VERIFY** | **PLACEHOLDER** | **PLACEHOLDER** | Fed statement |
| Reserves / implementation | **VERIFY** | **PLACEHOLDER** | **PLACEHOLDER** | Fed implementation note |

Do not interpret unchanged wording as a new signal.

## 3. Implementation note

Verify separately from the statement when published.

Capture:
- administered-rate changes;
- reserve-management instructions;
- standing repo / reverse-repo terms if changed;
- balance-sheet operations if changed;
- effective date;
- any technical adjustment distinct from the target-range decision.

Do not convert implementation mechanics into a liquidity conclusion until the actual wording and market context are both verified.

## 4. Powell press conference

Separate confirmed policy facts from Chair interpretation.

Capture:
- opening-statement points that materially clarify the Committee decision;
- reaction-function language;
- balance-of-risks language;
- comments on inflation persistence;
- comments on labor-market conditions;
- comments on future meetings / data dependence;
- explicit statements about balance sheet, reserves, liquidity, or financial conditions.

For each item mark:
- **confirmed quote/paraphrase from official transcript/video**;
- **interpretation**;
- **not established**.

Do not treat a reporter question as a Federal Reserve position.

## 5. Three-Dial reaction check

The first attribution test is:

1. **USD direction**
2. **Real rates**
3. **Liquidity / stress**

### USD direction
Evidence placeholder:
- DXY: **PLACEHOLDER**
- EURUSD: **PLACEHOLDER**
- observation timestamp/window: **PLACEHOLDER**
- source/provenance: **PLACEHOLDER**

### Real rates
Evidence placeholder:
- 10-year TIPS real yield: **PLACEHOLDER**
- observation timestamp/window: **PLACEHOLDER**
- source/provenance: **PLACEHOLDER**

### Liquidity / stress
Evidence placeholder:
- permitted liquidity/stress indicators: **PLACEHOLDER**
- observation timestamp/window: **PLACEHOLDER**
- source/provenance / rights status: **PLACEHOLDER**

Important: Three Dials public raw-data publication remains subject to the separate source-rights constraints tracked in issue #845. Do not reintroduce held third-party observations through this FOMC outcome workflow.

## 6. Cross-asset transmission

Only after the three dials are checked, assess these assets conditionally.

### DXY / EURUSD
- observed move: **PLACEHOLDER**
- consistency with rates/real-rate signal: **PLACEHOLDER**
- alternative explanation: **PLACEHOLDER**

### XAUUSD
- observed move: **PLACEHOLDER**
- real-rate consistency: **PLACEHOLDER**
- USD consistency: **PLACEHOLDER**

### U.S. equities
- S&P 500: **PLACEHOLDER**
- Nasdaq: **PLACEHOLDER**
- breadth / duration sensitivity: **PLACEHOLDER**
- rate-versus-growth interpretation: **PLACEHOLDER**

### BTCUSD
- observed move: **PLACEHOLDER**
- liquidity/rates consistency: **PLACEHOLDER**
- asset-specific caveat: **PLACEHOLDER**

### WTI
- observed move: **PLACEHOLDER**
- USD consistency: **PLACEHOLDER**
- energy-specific supply/geopolitical caveat: **PLACEHOLDER**

A move in one asset alone is not evidence of a durable dollar-led regime.

## 7. Verified-facts ledger

Outcome publication should contain 2–6 verified facts. Preferred ordering:

1. policy decision;
2. vote / dissent;
3. implementation detail;
4. material statement-language change;
5. Chair clarification;
6. official timing / follow-up item if materially relevant.

Each fact must have one or more source IDs and meet the existing Catalyst Brief verification rules.

## 8. Source hierarchy for this event

Preferred primary sources:
1. Federal Reserve October 28 FOMC statement;
2. Federal Reserve implementation note;
3. Federal Reserve Chair press-conference transcript/video;
4. Federal Reserve meeting calendar / event page;
5. other official Federal Reserve releases directly relevant to the decision.

Reporting sources:
- may be used only for market reaction when primary material does not supply the observation;
- one reporting article alone is not enough for a verified fact under the existing Catalyst Brief rules.

Do not use social posts, screenshots, snippets, or unattributed summaries as decision evidence.

## 9. Outcome Catalyst Brief skeleton

Do not create the final publication file until the outcome is verified.

Required publication fields after release:

- `phase: "outcome"`
- `statusLabel: "released"`
- `eventDate: "2026-10-28"`
- `sourceEditionDate: "2026-10-28"` unless the verified outcome is intentionally published later
- title suffix: `Verified Outcome`
- at least 2 grounded sources;
- at least 1 primary source;
- 2–6 verified facts;
- 2–5 transmission channels;
- 3–6 watch items;
- educational compliance note.

Suggested body structure:
- Confirmed decision
- What changed from September
- Implementation details
- Powell clarification
- Three-Dial reaction
- Cross-asset transmission
- What to watch next
- Key takeaway
- Sources
- Compliance note

## 10. Stop conditions

Set the outcome to HOLD and do not publish if any of these apply:
- official decision is not yet released;
- the statement cannot be verified from a Federal Reserve primary source;
- the implementation note is referenced but unavailable or ambiguous;
- source URLs are not grounded/verified;
- fewer than two valid sources are available;
- a claimed market move lacks date/timestamp/provenance;
- statement and press-conference facts are being conflated;
- an outcome relies on forecast language or pre-event expectations;
- the draft would reintroduce Three Dials data currently withheld for source-rights reasons;
- exact-head validation fails.

## 11. Release checklist

Before any outcome PR is eligible for protected review:

- [ ] Fed decision verified
- [ ] Statement source captured
- [ ] Implementation note checked
- [ ] Vote/dissents verified
- [ ] September-vs-October wording comparison completed
- [ ] Powell source reviewed
- [ ] Three-Dial evidence checked without violating #845
- [ ] DXY/EURUSD transmission reviewed
- [ ] XAUUSD transmission reviewed
- [ ] equities transmission reviewed
- [ ] BTCUSD transmission reviewed
- [ ] WTI transmission reviewed
- [ ] all exact figures timestamped/sourced
- [ ] no forecast presented as fact
- [ ] Catalyst Brief schema validated
- [ ] exact-head Web Quality passed
- [ ] protected editorial review completed
- [ ] explicit release approval obtained before merge

## Current disposition

Prepared in advance only to reduce post-event execution risk.

**No October 28 decision, press-conference conclusion, or market reaction is asserted by this document.**
