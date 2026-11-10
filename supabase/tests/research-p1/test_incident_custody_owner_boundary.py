#!/usr/bin/env python3
"""Non-deployable #1103 PG17 laboratory for table-owner custody separation."""
import uuid
import psycopg

COUNT=0
def ck(label,yes,detail=None):
    global COUNT
    COUNT+=1
    print(f"[P1-CUSTODY-LAB] {'PASS' if yes else 'FAIL'} #{COUNT}: {label} {str(detail)[:100]}",flush=True)
    if not yes: raise AssertionError(label)

def attempt(role,sql,values=()):
    with psycopg.connect(dbname='ci_review',autocommit=True) as c:
        if role:
            # Unlike SET ROLE alone, this removes the superuser session identity
            # from subsequent authorization checks in this fresh connection.
            c.execute('SET SESSION AUTHORIZATION '+role)
        try:
            q=c.execute(sql,values)
            return ('OK',q.fetchone()[0] if q.description else q.rowcount)
        except psycopg.Error as e:
            return ('ERR',e.sqlstate)

def require(role,sql,values=()):
    r=attempt(role,sql,values)
    ck('expected allowed: '+sql[:38],r[0]=='OK',r)
    return r[1]

with psycopg.connect(dbname='ci_review',autocommit=True) as c:
    ck('only disposable ci_review database',c.execute('select current_database()').fetchone()[0]=='ci_review')
    ck('bootstrap has superuser authority, not the application owner',
       c.execute('select rolsuper from pg_roles where rolname=current_user').fetchone()[0])
    for r in ('p1lab_guard_owner','p1lab_provider_ingress','p1lab_owner_decider'):
        c.execute('CREATE ROLE '+r+' NOLOGIN NOINHERIT NOSUPERUSER NOCREATEROLE')
    c.execute('CREATE SCHEMA p1lab_custody AUTHORIZATION p1lab_guard_owner')
    c.execute('GRANT USAGE ON SCHEMA p1lab_custody TO postgres,p1lab_provider_ingress,p1lab_owner_decider')
    c.execute('SET ROLE p1lab_guard_owner')
    c.execute('''CREATE TABLE p1lab_custody.events(
      account_id uuid not null,generation bigint not null,
      digest text not null check(digest ~ '^[a-f0-9]{64}$'),
      primary key(account_id,generation))''')
    c.execute('''CREATE TABLE p1lab_custody.decisions(
      account_id uuid not null,generation bigint not null,digest text not null,
      primary key(account_id,generation))''')
    for table in ('events','decisions'):
        c.execute('ALTER TABLE p1lab_custody.'+table+' ENABLE ROW LEVEL SECURITY')
        c.execute('REVOKE ALL ON p1lab_custody.'+table+' FROM PUBLIC,anon,authenticated,service_role,postgres')
    c.execute('''CREATE FUNCTION p1lab_custody.record_event(p_account uuid,p_gen bigint,p_digest text)
      RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
      BEGIN
        IF p_account IS NULL OR p_gen < 1 OR p_digest !~ '^[a-f0-9]{64}$' THEN
          RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='bad synthetic financial event';
        END IF;
        INSERT INTO p1lab_custody.events VALUES(p_account,p_gen,p_digest);
        RETURN true;
      END $f$''')
    c.execute('''CREATE FUNCTION p1lab_custody.record_decision(p_account uuid,p_gen bigint,p_digest text)
      RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
      BEGIN
        IF NOT EXISTS(SELECT 1 FROM p1lab_custody.events e
          WHERE e.account_id=p_account AND e.generation=p_gen AND e.digest=p_digest) THEN
          RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner decision has no event';
        END IF;
        INSERT INTO p1lab_custody.decisions VALUES(p_account,p_gen,p_digest);
        RETURN true;
      END $f$''')
    for fn in ('record_event','record_decision'):
        c.execute('REVOKE ALL ON FUNCTION p1lab_custody.'+fn+'(uuid,bigint,text) FROM PUBLIC,anon,authenticated,service_role,postgres')
    c.execute('GRANT EXECUTE ON FUNCTION p1lab_custody.record_event(uuid,bigint,text) TO p1lab_provider_ingress')
    c.execute('GRANT EXECUTE ON FUNCTION p1lab_custody.record_decision(uuid,bigint,text) TO p1lab_owner_decider')
    c.execute('RESET ROLE')
    c.execute('''CREATE TABLE p1lab_custody.mutable_incidents(
      account_id uuid not null,generation bigint not null,digest text not null,
      primary key(account_id,generation))''')
    c.execute('ALTER TABLE p1lab_custody.mutable_incidents OWNER TO postgres')
    c.execute('GRANT SELECT ON p1lab_custody.mutable_incidents TO p1lab_guard_owner')
    c.execute('''CREATE TRIGGER p1lab_no_delete BEFORE DELETE
      ON p1lab_custody.mutable_incidents FOR EACH ROW
      EXECUTE FUNCTION research_lifecycle_private.reject_append_only_change()''')
    c.execute('SET ROLE p1lab_guard_owner')
    c.execute('''CREATE FUNCTION p1lab_custody.can_release(p_account uuid)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
      SELECT EXISTS(SELECT 1 FROM p1lab_custody.events e WHERE e.account_id=p_account)
        AND NOT EXISTS(
         SELECT 1 FROM p1lab_custody.events e
         LEFT JOIN p1lab_custody.mutable_incidents i
           ON i.account_id=e.account_id AND i.generation=e.generation AND i.digest=e.digest
         LEFT JOIN p1lab_custody.decisions d
           ON d.account_id=e.account_id AND d.generation=e.generation AND d.digest=e.digest
         WHERE e.account_id=p_account AND (i.account_id IS NULL OR d.account_id IS NULL))
      $f$''')
    c.execute('REVOKE ALL ON FUNCTION p1lab_custody.can_release(uuid) FROM PUBLIC,anon,authenticated,service_role')
    c.execute('GRANT EXECUTE ON FUNCTION p1lab_custody.can_release(uuid) TO postgres')
    c.execute('RESET ROLE')

account=uuid.uuid4()
A='a'*64
B='b'*64
def state():
    return attempt('postgres','SELECT p1lab_custody.can_release(%s)',(account,))
ck('application operator cannot inherit separately created custody owner',
   attempt('postgres',"SELECT pg_has_role(current_user,'p1lab_guard_owner','MEMBER')")==('OK',False))
ck('application operator cannot SET ROLE to independent custody owner',
   attempt('postgres','SET ROLE p1lab_guard_owner')[0]=='ERR')
ck('application CREATEROLE user cannot self-grant custody owner ADMIN',
   attempt('postgres','GRANT p1lab_guard_owner TO postgres WITH SET TRUE')[0]=='ERR')
ck('operator cannot disable independent journal triggers',
   attempt('postgres','ALTER TABLE p1lab_custody.events DISABLE TRIGGER USER')[0]=='ERR')
ck('operator cannot delete independent financial events',
   attempt('postgres','DELETE FROM p1lab_custody.events')[0]=='ERR')
ck('operator cannot truncate independent owner decisions',
   attempt('postgres','TRUNCATE p1lab_custody.decisions')[0]=='ERR')
ck('operator cannot impersonate trusted event ingress',
   attempt('postgres','SELECT p1lab_custody.record_event(%s,1,%s)',(account,A))[0]=='ERR')
ck('operator cannot mint independent owner decisions',
   attempt('postgres','SELECT p1lab_custody.record_decision(%s,1,%s)',(account,A))[0]=='ERR')
ck('release fails closed with no external event evidence',state()==('OK',False),state())
require('p1lab_provider_ingress','SELECT p1lab_custody.record_event(%s,1,%s)',(account,A))
require('postgres','INSERT INTO p1lab_custody.mutable_incidents VALUES(%s,1,%s)',(account,A))
ck('event without separate owner decision cannot release',state()==('OK',False),state())
require('p1lab_owner_decider','SELECT p1lab_custody.record_decision(%s,1,%s)',(account,A))
ck('complete synthetic evidence can satisfy LAB-only predicate',state()==('OK',True),state())
ck('original owner-owned trigger blocks ordinary incident DELETE',
   attempt('postgres','DELETE FROM p1lab_custody.mutable_incidents WHERE account_id=%s',(account,))[0]=='ERR')
require('postgres','ALTER TABLE p1lab_custody.mutable_incidents DISABLE TRIGGER USER')
require('postgres','DELETE FROM p1lab_custody.mutable_incidents WHERE account_id=%s',(account,))
require('postgres','ALTER TABLE p1lab_custody.mutable_incidents ENABLE TRIGGER USER')
ck('owner DDL trigger-disable + incident DELETE cannot suppress independent journal',
   state()==('OK',False),state())
require('postgres','INSERT INTO p1lab_custody.mutable_incidents VALUES(%s,1,%s)',(account,A))
require('p1lab_provider_ingress','SELECT p1lab_custody.record_event(%s,2,%s)',(account,B))
require('postgres','INSERT INTO p1lab_custody.mutable_incidents VALUES(%s,2,%s)',(account,B))
ck('new financial generation invalidates old owner decision',state()==('OK',False),state())
require('p1lab_owner_decider','SELECT p1lab_custody.record_decision(%s,2,%s)',(account,B))
ck('separate new decision resolves synthetic second generation',state()==('OK',True),state())
print(f'[P1-CUSTODY-LAB] {COUNT} disposable PG17 assertions PASS; not a deployable solution.',flush=True)
