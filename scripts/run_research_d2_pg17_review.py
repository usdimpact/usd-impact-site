#!/usr/bin/env python3
"""Isolated CI only. No external DB, no payment, no provider, no privileges outside fixture."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import uuid

import psycopg

ROOT = Path(os.environ['GITHUB_WORKSPACE']).resolve()
FIX = ROOT / 'docs' / 'operations' / 'research-d2-pg17'
MODE = os.environ['D2_SCENARIO']
assert MODE in {'S1a', 'S1b', 'S1c', 'S2'}
assert os.environ.get('PGHOST') == '127.0.0.1'
assert os.environ.get('PGPORT') == '5432'
assert os.environ.get('PGUSER') == 'ci_research'
assert os.environ.get('PGDATABASE') == 'ci_review'
assert os.environ.get('PGPASSWORD') == 'ci_fixture_only_password'
assert os.environ.get('VERCEL_ENV', '') == ''
assert os.environ.get('SUPABASE_URL', '') == ''
assert os.environ.get('DATABASE_URL', '') == ''
assert os.environ.get('LEMON_SQUEEZY_API_KEY', '') == ''

MIGRATIONS = [
 '20260729203000_paid_access_foundation.sql',
 '20260905201000_research_membership_recurring_foundation.sql',
 '20260906004500_research_membership_transition_persistence.sql',
 '20260906104500_research_membership_performance_hardening.sql',
 '20260906180500_research_membership_service_role_grants.sql',
 '20260907154500_research_membership_first_purchase_binding.sql',
]

EXPECTED_SHA = {
 'M1_strict_matrix_review_only.sql': 'e936e18f1ed78743e77d2b158e562af07b0aedcd62d85efed08ab95244b2ea74',
 'M1_dark_install.sql': 'fc6fd5053ade3cd3feda2544cf39d3efb8e349635d45625e9851c34ec557d0a4',
}

def conn(user='ci_research', database='d2', password='ci_fixture_only_password'):
    return psycopg.connect(host='127.0.0.1', port=5432, dbname=database,
                           user=user, password=password, autocommit=True, connect_timeout=5)

def first(query, values=None):
    with conn() as c:
        return c.execute(query, values).fetchone()[0]

def psql(content, user='postgres', database='d2', success=True, label='SQL'):
    env = {**os.environ, 'PGPASSWORD': ('synthetic_pg' if user == 'postgres' else 'ci_fixture_only_password')}
    p = subprocess.run(['psql', '-X', '-h', '127.0.0.1', '-p', '5432', '-U', user,
                        '-d', database, '-v', 'ON_ERROR_STOP=1', '--quiet'],
                       input=content, text=True, capture_output=True, env=env, timeout=85)
    if success and p.returncode:
        raise AssertionError(f'{label} failed unexpectedly: {p.stderr[-1800:]}')
    if not success and not p.returncode:
        raise AssertionError(f'{label} succeeded unexpectedly')
    if success and 'WARNING' in p.stderr:
        raise AssertionError(f'{label} emitted warnings: {p.stderr[-1200:]}')
    print(('PASS ' if p.returncode == 0 else 'EXPECTED FAIL ') + label +
          (f' [{p.stderr[-160:].strip()}]' if p.returncode else ''), flush=True)
    return p

def fixture(name):
    return (FIX / name).read_text(encoding='utf-8')

def snapshot():
    return first('''SELECT
    (SELECT count(*) FROM pg_catalog.pg_namespace WHERE nspname='research_checkout_guard')::text || '|' ||
    (SELECT count(*) FROM pg_catalog.pg_proc WHERE proname IN ('issue_research_membership_checkout_intent',
      'attach_research_membership_checkout_intent','observe_signed_research_subscription_created',
      'bind_research_membership_with_checkout_intent','hold_binding_conflict'))::text || '|' ||
    (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname LIKE 'review_checkout_%')::text || '|' ||
    (SELECT count(*) FROM pg_catalog.pg_policies WHERE policyname LIKE 'research_b5_owner_%')::text || '|' ||
    (SELECT count(*) FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r
      ON r.oid=m.roleid WHERE r.rolname LIKE 'review_checkout_%')::text || '|' ||
    (SELECT md5(coalesce(proacl::text,'null')) FROM pg_catalog.pg_proc
      WHERE proname='bind_research_membership_subscription') || '|' ||
    md5(coalesce((SELECT nspacl::text FROM pg_catalog.pg_namespace WHERE nspname='public'),'')) || '|' ||
    md5(coalesce((SELECT nspacl::text FROM pg_catalog.pg_namespace WHERE nspname='extensions'),''))''')

def assert_rolls_back(label, sql):
    before = snapshot()
    p = psql(sql, success=False, label=label)
    after = snapshot()
    assert before == after, f'{label}: rollback mismatch before={before} after={after}'
    print('PASS atomic rollback for', label, flush=True)
    return p

def strict_mutation(label, name):
    content = fixture('M1_strict_matrix_review_only.sql')
    if name == 'missing_attach':
        pat = re.compile(r'grant execute on function public\.attach_research_membership_checkout_intent\(\s*uuid,text,text\) to review_checkout_issuer;', re.I)
        content, changed = pat.subn('-- missing attach GRANT for synthetic negative fixture', content)
    elif name == 's4a_no_set_path':
        pat = re.compile(r'grant review_checkout_owner to postgres with inherit false, set true;', re.I)
        content, changed = pat.subn('-- synthetic fault: no temporary owner SET path', content)
    elif name == 's4b_missing_binder':
        pat = re.compile(r'grant execute on function public\.bind_research_membership_with_checkout_intent\(\s*uuid,text,text,text,text,text,timestamptz,text,text,text,text,boolean,text,text\)\s*to review_checkout_binder;', re.I)
        content, changed = pat.subn('-- synthetic fault: missing binder grant', content)
    elif name == 's4c_no_service_revoke':
        pat = re.compile(r'(revoke all on function public\.bind_research_membership_with_checkout_intent\(\s*uuid,text,text,text,text,text,timestamptz,text,text,text,text,boolean,text,text\)\s*from public,anon,authenticated),service_role;', re.I)
        content, changed = pat.subn(lambda m: m.group(1)+';', content)
    elif name in ('issuer_bind_overgrant', 'binder_observe_overgrant', 'verifier_bind_overgrant'):
        authority, function = {
            'issuer_bind_overgrant': ('review_checkout_issuer',
                'public.bind_research_membership_with_checkout_intent(uuid,text,text,text,text,text,timestamptz,text,text,text,text,boolean,text,text)'),
            'binder_observe_overgrant': ('review_checkout_binder',
                'public.observe_signed_research_subscription_created(text,text,text,text,text,text,boolean,timestamptz,text,uuid,text,text,text)'),
            'verifier_bind_overgrant': ('review_checkout_verifier',
                'public.bind_research_membership_with_checkout_intent(uuid,text,text,text,text,text,timestamptz,text,text,text,text,boolean,text,text)'),
        }[name]
        pat = re.compile(r'grant review_checkout_owner to postgres with inherit false, set true;', re.I)
        content, changed = pat.subn(
            lambda m: f'grant execute on function {function} to {authority};\n' + m.group(0),
            content
        )
    elif name == 'cross_overgrant':
        match = re.compile(r'grant review_checkout_owner to postgres with inherit false, set true;', re.I)
        injection = '''grant execute on function public.issue_research_membership_checkout_intent(uuid,text,text,text,text,boolean,text) to review_checkout_verifier;
''' + match.pattern.replace('\\', '')
        content, changed = match.subn(lambda m: injection, content)
    else:
        raise ValueError(name)
    assert changed == 1, f'Expected single SQL mutation for {label}, observed {changed}'
    return content

def acl_matrix():
    fns = {
      'issue': 'public.issue_research_membership_checkout_intent(uuid,text,text,text,text,boolean,text)',
      'attach': 'public.attach_research_membership_checkout_intent(uuid,text,text)',
      'observe': 'public.observe_signed_research_subscription_created(text,text,text,text,text,text,boolean,timestamptz,text,uuid,text,text,text)',
      'bind': 'public.bind_research_membership_with_checkout_intent(uuid,text,text,text,text,text,timestamptz,text,text,text,text,boolean,text,text)',
      'hold': 'research_checkout_guard.hold_binding_conflict(uuid,text,text)',
      'trigger': 'research_checkout_guard.reject_evidence_mutation()'
    }
    expected = {'review_checkout_issuer': {'issue', 'attach'}, 'review_checkout_verifier': {'observe'},
                'review_checkout_binder': {'bind'}}
    roles = ('anon','authenticated','service_role','authenticator','review_checkout_issuer',
             'review_checkout_verifier','review_checkout_binder')
    with conn() as c:
        for name, function in fns.items():
            for role in roles:
                actual = c.execute('SELECT has_function_privilege(%s,%s,%s)', (role,function,'EXECUTE')).fetchone()[0]
                want = name in expected.get(role,set())
                assert actual is want, f'role ACL mismatch {role}:{name} actual={actual}, expected={want}'
            public_grant = c.execute('''SELECT exists(SELECT 1 FROM pg_catalog.pg_proc p
                  CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
                  WHERE p.oid = %s::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE')''', (function,)).fetchone()[0]
            assert public_grant is False, f'PUBLIC EXECUTE granted on {function}'
    print('PASS 42-role/function outcomes + 6 PUBLIC denies', flush=True)


def seed_library_pass():
    """One synthetic independent Library Pass entitlement before M1 dark install."""
    user_id = str(uuid.uuid4())
    with conn() as c:
        c.execute('INSERT INTO auth.users(id,email) VALUES (%s::uuid,%s)',
                  (user_id, 'd2-library-pass@example.invalid'))
        c.execute('''INSERT INTO public.entitlements(account_id,product_id,state,starts_at,ends_at)
                  VALUES (%s::uuid,'library-pass','active',clock_timestamp(),NULL)''', (user_id,))
        original = c.execute('''SELECT md5(e::text) FROM public.entitlements e
                WHERE account_id=%s::uuid AND product_id='library-pass' ''',(user_id,)).fetchone()[0]
    assert original
    print('PASS pre-M1 independent synthetic Library Pass entitlement seeded',flush=True)
    return (user_id, original)


def assert_library_pass_untouched(snapshot_value):
    user_id, original = snapshot_value
    with conn() as c:
        rows = c.execute('''SELECT md5(e::text) FROM public.entitlements e
            WHERE account_id=%s::uuid AND product_id='library-pass' ''',(user_id,)).fetchall()
        research = c.execute('''SELECT count(*) FROM public.entitlements
            WHERE product_id='research-membership' ''').fetchone()[0]
    assert rows == [(original,)], f'Library Pass entitlement changed: {rows}'
    assert research == 0, f'Research entitlements unexpectedly granted: {research}'
    print('PASS Library Pass byte-identical, zero Research entitlements',flush=True)


def evidence_structure_fingerprint():
    """Stable independent columns, constraints, triggers and ACL readback."""
    result = []
    with conn() as c:
        for name in ('signed_paid_observations','signed_paid_deliveries'):
            row = c.execute('''SELECT c.relname, c.relacl::text, c.relrowsecurity,
                c.relforcerowsecurity, pg_get_userbyid(c.relowner)
              FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n
              ON n.oid=c.relnamespace WHERE n.nspname='research_checkout_guard'
              AND c.relname=%s''',(name,)).fetchone()
            assert row
            col = c.execute('''SELECT a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull
                FROM pg_catalog.pg_attribute a WHERE a.attrelid=%s::regclass
                AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum''',
                ('research_checkout_guard.'+name,)).fetchall()
            cons = c.execute('''SELECT conname,pg_get_constraintdef(oid) FROM pg_catalog.pg_constraint
                WHERE conrelid=%s::regclass ORDER BY conname''',
                ('research_checkout_guard.'+name,)).fetchall()
            triggers = c.execute('''SELECT tgname,pg_get_triggerdef(oid) FROM pg_catalog.pg_trigger
                WHERE tgrelid=%s::regclass AND NOT tgisinternal ORDER BY tgname''',
                ('research_checkout_guard.'+name,)).fetchall()
            result.append((row,col,cons,triggers))
    return hashlib.sha256(repr(result).encode()).hexdigest()


def evidence_snapshot():
    with conn() as c:
        result={}
        for table in ('signed_paid_observations','signed_paid_deliveries'):
            result[table]=dict(c.execute(
                f'SELECT id::text, md5(t::text) FROM research_checkout_guard.{table} t ORDER BY id'
            ).fetchall())
    result['structure']=evidence_structure_fingerprint()
    return result


def assert_evidence_immutable(before,after,minimum_added=0):
    assert before['structure']==after['structure'], 'Evidence structure/ACL changed during R1'
    for table in ('signed_paid_observations','signed_paid_deliveries'):
        previous=before[table]
        current=after[table]
        assert all(current.get(k)==v for k,v in previous.items()), f'Changed/missing evidence in {table}'
        assert len(current)>=len(previous)+minimum_added, f'Lost custody in {table}'
    print('PASS immutable evidence rows and catalogue structure across R1',flush=True)


def expect_42501(label,callback):
    try:
        callback()
    except psycopg.Error as err:
        assert err.sqlstate=='42501', f'{label}: SQLSTATE {err.sqlstate}, expected 42501'
        print('PASS 42501 denied:',label,flush=True)
    else:
        raise AssertionError(f'{label}: unauthorized operation succeeded')


def verify_r1_stop_and_paid_custody(user_id,before):
    """Real restricted LOGIN calls, not only catalogue permission assertions."""
    def issued():
        with conn(user='review_checkout_issuer',password='only_synthetic_issuer') as c:
            c.execute('''SELECT public.issue_research_membership_checkout_intent(
              %s::uuid,'research-membership','42','314','monthly',true,'blocked-r1')''',(user_id,))
    def bound():
        with conn(user='review_checkout_binder',password='only_synthetic_binder') as c:
            c.execute('''SELECT public.bind_research_membership_with_checkout_intent(
                %s::uuid,'lemon-squeezy','d2-r1-block','d2-r1-block-customer','314','monthly',
                clock_timestamp(),'blocked-proof',%s,'42','research-membership',true,
                'research-receipt-business-v3',%s)''',
                (user_id,hashlib.sha256(b'blocked raw').hexdigest(),hashlib.sha256(b'blocked fp').hexdigest()))
    expect_42501('issuer.issue during R1',issued)
    expect_42501('binder.bind during R1',bound)
    raw=hashlib.sha256(b'r1-synthetic-paid-delivery').hexdigest()
    fp=hashlib.sha256(b'r1-synthetic-business-v3').hexdigest()
    with conn(user='review_checkout_verifier',password='only_synthetic_verifier') as c:
        value=c.execute('''SELECT public.observe_signed_research_subscription_created(
            'lemon-squeezy','d2-r1-custody','d2-r1-customer','42','research-membership','314',true,
            clock_timestamp(),%s,%s::uuid,NULL,'research-receipt-business-v3',%s)''',
            (raw,user_id,fp)).fetchone()[0]
    assert value['action']=='recorded',value
    after=evidence_snapshot()
    assert_evidence_immutable(before,after,minimum_added=1)
    print('PASS verifier recorded new signed paid evidence DURING R1 with issuer and binder disabled',flush=True)
    return after


def verify_tamper_controls():
    with conn() as c:
        observation=c.execute('''SELECT id FROM research_checkout_guard.signed_paid_observations
              ORDER BY recorded_at LIMIT 1''').fetchone()[0]
    for authority in ('service_role','authenticated'):
        def try_tamper():
            with conn(user='postgres',password='synthetic_pg') as c:
                c.execute('SET ROLE '+authority)
                c.execute('''UPDATE research_checkout_guard.signed_paid_observations
                    SET provider_customer_id='tampered' WHERE id=%s::uuid''',(observation,))
        expect_42501(authority+' evidence UPDATE',try_tamper)
    for table in ('signed_paid_observations','signed_paid_deliveries'):
        def try_delete():
            with conn(user='postgres',password='synthetic_pg') as c:
                c.execute('DELETE FROM research_checkout_guard.'+table)
        expect_42501('owner DELETE immutable '+table,try_delete)
    print('PASS evidence tamper negatives for service_role, authenticated and table owner',flush=True)


def synthetic_pending_flow():
    # Synthetic IDs only. The HMAC signature verification itself is an app concern,
    # and is not asserted by this database-only fixture.
    for role, password in (
        ('review_checkout_issuer', 'only_synthetic_issuer'),
        ('review_checkout_verifier', 'only_synthetic_verifier'),
        ('review_checkout_binder', 'only_synthetic_binder'),
    ):
        psql(f"ALTER ROLE {role} PASSWORD '{password}';", user='ci_research', label=f'synthetic credential {role}')
    user_id = str(uuid.uuid4())
    with conn() as root:
        root.execute("INSERT INTO research_checkout_guard.allowed_variants(store_id,product_id,variant_id,billing_interval,test_mode) VALUES ('42','research-membership','314','monthly',true)")
        root.execute('INSERT INTO auth.users(id,email) VALUES (%s::uuid,%s)', (user_id, 'd2-review@example.invalid'))
    with conn(user='review_checkout_issuer',password='only_synthetic_issuer') as issuer:
        intent = issuer.execute("SELECT public.issue_research_membership_checkout_intent(%s::uuid,'research-membership','42','314','monthly',true,'request-d2-review-0001')",(user_id,)).fetchone()[0]
        assert isinstance(intent,dict) and 'intent_id' in intent and 'checkout_key' in intent, intent
        attach = issuer.execute('SELECT public.attach_research_membership_checkout_intent(%s::uuid,%s,%s)',(intent['intent_id'],intent['checkout_key'],'chk-d2-review')).fetchone()[0]
        assert attach.get('action') in ('attached','already_attached'),attach
    with conn() as root:
        occurred = root.execute("SELECT created_at + interval '1 minute' FROM research_checkout_guard.checkout_intents WHERE id=%s::uuid",(intent['intent_id'],)).fetchone()[0]
    raw = hashlib.sha256(b'd2-synthetic-original-raw').hexdigest()
    fingerprint = hashlib.sha256(b'd2-synthetic-fingerprint').hexdigest()
    proof = hashlib.sha256(intent['checkout_key'].encode()).hexdigest()
    with conn(user='review_checkout_verifier',password='only_synthetic_verifier') as verifier:
        observed = verifier.execute("""SELECT public.observe_signed_research_subscription_created(
            'lemon-squeezy','d2-synthetic-sub','d2-synthetic-customer','42','research-membership','314',true,
            %s::timestamptz,%s,%s::uuid,%s,'research-receipt-business-v3',%s)""",
           (occurred,raw,user_id,proof,fingerprint)).fetchone()[0]
        assert observed.get('action') in ('recorded','already_recorded'),observed
    with conn(user='review_checkout_binder',password='only_synthetic_binder') as binder:
        bound = binder.execute("""SELECT public.bind_research_membership_with_checkout_intent(
            %s::uuid,'lemon-squeezy','d2-synthetic-sub','d2-synthetic-customer','314','monthly',
            %s::timestamptz,%s,%s,'42','research-membership',true,'research-receipt-business-v3',%s)""",
          (user_id,occurred,intent['checkout_key'],raw,fingerprint)).fetchone()[0]
        assert bound.get('action') in ('created','existing'),bound
    with conn() as root:
        states = root.execute('SELECT state::text FROM public.subscriptions WHERE account_id=%s::uuid',(user_id,)).fetchall()
        entitlements = root.execute('SELECT count(*) FROM public.entitlements WHERE account_id=%s::uuid',(user_id,)).fetchone()[0]
        custody = root.execute('SELECT count(*) FROM research_checkout_guard.signed_paid_observations').fetchone()[0]
    assert states == [('pending',)] and entitlements == 0 and custody == 1, (states,entitlements,custody)
    print('PASS synthetic issuer→attach→observer→binder; one pending, zero entitlements, paid custody persisted',flush=True)
    return (user_id, states, custody)

def actual_app_js_rpc_bridge():
    """Use unmodified application JS to create four synthetic RPC request bodies.

    Only the exporter's CI branch guard is adjusted in a temporary runner-local
    copy, to bind the source-level guard to this child Draft PR. No checked-in
    application module, provider, API, or credential is used or modified.
    """
    from datetime import datetime, timedelta, timezone
    src = ROOT / 'apps/web/scripts/export-research-b5-real-rpc-vectors.mjs'
    assert src.is_file(), 'App JS RPC vector exporter is required'
    child = 'agent/1103-d2-a-pg17-disposable-review-20261104'
    parent = 'agent/1103-b5-rpc-sql-isolated-d1-20261104'
    assert os.environ.get('GITHUB_HEAD_REF') == child, 'CI child Draft guard failed'
    source = src.read_text(encoding='utf-8')
    assert source.count(parent) == 1, 'Exporter branch guard changed; review required'
    assert 'createResearchMembershipCheckout' in source
    assert 'processResearchMembershipWebhookWithFirstPurchase' in source
    assert "new Response('[]', { status: 200 })" in source, 'No-network mock was removed'
    # The original exporter imports ../src, so keep the temp copy in its scripts dir.
    # It is removed before CI exits; source modules are not altered.
    ephemeral = src.with_name('.d2-07-ephemeral-app-rpc-vectors.mjs')
    assert not ephemeral.exists(), 'Ephemeral exporter path unexpectedly occupied'
    account = '88888888-8888-4888-8888-888888888888'
    with conn() as admin:
        admin.execute('INSERT INTO auth.users(id,email) VALUES (%s::uuid,%s)',
                      (account, 'd2-real-app@example.invalid'))
    pre_issue = (datetime.now(timezone.utc) - timedelta(seconds=2)).isoformat()
    with conn(user='review_checkout_issuer', password='only_synthetic_issuer') as issuer:
        issued = issuer.execute("""SELECT public.issue_research_membership_checkout_intent(
          %s::uuid,'research-membership','42','314','monthly',true,'b5-real-js-bridge-request-001')""",
          (account,)).fetchone()[0]
        assert issued['action'] == 'reserved'
    runner_env = dict(os.environ)
    runner_env['RESEARCH_B5_ISSUED_INTENT_JSON'] = json.dumps(issued, default=str)
    runner_env['RESEARCH_B5_PREISSUE_CLIENT_TIME'] = pre_issue
    # Real checkout JS is run only in child Draft CI, with a child-only guard.
    assert runner_env['GITHUB_HEAD_REF'] == child
    try:
        ephemeral.write_text(source.replace(parent,child), encoding='utf-8')
        result = subprocess.run(['node',str(ephemeral)], cwd=ROOT/'apps/web',
                                env=runner_env,text=True,capture_output=True,
                                timeout=45,check=False)
    finally:
        ephemeral.unlink(missing_ok=True)
    if result.returncode:
        raise AssertionError('Actual app JS capture failed: '+result.stderr[-1350:])
    data = json.loads(result.stdout.strip().splitlines()[-1])
    assert data.get('source') == 'actual-app-JS'
    requests = data['requests']
    assert set(requests) == {'issue','attach','observe','bind'}
    issue, attach, observe, bind = (requests[k] for k in ('issue','attach','observe','bind'))
    assert issue['p_account_id'] == account
    assert issue['p_product_id'] == 'research-membership'
    assert issue['p_client_request_id'] == 'b5-real-js-bridge-request-001'
    assert attach['p_intent_id'] == issued['intent_id']
    assert attach['p_checkout_proof'] == issued['checkout_key']
    assert attach['p_provider_checkout_id'] == 'checkout_b5_js_bridge'
    assert observe['p_product_id'] == bind['p_product_id'] == 'research-membership'
    assert observe['p_provider_subscription_id'] == bind['p_provider_subscription_id']
    assert observe['p_raw_body_sha256'] == bind['p_raw_body_sha256']
    assert observe['p_claimed_account_id'] == bind['p_account_id'] == account
    assert observe['p_claimed_checkout_proof_sha256'] == hashlib.sha256(issued['checkout_key'].encode()).hexdigest()
    assert bind['p_checkout_proof'] == issued['checkout_key']
    assert observe['p_business_fingerprint_sha256'] == bind['p_business_fingerprint_sha256']
    assert observe['p_test_mode'] is True and bind['p_test_mode'] is True
    assert str(observe['p_store_id']) == str(bind['p_store_id']) == '42'
    assert observe['p_provider_price_id'] == '314'
    assert len(observe['p_raw_body_sha256']) == 64
    with conn(user='review_checkout_issuer',password='only_synthetic_issuer') as issuer:
        got = issuer.execute("""SELECT public.attach_research_membership_checkout_intent(
          %s::uuid,%s,%s)""", (attach['p_intent_id'],attach['p_checkout_proof'],attach['p_provider_checkout_id'])).fetchone()[0]
        assert got['action'] == 'attached'
    obskeys = ('p_provider','p_provider_subscription_id','p_provider_customer_id',
               'p_store_id','p_product_id','p_provider_price_id','p_test_mode',
               'p_occurred_at','p_raw_body_sha256','p_claimed_account_id',
               'p_claimed_checkout_proof_sha256','p_business_fingerprint_version',
               'p_business_fingerprint_sha256')
    with conn(user='review_checkout_verifier',password='only_synthetic_verifier') as verifier:
        recorded = verifier.execute("""SELECT public.observe_signed_research_subscription_created(
            %s,%s,%s,%s,%s,%s,%s,%s::timestamptz,%s,%s::uuid,%s,%s,%s)""",
            tuple(observe[k] for k in obskeys)).fetchone()[0]
        assert recorded['action'] == 'recorded'
    bindkeys = ('p_account_id','p_provider','p_provider_subscription_id',
                'p_provider_customer_id','p_provider_price_id','p_billing_interval',
                'p_occurred_at','p_checkout_proof','p_raw_body_sha256','p_store_id',
                'p_product_id','p_test_mode','p_business_fingerprint_version',
                'p_business_fingerprint_sha256')
    with conn(user='review_checkout_binder',password='only_synthetic_binder') as binder:
        query="""SELECT public.bind_research_membership_with_checkout_intent(
          %s::uuid,%s,%s,%s,%s,%s,%s::timestamptz,%s,%s,%s,%s,%s,%s,%s)"""
        bound=binder.execute(query,tuple(bind[k] for k in bindkeys)).fetchone()[0]
        assert bound['action']=='created',bound
        replay=binder.execute(query,tuple(bind[k] for k in bindkeys)).fetchone()[0]
        assert replay['action']=='existing',replay
    with conn() as admin:
        rows=admin.execute('SELECT state::text FROM public.subscriptions WHERE account_id=%s::uuid',(account,)).fetchall()
        count=admin.execute('SELECT count(*) FROM public.entitlements WHERE account_id=%s::uuid',(account,)).fetchone()[0]
        custody=admin.execute("SELECT count(*) FROM research_checkout_guard.signed_paid_observations WHERE provider_subscription_id=%s",(bind['p_provider_subscription_id'],)).fetchone()[0]
    assert rows==[('pending',)] and count==0 and custody==1,(rows,count,custody)
    print('PASS actual application JS HMAC/mock checkout → 4 RPC bodies → real PG17 issuer/attach/observe/bind, one pending, zero entitlements, exact replay',flush=True)
    return account

def verify_custody_unchanged(snapshot_value):
    user_id,states,custody = snapshot_value
    with conn() as root:
        now_states = root.execute('SELECT state::text FROM public.subscriptions WHERE account_id=%s::uuid',(user_id,)).fetchall()
        now_custody = root.execute('SELECT count(*) FROM research_checkout_guard.signed_paid_observations').fetchone()[0]
        entitlements = root.execute('SELECT count(*) FROM public.entitlements WHERE account_id=%s::uuid',(user_id,)).fetchone()[0]
    assert now_states == states and now_custody == custody and entitlements == 0
    print('PASS existing synthetic pending + paid-evidence custody unchanged across M2/R1/restore',flush=True)

def run():
    for name, expected in EXPECTED_SHA.items():
        assert hashlib.sha256((FIX/name).read_bytes()).hexdigest() == expected, f'fixture SHA mismatch: {name}'
    print('PASS pinned A46 + D2-04 fixture integrity', flush=True)
    with conn(database='ci_review') as c:
        server_version = c.execute("SELECT current_setting('server_version_num')::int").fetchone()[0]
        assert server_version >= 170000 and server_version < 180000, f'Not PG17: {server_version}'
    print('PASS isolated PostgreSQL 17 server', flush=True)
    psql(fixture('boot.sql'), user='ci_research', database='ci_review', label='Synthetic role bootstrap')
    psql('CREATE DATABASE d2 OWNER postgres;', user='ci_research', database='ci_review', label='Disposable d2 database')
    psql(fixture('boot_db_common.sql'), user='ci_research', database='d2', label='Synthetic schema bootstrap')
    psql(fixture(f'def_{MODE}.sql'), user='ci_research', label=f'{MODE} synthetic ACL defaults')
    for migration in MIGRATIONS:
        path = ROOT/'supabase'/'migrations'/migration
        assert path.is_file(), f'Missing expected main migration {path}'
        psql(path.read_text(encoding='utf-8'), label=f'original migration: {migration}')
    library_fixture = seed_library_pass()
    base = snapshot()
    assert base.startswith('0|0|0|0|0|'), 'Dirty fixture at start: '+base

    if MODE == 'S1b':
        assert_rolls_back('S3 missing extension GRANT OPTION', fixture('M1_strict_matrix_review_only.sql'))

    psql('GRANT USAGE ON SCHEMA extensions TO postgres WITH GRANT OPTION;', user='ci_research', label='Temporary synthetic extension grant')
    if MODE == 'S1c':
        assert_rolls_back('S4a owner SET path missing', strict_mutation('S4a','s4a_no_set_path'))
        assert_rolls_back('S4b binder grant missing', strict_mutation('S4b','s4b_missing_binder'))
        assert_rolls_back('D2-04 missing issuer.attach', strict_mutation('D2-04 attach','missing_attach'))
        assert_rolls_back('D2-04 cross-role overgrant', strict_mutation('D2-04 overgrant','cross_overgrant'))
        for case in ('issuer_bind_overgrant','binder_observe_overgrant','verifier_bind_overgrant'):
            assert_rolls_back('D2-11 '+case, strict_mutation('D2-11 '+case,case))
    if MODE == 'S2':
        assert_rolls_back('S4c service_role revoke missing', strict_mutation('S4c','s4c_no_service_revoke'))

    psql(fixture('M1_strict_matrix_review_only.sql'), label=f'{MODE} strict A46 M1')
    acl_matrix()
    assert first("SELECT count(*) FROM pg_catalog.pg_policies WHERE policyname LIKE 'research_b5_owner_%'") == 6
    assert first("SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname LIKE 'review_checkout_%'") == 4
    assert first("SELECT has_function_privilege('service_role','public.bind_research_membership_subscription(uuid,text,text,text,text,public.subscription_billing_interval,timestamptz,jsonb)','EXECUTE')") is True
    print('PASS RLS policy count, principals, existing binder preserved on dark install', flush=True)
    flow_snapshot = synthetic_pending_flow()
    app_bridge_account = actual_app_js_rpc_bridge()
    # The second synthetic paid observation was added before M2; preserve both.
    flow_snapshot = (flow_snapshot[0], flow_snapshot[1], flow_snapshot[2]+1)
    psql(fixture('M2_A46.sql'), label='M2 guarded legacy binder cutover')
    assert first("SELECT has_function_privilege('service_role','public.bind_research_membership_subscription(uuid,text,text,text,text,public.subscription_billing_interval,timestamptz,jsonb)','EXECUTE')") is False
    print('PASS M2 retired only synthetic legacy binder',flush=True)
    before_r1 = evidence_snapshot()
    psql(fixture('R1_A46.sql'),label='R1 isolated kill switch')
    assert first("SELECT has_function_privilege('review_checkout_issuer','public.issue_research_membership_checkout_intent(uuid,text,text,text,text,boolean,text)','EXECUTE')") is False
    assert first("SELECT has_function_privilege('review_checkout_verifier','public.observe_signed_research_subscription_created(text,text,text,text,text,text,boolean,timestamptz,text,uuid,text,text,text)','EXECUTE')") is True
    print('PASS R1 issue disabled, paid-observer custody preserved',flush=True)
    after_r1 = verify_r1_stop_and_paid_custody(flow_snapshot[0],before_r1)
    # A valid verifier observation during R1 adds one immutable paid row.
    flow_snapshot = (flow_snapshot[0], flow_snapshot[1], flow_snapshot[2]+1)
    verify_tamper_controls()
    psql(fixture('R1_restore_A46.sql'),label='R1 owner-authorized restore')
    assert_evidence_immutable(after_r1,evidence_snapshot())
    acl_matrix()
    verify_custody_unchanged(flow_snapshot)
    with conn() as admin:
        result=admin.execute('SELECT state::text FROM public.subscriptions WHERE account_id=%s::uuid',(app_bridge_account,)).fetchall()
        assert result==[('pending',)]
        assert admin.execute('SELECT count(*) FROM public.entitlements WHERE account_id=%s::uuid',(app_bridge_account,)).fetchone()[0]==0
    assert_library_pass_untouched(library_fixture)
    print('PASS real-JS-driven pending row preserved across M2/R1 stop/restore',flush=True)
    print(f'PASS {MODE} complete isolated D2-A security rehearsal (not a release approval)', flush=True)

if __name__ == '__main__':
    try:
        run()
    except Exception as exc:
        print('FAIL D2 PG17 isolated review:', repr(exc), file=sys.stderr, flush=True)
        raise
