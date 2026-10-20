alter table public.squads
  add column disbanded_at timestamptz,
  add column disbanded_by uuid references public.profiles(user_id) on delete restrict;
alter table public.squads drop constraint squads_status_timestamps_check;
alter table public.squads add constraint squads_status_timestamps_check check (
  (status_squad in ('OPEN_RECRUITMENT','FULL') and completed_at is null)
  or (status_squad='FINALIZED' and finalized_at is not null and completed_at is null)
  or (status_squad='MISSION_COMPLETED' and finalized_at is not null and completed_at is not null)
  or (status_squad='DISBANDED' and finalized_at is null and completed_at is null));
alter table public.squads add constraint squads_disband_state_check check (
  (status_squad='DISBANDED' and disbanded_at is not null and disbanded_by is not null and disbanded_by=ketua_id)
  or (status_squad<>'DISBANDED' and disbanded_at is null and disbanded_by is null));

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
$function$
;
CREATE OR REPLACE FUNCTION nexus_private.touch_squad_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_squad uuid;
  v_mode text;
  v_status public.squad_status_enum;
begin
  if tg_op = 'UPDATE' and new is not distinct from old then return new; end if;
  if tg_op = 'UPDATE' and new.squad_id is distinct from old.squad_id then
    raise exception 'Squad activity source cannot be moved between Squads';
  end if;
  if tg_op = 'DELETE' then v_squad := old.squad_id; else v_squad := new.squad_id; end if;
  -- BEFORE insert obtains the same row lock as cleanup, before the source is visible.
  -- NO KEY UPDATE is compatible with FK key-share locks from unrelated child reads.
  select status_squad into v_status from public.squads where squad_id=v_squad for no key update;
  if tg_table_name='squad_messages' and tg_op='INSERT' and v_status='DISBANDED' then
    raise exception using errcode='42501',message='Disbanded Squad chat is closed';
  end if;
  v_mode := current_setting('nexus.internal',true);
  perform set_config('nexus.internal','1',true);
  update public.squads set last_activity_at=greatest(last_activity_at,clock_timestamp())
    where squad_id=v_squad;
  perform set_config('nexus.internal',coalesce(v_mode,''),true);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_squad_room_members(p_squad_id uuid)
 RETURNS TABLE(member_user_id uuid, nama_lengkap text, nama_class text, role_squad text, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null
     or public.is_active_user() is not true
     or public.is_admin() is true
     or not exists (
       select 1
       from public.squad_members sm
       join public.squads s on s.squad_id = sm.squad_id
       where sm.squad_id = p_squad_id
         and sm.user_id = auth.uid()
         and sm.status_member = 'ACTIVE'
         and s.status_squad not in ('MISSION_COMPLETED','DISBANDED')
     ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select
    sm.user_id,
    p.nama_lengkap::text,
    pc.nama_class::text,
    sm.role_squad::text,
    sm.joined_at
  from public.squad_members sm
  join public.profiles p on p.user_id = sm.user_id
  left join public.primary_classes pc
    on pc.primary_class_id = p.primary_class_id
  where sm.squad_id = p_squad_id
    and sm.status_member = 'ACTIVE'
  order by (sm.role_squad = 'KETUA') desc, sm.joined_at, sm.user_id;
end;
$function$
;

create or replace function nexus_private.guard_disbanded_membership()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_status public.squad_status_enum;
begin
  if new.status_member='ACTIVE' then
    select status_squad into v_status from public.squads where squad_id=new.squad_id for no key update;
    if v_status='DISBANDED' then
      raise exception using errcode='22023',message='Disbanded Squad cannot receive active members';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function nexus_private.guard_disbanded_membership() from public,anon,authenticated;
create trigger squad_members_guard_disbanded before insert or update on public.squad_members
for each row execute function nexus_private.guard_disbanded_membership();

alter policy squad_messages_read_active_member on public.squad_messages using (
  not public.is_admin() and public.is_active_user() and exists (
    select 1 from public.squad_members sm join public.squads s on s.squad_id=sm.squad_id
    where sm.squad_id=squad_messages.squad_id and sm.user_id=auth.uid()
      and sm.status_member='ACTIVE' and s.status_squad not in ('MISSION_COMPLETED','DISBANDED')));
alter policy squad_messages_insert_active_member on public.squad_messages with check (
  not public.is_admin() and public.is_active_user() and sender_id=auth.uid() and exists (
    select 1 from public.squad_members sm join public.squads s on s.squad_id=sm.squad_id
    where sm.squad_id=squad_messages.squad_id and sm.user_id=auth.uid()
      and sm.status_member='ACTIVE' and s.status_squad not in ('MISSION_COMPLETED','DISBANDED')));
