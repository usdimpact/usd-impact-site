# Research O1/O4 — Stage F effect-bound witness and version-fence review (DRAFT HOLD)

**Never install or deploy.** This is a disposable PostgreSQL 17.6 test of the historical Research migrations and private Stage C/E oracles, stacked on Stage E PR #1138. No new `supabase/migrations` files or application changes are authorized. Existing Research checkout, B-5, Library Pass and all Production/Development state remain unchanged.

## Finding being tested

Stage E `verified_snapshot` matches subscription/account/provider identity, event key, fingerprint and snapshot timestamp, but the gateway's `p_next_state`, `p_next_period_start` and `p_next_period_end` are **not** bound to the witness. A gateway session using an existing witness might substitute a different entitlement outcome, such as a far-future active period or a suspended state. The first part of the Stage F runner deliberately reproduces these candidate effects, then rolls back each attempt, documenting exactly what the Stage E model allows. This is a **synthetic design flaw**, not proof of a Production exploit or forged provider signature.

## Review-only mitigation

- A new private, RLS-protected `verified_transition` row binds all 16 gateway arguments that affect account, event, status or paid period, plus the current database subscription/entitlement versions and a **synthetic** provider-version label.
- A private `SECURITY DEFINER` function, with a fixed search path and limited NOLOGIN owner, locks the real historical subscription and entitlement rows **before** verifying the witness and versions. It rejects missing/mismatched effects, unexpected event scope and stale database versions; legitimate duplicate replays remain idempotent.
- The replacement function is granted only to the restricted gateway, and the earlier insufficiently bound Stage E function is revoked from that role in the same isolated transaction. Tests must confirm the old entry point cannot remain an alternative route.
- Separate verifier and gateway connections, active-period and suspended-state substitution, stale-version/duplicate and concurrent two-event races, and purchase-backed Library Pass invariants are tested under the actual six historical migrations.

## Critical limitations / gates

**This remains NO-GO.** The verifier's test INSERT privilege is not independent proof from Lemon Squeezy, no signature authenticity or provider-authoritative settlement has been validated, and a textual `provider_snapshot_version` is not a cryptographic or transactional witness. Comparing database row versions does **not** solve a change occurring at the provider after a `GET` and before commit. A live design must establish a trusted fresh provider witness with amount/currency/customer/store/variant, settlement and signed identity, and a documented short failure window or provable reconciliation strategy. No Supavisor TLS, hosted runtime custody, D2-B/C, Development parity, original legacy RPC cutover, account deletion, or any connected database changes are addressed here.

Do not infer permission to merge, provision roles, change merchant/payment/refund settings or deploy a Research fix. Preserve today's existing Research checkout and Library Pass while owner/independent review gates remain open.
