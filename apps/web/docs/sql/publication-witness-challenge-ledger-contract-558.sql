-- Isolated review/test successor for #558, NOT a migration or live grant.
-- Apply only after the exact admission, governed-writer and receipt-ledger candidates
-- in a NEW disposable test database. No public schema, Data API grant, credential,
-- route or Production setting is introduced by this file.
BEGIN;
CREATE TABLE publication_guard.witness_challenge_claims (
 challenge_id text PRIMARY KEY CHECK (challenge_id ~ '^[a-f0-9]{32}$'),
 attempt_id text NOT NULL REFERENCES publication_guard.dispatch_attempts(attempt_id),
 challenge_sha256 text NOT NULL UNIQUE CHECK (challenge_sha256 ~ '^[a-f0-9]{64}$'),
 manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
 claimed_at timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 CHECK (isfinite(claimed_at) AND isfinite(valid_until) AND claimed_at < valid_until),
 UNIQUE(attempt_id,challenge_id)
);
ALTER TABLE publication_guard.witness_challenge_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON publication_guard.witness_challenge_claims FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON publication_guard.witness_challenge_claims TO fx558_recorder_owner;
CREATE POLICY fx558_witness_claim_read ON publication_guard.witness_challenge_claims FOR SELECT
 TO fx558_recorder_owner USING(true);
CREATE POLICY fx558_witness_claim_create ON publication_guard.witness_challenge_claims FOR INSERT
 TO fx558_recorder_owner WITH CHECK(true);
CREATE TRIGGER immutable_witness_challenge BEFORE UPDATE OR DELETE ON publication_guard.witness_challenge_claims
 FOR EACH ROW EXECUTE FUNCTION publication_guard.immutable_dispatch_record();

CREATE FUNCTION publication_guard_api.claim_witness_challenge(
 p_attempt text,p_challenge text,p_challenge_hash text,p_manifest_hash text,p_until timestamptz)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET row_security=on SET lock_timeout='2s' AS $$
DECLARE x0 publication_guard.dispatch_attempts; x publication_guard.dispatch_attempts;
 r publication_guard.release_authorizations; a publication_guard.publication_admissions;
 old publication_guard.witness_challenge_claims; t timestamptz; attempt_until timestamptz;
BEGIN
 IF (p_attempt ~ '^[a-f0-9]{32}$') IS NOT TRUE OR (p_challenge ~ '^[a-f0-9]{32}$') IS NOT TRUE
  OR (p_challenge_hash ~ '^[a-f0-9]{64}$') IS NOT TRUE OR (p_manifest_hash ~ '^[a-f0-9]{64}$') IS NOT TRUE
  OR p_until IS NULL OR NOT isfinite(p_until)
 THEN RAISE EXCEPTION 'HOLD_WITNESS_CLAIM_REQUEST'; END IF;
 PERFORM publication_guard_api.acquire_writer_gate();
 SELECT * INTO x0 FROM publication_guard.dispatch_attempts WHERE attempt_id=p_attempt;
 IF NOT FOUND THEN RAISE EXCEPTION 'HOLD_ATTEMPT_UNKNOWN'; END IF;
 SELECT * INTO r FROM publication_guard.release_authorizations WHERE release_id=x0.release_id FOR UPDATE;
 IF NOT FOUND OR r.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'HOLD_RELEASE_UNAUTHORIZED'; END IF;
 SELECT * INTO a FROM publication_guard.publication_admissions
  WHERE path=x0.path AND source_sha256=x0.source_sha256 FOR UPDATE;
 IF NOT FOUND OR a.release_id<>x0.release_id OR a.state<>'pending' THEN RAISE EXCEPTION 'HOLD_ADMISSION_NOT_PENDING'; END IF;
 SELECT * INTO x FROM publication_guard.dispatch_attempts WHERE attempt_id=p_attempt;
 IF NOT FOUND OR ROW(x.release_id,x.path,x.source_sha256,x.binding,x.key_id,x.key_fingerprint,x.created_at)
  IS DISTINCT FROM ROW(x0.release_id,x0.path,x0.source_sha256,x0.binding,x0.key_id,x0.key_fingerprint,x0.created_at)
 THEN RAISE EXCEPTION 'HOLD_ATTEMPT_DRIFT'; END IF;
 IF x.binding->>'manifestSha256' IS DISTINCT FROM p_manifest_hash THEN RAISE EXCEPTION 'HOLD_WITNESS_CLAIM_BINDING'; END IF;
 IF (x.binding->>'validUntil' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$') IS NOT TRUE
 THEN RAISE EXCEPTION 'HOLD_WITNESS_CLAIM_BINDING'; END IF;
 attempt_until:=(x.binding->>'validUntil')::timestamptz;
 IF publication_guard.iso(attempt_until)<>x.binding->>'validUntil' THEN RAISE EXCEPTION 'HOLD_WITNESS_CLAIM_BINDING'; END IF;
 t:=pg_catalog.clock_timestamp();
 IF t>=p_until OR p_until>attempt_until OR p_until>a.calendar_valid_until OR p_until>r.expires_at
  OR (a.preview_deadline IS NOT NULL AND p_until>a.preview_deadline)
 THEN RAISE EXCEPTION 'HOLD_WITNESS_CLAIM_EXPIRED'; END IF;
 IF (SELECT count(*) FROM publication_guard.witness_challenge_claims WHERE attempt_id=p_attempt)>=8
 THEN RAISE EXCEPTION 'HOLD_WITNESS_CLAIM_LIMIT'; END IF;
 SELECT * INTO old FROM publication_guard.witness_challenge_claims
  WHERE challenge_id=p_challenge OR challenge_sha256=p_challenge_hash LIMIT 1;
 IF FOUND THEN RAISE EXCEPTION 'HOLD_WITNESS_CHALLENGE_REPLAY'; END IF;
 INSERT INTO publication_guard.witness_challenge_claims
  (challenge_id,attempt_id,challenge_sha256,manifest_sha256,claimed_at,valid_until)
 VALUES(p_challenge,p_attempt,p_challenge_hash,p_manifest_hash,t,p_until);
 IF pg_catalog.clock_timestamp()>=p_until THEN RAISE EXCEPTION 'HOLD_WITNESS_CLAIM_EXPIRED'; END IF;
 RETURN 'CLAIMED_WITNESS_CHALLENGE';
END $$;

CREATE FUNCTION publication_guard_api.lookup_witness_challenge(
 p_attempt text,p_challenge text,p_challenge_hash text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET row_security=on AS $$
DECLARE result jsonb;
BEGIN
 IF (p_attempt ~ '^[a-f0-9]{32}$') IS NOT TRUE OR (p_challenge ~ '^[a-f0-9]{32}$') IS NOT TRUE
  OR (p_challenge_hash ~ '^[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'HOLD_WITNESS_CLAIM_REQUEST'; END IF;
 SELECT jsonb_build_object('schema','stored-witness-challenge-claim/v1','attemptId',attempt_id,
  'challengeId',challenge_id,'challengeSha256',challenge_sha256,'manifestSha256',manifest_sha256,
  'claimedAt',publication_guard.iso(claimed_at),'validUntil',publication_guard.iso(valid_until))
 INTO result FROM publication_guard.witness_challenge_claims
 WHERE attempt_id=p_attempt AND challenge_id=p_challenge AND challenge_sha256=p_challenge_hash;
 RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION publication_guard.iso(timestamptz) TO fx558_recorder_owner;
REVOKE ALL ON FUNCTION publication_guard_api.claim_witness_challenge(text,text,text,text,timestamptz),
 publication_guard_api.lookup_witness_challenge(text,text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION publication_guard_api.claim_witness_challenge(text,text,text,text,timestamptz) OWNER TO fx558_recorder_owner;
ALTER FUNCTION publication_guard_api.lookup_witness_challenge(text,text,text) OWNER TO fx558_recorder_owner;
GRANT EXECUTE ON FUNCTION publication_guard_api.claim_witness_challenge(text,text,text,text,timestamptz),
 publication_guard_api.lookup_witness_challenge(text,text,text) TO fx558_recorder;
COMMIT;
