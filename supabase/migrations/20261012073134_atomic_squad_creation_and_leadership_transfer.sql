-- SQ-03 / SQ-04: owner decisions approved 12 October 2026.
-- Preserve existing RPC signatures and RLS; no data backfill.

CREATE OR REPLACE FUNCTION public.create_squad(p_mission_id uuid, p_nama_squad text, p_deskripsi_squad text, p_kapasitas_anggota smallint, p_requirements jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_previous_internal text;
  v_user_id uuid;
  v_squad_id uuid;
  v_requirement jsonb;
  v_numeric_value numeric;
  v_total_slots numeric;
  v_min_anggota_tim smallint;
  v_max_anggota_tim smallint;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Not authorized';
  end if;

  if public.is_active_user() is not true then
    raise exception using
      errcode = '42501',
      message = 'Not authorized';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.user_id = v_user_id
      and profile.primary_class_id is not null
  ) then
    raise exception using
      errcode = '42501',
      message = 'Onboarding must be completed before creating a Squad';
  end if;

  if p_mission_id is null then
    raise exception using
      errcode = '22023',
      message = 'Mission is required';
  end if;

  -- Same applicant lock as submit/decide/cancel, BEFORE any row lock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('nexus:squad-application:' || v_user_id::text, 0)
  );
  perform application.application_id
  from public.squad_applications as application
  where application.user_id = v_user_id
    and application.mission_id = p_mission_id
    and application.status_application = 'PENDING'
  order by application.application_id
  for update;

  select
    mission.min_anggota_tim,
    mission.max_anggota_tim
  into
    v_min_anggota_tim,
    v_max_anggota_tim
  from public.missions as mission
  where mission.mission_id = p_mission_id
  for share;

  if not found then
    raise exception 'Mission not found';
  end if;

  if v_min_anggota_tim is null or v_max_anggota_tim is null then
    raise exception using
      errcode = '22023',
      message = 'Mission team size limits are not configured';
  end if;

  if v_max_anggota_tim = 1 then
    raise exception using
      errcode = '22023',
      message = 'Individual Missions do not support Squads';
  end if;

  if p_kapasitas_anggota is null or p_kapasitas_anggota < 2 then
    raise exception using
      errcode = '22023',
      message = 'Squad capacity must be at least 2';
  end if;

  if p_kapasitas_anggota < v_min_anggota_tim then
    raise exception using
      errcode = '22023',
      message = 'Squad capacity is below the Mission minimum';
  end if;

  if p_kapasitas_anggota > v_max_anggota_tim then
    raise exception using
      errcode = '22023',
      message = 'Squad capacity is above the Mission maximum';
  end if;

  if p_nama_squad is null
    or p_nama_squad !~ '[^[:space:]]'
  then
    raise exception using
      errcode = '22023',
      message = 'Squad name must not be empty';
  end if;

  if p_deskripsi_squad is null
    or p_deskripsi_squad !~ '[^[:space:]]'
  then
    raise exception using
      errcode = '22023',
      message = 'Squad description must not be empty';
  end if;

  if p_requirements is null
    or pg_catalog.jsonb_typeof(p_requirements) <> 'array'
  then
    raise exception using
      errcode = '22023',
      message = 'Requirements must be a JSON array';
  end if;

  if pg_catalog.jsonb_array_length(p_requirements) = 0 then
    raise exception using
      errcode = '22023',
      message = 'At least one requirement is required';
  end if;

  for v_requirement in
    select requirement.value
    from pg_catalog.jsonb_array_elements(p_requirements)
      as requirement(value)
  loop
    if pg_catalog.jsonb_typeof(v_requirement) <> 'object' then
      raise exception using
        errcode = '22023',
        message = 'Each requirement must be a JSON object';
    end if;

    if not (v_requirement ? 'primary_class_id')
      or not (v_requirement ? 'slot_dibutuhkan')
      or (
        v_requirement
        - 'primary_class_id'
        - 'slot_dibutuhkan'
      ) <> '{}'::jsonb
    then
      raise exception using
        errcode = '22023',
        message = 'Each requirement must contain only primary_class_id and slot_dibutuhkan';
    end if;

    if pg_catalog.jsonb_typeof(
      v_requirement -> 'primary_class_id'
    ) <> 'number'
    then
      raise exception using
        errcode = '22023',
        message = 'Requirement primary_class_id must be an integer';
    end if;

    v_numeric_value :=
      (v_requirement ->> 'primary_class_id')::numeric;

    if v_numeric_value <> pg_catalog.trunc(v_numeric_value)
      or v_numeric_value < -9223372036854775808
      or v_numeric_value > 9223372036854775807
    then
      raise exception using
        errcode = '22023',
        message = 'Requirement primary_class_id must be a valid bigint integer';
    end if;

    if pg_catalog.jsonb_typeof(
      v_requirement -> 'slot_dibutuhkan'
    ) <> 'number'
    then
      raise exception using
        errcode = '22023',
        message = 'Requirement slot_dibutuhkan must be an integer';
    end if;

    v_numeric_value :=
      (v_requirement ->> 'slot_dibutuhkan')::numeric;

    if v_numeric_value <> pg_catalog.trunc(v_numeric_value)
      or v_numeric_value <= 0
      or v_numeric_value > 32767
    then
      raise exception using
        errcode = '22023',
        message = 'Requirement slot_dibutuhkan must be a positive smallint integer';
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_requirements)
      as requirement(value)
    group by (
      ((requirement.value ->> 'primary_class_id')::numeric)::bigint
    )
    having pg_catalog.count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'Requirement primary_class_id values must be unique';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_requirements)
      as requirement(value)
    where not exists (
      select 1
      from public.primary_classes as primary_class
      where primary_class.primary_class_id =
        ((requirement.value ->> 'primary_class_id')::numeric)::bigint
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'Every requirement must reference a valid Primary Class';
  end if;

  select coalesce(
    pg_catalog.sum(
      (requirement.value ->> 'slot_dibutuhkan')::numeric
    ),
    0::numeric
  )
  into v_total_slots
  from pg_catalog.jsonb_array_elements(p_requirements)
    as requirement(value);

  if v_total_slots <>
    (p_kapasitas_anggota::numeric - 1::numeric)
  then
    raise exception using
      errcode = '22023',
      message = 'Total requirement slots must equal Squad capacity minus one';
  end if;

  insert into public.squads (
    mission_id,
    ketua_id,
    nama_squad,
    deskripsi_squad,
    kapasitas_anggota,
    status_squad,
    finalized_at,
    completed_at
  )
  values (
    p_mission_id,
    v_user_id,
    p_nama_squad,
    p_deskripsi_squad,
    p_kapasitas_anggota,
    'OPEN_RECRUITMENT'::public.squad_status_enum,
    null,
    null
  )
  returning squad_id into v_squad_id;

  insert into public.squad_requirements (
    squad_id,
    primary_class_id,
    slot_dibutuhkan
  )
  select
    v_squad_id,
    ((requirement.value ->> 'primary_class_id')::numeric)::bigint,
    ((requirement.value ->> 'slot_dibutuhkan')::numeric)::smallint
  from pg_catalog.jsonb_array_elements(p_requirements)
    as requirement(value);

  -- Cancel only after both the Squad and requirements are valid. An error in
  -- this update rolls back the entire RPC, including the leader membership.
  v_previous_internal := pg_catalog.current_setting('nexus.internal', true);
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.squad_applications
  set status_application = 'CANCELLED',
      decided_at = pg_catalog.now(),
      decided_by = null
  where user_id = v_user_id
    and mission_id = p_mission_id
    and status_application = 'PENDING';
  perform pg_catalog.set_config('nexus.internal', coalesce(v_previous_internal, ''), true);

  return v_squad_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_squad_application(p_squad_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid;
  v_application_id uuid;
  v_mission_id uuid;
  v_ketua_id uuid;
  v_status public.squad_status_enum;
  v_deadline timestamptz;
  v_primary_class_id bigint;
  v_pending_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  if p_squad_id is null then
    raise exception using errcode = '22023', message = 'Squad is required';
  end if;

  -- Serialize create/submit/decide/cancel for the same applicant.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('nexus:squad-application:' || v_user_id::text, 0)
  );

  -- Match decide/cancel's application-first order when a duplicate PENDING
  -- row already exists, avoiding a duplicate-application/squad lock cycle.
  perform 1
  from public.squad_applications as application
  where application.squad_id = p_squad_id
    and application.user_id = v_user_id
    and application.status_application =
      'PENDING'::public.application_status_enum
  for update;

  select
    squad.mission_id,
    squad.ketua_id,
    squad.status_squad
  into
    v_mission_id,
    v_ketua_id,
    v_status
  from public.squads as squad
  where squad.squad_id = p_squad_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Squad not found';
  end if;

  select mission.deadline_pendaftaran
  into v_deadline
  from public.missions as mission
  where mission.mission_id = v_mission_id
  for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'Mission not found';
  end if;

  select profile.primary_class_id
  into v_primary_class_id
  from public.profiles as profile
  where profile.user_id = v_user_id
    and profile.status_akun = 'ACTIVE'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Account is not active';
  end if;

  if v_primary_class_id is null then
    raise exception using
      errcode = '42501',
      message = 'Onboarding must be completed before applying to a Squad';
  end if;

  if v_ketua_id = v_user_id then
    raise exception using
      errcode = 'P0001',
      message = 'You cannot apply to your own Squad';
  end if;

  if v_status <> 'OPEN_RECRUITMENT'::public.squad_status_enum then
    raise exception using
      errcode = 'P0001',
      message = 'This Squad is not accepting applications';
  end if;

  if v_deadline <= pg_catalog.now() then
    raise exception using
      errcode = 'P0001',
      message = 'The Mission registration deadline has passed';
  end if;

  if exists (
    select 1
    from public.squad_members as member
    where member.user_id = v_user_id
      and member.mission_id = v_mission_id
      and member.status_member = 'ACTIVE'::public.member_status_enum
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'You already have an active Squad for this Mission';
  end if;

  if exists (
    select 1
    from public.squad_applications as application
    where application.squad_id = p_squad_id
      and application.user_id = v_user_id
      and application.status_application =
        'PENDING'::public.application_status_enum
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'You already have a pending application for this Squad';
  end if;

  select pg_catalog.count(*)
  into v_pending_count
  from public.squad_applications as application
  where application.user_id = v_user_id
    and application.mission_id = v_mission_id
    and application.status_application =
      'PENDING'::public.application_status_enum;

  if v_pending_count >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'A user may have at most 3 pending Squad applications per Mission';
  end if;

  insert into public.squad_applications (
    squad_id,
    mission_id,
    user_id,
    status_application,
    decided_at,
    decided_by
  ) values (
    p_squad_id,
    v_mission_id,
    v_user_id,
    'PENDING'::public.application_status_enum,
    null,
    null
  )
  returning application_id into v_application_id;

  return v_application_id;
end;
$function$;

create or replace function public.transfer_squad_leadership(
  p_squad_id uuid,
  p_new_leader_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_squad public.squads%rowtype;
  v_previous_internal text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;
  if p_squad_id is null or p_new_leader_id is null or p_new_leader_id = v_actor then
    raise exception using errcode = '22023', message = 'A different active member is required';
  end if;

  -- All roster mutations take the parent lock before member locks.
  select * into v_squad from public.squads where squad_id = p_squad_id for update;
  if not found or v_squad.ketua_id <> v_actor then
    raise exception using errcode = '42501', message = 'Only the current Squad leader can transfer leadership';
  end if;
  if v_squad.status_squad not in ('OPEN_RECRUITMENT', 'FULL') then
    raise exception using errcode = '22023', message = 'Leadership cannot change after finalization';
  end if;

  -- Stabilize account status while changing roles; deterministic order for
  -- users who share multiple Squads across Missions.
  perform p.user_id from public.profiles p
  where p.user_id in (v_actor, p_new_leader_id)
  order by p.user_id for share;
  if not exists (select 1 from public.profiles where user_id = v_actor
    and status_akun = 'ACTIVE' and role_app = 'STUDENT') then
    raise exception using errcode = '42501', message = 'An active Student leader is required';
  end if;
  if not exists (select 1 from public.profiles where user_id = p_new_leader_id
    and status_akun = 'ACTIVE' and role_app = 'STUDENT') then
    raise exception using errcode = '22023', message = 'The successor must be an active Student member';
  end if;

  perform m.squad_member_id from public.squad_members m
  where m.squad_id = p_squad_id and m.user_id in (v_actor, p_new_leader_id)
    and m.status_member = 'ACTIVE'
  order by m.user_id for update;
  if not exists (select 1 from public.squad_members where squad_id = p_squad_id
    and user_id = v_actor and status_member = 'ACTIVE' and role_squad = 'KETUA') then
    raise exception using errcode = '42501', message = 'Only the current Squad leader can transfer leadership';
  end if;
  if not exists (select 1 from public.squad_members where squad_id = p_squad_id
    and user_id = p_new_leader_id and status_member = 'ACTIVE' and role_squad = 'ANGGOTA') then
    raise exception using errcode = '22023', message = 'The successor must be an active Student member';
  end if;

  v_previous_internal := pg_catalog.current_setting('nexus.internal', true);
  perform pg_catalog.set_config('nexus.internal', '1', true);
  -- Demote first to satisfy the partial unique index for one active leader.
  update public.squad_members set role_squad = 'ANGGOTA'
  where squad_id = p_squad_id and user_id = v_actor and status_member = 'ACTIVE';
  update public.squad_members set role_squad = 'KETUA'
  where squad_id = p_squad_id and user_id = p_new_leader_id and status_member = 'ACTIVE';
  update public.squads set ketua_id = p_new_leader_id where squad_id = p_squad_id;
  perform pg_catalog.set_config('nexus.internal', coalesce(v_previous_internal, ''), true);
end;
$$;

revoke execute on function public.transfer_squad_leadership(uuid, uuid) from public, anon;
grant execute on function public.transfer_squad_leadership(uuid, uuid) to authenticated;

create or replace function public.leave_squad(p_squad_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_member public.squad_members%rowtype;
  v_squad public.squads%rowtype;
  v_previous_internal text;
begin
  if auth.uid() is null or (not public.is_active_user() and not public.is_admin()) then
    raise exception 'Account is not active';
  end if;

  -- Same Squad -> member order as transfer/kick/finalize; prevents the
  -- previous member -> Squad lock inversion during a concurrent transfer.
  select * into v_squad from public.squads where squad_id = p_squad_id for update;
  if not found then raise exception 'Squad not found'; end if;

  select * into v_member from public.squad_members
  where squad_id = p_squad_id and user_id = auth.uid() and status_member = 'ACTIVE'
  for update;
  if not found then raise exception 'You are not an active member of this Squad'; end if;
  if v_member.role_squad = 'KETUA' then
    raise exception 'Transfer leadership to another active member before leaving';
  end if;
  if v_squad.status_squad in ('FINALIZED', 'MISSION_COMPLETED') then
    raise exception 'Members cannot leave after the Squad is Finalized';
  end if;

  v_previous_internal := pg_catalog.current_setting('nexus.internal', true);
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.squad_members set status_member = 'LEFT', ended_at = pg_catalog.now()
  where squad_member_id = v_member.squad_member_id;
  if v_squad.status_squad = 'FULL' then
    update public.squads set status_squad = 'OPEN_RECRUITMENT' where squad_id = p_squad_id;
  end if;
  perform pg_catalog.set_config('nexus.internal', coalesce(v_previous_internal, ''), true);
end;
$$;
