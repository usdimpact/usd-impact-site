begin;

do $$
declare
  current_offer record;
begin
  select
    currency,
    launch_price_cents,
    standard_price_cents,
    purchase_limit
  into current_offer
  from public.product_offers
  where product_id = 'read-the-dollar-first-guided-interactive-edition'
  for update;

  if not found then
    raise exception 'Guided Interactive Edition offer is missing';
  end if;

  if current_offer.currency <> 'USD'
    or current_offer.launch_price_cents <> 3900
    or current_offer.standard_price_cents <> 4900
    or current_offer.purchase_limit <> 100 then
    raise exception 'Guided Interactive Edition offer terms do not match the approved launch contract';
  end if;

  update public.product_offers
  set
    launch_starts_at = '2026-08-17T13:00:00Z'::timestamptz,
    launch_ends_at = '2026-09-16T13:00:00Z'::timestamptz,
    updated_at = now()
  where product_id = 'read-the-dollar-first-guided-interactive-edition';
end;
$$;

commit;
