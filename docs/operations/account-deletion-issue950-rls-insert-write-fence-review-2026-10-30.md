# Issue #950 — Stale-JWT write-fence coverage for all authenticated RLS policies

**Status:** Draft-only SQL/security test. **No live Development, restore or Production SQL was applied.**

## Real source finding (October 30, 2026)

A read-only `pg_policies` inventory on canonical Development showed **19 policies in public**:

- **14** authenticated policies for SELECT, UPDATE and DELETE were already included in the proposed account-deletion JWT/RLS fence.
- **3** additional authenticated INSERT policies — `bookmarks_insert_own`, `learning_progress_insert_own`, `support_requests_insert_own` — required `profiles.status = 'active'`, but not `profiles.auth_user_id = auth.uid()`.
- The remaining **2** policies (`guided_content_releases_deny_client_access` and `guided_supplement_releases_deny_client_access`) explicitly return `false` to both `anon` and `authenticated`; they are intentionally unchanged.

After the normal deletion-request transition to `deletion_pending`, the existing INSERT policies already reject new writes. After the previously proposed `profiles_select_own` policy is installed, its canonical-link check may also deny the profile subquery used by these INSERT policies. The original INSERT predicates themselves nevertheless lack an **explicit** Auth-link invariant. Requiring it directly avoids relying on indirect RLS behavior or future changes to related policies. This is defense-in-depth hardening, **not evidence of an exploitable Production incident**.

## Draft-only correction

`docs/operations/candidates/account-deletion-jwt-rls-fence.review.sql` now requires the **same canonical Auth link** on all **17** client-access policies. The three new `ALTER POLICY ... WITH CHECK` operations add `p.auth_user_id=(select auth.uid())` to the existing active-status checks. They deliberately preserve `account_id` ownership and status checks.

The support request policy additionally preserves **all** existing business validation terms, rather than simplifying them:

- `p.email = support_requests.email` ownership;
- allowed categories `access`, `commerce`, `privacy`, `security`, `product`, `general`;
- subject length **3–160**, trimmed whitespace, no carriage return or line feed;
- message length **10–5000**, trimmed whitespace, no carriage return.

The two existing private-guided-content explicit-deny policies remain untouched. The reviewed SQL is still outside `supabase/migrations`, not imported by an application route and has no recipient, credential or Auth Admin logic.

## Synthetic acceptance

The existing `test-account-deletion-jwt-rls-fence.mjs` is strengthened to construct **all 17** policies and verify `auth_user_id` in each qualified `USING` or `WITH CHECK` expression. It validates:

- a linked `active` user can INSERT to all three tables, while never seeing another account's rows;
- pending status blocks INSERT even with the Auth link still present;
- an inconsistent `active` but detached profile blocks INSERT with a stale synthetic JWT;
- the existing select/update/delete identity tests still deny after a fenced Auth-link detachment;
- invalid support email, category, subject and message remain blocked.

The cross-layer PGlite fixture is updated to include the real support table's required input fields and the three prior INSERT policies before installing the reviewed candidate. No real Supabase service, copied Auth user, S3 bytes, email or external network is involved.

## Release impact

**This expands the proposed RLS cutover coverage from 14 to 17 client policies; it does not automatically revoke already-issued JWTs**. The coordinated Auth claim must still detach the canonical FK in one transaction before GoTrue removal, and additional session/JWT validation is required for any other sensitive API. The public function `request_account_deletion()` also has a separately reviewed canonical-link guard.

**No release authority:** independent DBA/security/privacy approval, actual safeguarded Storage file recovery, protected real synthetic GoTrue/JWT/PostgREST acceptance, coordinated CLI-generated migration + real finalizer, and separate Production signoff are still mandatory. No project setting, account, entitlement, SQL migration or deployed application was changed.

References: [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950) · [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Draft GoTrue wire review #984](https://github.com/usdimpact/usd-impact-site/pull/984).
