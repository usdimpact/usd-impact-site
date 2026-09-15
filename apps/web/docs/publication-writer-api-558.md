# Governed publication writers - issue 558

## Status and exact scope

Draft/test candidate prepared September 10, 2026 from PR 559 head
`bc5a37f0d1b35ca28ada86422969a13414079bbf`, main
`058d4d893ab12ce7ddd51ad43154d02b8536ca59`. Not a registered migration,
managed database grant, runtime adapter or release approval. No HTTP route uses it.
Keep issue 558 open and PR 559 draft. `enforcementActive=false`.

The original `publication-admission-contract-558.sql` stays byte-identical:
Git blob `64dac78c49d6af9e2d96dd386a8fbee67aa61cc4`, SHA-256
`a64a5605b62b2eabbe6b121dc3207504a1f3ba422dbf9849dc6925c4d6f1ef33`.
The new `docs/sql/publication-writer-api-contract-558.sql` follows that baseline
only in a new disposable database. It replaces, not layers over, the earlier
conversation-only two-wrapper permission experiment. Existing names cause a
failure rather than an implicit upgrade or destructive replacement.

## Root cause and correction

The previous native control reproduced a 40P01 deadlock: a recorder held history
then requested release, while a raw controller held release then requested
history. Merely adding a history gate to the recorder left that inversion possible.

Five governed write operations now acquire the same exclusive history row gate
before locking or changing a release or admission:

| Operation | Caller | Behavior |
| --- | --- | --- |
| `authorize_release` | controller | Creates one exact, time-bounded authorization; creates no admission. |
| `prepare_admission` | controller | Creates a pending exact-content tuple; cannot create admitted history. |
| `record_verified_receipt` | recorder | Calls the original finalizer only after the history gate. |
| `revoke_release` | revoker | Irreversibly revokes a release; available after ordinary approval expiry. |
| `revoke_admission` | revoker | Irreversibly revokes one exact release/path/content tuple. |

The order is **history -> release -> admission**, omitting an admission lock only
when the operation does not access an admission. Insert uniqueness is serialized
by the same history gate. Trigger history updates re-use the already-held gate.
All runtime callers have EXECUTE only on their assigned API functions; they
cannot invoke the original finalizer, lock raw release/admission rows first,
rewrite the history counter or assume wrapper-owner roles.

The gate is a private SECURITY INVOKER helper, callable only by writer-function
owners. It rejects unsupported isolation levels; the tested writer contract is
READ COMMITTED. Each writer has a two-second lock timeout at its API boundary.
The original inner finalizer retains its three-second setting. Errors propagate
without automatic retry, timestamp refresh, or partial success classification.
Client transaction boundaries still matter: a successful function call is not
proof of COMMIT. Production adoption needs bounded autocommit and read reconciliation.

The global gate serializes publication writes, deliberately trading throughput
for a simple correctness boundary. No throughput or latency guarantee is claimed.
Owner/superuser maintenance can still use the untouched raw prototype. That
administrative path must quiesce runtime writers or follow the same order; this
candidate does not protect against a database owner bypassing its controls.

## Privilege design: explicit test-only security exception

There are **six private SECURITY DEFINER entry points**: five writers and the
history reader. This extends the earlier two-wrapper proposal; it is not a silent
change to the baseline's six invoker functions. Four restricted NOLOGIN owner
roles are distinct from the four NOLOGIN logical caller roles. No caller receives
owner membership, raw relation grants, schema CREATE, table ownership, login
credentials, superuser, BYPASSRLS, replication or role/database-creation privileges.
PUBLIC, anon, authenticated and service_role cannot access the API.

Function owners are not protected-table owners, remain subject to RLS, and get
only required SELECT, explicit column INSERT/UPDATE and internal EXECUTE rights.
Controller/recorder release-lock permissions use false WITH CHECK policies so
locking is allowed but a direct release mutation is not. Existing immutable
transition triggers continue to constrain admission changes. All API functions
use empty search paths and row_security=on; references are schema-qualified and
no API function executes dynamic SQL. Creation, ownership and grants are enclosed
in one transaction. No existing application role is changed.

These are logical machine identities, not authenticated Supabase users. No user
JWT or user-editable metadata is trusted. Their eventual machine authentication,
login binding, secret custody and non-exposure through the Data API require a
separately reviewed installation. Local superuser installation is not proof that
Supabase's managed postgres role can apply the same ownership transfer unchanged.

SQL checks binding and clock semantics, not signature truth. Controller input must
already contain authenticated approval/calendar/artifact evidence. Recorder input
must come from a separately authenticated receipt verifier. Hash format is not
evidence authenticity. No first-public-response witness, signed-attempt ledger,
receipt verification service, runtime grant or production record exists here.

## Verification

The new awaited embedded SQL suite has **53 passing groups**. It checks the eight
logical roles, original-function preservation, API configuration, no raw writes,
capability separation, immutable preparation/authorization replay, conflicts,
invalid phase/evidence/deadline inputs, revocation, row-security settings, explicit
no-calendar status, rollback and missing-history failure. It creates a fresh
PGlite instance using the existing pinned dependency, with no network or credentials.
It is independent of the native concurrency results.

The standalone native harness ran the actual candidate operations on checksum-
verified upstream PostgreSQL 17.6, with independent backends, private Unix sockets
only and fsync/synchronous_commit on. **20 scenarios passed**, including:

- C09: all five writer APIs blocked on history before acquiring a release/admission
  RowShareLock or RowExclusiveLock, verified through pg_blocking_pids and pg_locks.
- C10: all 25 ordered pairs of the five write operations serialized without deadlock.
- Concurrent exact/conflicting receipts; real expiry while blocked; preparation
  racing release revocation; recording racing release/item revocation; retry
  immutability; cancellation; lock timeout; and unsupported-isolation rejection.
- C16: 148 prohibited operations across independent logical/application-role
  sessions were denied. These are nested assertions, not 148 extra matrix cases.
- Controlled unread-result reconciliation and a clean native restart. These do
  not certify cloud network failure, power loss or managed failover.

There were 42 observed blocking barriers in the complete run. A separate negative
mutation moved only release revocation back to release-first locking. C09 failed
with LOCK_ORDER_VIOLATION and an observed early release RowShareLock. The mutant
was never proposed for installation. This demonstrates test sensitivity, not a
Production incident. The final unmutated harness and SQL passed again.

The native harness/evidence are distributed with the conversation checkpoint,
not automatically run by repository CI. Its local test-only LOGIN roles use a
private trusted socket; they do not establish real machine authentication. C14
(first-publication integration) and C15 (authenticated response witness) remain
BLOCKED. The earlier 41-check managed rollback rehearsal is complete and its
one-use authorization was not reused.

An initial embedded-test harness attempted to restore session identity while a
negative-test transaction was aborted. The harness was corrected to roll back
before restoring identity; no candidate SQL or failing acceptance case was removed.

## Rollout boundary

Only tests import the SQL. No migration runner, handler, workflow or provider
configuration applies it. The publishing validator adds one awaited test import;
existing triggers, permissions, dependencies and lockfiles are unchanged.
A future persistent migration must use the supported Supabase migration workflow
and have its own exact approval for roles, API non-exposure and runtime grants.
All writer callers must adopt this API contract together; do not retain a legacy
raw writer alongside it and claim a complete lock-order repair.

The next implementation boundary remains first-public-admission and receipt
coupling. Required work also includes role/configuration authenticity, archive
bootstrap/outage behavior, every article/feed/list/sitemap/cache/hostname surface,
protected promotion/alias/rollback controls, complete Vercel evidence, and broader
event adapters. Isolated SQL correctness is not live calendar-publication safety.

## Primary references and earlier evidence

- https://www.postgresql.org/docs/17/explicit-locking.html
- https://www.postgresql.org/docs/17/sql-createfunction.html
- https://supabase.com/docs/guides/database/functions
- https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5609769818
- https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5609524527

Documentation describes database behavior; actual execution evidence belongs to
the dated native report and exact-head CI checkpoint, not these references alone.
