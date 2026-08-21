do $patch$
declare
  fn_oid oid;
  ddl text;
  old_fragment text := $old$update public.support_requests
  set account_id = null,
      email = null,
      updated_at = finalized_at
  where support_requests.account_id = profile_row.account_id;$old$;
  new_fragment text := $new$update public.support_requests
  set account_id = null,
      email = format(
        'deleted+%s@support.invalid',
        substr(encode(extensions.digest(profile_row.account_id::text, 'sha256'), 'hex'), 1, 32)
      ),
      updated_at = finalized_at
  where support_requests.account_id = profile_row.account_id;$new$;
begin
  select p.oid
  into fn_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'finalize_account_deletion'
    and pg_get_function_identity_arguments(p.oid) = 'finalize_account_id uuid';

  if fn_oid is null then
    raise exception 'finalize_account_deletion(uuid) not found';
  end if;

  ddl := pg_get_functiondef(fn_oid);
  if position(new_fragment in ddl) > 0 then
    null;
  elsif position(old_fragment in ddl) > 0 then
    execute replace(ddl, old_fragment, new_fragment);
  else
    raise exception 'expected support identity fragment not found';
  end if;
end
$patch$;

revoke all on function public.finalize_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.finalize_account_deletion(uuid) to service_role;
