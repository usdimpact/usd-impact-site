# Macro Event Query-Role Matrix v1 — 2026-10-28

Status: **planning-only / publication-governance preserving / no SEO implementation authorized**.

Related:
- #570 — SEO Growth Architecture;
- Master Keyword-to-Page Map v1;
- current Daily/Catalyst/Weekly publication governance.

## Evidence window

Primary evidence:
- Google Search Console;
- settled 2026-09-28 through 2026-10-25;
- property `sc-domain:usd-impact.com`;
- Web search.

Current privacy-visible event-family rows:

| Family | Query→page rows | Visible impressions | Weighted avg position |
| --- | ---: | ---: | ---: |
| BLS labor / Employment Situation / JOLTS / ECI | 53 | 65 | 5.09 |
| BEA Personal Income / PCE / GDP | 41 | 77 | 7.86 |
| CPI | 14 | 19 | 6.42 |
| PPI | 8 | 9 | 22.11 |

These are filtered-family totals, not full-site totals.

## Core rule

**Publication role outranks keyword overlap.**

Do not merge, redirect, canonicalize together, or rewrite pages merely because multiple USD Impact URLs appear for similar official-release phrases.

A macro release legitimately produces different search/document roles over time:

1. **schedule/calendar evidence**;
2. **pre-event Catalyst preview**;
3. **verified released-result / outcome**;
4. **Daily briefing / same-date synthesis**;
5. **Weekly archive / completed-week synthesis**.

Those roles can share official event names without being duplicates.

## Query-role matrix

| Search intent | Preferred USD Impact role | Required evidence state | SEO rule |
| --- | --- | --- | --- |
| “When is [release]?” / release date / scheduled time | Catalyst **preview** or bounded calendar surface | official agency schedule verified; no result asserted | Preserve preview identity and date/time clarity. Do not rewrite as an outcome before release. |
| “[release] preview” / what to watch | Catalyst **preview** | schedule + prior/reference facts verified | Keep conditional language. No forecast presented as fact. |
| “[release] results” / released value / unemployment rate / CPI result | Catalyst **outcome** or same-date Daily when outcome page does not exist | official release verified | Outcome must be fact-led and post-release. Do not reuse preview-only assertions as result facts. |
| Official agency phrase plus exact release date | Preview before release; outcome/Daily after release depending lifecycle | time-relative source state | Multiple pages may rank during transition. This alone is not cannibalization. |
| “[release] today” / current-day macro summary | **Daily USD Impact** | same-date official-source verification | Daily can synthesize several releases; it should not replace the dedicated event archive. |
| “what happened this week” / completed-week macro context | **Weekly Report** | completed-week evidence only | Weekly is archive/synthesis, not a substitute canonical for individual events. |
| Broad evergreen meaning (“what is CPI?”, “what is payroll?”) | Existing **Learn** page if one exists and is justified | evergreen source set | Do not manufacture evergreen pages from dated-release traffic. |
| Historical exact release lookup | Dated outcome/Daily/Weekly archive according to exact requested object | immutable historical evidence | Preserve chronology and historical URLs. |

## BLS Employment Situation / labor family

### Current evidence

The family has the strongest current event visibility:
- 53 privacy-visible query→page rows;
- 65 visible impressions;
- weighted average position ~5.09.

Examples:
- `site:bls.gov september 2026 employment situation october 2 2026` → Oct. 2 Catalyst preview, position 1;
- unemployment-rate variants → Oct. 2 Catalyst preview, often positions 2–6;
- payroll / exact BLS release-path variants → Oct. 2 Daily and Catalyst preview, often positions 1–9;
- Aug. 2026 released-result variants → Sep. 4 outcome page;
- Employment Cost Index future-date query → Oct. 21 Daily context.

### Role decision

Keep all of the following distinct:
- pre-release Catalyst;
- released-outcome Catalyst where created;
- same-date Daily;
- completed-week Weekly archive.

The current overlap is mostly lifecycle/role overlap, not harmful same-role cannibalization.

### SEO implication

**OBSERVE / DO NOT CONSOLIDATE.**

Any future optimization should be page-specific:
- preview snippet/date clarity;
- outcome result clarity;
- explicit preview→outcome archive handoff where governance permits;
- no generic “employment situation 2026” hub.

## BEA Personal Income / PCE / GDP family

### Current evidence

- 41 privacy-visible rows;
- 77 visible impressions;
- weighted average position ~7.86.

The same official release phrase appears across:
- Aug. 26 Catalyst preview;
- Sep. 30 Catalyst preview;
- Sep. 23/24 Daily pages;
- Sep. 25 Weekly Report.

Some Weekly archive rows rank strongly for exact historical phrases, including positions near 2–4.

### Role interpretation

This is expected because:
- the preview captures schedule intent;
- Dailies capture verified contemporaneous evidence/context;
- Weekly captures completed-week synthesis and immutable archive value.

### SEO implication

**PRESERVE ROLES.**

Do not:
- redirect Dailies to Weekly;
- canonicalize Weekly to a Catalyst;
- delete historical previews solely because an outcome exists;
- create a generic duplicate PCE-release-date page.

A future archive handoff may link preview → verified result, but the preview should remain historically truthful.

## CPI family

### Current evidence

- 14 visible rows;
- 19 visible impressions;
- weighted average position ~6.42.

Examples:
- Aug. 2026 released-result queries → Sep. 11 CPI outcome;
- Sep. 2026 / Oct. 14 exact-date queries → Oct. 14 Daily;
- July 2026 release query → Aug. 12 Catalyst preview.

### Role decision

Current architecture is working.

**OBSERVE.**

Do not turn the Oct. 14 Daily into a permanent CPI hub merely because it ranks for exact-date official-release queries.

## PPI family

### Current evidence

- 8 visible rows;
- 9 visible impressions;
- weighted average position ~22.11.

Some exact official-release variants rank page one, while broad queries such as `october ppi report` remain much weaker.

### Role decision

Evidence is too small and mixed for structural SEO intervention.

**DEFER / PRESERVE.**

No evergreen or new-event page is justified from current PPI search data.

## Preview-to-outcome lifecycle

A correct lifecycle can contain both a preview and an outcome.

### Preview

Must remain:
- pre-event;
- conditional;
- based on verified schedule/reference evidence;
- clearly labeled as preview/scheduled.

### Outcome

Must be:
- created only after official result verification;
- fact-led;
- separated from forecast/preview wording;
- source-bound to the actual release.

### Archive handoff

Where both exist:
- the preview may point to the verified outcome;
- the outcome may identify the earlier preview as pre-event context;
- neither page should be silently rewritten into the other;
- historical publication timestamps and claims must remain truthful.

## Daily role

Daily USD Impact is a same-date evidence synthesis.

It may rank for:
- exact release terms;
- official agency phrases;
- result numbers;
- multiple same-day macro events.

That does not make it the canonical replacement for all dedicated Catalyst pages.

Daily rules remain:
- source/date/fact validation;
- fail closed when current evidence is insufficient;
- no fabricated market reaction;
- no forced SEO publication merely to capture a query.

## Weekly role

Weekly Report is completed-week synthesis.

It can rank for historical official-release phrases because it:
- cites completed-week evidence;
- preserves archive context;
- may become a useful historical result.

That is not by itself cannibalization.

Do not demote/remove Weekly archive content solely to force one-event-one-URL search ownership.

## Cannibalization test

Treat event-page overlap as actionable only when all are true:

1. two or more pages have the **same publication role**;
2. they target substantially the **same time period/event state**;
3. overlap persists across enough settled Search Console data;
4. neither page has a distinct archival/compliance purpose;
5. consolidation would not falsify historical publication state;
6. exact source/canonical/redirect impact is reviewed.

If roles differ (preview vs outcome vs Daily vs Weekly), default to **preserve**.

## New-page rule

This matrix approves **zero new macro-event pages outside the governed publication system**.

Do not create:
- generic monthly “release date” SEO pages;
- duplicate event hubs;
- year-only payroll/CPI/PCE pages;
- forecast pages detached from Catalyst governance.

New event URLs should continue to come only from the controlled publication architecture.

## Metadata rule

Do not batch-edit event titles from query strings.

Any future snippet change requires:
- page-specific Search Console evidence;
- event-role classification;
- preservation of official terminology;
- no misleading future/past tense;
- exact-head tests and Preview.

## Internal-link rule

Permitted future candidates are structural, not promotional:

- preview → verified outcome;
- outcome → relevant evergreen explainer when interpretation genuinely requires it;
- Weekly → source Daily/Catalyst evidence already represented by the archive;
- no dense cross-linking merely for SEO.

## Measurement

For any future event-role SEO experiment:
- use at least 14–28 settled days where event freshness permits;
- separate schedule-intent and result-intent queries;
- compare the exact page role, not the entire family blindly;
- treat low-volume query suppression explicitly;
- do not infer causal effects from a single event cycle.

## Explicit non-actions

This matrix does not authorize:
- title/meta changes;
- page creation/deletion;
- redirect/canonical changes;
- archive rewrites;
- internal-link edits;
- sitemap/indexing requests;
- Catalyst/Daily/Weekly generation;
- workflow dispatch;
- provider calls;
- Production publication.

## Final classification

**MACRO EVENT QUERY-ROLE MATRIX v1 COMPLETE / PUBLICATION ROLE OUTRANKS KEYWORD OVERLAP / ZERO NEW SEO EVENT PAGES / NO CONSOLIDATION OF PREVIEW-OUTCOME-DAILY-WEEKLY ROLES.**
