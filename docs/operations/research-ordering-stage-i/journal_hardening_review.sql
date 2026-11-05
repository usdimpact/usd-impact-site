-- USD Impact Stage I: disposable PostgreSQL 17 review OVERLAY, never a migration.
-- Load ONLY after Stage H receipt_journal_review.sql on isolated ci_review.
-- This models a no-login ownership boundary; it does not repair public service_role.
BEGIN;

CREATE ROLE research_stage_i_owner NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE research_stage_i_writer NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE research_stage_i_observer NOLOGIN NOINHERIT NOBYPASSRLS;

-- Stage H only protected receipt UPDATE fields and audit UPDATE/DELETE rows.
-- Statement guards also block DELETE on empty tables and TRUNCATE.
CREATE FUNCTION research_ordering_stage_h.stage_i_refuse_erase()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 RAISE EXCEPTION 'stage i journal erasure prohibited' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER stage_i_receipt_no_delete BEFORE DELETE
 ON research_ordering_stage_h.pending_receipts
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_h.stage_i_refuse_erase();
CREATE TRIGGER stage_i_receipt_no_truncate BEFORE TRUNCATE
 ON research_ordering_stage_h.pending_receipts
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_h.stage_i_refuse_erase();
CREATE TRIGGER stage_i_audit_no_delete BEFORE DELETE
 ON research_ordering_stage_h.receipt_audit
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_h.stage_i_refuse_erase();
CREATE TRIGGER stage_i_audit_no_truncate BEFORE TRUNCATE
 ON research_ordering_stage_h.receipt_audit
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_h.stage_i_refuse_erase();

-- Only same-state idempotence or forward pending -> quarantine is legal.
-- The role below has no direct UPDATE; the SECURITY DEFINER holder is the
-- sole normal path to quarantine. Table-owner/superuser bypass is not solved.
CREATE FUNCTION research_ordering_stage_h.stage_i_monotonic_quarantine()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.disposition = OLD.disposition OR
    (OLD.disposition = 'pending_reconciliation' AND
     NEW.disposition = 'quarantined_conflict') THEN
   RETURN NEW;
 END IF;
 RAISE EXCEPTION 'stage i quarantine downgrade prohibited' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER stage_i_receipt_monotonic
 BEFORE UPDATE OF disposition ON research_ordering_stage_h.pending_receipts
 FOR EACH ROW EXECUTE FUNCTION research_ordering_stage_h.stage_i_monotonic_quarantine();

-- A journal audit row must point to an original receipt, never an orphan.
ALTER TABLE research_ordering_stage_h.receipt_audit
 ADD CONSTRAINT stage_i_audit_receipt_fk
 FOREIGN KEY (event_key)
 REFERENCES research_ordering_stage_h.pending_receipts(event_key)
 ON DELETE RESTRICT;

-- Transfer journal custody to a non-login owner separate from API callers.
-- SECURITY DEFINER is used only for the existing, non-mutating hold_evidence
-- function. It has no entitlement APPLY operation or network transport.
ALTER SCHEMA research_ordering_stage_h OWNER TO research_stage_i_owner;
ALTER TABLE research_ordering_stage_h.pending_receipts OWNER TO research_stage_i_owner;
ALTER TABLE research_ordering_stage_h.receipt_audit OWNER TO research_stage_i_owner;
ALTER FUNCTION research_ordering_stage_h.protect_audit() OWNER TO research_stage_i_owner;
ALTER FUNCTION research_ordering_stage_h.protect_payload() OWNER TO research_stage_i_owner;
ALTER FUNCTION research_ordering_stage_h.stage_i_refuse_erase() OWNER TO research_stage_i_owner;
ALTER FUNCTION research_ordering_stage_h.stage_i_monotonic_quarantine() OWNER TO research_stage_i_owner;
ALTER FUNCTION research_ordering_stage_h.hold_evidence(text,text,text,text,text) SECURITY DEFINER;
ALTER FUNCTION research_ordering_stage_h.hold_evidence(text,text,text,text,text) OWNER TO research_stage_i_owner;

REVOKE ALL ON SCHEMA research_ordering_stage_h
 FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA research_ordering_stage_h
 FROM PUBLIC, anon, authenticated, service_role, research_stage_i_writer, research_stage_i_observer;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA research_ordering_stage_h
 FROM PUBLIC, anon, authenticated, service_role, research_stage_i_writer, research_stage_i_observer;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research_ordering_stage_h
 FROM PUBLIC, anon, authenticated, service_role, research_stage_i_writer, research_stage_i_observer;
GRANT USAGE ON SCHEMA research_ordering_stage_h TO research_stage_i_writer;
GRANT EXECUTE ON FUNCTION research_ordering_stage_h.hold_evidence(text,text,text,text,text)
 TO research_stage_i_writer;
COMMIT;
