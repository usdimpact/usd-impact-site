# Research Membership first genuine subscriber verification runbook

Status: **Production operational runbook — read-only verification by default**  
Prepared: **2026-10-28**  
Product: **USD Impact Research Membership**  
Provider: **Lemon Squeezy**  
Product ID: `research-membership`

## 1. Purpose

This runbook defines the bounded verification sequence for the first independent genuine paid Research Membership subscriber after approved Production activation.

The first Live subscription is real commerce, not a test fixture. It must not be created by the owner, employee, contractor, QA account, related party, reimbursed participant, or anyone instructed to manufacture launch evidence.

Do not initiate, refund, cancel, resume, or otherwise manipulate a real subscription merely to exercise a lifecycle state.

Use Test Mode and the existing automated contract suite for synthetic lifecycle coverage. Production verification is observation of normal buyer behavior only.

## 2. Current launch baseline

Prepared against protected `main`:
`d8f5ade773a8b94de9bb0e611f9d7c7ae73e563b`

Exact Production deployment at launch:
`dpl_6JLse5P5XmA45PybuZ3p1ZnToEPp`

Launch state:
- `RESEARCH_MEMBERSHIP_PRODUCTION_ACTIVATION_APPROVED=true`;
- `RESEARCH_MEMBERSHIP_PRODUCTION_CHECKOUT_ENABLED=true`;
- USD 29/month;
- USD 290/year;
- no free trial;
- no introductory discount;
- historical public sample remains public;
- Library Pass remains independent;
- TradingView remains roadmap-only and is not included at initial launch.

Before using this runbook, record the current signed `main` SHA and exact READY Production deployment. If the Research checkout, webhook adapter, lifecycle runtime, database contract, or Lemon Squeezy catalog has changed since this baseline, revalidate this runbook against current code before declaring PASS.

## 3. Non-negotiable boundaries

1. Do not create a checkout for verification.
2. Do not use a real card for testing.
3. Do not manufacture a refund, dispute, cancellation, resume, payment failure, or renewal.
4. Do not impersonate the subscriber or request their password, passkey, one-time link, browser session, or financial receipt.
5. Do not expose full customer, subscription, invoice, event, entitlement, checkout, or account identifiers in GitHub/chat/public evidence.
6. Do not retrieve, reveal, rotate, or copy API keys, webhook secrets, Supabase secrets, cookies, session tokens, signed URLs, or private object URLs.
7. Do not patch Production tables, Auth records, subscription state, entitlement state, webhook receipts, or outbox rows.
8. Do not replay provider webhooks manually to manufacture evidence.
9. Do not manually trigger a provider lifecycle event merely to accelerate proof.
10. Do not send, resend, or fabricate transactional or access-ready emails.
11. Do not change Library Pass state while verifying Research Membership.
12. Do not enable TradingView or any other roadmap feature as part of first-subscriber acceptance.

Allowed activity is read-only evidence collection from already-existing normal Production behavior.

## 4. Eligible first genuine subscriber

Treat a subscription as the first genuine subscriber candidate only when all are true:

- it occurred after approved Production launch;
- buyer is independent and not owner/staff/QA/related-party evidence traffic;
- provider event is Live, not Test Mode;
- configured Store, Research Product, and Variant match the trusted Production Research catalog;
- billing interval is exactly monthly or annual;
- expected public price is the currently approved Research offer;
- currency is USD;
- no free trial or unauthorized introductory discount was applied;
- authenticated USD Impact account metadata matches one real account;
- provider subscription ID is stable and unique;
- initial authoritative lifecycle event is `subscription_created`;
- no client-supplied redirect, browser message, screenshot, or email is used as entitlement authority.

If any condition is uncertain, classify **HOLD** and investigate without mutation.

## 5. Privacy-safe evidence

Keep full provider/customer records private.

Public evidence may include only:
- verification timestamp;
- current signed `main` SHA;
- exact Production deployment ID;
- provider = Lemon Squeezy;
- Live/Test determination;
- billing interval;
- state names;
- expected-versus-observed row counts;
- redacted suffixes or one-way digests if an identifier reference is needed;
- PASS/HOLD/INCIDENT outcome.

Never publish:
- buyer name/email/address/IP;
- payment details;
- full customer/subscription/invoice/event/account IDs;
- raw webhook payloads;
- request headers;
- session data;
- private URLs;
- financial documents.

## 6. Phase A — detect without mutating

When the first possible real subscriber appears:

1. Record detection time, current `main` SHA, and exact READY Production deployment.
2. Confirm there is no active commerce incident or rollback.
3. Verify Research checkout is still intentionally enabled.
4. Identify the candidate subscription through authenticated provider/read-only application evidence.
5. Confirm Live mode and approved catalog mapping.
6. Confirm billing interval is monthly or annual.
7. Confirm it is not a test/owner/staff/QA transaction.
8. Record only privacy-safe evidence publicly.
9. Do not change the provider subscription.

If the candidate is ineligible, classify **NOT QUALIFYING** and keep waiting for a genuine subscriber.

## 7. Initial authoritative event

The first binding must originate from a valid signed `subscription_created` event.

The deployed runtime must verify:

- exact raw body signature before trusting the event;
- Live/Test mode;
- configured Store;
- configured Research Product;
- configured monthly/annual Variant;
- account metadata binding;
- billing interval;
- provider subscription identity;
- event timestamp;
- event replay identity/fingerprint.

The first-purchase/bootstrap runtime must fail closed if:
- event is not `subscription_created`;
- data type is not `subscriptions`;
- account metadata does not match;
- catalog mapping is wrong;
- billing interval is wrong;
- provider environment is wrong;
- the subscription binding already exists inconsistently.

## 8. Expected steady state after first successful subscription

For one genuine subscriber account and one provider subscription:

| Invariant | Expected |
| --- | --- |
| `subscriptions` | Exactly **1** Research row for the provider subscription |
| Product | `research-membership` |
| Provider | `lemon-squeezy` |
| Billing interval | `monthly` or `annual` |
| Initial state | `active` after accepted `subscription_created` |
| Current period | Valid start/end timestamps matching provider lifecycle evidence |
| `cancel_at_period_end` | `false` initially unless authoritative provider state says otherwise |
| `subscription_events` | Exactly **1** canonical initial activation event |
| Initial transition | pending/bootstrap → active |
| Initial provider event ID | Bound to the accepted signed event |
| `entitlements` | Exactly **1** Research entitlement for the account/subscription |
| Entitlement state | `active` |
| Entitlement `subscription_id` | Exact local subscription row |
| Entitlement `purchase_id` | **null** for normal recurring Research Membership |
| Duplicate active Research entitlements | **0** |
| Duplicate Research subscriptions for same provider subscription | **0** |
| Duplicate initial subscription event | **0** |
| Provider-backed entitlement/event binding | Present only through the reviewed lifecycle path |
| Library Pass purchase/entitlement | Unchanged |

Do not require a hard-coded local row UUID or version number. Require correct uniqueness, binding, state, lifecycle timestamps, and auditable version movement only when a real transition occurs.

## 9. Read-only Production SQL

Run only `SELECT` statements.

Keep real identifiers private.

### 9.1 Subscription row

```sql
select id, account_id, product_id, provider,
       provider_subscription_id, provider_customer_id,
       provider_price_id, billing_interval, state,
       current_period_start, current_period_end,
       cancel_at_period_end, cancel_scheduled_at,
       cancelled_at, ended_at,
       last_provider_event_id, version,
       created_at, updated_at
from public.subscriptions
where provider = 'lemon-squeezy'
  and provider_subscription_id = '<private-provider-subscription-id>';
```

Expected: exactly one row.

### 9.2 Subscription lifecycle events

```sql
select id, event_key, subscription_id, account_id, product_id,
       from_state, to_state, reason, actor_type,
       provider_event_id, occurred_at, created_at
from public.subscription_events
where subscription_id = '<private-local-subscription-uuid>'
order by occurred_at asc, created_at asc;
```

Initial expected event count: exactly one activation event before any later legitimate lifecycle transition.

### 9.3 Research entitlement

```sql
select id, account_id, purchase_id, subscription_id,
       product_id, state, starts_at, ends_at,
       version, created_at, updated_at
from public.entitlements
where account_id = '<private-account-uuid>'
  and product_id = 'research-membership';
```

Expected:
- exactly one active subscription-backed entitlement;
- matching `subscription_id`;
- `purchase_id is null` for the normal recurring path.

### 9.4 Research entitlement events

```sql
select id, event_key, entitlement_id, account_id, product_id,
       from_state, to_state, reason, actor_type,
       provider_event_id, occurred_at, created_at
from public.entitlement_events
where account_id = '<private-account-uuid>'
  and product_id = 'research-membership'
order by occurred_at asc, created_at asc;
```

Verify one reviewed provider-backed activation transition and no duplicate activation.

### 9.5 Webhook receipts

```sql
select id, provider, provider_event_id, event_type,
       payload_sha256, status, attempt_count,
       received_at, processed_at, last_error
from public.webhook_receipts
where provider = 'lemon-squeezy'
  and provider_event_id = '<private-provider-event-id>';
```

Expected:
- exactly one durable receipt for the event identity;
- processed successfully;
- duplicate same-payload delivery must not create a second transition;
- same identity with conflicting payload must fail closed.

### 9.6 Library Pass independence control

```sql
select count(*) as active_library_purchase_backed
from public.entitlements
where account_id = '<private-account-uuid>'
  and product_id in (
    'read-the-dollar-first-guided-interactive-edition',
    'library-pass'
  )
  and state = 'active'
  and purchase_id is not null;
```

If the Research subscriber also owns Library Pass, the Library state before and after Research lifecycle events must remain unchanged except for unrelated legitimate Library activity.

## 10. Duplicate and replay behavior

The Research webhook path is explicitly replay-aware.

Verify:

- same event identity + same replay fingerprint = duplicate/read-only;
- same event identity + conflicting replay fingerprint = fail closed;
- a later billing period does not contaminate duplicate classification;
- an archived event from an already-cancelled subscription does not resurrect access;
- ordinary `subscription_payment_success` is ignored when authoritative `subscription_updated` will establish the new period;
- no replay creates a second subscription, entitlement, or lifecycle event.

Never manually replay Production webhooks to prove this. Automated tests are the synthetic proof; Production evidence is observational only.

## 11. Protected Research access

After the first legitimate active Research entitlement exists, verify the server-side path remains correct.

Allowed outcomes:

- **AUTHORIZED PATH VERIFIED** — database entitlement + route contract are correct; buyer interaction not observed.
- **BUYER-CONFIRMED PASS** — buyer voluntarily confirms access in their own session.
- **DENIED AS EXPECTED** — anonymous/non-entitled control fails closed.
- **HOLD** — valid entitlement exists but protected Research route does not authorize correctly.

Do not impersonate the subscriber.

Do not claim a buyer-view PASS merely because the entitlement exists.

Public sample remains public and is not evidence of paid entitlement.

## 12. Expected recurring lifecycle

### 12.1 Normal renewal

Authoritative path:
- provider bills normally;
- `subscription_payment_success` may be ignored as non-authoritative for period movement;
- authoritative `subscription_updated` advances the period;
- local state remains active;
- entitlement remains active;
- exactly one canonical lifecycle transition applies for the new period.

No duplicate subscription or entitlement is created.

### 12.2 Payment failure

Expected:
- `subscription_payment_failed`;
- subscription moves to reviewed past-due semantics;
- lifecycle event recorded once;
- access behavior follows current reviewed lifecycle policy;
- no Library Pass change.

### 12.3 Payment recovery

Expected:
- authoritative recovery event/update;
- past-due → active transition;
- one canonical event;
- existing subscription/entitlement reused;
- no duplicate entitlement.

### 12.4 Cancellation scheduled

Expected:
- `subscription_cancelled`;
- provider status/cancelled/ends-at fields are internally consistent;
- local state becomes cancel-scheduled;
- `cancel_at_period_end=true`;
- current paid-period access remains until the reviewed end boundary;
- Library Pass remains untouched.

### 12.5 Cancellation revoked / resume

Expected:
- `subscription_resumed`;
- provider reports active and not cancelled;
- cancel schedule removed;
- existing subscription restored to active semantics;
- no new subscription row.

### 12.6 Expiry

Expected:
- `subscription_expired`;
- subscription reaches terminal cancelled/ended state under reviewed contract;
- Research entitlement is no longer active after the valid end boundary;
- Library Pass remains untouched.

### 12.7 Full refund

A full current-period refund can terminate Research access only when the signed provider invoice evidence matches the reviewed refund contract.

A partial refund:
- does not automatically terminate Research access.

A historical-period full refund:
- must not terminate an unrelated current paid period.

Never create/refund a real invoice for testing.

## 13. Notification/outbox checks

If the normal lifecycle creates an application notification:

- inspect existing outbox state read-only;
- verify idempotency;
- verify there is no duplicate access-ready communication;
- do not resend merely to create evidence;
- do not use email delivery as entitlement authority.

If no app notification is expected for a particular event, absence is not a failure.

## 14. Runtime and provider-health checks

For first-subscriber verification:

- current exact Production deployment must be READY;
- no active rollback;
- recent Vercel runtime errors must not show a Research/commerce failure for the candidate request;
- Lemon Squeezy webhook processing must not show an unresolved event failure;
- Supabase security/readiness state must remain healthy;
- no unrelated Score/FOMC/audiobook hold is crossed.

## 15. Incident matrix

| Observation | Disposition |
| --- | --- |
| Real payment/subscription exists but no valid USD Impact account binding | **HOLD** — do not manually bind |
| Invalid webhook signature | **SECURITY INCIDENT / FAIL CLOSED** |
| Test Mode event in Production path | **HOLD / FAIL CLOSED** |
| Wrong Store/Product/Variant | **HOLD / FAIL CLOSED** |
| Duplicate local subscription for one provider subscription | **INCIDENT** |
| Duplicate active Research entitlement | **INCIDENT** |
| Conflicting replay fingerprint for same event identity | **SECURITY/INTEGRITY HOLD** |
| Active subscription but missing entitlement | **HOLD** — do not backfill manually |
| Entitlement active but subscription terminal/expired unexpectedly | **HOLD** |
| Research cancellation removes Library Pass | **SEVERE INCIDENT / rollback Research path** |
| Partial refund incorrectly terminates Research | **INCIDENT** |
| Historical refund terminates current period | **INCIDENT** |
| Runtime/provider outage during first subscription | **HOLD**, preserve evidence, follow rollback runbook if needed |
| Public sample becomes gated or private Research becomes public | **INCIDENT** |
| TradingView becomes included without separate authorization | **SCOPE INCIDENT** |

## 16. Rollback authority

Use:
`docs/operations/research-membership-production-rollback-runbook.md`

Preferred containment sequence:

1. Disable `RESEARCH_MEMBERSHIP_PRODUCTION_CHECKOUT_ENABLED` first to stop new subscription creation.
2. Preserve existing customer/subscription/audit records.
3. Disable `RESEARCH_MEMBERSHIP_PRODUCTION_ACTIVATION_APPROVED` only if broader Research containment is required.
4. Do not revoke independent Library Pass access.
5. Do not delete or rewrite provider/webhook/subscription evidence.

## 17. PASS criteria for the first genuine subscriber

Declare **FIRST GENUINE RESEARCH SUBSCRIBER PASS** only when:

- buyer is independently genuine;
- Live provider/catalog checks pass;
- one signed `subscription_created` event is accepted;
- exactly one local Research subscription exists;
- subscription is active with valid period boundaries;
- exactly one canonical initial subscription event exists;
- exactly one subscription-backed active Research entitlement exists;
- no duplicate subscription/entitlement/event exists;
- webhook replay controls remain intact;
- protected Research route remains entitlement-gated;
- public sample remains public;
- Library Pass independence is verified;
- TradingView remains outside initial scope;
- no unresolved Research/commerce runtime error exists.

If a scheduled renewal/cancellation has not yet happened, do not fabricate one. Initial subscriber PASS does not require waiting for every future lifecycle state; those states remain covered by automated contracts and are verified operationally only when they occur naturally.

## 18. Evidence template

Public issue comment:

> **First genuine Research subscriber verification — [UTC timestamp]**
>
> - Production SHA: `[sha]`
> - Production deployment: `[deployment-id]`
> - Provider: Lemon Squeezy Live
> - Billing interval: monthly / annual
> - Genuine independent subscriber: PASS
> - Signed `subscription_created`: PASS
> - Local subscription cardinality: 1
> - Initial subscription-event cardinality: 1
> - Active subscription-backed Research entitlement: 1
> - Duplicate subscription/entitlement/event: 0
> - Replay/idempotency evidence: PASS
> - Protected Research authorization path: AUTHORIZED PATH VERIFIED / BUYER-CONFIRMED PASS
> - Public sample remains public: PASS
> - Library Pass independence: PASS
> - TradingView initial-launch exclusion: PASS
> - Runtime errors for candidate lifecycle: none / classified
> - Identifiers: verified privately and redacted
>
> **Disposition: PASS / HOLD / INCIDENT**

## 19. Final rule

The first subscriber is evidence of the normal system operating correctly.

They are not a test instrument.

Observe, verify, redact, and preserve.

Do not manipulate real commerce to make the evidence pass.
