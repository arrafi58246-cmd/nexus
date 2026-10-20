begin;

-- Preserve the existing cancel signature and behavior while making the
-- authenticated actor, namespace resolution, errors, and ACL explicit.
create or replace function public.cancel_squad_application(
  p_application_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_is_admin boolean;
  v_internal_mode text;
  v_seed_application public.squad_applications%rowtype;
  v_application public.squad_applications%rowtype;
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

  select application.*
  into v_seed_application
  from public.squad_applications as application
  where application.application_id = p_application_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Application not found';
  end if;

  if v_seed_application.user_id <> v_user_id and v_is_admin is not true then
    raise exception using
      errcode = '42501',
      message = 'Only the applicant or admin may cancel this application';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nexus:squad-application:' || v_seed_application.user_id::text,
      0
    )
  );

  select application.*
  into v_application
  from public.squad_applications as application
  where application.application_id = p_application_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Application not found';
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

  if v_application.user_id <> v_user_id and v_is_admin is not true then
    raise exception using
      errcode = '42501',
      message = 'Only the applicant or admin may cancel this application';
  end if;

  if v_application.status_application <>
    'PENDING'::public.application_status_enum
  then
    raise exception using
      errcode = 'P0001',
      message = 'Only a PENDING application can be cancelled';
  end if;

  perform pg_catalog.set_config('nexus.internal', '1', true);

  update public.squad_applications
  set status_application = 'CANCELLED'::public.application_status_enum,
      decided_at = pg_catalog.now(),
      decided_by = case when v_is_admin then v_user_id else null end
  where application_id = p_application_id;

  perform pg_catalog.set_config(
    'nexus.internal',
    coalesce(v_internal_mode, ''),
    true
  );
end;
$function$;

-- Preserve the existing decision signature. ACCEPT locks all PENDING
-- applications for the applicant/Mission in UUID order before locking the
-- Squad. This makes cross-Squad decisions deterministic and prevents the
-- application-A/application-B auto-cancel deadlock in the previous body.
create or replace function public.decide_squad_application(
  p_application_id uuid,
  p_decision text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
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

-- profiles RLS is self/admin-only. This projection exposes only the display
-- fields a Ketua needs, and only for PENDING applications to Squads they own.
create or replace function public.get_leader_pending_squad_applications(
  p_mission_id uuid
)
returns table (
  application_id uuid,
  squad_id uuid,
  applicant_name text,
  primary_class_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  if public.is_active_user() is not true then
    raise exception using errcode = '42501', message = 'Account is not active';
  end if;

  if p_mission_id is null then
    raise exception using errcode = '22023', message = 'Mission is required';
  end if;

  return query
  select
    application.application_id,
    application.squad_id,
    profile.nama_lengkap::text,
    primary_class.nama_class::text,
    application.created_at
  from public.squad_applications as application
  join public.squads as squad
    on squad.squad_id = application.squad_id
    and squad.mission_id = application.mission_id
  join public.profiles as profile
    on profile.user_id = application.user_id
  left join public.primary_classes as primary_class
    on primary_class.primary_class_id = profile.primary_class_id
  where application.mission_id = p_mission_id
    and application.status_application =
      'PENDING'::public.application_status_enum
    and squad.ketua_id = auth.uid()
  order by application.created_at, application.application_id;
end;
$function$;

alter function public.cancel_squad_application(uuid) owner to postgres;
alter function public.decide_squad_application(uuid, text) owner to postgres;
alter function public.get_leader_pending_squad_applications(uuid)
  owner to postgres;

revoke insert, update on table public.squad_applications
  from public, anon, authenticated;

revoke all on function public.cancel_squad_application(uuid) from public;
revoke all on function public.cancel_squad_application(uuid) from anon;
grant execute on function public.cancel_squad_application(uuid)
  to authenticated;

revoke all on function public.decide_squad_application(uuid, text)
  from public;
revoke all on function public.decide_squad_application(uuid, text)
  from anon;
grant execute on function public.decide_squad_application(uuid, text)
  to authenticated;

revoke all on function public.get_leader_pending_squad_applications(uuid)
  from public;
revoke all on function public.get_leader_pending_squad_applications(uuid)
  from anon;
grant execute on function public.get_leader_pending_squad_applications(uuid)
  to authenticated;

commit;
