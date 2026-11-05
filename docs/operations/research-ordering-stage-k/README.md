# USD Impact Research — Stage K journal custody / role hardening (DRAFT HOLD)

**Strictly isolated PG17.6 review. No live deployment, Supabase migration, credential, payment, or entitlement APPLY.**

Stacked on [Stage J #1144](https://github.com/usdimpact/usd-impact-site/pull/1144)
at `17d5c0fdefc6a1dca4a7d655946d5a17255bdde3`. The implementation
adds only this folder and a review-only Actions workflow. No app imports or
`supabase/migrations`; preserve original Research checkout and Library Pass.

## What is actually improved in isolated tests

- **H1**: The Stage H/I and J `SECURITY DEFINER` journal entrypoints are
  overlaid with `search_path = ''`, matching Supabase's current guidance:
  https://supabase.com/docs/guides/database/functions. All database references
  are schema-qualified and original journal behavior remains non-authorizing.
- **H2**: A *real TCP LOGIN* test user (127.0.0.1 ONLY) has connection limit 2,
  2-second statement timeout, 1-second lock timeout, no owner memberships,
  no direct data-table DML/SELECT/TRUNCATE or J-holder EXECUTE. The login
  can execute only the K private `hold_observation` function, never an APPLY.
  In CI it uses an obvious synthetic password, not a real secret.
- **D1**: An append-only, FK-bound observation audit now retains each synthetic
  signed-delivery hash, invoice snapshot digest, invoice/subscription version,
  quote evidence digest, action and quarantine disposition. A conflicting
  replay keeps the original plus all conflicting observations, rather than
  recording only the new generic digest. The K holder first invokes Stage J's
  canonical locked invoice holder, then writes its full observation in the
  *same PostgreSQL transaction*. It returns `can_mutate=false`.
- **Bypass closure within the isolated overlay**: ordinary Stage J writer
  direct EXECUTE is revoked; the K NOLOGIN owner gets execute-only delegation
  to Stage J. The K LOGIN cannot use J directly. The Stage J and H/I Draft
  branches are not edited or deployed.
- **Regression**: Six actual historical Research migrations, synthetic
  purchase-backed Library Pass, the earlier Stage G (72), Stage H (31)
  and Stage J (30) offline scenarios, and two separate TCP gateway connections
  are tested. No real provider calls, database writes to connected Supabase,
  or customer data.

## What these tests explicitly do NOT close

Stage K cannot establish the invoice's authoritative paid-cycle start,
refund status *at commit*, a conditional Lemon Squeezy version token, or
hosted provider TLS/API-key provenance. A signed delivery or a pair of
matching GETs is insufficient to authorize an entitlement change. This
journal remains **pending-only, synthetic**, not a Research first-activation
or renewal integration.

The private NOLOGIN owner still can disable triggers if its credentials or
privileges are compromised; a superuser/replication-mode administrator can
bypass trigger protections. PGAudit, DDL and role changes need external
retention and alerts, with independent reconciliation. Storing hashes and
versions does not retain raw payload PII; decide separately how encrypted
raw evidence and legal retention should be handled.

Still **P1 OPEN**: Stage F missing-entitlement first activation; legacy public
16-arg RPC and shared `service_role` direct privileged writes; D2-C/B-5
Library Pass/Paddle/dual-product deletion/TRUNCATE/TRIGGER and account-delete
compatibility; Development–Production parity; R1 post-final-GET refund race;
R2 provider-cycle authority, owner reconciliation policy, integrated
independent security and release authorization.

No live Research checkout, pricing, sale, merchant, payment/refund, customer
entitlement, Library Pass, linked database, credentials, DNS, Vercel or
Deployment change. **B-5 and O1/O4 release NO-GO.**

## Release handoff

1. Independent reviewer must rerun this exact child SHA and challenge
   simulated LOGIN roles, trigger-bypass cases and quarantine integrity.
2. Separate B-5 owner must complete shared-commerce/Library Pass compatibility
   tests without editing this branch.
3. Owner must approve a verifiable invoice-to-paid-cycle source and post-commit
   refund/downgrade exposure policy before any real entitlement APPLY code.
4. Then the integrated lifecycle design (including F1) needs Development
   parity, a fully separate merchant-authenticated transport, checkout
   rollback plan, release QA and **new explicit owner authorization**.

A green synthetic suite can advance **design review**, not Production GO.
