-- USD Impact Stage H REVIEW ONLY: private evidence journal in disposable PostgreSQL.
-- Not a Supabase migration; NEVER install in Production or Development.
BEGIN;
CREATE SCHEMA research_ordering_stage_h;
REVOKE ALL ON SCHEMA research_ordering_stage_h FROM PUBLIC;

CREATE TABLE research_ordering_stage_h.pending_receipts (
  event_key text PRIMARY KEY CHECK (length(event_key) BETWEEN 3 AND 200),
  signed_delivery_hash text NOT NULL CHECK(signed_delivery_hash ~ '^[a-f0-9]{64}$'),
  invoice_version text NOT NULL,
  subscription_version text NOT NULL,
  candidate_digest text NOT NULL CHECK(candidate_digest ~ '^[a-f0-9]{64}$'),
  disposition text NOT NULL DEFAULT 'pending_reconciliation'
    CHECK(disposition IN ('pending_reconciliation', 'quarantined_conflict')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE research_ordering_stage_h.pending_receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE research_ordering_stage_h.receipt_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL,
  action text NOT NULL CHECK(action IN ('candidate_held', 'duplicate_held', 'conflict_quarantined')),
  observed_digest text NOT NULL CHECK (observed_digest ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE research_ordering_stage_h.receipt_audit ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION research_ordering_stage_h.protect_audit() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'stage h audit is immutable' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER h_audit_immutable BEFORE UPDATE OR DELETE ON research_ordering_stage_h.receipt_audit
FOR EACH ROW EXECUTE FUNCTION research_ordering_stage_h.protect_audit();

CREATE FUNCTION research_ordering_stage_h.protect_payload() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF ROW(OLD.event_key, OLD.signed_delivery_hash, OLD.invoice_version,
   OLD.subscription_version, OLD.candidate_digest, OLD.created_at) IS DISTINCT FROM
   ROW(NEW.event_key, NEW.signed_delivery_hash, NEW.invoice_version,
   NEW.subscription_version, NEW.candidate_digest, NEW.created_at) THEN
   RAISE EXCEPTION 'stage h original evidence cannot be rewritten' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER h_receipt_immutable BEFORE UPDATE ON research_ordering_stage_h.pending_receipts
FOR EACH ROW EXECUTE FUNCTION research_ordering_stage_h.protect_payload();

-- No APPLY operation exists. Evidence storage cannot write subscriptions or entitlements.
CREATE FUNCTION research_ordering_stage_h.hold_evidence(
 p_event_key text, p_signed_digest text, p_invoice_version text,
 p_subscription_version text, p_candidate_digest text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE saved record; action text;
BEGIN
 IF p_event_key IS NULL OR length(p_event_key) NOT BETWEEN 3 AND 200 OR
   p_signed_digest !~ '^[a-f0-9]{64}$' OR p_candidate_digest !~ '^[a-f0-9]{64}$' OR
   coalesce(length(p_invoice_version),0) NOT BETWEEN 1 AND 72 OR
   coalesce(length(p_subscription_version),0) NOT BETWEEN 1 AND 72 THEN
   RAISE EXCEPTION 'invalid review evidence' USING ERRCODE='22023';
 END IF;
 INSERT INTO research_ordering_stage_h.pending_receipts
 (event_key,signed_delivery_hash,invoice_version,subscription_version,candidate_digest)
 VALUES (p_event_key,p_signed_digest,p_invoice_version,p_subscription_version,p_candidate_digest)
 ON CONFLICT (event_key) DO NOTHING;
 SELECT * INTO saved FROM research_ordering_stage_h.pending_receipts WHERE event_key=p_event_key FOR UPDATE;
 IF saved.signed_delivery_hash=p_signed_digest AND
   saved.invoice_version=p_invoice_version AND saved.subscription_version=p_subscription_version AND
   saved.candidate_digest=p_candidate_digest THEN
   IF NOT EXISTS (SELECT 1 FROM research_ordering_stage_h.receipt_audit a WHERE a.event_key=p_event_key) THEN
     action:='candidate_held';
   ELSE action:='duplicate_held'; END IF;
 ELSE
   UPDATE research_ordering_stage_h.pending_receipts SET disposition='quarantined_conflict' WHERE event_key=p_event_key;
   action:='conflict_quarantined';
 END IF;
 INSERT INTO research_ordering_stage_h.receipt_audit(event_key,action,observed_digest)
 VALUES (p_event_key,action,p_candidate_digest);
 RETURN jsonb_build_object('action',action, 'can_mutate',false,
   'disposition',(SELECT disposition FROM research_ordering_stage_h.pending_receipts WHERE event_key=p_event_key));
END;
$$;
REVOKE ALL ON FUNCTION research_ordering_stage_h.hold_evidence(text,text,text,text,text) FROM PUBLIC;
COMMIT;
