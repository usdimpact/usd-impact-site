# Production Vercel OAuth refresh-credential store - issue 558

## Status

Dormant source-only storage candidate for draft PR #559. Nothing in this increment creates database roles, schemas, rows, passwords, Vercel App credentials, OAuth tokens, Production environment variables, routes, deployments, publication authority, admissions, receipts, promotions, or merges.

The purpose of this module is to satisfy the versioned `loadRefreshCredential()` and compare-and-swap `replaceRefreshCredential()` callbacks required by `publication-production-vercel-oauth-bearer.js` without giving the runtime any publication-guard authority or generic secret-store authority.

## Storage choice

The reviewed store uses the existing Production guard Supabase/Postgres project `edkdqncrreouzmxqeypm`, but with a new dedicated runtime identity and a private table that contains only encrypted material.

Supabase Vault was inspected as an alternative. The live project has Vault installed, but current Supabase documentation marks Vault as public alpha. Using Vault would also require a privileged path capable of reading `vault.decrypted_secrets`, which is broader decrypted-secret authority than this runtime needs. This candidate therefore does not grant or depend on Vault access.

The chosen primitives are:

- GA PostgreSQL for durable row storage, row-level locking and compare-and-swap updates;
- Node `node:crypto` AES-256-GCM for encryption/decryption in trusted server code;
- a 32-byte encryption key stored only as a future Vercel Production secret;
- a dedicated Postgres login `fx558_oauth_store_login` with no publication-guard or Vault privileges; and
- a private singleton table `publication_provider_credential.vercel_oauth_refresh_state`.

The database never stores the plaintext refresh token, OAuth client secret, or AES key.

## Runtime environment contract

The dormant adapter requires these future Production-only inputs:

- `PUBLICATION_GUARD_VERCEL_OAUTH_STORE_DATABASE_URL` - Shared Supavisor transaction pooler URL for `fx558_oauth_store_login.edkdqncrreouzmxqeypm`, port 6543, database `postgres`, `sslmode=require`;
- `PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_CA_CERT` - the already reviewed Supabase production CA bundle; and
- `PUBLICATION_GUARD_VERCEL_OAUTH_STORE_KEY` - exactly 32 random bytes encoded as 64 lowercase hex characters.

The adapter only initializes in the exact Vercel Production project, GitHub repository and `main` branch context already pinned by the #558 authority design.

## Ciphertext record

The private singleton row contains only:

- `version bigint` - monotonically increasing CAS version;
- `key_fingerprint text` - SHA-256 of the 32-byte AES key, not the key itself;
- `nonce bytea` - 12-byte GCM nonce;
- `ciphertext bytea` - encrypted refresh token;
- `auth_tag bytea` - 16-byte GCM authentication tag; and
- `updated_at timestamptz`.

AES-GCM associated data binds every ciphertext to:

- Vercel project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`;
- Vercel team `team_1LuMlacGuM198mRjoID4O3Ct`;
- the exact store table;
- the credential version; and
- the AES key fingerprint.

A copied row, changed version, wrong encryption key, modified nonce/ciphertext/tag, or wrong project/team binding fails decryption closed.

## Compare-and-swap rotation

`loadRefreshCredential()` selects the singleton ciphertext row, verifies the key fingerprint, decrypts it, and returns exactly `{ token, version }`.

`replaceRefreshCredential({ expectedVersion, nextToken })`:

1. validates the expected version and the next opaque token;
2. computes `nextVersion = expectedVersion + 1`;
3. encrypts the next token using a new random 12-byte nonce and AAD bound to `nextVersion`;
4. performs one PostgreSQL `UPDATE ... WHERE singleton AND version = expectedVersion AND key_fingerprint = ... RETURNING version`;
5. accepts success only if exactly one row is returned at exactly `nextVersion`.

Concurrent instances therefore serialize through PostgreSQL row locking and the version predicate. A stale writer receives zero rows and fails closed. The adapter has no INSERT or DELETE path.

## Database privilege contract

The source-only SQL contract is `apps/web/docs/sql/publication-production-vercel-oauth-store-558.sql`.

It proposes:

- `fx558_oauth_store` - NOLOGIN, NOINHERIT, no superuser/createdb/createrole/replication/bypassrls;
- `fx558_oauth_store_login` - LOGIN, INHERIT, otherwise unprivileged, initially `PASSWORD NULL`;
- private schema `publication_provider_credential`;
- RLS enabled and forced on the singleton table;
- SELECT on the required store columns only;
- UPDATE on `version`, `nonce`, `ciphertext`, `auth_tag`, `updated_at` only;
- no INSERT, DELETE, TRUNCATE or schema CREATE;
- no direct access to `vault.secrets` or `vault.decrypted_secrets`; and
- explicit revocation of every publication reader/writer function already governed by #558.

The runtime adapter independently re-verifies these privileges at startup/rehearsal time and fails closed if they drift.

The SQL candidate intentionally creates no row and no password. It must not be applied under this source-only approval.

## Initial provisioning contract

A later separately approved provisioning sequence must preserve this order:

1. Freshly re-lock the exact #559 head/base, CI, Preview, Production deployment, and publication-store state.
2. Convert the reviewed SQL candidate into a real Supabase migration using the Supabase CLI migration workflow; review the exact generated migration before applying anything.
3. Apply only that reviewed migration to Production. Verify the new login remains passwordless, the store table is empty, RLS is forced, and all publication/Vault privileges are absent.
4. Register a dedicated Vercel App/OAuth client. Registration itself is protected and must not add a live application callback route to usd-impact.com merely for provisioning.
5. Install the App only on project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7` with exactly `read:project` and `read:deployment`. The documented command shape is `vercel oauth-apps install --client-id <ID> --permission read:project --permission read:deployment --projects prj_ZoLLM35ksI6wk17PcfS2xYknaVl7 --format json`.
6. Complete the one-time OAuth authorization-code bootstrap through an operator-controlled callback, exchange it for the initial access/refresh pair, and never persist the authorization code.
7. Generate the 32-byte AES key outside Postgres. Store it as the Production-only `PUBLICATION_GUARD_VERCEL_OAUTH_STORE_KEY`; do not put it in GitHub, issue comments, SQL literals, logs, or the database.
8. Use `preparePublicationProductionVercelOAuthStoreSeed()` locally to encrypt the initial refresh token at version `0`. Insert only the returned version, key fingerprint, nonce, ciphertext and auth tag through an administrator connection using bound parameters. Do not interpolate the token or ciphertext into committed SQL.
9. Set a separate high-entropy password for `fx558_oauth_store_login`, construct the exact Shared Supavisor URL, and store it as Production-only `PUBLICATION_GUARD_VERCEL_OAUTH_STORE_DATABASE_URL`.
10. Store the Vercel App client ID/client secret through separately reviewed Production-only secret inputs for the OAuth supplier composition. No access token is stored durably.
11. Run the store identity/privilege verification, one real refresh rotation, and the read-only provider rehearsal. The deployment-alias GET must succeed under exactly `read:project` + `read:deployment`; a 403 is a HOLD, not permission-expansion authority.
12. Verify the publication database still has revision `0`, zero authorizations and zero admissions before any later activation request.

Every step that mutates a provider, database, credential or Production environment remains separately protected.

## Key rotation

Rotating `PUBLICATION_GUARD_VERCEL_OAUTH_STORE_KEY` is not an ordinary refresh-token rotation. Because the key fingerprint is immutable to the runtime role, key rotation requires a separate administrator-controlled re-encryption transaction and new Production secret value. The runtime adapter intentionally cannot change `key_fingerprint`.

## Offline verification

`test-publication-production-vercel-oauth-store.mjs` verifies the adapter and the SQL contract using only fake pools and locally generated ciphertext. Coverage includes:

- exact Production/project/repository context;
- exact Shared Supavisor URL and dedicated database role;
- CA and 32-byte key validation;
- AES-256-GCM encryption/decryption and AAD binding;
- key-fingerprint mismatch and tamper rejection;
- singleton load shape;
- atomic expected-version CAS update shape;
- stale-version rejection;
- privilege drift detection;
- rejection of publication-guard and Vault access;
- database/provider error non-disclosure; and
- static SQL assertions preventing INSERT/DELETE/CREATE grants, SECURITY DEFINER use, Vault secret functions and public/service-role access.

The test does not create a database role, schema, table, row, password or OAuth credential and does not prove live provider permission mapping.

## Still protected / held

The following remain separate protected actions:

- converting/applying the SQL candidate as a Production migration;
- creating the store roles/table or setting the store login password;
- creating/storing the AES key or database URL;
- registering/installing the Vercel App;
- creating/storing OAuth client credentials or refresh credentials;
- seeding the encrypted singleton row;
- importing the store/OAuth supplier into a live Production route or authority composition;
- Production redeploy/promotion;
- live provider rehearsal;
- publication authorization/admission/receipt/witness creation; and
- merge of PR #559.

Keep #558 open and #559 draft/unmerged.
