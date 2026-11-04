-- USD Impact #1103 B-4.1: ISOLATED D1 SYNTHETIC POSTGRES ONLY.
-- This file is NOT a Supabase migration. No Production or Development DB.
-- Execute ONLY AFTER the earlier B-4 fixture and tests have finished.
-- Provider HMAC verification is ASSUMED outside SQL; the synthetic verifier
-- role is not proof of real Lemon Squeezy signed/authentic payment.
-- The caller cannot certify payment from a digest supplied by a customer.
-- No real checkout/entitlement/payment/provider operations are performed.
BEGIN;
ALTER DEFAULT PRIVILEGES FOR ROLE ci_research REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE review_binding_writer REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE ROLE review_b41_checkout_issuer LOGIN PASSWORD 'ci_b41_issuer_only_password';
CREATE ROLE review_b41_paid_verifier LOGIN PASSWORD 'ci_b41_verifier_only_password';
GRANT USAGE ON SCHEMA research_binding_review TO review_b41_checkout_issuer,review_b41_paid_verifier;

-- Server-only issuance. Synthetic issuer role has no direct table rights.
CREATE TABLE research_binding_review.checkout_reservations_v41(
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references research_binding_review.profiles(account_id) on delete restrict,
  checkout_key_digest text not null unique check (checkout_key_digest ~ '^[a-f0-9]{64}$'),
  provider_price_id text not null check (char_length(provider_price_id) between 1 and 128),
  expires_at timestamptz not null,
  state text not null default 'issued' check (state in ('issued','consumed')),
  consumed_by_subscription text,
  created_at timestamptz not null default clock_timestamp(),
  check ((state='issued' and consumed_by_subscription is null) or
         (state='consumed' and consumed_by_subscription is not null))
);

-- Verified-event evidence is not automatically bound to an app user.
-- 'verified' below means only that a trusted synthetic verifier role called
-- this RPC. In Production an independently verified raw HMAC, store/product,
-- mode, subscription-object provenance and authoritative paid state are mandatory.
CREATE TABLE research_binding_review.verified_paid_events_v41(
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique check (char_length(provider_event_id) between 1 and 255),
  provider_subscription_id text not null check (char_length(provider_subscription_id) between 1 and 255),
  claimed_account_id uuid,
  claimed_checkout_digest text check (claimed_checkout_digest is null or claimed_checkout_digest ~ '^[a-f0-9]{64}$'),
  provider_price_id text not null check (char_length(provider_price_id) between 1 and 128),
  verified_raw_body_sha256 text not null check (verified_raw_body_sha256 ~ '^[a-f0-9]{64}$'),
  verifier_version text not null check (verifier_version in ('research-hmac-review-v1')),
  provider_state text not null check (provider_state in ('paid','refunded','cancelled')),
  disposition text not null check (disposition in ('accepted','identity_conflict','unbound')),
  observed_at timestamptz not null default clock_timestamp()
);
CREATE TABLE research_binding_review.provider_claims_v41(
  provider_subscription_id text primary key,
  claimed_account_id uuid,
  first_event_id text not null,
  observed_at timestamptz not null default clock_timestamp()
);
CREATE TABLE research_binding_review.conflicts_v41(
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null,
  provider_subscription_id text not null,
  claimed_account_id uuid,
  code text not null check (code in (
    'missing_custom_binding','provider_identity_conflict','event_identity_conflict',
    'unissued_checkout_key','expired_checkout_key','checkout_consumed_by_other',
    'price_mismatch','unverified_paid_evidence','provider_not_paid',
    'duplicate_paid_subscription','entitlement_conflict','subscription_not_pending',
    'provider_subscription_in_use','account_unavailable','subscription_unbound'
  )),
  observed_at timestamptz not null default clock_timestamp()
);

-- An evidence-owner has no writer membership and cannot directly write
-- existing subscriptions or entitlements. No direct table access to API users.
ALTER TABLE research_binding_review.verified_paid_events_v41 OWNER TO review_binding_evidence_owner;
ALTER TABLE research_binding_review.provider_claims_v41 OWNER TO review_binding_evidence_owner;
ALTER TABLE research_binding_review.conflicts_v41 OWNER TO review_binding_evidence_owner;
CREATE TRIGGER b41_events_no_update_delete
BEFORE UPDATE OR DELETE ON research_binding_review.verified_paid_events_v41
FOR EACH ROW EXECUTE FUNCTION research_binding_review.reject_evidence_mutation();
CREATE TRIGGER b41_events_no_truncate
BEFORE TRUNCATE ON research_binding_review.verified_paid_events_v41
FOR EACH STATEMENT EXECUTE FUNCTION research_binding_review.reject_evidence_mutation();
CREATE TRIGGER b41_conflicts_no_update_delete
BEFORE UPDATE OR DELETE ON research_binding_review.conflicts_v41
FOR EACH ROW EXECUTE FUNCTION research_binding_review.reject_evidence_mutation();
CREATE TRIGGER b41_conflicts_no_truncate
BEFORE TRUNCATE ON research_binding_review.conflicts_v41
FOR EACH STATEMENT EXECUTE FUNCTION research_binding_review.reject_evidence_mutation();
GRANT SELECT,INSERT,UPDATE ON research_binding_review.checkout_reservations_v41 TO review_binding_writer;
GRANT SELECT,INSERT ON research_binding_review.verified_paid_events_v41 TO review_binding_writer;
GRANT SELECT,INSERT ON research_binding_review.provider_claims_v41 TO review_binding_writer;
GRANT SELECT,INSERT ON research_binding_review.conflicts_v41 TO review_binding_writer;

-- Y6: prevent even a privileged Research writer function from touching
-- synthetic Library Pass rows. Root fixture inserts were completed beforehand.
CREATE FUNCTION research_binding_review.b41_reject_library_pass_change()
RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,research_binding_review,pg_temp AS $$
BEGIN
  IF (TG_OP='INSERT' AND NEW.product_id='library-pass') OR
     (TG_OP='UPDATE' AND (OLD.product_id='library-pass' OR NEW.product_id='library-pass')) OR
     (TG_OP='DELETE' AND OLD.product_id='library-pass') THEN
    RAISE EXCEPTION 'Research B41 writer cannot mutate Library Pass rows' USING ERRCODE='42501';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER b41_no_library_pass_mutations
BEFORE INSERT OR UPDATE OR DELETE ON research_binding_review.entitlements
FOR EACH ROW EXECUTE FUNCTION research_binding_review.b41_reject_library_pass_change();

-- Internal only; all account/price/key data in test fixtures is synthetic.
CREATE FUNCTION research_binding_review.issue_reserved_checkout_v41(
  p_account uuid,p_price text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,research_binding_review,pg_temp AS $$
DECLARE v_key text; v_status text;
BEGIN
  IF p_account IS NULL OR p_price NOT IN ('review-monthly','review-annual') THEN
    RETURN jsonb_build_object('disposition','invalid_request');
  END IF;
  SELECT status INTO v_status FROM research_binding_review.profiles
   WHERE account_id=p_account FOR UPDATE;
  IF NOT FOUND OR v_status<>'active' THEN
    RETURN jsonb_build_object('disposition','account_unavailable');
  END IF;
  v_key:=gen_random_uuid()::text;
  INSERT INTO research_binding_review.checkout_reservations_v41(
    account_id,checkout_key_digest,provider_price_id,expires_at
  ) VALUES (p_account,encode(sha256(convert_to(v_key,'UTF8')),'hex'),p_price,
    clock_timestamp()+interval '30 minutes');
  RETURN jsonb_build_object('disposition','issued','checkout_key',v_key);
END $$;

-- Caller must have verified raw provider HMAC and product/store/mode before
-- invoking this function. DB cannot itself confirm that this happened.
CREATE FUNCTION research_binding_review.record_verified_paid_v41(
 p_account uuid,p_sub text,p_event text,p_key text,p_price text,
 p_raw_sha text,p_verifier text,p_provider_state text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,research_binding_review,pg_temp AS $$
DECLARE v_claim research_binding_review.provider_claims_v41%rowtype;
 v_event research_binding_review.verified_paid_events_v41%rowtype;
 v_digest text; v_disposition text := 'accepted';
BEGIN
  IF p_sub IS NULL OR char_length(p_sub) NOT BETWEEN 1 AND 255 OR
     p_event IS NULL OR char_length(p_event) NOT BETWEEN 1 AND 255 OR
     p_price IS NULL OR char_length(p_price) NOT BETWEEN 1 AND 128 OR
     p_raw_sha IS NULL OR p_raw_sha !~ '^[a-f0-9]{64}$' OR
     p_verifier IS DISTINCT FROM 'research-hmac-review-v1' OR
     p_provider_state NOT IN ('paid','refunded','cancelled') THEN
    RETURN jsonb_build_object('disposition','invalid_verification');
  END IF;
  v_digest:=CASE WHEN p_key IS NULL THEN NULL
    ELSE encode(sha256(convert_to(p_key,'UTF8')),'hex') END;
  IF p_account IS NULL OR p_key IS NULL THEN v_disposition:='unbound'; END IF;

  INSERT INTO research_binding_review.provider_claims_v41(
    provider_subscription_id,claimed_account_id,first_event_id
  ) VALUES (p_sub,p_account,p_event)
  ON CONFLICT(provider_subscription_id) DO NOTHING;
  SELECT * INTO v_claim FROM research_binding_review.provider_claims_v41
   WHERE provider_subscription_id=p_sub FOR UPDATE;
  IF v_claim.claimed_account_id IS DISTINCT FROM p_account THEN
    v_disposition:='identity_conflict';
  END IF;

  INSERT INTO research_binding_review.verified_paid_events_v41(
   provider_event_id,provider_subscription_id,claimed_account_id,
   claimed_checkout_digest,provider_price_id,verified_raw_body_sha256,
   verifier_version,provider_state,disposition
  ) VALUES(p_event,p_sub,p_account,v_digest,p_price,p_raw_sha,
    p_verifier,p_provider_state,v_disposition)
  ON CONFLICT(provider_event_id) DO NOTHING
  RETURNING * INTO v_event;

  IF NOT FOUND THEN
    SELECT * INTO v_event FROM research_binding_review.verified_paid_events_v41
      WHERE provider_event_id=p_event;
    IF v_event.provider_subscription_id=p_sub AND
       v_event.claimed_account_id IS NOT DISTINCT FROM p_account AND
       v_event.claimed_checkout_digest IS NOT DISTINCT FROM v_digest AND
       v_event.provider_price_id=p_price AND v_event.verified_raw_body_sha256=p_raw_sha
       AND v_event.provider_state=p_provider_state THEN
       RETURN jsonb_build_object('disposition','already_observed');
    END IF;
    INSERT INTO research_binding_review.conflicts_v41(
      provider_event_id,provider_subscription_id,claimed_account_id,code
    ) VALUES (p_event,p_sub,p_account,'event_identity_conflict');
    RETURN jsonb_build_object('disposition','event_identity_conflict');
  END IF;

  IF v_disposition='identity_conflict' THEN
    INSERT INTO research_binding_review.conflicts_v41(
      provider_event_id,provider_subscription_id,claimed_account_id,code
    ) VALUES (p_event,p_sub,p_account,'provider_identity_conflict');
  ELSIF v_disposition='unbound' THEN
    INSERT INTO research_binding_review.conflicts_v41(
      provider_event_id,provider_subscription_id,claimed_account_id,code
    ) VALUES (p_event,p_sub,p_account,'missing_custom_binding');
  END IF;
  RETURN jsonb_build_object('disposition',v_disposition);
END $$;

CREATE FUNCTION research_binding_review.bind_reserved_paid_v41(
  p_account uuid,p_sub text,p_event text,p_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,research_binding_review,pg_temp AS $$
DECLARE v_ev research_binding_review.verified_paid_events_v41%rowtype;
 v_res research_binding_review.checkout_reservations_v41%rowtype;
 v_profile text; v_sub research_binding_review.subscriptions%rowtype;
 v_digest text; v_code text;
BEGIN
  SELECT * INTO v_ev FROM research_binding_review.verified_paid_events_v41
  WHERE provider_event_id=p_event AND provider_subscription_id=p_sub
    AND claimed_account_id=p_account;
  IF NOT FOUND OR v_ev.disposition<>'accepted' OR p_key IS NULL THEN
    RETURN jsonb_build_object('disposition','unverified_or_unbound');
  END IF;
  IF v_ev.provider_state<>'paid' THEN
    RETURN jsonb_build_object('disposition','provider_not_paid');
  END IF;
  v_digest:=encode(sha256(convert_to(p_key,'UTF8')),'hex');
  SELECT * INTO v_res FROM research_binding_review.checkout_reservations_v41
    WHERE account_id=p_account AND checkout_key_digest=v_digest FOR UPDATE;

  IF NOT FOUND OR v_ev.claimed_checkout_digest IS DISTINCT FROM v_digest THEN
    v_code:='unissued_checkout_key';
  ELSIF v_res.provider_price_id<>v_ev.provider_price_id THEN
    v_code:='price_mismatch';
  ELSIF v_res.expires_at<=clock_timestamp() THEN
    v_code:='expired_checkout_key';
  ELSIF v_res.state='consumed' AND v_res.consumed_by_subscription<>p_sub THEN
    v_code:='checkout_consumed_by_other';
  END IF;
  IF v_code IS NOT NULL THEN
    INSERT INTO research_binding_review.conflicts_v41(
      provider_event_id,provider_subscription_id,claimed_account_id,code
    ) VALUES(p_event,p_sub,p_account,v_code);
    RETURN jsonb_build_object('disposition','conflict','code',v_code);
  END IF;

  SELECT status INTO v_profile FROM research_binding_review.profiles
    WHERE account_id=p_account FOR UPDATE;
  IF NOT FOUND OR v_profile<>'active' THEN
    v_code:='account_unavailable';
  ELSE
    SELECT * INTO v_sub FROM research_binding_review.subscriptions
      WHERE provider_subscription_id=p_sub FOR UPDATE;
    IF FOUND THEN
      IF v_sub.account_id=p_account AND v_res.state='consumed'
         AND v_res.consumed_by_subscription=p_sub THEN
        RETURN jsonb_build_object('disposition','already_bound');
      END IF;
      v_code:='provider_subscription_in_use';
    ELSE
      SELECT * INTO v_sub FROM research_binding_review.subscriptions
       WHERE account_id=p_account
       AND status IN ('pending','active','past_due','cancel_scheduled')
       LIMIT 1 FOR UPDATE;
      IF FOUND THEN v_code:='duplicate_paid_subscription'; END IF;
    END IF;
  END IF;

  IF v_code IS NOT NULL THEN
    INSERT INTO research_binding_review.conflicts_v41(
      provider_event_id,provider_subscription_id,claimed_account_id,code
    ) VALUES(p_event,p_sub,p_account,v_code);
    RETURN jsonb_build_object('disposition','conflict','code',v_code);
  END IF;

  INSERT INTO research_binding_review.subscriptions(
    account_id,provider_subscription_id,status
  ) VALUES(p_account,p_sub,'pending');
  UPDATE research_binding_review.checkout_reservations_v41 SET
    state='consumed',consumed_by_subscription=p_sub WHERE id=v_res.id;
  RETURN jsonb_build_object('disposition','created');
END $$;

CREATE FUNCTION research_binding_review.activate_pending_paid_v41(
  p_account uuid,p_sub text,p_event text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,research_binding_review,pg_temp AS $$
DECLARE v_event research_binding_review.verified_paid_events_v41%rowtype;
 v_sub research_binding_review.subscriptions%rowtype;
 v_ent research_binding_review.entitlements%rowtype;
 v_res research_binding_review.checkout_reservations_v41%rowtype;
 v_code text;
BEGIN
  SELECT * INTO v_event FROM research_binding_review.verified_paid_events_v41
   WHERE provider_event_id=p_event AND provider_subscription_id=p_sub
     AND claimed_account_id=p_account AND disposition='accepted';
  IF NOT FOUND OR v_event.provider_state<>'paid' THEN
    RETURN jsonb_build_object('disposition','unverified_or_unpaid');
  END IF;

  SELECT * INTO v_sub FROM research_binding_review.subscriptions
    WHERE provider_subscription_id=p_sub AND account_id=p_account FOR UPDATE;
  IF NOT FOUND THEN v_code:='subscription_unbound';
  ELSIF v_sub.status NOT IN ('pending','active') THEN v_code:='subscription_not_pending'; END IF;
  IF v_code IS NOT NULL THEN
    INSERT INTO research_binding_review.conflicts_v41(
     provider_event_id,provider_subscription_id,claimed_account_id,code
    ) VALUES (p_event,p_sub,p_account,v_code);
    RETURN jsonb_build_object('disposition','conflict','code',v_code);
  END IF;
  SELECT * INTO v_res FROM research_binding_review.checkout_reservations_v41
   WHERE account_id=p_account AND consumed_by_subscription=p_sub
      AND state='consumed' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('disposition','unverified_reservation');
  END IF;
  SELECT * INTO v_ent FROM research_binding_review.entitlements
   WHERE account_id=p_account AND product_id='research-membership' AND state='active'
   FOR UPDATE;
  IF v_sub.status='active' AND FOUND
      AND v_ent.provider_subscription_id=p_sub AND v_ent.source='paid' THEN
    RETURN jsonb_build_object('disposition','already_active');
  END IF;
  IF v_sub.status<>'pending' THEN
    RETURN jsonb_build_object('disposition','conflict','code','subscription_not_pending');
  END IF;
  IF FOUND THEN
    INSERT INTO research_binding_review.conflicts_v41(
     provider_event_id,provider_subscription_id,claimed_account_id,code
    ) VALUES (p_event,p_sub,p_account,'entitlement_conflict');
    RETURN jsonb_build_object('disposition','conflict','code','entitlement_conflict');
  END IF;
  UPDATE research_binding_review.subscriptions SET status='active',
    updated_at=clock_timestamp() WHERE id=v_sub.id AND status='pending';
  INSERT INTO research_binding_review.entitlements(
    account_id,product_id,source,provider_subscription_id,state
  ) VALUES (p_account,'research-membership','paid',p_sub,'active');
  RETURN jsonb_build_object('disposition','activated');
END $$;

-- Owner and permissions: API cannot mint paid evidence or issue reservations.
ALTER FUNCTION research_binding_review.issue_reserved_checkout_v41(uuid,text) OWNER TO review_binding_writer;
ALTER FUNCTION research_binding_review.record_verified_paid_v41(uuid,text,text,text,text,text,text,text) OWNER TO review_binding_writer;
ALTER FUNCTION research_binding_review.bind_reserved_paid_v41(uuid,text,text,text) OWNER TO review_binding_writer;
ALTER FUNCTION research_binding_review.activate_pending_paid_v41(uuid,text,text) OWNER TO review_binding_writer;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research_binding_review FROM PUBLIC;
REVOKE ALL ON FUNCTION research_binding_review.observe_signed_paid(uuid,text,text)
 FROM review_binding_api;
REVOKE ALL ON FUNCTION research_binding_review.try_bind_paid(uuid,text,text)
 FROM review_binding_api;
REVOKE ALL ON FUNCTION research_binding_review.try_activate_paid(uuid,text,text)
 FROM review_binding_api;
GRANT EXECUTE ON FUNCTION research_binding_review.issue_reserved_checkout_v41(uuid,text)
 TO review_b41_checkout_issuer;
GRANT EXECUTE ON FUNCTION research_binding_review.record_verified_paid_v41(uuid,text,text,text,text,text,text,text)
 TO review_b41_paid_verifier;
GRANT EXECUTE ON FUNCTION research_binding_review.bind_reserved_paid_v41(uuid,text,text,text)
 TO review_binding_api;
GRANT EXECUTE ON FUNCTION research_binding_review.activate_pending_paid_v41(uuid,text,text)
 TO review_binding_api;

COMMIT;
