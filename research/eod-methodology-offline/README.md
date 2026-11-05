# Offline end-of-day methodology demonstration (Draft / HOLD)

This is a deliberately isolated research proof of concept. **Nothing in this directory is part of the Astro build, publishing jobs, Score pipeline, a market-data service, or any live route.** No network calls, environment variables, package installation, secrets, real market data, runtime cron, database, authenticated user data or publishing functionality. All scenarios use **invented** records for February 2100; their calendar dates are not forecasts or actual observations.

Run locally with Node.js (built-in modules only):

```bash
node --test test.mjs
```

`fixtures.mjs` exports `demonstrate()` which returns one invented Daily, one Weekly, one Monthly, each in EN and ES, plus a synthetic eight-driver arithmetic exercise. No script writes generated files or sends data anywhere.

## Contracts to verify before any implementation

- Candidate end-of-day eligibility is **17:00 America/New_York**, after selected publisher releases. It is *not* a worldwide market close. DST and source holidays require explicit checks.
- The demo requires one canonical fact/source manifest with numbered IDs, invented numeric units, as-of timestamp and rights-denied marker. It rejects every real provider, paid feed, external URL, unknown field, unexpected series, future-release timestamp, weekend, and missing source provenance.
- The **Daily** output uses one reviewed record. A **Weekly** review requires five complete contiguous weekdays; a calendar **Monthly** review requires complete coverage and is demonstrated only for the four full Monday-to-Friday weeks in fictional February 2100. It does not replace the existing Monthly's four eligible published Weeklies rule. Do not conflate analytical calendar coverage with existing publication acceptance.
- EN and ES are deterministic formatting of the **same** fact IDs, numbers, source references and support/challenge/unknown classifications. Translation and local factual claims still require separate human review. The proof uses a fixed glossary, not AI translation.
- The synthetic Score reproduces the private teaching exercise +0.2625, with +/- 1/8 weights and +/-3.5 z-score clipping. The numbers are entirely invented, do not constitute original Score market data, and never authorize publication. The private workbook remains the source of truth.
- A **real-data reconstruction** would need separate publisher/transport/commercial/archival/derivative/AI/public display/end-user export permission **for every exact original input**, vintages and normalized histories. Paid access does not confer sublicense. Never silently replace the original DXY/ICE/Cboe/FRED inputs with broadly similar federal series and claim identical Score semantics.
- Every output is `SYNTHETIC_ONLY_HOLD` and `public_release_authorized:false`; no public route or output JSON is produced.

## Required reader guidance: use verified, appropriately licensed data

**Owner policy (2026-11-03):** Always direct readers to **verified, current data from the original issuer or an authorized provider, licensed or otherwise legally permitted for the reader's intended use**, for the most reliable real-world result. Synthetic exercises are useful to learn the arithmetic; they are **not** a substitute for real observations, a market signal, or an endorsement of free/unlicensed vendor copies. This message must accompany every future approved Daily/Weekly/Monthly educational surface and each published Example Score, in **both English and Spanish**, after separate copy and rights review.

- **Check exact identity:** the original issuer, native series/ticker, instrument, units, source/transport and formula version. A broadly similar index or Treasury/FRED proxy is not an exact reproduction.
- **Check data quality:** publication timestamp versus observation period, point-in-time vintage, correction/revision history, time zone, missing values, statistical window and any source restatements. Record limitations honestly.
- **Check rights by actual use:** rights to access, calculate, retain, build derived values, display findings, quote sources, archive records, permit downstream reconstruction/export, and process with AI if applicable. An individual **paid subscription does not grant a separate right to redistribute provider data or derivatives**.
- **For readers reconstructing with their own data:** instruct them to obtain their own authorized current and historical feeds and follow their contractual permissions. Provide public formula, schema and input specifications only when approved; claim exact historical reproducibility only when the original input vintages are actually obtainable and verified.
- **If source quality or rights cannot be established:** show the dated official source and an explicitly synthetic method exercise, or withhold real numeric conclusions. Never fill gaps with invented market observations, silently change series, imply a vendor licence, or expose restricted source values.

The private offline renderer now contains this guidance in both locales and provides it as `data_guidance` on all Daily/Weekly/Monthly render outputs and the synthetic Score object. Tests require the notices while confirming that **public release remains denied**. This does *not* publish notices on the actual website; exact public placement needs independent editorial, copyright, compliance and accessibility authorization.

## Current contract and owner boundaries

The live Daily remains on its current Europe/Tirane editorial targets and GitHub workflows; native scheduling failure [#840](https://github.com/usdimpact/usd-impact-site/issues/840) is not fixed by this demonstration. Current Weekly still requires five published Dailies and the approved Friday Score archive. Current Monthly still uses the existing first-four-eligible-Weeklies mechanism; independent calendar-month reviews are a different proposed product. The original Score rights and publication remain [HOLD #155](https://github.com/usdimpact/usd-impact-pipeline/issues/155), with [FRED rights/retention #282](https://github.com/usdimpact/usd-impact-pipeline/issues/282) unresolved.

This proof does **not** modify rights, market-data sourcing, editorial approval, billing, Score, locale routes, sitemap, cron, GitHub Actions, privacy/GA4, Supabase or Vercel. Code in this directory is research material only; a separate explicit owner scope and exact-head gate are needed to move even one component into the application.

Plan: [Master EOD Methodology RFC](https://docs.google.com/spreadsheets/d/1uDvVlmbqPONI6a7YWrbhQlwGt9QSn4qBtnYSx87NlcA/edit#gid=1096269433). Owner research direction: [Fundraising DEC-020](https://docs.google.com/spreadsheets/d/1CQBMA-7hqN9qsy2Xt9yBGjlo08EuLluG2DEDnKVItKk/edit#gid=476834265&range=A26:H26).
