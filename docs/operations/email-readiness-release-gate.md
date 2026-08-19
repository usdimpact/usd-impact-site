# USD Impact Email, Support, and Consent Release Gate

## Purpose

This runbook is the canonical operational gate for GitHub issue #130: transactional email, support mailbox, consent evidence, provider lifecycle handling, and delivery readiness for the Library Pass launch.

It converts source, provider, mailbox, DNS, database, and test evidence into one fail-closed release decision. It does not authorize DNS changes, provider purchases, Production environment changes, Production database writes, marketing sends, Paddle Live activation, or legal-policy changes.

## Current verified baseline — 2026-08-20

### Application and provider architecture

- Account authentication uses Supabase passwordless email.
- Observed authentication sender: `USD Impact <no-reply@updates.usd-impact.com>`.
- Public book waitlist uses Resend and sends from `book@updates.usd-impact.com`.
- Public policy and product pages use `support@usd-impact.com` as the account, billing, refund, privacy, and support route.
- The repository migration `20260819215648_email_consent_outbox_contracts.sql` defines append-only marketing-consent evidence and a durable notification outbox contract.
- Development records migration version `20260819215648` as applied. Production does not.

### Direct Resend evidence

The connected Resend account was inspected directly on 2026-08-20.

Verified:

- `updates.usd-impact.com` status: verified;
- sending: enabled;
- receiving: enabled;
- DKIM record: verified;
- MAIL FROM / return-path MX: verified;
- SPF record: verified;
- inbound receiving MX: verified;
- intended segment exists: `Read the Dollar First Waitlist`;
- a separate `General` segment exists;
- 34 recent sent messages were returned and every returned message was `delivered`;
- inspected send/contact API requests were successful in the returned log window;
- zero broadcasts were found;
- zero contact imports were found;
- zero subscription topics were found.

Open provider gap:

- zero Resend webhooks are configured, so no account-level real-time lifecycle callback currently exists for delivered, bounced, complained, failed, delayed, or suppressed email events.

Open/click tracking is disabled. Do not enable tracking merely to satisfy this gate; tracking is a separate privacy/product decision.

### Deliverability evidence already captured

Prior controlled Gmail-header evidence recorded in issue #130 shows:

- passwordless authentication message: SPF pass, DKIM pass for `updates.usd-impact.com` using selector `resend`, DMARC pass for `usd-impact.com`;
- waitlist confirmation: SPF pass, DKIM pass for `updates.usd-impact.com`, DMARC pass for `usd-impact.com`;
- cPanel-originated `@usd-impact.com` test message: SPF pass, DKIM pass using selector `default`, DMARC pass for `usd-impact.com`;
- observed DMARC policy was monitoring mode (`p=none`), so authentication is verified but enforcement is not asserted.

These checks do not by themselves prove bounce/complaint processing, inbox placement across representative providers, or ongoing root-domain support receiving.

### Support mailbox evidence

A controlled message was sent to `support@usd-impact.com` on 2026-08-12. The connected Gmail mailbox contains the sent message but no reply in that thread, and no message from `support@usd-impact.com` was found in the inspected recent window.

Therefore support receiving/escalation/response ownership remains **UNVERIFIED**. Do not mark this gate complete until an owner-controlled inbound test produces auditable receipt or reply evidence.

### Database and migration state

Source provenance for the Guided Edition migration stack has been restored, including `20260819001529_restore_learning_progress_writes.sql`.

Migration ledgers were rechecked directly:

- Development is reconciled through `20260819001529_restore_learning_progress_writes` and now also records `20260819215648_email_consent_outbox_contracts`;
- Production is reconciled through `20260813004700_restore_guided_release_service_role_select` and intentionally does not contain the Development-only learning-progress write migration or the email consent/outbox migration.

The email migration was applied to **Development only**. Post-apply verification confirmed:

- `marketing_consent_events` exists with RLS enabled;
- `notification_outbox` exists with RLS enabled;
- no browser-role table grants were introduced;
- service-role consent writes are column-scoped and the consent ledger has no application UPDATE/DELETE grant;
- service-role outbox writes are column-scoped and delivery-state UPDATE is limited to the intended state columns;
- the consent-reference and outbox-reference validation triggers exist;
- the outbox updated-at trigger exists;
- no new security-advisor WARN was introduced by the migration;
- the two new advisor notices are INFO-level `RLS Enabled No Policy`, which is intentional because these are backend-only tables.

Existing unrelated Development advisor WARNs remain tracked separately, including the reviewed `request_account_deletion()` SECURITY DEFINER finding and leaked-password protection setting.

### Migration-version reconciliation rule

The connected Supabase MCP migration action records its own migration version. For this Development apply, Supabase recorded `20260819215648`. Source control must therefore use the same exact migration version so repository and remote history remain aligned.

Do not apply the old `20260819191131` version anywhere after this reconciliation. Do not create a second migration containing the same SQL.

For Production, use a reviewed migration path only after all remaining launch gates pass. Production remains observation-only under this runbook.

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
- [ ] Branded SMTP/sender configuration verified from current provider settings.
- [ ] Authentication rate limits/anti-abuse settings reviewed.

### Resend/waitlist and transactional delivery

- [ ] `RESEND_API_KEY` presence/scope verified server-side without exposing its value.
- [ ] `RESEND_WAITLIST_SEGMENT_ID` presence/scope verified where waitlist capture runs.
- [ ] `RESEND_FROM_EMAIL` presence/scope verified and matches the approved sender.
- [ ] `RESEND_REPLY_TO` presence/scope verified and points to an owned, monitored route.
- [x] Resend domain status verified directly.
- [x] DKIM/SPF/MAIL FROM records verified directly in Resend.
- [x] Intended waitlist segment exists.
- [x] No contact imports found in the inspected account.
- [x] No broadcasts found in the inspected account.
- [x] Provider logs show no unexplained failure in the inspected send/contact window.
- [ ] Suppression, bounce, complaint, and webhook handling implemented and tested.

## Gate C — domain authentication and receiving

- [x] SPF pass observed for authentication sender.
- [x] DKIM pass observed for `updates.usd-impact.com` authentication sender.
- [x] DMARC pass observed for authentication sender.
- [x] SPF pass observed for waitlist sender.
- [x] DKIM pass observed for waitlist sender.
- [x] DMARC pass observed for waitlist sender.
- [x] SPF/DKIM/DMARC pass observed for the tested `@usd-impact.com` mailbox-originated message.
- [x] Resend MAIL FROM / return-path MX reports verified.
- [ ] Current DNS/provider state rechecked near launch if records or providers change after the recorded tests.
- [ ] `support@usd-impact.com` inbound receiving verified with a controlled test.
- [ ] Support reply path verified end-to-end.

Do not tighten DMARC enforcement merely to close this gate. A change from monitoring to quarantine/reject is a separate DNS/security decision requiring its own rollout and monitoring plan.

## Gate D — consent and recordkeeping

Database contract is now present in Development. Application behavior still must prove it uses the contract correctly.

- [ ] Explicit marketing consent is affirmative and not preselected.
- [ ] Consent purpose is specific to the relevant marketing/waitlist use.
- [ ] Consent timestamp is persisted to `marketing_consent_events`.
- [ ] Consent source is persisted.
- [ ] Consent-text version is persisted.
- [ ] Privacy-notice version is persisted.
- [ ] Withdrawal is append-only/auditable rather than destructive.
- [ ] Transactional records remain separate from promotional audience segmentation.
- [ ] Unsubscribe from marketing does not suppress required account/security communication.
- [ ] Retention periods for consent evidence, delivery logs, suppression records, and support correspondence are documented.

## Gate E — Development migration verification

No Production write is authorized by this runbook.

Completed:

- [x] Development migration ledger reconciled through `20260819001529` before email apply.
- [x] Security and performance advisor baselines captured before email apply.
- [x] `email_consent_outbox_contracts` applied to Development only.
- [x] Supabase recorded version `20260819215648`.
- [x] RLS verified on both new tables.
- [x] Browser-role table grants verified absent.
- [x] Service-role column privileges verified.
- [x] Validation and updated-at triggers verified.
- [x] Post-apply security advisors reviewed; no new WARN introduced.

Still required:

- [ ] Source migration filename and contract test merged using exact version `20260819215648`.
- [ ] Application-level Development tests exercise consent grant, withdrawal, outbox enqueue, retry, delivery-state updates, and forbidden browser access against the real Development database.
- [ ] Production migration remains blocked until Gates A–G pass and an explicit Production release step is reviewed.

If any future tool proposes Production, `--include-all`, a replay of the old email migration version, or an unexpected migration version, stop.

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

### Resend lifecycle implementation gate

Resend currently has zero webhooks. Before registering one:

1. deploy a reviewed HTTPS receiver;
2. verify the raw body using the Resend signing secret and signed webhook headers;
3. make event handling idempotent;
4. map only reviewed lifecycle events into durable delivery state;
5. fail closed when required configuration or database contracts are unavailable;
6. test in Preview/Development before registering a Production endpoint;
7. store no unnecessary recipient or message content in logs.

Do not register a Production webhook merely to satisfy the checklist.

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
- direct Resend domain, DNS, segment, delivery and bulk-send state inspected;
- 34 returned recent Resend messages are delivered;
- no Resend broadcast/import activity found in the inspected account;
- consent/outbox migration applied and verified in Development as `20260819215648`;
- migration source provenance through the Development stack is known;
- application email/auth contracts previously passed source-level tests;
- canonical release-gate deployment is READY in Vercel Production.

Remaining launch-critical blockers:

1. merge source-version reconciliation for `20260819215648`;
2. support receiving/reply ownership evidence;
3. current Supabase Auth SMTP/sender configuration evidence;
4. application integration with the Development consent/outbox contract;
5. Resend lifecycle webhook handling for bounce/complaint/failure/suppression state;
6. lifecycle delivery/failure/idempotency tests;
7. controlled Production proof.

Do not reduce issue #130 from P0 until these launch-critical blockers are resolved or a reviewed product-scope change removes the corresponding path from launch.
