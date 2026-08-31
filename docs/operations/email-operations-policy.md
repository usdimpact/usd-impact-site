# USD Impact Email Operations Policy

## Status

Policy version: `2026-08-20.v2`

This document is the operational companion to `email-readiness-release-gate.md` and the machine-readable contract in `apps/web/src/lib/email-operations-policy.js`.

It defines launch-message ownership, classification, bounded retries, suppression behavior, retention defaults, and escalation. It does not activate any provider, change DNS, expose a secret, authorize a Production migration, or open checkout.

The retention periods below are internal operational defaults for data minimization and incident recovery. They are not presented as statutory minimums. A documented legal, accounting, fraud, dispute, or privacy hold may override ordinary deletion; the reason, approver, scope, and review date must be recorded.

Current evidence is recorded in:

- `email-readiness-evidence-2026-08-20.md`;
- `support-mailbox-runbook.md`;
- GitHub Issue #130.

## Ownership

| Area | Business entity | Primary operational owner | Backup | Escalation |
|---|---|---|---|---|
| Authentication email | KELA LEADS S.R.L. | USD Impact owner/operator | KELA LEADS S.R.L. authorized administrator | USD Impact incident owner |
| Purchase, entitlement, refund and dispute email | KELA LEADS S.R.L. | USD Impact commerce operations | KELA LEADS S.R.L. authorized administrator | USD Impact incident owner |
| Support mailbox | KELA LEADS S.R.L. | Mircea Albulescu, USD Impact owner/operator | KELA LEADS S.R.L. authorized administrator | USD Impact owner/operator |
| Privacy and account-rights email | KELA LEADS S.R.L. | USD Impact privacy operations | KELA LEADS S.R.L. authorized administrator | USD Impact owner/operator |
| Waitlist and marketing email | KELA LEADS S.R.L. | USD Impact editorial operations | USD Impact owner/operator | USD Impact privacy operations |

Operational requirements:

- `support@usd-impact.com` is the public escalation address for launch-critical customer communication.
- Inbound receipt and reply-as-support were technically verified on 20 August 2026.
- The named backup individual and tested recovery/delegation path remain mandatory before public Library Pass activation.
- Primary and backup access must use individually controlled credentials and supported recovery controls; shared passwords are not an acceptable ownership model.
- Launch-critical support should be acknowledged within one business day during the launch window. A payment, access, privacy, security, or deletion incident should be triaged the same business day when received during monitored hours.
- Unresolved provider acceptance, hard bounce, complaint, suppression, duplicate-event, entitlement, or privacy-state conflicts require manual escalation rather than silent success.
- The detailed mailbox process, outage rule, recovery controls, and verification checklist are in `support-mailbox-runbook.md`.

## Message classification matrix

| Message ID | Classification | System boundary | Consent rule | Retry policy | Retention policy |
|---|---|---|---|---|---|
| `auth_sign_in` | Transactional security | Supabase Auth | Never depends on marketing consent | Security short-lived | Security ephemeral |
| `purchase_pending` | Transactional operational | Shared after provider selection | No marketing consent | Transactional critical | Transactional customer |
| `purchase_access_ready` | Transactional | App-owned after verified event | No marketing consent | Transactional critical | Transactional customer |
| `purchase_failed` | Transactional operational | Shared after provider selection | No marketing consent | Operational standard | Transactional customer |
| `refund_approved` | Transactional | App-owned after verified event | No marketing consent | Transactional critical | Transactional customer |
| `dispute_warning` | Transactional operational | App-owned after verified event | No marketing consent | Transactional critical | Transactional customer |
| `chargeback_revoked` | Transactional | App-owned after verified event | No marketing consent | Transactional critical | Transactional customer |
| `dispute_reversal_restored` | Transactional | App-owned after verified event | No marketing consent | Transactional critical | Transactional customer |
| `privacy_export_acknowledgement` | Transactional operational | App-owned | No marketing consent; export payload prohibited in ordinary email | Transactional critical | Privacy request |
| `account_deletion_requested` | Transactional operational | App-owned | No marketing consent | Transactional critical | Privacy request |
| `account_deletion_completed` | Transactional operational | App-owned | No marketing consent | Transactional critical | Privacy request |
| `support_case_received` | Operational | App-owned | No marketing consent | Operational standard | Support case |
| `waitlist_confirmation` | Operational, consent-bound | App-owned | Requires current `book_availability` grant and includes unsubscribe | Operational standard | Consent and marketing |
| `book_availability` | Marketing | App-owned | Requires current `book_availability` grant before every attempt and includes unsubscribe | Marketing consented | Consent and marketing |

Provider receipts do not replace USD Impact messages that explain account access, entitlement changes, privacy rights, support, or exceptional states. Responsibilities must be reconciled with the selected commerce provider before #53 can pass.

## Retry policy

Retries are bounded. The attempt count includes the first delivery attempt.

| Policy | Maximum attempts | Delays from message eligibility | Stale after | Exhaustion behavior |
|---|---:|---|---:|---|
| Security short-lived | 2 | immediately, 60 seconds | 10 minutes | Manual escalation or a fresh user-initiated authentication request; never send an expired link |
| Transactional critical | 5 | immediately, 1 minute, 5 minutes, 30 minutes, 2 hours | 24 hours | Manual escalation |
| Operational standard | 4 | immediately, 5 minutes, 30 minutes, 2 hours | 24 hours | Manual escalation |
| Marketing consented | 2 | immediately, 30 minutes | 24 hours | Terminal failure without manual resend; consent must be rechecked before each attempt |

Rules:

- Provider acceptance without durable correlation is ambiguous and requires reconciliation; it must not be reported as delivered or automatically resent after the provider idempotency window.
- A signed lifecycle callback that arrives before `provider_message_ref` exists must be retained as retryable evidence and return a retryable failure. It must not be marked permanently ignored.
- A replay after correlation must reuse the existing provider receipt, increment the attempt count, apply at most one monotonic transition, and clear the transient correlation error.
- A delivered event is terminal.
- A hard bounce, complaint, or provider suppression is terminal for marketing and nonessential operational delivery.
- Required transactional or security mail that cannot be delivered moves to manual support escalation; marketing consent must not be used to decide whether required mail is attempted.
- No message path may use an unbounded loop, indefinite queue, or silent retry beyond its stale boundary.

## Suppression and withdrawal

| State | Marketing | Operational | Required transactional/security |
|---|---|---|---|
| Purpose-specific withdrawal | Stop the withdrawn purpose | Continue when independently required | Continue |
| Global marketing unsubscribe | Stop all marketing | Continue when independently required | Continue |
| Hard bounce | Stop | Stop nonessential delivery | Manual escalation and alternate verified contact/support route where appropriate |
| Complaint | Stop | Stop nonessential delivery | Manual escalation; do not override provider suppression automatically |
| Provider suppression | Stop | Stop nonessential delivery | Manual escalation and reconciliation |

A marketing withdrawal or unsubscribe must never disable sign-in, security, purchase, entitlement, refund, privacy-export, deletion, or required account communication.

## Retention defaults

| Record class | Notification payload | Delivery metadata | Evidence/source record |
|---|---:|---:|---:|
| Security authentication | 7 days | 90 days | 90 days; Supabase Auth remains the source of truth |
| Purchase, entitlement, refund and dispute | 30 days | 24 months | 24 months in the email layer; commerce/accounting records follow their separately approved retention |
| General operational customer messages | 30 days | 12 months | 12 months |
| Support correspondence | 24 months after closure | 24 months | 24 months unless a documented hold applies |
| Privacy and deletion acknowledgement | 90 days | 36 months | 36 months; the actual export must not be placed in ordinary email |
| Consent, withdrawal and marketing suppression | 30 days | 12 months | 36 months after withdrawal or retirement of the purpose, using the minimum evidence required |

Deletion rules:

- Clear or minimize message payloads before deleting the underlying business record.
- Do not use email or provider logs as the sole purchase, entitlement, refund, support, privacy, or consent record.
- Retain only bounded identifiers and delivery state required for deduplication, suppression, audit, incident response, or a documented hold.
- Never retain raw card data, provider secrets, authentication tokens, full magic links, private learning answers, or export payloads in message payloads or logs.

## Release enforcement

The machine-readable policy is validated during the standard Supabase/quality gate. Validation fails when:

- a launch-critical message is missing or an unapproved message appears;
- a message has no owner, retry policy, or retention policy;
- marketing lacks consent and unsubscribe requirements;
- required mail is incorrectly tied to a marketing purpose;
- retry attempts exceed five or a retry schedule is malformed;
- retention defaults exceed the approved three-year email-evidence ceiling;
- global unsubscribe is configured to suppress required transactional/security communication.

The controlled Development evidence has additionally verified:

- consent-bound waitlist and book-availability outbox contracts;
- delivered, hard-bounced, complained, and suppressed provider states;
- retry after callback/correlation ordering;
- duplicate-event idempotency;
- invalid-signature rejection;
- temporary test-surface rollback.

## Remaining external gates

This policy closes the internal ownership/classification design gap, the technical support-route uncertainty, and the controlled Development provider-lifecycle gate. It does not close:

1. named backup support operator, tested delegated access, and mailbox account-recovery drill;
2. final Production Supabase Auth sender, template, Site URL, `/auth/confirm/` redirect, valid-link, expired/invalid-link, and neutral-response proof;
3. real business-event enqueue for remaining purchase, access, refund, dispute, privacy, deletion, and support messages;
4. Production migration, post-apply security verification, and rollback evidence;
5. provider-specific purchase/refund/dispute responsibility mapping after #53 selects a provider;
6. controlled Production delivery and callback proof;
7. the full Issue #54 integrated Library Pass rehearsal.

Until those gates pass, Issue #130 remains `RELEASE BLOCKED` and public checkout remains disabled.