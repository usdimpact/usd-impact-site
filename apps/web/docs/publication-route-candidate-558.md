# Publication serving route candidate — #558

Status: **source-only / dormant Preview candidate**. This document does not authorize or activate Production serving. `publicationAuthorized=false` and `enforcementActive=false` remain governing state.

## Purpose

The existing publication admission policy correctly distinguishes current material from recorded archives, but the live Astro site is static and does not invoke that policy. This increment prepares a narrow Vercel Function candidate that can render only already-recorded publication material without converting unrelated site routes to SSR.

## Actual surface model

The live site does not have a separate `/news/archive` page. `/news` is a composite page with two different publication projections:

- **current projection** — latest Daily content; expired previews are excluded;
- **archive projection** — historical Daily editions and catalyst briefs; an admitted expired preview remains available as historical material.

The response boundary therefore exposes a `news-composite` integration surface while continuing to use the existing `news-current` and `news-archive` policy projections internally.

Governed public paths in the candidate are:

- `/`
- `/news`
- `/news/YYYY-MM-DD`
- `/news/catalysts/<slug>`
- `/news/feed.xml`
- `/news/latest.json`
- `/sitemap-0.xml`

Unrelated application routes remain outside this candidate.

## Static build preservation

Astro remains `output: static`. The candidate does not move the whole site to SSR.

After the normal Astro build, `scripts/generate-publication-serving-inputs.mjs` packages the rendered publication HTML, source text, homepage/news shells, and non-publication sitemap entries into:

`src/generated/publication-render-inputs.generated.js`

That generated file is intended only as a build-local Function input. It is not written below `dist/` or `api/` and is not a public static URL.

The Function also requires the generated bundle commit SHA to match the exact Vercel deployment commit, and the renderer verifies SHA-256 bindings before use. It never renders a held source. Current aggregates receive only the current admission projection. Archive aggregates receive the archive projection. An expired preview article without an existing editorial archive note receives a visible generic historical banner while its preserved pre-event body remains unchanged.

## Dormant route boundary

`src/lib/publication-guard.js` is a Preview-only handler kept outside `api/`. The current `vercel.json` exposes only the internal diagnostic path `/api/publication-guard` by rewriting it into the already-counted `api/daily-news-validation.js` Function. No governed public path is intercepted by that rewrite, and the Vercel Function budget remains unchanged.

A request can reach the guarded path only when all of the following are true:

1. Vercel identifies the deployment as Preview for the USD Impact project and the exact #559 branch.
2. The exact deployment host and commit SHA match the runtime context.
3. `PUBLICATION_GUARD_ROUTE_CANDIDATE=preview-dormant` is configured.
4. A strong `PUBLICATION_GUARD_ROUTE_SECRET` exists.
5. Trusted server code has signed the original governed path, method, host, timestamp, deployment host, and commit SHA with that secret.
6. For a serving-policy path, trusted server code injects serving-authority and admission-history readers.

No governed public-path interception, Production authority, or serving-policy activation is created by the internal diagnostic rewrite. Direct or unsigned calls fail closed with a no-store 404; a configured route without its required trusted adapters fails closed with a no-store 503.

Production context is rejected. Production activation is explicitly **not implemented**.

## R0 read-only Preview rehearsal

A separate source-only rehearsal path is defined by `src/lib/publication-preview-rehearsal.js`. It is intentionally distinct from `publication-serving-policy.js` and cannot create or relax Production serving authority.

The rehearsal can run only when all existing signed Preview-route checks pass and the additional mode is exactly:

`PUBLICATION_GUARD_PREVIEW_REHEARSAL=readonly-v1`

It then uses the existing `PUBLICATION_GUARD_READER_DATABASE_URL` adapter and proves, in order:

1. the signed governed path is bound to the exact protected Preview deployment host and commit;
2. the generated publication bundle is bound to the same commit;
3. the managed database connection authenticates as `fx558_reader_login` over SSL;
4. the reader can execute only `publication_guard_api.read_snapshot(...)` and has no authorize, prepare, receipt-recording, or revocation privilege;
5. the managed history snapshot is exactly revision `0` with zero records.

A successful R0 rehearsal still terminates with HTTP 503 and the fixed no-store diagnostic `HOLD_NOT_ADMITTED`. The diagnostic contains only bounded route/runtime/reader/snapshot evidence. It does not contain the database URL or secret, does not emit article/feed/homepage bytes, does not invoke `publication-serving-policy.js`, and cannot create an admission, receipt, witness, promotion, or serving authorization.

This source increment does **not** set the rehearsal mode, reader URL, route secret, or any other provider environment value. Without a separately approved provider configuration, the new rehearsal remains dormant.

## Host and alias contract

The current public Production alias inventory captured for the candidate is:

- `www.usd-impact.com`
- `usd-impact.com`
- `usd-impact-site.vercel.app`
- `usd-impact-site-usd-impact.vercel.app`
- `usd-impact-site-git-main-usd-impact.vercel.app`

A future Production activation must apply one admission decision consistently to all approved public aliases. A generated immutable deployment hostname is a separate class and is not silently treated as a public Production alias.

Raw static aliases such as `/news/index.html`, article `.html` paths, or article `/index.html` paths are classified as deny-before-render in the candidate plan. This increment does not yet install the routing layer that enforces that plan.

## Cache contract

The existing response boundary continues to own the final response and strips stale entity/redirect headers before dispatch. Candidate responses set:

- `Cache-Control: private, no-store`
- `CDN-Cache-Control: no-store`
- `Vercel-CDN-Cache-Control: no-store`

A fresh authority/history inspection is performed after buffered rendering. If a preview deadline is crossed during rendering, stale current bytes are discarded and the response is rendered again from the new projection. Authority/history drift fails closed.

The R0 rehearsal does not enter that rendering path. Its successful terminal diagnostic uses the same no-store cache posture and returns no publication content.

## Tests in this increment

The route-candidate and R0 regressions cover:

- real `/news` composite current/archive semantics;
- homepage current projection;
- Daily and catalyst article routes;
- RSS and latest JSON current-only projection;
- sitemap archive retention;
- visible expired-preview archival presentation;
- warm/stale byte rejection when a deadline crosses during rendering;
- response cache-header ownership;
- all captured public Production aliases and generated deployment-host separation;
- signed Preview route-envelope tamper/expiry checks;
- direct Function fail-closed behavior;
- private build-input generation and draft exclusion;
- absence of any governed public-path rewrite/activation in `vercel.json` or middleware;
- R0 exact Preview/build/path binding;
- R0 managed-reader identity plus read-only privilege proof;
- R0 revision-0 snapshot proof;
- GET and HEAD R0 termination at `HOLD_NOT_ADMITTED` with no publication bytes;
- invalid or unknown rehearsal modes and malformed rehearsal results failing closed.

## Still required before activation

This increment does **not** prove or perform live serving enforcement. A later, separately approved step must provide a real authenticated serving-authority adapter, install the public-path interception layer, prove raw-static-path non-bypass behavior on Vercel, establish Production credential/role/network handling, and exercise first-public-response witness/receipt, promotion, rollback, alias, cache, outage, and recovery behavior end to end.

The later independent-witness/receipt phase remains separate from R0. No receipt/witness migration is required or applied merely to perform the reader-only rehearsal.

No merge, Production deployment/routing, Vercel project/environment mutation, Supabase mutation, workflow-token permission change, witness activation, promotion, or enforcement activation is part of this increment.
