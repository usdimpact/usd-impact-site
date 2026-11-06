#!/usr/bin/env python3
"""UI02/UI03 + Research P1 combined negative tests; DISPOSABLE PostgreSQL only.

Run ONLY after owner_model_replay.py --ui-source=<pinned source>, never against
Development/Production. Both accounts and identities below are synthetic.
This exercises real UI02/UI03 SQL and real P1 Phase A, not mock table policies.
"""
import json
import uuid
import psycopg

DB="ci_review"
PASSED=0


def check(label, condition):
    global PASSED
    assert condition, f"UI_COMBINED_FAIL {label}"
    PASSED+=1
    print(f"[F3-UI-COMBINED] PASS {label}",flush=True)


def admin(sql,args=()):
    with psycopg.connect(dbname=DB,host="127.0.0.1",autocommit=True) as c:
        cur=c.execute(sql,args)
        return cur.fetchall() if cur.description else []


def user(account,sql,args=(),*,anonymous=False,claim_kind="claims",secondary=None):
    """Fresh connection: modern JSON-only, singular claim and legacy-sub cases."""
    with psycopg.connect(dbname=DB,host="127.0.0.1",autocommit=True) as c:
        c.execute("SET ROLE authenticated")
        payload={"sub":str(account),"is_anonymous":anonymous}
        if claim_kind=="legacy_sub":
            c.execute("SELECT set_config('request.jwt.claim.sub',%s,false)",(str(account),))
        else:
            c.execute("SELECT set_config(%s,%s,false)",
                      (f"request.jwt.{claim_kind}",json.dumps(payload)))
        if secondary is not None:
            c.execute("SELECT set_config('request.jwt.claims',%s,false)",
                      (json.dumps(secondary),))
        try:
            cur=c.execute(sql,args)
            return ("OK",cur.fetchall() if cur.description else [])
        except psycopg.Error as e:
            return ("ERR",e.sqlstate)


def service(sql,args=()):
    with psycopg.connect(dbname=DB,host="127.0.0.1",autocommit=True) as c:
        c.execute("SET ROLE service_role")
        cur=c.execute(sql,args)
        return cur.fetchall() if cur.description else []


def count(table,account):
    # table name is from the hardcoded allowlist below, never user input.
    assert table in ("account_transactional_locale_preferences",
                     "account_media_locale_preferences")
    return admin(f"SELECT count(*) FROM public.{table} WHERE account_id=%s",(account,))[0][0]


def setup(account,tag):
    email=f"f3-ui-{tag}-{account.hex[:12]}@invalid.example"
    admin("INSERT INTO auth.users(id,email) VALUES(%s,%s)",(account,email))
    if admin("SELECT count(*) FROM public.profiles WHERE account_id=%s",(account,))[0][0]==0:
        admin("INSERT INTO public.profiles(account_id,email) VALUES(%s,%s)",(account,email))
    assert admin("SELECT status::text FROM public.profiles WHERE account_id=%s",(account,))[0][0]=="active"


def main():
    a,b,c=uuid.uuid4(),uuid.uuid4(),uuid.uuid4()
    setup(a,"A");setup(b,"B");setup(c,"ANON")
    # C has a valid active profile but no preference row, so an anonymous
    # insert test cannot accidentally fail from a duplicate-key constraint.
    check("UI02 and UI03 tables installed",
          all(admin("SELECT to_regclass(%s) IS NOT NULL",(f"public.{table}",))[0][0]
              for table in ("account_transactional_locale_preferences",
                            "account_media_locale_preferences")))
    check("modern JSON-only JWT resolves auth.uid and auth.jwt",
          user(a,"SELECT auth.uid(),auth.jwt()->>'sub'")==("OK",[(a,str(a))]))
    check("legacy individual sub remains valid",
          user(a,"SELECT auth.uid()",claim_kind="legacy_sub")==("OK",[(a,)]))
    check("singular request.jwt.claim takes precedence over plural claims",
          user(a,"SELECT auth.jwt()->>'is_anonymous'",
               claim_kind="claim",anonymous=True,
               secondary={"sub":str(a),"is_anonymous":False})==("OK",[("true",)]))
    for account,locale in ((a,"es"),(b,"en")):
        for table,column in (
            ("account_transactional_locale_preferences","preferred_locale"),
            ("account_media_locale_preferences","preferred_media_locale"),
        ):
            result=user(account,
                 f"INSERT INTO public.{table}(account_id,{column}) VALUES(%s,%s) RETURNING revision",
                 (account,locale))
            check(f"{table} synthetic user {locale} inserts own preference",result==("OK",[(1,)]))
    for table,column in (
        ("account_transactional_locale_preferences","preferred_locale"),
        ("account_media_locale_preferences","preferred_media_locale"),
    ):
        a_value=admin(f"SELECT {column} FROM public.{table} WHERE account_id=%s",(a,))[0][0]
        b_view=user(b,f"SELECT {column} FROM public.{table} WHERE account_id=%s",(a,))
        check(f"{table} B cannot SELECT A",a_value=="es" and b_view==("OK",[]))
        b_update=user(b,
            f"UPDATE public.{table} SET {column}='en' WHERE account_id=%s RETURNING revision",(a,))
        check(f"{table} B cannot UPDATE A",
              (b_update==("OK",[]) or b_update[0]=="ERR")
              and admin(f"SELECT {column} FROM public.{table} WHERE account_id=%s",(a,))[0][0]=="es")
        b_insert=user(b,
            f"INSERT INTO public.{table}(account_id,{column}) VALUES(%s,'en')",(a,))
        check(f"{table} B cannot INSERT as A",
              b_insert[0]=="ERR"
              and count(table,a)==1)
        revision=user(a,
            f"UPDATE public.{table} SET revision=900 WHERE account_id=%s RETURNING revision",(a,))
        check(f"{table} authenticated cannot modify revision",
              revision[0]=="ERR"
              and admin(f"SELECT revision FROM public.{table} WHERE account_id=%s",(a,))[0][0]==1)
        anonymous=user(a,
            f"SELECT {column} FROM public.{table} WHERE account_id=%s",
            (a,),anonymous=True)
        check(f"{table} anonymous JWT cannot read own preference",
              anonymous==("OK",[]))
        # RLS must reject INSERT for an anonymous authenticated-role session
        # even when the subject owns an active profile and the row is new.
        assert count(table,c)==0, "anonymous insert fixture must start empty"
        anonymous_insert=user(c,
            f"INSERT INTO public.{table}(account_id,{column}) VALUES(%s,'es') RETURNING revision",
            (c,),anonymous=True)
        check(f"{table} anonymous JWT cannot INSERT own preference",
              anonymous_insert==("ERR","42501") and count(table,c)==0)
    export=user(a,"SELECT public.account_export()")
    check("account_export includes both independent UI preferences",
          export[0]=="OK" and isinstance(export[1][0][0],dict)
          and export[1][0][0].get("mediaLanguagePreference") is not None
          and export[1][0][0].get("transactionalLanguagePreference") is not None)
    for relation in ("notification_outbox","purchase_access_ready_locale_snapshots"):
        result=user(a,f"SELECT count(*) FROM public.{relation}")
        check(f"authenticated cannot read shared {relation}",result[0]=="ERR")
    for signature in ("public.ui02_enqueue_access_ready_atomic(uuid)",
                      "public.ui02_check_access_ready_dispatch(uuid,text)"):
        # Missing/renamed RPCs must fail, not silently reduce the assertion
        # count. Match the exact function signature, not just proname.
        matches=admin("SELECT oid::regprocedure::text FROM pg_proc WHERE oid=to_regprocedure(%s)",
                      (signature,))
        check(f"required UI02 RPC exists: {signature}",len(matches)==1)
        check(f"authenticated cannot EXECUTE {signature}",
              not admin("SELECT has_function_privilege('authenticated',%s::regprocedure,'EXECUTE')",
                        (signature,))[0][0])
    request=user(a,"SELECT public.request_account_deletion()")
    check("A deletion request accepted",request[0]=="OK")
    check("A preference retained during deletion_pending",
          admin("SELECT status::text FROM public.profiles WHERE account_id=%s",(a,))[0][0]=="deletion_pending"
          and count("account_transactional_locale_preferences",a)==1
          and count("account_media_locale_preferences",a)==1)
    for relation in ("account_transactional_locale_preferences",
                     "account_media_locale_preferences"):
        a_view=user(a,f"SELECT count(*) FROM public.{relation} WHERE account_id=%s",(a,))
        check(f"A stale JWT blocked during deletion_pending on {relation}",
              a_view==("OK",[(0,)]))
    admin("""UPDATE public.profiles SET
               deletion_due_at=now()-interval '1 minute',
               deletion_requested_at=now()-interval '31 days'
               WHERE account_id=%s""",(a,))
    phase=service("SELECT public.finalize_deletion_and_queue_auth_cleanup(%s)",(a,))
    check("real P1 Phase A deleted A database identity",
          phase and phase[0][0]["phase"]=="auth_pending"
          and admin("SELECT status::text FROM public.profiles WHERE account_id=%s",(a,))[0][0]=="deleted")
    for relation,column in (
        ("account_transactional_locale_preferences","preferred_locale"),
        ("account_media_locale_preferences","preferred_media_locale"),
    ):
        check(f"Phase A purges only A {relation}",
              count(relation,a)==0 and count(relation,b)==1)
        check(f"B preference remains readable after A purge {relation}",
              user(b,f"SELECT {column} FROM public.{relation} WHERE account_id=%s",(b,))
              ==("OK",[("en",)]))
        retry=user(a,
            f"INSERT INTO public.{relation}(account_id,{column}) VALUES(%s,'es')",(a,))
        check(f"deleted A stale JWT cannot recreate {relation}",retry[0]=="ERR")
    # Intentional count assertion catches removal of any control or a
    # future conditional branch that silently skips a security assertion.
    expected_assertions=38
    if PASSED!=expected_assertions:
        raise AssertionError(f"UI assertions unexpectedly skipped: {PASSED}/{expected_assertions}")
    print(f"F3_UI_SEMANTICS_DONE total={PASSED} pass={PASSED} fail=0",flush=True)


if __name__=="__main__":
    main()
