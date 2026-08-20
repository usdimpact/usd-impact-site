# USD Impact Provider-Neutral Launch Email Dispatch

## Status

Dispatch contract version: `2026-08-20.v1`

Implementation: `apps/web/src/lib/launch-email-dispatch.js`

This module provides the source-controlled bridge between verified application business state, the durable `notification_outbox`, the approved launch-email template registry, and an injected delivery provider adapter.

It is dormant by default. It does not register a provider, configure a sender, enable a webhook, apply a Production migration, send a customer message, grant an entitlement, or open checkout.

## Purpose

The dispatch layer closes the source-architecture gap between:

1. a verified application business event;
2. an allowlisted message policy and template;
3. one durable, idempotent outbox identity;
4. a policy-eligible delivery attempt;
5. an injected provider adapter;
6. provider-message correlation and later signed callback processing.

The intended path is:

`verified business state -> dispatch intent -> durable outbox row -> eligibility check -> provider adapter -> provider message reference -> signed lifecycle callback`

## Durable intent contract

`createLaunchEmailDispatchIntent()`:

- accepts only launch-critical message IDs already defined by the operations policy and template registry;
- keeps `auth_sign_in` outside the application outbox because Supabase Auth owns the secure sign-in link;
- blocks `purchase_pending` and `purchase_failed` until the replacement-provider responsibility matrix is explicitly approved;
- enforces exact policy, template, and classification equality;
- creates an allowlisted minimized outbox row through `buildNotificationOutboxRecord()`;
- persists an empty `{}` payload for every application-owned lifecycle template;
- derives a bounded opaque customer-support reference instead of exposing the raw business-object identity;
- derives one stable provider idempotency key from the immutable business-state identity;
- never persists an unsubscribe token, signed URL, provider secret, complete authentication link, card data, private learning input, or privacy-export payload.

The immutable identity includes:

- message ID;
- business-object type;
- business-object ID;
- state version;
- normalized recipient address.

A duplicate of the same business state therefore resolves to the same outbox idempotency key and the same provider idempotency key.

## Provider boundaries

The dispatch layer recognizes the provider boundaries already approved by the email operations policy:

- `supabase_auth` — provider-managed and rejected from the application outbox;
- `application_owned` — eligible for application enqueue after verified state;
- `application_owned_after_verified_event` — eligible only after the authoritative server-side event exists;
- `shared_after_provider_selection` — rejected until the replacement-provider responsibility mapping is approved.

This change does not decide which Merchant-of-Record or payment provider owns receipts, payment-failure notices, refund timing, dispute notices, tax documents, or settlement communication. Issue #53 remains authoritative for that responsibility matrix.

## Consent and suppression eligibility

`evaluateLaunchEmailEligibility()` applies the merged operations policy before a send can occur.

Verified behavior:

- a consent-bound waitlist or availability message cannot proceed without a current matching grant;
- purpose withdrawal and global unsubscribe stop consent-bound and marketing delivery;
- marketing withdrawal does not suppress required authentication, purchase, access, refund, dispute, privacy, deletion, or support communication;
- hard bounce, complaint, or provider suppression stops automatic marketing and nonessential operational delivery;
- a required message affected by hard bounce, complaint, or provider suppression moves to manual escalation instead of being reported as delivered;
- unknown consent or suppression states fail closed.

The caller must supply current consent and suppression state at dispatch time. A stale grant embedded in an old event is not sufficient.

## Outbox state decisions

`resolveLaunchEmailDispatchDecision()` verifies that the persisted row still matches the prepared immutable intent before making a delivery decision.

Before resolving, the dispatcher reloads the authoritative row from the database. Every state mutation uses the row ID, expected status, and expected attempt count as a compare-and-set boundary. A concurrent worker or callback therefore wins cleanly; the losing caller stops before provider delivery and reports `OUTBOX_STATE_CONFLICT`.

The resolver:

- completes an already delivered row;
- waits for callbacks after provider acceptance;
- refuses automatic resend of terminal, cancelled, mismatched, or unknown state;
- respects `next_attempt_at`;
- applies the message-specific retry ceiling and stale-state limit;
- permits a bounded provider-idempotent retry while an uncorrelated `sending` row is still inside the 23-hour provider window;
- requires manual reconciliation after the provider idempotency window expires;
- keeps required-message escalation separate from marketing suppression.

## Durable enqueue

`enqueueLaunchEmailIntent()` inserts the outbox row before provider delivery and resolves an idempotency conflict by reloading and verifying the existing immutable row.

Activation controls:

- `EMAIL_READINESS_LEDGER_ENABLED=true` is required for any outbox write;
- non-Production writes must target canonical Development project `ycstrcvshdluovtuasjc`;
- Production writes require `EMAIL_READINESS_PRODUCTION_APPROVED=true` and canonical Production project `gjzetjugmnwanvjkchux`;
- browser roles remain unable to write the backend-only outbox;
- the function uses the existing server-side Supabase secret boundary;
- disabled mode performs no database request.

Production currently does not contain the email migrations or outbox tables. This module must therefore remain dormant in Production until the separately reviewed database gate passes.

## Provider adapter execution

`dispatchEnqueuedLaunchEmail()` accepts an injected adapter with this minimum interface:

```text
{
  id: "provider_identifier",
  send(message) -> {
    state: "accepted",
    messageRef: "bounded_provider_reference",
    occurredAt?: "ISO-8601 timestamp"
  }
}
```

The provider-neutral message contains:

- normalized recipient;
- deterministic subject, plain text, and mobile-safe HTML;
- approved one-click unsubscribe headers where required;
- stable provider idempotency key;
- message classification and template version.

The adapter is responsible for its reviewed sender identity, reply-to route, credentials, API request, and provider-specific error mapping. No adapter or sender is registered by this source change.

Additional delivery controls:

- `LAUNCH_EMAIL_DISPATCH_ENABLED=true` is required before any adapter call;
- Production additionally requires `LAUNCH_EMAIL_PRODUCTION_APPROVED=true`;
- rendering occurs before the outbox enters `sending`, so a missing unsubscribe URL fails without consuming an attempt;
- an accepted result persists the provider message reference; delivered and other terminal outcomes remain signed-callback state;
- a retryable provider failure schedules the next message-policy delay;
- ambiguous provider acceptance remains `sending` and requires reconciliation rather than an unsafe duplicate send;
- terminal provider states fail closed and preserve the audit trail;
- signed provider callbacks remain the only authoritative path for monotonic delivered, bounce, complaint, failed, and suppression transitions.

## Testing requirements

Mandatory regression coverage must prove:

- `auth_sign_in` cannot enter the application outbox;
- shared provider-owned messages remain blocked before responsibility approval;
- unknown template, classification, provider boundary, consent state, or suppression state fails closed;
- lifecycle payloads remain empty and sensitive fields cannot enter the outbox;
- customer-facing references do not expose raw business-object identity;
- duplicate business state produces one intent and one provider idempotency key;
- withdrawn consent blocks availability delivery;
- marketing withdrawal does not block required account communication;
- retry, stale, accepted, delivered, terminal, and ambiguous states resolve correctly;
- disabled ledger and dispatch modes perform no database or provider action;
- Production requires both the existing ledger approval and a separate dispatch approval;
- provider failure records bounded retry or reconciliation state rather than claiming success;
- a concurrent state change fails with `OUTBOX_STATE_CONFLICT` before the adapter is called.

## Business-event wiring order

After this source and CI layer is reviewed, wire events in this order:

1. privacy export acknowledgement only after a durable privacy-request identity exists;
2. account deletion requested and completed from authoritative account state;
3. support acknowledgement from a durable support-case identity;
4. purchase access ready, refund, dispute, chargeback, and reversal from verified commerce and entitlement events;
5. purchase pending and failure only after Issue #53 assigns provider responsibility;
6. book availability only under current purpose-specific consent and signed unsubscribe generation.

Do not invent event IDs from browser redirects or transient request timestamps. Every enqueue must an immutable durable business-state identity and version.

## Release boundary

This module completes a provider-neutral source and CI foundation. It does not close Issue #130 by itself.

Still required:

- real business-event wiring;
- provider responsibility mapping under Issue #53;
- controlled Development enqueue and adapter proof for representative application-owned messages;
- mailbox rendering and placement checks;
- Production Supabase Auth verification;
- separately approved Production migration;
- one controlled Production delivery and callback lifecycle;
- the integrated Issue #54 Library Pass rehearsal.

Public checkout remains disabled until the full release gate is verified.
