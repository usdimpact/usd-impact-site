"""F3 catalog-only SQL pack contract on DISPOSABLE synthetic PG17 only.

Never point this test at a connected Development/Production database. It uses
the repository PGHOST/PGUSER disposable CI service and a READ ONLY transaction
with an authenticated low-privilege role; no row data is printed or retained.
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
]


def parse_pack():
    raw = PACK.read_text(encoding="utf-8")
    blocks = re.split(r"(?m)^-- F3_QUERY: ([A-Z][A-Z0-9_]+)\s*$", raw)
    assert len(blocks) == 1 + 2 * len(EXPECTED), "F3 query count differs from reviewed contract"
    parsed = []
    for i, name in enumerate(EXPECTED):
        actual = blocks[1 + 2 * i]
        assert actual == name, (actual, name)
        body = blocks[2 + 2 * i]
        lines = [line for line in body.splitlines()
                 if line.strip() and not line.lstrip().startswith("--")]
        sql = "\n".join(lines).strip()
        assert re.match(r"^select\b", sql, flags=re.I), name
        assert sql.endswith(";") and sql.count(";") == 1, name
        assert re.search(r"\b(?:from|join)\s+pg_catalog\.", sql, re.I), name
        assert "supabase_migrations.schema_migrations" not in sql.lower(), name
        assert "cron.job" not in sql.lower(), name
        parsed.append((name, sql))
    return parsed


def main():
    blocks = parse_pack()
    results = {}
    # The CI PG17 instance is disposable. SET ROLE authenticated forces the
    # catalog queries to work with application-level privileges, not superuser.
    with psycopg.connect(autocommit=True) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
                cur.execute("SET LOCAL statement_timeout = '5000ms'")
                cur.execute("SET LOCAL ROLE authenticated")
                cur.execute("SELECT current_user, current_setting('transaction_read_only')")
                role, readonly = cur.fetchone()
                assert role == "authenticated" and readonly == "on", (role, readonly)
                for name, sql in blocks:
                    cur.execute(sql)
                    columns = [field.name for field in cur.description]
                    rows = cur.fetchall()
                    results[name] = (columns, rows)
                    print(f"[F3-DISPOSABLE] PASS {name} rows={len(rows)}", flush=True)
                routines = results["Q04_ALL_ROUTINES"]
                routine_names = {str(row[routines[0].index("routine_name")]) for row in routines[1]}
                for expected in ("complete_paddle_purchase", "reserve_paddle_purchase_intent"):
                    assert expected in routine_names, f"missing Library Pass routine {expected}"
                indexes = results["Q06_ALL_INDEXES"]
                index_names = {str(row[indexes[0].index("index_name")]) for row in indexes[1]}
                for expected in ("profiles_auth_user_id_uidx", "subscriptions_one_current_product_idx"):
                    assert expected in index_names, f"missing security-relevant index {expected}"
                enums = results["Q07_ENUM_LABELS"]
                enum_names = {str(row[enums[0].index("enum_name")]) for row in enums[1]}
                for expected in ("privacy_request_type", "request_status"):
                    assert expected in enum_names, f"missing privacy enum {expected}"
                for name, column in (
                    ("Q04_ALL_ROUTINES", "routine_kind"),
                    ("Q08_RLS_POLICIES_AND_ROLES", "policy_roles"),
                    ("Q08_RLS_POLICIES_AND_ROLES", "permissive"),
                    ("Q09_TABLE_DML_ACL", "can_delete"),
                    ("Q09_TABLE_DML_ACL", "can_truncate"),
                    ("Q10_COLUMN_ACL", "privilege_type"),
                    ("Q11_DEFAULT_ACL", "default_acl"),
                    ("Q12_PUBLICATION_MEMBERSHIP", "membership_kind"),
                ):
                    assert column in results[name][0], f"{name} missing {column}"
                # Read-only transaction rolls back even when all probes pass.
                raise _ExpectedRollback
    print("SHOULD_NOT_REACH")


class _ExpectedRollback(Exception):
    pass


if __name__ == "__main__":
    try:
        main()
    except _ExpectedRollback:
        print(f"F3_CATALOG_DONE queries={len(EXPECTED)} pass={len(EXPECTED)} readonly=true role=authenticated", flush=True)
