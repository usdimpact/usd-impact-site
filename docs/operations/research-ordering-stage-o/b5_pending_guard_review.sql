-- Stage O: D2-24 N-X0 isolated compatibility overlay, not a deployable migration.
-- Stage E rejects ALL Research writes except research_e_owner. The pinned
-- B5 binder is a separate NOLOGIN SECURITY DEFINER (review_checkout_owner)
-- and legitimately inserts only a pending Research subscription.
-- Permit that EXACT INSERT, reconstruct binding metadata from the B5 signed
-- observation and independently issued attached checkout intent, and deny
-- every other B5 owner mutation and shared service_role/postgres shortcut.
BEGIN;
CREATE OR REPLACE FUNCTION research_ordering_stage_e.reject_unauthorized_research_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $O$
DECLARE
  v_old_research boolean := false;
  v_new_research boolean := false;
  v_paid research_checkout_guard.signed_paid_observations%rowtype;
  v_intent research_checkout_guard.checkout_intents%rowtype;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_research := coalesce((to_jsonb(OLD)->>'product_id')='research-membership',false);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new_research := coalesce((to_jsonb(NEW)->>'product_id')='research-membership',false);
  END IF;

  IF (v_old_research OR v_new_research) AND current_user <> 'research_e_owner' THEN
    -- Do NOT grant the binder a generic Research product bypass.
    IF current_user='review_checkout_owner'
       AND TG_TABLE_SCHEMA='public'
       AND TG_TABLE_NAME='subscriptions'
       AND TG_OP='INSERT'
       AND NOT v_old_research AND v_new_research
       AND to_jsonb(NEW)->>'provider'='lemon-squeezy'
       AND to_jsonb(NEW)->>'state'='pending'
       AND (to_jsonb(NEW)->>'current_period_start') IS NULL
       AND (to_jsonb(NEW)->>'current_period_end') IS NULL
       AND (to_jsonb(NEW)->>'last_provider_event_id') IS NULL
       AND COALESCE(NEW.metadata,'{}'::jsonb)='{}'::jsonb
    THEN
      -- The observed signed-fact/source identity MUST be recorded by the
      -- separately scoped B5 verifier. Same parent subscription, account,
      -- product, variant and environment as an issued attached intent.
      SELECT * INTO v_paid
      FROM research_checkout_guard.signed_paid_observations p
      WHERE p.provider='lemon-squeezy'
        AND p.provider_subscription_id=NEW.provider_subscription_id
        AND p.provider_customer_id=NEW.provider_customer_id
        AND p.provider_price_id=NEW.provider_price_id
        AND p.product_id='research-membership'
        AND p.claimed_account_id=NEW.account_id
        AND p.catalog_quarantined=false;
      IF NOT FOUND OR
         v_paid.business_fingerprint_version<>'research-receipt-business-v3'
      THEN
        RAISE EXCEPTION 'Stage O: B5 signed pending source is not verified'
          USING ERRCODE='42501';
      END IF;

      SELECT * INTO v_intent FROM research_checkout_guard.checkout_intents i
      WHERE i.account_id=NEW.account_id
        AND i.product_id='research-membership'
        AND i.store_id=v_paid.store_id
        AND i.variant_id=NEW.provider_price_id
        AND i.test_mode=v_paid.test_mode
        AND i.state='attached'
        AND i.provider_checkout_id IS NOT NULL
        AND i.checkout_proof_sha256=v_paid.claimed_checkout_proof_sha256;
      IF NOT FOUND
         OR v_paid.occurred_at < v_intent.created_at-interval '5 minutes'
         OR v_paid.occurred_at > v_intent.expires_at+interval '2 minutes'
      THEN
        RAISE EXCEPTION 'Stage O: B5 issued attached intent/source mismatch'
          USING ERRCODE='42501';
      END IF;
      IF EXISTS(SELECT 1 FROM research_checkout_guard.conflict_evidence e
                WHERE e.paid_observation_id=v_paid.id) THEN
        RAISE EXCEPTION 'Stage O: B5 signed custody conflict'
          USING ERRCODE='42501';
      END IF;

      -- Strictly synthetic Stage L metadata bridge: all values are obtained
      -- from B5 persisted rows, not from a caller or a hand-edited subscription.
      NEW.metadata := pg_catalog.jsonb_build_object(
        'review_store_id',v_paid.store_id,
        'review_variant_id',v_paid.provider_price_id,
        'review_binding_fingerprint',v_paid.business_fingerprint_sha256);
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Stage O: Research writes require isolated lifecycle owner'
      USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$O$;
-- New SQL function body retains original SECURITY INVOKER and empty search_path.
-- All Stage E triggers are left installed. No privilege broadening, no new
-- roles and no unsafe bypass of DELETE/TRUNCATE/TRIGGER/replica policies.
COMMIT;
