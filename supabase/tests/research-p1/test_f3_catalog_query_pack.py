"""System-catalog-only F3 contract on disposable PostgreSQL 17; NO hosted access.

A deliberately hostile trigger stores a SYNTHETIC webhook Authorization argument.
Every inventory query runs with SET LOCAL ROLE authenticated and READ ONLY.
All fixtures are created and dropped by the isolated CI superuser connection.
The test never logs raw catalog rows or full SQL definitions.
"""
from pathlib import Path
import re
import psycopg

ROOT = Path(__file__).resolve().parents[3]
PACK = ROOT / "docs/operations/research-p1-two-phase/f3-development-catalog-readonly.sql"
EXPECTED = [
    "Q00_SERVER_VERSION", "Q01_TRIGGERS", "Q02_EVENT_TRIGGERS", "Q03_COLUMNS_AND_DEFAULTS",
    "Q04_ALL_ROUTINES", "Q05_CONSTRAINTS", "Q06_ALL_INDEXES",
    "Q07_ENUM_LABELS", "Q08_RLS_POLICIES_AND_ROLES", "Q09_TABLE_DML_ACL",
    "Q10_COLUMN_ACL", "Q11_DEFAULT_ACL", "Q12_PUBLICATION_MEMBERSHIP",
    "Q13_SCHEMA_PRIVILEGES", "Q14_VIEWS_AND_SECURITY_BARRIER", "Q15_EXTENSIONS",
    "Q16_ROLE_ATTRIBUTES", "Q17_ROLE_MEMBERSHIPS", "Q18_SEQUENCES_AND_ACL",
    "Q19_DOMAIN_CONSTRAINTS",
]
SAFE_CATALOG_CALLS = {
    "pg_get_triggerdef", "md5", "pg_get_functiondef", "pg_get_userbyid",
    "format_type", "pg_get_expr", "string_agg", "unnest", "array_agg",
    "has_function_privilege", "has_table_privilege", "aclexplode",
    "has_schema_privilege", "has_sequence_privilege",
    "pg_get_constraintdef", "pg_get_indexdef", "pg_get_viewdef", "current_setting",
}
SQL_EXPRESSIONS = {"coalesce", "values", "in", "any", "nullif",
                   "join", "or", "roles"}
CALL = re.compile(r"(?<![\w.])(?:(?P<schema>[a-z_][\w]*)\.)?(?P<name>[a-z_][\w]*)\s*\(", re.I)


def _function_visible_sql(sql):
    """Fail on quoted-identifier/comment tricks, mask string literal bodies."""
    assert '"' not in sql, "quoted identifiers require a new manual audit"
    assert "/*" not in sql and "*/" not in sql and "--" not in sql, \
        "inline SQL comments require a new manual audit"
    out=[]
    quoted=False
    i=0
    while i<len(sql):
        char=sql[i]
        if char=="'":
            if quoted and i+1<len(sql) and sql[i+1]=="'":
                out.extend((" "," "))
                i+=2
                continue
            quoted=not quoted
            out.append(" ")
        elif quoted:
            out.append("\n" if char=="\n" else " ")
        else:
            out.append(char)
        i+=1
    assert not quoted, "unclosed SQL literal"
    return "".join(out)


def verify_shape(name, sql):
    assert re.match(r"^select\b", sql, re.I), name
    assert sql.endswith(";") and sql.count(";") == 1, name
    assert re.search(r"\b(?:from|join)\s+pg_catalog\.", sql, re.I), name
    for forbidden in ("supabase_migrations.schema_migrations", "cron.job",
                      "auth.users ", "storage.objects "):
        assert forbidden not in sql.lower(), (name, forbidden)
    visible=_function_visible_sql(sql)
    # Never emit trigger-definition values through an unreviewed output column.
    trigger_calls = re.findall(r"\bpg_catalog\.pg_get_triggerdef\s*\(", visible, re.I)
    assert len(trigger_calls)==(1 if name=="Q01_TRIGGERS" else 0), name
    if trigger_calls:
        assert re.search(r"pg_catalog\.md5\s*\(\s*pg_catalog\.pg_get_triggerdef\s*\(", visible, re.I), name
        assert "trigger_definition_md5" in sql
        assert not re.search(r"\bas\s+trigger_definition\s*[,;]",sql,re.I)
    for fn in ("pg_get_functiondef", "pg_get_expr", "pg_get_indexdef",
               "pg_get_constraintdef", "pg_get_viewdef"):
        for match in re.finditer(r"\bpg_catalog\."+fn+r"\s*\(", visible, re.I):
            assert re.search(r"pg_catalog\.md5\s*\(\s*$",
                visible[max(0,match.start()-64):match.start()],re.I), (name,fn)
    for match in CALL.finditer(visible):
        schema, function = match.group("schema"), match.group("name").lower()
        if schema and schema.lower() != "pg_catalog":
            raise AssertionError(f"{name}: unapproved function namespace {schema}")
        if schema:
            assert function in SAFE_CATALOG_CALLS, (name, function)
        else:
            assert function in SQL_EXPRESSIONS, (name, function)
            if function=="roles":
                assert visible[:match.start()].lower().rstrip().endswith("as"), name


def _sql_body(raw):
    lines=[line for line in raw.splitlines()
           if line.strip() and not line.lstrip().startswith("--")]
    return "\n".join(lines).strip()


def parse_pack():
    raw=PACK.read_text(encoding="utf-8")
    if raw.count("-- F3_QUERY_PG15: Q17_ROLE_MEMBERSHIPS")!=1:
        raise AssertionError("missing exactly one PG15 Q17 fallback")
    main_raw, pg15_raw = raw.split("-- F3_QUERY_PG15: Q17_ROLE_MEMBERSHIPS",1)
    fallback=_sql_body(pg15_raw)
    verify_shape("Q17_ROLE_MEMBERSHIPS_PG15",fallback)
    assert "m.inherit_option" not in fallback and "m.set_option" not in fallback
    blocks=re.split(r"(?m)^-- F3_QUERY: ([A-Z][A-Z0-9_]+)\s*$",main_raw)
    assert len(blocks)==1+2*len(EXPECTED),"F3 query count differs from reviewed contract"
    parsed=[]
    for i,expected in enumerate(EXPECTED):
        name=blocks[1+2*i]
        assert name==expected,(name,expected)
        sql=_sql_body(blocks[2+2*i])
        verify_shape(name,sql)
        parsed.append((name,sql))
    for hostile in (
        "select pg_catalog.pg_terminate_backend(99) from pg_catalog.pg_class;",
        'select pg_catalog."pg_terminate_backend"(1) from pg_catalog.pg_class;',
        "select pg_catalog.pg_terminate_backend/**/(1) from pg_catalog.pg_class;",
        "select pg_catalog.pg_get_triggerdef(123) from pg_catalog.pg_trigger;",
    ):
        try:
            verify_shape("HOSTILE",hostile)
            raise AssertionError("unsafe catalog call silently permitted")
        except AssertionError as e:
            assert "silently permitted" not in str(e)
    return parsed,fallback

def setup_fixtures(cur):
    # All objects are CI-only, never written to Development/Production.
    cur.execute("create schema f3_catalog_probe")
    cur.execute("create table f3_catalog_probe.events (id integer primary key)")
    cur.execute("""alter table f3_catalog_probe.events
                   add column synthetic_credential text
                   default 'Bearer sb_secret_SYNTHETIC_DEFAULT_ONLY'""")
    cur.execute("alter table f3_catalog_probe.events enable row level security")
    cur.execute("""create policy f3_synthetic_secret on f3_catalog_probe.events
                   for select using
                   (synthetic_credential <> 'Bearer sb_secret_SYNTHETIC_POLICY_ONLY')""")
    cur.execute("""create function f3_catalog_probe.webhook_hook() returns trigger
                   language plpgsql as $$ begin return new; end $$""")
    cur.execute("""create trigger f3_webhook_headers before insert
                   on f3_catalog_probe.events for each row
                   execute function f3_catalog_probe.webhook_hook(
                     '{"Authorization":"Bearer sb_secret_SYNTHETIC_NEVER_EXPORT"}')""")
    cur.execute("""create function f3_catalog_probe.evt_handler() returns event_trigger
                   language plpgsql as $$ begin return; end $$""")
    cur.execute("""create event trigger f3_catalog_probe_evt on ddl_command_start
                   when tag in ('COMMENT') execute function f3_catalog_probe.evt_handler()""")
    cur.execute("alter event trigger f3_catalog_probe_evt disable")
    cur.execute("""create view f3_catalog_probe.invoker_view
                   with (security_invoker=true) as
                   select id,'Bearer sb_secret_SYNTHETIC_VIEW_ONLY'::text as synthetic_view
                   from f3_catalog_probe.events""")
    cur.execute("create sequence f3_catalog_probe.receipt_seq")
    cur.execute("""create domain f3_catalog_probe.locale_code as text
                   constraint locale_allowed check (value in ('en','es'))""")
    cur.execute("create publication f3_catalog_pub_table for table f3_catalog_probe.events")
    cur.execute("create publication f3_catalog_pub_schema for tables in schema f3_catalog_probe")
    cur.execute("create publication f3_catalog_pub_all for all tables")


def cleanup_fixtures(cur):
    for publication in ("f3_catalog_pub_all", "f3_catalog_pub_schema",
                        "f3_catalog_pub_table"):
        cur.execute(f"drop publication if exists {publication}")
    cur.execute("drop event trigger if exists f3_catalog_probe_evt")
    cur.execute("drop schema if exists f3_catalog_probe cascade")


def as_records(cols, rows):
    return [dict(zip(cols, item)) for item in rows]


def evaluate_results(results):
    routines = results["Q04_ALL_ROUTINES"][1]
    names = {str(item["routine_name"]) for item in routines}
    for name in ("complete_paddle_purchase", "reserve_paddle_purchase_intent"):
        assert name in names, f"missing Library Pass routine {name}"
    indexes = results["Q06_ALL_INDEXES"][1]
    index_names = {str(item["index_name"]) for item in indexes}
    for index in ("profiles_auth_user_id_uidx", "subscriptions_one_current_product_idx"):
        assert index in index_names, f"missing index {index}"
    enums = {str(item["enum_name"]) for item in results["Q07_ENUM_LABELS"][1]}
    for name in ("privacy_request_type", "request_status"):
        assert name in enums, f"missing privacy enum {name}"
    for name, field in (
        ("Q00_SERVER_VERSION", "server_version_num"),
        ("Q01_TRIGGERS", "argument_count"),
        ("Q03_COLUMNS_AND_DEFAULTS", "default_expression_md5"),
        ("Q05_CONSTRAINTS", "definition_md5"),
        ("Q06_ALL_INDEXES", "definition_md5"),
        ("Q08_RLS_POLICIES_AND_ROLES", "using_clause_md5"),
        ("Q14_VIEWS_AND_SECURITY_BARRIER", "definition_md5"),
        ("Q04_ALL_ROUTINES", "routine_kind"),
        ("Q08_RLS_POLICIES_AND_ROLES", "policy_roles"),
        ("Q08_RLS_POLICIES_AND_ROLES", "permissive"),
        ("Q09_TABLE_DML_ACL", "can_delete"),
        ("Q09_TABLE_DML_ACL", "can_truncate"),
        ("Q10_COLUMN_ACL", "grantee_role"),
        ("Q10_COLUMN_ACL", "grantor_role"),
        ("Q11_DEFAULT_ACL", "default_acl"),
        ("Q12_PUBLICATION_MEMBERSHIP", "membership_kind"),
        ("Q12_PUBLICATION_MEMBERSHIP", "publishes_update"),
        ("Q12_PUBLICATION_MEMBERSHIP", "column_attnums"),
        ("Q12_PUBLICATION_MEMBERSHIP", "has_row_filter"),
        ("Q16_ROLE_ATTRIBUTES", "bypass_rls"),
        ("Q17_ROLE_MEMBERSHIPS", "member_role"),
        ("Q18_SEQUENCES_AND_ACL", "can_use"),
        ("Q19_DOMAIN_CONSTRAINTS", "constraint_definition_md5"),
    ):
        assert field in results[name][0], (name,field)
    trigger = next((r for r in results["Q01_TRIGGERS"][1]
                    if r["trigger_name"] == "f3_webhook_headers"), None)
    assert trigger is not None, "hostile webhook trigger missing from Q01"
    assert trigger["argument_count"] == 1
    assert len(trigger["trigger_definition_md5"]) == 32
    raw = repr(trigger).lower()
    assert "sb_secret_" not in raw and "authorization" not in raw and "bearer" not in raw
    assert "trigger_definition" not in trigger, "raw webhook trigger leaked"
    assert any(r["event_trigger_name"]=="f3_catalog_probe_evt"
               for r in results["Q02_EVENT_TRIGGERS"][1]), "missing event trigger"
    for pub, kind in (("f3_catalog_pub_table","table"),
                      ("f3_catalog_pub_schema","schema"),
                      ("f3_catalog_pub_all","all_tables")):
        assert any(r["publication_name"]==pub and r["membership_kind"]==kind
                   for r in results["Q12_PUBLICATION_MEMBERSHIP"][1]), (pub,kind)
    assert any(r["view_name"]=="invoker_view"
               and "security_invoker=true" in str(r["view_options"])
               for r in results["Q14_VIEWS_AND_SECURITY_BARRIER"][1])
    assert any(r["sequence_name"]=="receipt_seq"
               for r in results["Q18_SEQUENCES_AND_ACL"][1])
    assert any(r["domain_name"]=="locale_code"
               for r in results["Q19_DOMAIN_CONSTRAINTS"][1])
    assert any(r["role_name"]=="service_role"
               for r in results["Q16_ROLE_ATTRIBUTES"][1])
    version=results["Q00_SERVER_VERSION"][1][0]["server_version_num"]
    assert version>=150000, "PostgreSQL server version too old for F3 query pack"
    for name,(columns,rows) in results.items():
        for item in rows:
            for value in item.values():
                if value is None: continue
                candidate=str(value).lower()
                assert not re.search(
                    r"sb_secret_|sb_publishable_|authorization|bearer\s+",
                    candidate
                ), f"credential-like text leaked from F3 {name} field"
    print(f"[F3-DISPOSABLE] leak-scan passed all {len(results)} output sets",flush=True)


def main():
    queries,pg15_fallback=parse_pack()
    # Disposable CI runs as postgres-service superuser so fixture setup is
    # allowed. All 19 actual query executions run as authenticated/READ ONLY.
    with psycopg.connect(autocommit=True) as conn:
        try:
            with conn.transaction():
                with conn.cursor() as cur:
                    setup_fixtures(cur)
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
                    cur.execute("SET LOCAL statement_timeout = '5000ms'")
                    cur.execute("SET LOCAL ROLE authenticated")
                    cur.execute("SET LOCAL search_path = pg_catalog")
                    cur.execute("SELECT current_user, current_setting('transaction_read_only'), current_setting('search_path')")
                    role, read_only, search_path = cur.fetchone()
                    assert role=="authenticated" and read_only=="on" and search_path=="pg_catalog", (role,read_only,search_path)
                    results={}
                    cur.execute(queries[0][1])
                    server_version=cur.fetchone()[0]
                    assert isinstance(server_version,int) and server_version>=150000, server_version
                    for name,sql in queries:
                        if name=="Q17_ROLE_MEMBERSHIPS" and server_version<160000:
                            sql=pg15_fallback
                        cur.execute(sql)
                        columns=[column.name for column in cur.description]
                        rows=cur.fetchall()
                        results[name]=(columns,as_records(columns,rows))
                        print(f"[F3-DISPOSABLE] PASS {name} rows={len(rows)}",flush=True)
                    # Always exercise the fallback syntax even when the
                    # disposable CI instance is PG17. On hosted PG15 this
                    # fallback is selected instead of PG16+ Q17.
                    cur.execute(pg15_fallback)
                    cols=[column.name for column in cur.description]
                    assert "member_role" in cols and "inherit_option" in cols
                    assert "set_option" in cols
                    assert len(cur.fetchall())>=1
                    evaluate_results(results)
                    raise _ExpectedRollback
        except _ExpectedRollback:
            print(f"F3_CATALOG_DONE queries={len(EXPECTED)} pass={len(EXPECTED)} readonly=true role=authenticated search_path=pg_catalog leak_scan=true",flush=True)
        finally:
            with conn.transaction():
                with conn.cursor() as cur:
                    cleanup_fixtures(cur)


class _ExpectedRollback(Exception):
    pass


if __name__ == "__main__":
    main()
