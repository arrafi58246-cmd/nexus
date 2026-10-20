begin;

create or replace function public.guard_squad_application_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
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

create or replace function public.submit_squad_application(p_squad_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
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

alter function public.submit_squad_application(uuid) owner to postgres;

revoke insert on table public.squad_applications
  from public, anon, authenticated;

revoke all on function public.submit_squad_application(uuid) from public;
revoke all on function public.submit_squad_application(uuid) from anon;
grant execute on function public.submit_squad_application(uuid)
  to authenticated;

commit;
