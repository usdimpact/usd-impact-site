# F4 account export: corrected source-chain audit — 2026-11-02

**Status: earlier P1 signature-mismatch allegation RETRACTED. F4 actual signed-user/PostgREST receipt still HOLD.**

**Safety:** This is an isolated QA evidence branch. No migration, remote SQL, customer data, real Auth token, Production deployment, or protected-main change was made. Do not merge this QA-only PR or treat it as a release authorization.

## Why the original November 1 F4 analysis was wrong

The first QA (recorded in historical CI) loaded only the July 29 `20260729203000_paid_access_foundation.sql` `SECURITY DEFINER` one-argument function and then the October UI-02 zero-argument function. It omitted **`20260812180308_harden_account_rpcs.sql`**, which is present in the actual migration histories of **both Development and Production**.

The August hardening migration had **already replaced** the one-argument function with a `SECURITY INVOKER` compatibility wrapper and created the canonical zero-argument implementation:

```sql
create or replace function public.account_export(export_account_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.account_export()
  where export_account_id is not null
    and export_account_id = (select auth.uid());
$$;
```

The same August migration explicitly revoked public/anonymous execution and granted `authenticated` execution on **both** signatures. The October UI-02 migration then **replaced the pre-existing zero-argument implementation**, preserving its function identity/grants, and added `transactionalLanguagePreference`. Stacked October UI-03 also replaces that zero-argument implementation, adding `mediaLanguagePreference`.

The application still POSTs `{ export_account_id: user.id }` to `/rest/v1/rpc/account_export`, so its existing one-argument call delegates to the canonical zero-argument implementation. There is **no source-level named-argument mismatch** requiring a speculative one-argument corrective migration.

**Read-only connector corroboration:** Supabase generated TypeScript types show `account_export` has both `Args: never` and `Args: { export_account_id: string }` in BOTH Development and Production. Applied migration ledgers also include the August hardening version `20260812180308` in BOTH projects; only Development includes the three October UI-02/UI-03 versions. Read-only table inventories show both locale-preference tables in Development and neither table in Production. Generated types do not expose live function bodies or effective PostgreSQL grants; actual signed-user PostgREST behavior remains to be tested.

## Corrected exact-source isolated PostgreSQL proof

[GitHub Actions run #41358886862](https://github.com/usdimpact/usd-impact-site/actions/runs/41358886862) **PASS** at exact QA commit `8fe2f3df0a21759495b7b0ddd56555d9790b605c`. The updated test `apps/web/scripts/test-f4-account-export-overloads-qa.mjs` executes the actual functions from **July foundation → August hardening (including both authentic grants) → UI-02 October function** in disposable PGlite, using fake identities and a minimal source-consistent RLS fixture.

**16/16 migration-chain assertions PASS**, including:
- July-only fixture reproduces the misleading prior conclusion.
- August hardening retains one-argument function OID but changes it to `SECURITY INVOKER`; canonical zero-argument function has `SECURITY INVOKER`; both signatures retain authenticated-only EXECUTE permissions.
- The one-argument wrapper returns all seven original export fields.
- After UI-02 replaces the zero-argument function, the **unchanged one-argument application call returns the transactional-language preference** for its own account and matches direct zero-argument output.
- Signed-role fixture A cannot export B; absent identity or anonymous role fails.
- `deletion_pending` does not receive the retained locale preference under active-only table RLS; this is still a privacy-design decision, not F4 incompatibility.
- A synthetic `deleted` profile retaining a matching simulated token can still receive its legacy profile data; this is NOT evidence that actual deleted Supabase users can call the real API. Real session revocation/finalization tests remain necessary.

Separate UI-02 local exact-policy RLS test remains [18/18 PASS](https://github.com/usdimpact/usd-impact-site/actions/runs/41358886862). The downstream stacked UI-03 function needs its own full-sequence isolated verification; the present branch intentionally does not copy its already-applied SQL.

## F3 privacy implications: previous Option B proof is obsolete as a deployment design

The earlier **22/22** F3/F4 prototype was based on the **obsolete July SECURITY DEFINER function**, before August removed that privileged design. Its synthetic checks remain historically valid only for *that obsolete fixture*, NOT for the currently deployed `SECURITY INVOKER` function chain.

**Do not implement Option B by restoring a SECURITY DEFINER one-arg exporter or bypassing RLS**. That would reverse the hardening migration and create an unnecessary privilege-expansion risk. A complete self-service `deletion_pending` export, if approved, needs a separately designed and tested least-privilege path consistent with the current function security model and with the data-subject access process. Option A (status-active-only reads) remains the existing behavior in source; neither Option A nor a future implementation of Option B has privacy-owner approval.

## Remaining gates (never silently close)

1. **F1:** Reconcile historical Development migration source/history drift, preserve all already-applied SQL bytes, and keep the mandatory Production Dev-only migration guard. Do not `db push`, `migration repair`, apply SQL, or retimestamp files.
2. **F2:** Real two **independently signed** synthetic Supabase users in separately authorized isolated environment; cross-account RLS and anonymous JWT negatives, including `deletion_pending` behavior. Local PGlite RLS checks are not a substitute.
3. **F3:** Owner/legal decision on how retained preferences and other personal data are included in a verified access request during deletion, and separate final-deletion/revocation evidence.
4. **F4:** Execute the **existing named-arg caller contract** under signed PostgREST identity on a separately authorized scope, including all seven old fields, both Development-added locale fields after UI-03, self/cross-account denial, grants, and schema-cache behavior. **Do not author an additive SQL repair unless this actual test reveals a new grounded defect.**
5. **F5:** The optional video-caption 800ms bound is tested on a separate QA Draft, not integrated into existing UI-03 #1028. All public media, rights, commerce, email and release holds remain unchanged.

Source-owner coordination remains on upstream [#1022](https://github.com/usdimpact/usd-impact-site/pull/1022), stacked [#1028](https://github.com/usdimpact/usd-impact-site/pull/1028), and this isolated Draft #1053. Historical issue comments that claim a current one-arg RPC mismatch or recommend returning to SECURITY DEFINER are **superseded by this audit**.
