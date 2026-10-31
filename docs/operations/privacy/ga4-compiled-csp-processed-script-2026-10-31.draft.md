# GA4 compiled-Astro CSP compatibility — independent Draft remediation (2026-10-31)

## Grounded new finding

An independent GitHub Actions run in [QA Draft #1038](https://github.com/usdimpact/usd-impact-site/pull/1038) built **292 actual Astro pages** on Node 24 with synthetic `PUBLIC_GA4_MEASUREMENT_ID=G-TEST1234` and no Production environment variables. Its [run #41209989054](https://github.com/usdimpact/usd-impact-site/actions/runs/41209989054) completed the build but failed first-party browser QA. Captured real Chromium diagnostics: `window['ga-disable-G-TEST1234']` was absent when the ConsentClient module had initialized; Chromium reported an inline-script Content Security Policy violation (`script-src-elem`). No Google script loaded. **This proves a defect in the controlled compiled build, not a Production privacy breach, Production GA4 cookie measurement, or real end-user churn.**

Astro documents that `<script define:vars>` **implies inline execution**, while an ordinary processed `<script>` is compiled into a client module, and generated CSP rules permit external same-origin script resources. The current `astro.config.mjs` explicitly allows `'self'` in `script-src-elem`; do not weaken CSP or introduce `unsafe-inline`. References: https://docs.astro.build/en/reference/directives-reference/#definevars ; https://docs.astro.build/en/guides/client-side-scripts/ ; https://docs.astro.build/en/reference/configuration-reference/ .

## Proposed minimal runtime change — NOT MERGED

Only `GoogleAnalyticsClient.astro` changes:
- Retain existing **server-side** GA4 ID format validation.
- Emit an inert hidden, HTML-escaped `data-ga4-measurement-id` only when a validated ID is set.
- Replace `define:vars` inline script with an Astro **processed same-origin module**. The module reads that ID, re-validates it and does nothing if unavailable or invalid.
- Preserve the full existing GA4 event allowlist, explicit advertising denied settings, consent-ready/change listeners, actual denial/withdrawal cleanup, and the PR #1037 init-order fix. This module uses the existing `script-src-elem 'self'` rather than adding CSP exceptions.

No legal text, consent client, pricing, original Score, Macro Weekly routing, source licensing, analytics vendor, or Production settings are changed. No additional GA event or data collection is approved.

## Verification gates

Run the existing `test-ga4-consent-revocation.mjs` against the processed module; adapt the already isolated native-cookie QA to use the DOM-provided synthetic ID. In the compiled-Astro QA, serve the **actual generated /privacy, /terms and /es/privacy pages** on 127.0.0.1 and exercise Chromium's real cookie store through Accept, navigation, Withdraw, returning consent, Reject, denied-stale cleanup, and Spanish analytics exclusion. Block and locally stub Google requests; no Google library, customer identifiers or third-party requests.

**Expected status:** Pending successful exact-head automated evidence. A passing loopback test is not Production/parity QA, legal/privacy compliance clearance, license permission, or authority to merge. Any CSP or cookie failure stays open/red. Before any public rollout, obtain separately scoped owner exact-SHA approval and authenticated Preview QA with controlled network, then post-release smoke/rollback plan. PR #1037, QA #1038, Macro Weekly #1025 all remain Draft/unmerged. All Macro Weekly R04–R07/X01 decisions, publishing/indexing and original Score rights stay HOLD.
