# Publication serving route candidate — #558

Status: **source-only / dormant Preview route wiring prepared**. This document does not authorize or activate Production serving. `publicationAuthorized=false` and `enforcementActive=false` remain governing state.

## Purpose

The existing publication admission policy correctly distinguishes current material from recorded archives, but the live Astro site is static and does not invoke that policy. The candidate now includes a narrow, inactive-by-default Vercel Routing Middleware bridge that can send governed Preview requests into the existing publication Function without converting unrelated site routes to SSR or enabling Production enforcement.

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

## Dormant public-route wiring

`src/lib/publication-public-route-wiring.js` is a source-only planner used by the Node.js Routing Middleware. `middleware.js` now matches the governed publication path families and their raw static aliases, but the bridge is **inactive by default**.

The independent activation key is:

`PUBLICATION_GUARD_PUBLIC_ROUTE_WIRING=preview-dormant-v1`

This source change does **not** set that key. When it is absent or empty, governed paths return directly to normal Vercel/static routing through `next()` and the planner does not read the route secret, Vercel deployment context, or clock. Therefore this commit cannot change the currently served publication bytes merely by existing in a deployment.

When the exact Preview-only mode is explicitly configured in a separately approved environment:

1. unrelated routes remain outside the publication bridge;
2. canonical governed requests accept only GET or HEAD;
3. the request URL must be HTTPS and its `Host` header must exactly match the URL host after normalization;
4. the existing Preview route signer requires the exact USD Impact project, repository, #559 branch, deployment commit and protected deployment host;
5. trusted Middleware overwrites the publication path/timestamp/MAC headers server-side so client-supplied envelope headers cannot select another route;
6. Vercel's `rewrite()` helper forwards those overridden request headers to `/api/publication-guard`;
7. client query/hash data is not forwarded into the internal guard route;
8. raw static aliases such as `/news/index.html`, article `.html` paths, article `/index.html` paths and trailing static aliases receive a no-store 404 before static rendering;
9. unknown wiring modes or invalid Preview context fail closed with a no-store response.

The signer still requires `PUBLICATION_GUARD_ROUTE_CANDIDATE=preview-dormant` and a strong `PUBLICATION_GUARD_ROUTE_SECRET`. Those values are not created or changed by this source increment.

Production context is rejected by the existing Preview signer, so this wiring source cannot produce a Production public rewrite. Production activation remains explicitly **not implemented**.

## Dormant Function boundary

`src/lib/publication-guard.js` remains a Preview-only handler kept outside `api/`. The current `vercel.json` exposes the internal `/api/publication-guard` path by rewriting it into the already-counted `api/daily-news-validation.js` Function. The new Middleware bridge reuses that same internal route; no additional Vercel Function is introduced and no public-path rewrite was added to `vercel.json`.

A request can complete the guarded serving path only when all of the following are true:

1. the separate public-route wiring mode is explicitly enabled for the protected Preview;
2. Vercel identifies the deployment as Preview for the USD Impact project and the exact #559 branch;
3. the exact deployment host and commit SHA match the runtime context;
4. `PUBLICATION_GUARD_ROUTE_CANDIDATE=preview-dormant` is configured;
5. a strong `PUBLICATION_GUARD_ROUTE_SECRET` exists;
6. Middleware has signed the original governed path, method, host, timestamp, deployment host and commit SHA with that secret;
7. for a serving-policy path, trusted server code injects serving-authority and admission-history readers.

Direct or unsigned calls fail closed with a no-store 404; a configured route without its required trusted adapters fails closed with a no-store 503. This increment does not add those authority/history adapters.

## R0 read-only Preview rehearsal

A separate source-only rehearsal path is defined by `src/lib/publication-preview-rehearsal.js`. It is intentionally distinct from `publication-serving-policy.js` and cannot create or relax Production serving authority.

The rehearsal can run only when all existing signed Preview-route checks pass and the additional mode is exactly:

`PUBLICATION_GUARD_PREVIEW_REHEARSAL=readonly-v1`

It then uses the existing `PUBLICATION_GUARD_READER_DATABASE_URL` adapter together with the Preview-only `PUBLICATION_GUARD_READER_DATABASE_CA_CERT` trust input and proves, in order:

1. the signed governed path is bound to the exact protected Preview deployment host and commit;
2. the generated publication bundle is bound to the same commit;
3. the managed database connection authenticates as `fx558_reader_login` over CA-verified SSL;
4. the reader can execute only `publication_guard_api.read_snapshot(...)` and has no authorize, prepare, receipt-recording, or revocation privilege;
5. the managed history snapshot is exactly revision `0` with zero records.

The reader validates the shared-pooler host, port, database and role from the URL, but does not pass the URL through `pg-connection-string` at runtime. Instead it constructs the `pg.Pool` connection fields explicitly and supplies the configured Supabase CA with `rejectUnauthorized: true`. This preserves certificate-chain and hostname verification and prevents connection-string `sslmode` parsing from weakening or overriding the explicit TLS policy. A missing, malformed or private-key-bearing CA input fails closed before any database connection is attempted.

A successful R0 rehearsal still terminates with HTTP 503 and the fixed no-store diagnostic `HOLD_NOT_ADMITTED`. The diagnostic contains only bounded route/runtime/reader/snapshot evidence. It does not contain the database URL, password, CA material or route secret, does not emit article/feed/homepage bytes, does not invoke `publication-serving-policy.js`, and cannot create an admission, receipt, witness, promotion, or serving authorization.

This source increment does **not** set the rehearsal mode, reader URL, reader CA, route secret, public-route wiring mode, or any other provider environment value. Without separately approved provider configuration, both the rehearsal and public-route bridge remain dormant.

## Host and alias contract

The current public Production alias inventory captured for the candidate is:

- `www.usd-impact.com`
- `usd-impact.com`
- `usd-impact-site.vercel.app`
- `usd-impact-site-usd-impact.vercel.app`
- `usd-impact-site-git-main-usd-impact.vercel.app`

A future Production activation must apply one admission decision consistently to all approved public aliases. A generated immutable deployment hostname is a separate class and is not silently treated as a public Production alias.

Raw static aliases are now represented in the actual Middleware matcher. They are denied before render only when the separately configured Preview wiring mode is active; while the mode is absent they preserve the current static-routing behavior. No Production alias enforcement is activated by this increment.

## Cache contract

The existing response boundary continues to own the final guarded response and strips stale entity/redirect headers before dispatch. Candidate guarded responses set:

- `Cache-Control: private, no-store`
- `CDN-Cache-Control: no-store`
- `Vercel-CDN-Cache-Control: no-store`

Middleware deny responses use the same no-store posture. A fresh authority/history inspection is performed after buffered rendering. If a preview deadline is crossed during rendering, stale current bytes are discarded and the response is rendered again from the new projection. Authority/history drift fails closed.

The R0 rehearsal does not enter that rendering path. Its successful terminal diagnostic uses the same no-store cache posture and returns no publication content.

## Tests in this increment

The route-candidate, public-route wiring and R0 regressions cover:

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
- public-route wiring inactive fallthrough with no route secret or Vercel context required;
- canonical Preview rewrite planning with query/hash removal;
- server-side overwrite of forged publication-envelope headers;
- the installed `@vercel/functions` rewrite helper carrying overridden signed request headers into the internal Function request;
- GET and HEAD method binding;
- active Preview raw-static-alias denial;
- invalid wiring-mode and Production-context rejection;
- no Production reader import in Middleware and no governed public rewrite added to `vercel.json`;
- R0 exact Preview/build/path binding;
- R0 managed-reader identity plus read-only privilege proof;
- R0 explicit CA-backed TLS configuration with connection-string SSL parsing excluded;
- R0 revision-0 snapshot proof;
- GET and HEAD R0 termination at `HOLD_NOT_ADMITTED` with no publication bytes;
- invalid or unknown rehearsal modes and malformed rehearsal results failing closed.

## Still required before activation

This increment does **not** prove or perform live serving enforcement. A separately approved Preview-only provider rehearsal is still required to set the dormant wiring inputs temporarily and prove on an actual Vercel deployment that Middleware matching, request-header forwarding, raw-static-alias denial and inactive rollback behave as the source contract specifies.

Production still requires a real authenticated serving-authority adapter, approved Production reader/runtime credentials, staged Production provider controls, public-alias enforcement, raw-static-path non-bypass proof, and first-public-response witness/receipt, promotion, rollback, alias, cache, outage and recovery exercises end to end.

The later independent-witness/receipt phase remains separate from R0. No receipt/witness migration is required or applied merely to prepare this dormant wiring.

No merge, Production deployment/routing, Vercel project/environment mutation, Supabase mutation, credential creation, workflow-token permission change, witness activation, promotion, publication authorization, or enforcement activation is part of this increment.
