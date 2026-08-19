# USD Impact Email, Support, and Consent Release Gate

## Purpose

This runbook is the canonical operational gate for GitHub issue #130: transactional email, support mailbox, consent evidence, and delivery readiness for the Library Pass launch.

It converts scattered source, provider, mailbox, DNS, database, and test evidence into one fail-closed release decision. It does not authorize DNS changes, provider purchases, Production environment changes, database writes, marketing sends, Paddle Live activation, or legal-policy changes.

## Current verified baseline — 2026-08-20

### Application and provider architecture

- Account authentication uses Supabase passwordless email.
- Observed authentication sender: `USD Impact <no-reply@updates.usd-impact.com>`.
- Public book waitlist uses Resend and sends from `book@updates.usd-impact.com`.
- Public policy and product pages use `support@usd-impact.com` as the account, billing, refund, privacy, and support route.
- The repository contains `20260819191131_email_consent_outbox_contracts.sql`, which defines append-only marketing-consent evidence and a durable notification outbox contract. This migration is source-controlled but must not be assumed applied to either database without migration-ledger evidence.

### Deliverability evidence already captured

Prior controlled Gmail-header evidence recorded in issue #130 shows:

- passwordless authentication message: SPF pass, DKIM pass for `updates.usd-impact.com` using selector `resend`, DMARC pass for `usd-impact.com`;
- waitlist confirmation: SPF pass, DKIM pass for `updates.usd-impact.com`, DMARC pass for `usd-impact.com`;
- cPanel-originated `@usd-impact.com` test message: SPF pass, DKIM pass using selector `default`, DMARC pass for `usd-impact.com`;
- observed DMARC policy was monitoring mode (`p=none`), so authentication is verified but enforcement is not asserted.

These checks do not by themselves prove bounce processing, suppression behavior, complaint handling, inbox placement across representative providers, or ongoing sender-domain health.

### Support mailbox evidence

A controlled message was sent to `support@usd-impact.com` on 2026-08-12. The connected Gmail mailbox contains the sent message but no reply in that thread, and no message from `support@usd-impact.com` was found in the inspected recent window.

Therefore support receiving/escalation/response ownership remains **UNVERIFIED**. Do not mark this gate complete until an owner-controlled inbound test produces auditable receipt or reply evidence.

### Database and migration state

Source provenance for the Guided Edition migration stack has been restored to `main`, including `20260819001529_restore_learning_progress_writes.sql`.

A read-only catalog comparison found:

- Development has the intended hardened future `postgres` function defaults;
- Production still exposes broader future-function defaults to API roles;
- current account RPC definitions inspected in Development and Production match for `account_export` and `request_account_deletion`;
- Development has owner-scoped `INSERT` and `UPDATE` policies for `learning_progress`, while Production remains select-only.

`20260805194908_secure_future_public_object_defaults.sql` is present in source but is not safely treated as applied solely from catalog effects. Timestamp-preserving migration-ledger reconciliation is required before any normal migration push.

The connected Supabase MCP `apply_migration` action must not be used to repair this history because it creates its own migration-history entry rather than preserving the repository migration version. Use the official Supabase CLI migration-repair/db-push path with authenticated project access and exact project targeting.

Production remains observation-only until Development reconciliation and validation are complete.

## Gate A — ownership and message classification

Required before launch:

- [ ] Named business owner for authentication email.
- [ ] Named business owner for transactional purchase/entitlement/refund email.
- [ ] Named business owner for marketing/waitlist email.
- [ ] Named owner for `support@usd-impact.com` receiving and escalation.
- [ ] Response-time expectation for launch-critical support is recorded.
- [ ] Retention expectation for support correspondence is recorded.
- [ ] Every message class is explicitly one of: transactional security, transactional operational, operational, or marketing.
- [ ] Marketing consent is never used as a prerequisite for authentication, security, purchase, entitlement, refund, privacy export, or account-deletion communications.

## Gate B — provider and environment inventory

Record names and scopes only. Never commit secret values.

### Supabase/authentication

- [ ] `SUPABASE_URL` present in the required Vercel environments.
- [ ] `SUPABASE_PUBLISHABLE_KEY` present in the required Vercel environments.
- [ ] `SUPABASE_SECRET_KEY` present only where server-side use is required.
- [ ] Production Site URL and approved redirect URLs verified in Supabase Auth.
- [ ] Branded SMTP/sender configuration verified.
- [ ] Authentication rate limits/anti-abuse settings reviewed.

### Resend/waitlist and transactional delivery

- [ ] `RESEND_API_KEY` present server-side only.
- [ ] `RESEND_WAITLIST_SEGMENT_ID` present where waitlist capture runs.
- [ ] `RESEND_FROM_EMAIL` matches an approved verified sender.
- [ ] `RESEND_REPLY_TO` points to an owned, monitored route.
- [ ] Resend domain status is verified.
- [ ] Sender identities are verified.
- [ ] Audience/segment is the intended waitlist segment and contains no unintended imported audience.
- [ ] Suppression, bounce, complaint, and webhook handling are reviewed.
- [ ] Provider logs show no unexplained launch-critical delivery failures.

A connected Resend integration may be used to collect this evidence when its account-action tools are available. Do not paste API keys into issues, PRs, docs, or chat.

## Gate C — domain authentication and receiving

- [x] SPF pass observed for authentication sender.
- [x] DKIM pass observed for `updates.usd-impact.com` authentication sender.
- [x] DMARC pass observed for authentication sender.
- [x] SPF pass observed for waitlist sender.
- [x] DKIM pass observed for waitlist sender.
- [x] DMARC pass observed for waitlist sender.
- [x] SPF/DKIM/DMARC pass observed for the tested `@usd-impact.com` mailbox-originated message.
- [ ] Current DNS/provider state rechecked near launch if records or providers changed after the recorded tests.
- [ ] Return-path/bounce-domain alignment verified.
- [ ] `support@usd-impact.com` inbound receiving verified with a controlled test.
- [ ] Support reply path verified end-to-end.

Do not tighten DMARC enforcement merely to close this gate. A change from monitoring to quarantine/reject is a separate DNS/security decision requiring its own rollout and monitoring plan.

## Gate D — consent and recordkeeping

Source contract requires:

- [ ] Explicit marketing consent is affirmative and not preselected.
- [ ] Consent purpose is specific to the relevant marketing/waitlist use.
- [ ] Consent timestamp is stored.
- [ ] Consent source is stored.
- [ ] Consent-text version is stored.
- [ ] Privacy-notice version is stored.
- [ ] Withdrawal is append-only/auditable rather than destructive.
- [ ] Transactional records remain separate from promotional audience segmentation.
- [ ] Unsubscribe from marketing does not suppress required account/security communication.
- [ ] Retention periods for consent evidence, delivery logs, suppression records, and support correspondence are documented.

Database-backed items are not complete until the corresponding migration is applied and verified in the target environment.

## Gate E — migration sequence for Development

No Production write is authorized by this runbook.

1. Authenticate the Supabase CLI using approved operator credentials; do not expose tokens in logs or chat.
2. Link or target **Development only**: `usd-impact-development` / `ycstrcvshdluovtuasjc`.
3. Run the CLI migration list and compare repository vs remote history.
4. If `20260805194908` is absent from the migration ledger but its schema effects are already present, use the official timestamp-preserving migration-repair mechanism to mark only that exact version as applied after independent review.
5. Re-run migration list. Stop unless repository and remote history now reconcile through the known Development versions.
6. Preview the next push. Stop unless the only intended new migration is `20260819191131_email_consent_outbox_contracts.sql` plus any explicitly reviewed, source-controlled predecessor that is genuinely unapplied.
7. Require a fresh Development backup and a second-person target check.
8. Apply to Development only using the normal timestamp-preserving migration path.
9. Run application validation, security advisors, performance advisors, and targeted lifecycle tests.
10. Record exact migration versions, UTC time, operator, evidence, and results.

If any tool proposes Production, `--include-all`, a replay of historical migration SQL, or an unexpected migration version, stop.

## Gate F — lifecycle tests

All launch-critical paths must be tested in Preview/Development first with controlled non-customer addresses.

- [ ] Passwordless sign-in succeeds.
- [ ] Expired/invalid sign-in link fails safely.
- [ ] Recovery/sign-in request remains neutral and does not reveal account existence.
- [ ] Purchase pending message is correct, if the product flow uses one.
- [ ] Purchase confirmed message is emitted only from verified server-side transaction state.
- [ ] Replayed/duplicate webhook does not create duplicate entitlement or duplicate email.
- [ ] Refund approval produces the intended customer communication and access-state change.
- [ ] Dispute warning behavior is defined and tested.
- [ ] Chargeback communication and entitlement revocation are tested.
- [ ] Eligible dispute reversal is tested.
- [ ] Privacy export acknowledgement contains no private export payload in ordinary email.
- [ ] Account deletion staged/completed states are tested.
- [ ] Bounce handling fails safely.
- [ ] Suppression handling fails safely.
- [ ] Provider outage/retry behavior is bounded and idempotent.
- [ ] Message logs contain no secrets, raw payment-card data, private learning inputs, or unnecessary personal data.

## Gate G — template and rendering QA

For every launch-critical template:

- [ ] Subject and sender identity are unambiguous.
- [ ] Product name and purchase state are accurate.
- [ ] Merchant-of-Record language is accurate where relevant.
- [ ] `support@usd-impact.com` is present where support escalation is appropriate.
- [ ] Privacy language is accurate and minimal.
- [ ] Marketing templates include unsubscribe.
- [ ] Transactional/security messages do not include promotional consent assumptions.
- [ ] Links resolve to the intended HTTPS host.
- [ ] Mobile rendering is reviewed.
- [ ] Representative mailbox placement is tested.
- [ ] No guarantee, urgency manipulation, investment recommendation, or unrelated promotional copy is introduced.

## Gate H — controlled Production proof

Only after Gates A–G pass:

- [ ] Production sender/domain state rechecked.
- [ ] Production environment variable names/scopes verified without exposing values.
- [ ] Controlled Production test recipient approved.
- [ ] Controlled Production send approved explicitly.
- [ ] Authentication test delivered.
- [ ] Transactional purchase/entitlement test delivered, if the production transaction path is authorized.
- [ ] Support inbound/reply test delivered.
- [ ] Provider logs show accepted/delivered state or an understood terminal state.
- [ ] No duplicate message generated.
- [ ] No unintended audience/marketing send occurred.
- [ ] Evidence is recorded in issue #130.

## Release decision

Use exactly one state:

- **RELEASE BLOCKED** — any mandatory launch-critical item above is incomplete, failed, or unknown.
- **EMAIL GATE READY FOR CONTROLLED PRODUCTION TEST** — Development/Preview and provider evidence are complete, but Production proof is not yet approved/completed.
- **EMAIL GATE VERIFIED** — controlled Production proof passed and all mandatory evidence is recorded.

Issue #130 may be closed only at **EMAIL GATE VERIFIED**.

## Current disposition — 2026-08-20

**RELEASE BLOCKED.**

Completed or substantially evidenced:

- application/provider architecture identified;
- SPF/DKIM/DMARC pass evidence exists for authentication, waitlist, and tested mailbox-originated paths;
- consent/outbox database contract is source-controlled;
- migration source provenance has been restored;
- application email/auth contracts previously passed source-level tests;
- Production website deployment remains on the canonical Vercel path.

Remaining launch-critical blockers:

1. support receiving/reply ownership evidence;
2. direct Resend account evidence for domain/sender/suppression/bounce/webhook state;
3. current Supabase auth SMTP/sender configuration evidence;
4. timestamp-preserving Development migration-ledger reconciliation;
5. Development application/verification of the email consent/outbox migration;
6. lifecycle delivery/failure tests;
7. controlled Production proof.

Do not reduce issue #130 from P0 until these launch-critical blockers are resolved or a reviewed product-scope change removes the corresponding path from launch.