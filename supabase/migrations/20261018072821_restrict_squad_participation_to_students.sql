-- Squad participation is reserved for ACTIVE STUDENT profiles.
-- Keep existing lock order, validation, state transitions, and history.

CREATE OR REPLACE FUNCTION public.guard_squad_application_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid;
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

  -- Keep direct privileged inserts on the same application-before-squad lock
  -- order used by decide/cancel and by submit_squad_application.
  perform 1
  from public.squad_applications as application
  where application.squad_id = new.squad_id
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
  where squad.squad_id = new.squad_id
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
    and profile.role_app = 'STUDENT'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Account is not active';
  end if;

  -- The profile row lock serializes per-user submissions.
  new.user_id := v_user_id;
  new.mission_id := v_mission_id;
  new.status_application := 'PENDING';
  new.decided_at := null;
  new.decided_by := null;

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
    where application.squad_id = new.squad_id
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

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.decide_squad_application(p_application_id uuid, p_decision text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid;
  v_is_admin boolean;
  v_internal_mode text;
  v_decision text;
  v_seed_application public.squad_applications%rowtype;
  v_application public.squad_applications%rowtype;
  v_seed_squad public.squads%rowtype;
  v_squad public.squads%rowtype;
  v_deadline timestamptz;
  v_active_count integer;
begin
  v_internal_mode := pg_catalog.current_setting('nexus.internal', true);
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  v_is_admin := public.is_admin();

  if public.is_active_user() is not true and v_is_admin is not true then
    raise exception using errcode = '42501', message = 'Account is not active';
  end if;

  if p_application_id is null then
    raise exception using errcode = '22023', message = 'Application is required';
  end if;

  v_decision := pg_catalog.upper(pg_catalog.btrim(p_decision));

  if v_decision is null or v_decision not in ('ACCEPTED', 'REJECTED') then
    raise exception using
      errcode = '22023',
      message = 'Decision must be ACCEPTED or REJECTED';
  end if;

  -- Read only enough identity to authorize before taking the wider ordered
  -- application locks. All authorization is checked again after row locks.
  select application.*
  into v_seed_application
  from public.squad_applications as application
  where application.application_id = p_application_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Application not found';
  end if;

  select squad.*
  into v_seed_squad
  from public.squads as squad
  where squad.squad_id = v_seed_application.squad_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Squad not found';
  end if;

  if v_seed_squad.ketua_id <> v_user_id and v_is_admin is not true then
    raise exception using
      errcode = '42501',
      message = 'Only the Squad leader or admin may decide this application';
  end if;

  -- cancel_squad_application takes the same transaction lock before any row
  -- lock, serializing cancel/decision for one applicant even if a new
  -- application is submitted while this decision is in flight.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nexus:squad-application:' || v_seed_application.user_id::text,
      0
    )
  );

  perform application.application_id
  from public.squad_applications as application
  where application.user_id = v_seed_application.user_id
    and application.mission_id = v_seed_application.mission_id
    and application.status_application =
      'PENDING'::public.application_status_enum
  order by application.application_id
  for update;

  select application.*
  into v_application
  from public.squad_applications as application
  where application.application_id = p_application_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Application not found';
  end if;

  select squad.*
  into v_squad
  from public.squads as squad
  where squad.squad_id = v_application.squad_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Squad not found';
  end if;

  select profile.role_app = 'ADMIN'
  into v_is_admin
  from public.profiles as profile
  where profile.user_id = v_user_id
    and profile.status_akun = 'ACTIVE'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Account is not active';
  end if;

  if v_squad.ketua_id <> v_user_id and v_is_admin is not true then
    raise exception using
      errcode = '42501',
      message = 'Only the Squad leader or admin may decide this application';
  end if;

  if v_application.status_application <>
    'PENDING'::public.application_status_enum
  then
    raise exception using
      errcode = 'P0001',
      message = 'Only PENDING applications can be decided';
  end if;

  if v_decision = 'REJECTED' then
    perform pg_catalog.set_config('nexus.internal', '1', true);

    update public.squad_applications
    set status_application = 'REJECTED'::public.application_status_enum,
        decided_at = pg_catalog.now(),
        decided_by = v_user_id
    where application_id = p_application_id;

    insert into public.notifications (
      user_id,
      notification_type,
      title,
      body
    ) values (
      v_application.user_id,
      'SQUAD_APPLICATION_REJECTED',
      'Pengajuan Squad ditolak',
      pg_catalog.format(
        'Pengajuanmu ke Squad "%s" ditolak.',
        v_squad.nama_squad
      )
    );

    perform pg_catalog.set_config(
      'nexus.internal',
      coalesce(v_internal_mode, ''),
      true
    );

    return;
  end if;

  if v_squad.status_squad <>
    'OPEN_RECRUITMENT'::public.squad_status_enum
  then
    raise exception using
      errcode = 'P0001',
      message = 'The Squad is no longer open for recruitment';
  end if;

  select mission.deadline_pendaftaran
  into v_deadline
  from public.missions as mission
  where mission.mission_id = v_application.mission_id
  for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'Mission not found';
  end if;

  if v_deadline <= pg_catalog.now() then
    raise exception using
      errcode = 'P0001',
      message = 'The Mission registration deadline has passed';
  end if;

  perform 1
  from public.profiles as profile
  where profile.user_id = v_application.user_id
    and profile.status_akun = 'ACTIVE'
    and profile.role_app = 'STUDENT'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Applicant account is not active';
  end if;

  if exists (
    select 1
    from public.squad_members as member
    where member.user_id = v_application.user_id
      and member.mission_id = v_application.mission_id
      and member.status_member = 'ACTIVE'::public.member_status_enum
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Applicant already has an active Squad for this Mission';
  end if;

  select pg_catalog.count(*)
  into v_active_count
  from public.squad_members as member
  where member.squad_id = v_squad.squad_id
    and member.status_member = 'ACTIVE'::public.member_status_enum;

  if v_active_count >= v_squad.kapasitas_anggota then
    raise exception using errcode = 'P0001', message = 'The Squad is already full';
  end if;

  perform pg_catalog.set_config('nexus.internal', '1', true);

  insert into public.squad_members (
    squad_id,
    mission_id,
    user_id,
    role_squad,
    status_member
  ) values (
    v_application.squad_id,
    v_application.mission_id,
    v_application.user_id,
    'ANGGOTA'::public.squad_role_enum,
    'ACTIVE'::public.member_status_enum
  );

  update public.squad_applications
  set status_application = 'ACCEPTED'::public.application_status_enum,
      decided_at = pg_catalog.now(),
      decided_by = v_user_id
  where application_id = p_application_id;

  update public.squad_applications
  set status_application = 'CANCELLED'::public.application_status_enum,
      decided_at = pg_catalog.now(),
      decided_by = v_user_id
  where user_id = v_application.user_id
    and mission_id = v_application.mission_id
    and application_id <> p_application_id
    and status_application = 'PENDING'::public.application_status_enum;

  select pg_catalog.count(*)
  into v_active_count
  from public.squad_members as member
  where member.squad_id = v_squad.squad_id
    and member.status_member = 'ACTIVE'::public.member_status_enum;

  if v_active_count >= v_squad.kapasitas_anggota then
    update public.squads
    set status_squad = 'FULL'::public.squad_status_enum
    where squad_id = v_squad.squad_id;
  end if;

  insert into public.notifications (
    user_id,
    notification_type,
    title,
    body
  ) values (
    v_application.user_id,
    'SQUAD_APPLICATION_ACCEPTED',
    'Pengajuan Squad diterima',
    pg_catalog.format(
      'Kamu diterima di Squad "%s".',
      v_squad.nama_squad
    )
  );

  perform pg_catalog.set_config(
    'nexus.internal',
    coalesce(v_internal_mode, ''),
    true
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_squad_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_deadline timestamptz;
  v_min_anggota_tim smallint;
  v_max_anggota_tim smallint;
begin
  if auth.uid() is not null and not public.is_admin() then
    new.ketua_id := auth.uid();
    new.status_squad := 'OPEN_RECRUITMENT';
    new.finalized_at := null;
    new.completed_at := null;
  end if;

  if not exists (
    select 1 from public.profiles as profile
    where profile.user_id = new.ketua_id
      and profile.role_app = 'STUDENT'
      and profile.status_akun = 'ACTIVE'
  ) then
    raise exception using errcode = '42501',
      message = 'Only active students may participate in Squads';
  end if;

  select
    mission.deadline_pendaftaran,
    mission.min_anggota_tim,
    mission.max_anggota_tim
  into
    v_deadline,
    v_min_anggota_tim,
    v_max_anggota_tim
  from public.missions as mission
  where mission.mission_id = new.mission_id
  for share;

  if not found then
    raise exception 'Mission not found';
  end if;

  if v_deadline <= pg_catalog.now() then
    raise exception
      'A new Squad cannot be created after the Mission registration deadline';
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

  if new.kapasitas_anggota < v_min_anggota_tim then
    raise exception using
      errcode = '22023',
      message = 'Squad capacity is below the Mission minimum';
  end if;

  if new.kapasitas_anggota > v_max_anggota_tim then
    raise exception using
      errcode = '22023',
      message = 'Squad capacity is above the Mission maximum';
  end if;

  if exists (
    select 1
    from public.squad_members as member
    where member.user_id = new.ketua_id
      and member.mission_id = new.mission_id
      and member.status_member = 'ACTIVE'
  ) then
    raise exception
      'A user may have only one active Squad membership per Mission';
  end if;

  return new;
end;
$function$;

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

  if not exists (
    select 1 from public.profiles as profile
    where profile.user_id = v_user_id
      and profile.role_app = 'STUDENT'
      and profile.status_akun = 'ACTIVE'
  ) then
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
    and profile.role_app = 'STUDENT'
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

-- Enforce the target member role for RPCs and direct privileged writes alike.
-- Leaving/kicking existing memberships is still possible after suspension.
create function public.guard_squad_member_student()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.user_id = old.user_id and
       (new.status_member <> 'ACTIVE' or old.status_member = 'ACTIVE') then
      return new;
    end if;
  end if;

  if not exists (
    select 1 from public.profiles as profile
    where profile.user_id = new.user_id
      and profile.role_app = 'STUDENT'
      and profile.status_akun = 'ACTIVE'
  ) then
    raise exception using errcode = '42501',
      message = 'Only active students may participate in Squads';
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_squad_member_student() from public, anon, authenticated;
create trigger squad_members_require_student
before insert or update of user_id, status_member on public.squad_members
for each row execute function public.guard_squad_member_student();
