# Publication-history PostgreSQL contract - issue 558

## Status and scope

This is a reviewed-test candidate for durable publication history, not an
installed Supabase migration, production admission writer, or release approval.
The executable SQL lives under `docs/sql/` deliberately: no migration runner,
HTTP route or live provider imports or applies it. Only the isolated PGlite
regression test executes it. Do not apply it to a live database without a
separately approved migration, roles and runtime integration.

This work continues draft PR 559 from `96916782227d2d1985c5b1cd39bd85e85d3198bd`
and main `058d4d893ab12ce7ddd51ad43154d02b8536ca59`. The existing BLS validators,
serving policy and native HTTP response boundary remain unchanged.

## Database objects and permission boundary

The prototype creates one private schema, `publication_guard`, and three tables:
`history_state`, `release_authorizations`, and `publication_admissions`. All tables
have RLS enabled. There are no application policies, public-schema objects,
SECURITY DEFINER functions, credentials, created login roles, or application
access grants. Schema/table/function access is explicitly revoked from PUBLIC,
anon, authenticated and service_role. Functions use SECURITY INVOKER and an empty
search path. The database owner is the test/control authority, not a runtime role.

A future migration must provide narrowly reviewed writer and reader privileges;
this draft does not borrow the website's existing service-role credential. The
schema must remain outside Data API exposure. Owner/superuser authority remains
an administrative trust boundary: this is not protection against a database
owner disabling triggers or rewriting control state.

## Transition and clock contract

An immutable release authorization records repository/team/project identity,
exact deployment, commit, artifact and approval digests, with a bounded expiry.
An authorization by itself creates no publication record.

New exact-content records start as `pending`, never `admitted`. Preparation and
finalization validate the current database wall clock after obtaining the release
row lock. They reject expired approval/evidence, future evidence, expired previews
and outcomes before their minimum release instant. No caller-supplied preparation
or admission timestamp is accepted. Evidence windows are at most fifteen minutes.

`finalize_admission` requires an existing exact release/path/content tuple and a
response-receipt digest. Replaying the identical finalized request returns
`ALREADY_RECORDED`, without changing its original timestamp or history revision.
A different receipt, revoked record, unknown release or changed source is held.
Release and item revocations are irreversible through the supported operations.
Evidence/content/binding fields cannot be rewritten and records cannot be deleted.
A failed statement or rolled-back transaction rolls back the history revision too.

The clock is `clock_timestamp()`, not `now()`, `CURRENT_TIMESTAMP` or
`transaction_timestamp()`. PostgreSQL's transaction-start time does not advance
while a transaction is waiting. A test opens a transaction before a short preview
deadline, waits past it, and verifies finalization is rejected. A local negative
mutation using transaction-start time instead fails that acceptance test.

**This is a mutation-time check, not a claim about the final WAL commit time or
remote packet arrival.** A transaction can continue after the checked mutation.
The eventual protected writer must run bounded autocommit operations and reconcile
unknown outcomes by read, not retry with fabricated fresh timestamps.

## Trust that storage cannot manufacture

Hash shape is not evidence authenticity. The protected upstream adapter still has
to verify authoritative event identity/reference period/time/phase, the actual
source and built artifact inventory, the specifically approved public deployment,
and that the response receipt belongs to these exact bytes and to a successful
eligible public-serving decision. This SQL does not parse BLS pages, inspect
Vercel roles, cryptographically verify receipts, or prove public exposure.

In particular, do not call finalization for a private Preview, a preflight PASS,
a build, an uncompleted response, or a response that first became eligible after
expiry. No such integration or runtime grant exists in this increment. The
already-recorded-only HTTP boundary cannot serve the first admission by itself;
the separate first-admission/receipt integration remains required.

Legacy-baseline seeding, outage-safe archive snapshots and authenticated authority
adapters remain unimplemented. This SQL does not invent earlier publication dates
or retrospectively certify existing archives. Previously admitted records remain
readable after ordinary approval/evidence expiry, but are denied after revocation.

## Consistent history interface

`read_history(revision, keys)` returns the exact `revision`/`records` shape consumed
by the serving policy. It rejects stale revisions, unbounded/duplicate/unknown keys
and returns explicit null records for missing content. A STABLE function reads
revision, records and revocations from its calling statement's snapshot. This is
snapshot consistency, not protection against later revocation after that snapshot.
Authority rereads and final-response checks remain necessary. The test connects
this SQL reader to the existing policy: pending -> no projected content, admitted
-> one fixture item, revoked -> no projected content.

## Verification and limitations

The 64 database groups execute real PostgreSQL statements in existing pinned
PGlite 0.5.8, using temporary disk-backed storage and a close/reopen persistence
test. The engine identifies itself as PostgreSQL 18.3. These are not mocked SQL
results. Event evidence, release authorization and receipt hashes are synthetic.

Development Supabase was inspected with read-only metadata queries: it reports
PostgreSQL 17.6 and had no application publication-history schema/table. No live
DDL/DML, migration, role, key, provider setting or customer data was changed.
**Native PostgreSQL 17.6, separate-session contention, deadlocks, network failure,
provider failover, receipt authenticity and live HTTP/cache cutover are not proved
by single-engine PGlite tests.** The PostgreSQL 17 documentation was checked for
clock, STABLE snapshot and privilege semantics; documentation is not target-runtime
execution evidence.

The existing 532 calendar/serving/HTTP groups plus these 64 database groups run
through `validate:publishing` (596 total). No dependency or lockfile changes are
needed. CI/Preview evidence belongs in the exact-head PR checkpoint, not an
assumption that this document constitutes a passing release check.

## Next gated action

Review this SQL as a Development-only candidate, generate a proper migration with
the supported Supabase tooling, and obtain exact authorization before applying it.
Then verify native target-engine behavior and design narrowly scoped runtime roles
and authenticated receipt integration. Keep Production, existing application
schemas, event coverage, branch protections and commerce/access controls unchanged.
The missing raw Vercel control/artifact evidence and broader calendar adapters
remain independent release blockers. Keep issue 558 open and PR 559 draft.

## Primary technical references

- https://www.postgresql.org/docs/17/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT
- https://www.postgresql.org/docs/17/xfunc-volatility.html
- https://www.postgresql.org/docs/17/sql-createfunction.html
- https://supabase.com/docs/guides/database/postgres/row-level-security
