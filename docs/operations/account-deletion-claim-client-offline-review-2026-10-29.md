# Issue #950 — Dormant claim-aware application protocol

**2026-10-29 — review only.** No application route, scheduler, account controller or flag imports the new candidate module.

This is a stand-alone source adapter candidate, **apps/web/src/lib/account-deletion-fenced-protocol-candidate.js**. It requires a deliberately injected offline fixture and never uses global fetch, a real Supabase Auth Admin client or an email sender.

### Controlled order

1. A scanned due candidate must have a canonical account UUID and **deletion_request_id**; reject an old due-list snapshot without request identity.
2. POST service-only **claim_due_account_deletion**; require exactly one row with token, safe generation and matching Auth/account/request identifiers. No second claim when missing, malformed or denied.
3. POST **begin_claimed_auth_removal**; require matching Auth UUID. An empty, failed or lost response is **uncertain** because the SQL may have committed; never proceed to Auth or retry begin automatically.
4. Call one injected **authSoftDelete** only after the successful begin acknowledgement. The production adapter must use JSON soft-delete body, canonical origin and independently approved Auth Admin header protocol from the earlier review.
5. Accept only HTTP 200/204 as definite success; classify 404/409/429/503, empty/unexpected and timeout/network errors as **ambiguous**. Attempt the allowlisted **mark_claimed_auth_ambiguous** RPC once and stop; if that recording fails, stop and escalate. No auto Auth retry.
6. Only after Auth success, confirm the same request token/generation, then perform fenced SQL finalization, require one authoritative row, and pass it to an injected durable completion recorder. Direct provider email is never sent by this candidate.
7. A failed confirm, finalize or durable acknowledgement must be reconciled using the existing recovery safeguards and a separate claim-aware runbook. Do not restore deleted entitlements, replay DELETE or reattach Auth FK.

### No release or live acceptance

- This module explicitly permits only config mode **offline_fixture**, non-Production, canonical Development origin and injected collaborators. It is not imported by production code.
- A 100-worker **mock** test proves that a shared state can grant only one simulated claim, but it does not provide a real PostgreSQL/network concurrency proof. Review-only SQL/PGlite evidence is separately staged in Draft #954.
- JWT/session authorization, Storage object ownership, Auth Admin opaque-key protocol, actual migration, user cancellation semantics, privacy-request lifecycle and login recovery remain blocked under Issue #950.
- The existing account-deletion finalizer in the larger integration Draft #952 is unchanged. It is deliberately **not safe to activate** or pair with the proposed SQL until a coordinated, separately reviewed replacement is built and tested.

**HARD HOLD:** No DB DDL/DML, Supabase Auth HTTP, real users, email, GitHub merge, Vercel Production deployment or flags/cron/commerce/Research/Score changes. A separate explicit signoff is required for each live Development and Production step.
