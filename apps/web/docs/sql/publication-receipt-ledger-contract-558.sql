-- Isolated review/test successor for #558, NOT a migration or live grant.
-- Apply after the exact baseline and governed-writer candidates in a NEW test DB.
-- SQL trusts an authenticated, isolated signature verifier; hash equality is not
-- public-response authentication. No new role, key, public schema or runtime route.
BEGIN;
CREATE TABLE publication_guard.dispatch_attempts (
 attempt_id text PRIMARY KEY CHECK (attempt_id ~ '^[a-f0-9]{32}$'),
 release_id uuid NOT NULL REFERENCES publication_guard.release_authorizations,
 path text NOT NULL,
 source_sha256 text NOT NULL,
 binding jsonb NOT NULL CHECK (jsonb_typeof(binding)='object'),
 key_id text NOT NULL CHECK (key_id ~ '^[a-z0-9-]{1,64}$'),
 key_fingerprint text NOT NULL CHECK (key_fingerprint ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL,
 UNIQUE(release_id,path),
 FOREIGN KEY(path,source_sha256) REFERENCES publication_guard.publication_admissions(path,source_sha256)
);
CREATE TABLE publication_guard.dispatch_receipts (
 attempt_id text PRIMARY KEY REFERENCES publication_guard.dispatch_attempts,
 envelope text NOT NULL CHECK (octet_length(envelope)<=24000),
 payload text NOT NULL CHECK (octet_length(payload)<=12000),
 receipt_sha256 text NOT NULL UNIQUE CHECK (receipt_sha256 ~ '^[a-f0-9]{64}$'),
 payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
 dispatched_at timestamptz NOT NULL,
 finished_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL,
 verification_deadline timestamptz NOT NULL,
 CHECK (isfinite(dispatched_at) AND isfinite(finished_at) AND isfinite(recorded_at) AND isfinite(verification_deadline)),
 CHECK (dispatched_at<=finished_at AND finished_at<=recorded_at AND recorded_at<verification_deadline),
 CHECK (verification_deadline<=finished_at+interval '15 seconds')
);
ALTER TABLE publication_guard.dispatch_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE publication_guard.dispatch_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON publication_guard.dispatch_attempts,publication_guard.dispatch_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON publication_guard.dispatch_attempts TO fx558_controller_owner,fx558_recorder_owner;
GRANT INSERT ON publication_guard.dispatch_attempts TO fx558_controller_owner;
GRANT SELECT,INSERT ON publication_guard.dispatch_receipts TO fx558_recorder_owner;
CREATE POLICY fx558_attempt_read ON publication_guard.dispatch_attempts FOR SELECT
 TO fx558_controller_owner,fx558_recorder_owner USING(true);
CREATE POLICY fx558_attempt_create ON publication_guard.dispatch_attempts FOR INSERT TO fx558_controller_owner WITH CHECK(true);
CREATE POLICY fx558_receipt_read ON publication_guard.dispatch_receipts FOR SELECT TO fx558_recorder_owner USING(true);
CREATE POLICY fx558_receipt_create ON publication_guard.dispatch_receipts FOR INSERT TO fx558_recorder_owner WITH CHECK(true);
CREATE FUNCTION publication_guard.immutable_dispatch_record() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'HOLD_IMMUTABLE_DISPATCH_RECORD'; END $$;
REVOKE ALL ON FUNCTION publication_guard.immutable_dispatch_record() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER immutable_attempt BEFORE UPDATE OR DELETE ON publication_guard.dispatch_attempts
 FOR EACH ROW EXECUTE FUNCTION publication_guard.immutable_dispatch_record();
CREATE TRIGGER immutable_receipt BEFORE UPDATE OR DELETE ON publication_guard.dispatch_receipts
 FOR EACH ROW EXECUTE FUNCTION publication_guard.immutable_dispatch_record();
CREATE TRIGGER attempt_history AFTER INSERT ON publication_guard.dispatch_attempts
 FOR EACH ROW EXECUTE FUNCTION publication_guard.advance_history();
CREATE TRIGGER receipt_history AFTER INSERT ON publication_guard.dispatch_receipts
 FOR EACH ROW EXECUTE FUNCTION publication_guard.advance_history();

CREATE FUNCTION publication_guard_api.stage_dispatch_attempt(p_id text,p_release uuid,p_binding jsonb,p_key text,p_fingerprint text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET row_security=on SET lock_timeout='2s' AS $$
DECLARE r publication_guard.release_authorizations; a publication_guard.publication_admissions;
 x publication_guard.dispatch_attempts; t timestamptz; expected jsonb;
BEGIN
 IF (p_id ~ '^[a-f0-9]{32}$') IS NOT TRUE OR p_release IS NULL
  OR (p_key ~ '^[a-z0-9-]{1,64}$') IS NOT TRUE OR (p_fingerprint ~ '^[a-f0-9]{64}$') IS NOT TRUE
  OR jsonb_typeof(p_binding) IS DISTINCT FROM 'object' OR octet_length(p_binding::text)>12000
 THEN RAISE EXCEPTION 'HOLD_INVALID_REQUEST'; END IF;
 PERFORM publication_guard_api.acquire_writer_gate();
 SELECT * INTO r FROM publication_guard.release_authorizations WHERE release_id=p_release FOR UPDATE;
 IF NOT FOUND OR r.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'HOLD_RELEASE_UNAUTHORIZED'; END IF;
 SELECT * INTO a FROM publication_guard.publication_admissions
  WHERE path=p_binding->>'path' AND source_sha256=p_binding->>'sourceSha256' FOR UPDATE;
 IF NOT FOUND OR a.release_id<>p_release THEN RAISE EXCEPTION 'HOLD_ADMISSION_NOT_PREPARED'; END IF;
 IF a.state<>'pending' THEN RAISE EXCEPTION 'HOLD_NOT_PENDING'; END IF;
 t:=pg_catalog.clock_timestamp();
 IF t>=r.expires_at THEN RAISE EXCEPTION 'HOLD_APPROVAL_EXPIRED'; END IF;
 IF t<a.calendar_checked_at OR t>=a.calendar_valid_until THEN RAISE EXCEPTION 'HOLD_EVIDENCE_EXPIRED'; END IF;
 IF a.preview_deadline IS NOT NULL AND t>=a.preview_deadline THEN RAISE EXCEPTION 'HOLD_PREVIEW_EXPIRED'; END IF;
 IF a.not_before IS NOT NULL AND t<a.not_before THEN RAISE EXCEPTION 'HOLD_OUTCOME_NOT_RELEASED'; END IF;
 -- Explicitly single-event BLS articles or a no-calendar Daily; not multi-event certification.
 IF (p_binding->>'manifestSha256' ~ '^[a-f0-9]{64}$') IS NOT TRUE
  OR (p_binding->>'responseSha256' ~ '^[a-f0-9]{64}$') IS NOT TRUE
  OR (a.event_mode<>'none' AND (p_binding->>'eventIdentity' ~ '^BLS:(CPI|PPI|EMPSIT):20[0-9]{2}-(0[1-9]|1[0-2]):initial$') IS NOT TRUE)
  OR (a.event_mode<>'none' AND a.path !~ '^/news/catalysts/')
 THEN RAISE EXCEPTION 'HOLD_UNSUPPORTED_BINDING'; END IF;
 expected:=jsonb_build_object('repository',r.repository,'projectId',r.project_id,'teamId',r.team_id,
  'target','production','exposure','public-approved','deploymentId',r.deployment_id,'commitSha',r.commit_sha,
  'artifactSha256',r.artifact_sha256,'manifestSha256',p_binding->>'manifestSha256','approvalSha256',r.approval_sha256,
  'path',a.path,'sourceSha256',a.source_sha256,'responseSha256',p_binding->>'responseSha256',
  'eventIdentity',CASE WHEN a.event_mode='none' THEN NULL ELSE p_binding->>'eventIdentity' END,
  'phase',a.event_mode,'releaseAt',publication_guard.iso(coalesce(a.preview_deadline,a.not_before)),
  'checkedAt',publication_guard.iso(a.calendar_checked_at),'validUntil',publication_guard.iso(a.calendar_valid_until),
  'attemptId',p_id,'surface','article','method','GET','status',200,'boundaryVersion','publication-dispatch/v1');
 IF p_binding IS DISTINCT FROM expected THEN RAISE EXCEPTION 'HOLD_ATTEMPT_BINDING'; END IF;
 SELECT * INTO x FROM publication_guard.dispatch_attempts WHERE attempt_id=p_id OR (release_id=p_release AND path=a.path);
 IF FOUND THEN
  IF ROW(x.attempt_id,x.release_id,x.path,x.source_sha256,x.binding,x.key_id,x.key_fingerprint)
   IS DISTINCT FROM ROW(p_id,p_release,a.path,a.source_sha256,p_binding,p_key,p_fingerprint)
   THEN RAISE EXCEPTION 'HOLD_ATTEMPT_CONFLICT'; END IF;
  RETURN 'ALREADY_STAGED';
 END IF;
 INSERT INTO publication_guard.dispatch_attempts VALUES(p_id,p_release,a.path,a.source_sha256,p_binding,p_key,p_fingerprint,t);
 RETURN 'STAGED_NOT_ADMITTED';
END $$;

-- Consume the one prepared attempt and write exact receipt bytes in the SAME
-- transaction as admission. The old digest-only client grant is removed below.
CREATE FUNCTION publication_guard_api.consume_dispatch_receipt(p_id text,p_envelope text,p_payload text,p_until timestamptz)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET row_security=on SET lock_timeout='2s' AS $$
DECLARE x publication_guard.dispatch_attempts; r publication_guard.release_authorizations;
 a publication_guard.publication_admissions; old publication_guard.dispatch_receipts;
 e jsonb; p jsonb; rh text; ph text; dispatched timestamptz; finished timestamptz; t timestamptz; encoded text;
BEGIN
 IF (p_id ~ '^[a-f0-9]{32}$') IS NOT TRUE OR p_envelope IS NULL OR p_payload IS NULL
  OR octet_length(p_envelope)>24000 OR octet_length(p_payload)>12000 OR p_until IS NULL OR NOT isfinite(p_until)
 THEN RAISE EXCEPTION 'HOLD_INVALID_REQUEST'; END IF;
 e:=p_envelope::jsonb; p:=p_payload::jsonb;
 IF jsonb_typeof(e) IS DISTINCT FROM 'object' OR jsonb_typeof(p) IS DISTINCT FROM 'object'
  OR (e->>'signature' ~ '^[A-Za-z0-9_-]{86}$') IS NOT TRUE
 THEN RAISE EXCEPTION 'HOLD_INVALID_ENVELOPE'; END IF;
 encoded:=rtrim(translate(replace(encode(convert_to(p_payload,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
 IF p_envelope IS DISTINCT FROM '{"payload":"'||encoded||'","signature":"'||(e->>'signature')||'"}'
 THEN RAISE EXCEPTION 'HOLD_ENVELOPE_PAYLOAD_MISMATCH'; END IF;
 rh:=encode(sha256(convert_to(p_envelope,'UTF8')),'hex'); ph:=encode(sha256(convert_to(p_payload,'UTF8')),'hex');
 PERFORM publication_guard_api.acquire_writer_gate();
 SELECT * INTO x FROM publication_guard.dispatch_attempts WHERE attempt_id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'HOLD_ATTEMPT_UNKNOWN'; END IF;
 SELECT * INTO r FROM publication_guard.release_authorizations WHERE release_id=x.release_id FOR UPDATE;
 IF NOT FOUND OR r.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'HOLD_RELEASE_UNAUTHORIZED'; END IF;
 SELECT * INTO a FROM publication_guard.publication_admissions WHERE path=x.path AND source_sha256=x.source_sha256 FOR UPDATE;
 IF NOT FOUND OR a.release_id<>x.release_id THEN RAISE EXCEPTION 'HOLD_ADMISSION_NOT_PREPARED'; END IF;
 IF a.state='revoked' THEN RAISE EXCEPTION 'HOLD_REVOKED'; END IF;
 IF p - ARRAY['schema','keyId','audience','dispatchedAt','finishedAt'] IS DISTINCT FROM x.binding
  OR p->>'schema' IS DISTINCT FROM 'first-public-dispatch/v1' OR p->>'audience' IS DISTINCT FROM 'publication-history-recorder'
  OR p->>'keyId' IS DISTINCT FROM x.key_id
  OR (p->>'dispatchedAt' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$') IS NOT TRUE
  OR (p->>'finishedAt' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$') IS NOT TRUE
 THEN RAISE EXCEPTION 'HOLD_RECEIPT_BINDING'; END IF;
 SELECT * INTO old FROM publication_guard.dispatch_receipts WHERE attempt_id=p_id;
 IF FOUND THEN
  IF ROW(old.envelope,old.payload) IS DISTINCT FROM ROW(p_envelope,p_payload)
   THEN RAISE EXCEPTION 'HOLD_RECEIPT_CONFLICT'; END IF;
  IF a.state<>'admitted' OR a.response_receipt_sha256<>rh THEN RAISE EXCEPTION 'HOLD_LEDGER_INCONSISTENT'; END IF;
  RETURN 'ALREADY_RECORDED'; -- Historical comparison only; no refreshed deadline or timestamp.
 END IF;
 IF a.state<>'pending' THEN RAISE EXCEPTION 'HOLD_UNLEDGERED_ADMISSION'; END IF;
 dispatched:=(p->>'dispatchedAt')::timestamptz; finished:=(p->>'finishedAt')::timestamptz;
 t:=pg_catalog.clock_timestamp();
 IF publication_guard.iso(dispatched)<>p->>'dispatchedAt' OR publication_guard.iso(finished)<>p->>'finishedAt'
  OR dispatched<x.created_at OR dispatched<a.calendar_checked_at OR finished<dispatched OR finished>t
  OR t>=p_until OR p_until>a.calendar_valid_until OR p_until>r.expires_at OR p_until>finished+interval '15 seconds'
  OR (a.preview_deadline IS NOT NULL AND p_until>a.preview_deadline)
  OR (a.not_before IS NOT NULL AND dispatched<a.not_before)
 THEN RAISE EXCEPTION 'HOLD_RECEIPT_TIME'; END IF;
 IF publication_guard.finalize_admission(x.release_id,x.path,x.source_sha256,rh)<>'RECORDED'
 THEN RAISE EXCEPTION 'HOLD_LEDGER_INCONSISTENT'; END IF;
 -- Recheck after nested triggers/locks; failure rolls admission/history back too.
 t:=pg_catalog.clock_timestamp();
 IF t>=p_until THEN RAISE EXCEPTION 'HOLD_RECEIPT_EXPIRED'; END IF;
 INSERT INTO publication_guard.dispatch_receipts VALUES(p_id,p_envelope,p_payload,rh,ph,dispatched,finished,t,p_until);
 IF pg_catalog.clock_timestamp()>=p_until THEN RAISE EXCEPTION 'HOLD_RECEIPT_EXPIRED'; END IF;
 RETURN 'RECORDED';
END $$;

CREATE FUNCTION publication_guard_api.lookup_dispatch_receipt(p_id text,p_hash text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET row_security=on AS $$
DECLARE result jsonb;
BEGIN
 IF (p_id ~ '^[a-f0-9]{32}$') IS NOT TRUE OR (p_hash ~ '^[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'HOLD_INVALID_REQUEST'; END IF;
 SELECT jsonb_build_object('schema','stored-dispatch-receipt/v1','attemptId',x.attempt_id,
  'receiptSha256',d.receipt_sha256,'payloadSha256',d.payload_sha256,'path',x.path,'sourceSha256',x.source_sha256,
  'admittedAt',publication_guard.iso(a.admitted_at),'recordedAt',publication_guard.iso(d.recorded_at),
  'verificationDeadline',publication_guard.iso(d.verification_deadline),
  'state',CASE WHEN r.revoked_at IS NOT NULL THEN 'revoked' ELSE a.state END)
 INTO result FROM publication_guard.dispatch_attempts x JOIN publication_guard.dispatch_receipts d USING(attempt_id)
 JOIN publication_guard.publication_admissions a ON a.path=x.path AND a.source_sha256=x.source_sha256
 JOIN publication_guard.release_authorizations r ON r.release_id=x.release_id
 WHERE x.attempt_id=p_id AND d.receipt_sha256=p_hash AND a.response_receipt_sha256=d.receipt_sha256;
 RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION publication_guard.iso(timestamptz) TO fx558_controller_owner,fx558_recorder_owner;
REVOKE ALL ON FUNCTION publication_guard_api.stage_dispatch_attempt(text,uuid,jsonb,text,text),
 publication_guard_api.consume_dispatch_receipt(text,text,text,timestamptz),
 publication_guard_api.lookup_dispatch_receipt(text,text) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION publication_guard_api.stage_dispatch_attempt(text,uuid,jsonb,text,text) OWNER TO fx558_controller_owner;
ALTER FUNCTION publication_guard_api.consume_dispatch_receipt(text,text,text,timestamptz) OWNER TO fx558_recorder_owner;
ALTER FUNCTION publication_guard_api.lookup_dispatch_receipt(text,text) OWNER TO fx558_recorder_owner;
GRANT EXECUTE ON FUNCTION publication_guard_api.stage_dispatch_attempt(text,uuid,jsonb,text,text) TO fx558_controller;
GRANT EXECUTE ON FUNCTION publication_guard_api.consume_dispatch_receipt(text,text,text,timestamptz),
 publication_guard_api.lookup_dispatch_receipt(text,text) TO fx558_recorder;
REVOKE ALL ON FUNCTION publication_guard_api.record_verified_receipt(uuid,text,text,text) FROM fx558_recorder;
COMMIT;
