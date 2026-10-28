# Research private-report public-build exclusion — hold-only engineering gate

Status: **DRAFT / DEVELOPMENT TESTED / PRODUCTION HOLD**  
Date: 2026-10-28  
Stack: Draft [#920](https://github.com/usdimpact/usd-impact-site/pull/920) inventory -> Draft [#921](https://github.com/usdimpact/usd-impact-site/pull/921) synthetic delivery -> this Draft public-build exclusion guard.  
Rights blocker: [usdimpact/usd-impact-pipeline#155](https://github.com/usdimpact/usd-impact-pipeline/issues/155).

## Objective and actual constraint

The site runs Astro with \`output: 'static'\`, and the current public archive routes \`/reports/weekly/YYYY-MM-DD\` and \`/reports/monthly/YYYY-MM-DD\` are emitted in \`dist/\`. They were already public and are **not silently removed** by this work.

Future premium Research reports must not be shipped in the public build, sitemap, feeds, browser JS/JSON, CDN-downloadable static assets, or public source URLs. A private middleware redirect cannot repair content that was already built publicly.

## Implementation (zero new providers or services)

The read-only Node audit \`apps/web/scripts/audit-research-private-public-build.mjs --check\` runs **after** the existing Astro build and production-build verifier, inside the preexisting \`npm run build\` command. It cannot provision Supabase, call external services, create subscriptions, publish reports, or grant entitlements. It scans the resulting \`dist/\` directory only.

What it fails closed on:

- Any generated file/directory under \`research/member/reports/\`, including nested static origins; and filenames signaling private Research report artifacts.
- Private report canary markers in *any* static asset bytes, including JavaScript, CSS, SVG, JSON, downloads and compressed gzip/Brotli assets. Cross-chunk marker detection is tested.
- Private member-report URLs in XML sitemaps, RSS/Atom, JSON discovery surfaces, and structured data or canonical/OG metadata in generated HTML. Percent-encoded and JSON-escaped variants are tested.
- Missing build, required public discovery/sample/legacy output, unsupported build symlinks, unreadable/malformed compressed output, or inspection-size limits.

The expected existing public surface is preserved and checked: homepage, \`sitemap-0.xml\`, \`news/feed.xml\`, \`/research/sample/\`, public 2026-07-31 Weekly and public 2026-10-16 Monthly pages. Ordinary public-page navigation links **to** an authenticated member route are permitted; putting member-only content or discovery entries in the public build is not.

The audit prints **only finding codes and totals**, not report bodies, customer IDs, provider identifiers, asset names, tokens, secrets or URLs. A passing audit states that the currently recognized paths and private markers are absent; it always reports \`releaseAuthorized: false\`.

## Synthetic mutation tests

\`node scripts/test-research-private-public-build.mjs\` constructs disposable local \`dist\` fixtures; it deliberately injects canaries and escaped private routes into different public surfaces to prove that the guard rejects each scenario. This test never reads a Production database, performs a checkout, calls a webhook, or accesses an actual private report.

## Limits (do not overstate)

A static scanner **cannot guarantee** no confidential material was ever published before it was introduced, that every hypothetical future file uses the expected marker, or that rights for provider-derived data exist. It also cannot determine if a live CDN retains cached historical content. Any future private report renderer must adopt the explicit reserved marker \`USD_IMPACT_PRIVATE_RESEARCH_REPORT_V1\` (or use an independently reviewed immutable private-artifact manifest), run a direct-origin/no-public-export check, and maintain private server authorization and cache controls.

A PASS on the static audit is *not* member-access QA, provider licensing, a first paid subscriber, proof of Production deployment, or a reason to release a HOLD. The existing 16-report inventory and #155 rights hold remain in force.

## Release handoff

1. Keep Draft stack unmerged until rights and historical public-content disposition are documented.
2. Before private delivery is implemented, ensure member report source files are **not imported** by Astro public content glob or emitted in \`dist\`.
3. Exercise the scan after every actual \`astro build\`; **test-only fixture injections must fail**, including synthetic marker hidden in JS or compressed output.
4. Future reviewed Development/Preview acceptance must additionally test direct-origin denial, anonymous and Library-only 401/403, valid synthetic Research authorization, expiry, HEAD, no-store/noindex, sitemap/feeds/cache/CDN and TradingView exclusion.
5. Require exact-head CI and separate Production approval. No real customer or commercial record may be created, replayed, refunded, backfilled or modified by this hold-only unit.

No Production routes, report bodies, existing subscriptions, entitlements, checkout flows, public sample, Score data, or TradingView access were changed.
