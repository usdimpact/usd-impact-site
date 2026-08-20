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

It proves that one known submission produced exactly one matching consent event and exactly one matching, consent-bound notification outbox row in the canonical Development project. It also checks provider-message correlation and either accepted or delivered state.

## Current verified evidence

The controlled 20 August 2026 Development run established:

- consent-bound waitlist outbox persistence;
- real Resend provider-message correlation;
- delivered, hard-bounced, complained, and suppressed terminal states;
- retry after callbacks arrived before provider correlation;
- duplicate callback idempotency;
- invalid-signature rejection;
- removal or inerting of all temporary test surfaces.

The permanent correlation-race correction is merged in commit:

`39db647ae49f33dc3427508d451f7c349c0caf08`

The bounded evidence record is:

`email-readiness-evidence-2026-08-20.md`

## Safety boundary

The verifier rejects every Supabase project except:

`ycstrcvshdluovtuasjc` — USD Impact Development

Do not alter this guard to test Production. Production proof is a separate, explicitly approved release step under `docs/operations/email-readiness-release-gate.md`.

Use a controlled non-customer email alias. Never put a customer address, Supabase secret, Resend secret, complete authentication URL, complete webhook signature, or provider message ID in an issue, PR, document, or chat transcript.

## Prerequisites

Before running the verifier:

1. The Development database includes migrations:
   - `20260819215648_email_consent_outbox_contracts`;
   - `20260820111237_expand_launch_email_outbox_contracts`.
2. A reviewed Development or Preview deployment targets the canonical Development Supabase project.
3. `EMAIL_READINESS_LEDGER_ENABLED=true` was enabled only for that controlled target.
4. One controlled waitlist submission completed using a recorded browser `submissionId`.
5. The resulting outbox row references the matching `book_availability` consent grant.
6. For delivered-state proof, the Development Resend webhook receiver processed the matching signed `email.delivered` callback.
7. The operator knows the exact controlled email address and submission UUID but does not publish either value unnecessarily.

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
- `consent_required` is true;
- `consent_record_id` matches the verified grant;
- `consent_purpose` is `book_availability`;
- `consent_checked_at` is present and within the approved freshness window;
- the payload is empty and contains no unnecessary personal data;
- at least one delivery attempt is recorded;
- a Resend provider message reference is present;
- accepted timestamp is present;
- no unresolved failure timestamp or error code remains for accepted/delivered verification;
- observed state satisfies the requested `accepted` or `delivered` proof level.

## Provider callback ordering

A provider callback may arrive before the application persists `provider_message_ref`.

Required behavior:

1. Verify the signature and event contract.
2. Persist or reload the provider receipt.
3. If provider correlation does not yet exist:
   - keep the receipt retryable;
   - set `OUTBOX_CORRELATION_PENDING`;
   - do not apply a terminal state;
   - return a retryable HTTP response.
4. When the provider replays after correlation exists:
   - reload the same receipt;
   - increment its attempt count;
   - apply at most one monotonic transition;
   - clear the transient correlation error;
   - mark the receipt processed.
5. A duplicate of a completed receipt returns success without another transition.

A tracked callback with missing correlation must never be marked permanently ignored.

## Extended terminal-state matrix

The read-only single-submission verifier proves accepted or delivered state. The broader controlled Development evidence must separately establish:

| Provider event | Expected outbox result |
|---|---|
| `email.delivered` | `delivered`; no error code |
| `email.bounced` | `hard_bounced`; `RESEND_HARD_BOUNCE` |
| `email.complained` | `complained`; `RESEND_COMPLAINT` |
| `email.suppressed` | `suppressed`; `RESEND_SUPPRESSED` |
| invalid signature | HTTP 400; no receipt and no outbox transition |
| duplicate completed event | HTTP 200 duplicate; no state regression |

The real 20 August 2026 provider run passed this matrix.

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

It does not print the Supabase secret, complete email address, complete Resend provider reference, message body, authentication link, or webhook signature.

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
- callback receipt status and attempt count;
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
- `OUTBOX_CONSENT_MISMATCH` — outbox does not reference the verified `book_availability` grant.
- `PROVIDER_CORRELATION_MISSING` — accepted provider message ID was not persisted.
- `OUTBOX_CORRELATION_PENDING` — signed callback arrived before provider correlation; preserve the receipt and permit bounded provider replay.
- `OUTBOX_STATE_NOT_VERIFIED` — the message has not reached the requested state.
- `OUTBOX_FAILURE_PRESENT` — unresolved error/failure evidence remains on the row.

Do not rerun the form with a new submission ID merely to bypass a failed verification. Preserve the original evidence, determine the root cause, and use the stable submission ID only when the reviewed retry rules permit it.

## Completion criterion

This procedure and the corresponding controlled provider matrix close the Development waitlist persistence, consent binding, provider correlation, signed callback, terminal-state, replay, and idempotency sub-gates.

They do not close:

- named backup support access and mailbox recovery drill;
- Production Supabase Auth branding and redirect configuration;
- purchase/refund/dispute/privacy/account business-event integration;
- Production email migrations and controlled Production delivery;
- replacement commerce-provider responsibility mapping; or
- the integrated Issue #54 Library Pass release rehearsal.