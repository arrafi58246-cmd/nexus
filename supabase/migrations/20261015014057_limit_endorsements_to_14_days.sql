-- Existing ratings remain unchanged. Enforce the window on every new INSERT,
-- including direct Data API requests; approval owns squads.completed_at.
create or replace function public.guard_endorsement_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_completed_at timestamptz;
  v_now timestamptz;
begin
  if auth.uid() is not null and not public.is_admin() then
    new.from_user_id := auth.uid();
  end if;

  if new.from_user_id = new.to_user_id then
    raise exception 'Self-endorsement is not allowed';
  end if;

  select s.completed_at into v_completed_at
  from public.squads s
  where s.squad_id = new.squad_id and s.status_squad = 'MISSION_COMPLETED';
  if not found then
    raise exception 'Endorsements are allowed only after Mission Completed';
  end if;

  if not exists (
    select 1 from public.squad_members sm
    where sm.squad_id = new.squad_id and sm.user_id = new.from_user_id
  ) or not exists (
    select 1 from public.squad_members sm
    where sm.squad_id = new.squad_id and sm.user_id = new.to_user_id
  ) then
    raise exception 'Both users must have been members of the same completed Squad';
  end if;

  -- Use wall-clock time, so a long transaction cannot freeze eligibility at BEGIN.
  -- 336 hours is exactly 14 x 24 hours, independent of the session timezone.
  v_now := clock_timestamp();
  if v_completed_at is null or v_now < v_completed_at
    or v_now >= v_completed_at + interval '336 hours' then
    raise exception 'Endorsement window is closed';
  end if;
  return new;
end;
$$;
