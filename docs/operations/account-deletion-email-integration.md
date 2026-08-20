# USD Impact Account Deletion Email Integration

## Status

Source integration version: `2026-08-20.v1`

Application entrypoint: `apps/web/api/account.js`

Business-event adapter: `apps/web/src/lib/account-deletion-email.js`

This integration records the application-owned `account_deletion_requested` notification intent after the authenticated account-deletion RPC has durably moved the profile into `deletion_pending`. It is dormant when the email ledger is disabled and does not activate a delivery provider, change Supabase Auth, apply a Production migration, send email, or alter the deletion result.

## Authoritative event

The source event is the successful result of `request_account_deletion()`:

- the authenticated Supabase user is verified;
- the returned profile belongs to the same account;
- the profile email matches the verified account email;
- profile status is `deletion_pending`;
- `deletion_requested_at` is present;
- `deletion_due_at` follows the request timestamp.

The browser request, redirect, or response body is not treated as proof of the deletion state.

## Durable notification identity

The notification uses:

- message ID: `account_deletion_requested`;
- business-object type: `account_deletion_request`;
- business-object ID: the backend-only Supabase account UUID;
- state version: the deletion-request minute derived from the durable `deletion_requested_at` timestamp;
- recipient: the normalized verified account email;
- payload: empty `{}`;
- consent: not applicable.

The state version remains inside the PostgreSQL integer range, deduplicates an exact replay of the same deletion request, and changes if a later authoritative deletion request is ever created for the account.

The customer-facing email contains only the existing opaque USD Impact reference derived by the provider-neutral dispatch layer. It does not expose the account UUID, privacy-request data, authentication tokens, complete links, export payloads, provider secrets, or payment data.

## Application behavior

After the deletion RPC succeeds, `account.js` attempts to enqueue the durable notification intent.

Important boundary:

- failure to record the acknowledgement must not reverse or conceal a valid account-deletion request;
- the customer still receives the successful `202` deletion response;
- the application logs only a bounded error code for operational reconciliation;
- no provider adapter is called from the account request path;
- delivery remains a separate controlled worker/provider step.

This preserves the account-rights action as the source of truth while making notification failure observable.

## Activation controls

The existing launch-email controls remain authoritative:

- `EMAIL_READINESS_LEDGER_ENABLED=true` is required before any outbox write;
- non-Production writes must target canonical Development project `ycstrcvshdluovtuasjc`;
- Production writes require the separately approved Production ledger gate and canonical Production project;
- `LAUNCH_EMAIL_DISPATCH_ENABLED=true` is required before any injected provider adapter can run;
- Production delivery additionally requires `LAUNCH_EMAIL_PRODUCTION_APPROVED=true`.

Production currently has no approved email migration or delivery activation. The deployed source therefore remains fail-closed and dormant there.

## Verification coverage

Mandatory tests prove:

- durable account, email, status, and timestamp validation;
- deterministic duplicate outbox and provider idempotency identities;
- a later durable deletion timestamp creates a different state identity;
- the minimized outbox row has no consent dependency and an empty payload;
- disabled mode performs no database request;
- canonical Development enqueue uses the reviewed outbox contract;
- an injected Development adapter receives the approved rendered message and stable idempotency key;
- the rendered body does not expose the account UUID;
- accepted provider correlation is persisted;
- replay after provider acceptance does not invoke the adapter again;
- `account.js` wires the enqueue after the successful deletion RPC;
- the account request path does not perform inline provider delivery.

## Remaining evidence

This source and CI integration does not complete Issue #130. Still required:

1. one controlled non-customer Development deletion-state fixture or approved equivalent that creates the expected outbox row;
2. controlled Development delivery through the reviewed provider adapter after explicit approval;
3. representative mailbox rendering and placement review;
4. account-deletion-completed event wiring from an authoritative completion state;
5. Production Supabase Auth proof;
6. separately approved Production email migrations and post-apply security verification;
7. one controlled Production delivery and callback lifecycle;
8. the integrated Issue #54 release rehearsal.

Public checkout remains disabled.
