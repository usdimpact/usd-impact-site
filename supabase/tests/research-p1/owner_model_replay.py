#!/usr/bin/env python3
"""Research P1 fixture (from the D2-32 reviewer harness): Production-like OWNERSHIP model. Stubs as superuser; all 52 migrations
executed by non-superuser role `postgres` (LOGIN CREATEROLE BYPASSRLS, as Supabase's
migration runner is assumed to be — NOT VERIFIED). Optional overlays as superuser.
Usage: owner_model.py <repo> [overlays]"""
import sys, psycopg
from pathlib import Path
repo=Path(sys.argv[1]); overlays="overlays" in sys.argv
MIG=sorted((repo/"supabase/migrations").glob("*.sql"))
with psycopg.connect(dbname="ci_review", autocommit=True) as c:
    c.execute("""
create role postgres login createrole bypassrls nosuperuser;
create role anon nologin; create role authenticated nologin;
create role service_role nologin bypassrls; create role authenticator nologin noinherit;
grant anon, authenticated, service_role to postgres;
create schema extensions; create extension pgcrypto with schema extensions;
create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable set search_path='' as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,
  allowed_mime_types text[],owner uuid,created_at timestamptz default now(),updated_at timestamptz default now());
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid,metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema auth,extensions,storage to postgres,anon,authenticated,service_role;
grant all on auth.users to postgres; grant execute on all functions in schema auth,extensions to postgres;
grant select,insert,update on storage.buckets to postgres;
grant all on schema public to postgres; grant create on database ci_review to postgres;""")
    c.execute("SET ROLE postgres")
    ok=0
    for f in MIG:
        try: c.execute(f.read_text("utf8")); ok+=1
        except psycopg.Error as e:
            print("FAIL",f.name,e.sqlstate,str(e).splitlines()[0]); break
    c.execute("RESET ROLE"); c.execute("reset lock_timeout; reset statement_timeout")
    print(f"OWNER-MODEL REPLAY {ok}/{len(MIG)} as postgres", flush=True)
    print("owners:", c.execute("select string_agg(distinct pg_get_userbyid(relowner),',') from pg_class where relnamespace='public'::regnamespace and relkind='r'").fetchone()[0])
    if overlays:
        C=repo/"docs/operations"
        c.execute((C/"research-ordering-stage-c/real_schema_ordering_review.sql").read_text())
        c.execute((C/"research-ordering-stage-n/b5_m1_strict_pinned_review_only.sql").read_text())
        c.execute("INSERT INTO research_checkout_guard.allowed_variants(store_id,product_id,variant_id,billing_interval,test_mode) VALUES('41','research-membership','313','monthly',true)")
        for st,f in (("e","segmented_caller_review.sql"),("f","strict_witness_review.sql"),("h","receipt_journal_review.sql"),("i","journal_hardening_review.sql"),("j","invoice_journal_review.sql"),("k","conflict_observation_review.sql"),("l","first_activation_review.sql"),("m","canonical_bridge_review.sql"),("n","locked_first_purchase_review.sql")):
            c.execute((C/f"research-ordering-stage-{st}/{f}").read_text())
        c.execute((C/"research-ordering-stage-o/b5_pending_guard_review.sql").read_text())
        c.execute((C/"research-ordering-stage-p/strict_consumed_handoff_review.sql").read_text())
        print("OVERLAYS applied by superuser on postgres-owned schema", flush=True)
