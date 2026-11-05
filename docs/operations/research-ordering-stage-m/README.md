# USD Impact Research — Stage M J-1/J-2/J-4/J-5 (DRAFT HOLD)

Stacked on unchanged Stage L [Draft #1148](https://github.com/usdimpact/usd-impact-site/pull/1148)
at `8b2c08f1a4b7593c84d21bc6a6af06c7ae286d7b`. This is
a non-deployable test-only bridge in `docs/operations/` and a
GitHub workflow. It **never** imports into application routes and adds **no**
`supabase/migrations` file, connected SQL, merchant call, real
payment/refund, entitlement APPLY or customer change.

## Explicitly tested review findings

- **J-1 (synthetic writer retirement / archive):** Existing Stage H/I
  event-keyed receipts are not deleted or rewritten. Exact matching signed
  delivery hash, invoice/subscription versions, event key and snapshot digest
  link pre-existing H receipts to the J/K canonical invoice observation.
  The ordinary `research_stage_i_writer` loses EXECUTE and USAGE on
  H's holder; **only** K→J remains the mock pending-invoice writer. Any
  historical H event without a complete match remains **unlinked and held**,
  not guessed or granted. No new H receipt may be written by the ordinary
  test gateway. Privileged owner/superuser and any unseen consumers of H
  still require a coordinated cutover and external audit; no real journal
  is retired.
- **J-2 (consumed B-5 contract):** A separate pure JS screen matches a
  **synthetic consumed** issued checkout intent, pending Research
  subscription, **zero** Research entitlements, issued quote and
  initial paid invoice. A pending/issued intent is rejected; wrong account,
  product, store, test mode, quote amount and billing reason fail closed.
  The result is only `candidate_for_human_review_only` with
  `canMutate=false`; it never calls J or L or changes a membership.
  This is NOT yet the real B-5 consumed-intent schema/SQL integration.
- **J-4 (byte-stable handoff):** JS and PostgreSQL 17.6 use an identical
  ASCII `m1` canonical envelope and SHA-256 digest over provider,
  store, environment, invoice, subscription, invoice snapshot digest and
  locally issued quote digest. Golden vector, input-validation negatives and
  single-field perturbations match in both languages. This is a synthetic
  **handoff transport contract**, NOT a proof that the provided snapshot
  digest, quote or paid-cycle start came from Lemon Squeezy. Production must
  have a separately authenticated provenance chain.
- **J-5 (full older PG regression):** Stage M hosted CI re-runs
  independent Stage I and J PostgreSQL suites on fresh disposable PG17.6
  services, plus its own Stage M database tests; G72/H31/J30 JS
  regressions are included. Stage K/L parent exact-head suites remain in
  their respective Drafts.

## Residuals kept OPEN

- **J-1 live:** actual durable canonical journal migration/consumers,
  legacy H/I historical data linkage and archival authority; owner,
  replication, DDL and trigger-bypass audit.
- **J-2 live:** B-5 consumed issued-intent and real pending subscription
  identifier/version need independently authenticated checkout custody,
  not synthetic caller input. Stage L's F1 isolated first activation
  still cannot grant real access.
- **J-3:** recovered invoice whose provider timestamp changes is
  quarantined until owner approves a reconciliation/unquarantine policy.
- **J-4 live:** real JS→provider evidence→DB SQL integrity, authenticated
  quote version, settlement and transactional association are unproved.
- **J-6 / R2:** current invoice's authoritative paid-cycle start/end is
  still absent from the documented provider invoice/subscription APIs.
- **R1:** a refund/state change after the final GET before DB COMMIT
  remains undetectable. Needs explicit owner exposure and post-commit
  reconciliation rule, not a claim of remote atomicity.
- **P2-K1:** a database role's timeout defaults can be disabled by its
  own session. Real hard deadlines must be enforced by trusted driver/
  pooler controls and tested separately; role defaults are not a boundary.
- **L1/B-5:** old shared `service_role` privileged DML and
  16-arg Research lifecycle RPC, Library Pass/Paddle/dual-product
  deletion, TRUNCATE/TRIGGER compatibility, Development parity and
  integrated approval remain HOLD.

For any later Supabase CLI orchestration, re-verify the CLI v3
November 4, 2026 breaking-change semantics and explicit
`--remote` / `--yes` requirements; this
Draft invokes **no** Supabase CLI or connected DB.

**Release disposition:** O1/O4 P1 OPEN; B-5 NO-GO. No Draft is
authorized for merge, deployment or a customer-facing feature.
Current Research checkout and purchase-backed Library Pass remain intact.
