-- USD Impact Research Stage K -- ISOLATED PostgreSQL 17.6 REVIEW OVERLAY ONLY.
-- Load after Stage H + I + J review SQL on disposable ci_review, NEVER a migration.
-- All provider evidence and credential material in this file is synthetic.
BEGIN;

-- H1. The only SECURITY DEFINER review entrypoints in the H/I/J journal chain
-- use an EMPTY search path. Every table/function they reference is schema-qualified.
ALTER FUNCTION research_ordering_stage_h.hold_evidence(text,text,text,text,text)
 SET search_path TO '';
ALTER FUNCTION research_ordering_stage_j.hold_paid_invoice(text,text,boolean,text,text,text,text,text)
 SET search_path TO '';

CREATE ROLE research_stage_k_owner NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE research_stage_k_gateway LOGIN NOINHERIT NOBYPASSRLS
 CONNECTION LIMIT 2 PASSWORD 'synthetic-stage-k-ci-only-long-password';
ALTER ROLE research_stage_k_gateway SET statement_timeout TO '2s';
ALTER ROLE research_stage_k_gateway SET lock_timeout TO '1s';
ALTER ROLE research_stage_k_gateway SET idle_in_transaction_session_timeout TO '3s';

CREATE SCHEMA research_ordering_stage_k;
REVOKE ALL ON SCHEMA research_ordering_stage_k FROM PUBLIC;

-- D1: audit ALL original, duplicate, conflict, and quarantined replays with
-- full provider versions/digests. Never store raw webhook bodies, bearer keys
-- or PII. A SHA-256 is a fingerprint, not an authoritative provider proof.
CREATE TABLE research_ordering_stage_k.provider_observations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 provider text NOT NULL CHECK(provider='lemon-squeezy'),
 store_id text NOT NULL CHECK(store_id ~ '^[1-9][0-9]{0,17}$'),
 test_mode boolean NOT NULL,
 invoice_id text NOT NULL CHECK(invoice_id ~ '^[1-9][0-9]{0,17}$'),
 subscription_id text NOT NULL CHECK(subscription_id ~ '^[1-9][0-9]{0,17}$'),
 event_name text NOT NULL CHECK(event_name IN
  ('subscription_payment_success','subscription_payment_recovered')),
 signed_delivery_hash text NOT NULL CHECK(signed_delivery_hash ~ '^[a-f0-9]{64}$'),
 invoice_snapshot_digest text NOT NULL CHECK(invoice_snapshot_digest ~ '^[a-f0-9]{64}$'),
 provider_invoice_version text NOT NULL CHECK(length(provider_invoice_version) BETWEEN 1 AND 160),
 provider_subscription_version text NOT NULL CHECK(length(provider_subscription_version) BETWEEN 1 AND 160),
 quote_evidence_digest text NOT NULL CHECK(quote_evidence_digest ~ '^[a-f0-9]{64}$'),
 action text NOT NULL CHECK(action IN
  ('first_invoice_held','duplicate_invoice_held','invoice_conflict_quarantined')),
 disposition text NOT NULL CHECK(disposition IN
  ('pending_reconciliation','quarantined_conflict')),
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(provider,store_id,test_mode,invoice_id)
  REFERENCES research_ordering_stage_j.invoice_receipts
  (provider,store_id,test_mode,invoice_id) ON DELETE RESTRICT
);
ALTER TABLE research_ordering_stage_k.provider_observations ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION research_ordering_stage_k.refuse_observation_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'stage k complete observation history is append-only'
  USING ERRCODE='42501';
END
$$;
CREATE TRIGGER stage_k_no_observation_update BEFORE UPDATE
 ON research_ordering_stage_k.provider_observations
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_k.refuse_observation_change();
CREATE TRIGGER stage_k_no_observation_delete BEFORE DELETE
 ON research_ordering_stage_k.provider_observations
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_k.refuse_observation_change();
CREATE TRIGGER stage_k_no_observation_truncate BEFORE TRUNCATE
 ON research_ordering_stage_k.provider_observations
 FOR EACH STATEMENT EXECUTE FUNCTION research_ordering_stage_k.refuse_observation_change();

-- D1: there is ONE authorized private path to append the full observation.
-- It delegates canonical invoice identity, quarantine and lock serialization
-- to Stage J, then atomically records ALL conflicting supplied fingerprints.
-- NO direct entitlement or subscription write exists.
CREATE FUNCTION research_ordering_stage_k.hold_observation(
 p_provider text,p_store text,p_test_mode boolean,p_subscription text,p_invoice text,
 p_event_name text,p_signed_delivery_digest text,p_invoice_snapshot_digest text,
 p_provider_invoice_version text,p_provider_subscription_version text,
 p_quote_evidence_digest text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;
BEGIN
 IF p_provider IS NULL OR p_provider <> 'lemon-squeezy' OR
    p_test_mode IS NULL OR p_subscription IS NULL OR
    p_event_name IS NULL OR
    p_signed_delivery_digest IS NULL OR p_signed_delivery_digest !~ '^[a-f0-9]{64}$' OR
    p_invoice_snapshot_digest IS NULL OR p_invoice_snapshot_digest !~ '^[a-f0-9]{64}$' OR
    p_quote_evidence_digest IS NULL OR p_quote_evidence_digest !~ '^[a-f0-9]{64}$' OR
    coalesce(length(p_provider_invoice_version),0) NOT BETWEEN 1 AND 160 OR
    coalesce(length(p_provider_subscription_version),0) NOT BETWEEN 1 AND 160
 THEN RAISE EXCEPTION 'invalid complete synthetic observation'
    USING ERRCODE='22023';
 END IF;
 v:=research_ordering_stage_j.hold_paid_invoice(
  p_provider,p_store,p_test_mode,p_subscription,p_invoice,p_event_name,
  p_signed_delivery_digest,p_invoice_snapshot_digest);
 INSERT INTO research_ordering_stage_k.provider_observations(
  provider,store_id,test_mode,subscription_id,invoice_id,event_name,
  signed_delivery_hash,invoice_snapshot_digest,provider_invoice_version,
  provider_subscription_version,quote_evidence_digest,action,disposition)
 VALUES(p_provider,p_store,p_test_mode,p_subscription,p_invoice,p_event_name,
  p_signed_delivery_digest,p_invoice_snapshot_digest,p_provider_invoice_version,
  p_provider_subscription_version,p_quote_evidence_digest,v->>'action',v->>'disposition');
 RETURN jsonb_build_object('action',v->>'action','disposition',v->>'disposition',
  'canonical_invoice_key',v->>'invoice_identity',
  'can_mutate',false,'authoritative_paid_cycle',false,
  'provider_settlement_proven',false,'remote_atomicity_proven',false);
END;
$$;

ALTER SCHEMA research_ordering_stage_k OWNER TO research_stage_k_owner;
ALTER TABLE research_ordering_stage_k.provider_observations OWNER TO research_stage_k_owner;
ALTER FUNCTION research_ordering_stage_k.refuse_observation_change()
 OWNER TO research_stage_k_owner;
ALTER FUNCTION research_ordering_stage_k.hold_observation(
 text,text,boolean,text,text,text,text,text,text,text,text)
 OWNER TO research_stage_k_owner;

-- The K holder must have only the EXECUTE ability to the J holder.
GRANT USAGE ON SCHEMA research_ordering_stage_j TO research_stage_k_owner;
GRANT EXECUTE ON FUNCTION research_ordering_stage_j.hold_paid_invoice(
 text,text,boolean,text,text,text,text,text) TO research_stage_k_owner;
-- Prevent ordinary J review writer calls from evading the new complete audit.
REVOKE EXECUTE ON FUNCTION research_ordering_stage_j.hold_paid_invoice(
 text,text,boolean,text,text,text,text,text) FROM research_stage_j_writer;

REVOKE ALL ON SCHEMA research_ordering_stage_k
 FROM PUBLIC,anon,authenticated,service_role,research_stage_k_gateway;
REVOKE ALL ON ALL TABLES IN SCHEMA research_ordering_stage_k
 FROM PUBLIC,anon,authenticated,service_role,research_stage_k_gateway;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA research_ordering_stage_k
 FROM PUBLIC,anon,authenticated,service_role,research_stage_k_gateway;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research_ordering_stage_k
 FROM PUBLIC,anon,authenticated,service_role,research_stage_k_gateway;
GRANT USAGE ON SCHEMA research_ordering_stage_k TO research_stage_k_gateway;
GRANT EXECUTE ON FUNCTION research_ordering_stage_k.hold_observation(
 text,text,boolean,text,text,text,text,text,text,text,text)
 TO research_stage_k_gateway;

COMMIT;
