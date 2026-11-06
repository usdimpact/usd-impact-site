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
    "Q01_TRIGGERS", "Q02_EVENT_TRIGGERS", "Q03_COLUMNS_AND_DEFAULTS",
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
    "pg_get_constraintdef", "pg_get_indexdef", "pg_get_viewdef",
}
SQL_EXPRESSIONS = {"coalesce", "values", "in", "any", "nullif",
                   "join", "or", "roles"}
CALL = re.compile(r"(?<![\w.])(?:(?P<schema>[a-z_][\w]*)\.)?(?P<name>[a-z_][\w]*)\s*\(", re.I)


def verify_shape(name, sql):
    assert re.match(r"^select\b", sql, re.I), name
    assert sql.endswith(";") and sql.count(";") == 1, name
    assert re.search(r"\b(?:from|join)\s+pg_catalog\.", sql, re.I), name
    for forbidden in ("supabase_migrations.schema_migrations", "cron.job",
                      "auth.users ", "storage.objects "):
        assert forbidden not in sql.lower(), (name, forbidden)
    for match in CALL.finditer(sql):
        schema, function = match.group("schema"), match.group("name").lower()
        if schema and schema.lower() != "pg_catalog":
            raise AssertionError(f"{name}: unapproved function namespace {schema}")
        if schema:
            assert function in SAFE_CATALOG_CALLS, (name, function)
        else:
            assert function in SQL_EXPRESSIONS, (name, function)
            if function == "roles":
                # AS roles(role_name) is a column-alias list, not a call.
                assert sql[:match.start()].lower().rstrip().endswith("as"), name
    if name == "Q01_TRIGGERS":
        assert "trigger_definition_md5" in sql
        assert not re.search(r"\bas\s+trigger_definition\s*[,;]", sql, re.I)


def parse_pack():
    raw = PACK.read_text(encoding="utf-8")
    blocks = re.split(r"(?m)^-- F3_QUERY: ([A-Z][A-Z0-9_]+)\s*$", raw)
    assert len(blocks) == 1 + 2 * len(EXPECTED), "unexpected F3 query count"
    parsed = []
    for i, expected in enumerate(EXPECTED):
        name = blocks[1 + 2 * i]
        assert name == expected, (name, expected)
        lines = [line for line in blocks[2 + 2 * i].splitlines()
                 if line.strip() and not line.lstrip().startswith("--")]
        sql = "\n".join(lines).strip()
        verify_shape(name, sql)
        parsed.append((name, sql))
    try:
        verify_shape("HOSTILE", "select pg_catalog.pg_terminate_backend(99) from pg_catalog.pg_class;")
        raise AssertionError("unsafe SQL function silently permitted")
    except AssertionError as e:
        assert "unapproved" in str(e) or "pg_terminate_backend" in str(e)
    return parsed


def setup_fixtures(cur):
    # All objects are CI-only, never written to Development/Production.
    cur.execute("create schema f3_catalog_probe")
    cur.execute("create table f3_catalog_probe.events (id integer primary key)")
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
                   with (security_invoker=true) as select id from f3_catalog_probe.events""")
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
        ("Q01_TRIGGERS", "argument_count"),
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


def main():
    queries=parse_pack()
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
                    cur.execute("SELECT current_user, current_setting('transaction_read_only')")
                    role, read_only = cur.fetchone()
                    assert role=="authenticated" and read_only=="on", (role,read_only)
                    results={}
                    for name,sql in queries:
                        cur.execute(sql)
                        columns=[column.name for column in cur.description]
                        rows=cur.fetchall()
                        results[name]=(columns,as_records(columns,rows))
                        print(f"[F3-DISPOSABLE] PASS {name} rows={len(rows)}",flush=True)
                    evaluate_results(results)
                    raise _ExpectedRollback
        except _ExpectedRollback:
            print("F3_CATALOG_DONE queries=19 pass=19 readonly=true role=authenticated safe_export=true",flush=True)
        finally:
            with conn.transaction():
                with conn.cursor() as cur:
                    cleanup_fixtures(cur)


class _ExpectedRollback(Exception):
    pass


if __name__ == "__main__":
    main()
