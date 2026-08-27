begin;

create or replace function public.begin_commerce_webhook_receipt(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_payload_sha256 text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_receipt public.webhook_receipts%rowtype;
  v_should_process boolean := true;
begin
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9-]{1,63}$' then
    raise exception 'provider is invalid' using errcode = '22023';
  end if;
  if p_provider_event_id is null or char_length(p_provider_event_id) < 1 or char_length(p_provider_event_id) > 255 then
    raise exception 'provider_event_id is invalid' using errcode = '22023';
  end if;
  if p_event_type is null or char_length(p_event_type) < 1 or char_length(p_event_type) > 128 then
    raise exception 'event_type is invalid' using errcode = '22023';
  end if;
  if p_payload_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'payload_sha256 is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_provider_event_id, 0));

  select * into v_receipt
  from public.webhook_receipts
  where provider = p_provider
    and provider_event_id = p_provider_event_id
  for update;

  if found then
    -- A terminal receipt is already authoritative locally. Lemon Squeezy may
    -- regenerate delivery-only metadata (for example meta.webhook_id) when a
    -- signed webhook is manually resent, changing the exact raw-body hash.
    -- Return the semantic provider event as a duplicate before comparing the
    -- delivery hash. Non-terminal receipts retain strict hash matching below.
    if v_receipt.status in ('processed', 'ignored') then
      v_should_process := false;
    elsif v_receipt.payload_sha256 <> p_payload_sha256 then
      raise exception 'webhook replay payload hash mismatch' using errcode = '42501';
    else
      update public.webhook_receipts
      set status = 'received',
          event_type = p_event_type,
          attempt_count = attempt_count + 1,
          last_error = null
      where id = v_receipt.id
      returning * into v_receipt;
    end if;
  else
    insert into public.webhook_receipts (
      provider,
      provider_event_id,
      event_type,
      payload_sha256,
      status
    ) values (
      p_provider,
      p_provider_event_id,
      p_event_type,
      p_payload_sha256,
      'received'
    ) returning * into v_receipt;
  end if;

  return jsonb_build_object(
    'receipt_id', v_receipt.id,
    'status', v_receipt.status,
    'attempt_count', v_receipt.attempt_count,
    'should_process', v_should_process
  );
end;
$$;

revoke all on function public.begin_commerce_webhook_receipt(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.begin_commerce_webhook_receipt(text, text, text, text)
  to service_role;

commit;
