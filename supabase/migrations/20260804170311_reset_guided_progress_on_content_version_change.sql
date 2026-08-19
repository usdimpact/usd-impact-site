begin;

-- Canonical chapter releases increment contentVersion. When the stored version
-- differs, reset progress and mastery to the new release instead of carrying
-- forward completion that was earned against older content.
create or replace function public.record_guided_learning_progress(
  p_account_id uuid,
  p_content_id text,
  p_progress_percent integer,
  p_resume_position text,
  p_content_version integer,
  p_mastery_score integer default null,
  p_attempt_increment integer default 0,
  p_mastery_passed boolean default false
)
returns public.learning_progress
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recorded public.learning_progress;
begin
  if p_account_id is null then
    raise exception 'Account identifier is required.' using errcode = '22023';
  end if;
  if p_content_id is null or p_content_id !~ '^guided-edition:[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid Guided Edition content identifier.' using errcode = '22023';
  end if;
  if p_progress_percent is null or p_progress_percent < 0 or p_progress_percent > 100 then
    raise exception 'Progress must be between 0 and 100.' using errcode = '22023';
  end if;
  if p_resume_position is null or p_resume_position !~ '^[a-z0-9][a-z0-9-]{0,79}$' then
    raise exception 'Invalid resume position.' using errcode = '22023';
  end if;
  if p_content_version is null or p_content_version < 1 then
    raise exception 'Content version must be positive.' using errcode = '22023';
  end if;
  if p_mastery_score is not null and (p_mastery_score < 0 or p_mastery_score > 100) then
    raise exception 'Mastery score must be between 0 and 100.' using errcode = '22023';
  end if;
  if p_attempt_increment is null or p_attempt_increment not in (0, 1) then
    raise exception 'Attempt increment must be zero or one.' using errcode = '22023';
  end if;
  if (p_mastery_score is null and p_attempt_increment <> 0)
     or (p_mastery_score is not null and p_attempt_increment <> 1) then
    raise exception 'A mastery score and attempt increment must be recorded together.' using errcode = '22023';
  end if;
  if p_mastery_passed is null then
    raise exception 'Mastery result is required.' using errcode = '22023';
  end if;
  if p_mastery_passed and (p_mastery_score is null or p_mastery_score < 80 or p_attempt_increment <> 1) then
    raise exception 'A passing mastery attempt requires a recorded passing score.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.entitlements e on e.account_id = p.account_id
    where p.account_id = p_account_id
      and p.status = 'active'
      and e.product_id = 'read-the-dollar-first-guided-interactive-edition'
      and e.state = 'active'
      and e.starts_at <= now()
      and (e.ends_at is null or e.ends_at > now())
  ) then
    raise exception 'An active Guided Edition entitlement is required.' using errcode = '42501';
  end if;

  insert into public.learning_progress as target (
    account_id,
    content_id,
    status,
    progress_percent,
    resume_position,
    mastery_score,
    attempt_count,
    completed_at,
    data,
    updated_at
  ) values (
    p_account_id,
    p_content_id,
    case
      when p_mastery_passed then 'completed'
      when p_progress_percent > 0 then 'in_progress'
      else 'started'
    end,
    case when p_mastery_passed then 100 else p_progress_percent end,
    p_resume_position,
    p_mastery_score,
    p_attempt_increment,
    case when p_mastery_passed then now() else null end,
    jsonb_build_object('contentVersion', p_content_version),
    now()
  )
  on conflict (account_id, content_id) do update
    set status = case
          when not coalesce(target.data @> excluded.data, false) then excluded.status
          when target.status = 'completed' or p_mastery_passed then 'completed'
          when greatest(target.progress_percent, excluded.progress_percent) > 0 then 'in_progress'
          else 'started'
        end,
        progress_percent = case
          when not coalesce(target.data @> excluded.data, false) then excluded.progress_percent
          else greatest(target.progress_percent, excluded.progress_percent)
        end,
        resume_position = excluded.resume_position,
        mastery_score = case
          when not coalesce(target.data @> excluded.data, false) then excluded.mastery_score
          when excluded.mastery_score is null then target.mastery_score
          else greatest(coalesce(target.mastery_score, 0), excluded.mastery_score)
        end,
        attempt_count = case
          when not coalesce(target.data @> excluded.data, false) then excluded.attempt_count
          else target.attempt_count + p_attempt_increment
        end,
        completed_at = case
          when not coalesce(target.data @> excluded.data, false) then excluded.completed_at
          when target.completed_at is not null then target.completed_at
          when p_mastery_passed then now()
          else null
        end,
        data = excluded.data,
        updated_at = now()
  returning * into recorded;

  return recorded;
end;
$$;

revoke all on function public.record_guided_learning_progress(
  uuid, text, integer, text, integer, integer, integer, boolean
) from public, anon, authenticated;
grant execute on function public.record_guided_learning_progress(
  uuid, text, integer, text, integer, integer, integer, boolean
) to service_role;

commit;
