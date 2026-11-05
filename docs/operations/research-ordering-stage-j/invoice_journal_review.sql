-- USD Impact Stage J: disposable invoice-key journal ONLY.
-- Not a migration; never install on Development or Production.
-- Canonical paid-invoice identity is (store_id,subscription_id,invoice_id),
-- not the webhook event name; success/recovered are companion deliveries.
BEGIN;
CREATE ROLE research_stage_j_owner NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE research_stage_j_writer NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE SCHEMA research_ordering_stage_j;
REVOKE ALL ON SCHEMA research_ordering_stage_j FROM PUBLIC;

CREATE TABLE research_ordering_stage_j.invoice_receipts (
  store_id text NOT NULL CHECK (store_id ~ '^[1-9][0-9]{0,17}$'),
  subscription_id text NOT NULL CHECK (subscription_id ~ '^[1-9][0-9]{0,17}$'),
  invoice_id text NOT NULL CHECK (invoice_id ~ '^[1-9][0-9]{0,17}$'),
  invoice_snapshot_digest text NOT NULL CHECK (invoice_snapshot_digest ~ '^[a-f0-9]{64}$'),
  disposition text NOT NULL DEFAULT 'pending_reconciliation'
    CHECK (disposition IN ('pending_reconciliation','quarantined_conflict')),
  first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (store_id,subscription_id,invoice_id)
);
ALTER TABLE research_ordering_stage_j.invoice_receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE research_ordering_stage_j.invoice_delivery_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id text NOT NULL,
  subscription_id text NOT NULL,
  invoice_id text NOT NULL,
  event_name text NOT NULL CHECK(event_name IN
    ('subscription_payment_success','subscription_payment_recovered')),
  signed_delivery_hash text NOT NULL CHECK(signed_delivery_hash ~ '^[a-f0-9]{64}$'),
  observed_invoice_digest text NOT NULL CHECK(observed_invoice_digest ~ '^[a-f0-9]{64}$'),
  action text NOT NULL CHECK(action IN
    ('first_invoice_held','duplicate_invoice_held','invoice_conflict_quarantined')),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT stage_j_delivery_invoice_fk FOREIGN KEY
    (store_id,subscription_id,invoice_id)
    REFERENCES research_ordering_stage_j.invoice_receipts(store_id,subscription_id,invoice_id)
    ON DELETE RESTRICT
);
ALTER TABLE research_ordering_stage_j.invoice_delivery_audit ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION research_ordering_stage_j.deny_journal_erase()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 RAISE EXCEPTION 'stage j invoice evidence erasure blocked' USING ERRCODE='42501';
END
$$;
CREATE TRIGGER stage_j_no_receipt_delete BEFORE DELETE
 ON research_ordering_stage_j.invoice_receipts
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_j.deny_journal_erase();
CREATE TRIGGER stage_j_no_receipt_truncate BEFORE TRUNCATE
 ON research_ordering_stage_j.invoice_receipts
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_j.deny_journal_erase();
CREATE TRIGGER stage_j_no_audit_delete BEFORE DELETE
 ON research_ordering_stage_j.invoice_delivery_audit
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_j.deny_journal_erase();
CREATE TRIGGER stage_j_no_audit_truncate BEFORE TRUNCATE
 ON research_ordering_stage_j.invoice_delivery_audit
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_j.deny_journal_erase();
CREATE TRIGGER stage_j_no_audit_update BEFORE UPDATE
 ON research_ordering_stage_j.invoice_delivery_audit
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_j.deny_journal_erase();

CREATE FUNCTION research_ordering_stage_j.immutable_original_and_quarantine()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF ROW(NEW.store_id,NEW.subscription_id,NEW.invoice_id,NEW.invoice_snapshot_digest,NEW.first_seen_at)
 IS DISTINCT FROM
 ROW(OLD.store_id,OLD.subscription_id,OLD.invoice_id,OLD.invoice_snapshot_digest,OLD.first_seen_at)
 THEN RAISE EXCEPTION 'stage j original invoice evidence immutable' USING ERRCODE='42501';
 END IF;
 IF NEW.disposition=OLD.disposition OR
    (OLD.disposition='pending_reconciliation' AND NEW.disposition='quarantined_conflict')
 THEN RETURN NEW;
 END IF;
 RAISE EXCEPTION 'stage j quarantine downgrade blocked' USING ERRCODE='42501';
END
$$;
CREATE TRIGGER stage_j_monotonic_receipt BEFORE UPDATE
 ON research_ordering_stage_j.invoice_receipts
 FOR EACH ROW EXECUTE FUNCTION research_ordering_stage_j.immutable_original_and_quarantine();

-- Private pending-only holder: no APPLY, no effects, no connection to provider.
-- The version/digest MUST come from independently verified external evidence
-- in any future architecture. Here it is synthetic and never a grant authority.
CREATE FUNCTION research_ordering_stage_j.hold_paid_invoice(
 p_store text,p_subscription text,p_invoice text,
 p_event_name text,p_signed_delivery_digest text,p_invoice_snapshot_digest text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE saved record; action_name text;
BEGIN
 IF p_store IS NULL OR p_store !~ '^[1-9][0-9]{0,17}$' OR
    p_subscription IS NULL OR p_subscription !~ '^[1-9][0-9]{0,17}$' OR
    p_invoice IS NULL OR p_invoice !~ '^[1-9][0-9]{0,17}$' OR
    p_event_name NOT IN ('subscription_payment_success','subscription_payment_recovered') OR
    p_signed_delivery_digest IS NULL OR p_signed_delivery_digest !~ '^[a-f0-9]{64}$' OR
    p_invoice_snapshot_digest IS NULL OR p_invoice_snapshot_digest !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'invalid synthetic invoice custody input' USING ERRCODE='22023';
 END IF;
 INSERT INTO research_ordering_stage_j.invoice_receipts
  (store_id,subscription_id,invoice_id,invoice_snapshot_digest)
 VALUES(p_store,p_subscription,p_invoice,p_invoice_snapshot_digest)
 ON CONFLICT(store_id,subscription_id,invoice_id) DO NOTHING;
 SELECT * INTO saved FROM research_ordering_stage_j.invoice_receipts
 WHERE store_id=p_store AND subscription_id=p_subscription AND invoice_id=p_invoice
 FOR UPDATE;
 IF saved.invoice_snapshot_digest=p_invoice_snapshot_digest THEN
   IF EXISTS(SELECT 1 FROM research_ordering_stage_j.invoice_delivery_audit
             WHERE store_id=p_store AND subscription_id=p_subscription AND invoice_id=p_invoice)
   THEN action_name:='duplicate_invoice_held';
   ELSE action_name:='first_invoice_held';
   END IF;
 ELSE
   UPDATE research_ordering_stage_j.invoice_receipts
     SET disposition='quarantined_conflict'
     WHERE store_id=p_store AND subscription_id=p_subscription AND invoice_id=p_invoice;
   action_name:='invoice_conflict_quarantined';
 END IF;
 INSERT INTO research_ordering_stage_j.invoice_delivery_audit
 (store_id,subscription_id,invoice_id,event_name,signed_delivery_hash,
  observed_invoice_digest,action)
 VALUES(p_store,p_subscription,p_invoice,p_event_name,p_signed_delivery_digest,
  p_invoice_snapshot_digest,action_name);
 RETURN jsonb_build_object(
  'action',action_name,'disposition',
  (SELECT disposition FROM research_ordering_stage_j.invoice_receipts
   WHERE store_id=p_store AND subscription_id=p_subscription AND invoice_id=p_invoice),
  'can_mutate',false,'invoice_identity',p_store||':'||p_subscription||':'||p_invoice);
END
$$;

ALTER SCHEMA research_ordering_stage_j OWNER TO research_stage_j_owner;
ALTER TABLE research_ordering_stage_j.invoice_receipts OWNER TO research_stage_j_owner;
ALTER TABLE research_ordering_stage_j.invoice_delivery_audit OWNER TO research_stage_j_owner;
ALTER FUNCTION research_ordering_stage_j.deny_journal_erase() OWNER TO research_stage_j_owner;
ALTER FUNCTION research_ordering_stage_j.immutable_original_and_quarantine() OWNER TO research_stage_j_owner;
ALTER FUNCTION research_ordering_stage_j.hold_paid_invoice(text,text,text,text,text,text)
 OWNER TO research_stage_j_owner;
REVOKE ALL ON SCHEMA research_ordering_stage_j FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA research_ordering_stage_j
 FROM PUBLIC,anon,authenticated,service_role,research_stage_j_writer;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA research_ordering_stage_j
 FROM PUBLIC,anon,authenticated,service_role,research_stage_j_writer;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research_ordering_stage_j
 FROM PUBLIC,anon,authenticated,service_role,research_stage_j_writer;
GRANT USAGE ON SCHEMA research_ordering_stage_j TO research_stage_j_writer;
GRANT EXECUTE ON FUNCTION research_ordering_stage_j.hold_paid_invoice(text,text,text,text,text,text)
 TO research_stage_j_writer;
COMMIT;
