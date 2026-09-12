do $$
begin
  if exists (select 1 from pg_roles where rolname in ('fx558_reader_login','fx558_controller_login','fx558_recorder_login','fx558_revoker_login')) then
    raise exception 'HOLD_RUNTIME_ROLE_ALREADY_PRESENT';
  end if;
  if to_regnamespace('publication_guard') is null or to_regnamespace('publication_guard_api') is null then
    raise exception 'HOLD_GUARD_SCHEMA_MISSING';
  end if;
  if has_database_privilege('public', current_database(), 'TEMP')
     or has_schema_privilege('public','public','USAGE') then
    raise exception 'HOLD_ISOLATION_BASELINE_MISSING';
  end if;
end $$;

create role fx558_reader_login login password null inherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication connection limit 4;
create role fx558_controller_login login password null inherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication connection limit 4;
create role fx558_recorder_login login password null inherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication connection limit 4;
create role fx558_revoker_login login password null inherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication connection limit 4;

grant fx558_reader to fx558_reader_login with admin false, inherit true, set false;
grant fx558_controller to fx558_controller_login with admin false, inherit true, set false;
grant fx558_recorder to fx558_recorder_login with admin false, inherit true, set false;
grant fx558_revoker to fx558_revoker_login with admin false, inherit true, set false;

alter role fx558_reader_login set search_path = '';
alter role fx558_controller_login set search_path = '';
alter role fx558_recorder_login set search_path = '';
alter role fx558_revoker_login set search_path = '';
alter role fx558_reader_login set statement_timeout = '5s';
alter role fx558_controller_login set statement_timeout = '5s';
alter role fx558_recorder_login set statement_timeout = '5s';
alter role fx558_revoker_login set statement_timeout = '5s';
alter role fx558_reader_login set lock_timeout = '3s';
alter role fx558_controller_login set lock_timeout = '3s';
alter role fx558_recorder_login set lock_timeout = '3s';
alter role fx558_revoker_login set lock_timeout = '3s';
alter role fx558_reader_login set idle_in_transaction_session_timeout = '5s';
alter role fx558_controller_login set idle_in_transaction_session_timeout = '5s';
alter role fx558_recorder_login set idle_in_transaction_session_timeout = '5s';
alter role fx558_revoker_login set idle_in_transaction_session_timeout = '5s';

do $$
declare r record;
begin
  for r in select * from pg_roles where rolname in ('fx558_reader_login','fx558_controller_login','fx558_recorder_login','fx558_revoker_login') loop
    if not r.rolcanlogin or not r.rolinherit or r.rolsuper or r.rolbypassrls or r.rolcreatedb or r.rolcreaterole or r.rolreplication or r.rolconnlimit <> 4 then
      raise exception 'HOLD_RUNTIME_ROLE_PRIVILEGE:%', r.rolname;
    end if;
  end loop;
  if exists (
    select 1 from pg_auth_members m
    join pg_roles member on member.oid=m.member
    where member.rolname in ('fx558_reader_login','fx558_controller_login','fx558_recorder_login','fx558_revoker_login')
      and (m.admin_option or not m.inherit_option or m.set_option)
  ) then raise exception 'HOLD_RUNTIME_ROLE_MEMBERSHIP_OPTIONS'; end if;
  if (select count(*) from pg_auth_members m join pg_roles member on member.oid=m.member where member.rolname in ('fx558_reader_login','fx558_controller_login','fx558_recorder_login','fx558_revoker_login')) <> 4 then
    raise exception 'HOLD_RUNTIME_ROLE_MEMBERSHIP_COUNT';
  end if;
end $$;