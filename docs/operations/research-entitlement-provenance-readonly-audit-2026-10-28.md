# USD Impact Research Membership — read-only entitlement provenance and ACL audit

**Observation date:** 2026-10-28 (Production snapshot, not a standing real-time invariant)  
**Project:** `usd-impact-production` in Supabase, project reference `gjzetjugmnwanvjkchux`  
**Execution mode:** SELECT-only queries through a privileged read-only task interface; no SQL writes, identifiers in output, customer emails, tokens, customer browser sessions, payment actions or data exports.  
**Release state:** Evidence-only. This does not approve paid report storage, launch, provider redistribution, entitlement mutation or Production activation.

## Verified aggregate result

| Metric | Count |
| --- | ---: |
| Research Membership entitlements — active | 8 |
| Research Membership entitlements with one matching event | 7 |
| Matching events with `actor_type=admin` | 7 |
| Research Membership entitlements without any matching event | **1** |
| Research Membership entitlements linked to a purchase | 0 |
| Research Membership entitlements linked to a subscription | 0 |
| Research Membership purchases | 0 |
| Research Membership subscriptions | 0 |
| Research Membership subscription events | 0 |
| Existing `score_member_assets` private records | 58 |

The one no-event Research entitlement was created **2026-10-19 UTC**, is currently `active`, and is not linked to a purchase or subscription. There was no investigation of its owner identity or reason for issuance. Thus **the row is missing event provenance**, but **whether it requires remediation is unresolved**. Do **not** auto-revoke, recreate, migrate, or backfill it. Before any write, review the authorized administrative grant/migration records privately and obtain a separate explicit owner approval.

All seven Research entitlement-event rows inspected via aggregate grouping have `actor_type=admin`. This does not prove the remaining no-event entitlement is also an administrative grant, and it does not certify a genuine first paid subscriber. A zero-provider-backed transaction count at this snapshot does not mean the checkout launch is disabled: the separate Research commercial launch surface already merged in [site PR #909](https://github.com/usdimpact/usd-impact-site/pull/909).

## Reproducible read-only SQL

Run only with an authorized privileged audit connection. Output **aggregates**, never customer IDs, account emails, provider payloads, raw entitlement metadata, or access tokens. SQL below intentionally has no mutation, role-change, function execution, session impersonation or `FOR UPDATE`.

```sql
WITH research AS (
  SELECT
    e.state::text AS state,
    e.purchase_id IS NOT NULL AS purchase_linked,
    e.subscription_id IS NOT NULL AS subscription_linked,
    EXISTS (
      SELECT 1
      FROM public.entitlement_events ev
      WHERE ev.entitlement_id = e.id
    ) AS has_event
  FROM public.entitlements e
  WHERE e.product_id = 'research-membership'
)
SELECT
  state,
  purchase_linked,
  subscription_linked,
  has_event,
  count(*)::integer AS entitlement_count
FROM research
GROUP BY state, purchase_linked, subscription_linked, has_event
ORDER BY state, purchase_linked, subscription_linked, has_event;

SELECT actor_type, count(*)::integer AS event_count
FROM public.entitlement_events
WHERE product_id = 'research-membership'
GROUP BY actor_type
ORDER BY actor_type;

SELECT
  date_trunc('day', e.created_at AT TIME ZONE 'UTC')::date AS created_utc_day,
  e.state::text AS entitlement_state,
  count(*)::integer AS no_event_entitlement_count
FROM public.entitlements e
WHERE e.product_id = 'research-membership'
  AND NOT EXISTS (
    SELECT 1
    FROM public.entitlement_events ev
    WHERE ev.entitlement_id = e.id
  )
GROUP BY 1, 2
ORDER BY 1, 2;
```

For private Score tables, validate **both** RLS and effective browser-role privileges (they are separate controls):

```sql
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
  has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
  has_table_privilege('authenticated', c.oid, 'INSERT') AS authenticated_insert
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname IN (
    'score_member_assets',
    'score_member_sessions',
    'score_handoff_tickets'
  )
ORDER BY c.relname;
```

As of the snapshot, **all three** private Score tables returned `rls_enabled=true` and `anon_select=false` / `authenticated_select=false` / `anon_insert=false` / `authenticated_insert=false`.

## Correct release interpretation

**PASS (limited):** the audited private Score tables do not expose direct SELECT access to normal browser roles. The current site still requires verified account + Research entitlement to retrieve the protected Score member asset and uses private/no-store/noindex response controls.

**REVIEW (not a launch blocker by itself):** one Research entitlement lacks an event; that is an audit-provenance discrepancy pending a legitimate administrator/migration explanation. A 1:1 entitlement-to-event rule has **not** been established by this audit, and existing admin/complimentary grants must not be confused with commercial subscription events.

**HOLD (independent):** genuine paid-subscriber onboarding has not been end-to-end verified; future private Weekly/Monthly report origin and protected delivery are still synthetic Draft work. The existing static historical Weekly/Monthly reports remain public, and [pipeline #155](https://github.com/usdimpact/usd-impact-pipeline/issues/155) has not cleared their provider-derived Score content for public or paid redistribution.

## Next actions without a Production write

1. Privately examine the October 19 no-event record's origin in authorized admin/migration logs; capture a **categorical** cause and approval reference, not customer identity, in the release review. Do not invent a missing event.
2. Run synthetic Development authorization tests including anonymous, other account, Library-only, expired, refunded, suspended, and revoked Research cases; do not create fictitious Production purchase events.
3. Re-run the aggregate SQL, RLS and grant checks before a future authorized private-report release, and attach aggregate-only evidence to the exact-head QA decision.
4. Keep PR #924 Draft and all new report-publication/Production gates closed until product classification, data rights and private-origin Preview tests are independently approved.

No remediation, provider outreach, contract acceptance, data move, authorization grant, CodeQL suppression, payment, webhook replay or Production setting was performed during this audit.
