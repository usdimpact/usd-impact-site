# D33/R01 — Research deletion billing hold: author handoff

2026-11-05. AUTHOR-only Draft #1161, stacked on D33 Draft #1159; Issue #1103 remains P1 HOLD / NO-GO. No connected Production or Development, migrations, merchant operations, customer/refund actions, deployment or merger.

## Owner policy and scope

Keep the deletion request recorded and normal paid-content denial for non-active accounts. Do not soft-delete Supabase Auth or finalize a Research account until external merchant cancellation and financial status are independently verified. Local subscriptions.state=cancelled or a subscription event is **not sufficient proof**.

The new application module is imported but disabled unless two independent flags are true:
- RESEARCH_DELETION_HOLD_V1_ENABLED=true
- RESEARCH_DELETION_HOLD_V1_REVIEW_APPROVED=true
- Additionally config.production must be false; Production explicitly refuses activation.

No environment flags are added or activated in this PR. Feature OFF preserves current behavior. The ledger SQL is stored under docs, NOT supabase/migrations, and is NOT installed.

Under controlled review the worker checks any existing account-keyed hold, then the Research subscription table. Any subscription in any state, a previous hold, failed lookup, or malformed lookup blocks Auth removal. The worker requires the private RPC to acknowledge a valid durable hold record before returning billing_hold. Failed RPCs also block Auth deletion and increment the existing cron failure count, but cannot create durable records if the database itself is down. No merchant endpoint is called and no completion email is generated.

A clean lookup with zero Research subscriptions and zero prior holds follows the legacy Auth/SQL deletion path. **This is a point-in-time read, not a transactional race solution.** Real safe activation requires the separate D33 database lifecycle locks and guarded finalization.

## Ledger and operational retries

The candidate minimal ledger has one row per account (unique account_id), reason code, open/manual_review state, attempt count and timestamps. It contains no email, merchant subscription ID, invoice, provider payload or secrets. RLS enabled, browser/anon EXECUTE/DML denied; service_role only uses an invoker RPC. SQL under docs is nondeployable.

It sets a six-hour not-before retry timestamp and a 24-hour **internal escalation threshold**; the existing deletion worker runs once daily, and no extra scheduled service is created. These are evaluated on its next invocation, not guaranteed notification times. Manual_review is an internal triage state, not a final privacy outcome. There is NO automatic provider cancellation, hold resolution, refund or legal SLA.

Sanitized oversight aggregate after separate access approval:

    select hold_state,reason_code,count(*) as cases
    from public.research_deletion_billing_holds
    group by hold_state,reason_code
    order by hold_state,reason_code;

Do not place individual account UUIDs, emails, provider IDs or customer details in GitHub trackers.

## Remaining owner/security/legal gates

1. Verify provider-side cancellation using provider/customer/subscription binding, final effective status and timestamps, signed evidence and fresh merchant confirmation. Reconcile late renewals, refunds and chargebacks without reopening entitlements.
2. Establish privacy/legal deletion deadline, lawful financial record retention, customer notice/support follow-up, escalation and outage fallback. The synthetic 24h threshold is NOT legal compliance.
3. Design a separate audited authorized hold-resolution workflow, deduplicated durable status transitions and support dashboard/alert routing; a database outage cannot guarantee case persistence.
4. Verify real Supabase PostgreSQL ownership/ACL, service_role and restricted lifecycle helper, combined all-52-migration Stage E..Q, Library Pass/Paddle positive/negative paths, two-backend deletion races, Preview authorization and merchant settlement R1/R2.
5. Run independent exact-commit review plus approved Development parity before requesting any separate owner release GO.

Test scope: synthetic offline Node and disposable pinned PostgreSQL 17.6 only. No connected user data, merchant transactions, Production SQL, keys, or deployments. Never merge, deploy, install the docs SQL, set environment flags, change provider billing or mark #1103 resolved based on this Draft.
