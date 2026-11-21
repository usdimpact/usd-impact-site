# D1 isolated real PostgreSQL approval — controlled Research #1103 test

**Date:** 2026-11-04. **Source of authority:** The owner wrote "approved" immediately following the two requested owner actions, D1 isolated PostgreSQL concurrency test and D5 read-only Lemon Squeezy public-buy-link inspection. Interpret this **narrowly**:

- **D1 APPROVED for tests only:** Temporary, secrets-free GitHub Actions PostgreSQL 16 service container with synthetic fixtures; no Production or Development database credentials, real customer/payment data, or shared site runtime changes.
- **D5 APPROVED for inspection only:** Read-only merchant dashboard/public-link availability check; no API key, live checkout, product setting, purchase, refund, cancellation or entitlement action.
- **NOT approved:** D2 role/grant/migration, D3 checkout release, D4 provider reconciliation credentials, D6 recovery/refund or financial data-retention policy, D7 receipt activation or any Draft merge.

## Branch isolation and safeguards

This **stacked Draft** derives from [#1114](https://github.com/usdimpact/usd-impact-site/pull/1114) exact HEAD `987a504e2d8920db7b2a2cde3776138c38cdb761`, which derived from #1111 v3 at an earlier fixed SHA. The more recent parent #1111 subsequent invoice-binding guard is **not** part of this branch. Do not rebase or merge parents without exact-head reconciliation and independent review.

The isolated workflow `.github/workflows/research-d1-ephemeral-postgres-review.yml`:
- Triggers only on same-repository PR activity for changed workflow, synthetic script or review SQL; branch prefix must be `agent/1103-d1-ephemeral-pg-`.
- Uses GitHub-hosted Ubuntu runner and Docker Official PostgreSQL `16.15-bookworm` **index digest** `sha256:e8a07d2c7579b038938cdba6c539e580e5001caf9ea203d397b5cc83e76bd938`.
- Creates the isolated `ci_review` database with a **public synthetic fixture password** (never a real credential) on `127.0.0.1:5432`, and installs pinned `psycopg[binary]==3.2.10` inside a disposable CI virtualenv.
- Runs the review-only `docs/operations/research-b3-versioned-receipts-pglite-review-2026-11-04.sql` in that temporary database; NO SQL from `supabase/migrations`, NO `research_private`, NO Supabase account connection, NO real provider webhook, checkout or email.
- Has `contents: read` only, pinned checkout with `persist-credentials: false`, 10-minute timeout and no protected environment/secrets/Production deployment.
- Existing Web Quality, CodeQL, Dependency Review and migration-intake checks remain separate and unchanged.

## What counts as actual PostgreSQL evidence

The independent Python test script `scripts/test-research-d1-postgres-concurrency.py` creates separate PostgreSQL connections and asserts:

- **T17:** Session A holds a transaction inserting an event receipt while B attempts the same event. An independent observer confirms B waits on an actual PostgreSQL lock; once A commits, B returns `in_progress`, not a second lease. This is stronger than PGlite single-session models.
- **T18:** A lease is deliberately expired in the synthetic schema, B reacquires attempt 2, concurrent A/B finishes occur; stale attempt 1 cannot overwrite the successful outcome; exact duplicate finish reports `already_applied`.
- **T19:** A committed conflict observation survives deliberate termination of the original PostgreSQL session, another session recovers after a simulated lease expiry, and UPDATE/DELETE/TRUNCATE on conflict evidence are rejected.
- **V1 / T7–T8:** Stored version-v1 evidence, changed v3 version, semantically changed hashes, terminal duplicate and unsupported version follow explicit fail-closed dispositions.
- **T20 contract only:** An unchanged business fingerprint may be retried from failure to success and retains the failure observation. This **does not** prove Lemon Squeezy actually rotates delivery URLs.

Use exact run URL, exact commit SHA and log evidence. If the new workflow is waiting for GitHub Actions approval or does not trigger on PR, record that as **UNEXECUTED** and request the specific Actions UI permission; do not change branch protection or approve unrelated workflows.

## Gates that remain open after a passing run

- **T13:** Actual Stage B first-paid binding with two competing account transactions, and durable unbound second paid subscription — NOT executed; the review schema has no binding RPC.
- **T21/T22:** Actual complimentary Research entitlement and Library Pass schema/rows byte-identical after migrations — NOT executed; no real entitlement tables are loaded.
- **D2:** Separate writer/evidence-owner privileges, SECURITY DEFINER design, RLS/grant/SET ROLE negative tests under Supabase-like roles — NOT implemented or tested.
- **D6:** Real customer recovery, cancellation, refund, privacy retention and evidence redaction need explicit approval.
- **D7:** Receipt flag stays OFF. No Production or Development migrations, deployment, merge or user/account access change.
- **Customer risk:** The live concurrent Research checkout can still produce a paid provider subscription that fails to bind; a passed isolated receipt-prototype test does not fix this.

## D5 beginner-friendly read-only merchant inspection

1. Open [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com) and sign into the owner account (do not share login or API keys).
2. Navigate to **Products** and open the USD Impact **Research Membership** product, then inspect both monthly and annual variants.
3. Locate each product or variant's **Share / Buy link / Checkout URL / Product visibility** area (the dashboard labels can vary). Check whether a **public direct buy link** can be obtained without going through the USD Impact authenticated website.
4. Record only: product/variant display names, `public direct buy link accessible: YES / NO / UNKNOWN`, and whether an authentication/custom-data binding step is enforced. **Do not open checkout to submit a payment, alter visibility, disable a product, create an order or expose tokens.**
5. If the dashboard is ambiguous, mark **UNKNOWN** and provide a cropped screenshot without secrets for further review. An accessible URL alone does not prove account binding or payment completion.

No merchant dashboard session or public-link status has been independently verified in this review.

## Next independent QA

Claude should inspect the full Draft delta and evaluate both the CI workflow trust boundary and **real concurrency outputs**. A PASS for T17–T19 against the synthetic schema is not a PASS for Stage B migrations. Enumerate P0/P1/P2 findings, include exact run/job/log references and explain which D1 tests remain incomplete. Do not cross the D2/D6/D7 boundaries.

**No merged code; no Production/Development database, credentials, payment/entitlement data or receipt activation changed by these Draft artifacts.**
