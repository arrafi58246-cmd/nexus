-- A membership interval is [joined_at, ended_at). Reuse the existing history;
-- do not copy memberships or infer the final team from today's ACTIVE status.
create view public.finalized_squad_members
with (security_invoker = true)
as
select sm.squad_id, sm.user_id, sm.status_member
from public.squad_members sm
join public.squads s on s.squad_id = sm.squad_id
where s.status_squad in ('FINALIZED', 'MISSION_COMPLETED')
  and s.finalized_at is not null
  and sm.joined_at <= s.finalized_at
  and (sm.ended_at is null or sm.ended_at > s.finalized_at);

revoke all on public.finalized_squad_members from public, anon, authenticated;
grant select on public.finalized_squad_members to authenticated;

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
    select 1 from public.finalized_squad_members sm
    where sm.squad_id = new.squad_id and sm.user_id = new.from_user_id
  ) or not exists (
    select 1 from public.finalized_squad_members sm
    where sm.squad_id = new.squad_id and sm.user_id = new.to_user_id
  ) then
    raise exception 'Both users must be members at Squad finalization';
  end if;

  v_now := clock_timestamp();
  if v_completed_at is null or v_now < v_completed_at
    or v_now >= v_completed_at + interval '336 hours' then
    raise exception 'Endorsement window is closed';
  end if;
  return new;
end;
$$;

-- Keep the anchor owned by finalize_squad (internal mode), just like completed_at.
CREATE OR REPLACE FUNCTION public.guard_squad_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if public.nexus_internal_mode() then
    return new;
  end if;

  if old.status_squad='DISBANDED' or new.status_squad='DISBANDED'
    or new.disbanded_at is distinct from old.disbanded_at
    or new.disbanded_by is distinct from old.disbanded_by then
    raise exception 'Disbanded state is managed only by the solo disband RPC';
  end if;

  if new.squad_id is distinct from old.squad_id
    or new.mission_id is distinct from old.mission_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Core Squad identity fields are immutable';
  end if;

  if new.status_squad = 'MISSION_COMPLETED' and old.status_squad <> 'MISSION_COMPLETED' then
    raise exception 'MISSION_COMPLETED may only be set by approved Mission Result processing';
  end if;

  if new.completed_at is distinct from old.completed_at then
    raise exception 'completed_at is managed by Mission Result approval';
  end if;

  if new.finalized_at is distinct from old.finalized_at then
    raise exception 'finalized_at is managed by Squad finalization';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if auth.uid() is null or old.ketua_id <> auth.uid() then
    raise exception 'Only the Squad leader or admin may update the Squad';
  end if;

  if new.ketua_id is distinct from old.ketua_id then
    raise exception 'Squad leadership cannot be reassigned through Edit Squad';
  end if;

  if new.status_squad is distinct from old.status_squad then
    raise exception 'Use the NEXUS Squad RPCs for status transitions';
  end if;

  if old.status_squad in ('FINALIZED', 'MISSION_COMPLETED')
     and (
       new.nama_squad is distinct from old.nama_squad
       or new.deskripsi_squad is distinct from old.deskripsi_squad
       or new.kapasitas_anggota is distinct from old.kapasitas_anggota
     ) then
    raise exception 'A Finalized or Completed Squad cannot be edited by the leader';
  end if;

  return new;
end;
$function$;
