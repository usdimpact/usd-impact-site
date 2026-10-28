# FOMC October 28, 2026 — Post-Event Evidence Record

Status: **POST-EVENT VERIFIED / INTERNAL EVIDENCE / NO MARKET-REACTION CLAIM**

Purpose: retain the primary-source evidence and publication boundaries used for the October 28, 2026 FOMC outcome. This is an internal editorial/operations record. It is not a substitute for the published Daily edition or Catalyst Brief.

## 1. Canonical event identity

- Event date: `2026-10-28`
- Meeting: FOMC October 27–28, 2026
- Statement release: 2:00 p.m. U.S. Eastern
- Press conference scheduled: 2:30 p.m. U.S. Eastern
- Chair: Kevin Warsh
- Outcome phase: `outcome`
- Outcome status: `released`
- No October Summary of Economic Projections was scheduled.

Primary outcome sources:
- statement: `https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm`
- implementation note: `https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a1.htm`

September comparison sources:
- statement: `https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm`
- implementation note: `https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a1.htm`

## 2. Verified decision

Federal Reserve primary-source facts:

- federal funds target range before meeting: **3.75%–4.00%**
- federal funds target range after meeting: **3.75%–4.00%**
- change: **0 basis points**
- October vote: **10–2**
- dissents: **Lisa D. Cook and Beth M. Hammack**
- dissenting preference: **raise the target range by 25 basis points**
- policy of maintaining ample reserves: **continued**
- official statement date: **2026-10-28**

The verified-facts layer does not use “hawkish,” “dovish,” “surprise,” or a market-reaction label.

## 3. Statement comparison versus September

| Area | September 16 | October 28 | Verified change |
| --- | --- | --- | --- |
| Target range | 3.75%–4.00% after a 25 bp increase | 3.75%–4.00% | unchanged |
| Vote | 12–0 | 10–2 | two dissents favoring +25 bp |
| Activity | expanding at a **solid pace** | expanding at a **strong pace** | wording strengthened |
| Labor | job gains kept pace with workforce; unemployment changed little | same substantive description | no material change identified |
| Inflation | inflation remained elevated | inflation remains elevated | no material change identified |
| Policy-path wording | September action described as supporting a timelier return to 2% | accumulation of more information will help determine the appropriate policy stance | wording changed |
| Ample reserves | continued | continued | unchanged |

Do not interpret unchanged language as a new signal or the wording changes as a guaranteed future rate path.

## 4. Implementation note

Effective **October 29, 2026**:

- IORB: **3.90%**
- standing overnight repo: **4.0%**
- overnight reverse repo: **3.75%**
- ON RRP per-counterparty limit: **$160 billion per day**
- primary credit: **4.0%**

The Desk directive continues to include:

- open-market operations as necessary to maintain the 3.75%–4.00% target range;
- standing overnight repo at 4.0%;
- ON RRP at 3.75% with the $160 billion daily per-counterparty limit;
- Treasury-bill purchases, and if needed other Treasury securities with remaining maturities of three years or less, to maintain ample reserves;
- Treasury principal rollover at auction;
- reinvestment of agency principal payments into Treasury bills.

These implementation settings are operational instructions. They do not establish observed facility usage, reserve scarcity, funding stress or a liquidity regime.

## 5. Chair Warsh press-conference boundary

At the outcome-publication checkpoint, the written FOMC statement and implementation note were verified. An official Chair Warsh press-conference transcript/video source had not yet been verified for use in the published outcome record.

Therefore:

- no Chair quote or paraphrase was required for the initial outcome publication;
- reporter questions or live secondary summaries are not Federal Reserve policy facts;
- any later Chair remarks should be added only from an official Federal Reserve source;
- statement facts and press-conference interpretation remain separate evidence layers.

## 6. Three Dials v2 boundary

Do **not** recalculate Three Dials v2 intraday from FOMC reaction proxies.

Reviewed v2 inputs remain:

1. Broad USD — Federal Reserve Board H.10 nominal broad dollar index;
2. Real-rate pressure — Federal Reserve Board H.15 10-year inflation-indexed Treasury constant-maturity yield;
3. Funding pressure — USD Impact-derived SOFR minus IORB.

Pre-event public baseline remains the completed week ending **2026-10-23**:

- Broad USD: **rangebound**
- 10-year real yield: **falling**
- Funding pressure: **tightening**
- regime: **Mixed / transitional environment**

The October 28 policy decision does not itself create a new Three Dials observation.

No DXY, proprietary volatility/credit series, futures, ETF or other intraday proxy may be silently substituted for the approved v2 inputs.

## 7. Market-reaction boundary

The initial verified outcome publication intentionally contains **no market-reaction claim**.

If market reaction is added later, it must have:

- named instrument;
- explicit timestamp/window;
- rights-screened provenance;
- clear separation from Federal Reserve policy facts;
- no claim that a single asset move proves a durable dollar-led regime.

Lack of a rights-safe market-reaction dataset does not block publication of verified policy facts.

## 8. Published outcome records

Current protected publication records:

- Daily edition:
  `apps/web/src/content/news/2026-10-28.md`
  - outcome update merged through PR #926
  - merge commit: `45783a66ab87a606b8d3b45ccd405fdee03e4513`

- Catalyst Brief outcome:
  `apps/web/src/content/catalyst-briefs/2026-10-28-fomc-scheduled-communications-following-the-october-27-28-meeting-press-outcome.md`
  - published through PR #927
  - merge commit: `3efd3163423707481fa2cca5f119512425498363`

The pre-event Catalyst Brief remains historical and should not be rewritten as if the outcome were known in advance.

## 9. Source hierarchy

For this event:

1. Federal Reserve October 28 FOMC statement;
2. Federal Reserve October 28 implementation note;
3. official Chair Warsh press-conference transcript/video when available;
4. official Federal Reserve calendar/event pages;
5. rights-screened market evidence only for separately labeled market reaction.

Do not use social posts, screenshots, snippets, leaks or unattributed summaries as policy-decision evidence.

## 10. Completed publication checklist

- [x] Fed decision verified
- [x] statement source captured
- [x] implementation note checked
- [x] vote/dissents verified
- [x] September-vs-October comparison completed
- [x] no forecast presented as fact
- [x] no intraday proxy substituted for Three Dials v2
- [x] Daily exact-head CI/CodeQL/Preview passed
- [x] Daily protected merge and Production verification completed
- [x] Catalyst Brief exact-head CI/CodeQL/Preview passed
- [x] Catalyst Brief protected merge completed
- [ ] official press-conference transcript/video reviewed, if a later editorial update requires it
- [ ] eligible post-event Three Dials v2 observations reviewed when their normal source cadence permits

## Current disposition

**The written FOMC outcome is verified and published.**

No further policy-decision publication is required unless an official press-conference source or later eligible data materially adds to the record.

Market-reaction fields remain intentionally unfilled. Three Dials v2 remains on its normal approved-source cadence.
