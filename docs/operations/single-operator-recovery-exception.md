# USD Impact Single-Operator Recovery Exception

## Status

Governance exception version: `2026-08-21.v1`

Business entity: KELA LEADS S.R.L.

Accountable owner: Mircea Albulescu

Scope: support-mailbox and launch-critical operational recovery for the one-time Library Pass release path.

Decision: **APPROVED FOR SOURCE CONTROL; COMPENSATING CONTROLS MUST BE PROVEN BEFORE LAUNCH**.

This exception intentionally replaces the prior requirement to name and delegate mailbox access to a second human operator. It does not reduce authentication, support, privacy, commerce, entitlement, delivery, or rollback requirements. It does not activate checkout or authorize any Production change.

## Rationale

The owner does not approve granting support-mailbox or recovery access to another person. Recording a fictional backup identity, shared password, shared mailbox credential, or nominal backup who cannot independently recover the account would create false operational evidence and is prohibited.

The accepted alternative is a documented single-operator model with independent owner-controlled recovery mechanisms and fail-closed paid-activation behavior.

## Explicit risk acceptance

The owner accepts the following residual risks:

- operational `bus factor` remains one person;
- support response may be delayed if the owner is incapacitated or cannot reach the required recovery factors;
- there is no human delegate who can lawfully operate the support mailbox in the owner's absence;
- some provider, legal, insurance, banking, or contractual requirements could still require a second authorized person in the future;
- this exception is an internal operational decision and must not be represented as satisfying a third party's separate continuity requirement unless that party confirms it.

These risks are accepted only with the compensating controls below. If the controls cannot be maintained, new paid activation must remain disabled or pause.

## AI recovery coordinator

ChatGPT/OpenAI assistant is recorded as **AI recovery coordinator**, not as a backup operator.

The AI recovery coordinator may:

- maintain and interpret the recovery runbook;
- inspect connected system state when authorized tools are available;
- diagnose likely failure modes;
- produce exact recovery and verification steps;
- prepare source changes, issue evidence, and checklists;
- perform connected actions that the owner explicitly authorizes and that the current environment supports.

The AI recovery coordinator does **not** have and must not be assigned:

- an independent email identity acting as a human administrator;
- a mailbox password or standing mailbox delegation;
- recovery codes, backup codes, private keys, hardware keys, or MFA devices;
- independent access to recovery email or SMS;
- the ability to guarantee action while the owner is unavailable;
- authority to bypass provider recovery controls, rotate secrets without approval, grant entitlement, or activate commerce.

The AI coordinator is therefore not an independent recovery factor and cannot be counted as a second operator for audit, contractual, insurance, banking, or provider requirements.

## Required compensating controls

Before public Library Pass activation, all of the following must be verified:

1. **Separate recovery email** — one dedicated recovery account controlled only by the owner and not implemented merely as a `+alias` of the primary email account.
2. **Independent MFA/recovery factors** — at least two recovery/authentication methods where supported, with one method physically or operationally separate from the everyday device.
3. **Offline recovery material** — provider recovery codes or equivalent material stored under company control outside the primary mailbox, normal browser session, Git repository, and ChatGPT conversation.
4. **Recovery path independence** — the account can enter the provider-supported recovery process without requiring the primary mailbox session, one particular device, or the owner's memory of an undocumented setting.
5. **Configuration inventory** — non-secret mailbox forwarding, reply identity, provider account location, support route, DNS/mail routing, and recovery-contact locations are documented sufficiently to reconstruct operations.
6. **Fail-closed paid activation** — if the owner cannot access support operations or the independent recovery route, new paid activation remains disabled or is paused. Existing valid entitlements are not revoked solely for this reason.
7. **Independent public operations** — public Daily News and other intentionally public educational surfaces are not coupled to support-mailbox recovery unless a separate incident requires it.
8. **Controlled recovery drill** — the owner proves the independent recovery route and completes one inbound/reply support verification before launch and after material mail-provider, DNS, or recovery-method changes.
9. **Secret minimization** — no passwords, MFA codes, recovery codes, complete magic links, private keys, API keys, signing secrets, or recovery tokens are committed to GitHub or pasted into ordinary ChatGPT messages.
10. **Re-review trigger** — the exception is re-reviewed if staffing, transaction volume, contractual obligations, payment-provider requirements, insurance requirements, or operational risk materially increase.

## Required recovery drill evidence

Record only bounded evidence:

- UTC timestamp;
- owner identity/role;
- recovery method category, not secret value;
- whether the separate recovery account was accessible;
- whether the independent MFA/recovery factor was available;
- whether the provider accepted the independent recovery route;
- inbound `support@usd-impact.com` receipt result;
- reply-as-support result;
- PASS/FAIL;
- provider ticket/reference only when needed and non-sensitive.

Do not record passwords, recovery codes, MFA values, complete recovery URLs, private keys, complete authentication links, customer data, or payment information.

## Failure behavior

If any compensating control fails before launch:

- keep checkout/new paid activation disabled;
- do not substitute a shared password or improvised third-party mailbox access;
- repair and retest the recovery control;
- preserve existing valid customer entitlements;
- escalate provider/DNS/mailbox failures through the documented support route;
- record the failure and remediation in the applicable launch issue.

If failure occurs after launch and support continuity cannot meet the launch-critical service target:

- pause new paid activation as soon as safely possible;
- keep existing valid access intact unless a separate entitlement event requires a change;
- restore support/recovery capability and perform the controlled inbound/reply test before resuming paid activation.

## Supersession and revocation

This exception remains in force only while the owner explicitly chooses the single-operator model and the compensating controls remain verified.

It should be superseded by a normal human-continuity model if the owner later appoints a trusted authorized administrator with an individually controlled account and a tested delegated recovery path.

It must be re-reviewed before launch if a payment provider, bank, insurer, regulator, legal adviser, or material contract requires a second human administrator.

## Related controls

- `support-mailbox-runbook.md`
- `email-readiness-release-gate.md`
- GitHub Issue #130
- GitHub Issue #54

This document records an operational exception, not a claim that all business-continuity risk has been eliminated.