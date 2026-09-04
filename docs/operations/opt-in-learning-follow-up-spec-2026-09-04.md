# Opt-in learning follow-up design — disabled

Status: **design complete; sending not activated**

Message classification: marketing/product education

Default: no enrollment, no outbox row, no send

## Purpose

Send at most one helpful message after a defined inactivity period so an opted-in Library Pass learner can resume an unfinished item or explore the next deterministic section. The message must not change access rights, score a user, infer sensitive traits, or promote investments.

## Consent contract

- Separate, unticked opt-in presented after access is granted; never bundled with checkout, Terms acceptance, transactional email, or required account operation.
- Consent purpose: `learning_follow_up`.
- Record only consent ID, account ID, purpose, status, captured timestamp, source surface/version, policy version, and withdrawal timestamp when applicable.
- Withdrawal is available from Account and a one-click unsubscribe link in every message.
- A global marketing unsubscribe and provider complaint/hard-bounce suppression always override consent.

## Deterministic eligibility rule

Evaluate once when both conditions hold: the learner opted in and no governed learning progress has changed for 14 complete days. Select the action using the existing deterministic next-section map and server-owned progress. Suppress if activity changed within the last 14 days, access is inactive, consent is absent/withdrawn, the account is deletion-pending, a suppression exists, or the same lifecycle instance was already queued/sent.

Audiobook position currently stored only on-device may supply an in-product resume action but must not be copied into the email ledger or treated as server-owned activity.

## Data minimization and retention

Permitted evaluation fields: account ID, normalized delivery address at dispatch, entitlement state, consent ID/status/purpose, latest governed progress timestamp, deterministic next-step kind/content ID, outbox identity/status, and suppression state. Do not store raw viewing history, quiz answers, email content, private URLs, signed tokens, IP addresses, device fingerprints, or behavioral profiles in the message payload.

- Eligibility snapshot and minimized outbox metadata: retain 90 days after terminal delivery/suppression, unless an approved legal or dispute hold applies.
- Consent and withdrawal proof: retain for the legal/policy period approved by the privacy owner.
- Provider delivery identifiers: retain only as long as required for bounce/complaint reconciliation and the same approved policy period.
- Account deletion must remove or irreversibly unlink learning-progress data and cancel queued follow-ups; retain only legally required consent/suppression proof.

## Cadence and content

- Inactivity threshold: 14 complete days.
- Frequency cap: one learning follow-up per entitlement lifetime in v1; no recurring series.
- Message actions: one Resume deep link and one neutral Explore alternative, plus Account, support, privacy, and unsubscribe.
- No urgency, performance claim, investment prompt, personalized market view, or third-party advertising.

## Activation gates

Activation requires all of the following in a separate approved change: privacy/legal approval of purpose and retention; UI copy approval; database consent/outbox contract; preview tests; active-user suppression test; withdrawal/global-unsubscribe/complaint/hard-bounce tests; deletion cancellation test; idempotency and concurrency test; and a bounded Production deployment approval.

This design adds no message-registry entry, environment flag, schedule, provider webhook, or send path. EMAIL-02 remains disabled.
