# USD Impact Email Readiness Evidence — 20 August 2026

## Purpose and precedence

This evidence record updates the observed status of the controls defined in:

- `email-readiness-release-gate.md`;
- `email-operations-policy.md`;
- `waitlist-development-lifecycle-verification.md`;
- GitHub Issue #130.

Where an earlier 20 August 2026 baseline says that support receiving or the Development Resend lifecycle is unverified, this evidence record is the later verified state.

This document records evidence only. It does not authorize Production Supabase changes, Production Resend activation, checkout, a payment-provider adapter, customer testing, or public Library Pass activation.

## Executive decision

| Gate | Decision |
|---|---|
| Support inbound receiving | PASS |
| Support reply-as-owned-route | PASS |
| Development consent/outbox schema | PASS |
| Consent-bound waitlist contract | PASS |
| Development provider correlation | PASS |
| Signed provider callback verification | PASS |
| Callback retry after correlation race | PASS |
| Delivered terminal state | PASS |
| Hard-bounce terminal state | PASS |
| Complaint terminal state | PASS |
| Provider-suppression terminal state | PASS |
| Duplicate callback idempotency | PASS |
| Invalid-signature rejection | PASS |
| Temporary test-surface cleanup | PASS |
| Production Supabase Auth proof | OPEN |
| Production email migration | OPEN |
| Commerce-triggered message integration | BLOCKED BY PROVIDER SELECTION |
| Controlled Production email delivery | OPEN |

Issue #130 remains open because the Development and support evidence does not substitute for controlled Production authentication and Production delivery proof.

## Support route evidence

The controlled mailbox thread established:

- inbound receipt through `support@usd-impact.com`;
- an operator-controlled reply sent as `support@usd-impact.com`;
- receipt of the owned reply by the monitored destination;
- no customer information, payment data, credentials, or secrets in the test.

The support operating process is defined in `support-mailbox-runbook.md`.

Remaining support operations:

- record the named backup individual;
- test backup or delegated access;
- test mailbox account recovery;
- repeat the inbound/reply test immediately before launch or after a material mail/DNS change.

## Source and deployment evidence

### PR #190 — consent-bound launch outbox

Merged commit:

`76ba36e9a78985ab85df20d125e910c0f7f8f04f`

The release:

- expanded the durable notification allowlist to application-owned Library Pass lifecycle templates;
- kept `auth_sign_in` provider-managed and outside the application outbox;
- required `waitlist_confirmation` and `book_availability` to reference current `book_availability` consent;
- kept required authentication, access, refund, dispute, privacy, deletion, and support messages independent of marketing withdrawal;
- added source, migration, handler, unsubscribe, and database regression coverage.

Pre-merge evidence recorded on the PR:

- exact-head Web Quality passed;
- exact-head Vercel Preview was READY;
- no unresolved review thread remained;
- the proposed Development constraint passed positive and negative transaction tests with zero retained validation rows.

### PR #192 — correlation-race recovery

Merged commit:

`39db647ae49f33dc3427508d451f7c349c0caf08`

The release corrected a real provider-ordering defect found by the controlled Development test:

- a tracked callback without a persisted `provider_message_ref` is no longer permanently ignored;
- the receipt is retained in a retryable failure state;
- the endpoint returns HTTP 503 with a bounded retry signal;
- a later replay reopens the receipt and applies the monotonic transition after correlation exists;
- an untracked event remains ignored;
- regression coverage for the race is mandatory in Web Quality.

The resulting Vercel Production deployment reached READY. Production Resend webhook processing remained disabled.

## Development migration evidence

Canonical Development project:

`ycstrcvshdluovtuasjc`

Canonical Production project:

`gjzetjugmnwanvjkchux`

Development migration history was reconciled to:

- `20260819001529_restore_learning_progress_writes`;
- `20260819215648_email_consent_outbox_contracts`;
- `20260820111237_expand_launch_email_outbox_contracts`.

Production intentionally did not receive the email migrations during this evidence run.

Post-reconciliation verification established:

- `marketing_consent_events` and `notification_outbox` exist only where expected;
- RLS remains enabled;
- browser-role grants were not introduced;
- consent-bound rows require a complete consent reference and fresh consent-check timestamp;
- required non-marketing messages require empty consent columns;
- unapproved template/classification combinations are rejected;
- sensitive extra payload fields are rejected;
- `auth_sign_in` is rejected from the application outbox;
- the canonical migration contract is present;
- zero transaction-validation rows were retained.

## Real provider lifecycle evidence

The controlled test used non-customer Resend test addresses and consent-bound Development outbox records.

| Scenario | Provider result | Final outbox status | Error code |
|---|---|---|---|
| Normal delivery | Delivered | `delivered` | none |
| Hard bounce | Bounced | `hard_bounced` | `RESEND_HARD_BOUNCE` |
| Complaint | Complained | `complained` | `RESEND_COMPLAINT` |
| Provider suppression | Suppressed | `suppressed` | `RESEND_SUPPRESSED` |

Every final row retained:

- `consent_required = true`;
- consent purpose `book_availability`;
- a matching consent-record reference;
- a provider-message reference;
- one application send attempt;
- the expected terminal timestamp and error state.

No customer address, payment record, authentication link, credential, or secret was used as test data.

## Callback-ordering and retry evidence

The provider emitted signed lifecycle callbacks before the application had persisted the returned provider message ID.

Observed first phase:

- callback signature and payload were accepted;
- no outbox row could yet be matched by provider ID;
- receipt status became `failed`;
- error became `OUTBOX_CORRELATION_PENDING`;
- callback attempt count reached 2;
- no incorrect terminal transition was applied.

After provider correlation was persisted, Resend replayed the same events.

Observed reconciliation phase:

- corresponding receipts reached `processed`;
- attempt count reached 3;
- `last_error` cleared;
- delivered, hard-bounced, complained, and suppressed outbox states were applied;
- no duplicate notification or state regression was created.

This is the real-provider proof for the retry behavior introduced by PR #192.

## Deterministic security and idempotency replay

A bounded signed replay against the isolated Development receiver established:

- valid delivered event: HTTP 200;
- valid bounced event: HTTP 200;
- valid complained event: HTTP 200;
- valid suppressed event: HTTP 200;
- duplicate replay: HTTP 200 with `duplicate: true`;
- invalid signature: HTTP 400 with `INVALID_SIGNATURE`;
- no receipt created for the invalid-signature event.

The deterministic replay was used only to prove signature rejection and idempotency after the real provider events had established delivery-state behavior.

## Cleanup evidence

After verification:

- the Development Resend webhook was disabled;
- the temporary receiver was replaced with an inert 404 implementation and JWT verification enabled;
- the temporary replay function was replaced with an inert 404 implementation and JWT verification enabled;
- the temporary private payload table was removed;
- the temporary Vault secret was absent;
- draft PR #191 was closed without merge;
- Production database state was not changed;
- Production Resend processing was not enabled;
- checkout and payment-provider state were not changed;
- no customer data was introduced.

## Security-advisor review

The Development advisor output after the migration and test retained only known items:

- INFO notices for backend-only RLS tables without browser policies;
- the reviewed intentional warning for the authenticated account-deletion function;
- the existing leaked-password-protection warning, which is not a substitute for testing the passwordless authentication path.

No new warning attributable to the launch-email migration was introduced.

## Gates now closed

The evidence closes these Issue #130 sub-gates:

- support inbound receipt;
- support reply-as-owned-route;
- Development migration and consent-bound outbox contract;
- real provider acceptance and provider-message correlation;
- real signed delivered callback;
- real bounce, complaint, and suppression terminal handling;
- callback retry after correlation ordering;
- duplicate callback idempotency;
- invalid-signature rejection;
- Development test-surface rollback.

## Gates still open

1. **Support resilience**
   - named backup individual;
   - tested backup/delegated access;
   - tested mailbox account recovery;
   - final pre-launch route verification.

2. **Production Supabase Auth**
   - approved branded sender;
   - reviewed template;
   - canonical Site URL;
   - `/auth/confirm/` redirect;
   - valid-link success;
   - expired/invalid-link safe failure;
   - neutral response that does not reveal account existence.

3. **Application-owned lifecycle integration**
   - real business-event enqueue for purchase, access-ready, failure, refund, dispute, chargeback/reversal, privacy export, deletion, and support acknowledgement;
   - responsibility mapping after Issue #53 selects the replacement commerce provider.

4. **Production migration and delivery**
   - separate review and approval;
   - exact migration provenance;
   - post-apply security verification;
   - one controlled Production delivery;
   - Production callback and rollback evidence.

5. **Integrated release rehearsal**
   - Issue #54 account-state, protected-content, privacy, support, accessibility, and rollback matrix.

## Release decision

**Issue #130: OPEN — materially advanced.**

**Development provider lifecycle: PASS.**

**Technical support route: PASS.**

**Production email release: BLOCKED.**

**Public checkout: DISABLED.**