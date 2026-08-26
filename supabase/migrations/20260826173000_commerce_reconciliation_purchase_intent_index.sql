begin;

create index if not exists commerce_reconciliations_purchase_intent_idx
  on public.commerce_reconciliations(purchase_intent_id);

commit;
