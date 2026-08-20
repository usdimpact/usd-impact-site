# USD Impact Support Mailbox Runbook

## Status

Operational version: `2026-08-20.v1`

Public support address: `support@usd-impact.com`

Business entity: SC Kela Leads SRL

Technical route status: **VERIFIED** on 20 August 2026.

The controlled verification established:

- inbound mail was received through the owned support route;
- an operator-controlled reply was sent as `support@usd-impact.com`;
- the reply reached the monitored destination;
- the test contained no customer information, payment data, credentials, or secrets.

This runbook converts that technical result into an operating process for Library Pass launch readiness. It does not activate checkout, select a commerce provider, change DNS, authorize a Production database migration, or permit customer-data testing.

## Ownership

| Responsibility | Assignment |
|---|---|
| Accountable owner | Mircea Albulescu, USD Impact owner/operator |
| Operating business | SC Kela Leads SRL |
| Primary queue | `support@usd-impact.com` |
| Primary operating role | USD Impact support operations |
| Backup operating role | SC Kela Leads SRL authorized administrator |
| Incident escalation | USD Impact owner/operator |
| Privacy escalation | USD Impact privacy operations |
| Commerce escalation | USD Impact commerce operations after replacement-provider selection |

The backup role is approved, but the individual backup account holder must be recorded before public Library Pass activation. The backup must use an individually controlled account; a shared password is not an acceptable substitute.

## Service target

During the Library Pass launch window:

- acknowledge launch-critical support within one business day;
- triage payment, access, privacy, security, deletion, refund, dispute, chargeback, or entitlement incidents the same business day when received during monitored hours;
- do not promise a resolution time until the responsible system and evidence are known;
- preserve a clear status for every unresolved critical case: `received`, `investigating`, `waiting_on_customer`, `waiting_on_provider`, `resolved`, or `closed`.

These are operational targets, not guaranteed outcomes or a representation of continuous 24-hour staffing.

## Message classification

Classify each case before acting:

| Class | Examples | Initial owner | Escalation |
|---|---|---|---|
| Access | sign-in, entitlement, protected book, audiobook, video, downloads | Support operations | Authentication or entitlement owner |
| Commerce | checkout, payment pending, duplicate charge, refund, dispute, chargeback | Support operations | Commerce operations |
| Privacy | export, deletion, correction, consent withdrawal | Privacy operations | USD Impact owner/operator |
| Security | suspected compromise, phishing, exposed token, unauthorized access | Incident owner | USD Impact owner/operator |
| Product | content availability, progress, quiz, playback, broken resource | Support operations | Product/engineering owner |
| General | non-critical educational or product question | Support operations | None unless risk changes |

A case that spans several classes must use the highest-risk class. Security and privacy override routine product classification.

## Intake procedure

For every launch-critical message:

1. Record receipt time in UTC.
2. Assign the case class and owner.
3. Acknowledge receipt without admitting fault, promising reimbursement, or making unsupported technical claims.
4. Request only the minimum information needed.
5. Record the affected product and state without copying unnecessary personal data.
6. Link the case to the relevant durable system record when available.
7. Escalate before changing entitlement, refund, privacy, authentication, or suppression state.
8. Record the final action, evidence source, approver, and closure time.

## Information that may be requested

Use the minimum necessary information, such as:

- account email address;
- approximate event time and timezone;
- order or provider reference already visible to the customer;
- affected product or protected resource;
- browser/device category and a concise error description;
- whether the issue is ongoing.

Do not request or accept through ordinary support email:

- full payment-card data or security codes;
- passwords, one-time passwords, recovery codes, API keys, or private keys;
- complete magic links or authentication tokens;
- full identity documents unless a separately approved process requires them;
- private learning answers or unnecessary account exports;
- provider webhook secrets;
- database credentials;
- sensitive logs containing another person’s data.

When a customer sends prohibited information without being asked, minimize further distribution, preserve only the evidence required for incident handling, and escalate to the privacy or security owner.

## Required support boundaries

Support may:

- explain the current status of a case;
- guide a customer through the approved authentication or account workflow;
- confirm whether a verified entitlement state is active, suspended, revoked, or pending;
- initiate an approved escalation;
- communicate the result of an approved refund, access, privacy, or deletion action.

Support must not:

- grant Library Pass access from a browser redirect, screenshot, email assertion, or unverified payment message;
- manually override a payment dispute, chargeback, suppression, or account-deletion state without the responsible system record and approval;
- resend a marketing message after withdrawal or provider suppression;
- disclose internal credentials, private storage URLs, webhook payloads, or security-control details;
- promise investment results or provide individualized investment advice.

## Escalation rules

Escalate immediately when any of the following occurs:

- a sign-in or access failure affects several users;
- protected content is publicly reachable or a signed URL appears permanent;
- a payment, refund, dispute, chargeback, or entitlement state conflicts with the durable record;
- an email is accepted by the provider but lacks durable correlation;
- a required message hard-bounces, is complained about, or is provider-suppressed;
- a privacy export or deletion request cannot be completed through the approved workflow;
- an authentication token, credential, personal-data export, or payment secret is disclosed;
- the mailbox route, forwarding, or reply identity is unavailable;
- the operator cannot determine which system is authoritative.

Do not report ambiguous provider acceptance as successful delivery. Do not silently resend after the provider idempotency window. Preserve the evidence and move the case to manual reconciliation.

## Mailbox outage procedure

If inbound receiving or reply-as-support fails:

1. Confirm the failure from an external sender and a monitored destination.
2. Check mailbox, forwarding, local delivery, quota, spam filtering, and domain mail routing.
3. Escalate to the hosting/mail provider and the USD Impact owner/operator.
4. Record the incident start time, affected functions, provider ticket, and last known healthy test.
5. Keep public checkout disabled before launch until the support route is restored and retested.
6. After launch, pause new paid activation when the support route cannot meet the launch-critical service target and no approved alternate route is available.
7. Do not revoke valid existing access solely because the support mailbox is unavailable.
8. Restore the route, run inbound and outbound verification, and record the recovery evidence before closing the incident.

## Account access and recovery controls

Before Library Pass activation, verify and record:

- the primary operator has individually controlled mailbox access;
- the named backup has separate access or a tested delegated route;
- multi-factor authentication is enabled where the provider supports it;
- recovery methods are current and controlled by SC Kela Leads SRL;
- provider account recovery does not depend on one unavailable device or one person’s memory;
- mailbox forwarding and reply identity can be reconstructed from documented settings;
- DNS and mail-routing records are inventoried without storing provider secrets in GitHub;
- recovery is tested with a controlled message after any material provider or DNS change.

Do not store mailbox passwords, recovery codes, API keys, or signing secrets in this repository.

## Retention

Default support retention:

- support correspondence: 24 months after closure;
- delivery metadata associated with support acknowledgement: 24 months;
- evidence/source record: 24 months unless a documented legal, accounting, fraud, dispute, security, or privacy hold applies.

Apply data minimization:

- remove unnecessary payload content before deleting the source business record;
- keep bounded identifiers and state needed for audit, deduplication, incident response, or a documented hold;
- do not use email as the sole purchase, entitlement, refund, privacy, consent, or deletion record;
- do not retain raw card data, credentials, authentication tokens, full magic links, private learning answers, or account-export payloads in ordinary mailbox records.

## Verification procedure

Run this procedure before launch, after a provider/DNS change, and after mailbox recovery:

1. Send one controlled external message to `support@usd-impact.com`.
2. Confirm receipt in the monitored operating queue.
3. Reply as `support@usd-impact.com` to the controlled sender.
4. Confirm the reply arrives and passes expected authentication checks.
5. Confirm no catch-all behavior was introduced.
6. Record UTC time, sender category, receiving result, reply result, responsible operator, and any provider ticket.
7. Do not include customer data, credentials, payment information, or secrets in the test.

## Launch checklist

- [x] Inbound receipt technically verified.
- [x] Reply-as-support technically verified.
- [x] Accountable owner recorded.
- [x] Primary operating role recorded.
- [x] Response and triage targets recorded.
- [x] Escalation classes recorded.
- [x] Retention default recorded.
- [x] Sensitive-data handling rule recorded.
- [x] Mailbox outage rule recorded.
- [ ] Named backup individual recorded.
- [ ] Backup access or delegated route tested.
- [ ] Mailbox account-recovery procedure tested.
- [ ] Final pre-launch inbound/reply verification recorded.

## Related controls

- `email-operations-policy.md`
- `email-readiness-release-gate.md`
- `email-readiness-evidence-2026-08-20.md`
- GitHub Issue #130
- GitHub Issue #54

This runbook closes the technical support-route uncertainty. It does not close Production authentication delivery, Production email migration, commerce-provider responsibility mapping, or the integrated Library Pass release rehearsal.