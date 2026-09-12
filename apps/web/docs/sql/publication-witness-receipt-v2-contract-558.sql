-- Isolated review/test successor for #558, NOT a migration or live grant.
-- Requires the admission, governed-writer, receipt-ledger and witness-challenge
-- candidates in a NEW disposable test database. No managed DB or provider change.
BEGIN;
CREATE TABLE publication_guard.witness_dispatch_receipts (
 attempt_id text PRIMARY KEY REFERENCES publication_guard.dispatch_attempts(attempt_id),
 challenge_id text NOT NULL UNIQUE,
 canonical_origin text NOT NULL CHECK (canonical_origin='https://www.usd-impact.com'),
 envelope text NOT NULL CHECK (octet_length(envelope)<=24000),
 payload text NOT NULL CHECK (octet_length(payload)<=18000),
 receipt_sha256 text NOT NULL UNIQUE CHECK (receipt_sha256 ~ '^[a-f0-9]{64}$'),
 payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
 dispatched_at timestamptz NOT NULL,
 finished_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL,
 verification_deadline timestamptz NOT NULL,
 FOREIGN KEY(attempt_id,challenge_id)
   REFERENCES publication_guard.witness_challenge_claims(attempt_id,challenge_id),
 CHECK (isfinite(dispatched_at) AND isfinite(finished_at) AND isfinite(recorded_at) AND isfinite(verification_deadline)),
 CHECK (dispatched_at<=finished_at AND finished_at<=recorded_at AND recorded_at<verification_deadline),
 CHECK (verification_deadline<=finished_at+interval '15 seconds')
);
ALTER TABLE publication_guard.witness_dispatch_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON publication_guard.witness_dispatch_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON publication_guard.witness_dispatch_receipts TO fx558_recorder_owner;
CREATE POLICY fx558_witness_receipt_read ON publication_guard.witness_dispatch_receipts FOR SELECT
 TO fx558_recorder_owner USING(true);
CREATE POLICY fx558_witness_receipt_create ON publication_guard.witness_dispatch_receipts FOR INSERT
 TO fx558_recorder_owner WITH CHECK(true);
CREATE TRIGGER immutable_witness_dispatch_receipt BEFORE UPDATE OR DELETE ON publication_guard.witness_dispatch_receipts
 FOR EACH ROW EXECUTE FUNCTION publication_guard.immutable_dispatch_record();
CREATE TRIGGER witness_receipt_history AFTER INSERT ON publication_guard.witness_dispatch_receipts
 FOR EACH ROW EXECUTE FUNCTION publication_guard.advance_history();

CREATE FUNCTION publication_guard_api.consume_witness_receipt_v2(
 p_id text,p_envelope text,p_payload text,p_until timestamptz)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET row_security=on SET lock_timeout='2s' AS $$
DECLARE x publication_guard.dispatch_attempts; r publication_guard.release_authorizations;
 a publication_guard.publication_admissions; c publication_guard.witness_challenge_claims;
 old publication_guard.witness_dispatch_receipts; e jsonb; p jsonb; expected jsonb;
 rh text; ph text; dispatched timestamptz; finished timestamptz; t timestamptz; encoded text;
BEGIN
 IF (p_id ~ '^[a-f0-9]{32}$') IS NOT TRUE OR p_envelope IS NULL OR p_payload IS NULL
  OR octet_length(p_envelope)>24000 OR octet_length(p_payload)>18000 OR p_until IS NULL OR NOT isfinite(p_until)
 THEN RAISE EXCEPTION 'HOLD_WITNESS_RECEIPT_REQUEST'; END IF;
 e:=p_envelope::jsonb; p:=p_payload::jsonb;
 IF jsonb_typeof(e) IS DISTINCT FROM 'object' OR jsonb_typeof(p) IS DISTINCT FROM 'object'
  OR (e->>'signature' ~ '^[A-Za-z0-9_-]{86}$') IS NOT TRUE
 THEN RAISE EXCEPTION 'HOLD_WITNESS_RECEIPT_ENVELOPE'; END IF;
 encoded:=rtrim(translate(replace(encode(convert_to(p_payload,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
 IF p_envelope IS DISTINCT FROM '{"payload":"'||encoded||'","signature":"'||(e->>'signature')||'"}'
 THEN RAISE EXCEPTION 'HOLD_WITNESS_RECEIPT_ENVELOPE'; END IF;
 rh:=encode(sha256(convert_to(p_envelope,'UTF8')),'hex'); ph:=encode(sha256(convert_to(p_payload,'UTF8')),'hex');
 PERFORM publication_guard_api.acquire_writer_gate();
 SELECT * INTO x FROM publication_guard.dispatch_attempts WHERE attempt_id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'HOLD_ATTEMPT_UNKNOWN'; END IF;
 SELECT * INTO r FROM publication_guard.release_authorizations WHERE release_id=x.release_id FOR UPDATE;
 IF NOT FOUND OR r.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'HOLD_RELEASE_UNAUTHORIZED'; END IF;
 SELECT * INTO a FROM publication_guard.publication_admissions WHERE path=x.path AND source_sha256=x.source_sha256 FOR UPDATE;
 IF NOT FOUND OR a.release_id<>x.release_id THEN RAISE EXCEPTION 'HOLD_ADMISSION_NOT_PREPARED'; END IF;
 IF a.state='revoked' THEN RAISE EXCEPTION 'HOLD_REVOKED'; END IF;
 SELECT * INTO c FROM publication_guard.witness_challenge_claims
  WHERE attempt_id=p_id AND challenge_id=p->>'challengeId';
 IF NOT FOUND OR c.challenge_sha256 IS DISTINCT FROM p->>'challengeSha256'
  OR c.manifest_sha256 IS DISTINCT FROM p->>'witnessManifestSha256'
  OR c.canonical_origin IS DISTINCT FROM p->>'canonicalOrigin'
 THEN RAISE EXCEPTION 'HOLD_WITNESS_RECEIPT_CHALLENGE'; END IF;
 expected:=jsonb_build_object('schema','first-public-dispatch/v2','keyId',x.key_id,
  'audience','publication-history-recorder') || x.binding ||
  jsonb_build_object('canonicalOrigin',c.canonical_origin,'challengeId',c.challenge_id,
   'challengeSha256',c.challenge_sha256,'witnessManifestSha256',c.manifest_sha256,
   'dispatchedAt',p->>'dispatchedAt','finishedAt',p->>'finishedAt');
 IF p IS DISTINCT FROM expected THEN RAISE EXCEPTION 'HOLD_WITNESS_RECEIPT_BINDING'; END IF;
 IF p->>'manifestSha256' IS DISTINCT FROM c.manifest_sha256
  OR (p->>'dispatchedAt' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$') IS NOT TRUE
  OR (p->>'finishedAt' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$') IS NOT TRUE
 THEN RAISE EXCEPTION 'HOLD_WITNESS_RECEIPT_BINDING'; END IF;
 SELECT * INTO old FROM publication_guard.witness_dispatch_receipts WHERE attempt_id=p_id OR challenge_id=c.challenge_id;
 IF FOUND THEN
  IF ROW(old.envelope,old.payload,old.challenge_id,old.canonical_origin)
   IS DISTINCT FROM ROW(p_envelope,p_payload,c.challenge_id,c.canonical_origin)
  THEN RAISE EXCEPTION 'HOLD_WITNESS_RECEIPT_CONFLICT'; END IF;
  IF a.state<>'admitted' OR a.response_receipt_sha256<>rh THEN RAISE EXCEPTION 'HOLD_LEDGER_INCONSISTENT'; END IF;
  RETURN 'ALREADY_RECORDED';
 END IF;
 IF a.state<>'pending' THEN RAISE EXCEPTION 'HOLD_UNLEDGERED_ADMISSION'; END IF;
 dispatched:=(p->>'dispatchedAt')::timestamptz; finished:=(p->>'finishedAt')::timestamptz;
 t:=pg_catalog.clock_timestamp();
 IF publication_guard.iso(dispatched)<>p->>'dispatchedAt' OR publication_guard.iso(finished)<>p->>'finishedAt'
  OR dispatched<c.claimed_at OR dispatched<a.calendar_checked_at OR finished<dispatched OR finished>t
  OR t>=p_until OR p_until>c.valid_until OR p_until>a.calendar_valid_until OR p_until>r.expires_at
  OR p_until>finished+interval '15 seconds'
  OR (a.preview_deadline IS NOT NULL AND p_until>a.preview_deadline)
  OR (a.not_before IS NOT NULL AND dispatched<a.not_before)
 THEN RAISE EXCEPTION 'HOLD_WITNESS_RECEIPT_TIME'; END IF;
 IF publication_guard.finalize_admission(x.release_id,x.path,x.source_sha256,rh)<>'RECORDED'
 THEN RAISE EXCEPTION 'HOLD_LEDGER_INCONSISTENT'; END IF;
 t:=pg_catalog.clock_timestamp(); IF t>=p_until THEN RAISE EXCEPTION 'HOLD_WITNESS_RECEIPT_EXPIRED'; END IF;
 INSERT INTO publication_guard.witness_dispatch_receipts
  (attempt_id,challenge_id,canonical_origin,envelope,payload,receipt_sha256,payload_sha256,
   dispatched_at,finished_at,recorded_at,verification_deadline)
 VALUES(p_id,c.challenge_id,c.canonical_origin,p_envelope,p_payload,rh,ph,dispatched,finished,t,p_until);
 IF pg_catalog.clock_timestamp()>=p_until THEN RAISE EXCEPTION 'HOLD_WITNESS_RECEIPT_EXPIRED'; END IF;
 RETURN 'RECORDED';
END $$;

CREATE FUNCTION publication_guard_api.lookup_witness_receipt_v2(p_id text,p_hash text,p_challenge text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET row_security=on AS $$
DECLARE result jsonb;
BEGIN
 IF (p_id ~ '^[a-f0-9]{32}$') IS NOT TRUE OR (p_hash ~ '^[a-f0-9]{64}$') IS NOT TRUE
  OR (p_challenge ~ '^[a-f0-9]{32}$') IS NOT TRUE THEN RAISE EXCEPTION 'HOLD_WITNESS_RECEIPT_REQUEST'; END IF;
 SELECT jsonb_build_object('schema','stored-witness-dispatch-receipt/v2','attemptId',x.attempt_id,
  'receiptSha256',d.receipt_sha256,'payloadSha256',d.payload_sha256,'path',x.path,'sourceSha256',x.source_sha256,
  'challengeId',d.challenge_id,'challengeSha256',c.challenge_sha256,'canonicalOrigin',d.canonical_origin,
  'admittedAt',publication_guard.iso(a.admitted_at),'recordedAt',publication_guard.iso(d.recorded_at),
  'verificationDeadline',publication_guard.iso(d.verification_deadline),
  'state',CASE WHEN r.revoked_at IS NOT NULL THEN 'revoked' ELSE a.state END)
 INTO result FROM publication_guard.dispatch_attempts x JOIN publication_guard.witness_dispatch_receipts d USING(attempt_id)
 JOIN publication_guard.witness_challenge_claims c ON c.attempt_id=x.attempt_id AND c.challenge_id=d.challenge_id
 JOIN publication_guard.publication_admissions a ON a.path=x.path AND a.source_sha256=x.source_sha256
 JOIN publication_guard.release_authorizations r ON r.release_id=x.release_id
 WHERE x.attempt_id=p_id AND d.receipt_sha256=p_hash AND d.challenge_id=p_challenge
  AND a.response_receipt_sha256=d.receipt_sha256;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION publication_guard_api.consume_witness_receipt_v2(text,text,text,timestamptz),
 publication_guard_api.lookup_witness_receipt_v2(text,text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION publication_guard_api.consume_witness_receipt_v2(text,text,text,timestamptz) OWNER TO fx558_recorder_owner;
ALTER FUNCTION publication_guard_api.lookup_witness_receipt_v2(text,text,text) OWNER TO fx558_recorder_owner;
GRANT EXECUTE ON FUNCTION publication_guard_api.consume_witness_receipt_v2(text,text,text,timestamptz),
 publication_guard_api.lookup_witness_receipt_v2(text,text,text) TO fx558_recorder;
-- Once this successor is installed, the generic recorder role must not retain the
-- older signer-only finalization path. Existing legacy rows remain readable only
-- through governed history; this revocation does not rewrite historical evidence.
REVOKE EXECUTE ON FUNCTION publication_guard_api.consume_dispatch_receipt(text,text,text,timestamptz),
 publication_guard_api.lookup_dispatch_receipt(text,text) FROM fx558_recorder;
COMMIT;
