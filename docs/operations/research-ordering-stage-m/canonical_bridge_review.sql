-- USD Impact Stage M: disposable J-1 archive + J-4 canonical digest contract.
-- NEVER install as a connected Supabase migration. No entitlement APPLY.
-- Load after historical migrations + C/H/I/J/K, AFTER synthetic legacy receipts.
BEGIN;

-- J-1: preserve old H/I receipts without allowing a second ordinary writer.
-- Owner/superuser remains able to change an owned object: explicit release residual.
REVOKE EXECUTE ON FUNCTION research_ordering_stage_h.hold_evidence(text,text,text,text,text)
 FROM research_stage_i_writer;
REVOKE USAGE ON SCHEMA research_ordering_stage_h FROM research_stage_i_writer;

CREATE ROLE research_stage_m_owner NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE SCHEMA research_ordering_stage_m;
REVOKE ALL ON SCHEMA research_ordering_stage_m FROM PUBLIC;

-- Append-only historical correspondence, not a second paid-cycle journal.
-- K/J remain the one pending-invoice custody path for future synthetic entries.
CREATE TABLE research_ordering_stage_m.legacy_receipt_links (
 event_key text PRIMARY KEY REFERENCES research_ordering_stage_h.pending_receipts(event_key)
   ON DELETE RESTRICT,
 observation_id bigint NOT NULL UNIQUE REFERENCES research_ordering_stage_k.provider_observations(id)
   ON DELETE RESTRICT,
 provider text NOT NULL,
 store_id text NOT NULL,
 test_mode boolean NOT NULL,
 invoice_id text NOT NULL,
 signed_delivery_hash text NOT NULL CHECK(signed_delivery_hash ~ '^[a-f0-9]{64}$'),
 disposition text NOT NULL DEFAULT 'legacy_historical_only'
   CHECK(disposition='legacy_historical_only'),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(provider,store_id,test_mode,invoice_id)
  REFERENCES research_ordering_stage_j.invoice_receipts(provider,store_id,test_mode,invoice_id)
  ON DELETE RESTRICT
);
ALTER TABLE research_ordering_stage_m.legacy_receipt_links ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION research_ordering_stage_m.refuse_link_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'stage m old receipt linkage is append-only'
  USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER stage_m_no_link_update BEFORE UPDATE
 ON research_ordering_stage_m.legacy_receipt_links
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_m.refuse_link_mutation();
CREATE TRIGGER stage_m_no_link_delete BEFORE DELETE
 ON research_ordering_stage_m.legacy_receipt_links
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_m.refuse_link_mutation();
CREATE TRIGGER stage_m_no_link_truncate BEFORE TRUNCATE
 ON research_ordering_stage_m.legacy_receipt_links
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_m.refuse_link_mutation();

-- Only link an existing H event when its identity AND all recorded fingerprints
-- match an independently existing K invoice observation. No guessed crosswalks.
-- DISTINCT ON chooses the earliest among matching duplicate K deliveries.
INSERT INTO research_ordering_stage_m.legacy_receipt_links
 (event_key,observation_id,provider,store_id,test_mode,invoice_id,signed_delivery_hash)
SELECT DISTINCT ON(h.event_key)
 h.event_key,k.id,k.provider,k.store_id,k.test_mode,k.invoice_id,k.signed_delivery_hash
FROM research_ordering_stage_h.pending_receipts AS h
JOIN research_ordering_stage_k.provider_observations AS k
 ON h.event_key = k.event_name || ':' || k.invoice_id
 AND h.signed_delivery_hash = k.signed_delivery_hash
 AND h.invoice_version = k.provider_invoice_version
 AND h.subscription_version = k.provider_subscription_version
 AND h.candidate_digest = k.invoice_snapshot_digest
ORDER BY h.event_key,k.id;

-- J-4 pure non-privileged canonical envelope. Restrict input to stable ASCII,
-- so PostgreSQL and Node byte sequences are identical across locales.
-- This validates a digest HANDOFF SHAPE, not the provenance of the digest.
CREATE FUNCTION research_ordering_stage_m.invoice_handoff_digest_v1(
 p_provider text,p_store text,p_test_mode boolean,p_invoice text,
 p_subscription text,p_invoice_snapshot_digest text,p_quote_digest text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE canonical text;
BEGIN
 IF p_provider IS DISTINCT FROM 'lemon-squeezy'
 OR p_store IS NULL OR p_store !~ '^[1-9][0-9]{0,17}$'
 OR p_test_mode IS NULL
 OR p_invoice IS NULL OR p_invoice !~ '^[1-9][0-9]{0,17}$'
 OR p_subscription IS NULL OR p_subscription !~ '^[1-9][0-9]{0,17}$'
 OR p_invoice_snapshot_digest IS NULL OR p_invoice_snapshot_digest !~ '^[a-f0-9]{64}$'
 OR p_quote_digest IS NULL OR p_quote_digest !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'invalid synthetic canonical invoice digest input'
  USING ERRCODE='22023';
 END IF;
 canonical:='m1|'||p_provider||'|'||p_store||'|'||
   (CASE WHEN p_test_mode THEN 'test' ELSE 'live' END)||'|'||
   p_invoice||'|'||p_subscription||'|'||
   p_invoice_snapshot_digest||'|'||p_quote_digest;
 RETURN pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(canonical,'UTF8')),'hex');
END;
$$;

ALTER SCHEMA research_ordering_stage_m OWNER TO research_stage_m_owner;
ALTER TABLE research_ordering_stage_m.legacy_receipt_links OWNER TO research_stage_m_owner;
ALTER FUNCTION research_ordering_stage_m.refuse_link_mutation() OWNER TO research_stage_m_owner;
ALTER FUNCTION research_ordering_stage_m.invoice_handoff_digest_v1(
 text,text,boolean,text,text,text,text) OWNER TO research_stage_m_owner;

REVOKE ALL ON SCHEMA research_ordering_stage_m FROM PUBLIC,anon,authenticated,service_role,
 research_stage_i_writer,research_stage_j_writer,research_stage_k_gateway;
REVOKE ALL ON ALL TABLES IN SCHEMA research_ordering_stage_m FROM PUBLIC,anon,
 authenticated,service_role,research_stage_i_writer,research_stage_j_writer,research_stage_k_gateway;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research_ordering_stage_m FROM PUBLIC,anon,
 authenticated,service_role,research_stage_i_writer,research_stage_j_writer,research_stage_k_gateway;
COMMIT;
