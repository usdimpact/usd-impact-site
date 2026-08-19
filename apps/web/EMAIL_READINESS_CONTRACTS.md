# Email readiness contracts

This implementation supplies the local database and server-code foundations for
Issue #130. It does not configure a provider, send email, import contacts, or
change any deployed environment.

## Consent ledger

`public.marketing_consent_events` stores one purpose per append-only grant or
withdrawal event. Each record binds the normalized recipient to the approved
consent-text version, privacy-notice version, source event, server timestamps,
and a checksum of the minimized evidence payload.

- Browser roles receive no table grant or RLS policy.
- Application code using `service_role` may only select and insert.
- A database trigger requires every withdrawal to reference a matching grant
  for the same normalized recipient and purpose.
- Evidence context is fail-closed: only explicitly reviewed fields are accepted.
  Renaming an email, IP, token, or fingerprint field does not bypass the
  contract because unknown fields are rejected.

Retention and anonymization periods remain a business/compliance decision and
are intentionally not encoded here.

## Notification outbox

`public.notification_outbox` records notification intent separately from the
business event that caused it. The database enforces one queued intent per
message, business object, immutable state version, and recipient. Application
code also derives a deterministic SHA-256 enqueue-idempotency key from those
same fields.

This is enqueue idempotency, not a claim of exactly-once email delivery. No
sender may use the table until an atomic claim/lease operation is implemented
and the same idempotency key is forwarded to a provider that supports replay
protection. Provider timeout and retry behavior must be tested separately.

The service role may insert and read rows, but may update only delivery-state
fields. It cannot rewrite a recipient, template, payload, classification,
business identity, or consent reference, and it cannot delete delivery evidence.

Marketing rows require a consent reference. The server helper validates the
shape before insertion, and a database trigger verifies a matching, unwithdrawn
grant for the same recipient and purpose. Consent checks must be within five
minutes of the database-created enqueue timestamp. Any future delivery worker
must recheck the current purpose-specific consent and suppression state
immediately before a provider call; a queued grant reference is not permanent
permission to send.

Notification payloads are also fail-closed. Each approved template has an
explicit field and type contract; unknown templates, classifications, nested
fields, and unexpected data are rejected until reviewed.

Retry intervals, maximum attempts, escalation timing, providers, sender
identities, and templates remain deliberately unset because the approved Issue
#130 package marks them as separate decisions.

## Validation

Run the repository's Supabase validation command before publishing a branch:

```sh
node --run validate:supabase
```

The validation covers normalization, consent evidence, deterministic replay
keys, duplicate-state boundaries, classification and consent guards, payload
data minimization, table privileges, RLS, indexes, migration safety, and an
ephemeral PostgreSQL execution of the migration and its access-control triggers.
