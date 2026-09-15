-- Issue #558 reviewed repository migration.
-- Generated filename: Supabase CLI 2.117.0, workflow run 34993123353.
-- Prepared only. Applying this migration to a live database is a separate protected action.
-- Creates no credential row, no database password, no AES key, and no OAuth credential.
-- Plaintext refresh credentials, OAuth client secrets, and the AES key must never be stored here.

begin;

do $$
begin
  if to_regnamespace('publication_provider_credential') is not null then
    raise exception 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_SCHEMA_PRESENT';
  end if;
  if exists (select 1 from pg_roles where rolname in ('fx558_oauth_store','fx558_oauth_store_login')) then
    raise exception 'HOLD_PRODUCTION_VERCEL_OAUTH_STORE_ROLE_PRESENT';
  end if;
end $$;

create role fx558_oauth_store
  nologin
  noinherit
  nosuperuser
  nocreaterole
  nocreatedb
  noreplication
  nobypassrls;

create role fx558_oauth_store_login
  login
  inherit
  nosuperuser
  nocreaterole
  nocreatedb
  noreplication
  nobypassrls
  password null;

grant fx558_oauth_store to fx558_oauth_store_login with inherit true, set false, admin false;

create schema publication_provider_credential;
revoke all on schema publication_provider_credential from public, anon, authenticated, service_role;
grant usage on schema publication_provider_credential to fx558_oauth_store;

create table publication_provider_credential.vercel_oauth_refresh_state (
  singleton boolean primary key default true check (singleton),
  version bigint not null check (version >= 0),
  key_fingerprint text not null check (key_fingerprint ~ '^[a-f0-9]{64}$'),
  nonce bytea not null check (octet_length(nonce) = 12),
  ciphertext bytea not null check (octet_length(ciphertext) between 20 and 8192),
  auth_tag bytea not null check (octet_length(auth_tag) = 16),
  updated_at timestamptz not null default transaction_timestamp()
);

alter table publication_provider_credential.vercel_oauth_refresh_state enable row level security;
alter table publication_provider_credential.vercel_oauth_refresh_state force row level security;

revoke all on table publication_provider_credential.vercel_oauth_refresh_state
  from public, anon, authenticated, service_role, fx558_oauth_store, fx558_oauth_store_login;

grant select (
  singleton,
  version,
  key_fingerprint,
  nonce,
  ciphertext,
  auth_tag,
  updated_at
) on publication_provider_credential.vercel_oauth_refresh_state to fx558_oauth_store;

grant update (
  version,
  nonce,
  ciphertext,
  auth_tag,
  updated_at
) on publication_provider_credential.vercel_oauth_refresh_state to fx558_oauth_store;

create policy vercel_oauth_refresh_select
on publication_provider_credential.vercel_oauth_refresh_state
for select
to fx558_oauth_store
using (singleton);

create policy vercel_oauth_refresh_update
on publication_provider_credential.vercel_oauth_refresh_state
for update
to fx558_oauth_store
using (singleton)
with check (singleton);

-- Runtime must not gain access to publication authority or Supabase Vault.
revoke all on schema vault from fx558_oauth_store, fx558_oauth_store_login;
revoke all on table vault.secrets from fx558_oauth_store, fx558_oauth_store_login;
revoke all on table vault.decrypted_secrets from fx558_oauth_store, fx558_oauth_store_login;

revoke execute on function publication_guard_api.read_current_revision()
  from fx558_oauth_store, fx558_oauth_store_login;
revoke execute on function publication_guard_api.read_snapshot(text,jsonb)
  from fx558_oauth_store, fx558_oauth_store_login;
revoke execute on function publication_guard_api.authorize_release(uuid,text,text,text,text,timestamptz)
  from fx558_oauth_store, fx558_oauth_store_login;
revoke execute on function publication_guard_api.prepare_admission(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz)
  from fx558_oauth_store, fx558_oauth_store_login;
revoke execute on function publication_guard_api.record_verified_receipt(uuid,text,text,text)
  from fx558_oauth_store, fx558_oauth_store_login;
revoke execute on function publication_guard_api.revoke_release(uuid)
  from fx558_oauth_store, fx558_oauth_store_login;
revoke execute on function publication_guard_api.revoke_admission(uuid,text,text)
  from fx558_oauth_store, fx558_oauth_store_login;

-- The migration intentionally creates no row and no password.
-- A later separately approved provisioning step must:
-- 1. set a high-entropy password for fx558_oauth_store_login;
-- 2. generate a 32-byte AES key outside Postgres and store it only in Vercel Production secrets;
-- 3. encrypt the initial refresh token outside Postgres using the reviewed application helper;
-- 4. insert exactly one singleton row through an administrator connection using bound parameters;
-- 5. verify the runtime login has SELECT+UPDATE only and no publication/Vault authority.

commit;
