# USD Impact Email, Support, and Consent Release Gate

## Purpose

This runbook is the canonical operational gate for GitHub issue #130: authentication email, transactional email, support mailbox ownership, consent evidence, provider lifecycle handling, and delivery readiness for the Library Pass launch.

It converts source, provider, mailbox, DNS, database, deployment, and test evidence into one fail-closed release decision. It does not authorize DNS changes, provider purchases, Production environment changes, Production database writes, customer or marketing sends, Paddle Live activation, or legal-policy changes.

## Current verified baseline — 2026-08-20

### Application and provider architecture

- Account authentication uses Supabase passwordless email with PKCE.
- Current application source constructs authentication redirects from the request origin plus `/auth/confirm/`.
- Development project `ycstrcvshdluovtuasjc` has delivered branded authentication messages from `USD Impact <no-reply@updates.usd-impact.com>`.
- Production project `gjzetjugmnwanvjkchux` last delivered observed authentication messages from the Supabase default sender `Supabase Auth <noreply@mail.app.supabase.io>`; Production branded SMTP/template/redirect state is therefore not verified.
- Public book waitlist delivery uses Resend and the approved sender identity configured through server-side environment variables.
- Public policy and product pages use `support@usd-impact.com` as the account, billing, refund, privacy, and support route.
- Repository migration `20260819215648_email_consent_outbox_contracts.sql` defines append-only marketing-consent evidence and a durable notification outbox contract.
- Development records migration version `20260819215648` as applied. Production does not.

### Released waitlist and lifecycle capabilities

The following reviewed implementation is merged to `main` and deployed through the canonical Vercel Production path:

- PR #172: fail-closed Resend/Svix-compatible lifecycle receiver;
- PR #173: stable waitlist submission identity, append-only consent preparation, durable outbox intent, Resend idempotency, provider-message correlation, and bounded delivery-state decisions.

The released delivery model is:

`browser submission -> append-only consent evidence -> notification outbox -> Resend idempotent send -> provider message ID -> Resend lifecycle receiver`

Important activation boundary:

- `EMAIL_READINESS_LEDGER_ENABLED` must equal `true` before the waitlist writes consent/outbox records;
- Production additionally requires `EMAIL_READINESS_PRODUCTION_APPROVED=true` and exact Production Supabase targeting;
- `RESEND_WEBHOOK_ENABLED` must equal `true` before the lifecycle receiver processes callbacks;
- no environment-variable change or Resend webhook registration was made by PR #172 or PR #173;
- the available connected Vercel toolset does not expose environment-variable enumeration, so activation must never be inferred from source deployment alone;
- source defaults both new paths to disabled/fail-closed behavior.

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
- 34 returned recent messages were all marked `delivered`;
- inspected send/contact API requests were successful in the returned log window;
- zero broadcasts were found;
- zero contact imports were found;
- zero subscription topics were found.

Open provider activation gap:

- zero Resend webhooks were configured at the time of inspection;
- the reviewed receiver exists, but no account-level callback is active until a Development endpoint, signing secret, and reviewed event subscription are configured and tested.

Open/click tracking is disabled. Do not enable tracking merely to satisfy this gate; tracking is a separate privacy/product decision.

### Deliverability evidence

Controlled Gmail-header evidence recorded in issue #130 shows:

- branded authentication message: SPF pass, DKIM pass for `updates.usd-impact.com` using selector `resend`, and DMARC pass for `usd-impact.com`;
- waitlist confirmation: SPF pass, DKIM pass for `updates.usd-impact.com`, and DMARC pass for `usd-impact.com`;
- cPanel-originated `@usd-impact.com` test message: SPF pass, DKIM pass using selector `default`, and DMARC pass for `usd-impact.com`;
- observed DMARC policy was monitoring mode (`p=none`), so authentication is verified but enforcement is not asserted.

The branded authentication evidence is associated with Development. It must not be used as proof that Production currently uses the same sender configuration.

These checks do not by themselves prove current Production Auth configuration, real bounce/complaint processing, representative inbox placement, or root-domain support receiving.

### Support mailbox evidence

Two controlled messages were sent to `support@usd-impact.com`:

- 2026-08-12 — `USD Impact support mailbox routing test — 12 August 2026`;
- 2026-08-19 — `test`.

Each connected Gmail conversation contains exactly one message: the outbound test. No reply or inbound message from `support@usd-impact.com` was found in the inspected mailbox window.

Therefore support receiving, forwarding/escalation ownership, response handling, and reply capability remain **UNVERIFIED**. Do not mark this gate complete until an owner-controlled inbound test produces auditable receipt and reply evidence.

### Supabase Auth sender and redirect evidence

Development evidence:

- project: `ycstrcvshdluovtuasjc`;
- sender: `USD Impact <no-reply@updates.usd-impact.com>`;
- branded subject/template observed;
- Preview callback used `/auth/confirm/`, consistent with current PKCE source.

Production evidence:

- project: `gjzetjugmnwanvjkchux`;
- 2026-08-18 20:42:01 UTC: observed default `Your sign-in link` from `noreply@mail.app.supabase.io`;
- 2026-08-19 16:19:48 UTC: observed default `Confirm your email address` from `noreply@mail.app.supabase.io`;
- Production Auth logs corroborate `mail_from=noreply@mail.app.supabase.io` for the latter send and a successful `/otp` request;
- the observed Production confirmation used the general Vercel production alias root rather than the current application callback path `/auth/confirm/`.

No complete authentication URL, token, or secret belongs in this runbook or issue evidence.

Production sender/template/Site URL/redirect configuration remains **NOT VERIFIED**. A later controlled Production authentication test requires separate explicit approval.

### Database and migration state

Source provenance for the Guided Edition migration stack has been restored, including `20260819001529_restore_learning_progress_writes.sql`.

Migration ledgers were rechecked directly:

- Development is reconciled through `20260819001529_restore_learning_progress_writes` and records `20260819215648_email_consent_outbox_contracts`;
- Production is reconciled through `20260813004700_restore_guided_release_service_role_select` and intentionally does not contain the Development-only learning-progress write migration or email consent/outbox migration.

The email migration was applied to **Development only**. Post-apply verification confirmed:

- `marketing_consent_events` exists with RLS enabled;
- `notification_outbox` exists with RLS enabled;
- no browser-role table grants were introduced;
- service-role consent writes are column-scoped and the consent ledger has no application UPDATE/DELETE grant;
- service-role outbox writes are column-scoped and delivery-state UPDATE is limited to intended state columns;
- consent-reference and outbox-reference validation triggers exist;
- the outbox updated-at trigger exists;
- no new security-advisor WARN was introduced by the migration;
- the two new advisor notices are INFO-level `RLS Enabled No Policy`, intentional for backend-only tables.

Existing unrelated Development advisor WARNs remain tracked separately, including the reviewed `request_account_deletion()` SECURITY DEFINER finding and leaked-password protection setting.

### Migration-version reconciliation rule

The connected Supabase migration action recorded `20260819215648`. Source control now uses that exact migration version and the old `20260819191131` filename is removed.

Do not apply the old version anywhere. Do not create a second migration containing the same SQL.

Production remains observation-only under this runbook until all preceding gates pass and a Production migration/release step is separately reviewed.

### Production release verification

Merged waitlist ledger release:

- merge commit: `0cfded6300b7e62b1a387b72851d1d0a88eabca4`;
- Production deployment: `dpl_4PmMYosHEN3PGz3KaZnjHR9AoK6N`;
- state: `READY`;
- deployment metadata matches the merge commit;
- `https://www.usd-impact.com/` returned 200;
- the public book page returned 200 and exposed the released stable submission-ID retry behavior;
- `https://usd-impact.com/` returned a permanent redirect to `www`;
- no recent runtime errors were found for `/api/waitlist` or `/api/resend-webhook` in the inspected post-release window.

This verifies deployment integrity, not feature activation or provider lifecycle proof.

## Gate A — ownership and message classification

Required before launch:

- [ ] Named business owner for authentication email.
- [ ] Named business owner for transactional purchase/entitlement/refund email.
- [ ] Named business owner for marketing/waitlist email.
- [ ] Named owner for `support@usd-impact.com` receiving and escalation.
- [ ] Response-time expectation for launch-critical support is recorded.
- [ ] Retention expectation for support correspondence is recorded.
- [ ] Every launch message class is explicitly one of: transactional security, transactional operational, operational, or marketing.
- [ ] Marketing consent is never used as a prerequisite for authentication, security, purchase, entitlement, refund, privacy export, or account-deletion communications.

## Gate B — provider and environment inventory

Record names and scopes only. Never commit secret values.

### Supabase/authentication

- [ ] `SUPABASE_URL` present and correctly scoped in required Vercel environments.
- [ ] `SUPABASE_PUBLISHABLE_KEY` present and correctly scoped in required Vercel environments.
- [ ] `SUPABASE_SECRET_KEY` present only where server-side use is required.
- [ ] Production Site URL and approved redirect URLs verified in Supabase Auth.
- [x] Development branded SMTP/sender behavior observed.
- [ ] Production branded SMTP/sender behavior verified; last observed Production evidence used the default Supabase sender.
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
- [x] Fail-closed lifecycle receiver implemented and source-tested.
- [ ] Development webhook endpoint/signing secret/event subscription configured and tested with real provider events.
- [ ] Suppression, bounce, complaint, delayed, failed, and delivered states verified end-to-end against the real Development database.

## Gate C — domain authentication and receiving

- [x] SPF pass observed for branded authentication sender.
- [x] DKIM pass observed for `updates.usd-impact.com` branded authentication sender.
- [x] DMARC pass observed for branded authentication sender.
- [x] SPF pass observed for waitlist sender.
- [x] DKIM pass observed for waitlist sender.
- [x] DMARC pass observed for waitlist sender.
- [x] SPF/DKIM/DMARC pass observed for the tested `@usd-impact.com` mailbox-originated message.
- [x] Resend MAIL FROM / return-path MX reports verified.
- [ ] Current DNS/provider state rechecked near launch if records or providers change after recorded tests.
- [ ] `support@usd-impact.com` inbound receiving verified with a controlled test.
- [ ] Support reply path verified end-to-end.

Do not tighten DMARC enforcement merely to close this gate. Moving from monitoring to quarantine/reject is a separate DNS/security decision requiring its own rollout and monitoring plan.

## Gate D — consent and recordkeeping

Implemented and CI-verified:

- [x] Waitlist marketing consent is affirmative and not preselected.
- [x] Consent purpose is specific: `book_availability`.
- [x] Browser generates a stable submission ID and reuses it after failed retries.
- [x] Prepared consent records include captured timestamp, source, consent-text version, privacy-notice version, and bounded evidence context.
- [x] Consent idempotency and append-only database constraints are source-tested.
- [x] Operational waitlist confirmation is separated from marketing message classification.
- [x] Notification intent is created before provider send when the ledger feature is enabled.
- [x] Provider send uses a stable Resend idempotency key.
- [x] Provider message ID is designed to persist into `provider_message_ref`.
- [x] Ambiguous, stale, bounced, complained, suppressed, terminal-failed, and cancelled states fail closed.

Still required in real Development:

- [ ] Controlled browser submission persists the expected consent event.
- [ ] Controlled browser submission persists the expected outbox row before send.
- [ ] Successful provider send persists the returned provider message ID.
- [ ] Repeated submission with the same stable ID does not duplicate consent, outbox, or email.
- [ ] Withdrawal/unsubscribe produces an append-only withdrawal event and stops future marketing without suppressing required account/security communication.
- [ ] Retention periods for consent evidence, delivery logs, suppression records, and support correspondence are documented.

## Gate E — Development migration and application verification

No Production write is authorized by this runbook.

Completed:

- [x] Development migration ledger reconciled through `20260819001529` before email apply.
- [x] Security and performance advisor baselines captured before email apply.
- [x] `email_consent_outbox_contracts` applied to Development only.
- [x] Supabase recorded exact version `20260819215648`.
- [x] Source filename and tests merged using exact version `20260819215648`.
- [x] RLS verified on both new tables.
- [x] Browser-role table grants verified absent.
- [x] Service-role column privileges verified.
- [x] Validation and updated-at triggers verified.
- [x] Post-apply security advisors reviewed; no new WARN introduced.
- [x] PGlite/database-contract tests exercise consent grant, withdrawal reference validation, outbox enqueue, delivery-state updates, and forbidden browser access.
- [x] Mocked application/provider tests exercise enqueue, Resend idempotency, provider correlation, retry scheduling, duplicate completion, and stale-state refusal.

Still required:

- [ ] Development/Preview environment names and scopes reviewed without exposing values.
- [ ] Ledger feature enabled for a controlled Development/Preview target only.
- [ ] Real Development database receives and verifies one controlled end-to-end waitlist lifecycle.
- [ ] Production migration remains blocked until Gates A–G pass and an explicit Production release step is reviewed.

If any future tool proposes Production, `--include-all`, replay of the old email migration version, or an unexpected migration version, stop.

## Gate F — lifecycle tests

### Authentication

- [x] Development passwordless sign-in and PKCE callback succeeded in controlled tests.
- [ ] Production branded authentication sender/template/redirect verified after configuration review.
- [ ] Expired/invalid sign-in link fails safely in a controlled deployed test.
- [ ] Recovery/sign-in request remains neutral and does not reveal account existence in a controlled deployed test.

### Waitlist and provider lifecycle

- [x] Stable browser retry identity is source-tested.
- [x] Provider outage/retry behavior is bounded and idempotent in automated tests.
- [x] Duplicate completed submission avoids another provider send in automated tests.
- [x] Signed webhook verification, replay window, payload-hash conflict, event deduplication, and monotonic state transitions are automated-test covered.
- [x] Bounce, complaint, failure, suppression, delay, sent, and delivered mappings are automated-test covered.
- [ ] Real Development waitlist send is accepted by Resend and correlated to the outbox.
- [ ] Real signed `email.delivered` callback updates the matching Development outbox row.
- [ ] Real bounce/failure or an approved equivalent provider test reaches the intended terminal/retry state.
- [ ] Provider callback retry does not create a duplicate transition.

### Purchase, entitlement, refund, dispute, privacy, and account lifecycle

- [ ] Purchase pending message is correct, if the product flow uses one.
- [ ] Purchase confirmed message is emitted only from verified server-side transaction state.
- [ ] Replayed/duplicate payment webhook does not create duplicate entitlement or duplicate email.
- [ ] Refund approval produces intended customer communication and access-state change.
- [ ] Dispute warning behavior is defined and tested.
- [ ] Chargeback communication and entitlement revocation are tested.
- [ ] Eligible dispute reversal is tested.
- [ ] Privacy export acknowledgement contains no private export payload in ordinary email.
- [ ] Account deletion staged/completed states are tested.
- [ ] Message logs contain no secrets, complete authentication links, payment-card data, private learning inputs, or unnecessary personal data.

### Resend lifecycle activation sequence

Implementation is complete; provider activation is not.

Before registering a Development webhook:

1. identify a stable reviewed Development HTTPS endpoint;
2. configure `RESEND_WEBHOOK_SECRET` and `RESEND_WEBHOOK_ENABLED=true` only for that controlled target;
3. confirm the endpoint is reachable by Resend without weakening unrelated Preview protection;
4. subscribe only to reviewed lifecycle events;
5. run delivered, duplicate, failure/bounce, delayed, complained, and suppressed evidence where safely possible;
6. verify Development `webhook_receipts` and `notification_outbox` state;
7. remove or disable temporary configuration after testing unless an ongoing Development receiver is explicitly approved.

Do not register or enable a Production webhook merely to satisfy the checklist.

## Gate G — template and rendering QA

For every launch-critical template:

- [ ] Subject and sender identity are unambiguous.
- [ ] Product name and purchase state are accurate.
- [ ] Merchant-of-Record language is accurate where relevant.
- [ ] `support@usd-impact.com` is present where support escalation is appropriate.
- [ ] Privacy language is accurate and minimal.
- [ ] Marketing templates include unsubscribe.
- [ ] Transactional/security messages do not include promotional consent assumptions.
- [ ] Links resolve to intended HTTPS host and callback route.
- [ ] Mobile rendering is reviewed.
- [ ] Representative mailbox placement is tested.
- [ ] No guarantee, urgency manipulation, investment recommendation, or unrelated promotional copy is introduced.

## Gate H — controlled Production proof

Only after Gates A–G pass:

- [ ] Production sender/domain state rechecked.
- [ ] Production environment variable names/scopes verified without exposing values.
- [ ] Controlled Production test recipient approved.
- [ ] Controlled Production send approved explicitly.
- [ ] Branded authentication test delivered through correct `/auth/confirm/` callback.
- [ ] Transactional purchase/entitlement test delivered, if Production transaction path is authorized.
- [ ] Support inbound/reply test delivered.
- [ ] Provider logs show accepted/delivered state or understood terminal state.
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
- Development branded authentication delivery and PKCE callback evidenced;
- SPF/DKIM/DMARC pass evidence exists for branded authentication, waitlist, and tested mailbox-originated paths;
- direct Resend domain, DNS, segment, delivery, and bulk-send state inspected;
- 34 returned recent Resend messages were delivered;
- no Resend broadcast/import activity found in the inspected account;
- consent/outbox migration applied and verified in Development as `20260819215648`;
- exact source-version reconciliation merged;
- fail-closed Resend lifecycle receiver merged, tested, and deployed;
- stable waitlist consent/outbox/provider-correlation path merged, tested, and deployed;
- exact-head GitHub Web Quality and Vercel Preview passed for both implementation releases;
- Production deployment of dormant code is `READY` and live route checks passed;
- no Production database, provider registration, audience, broadcast, or DNS mutation was made by these releases.

Remaining launch-critical blockers:

1. named ownership, response expectations, and retention policy for launch email/support operations;
2. `support@usd-impact.com` receiving, forwarding/escalation, and reply evidence;
3. Production Supabase Auth branded SMTP/template/Site URL/redirect configuration and controlled proof;
4. controlled Development/Preview environment activation for the waitlist consent/outbox path;
5. real Development waitlist persistence, provider-message correlation, and duplicate-send proof;
6. Development Resend webhook registration and real delivered/failure lifecycle proof;
7. withdrawal/unsubscribe and suppression-separation proof;
8. remaining purchase/refund/dispute/privacy/account transactional email lifecycle tests;
9. controlled Production proof.

Do not reduce issue #130 from P0 until these launch-critical blockers are resolved or a reviewed product-scope change removes the corresponding path from launch.
