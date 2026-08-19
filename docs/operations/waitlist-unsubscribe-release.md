# USD Impact Waitlist Unsubscribe Release Gate

## Purpose

This runbook controls release and activation of the `Read the Dollar First` waitlist unsubscribe workflow.

The objective is to let a recipient withdraw book-availability consent without deleting prior evidence, suppress future waitlist delivery at the provider, and preserve required account, security, purchase, refund, privacy, and support communications as separate message classes.

This runbook does not authorize Production activation, Production database migration, DNS changes, bulk mail, broadcasts, contact imports, Paddle activation, or customer-data use.

## Released architecture

When both the consent ledger and unsubscribe feature are enabled for an approved environment, the confirmation path is:

`affirmative browser consent -> append-only grant -> durable confirmation outbox -> signed unsubscribe URL -> Resend email -> explicit unsubscribe POST -> append-only withdrawal -> Resend contact suppression`

The confirmation message also sends these provider headers:

- `List-Unsubscribe: <signed HTTPS URL>`
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

The HTML and plain-text bodies contain the same signed unsubscribe URL plus a reply-based fallback.

## Security properties

- Tokens are HMAC-signed and bound to the deterministic consent idempotency identity.
- Tokens do not contain the recipient email address, database row ID, provider message ID, or secret.
- The unsubscribe URL must use HTTPS outside localhost, use the exact `/unsubscribe` path, contain only a non-empty `token` query parameter, and contain no credentials or fragment.
- A GET request never changes consent or provider state.
- A GET request is rejected when the feature is disabled, the secret is unavailable, the token is malformed, or the signature is invalid.
- Mutation requires an explicit POST confirmation, including RFC-style one-click form data.
- Withdrawal evidence is append-only and references the original grant.
- Browser roles receive no direct table access.
- Non-production writes are restricted to the canonical Development Supabase project.
- Production writes additionally require a separate explicit approval flag and exact canonical Production targeting.
- Error responses do not expose email addresses, tokens, secrets, provider references, or database identities.
- The route is `noindex`, `nofollow`, `no-referrer`, `no-store`, frame-denied, and protected by a restrictive Content Security Policy.

## Environment names

Values are secrets or controlled configuration and must not be committed.

### Existing delivery and ledger configuration

- `EMAIL_READINESS_LEDGER_ENABLED`
- `RESEND_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `VERCEL_ENV`

### Unsubscribe configuration

- `WAITLIST_UNSUBSCRIBE_ENABLED`
- `WAITLIST_UNSUBSCRIBE_SECRET`
- `WAITLIST_UNSUBSCRIBE_PRODUCTION_APPROVED`

The secret must be a high-entropy value matching the application contract. Generate and store it through an approved secret-management path. Never place it in source, logs, issue comments, email, screenshots, or command output.

## Activation boundary

A signed link is included only when:

1. the application has created or resolved the audited consent/outbox state; and
2. `WAITLIST_UNSUBSCRIBE_ENABLED=true`; and
3. the unsubscribe secret is valid; and
4. the request host is an approved USD Impact Production, Preview, or local host.

If any requirement fails, the application fails closed before contacting Resend. When the consent ledger is disabled, the existing reply-based unsubscribe fallback remains in the confirmation message and no signed link is generated.

Production remains dormant unless all of the following are true:

- `WAITLIST_UNSUBSCRIBE_ENABLED=true`;
- `WAITLIST_UNSUBSCRIBE_PRODUCTION_APPROVED=true`;
- the configured Supabase target is the canonical Production project;
- the Production email/consent migration has been separately approved and applied;
- issue #130 has reached the controlled Production proof stage.

## Development verification sequence

Use only a controlled non-customer address.

1. Confirm the Development email consent/outbox migration is present.
2. Confirm the Preview deployment targets the canonical Development Supabase project.
3. Configure a Preview-only unsubscribe secret.
4. Set `EMAIL_READINESS_LEDGER_ENABLED=true` and `WAITLIST_UNSUBSCRIBE_ENABLED=true` for that controlled Preview only.
5. Submit the waitlist form once and retain the browser-generated submission UUID through failed retries.
6. Confirm the message contains:
   - multipart plain-text and HTML bodies;
   - the expected signed Preview `/unsubscribe` URL;
   - `List-Unsubscribe`;
   - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
7. Open the link with GET and confirm it renders a confirmation page without database or provider mutation.
8. Submit the explicit confirmation POST.
9. Verify exactly one append-only withdrawal event references the original grant.
10. Verify the matching Resend contact is marked unsubscribed.
11. Repeat the POST and verify no duplicate withdrawal evidence is created.
12. Verify account authentication and required operational messages remain independent from waitlist consent.
13. Restore Preview flags and remove temporary test configuration after evidence is recorded.

## Failure-state checks

Before Production activation, verify:

- disabled GET returns a fail-closed response;
- malformed and incorrectly signed tokens perform no provider/database calls;
- missing secret performs no provider send;
- wrong Supabase project performs no write;
- Production without the explicit approval flag performs no write;
- provider suppression failure returns an error while preserving retryable append-only withdrawal evidence;
- repeated explicit confirmation is idempotent;
- scanner/link-prefetch GET requests do not unsubscribe the recipient;
- logs contain no token, email, secret, provider reference, or message body.

## Rollback

To disable the feature immediately:

1. set `WAITLIST_UNSUBSCRIBE_ENABLED=false` in the affected environment;
2. redeploy or refresh the environment as required by the hosting platform;
3. verify GET and POST requests fail closed;
4. do not delete existing grant or withdrawal evidence;
5. retain the reply-based unsubscribe support process;
6. investigate any provider/database divergence before reactivation.

Rotating `WAITLIST_UNSUBSCRIBE_SECRET` invalidates links signed with the prior value. Do not rotate it casually. A planned rotation requires an overlap or customer-support plan for previously delivered messages.

## Release decision

Use one state:

- **BLOCKED** — source/CI/Preview failure, unknown target, missing owner, or incomplete Development proof.
- **READY FOR DEVELOPMENT PROOF** — source, tests, and Preview are green; Production remains disabled.
- **READY FOR CONTROLLED PRODUCTION TEST** — Development proof and all preceding issue #130 gates pass.
- **VERIFIED** — controlled Production unsubscribe and suppression proof passes, is documented, and does not affect required transactional/security delivery.

Until issue #130 explicitly records the final controlled Production proof, this workflow must remain **BLOCKED FOR PRODUCTION ACTIVATION**.
