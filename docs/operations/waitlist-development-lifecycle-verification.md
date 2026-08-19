# Waitlist Development Lifecycle Verification

## Purpose

Use this procedure after one explicitly controlled, non-customer waitlist test has been submitted through a Development or approved Preview deployment with the waitlist ledger enabled.

The verifier is read-only. It does not:

- submit the waitlist form;
- send email;
- create or modify consent evidence;
- create or modify an outbox row;
- register or invoke a Resend webhook;
- change Vercel or Supabase configuration; or
- access the Production database.

It proves that one known submission produced exactly one matching consent event and exactly one matching notification outbox row in the canonical Development project. It also checks provider-message correlation and either accepted or delivered state.

## Safety boundary

The verifier rejects every Supabase project except:

`ycstrcvshdluovtuasjc` — USD Impact Development

Do not alter this guard to test Production. Production proof is a separate, explicitly approved release step under `docs/operations/email-readiness-release-gate.md`.

Use a controlled non-customer email alias. Never put a customer address, Supabase secret, Resend secret, complete authentication URL, or provider message ID in an issue, PR, document, or chat transcript.

## Prerequisites

Before running the verifier:

1. The Development database includes migration `20260819215648_email_consent_outbox_contracts`.
2. A reviewed Development or Preview deployment targets the canonical Development Supabase project.
3. `EMAIL_READINESS_LEDGER_ENABLED=true` was enabled only for that controlled target.
4. One controlled waitlist submission completed using a recorded browser `submissionId`.
5. For delivered-state proof, the Development Resend webhook receiver processed the matching signed `email.delivered` callback.
6. The operator knows the exact controlled email address and submission UUID but does not publish either value unnecessarily.

## Required environment names

Set these only in the operator's secure shell or approved secret runner. Do not commit values.

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
WAITLIST_TEST_EMAIL
WAITLIST_TEST_SUBMISSION_ID
WAITLIST_EXPECTED_STATE
```

`WAITLIST_EXPECTED_STATE` must be one of:

- `accepted` — Resend accepted the message and the returned provider message ID was persisted;
- `delivered` — the signed provider callback updated the same outbox row to delivered.

Default: `delivered`.

## Run

From `apps/web`:

```bash
npm run verify:waitlist-development
```

The command exits non-zero if any mandatory condition fails.

## Verified conditions

The command checks all of the following:

### Consent evidence

- exactly one row matches the deterministic consent idempotency key;
- status is `granted`;
- purpose is `book_availability`;
- source is `waitlist_form`;
- consent-text version is `waitlist-purchase-link-v1`;
- privacy-notice version is `privacy-2026-08-18`;
- evidence context records affirmative checkbox state and form version `waitlist-v1`;
- captured timestamps are valid;
- evidence checksum is present in the approved format.

### Notification outbox

- exactly one row matches the deterministic notification idempotency key;
- classification is operational;
- business object is the controlled waitlist submission;
- template and version match the reviewed waitlist confirmation contract;
- recipient and provider identity match;
- the payload is empty and contains no unnecessary personal data;
- at least one delivery attempt is recorded;
- a Resend provider message reference is present;
- accepted timestamp is present;
- no failure timestamp or error code remains;
- observed state satisfies the requested `accepted` or `delivered` proof level.

## Output

Successful output is a bounded JSON summary. It contains:

- Development project reference;
- submission UUID;
- masked email address;
- expected and observed state;
- consent purpose and version metadata;
- attempt count;
- accepted/delivered timestamps; and
- a short SHA-256 fingerprint of the provider reference.

It does not print the Supabase secret, complete email address, complete Resend provider reference, message body, or authentication link.

## Evidence record

Record only:

- UTC verification time;
- verifier commit SHA;
- controlled deployment ID/URL;
- masked test address;
- submission UUID if the issue is access-restricted and the value is required for reproducibility;
- expected and observed state;
- consent and outbox row counts;
- provider-reference fingerprint;
- pass/fail result and failure code;
- operator/reviewer.

Do not paste environment values or raw database responses.

## Failure handling

Common failure codes include:

- `UNEXPECTED_SUPABASE_PROJECT` — stop immediately; the target is not Development.
- `CONSENT_EVIDENCE_MISSING` — submission did not create the expected consent row.
- `DUPLICATE_CONSENT_EVIDENCE` — more than one consent row matched; investigate before another send.
- `CONSENT_EVIDENCE_MISMATCH` — stored consent does not match the reviewed contract.
- `OUTBOX_EVIDENCE_MISSING` — submission did not create the expected delivery intent.
- `DUPLICATE_OUTBOX_EVIDENCE` — more than one outbox row matched.
- `PROVIDER_CORRELATION_MISSING` — accepted provider message ID was not persisted.
- `OUTBOX_STATE_NOT_VERIFIED` — the message has not reached the requested state.
- `OUTBOX_FAILURE_PRESENT` — error/failure evidence remains on the row.

Do not rerun the form with a new submission ID merely to bypass a failed verification. Preserve the original evidence, determine the root cause, and use the stable submission ID only when the reviewed retry rules permit it.

## Completion criterion

This procedure closes only the controlled Development waitlist persistence/provider-correlation item. It does not close:

- support mailbox receiving/reply ownership;
- Production Supabase Auth branding and redirect configuration;
- unsubscribe/withdrawal and suppression separation;
- purchase/refund/dispute/account transactional lifecycle testing; or
- controlled Production proof.
