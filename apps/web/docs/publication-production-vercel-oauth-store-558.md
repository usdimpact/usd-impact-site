# Production Vercel OAuth refresh-credential store - issue 558

## Current status: retained dormant, no longer preferred

The reviewed OAuth refresh-credential store migration is installed in Production Supabase project `edkdqncrreouzmxqeypm` and remains deliberately dormant.

Post-apply verification established:

- private schema and dedicated roles are present;
- RLS is enabled and forced;
- the store contains **zero credential rows**;
- `fx558_oauth_store_login` remains `PASSWORD NULL`;
- publication revision remains `0`;
- release authorizations remain `0`;
- publication admissions remain `0`;
- neither OAuth-store role has publication-function authority; and
- neither OAuth-store role has Supabase Vault authority.

Supabase recorded the successful migration as version `20260915164854`; the repository is reconciled to that version.

## Architecture supersession

The store was created for an earlier source-only plan in which the application would own a Vercel OAuth client secret, encrypted refresh token, refresh-token rotation and a dedicated runtime database credential.

Before any such credential was provisioned, the preferred provider credential boundary changed to **Vercel Connect + project OIDC**. The dormant bearer module now requests short-lived provider credentials through Vercel Connect instead of loading an application-owned refresh token.

Therefore the following previously planned actions are **retired from the preferred path and must not be performed**:

- setting a password for `fx558_oauth_store_login`;
- creating `PUBLICATION_GUARD_VERCEL_OAUTH_STORE_KEY`;
- creating `PUBLICATION_GUARD_VERCEL_OAUTH_STORE_DATABASE_URL`;
- registering an application-managed Vercel OAuth client for this store;
- creating/storing a Vercel OAuth client secret;
- completing an application-owned authorization-code callback bootstrap;
- inserting an encrypted refresh-token singleton row; or
- exercising refresh-token rotation through this table.

No cleanup/drop migration is performed. Dropping the schema/roles/table would be a separate Production database mutation with no security benefit while the objects remain empty, passwordless, forced-RLS and authority-isolated.

## Repository provenance

The reviewed SQL contract remains:

`apps/web/docs/sql/publication-production-vercel-oauth-store-558.sql`

The canonical repository migration remains:

`supabase/migrations/20260915164854_publication_production_vercel_oauth_store_558.sql`

The migration intentionally created no credential row, database password, AES key or OAuth credential. Those invariants remain the desired live state under the Connect design.

## Historical privilege design

The installed migration prepared:

- `fx558_oauth_store` — NOLOGIN, NOINHERIT, non-superuser, no createdb/createrole/replication/bypassrls;
- `fx558_oauth_store_login` — LOGIN, INHERIT, otherwise unprivileged, with `PASSWORD NULL`;
- membership `INHERIT TRUE / SET FALSE / ADMIN FALSE`;
- private schema `publication_provider_credential`;
- forced RLS on `publication_provider_credential.vercel_oauth_refresh_state`;
- column-scoped SELECT of ciphertext material;
- column-scoped UPDATE for CAS rotation fields only;
- no INSERT, DELETE, TRUNCATE or schema CREATE;
- no Vault access; and
- no effective EXECUTE authority on #558 publication reader/writer functions.

The private singleton schema contains only version, key fingerprint, nonce, ciphertext, authentication tag and timestamp columns; it has never contained a real OAuth credential.

## Historical adapter

`publication-production-vercel-oauth-store.js` remains source-only historical scaffolding and is not imported into Middleware, an API route or live Production authority composition.

Its offline regression may remain because it proves that the already-applied dormant database objects are narrow and fail closed. Passing that regression does **not** mean the store should be provisioned.

## Preferred next provider step

The preferred Vercel provider credential path is documented in `publication-production-vercel-oauth-bearer-558.md` and now requires only:

1. a Vercel Connect **Vercel** connector authorized under the USD Impact team;
2. a project/environment link restricted to project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7` and Production;
3. provider token requests restricted to `read:project` + `read:deployment`;
4. the non-secret connector ID exposed as `PUBLICATION_GUARD_VERCEL_CONNECTOR_ID`; and
5. one read-only live provider rehearsal before any later activation.

## Still protected / held

The following remain separate protected actions:

- creating/authorizing/linking the Vercel Connect connector;
- setting the non-secret connector ID in Production configuration;
- importing the Connect bearer/provider loader into live Production authority composition;
- Production redeploy/promotion;
- live provider rehearsal;
- publication authorization/admission/receipt/witness creation; and
- merge of PR #615.

Do not provision this legacy refresh store without a new explicit design decision and fresh exact-head review. Keep #558 open and #615 draft/unmerged.
