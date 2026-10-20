-- Join Squad Tahap A runtime regression test.
--
-- Replace BOTH placeholder UUIDs with dedicated test accounts. This script
-- refuses to run unless both accounts exist, are ACTIVE, and have completed
-- onboarding. It never discovers or prints a real user automatically.
-- Every data change is enclosed in one transaction and rolled back.
begin;

do $test$
declare
  v_applicant_id constant uuid :=
    '11111111-1111-1111-1111-111111111111'::uuid;
  v_leader_id constant uuid :=
    '22222222-2222-2222-2222-222222222222'::uuid;
  v_fixture_mission_id constant uuid :=
    'a1100000-0000-4000-8000-000000000001'::uuid;
  v_source_mission_id constant uuid :=
    'b0cf942a-aee0-4533-99c8-b7539d7132f8'::uuid;
  v_applicant_class_id bigint;
  v_leader_class_id bigint;
  v_squad_ids uuid[] := array[]::uuid[];
  v_squad_id uuid;
  v_application_id uuid;
  v_error_message text;
  v_source public.missions%rowtype;
  v_index integer;
begin
  if v_applicant_id =
      '11111111-1111-1111-1111-111111111111'::uuid
    or v_leader_id =
      '22222222-2222-2222-2222-222222222222'::uuid
  then
    raise exception
      'Replace both dedicated Join Squad test account UUID placeholders';
  end if;

  if v_applicant_id = v_leader_id then
    raise exception 'Applicant and leader test accounts must be different';
  end if;

  select profile.primary_class_id
  into v_applicant_class_id
  from public.profiles as profile
  where profile.user_id = v_applicant_id
    and profile.status_akun = 'ACTIVE'
    and profile.primary_class_id is not null;

  if v_applicant_class_id is null then
    raise exception
      'Dedicated applicant is missing, inactive, or has not completed onboarding';
  end if;

  select profile.primary_class_id
  into v_leader_class_id
  from public.profiles as profile
  where profile.user_id = v_leader_id
    and profile.status_akun = 'ACTIVE'
    and profile.primary_class_id is not null;

  if v_leader_class_id is null then
    raise exception
      'Dedicated leader is missing, inactive, or has not completed onboarding';
  end if;

  if exists (
    select 1
    from public.missions
    where mission_id = v_fixture_mission_id
  ) then
    raise exception 'Disposable Join Squad Mission UUID is already in use';
  end if;

  select * into strict v_source
  from public.missions
  where mission_id = v_source_mission_id;

  insert into public.missions (
    mission_id,
    source_submission_id,
    tier_id,
    nama_lomba,
    penyelenggara,
    kategori_penyelenggara,
    link_resmi,
    deadline_pendaftaran,
    deadline_lomba,
    tahun_lomba,
    kategori_lomba,
    cakupan_peserta,
    mode_lomba,
    min_anggota_tim,
    max_anggota_tim,
    biaya_pendaftaran,
    deskripsi_singkat,
    dokumen_path
  ) values (
    v_fixture_mission_id,
    null,
    v_source.tier_id,
    'Join Squad Tahap A Disposable Runtime Fixture',
    v_source.penyelenggara,
    v_source.kategori_penyelenggara,
    'https://example.com/join-squad-stage-a-runtime',
    pg_catalog.now() + interval '7 days',
    pg_catalog.now() + interval '14 days',
    extract(year from pg_catalog.now())::smallint,
    v_source.kategori_lomba,
    v_source.cakupan_peserta,
    v_source.mode_lomba,
    3,
    5,
    v_source.biaya_pendaftaran,
    'Disposable Join Squad Tahap A runtime fixture',
    v_source.dokumen_path
  );

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_leader_id::text, true
  );
  perform pg_catalog.set_config(
    'request.jwt.claim.role', 'authenticated', true
  );

  -- Four Squad fixtures share one dedicated leader. Each generated leader
  -- membership is ended before creating the next fixture so the existing
  -- one-active-Squad-per-Mission invariant remains intact.
  for v_index in 1..4 loop
    insert into public.squads (
      mission_id,
      ketua_id,
      nama_squad,
      deskripsi_squad,
      kapasitas_anggota,
      status_squad,
      finalized_at,
      completed_at
    ) values (
      v_fixture_mission_id,
      v_leader_id,
      'Join Stage A Fixture ' || v_index::text,
      'Disposable rollback-only Squad',
      4::smallint,
      'OPEN_RECRUITMENT'::public.squad_status_enum,
      null,
      null
    )
    returning squad_id into v_squad_id;

    v_squad_ids := pg_catalog.array_append(v_squad_ids, v_squad_id);

    perform pg_catalog.set_config('nexus.internal', '1', true);
    update public.squad_members
    set status_member = 'LEFT'::public.member_status_enum,
        ended_at = pg_catalog.now()
    where squad_id = v_squad_id
      and user_id = v_leader_id
      and status_member = 'ACTIVE'::public.member_status_enum;
    perform pg_catalog.set_config('nexus.internal', '0', true);
  end loop;

  -- Unauthenticated calls must be rejected by the RPC itself. RPC ACL is
  -- checked separately by the read-only structural script.
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
  begin
    perform public.submit_squad_application(v_squad_ids[1]);
    raise exception 'Expected unauthenticated submit to fail';
  exception when sqlstate '42501' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Not authorized' then
      raise;
    end if;
  end;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_applicant_id::text, true
  );
  perform pg_catalog.set_config(
    'request.jwt.claim.role', 'authenticated', true
  );

  -- Inactive account.
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.profiles
  set status_akun = 'SUSPENDED'
  where user_id = v_applicant_id;
  perform pg_catalog.set_config('nexus.internal', '0', true);
  begin
    perform public.submit_squad_application(v_squad_ids[1]);
    raise exception 'Expected inactive applicant to fail';
  exception when sqlstate '42501' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Account is not active' then
      raise;
    end if;
  end;
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.profiles
  set status_akun = 'ACTIVE'
  where user_id = v_applicant_id;
  perform pg_catalog.set_config('nexus.internal', '0', true);

  -- Onboarding incomplete.
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.profiles
  set primary_class_id = null
  where user_id = v_applicant_id;
  perform pg_catalog.set_config('nexus.internal', '0', true);
  begin
    perform public.submit_squad_application(v_squad_ids[1]);
    raise exception 'Expected applicant without onboarding to fail';
  exception when sqlstate '42501' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <>
      'Onboarding must be completed before applying to a Squad'
    then
      raise;
    end if;
  end;
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.profiles
  set primary_class_id = v_applicant_class_id
  where user_id = v_applicant_id;
  perform pg_catalog.set_config('nexus.internal', '0', true);

  -- Self-application.
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_leader_id::text, true
  );
  begin
    perform public.submit_squad_application(v_squad_ids[1]);
    raise exception 'Expected self-application to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'You cannot apply to your own Squad' then
      raise;
    end if;
  end;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_applicant_id::text, true
  );

  -- Deadline already passed.
  update public.missions
  set deadline_pendaftaran = pg_catalog.now() - interval '1 day'
  where mission_id = v_fixture_mission_id;
  begin
    perform public.submit_squad_application(v_squad_ids[1]);
    raise exception 'Expected closed Mission deadline to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <>
      'The Mission registration deadline has passed'
    then
      raise;
    end if;
  end;
  update public.missions
  set deadline_pendaftaran = pg_catalog.now() + interval '7 days'
  where mission_id = v_fixture_mission_id;

  -- FULL/non-OPEN Squad.
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.squads
  set status_squad = 'FULL'::public.squad_status_enum
  where squad_id = v_squad_ids[4];
  perform pg_catalog.set_config('nexus.internal', '0', true);
  begin
    perform public.submit_squad_application(v_squad_ids[4]);
    raise exception 'Expected non-OPEN Squad to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'This Squad is not accepting applications' then
      raise;
    end if;
  end;
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.squads
  set status_squad = 'OPEN_RECRUITMENT'::public.squad_status_enum
  where squad_id = v_squad_ids[4];
  perform pg_catalog.set_config('nexus.internal', '0', true);

  -- Existing ACTIVE membership on the derived Mission.
  insert into public.squad_members (
    squad_id,
    mission_id,
    user_id,
    role_squad,
    status_member
  ) values (
    v_squad_ids[1],
    v_fixture_mission_id,
    v_applicant_id,
    'ANGGOTA'::public.squad_role_enum,
    'ACTIVE'::public.member_status_enum
  );
  begin
    perform public.submit_squad_application(v_squad_ids[2]);
    raise exception 'Expected existing ACTIVE membership to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <>
      'You already have an active Squad for this Mission'
    then
      raise;
    end if;
  end;
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.squad_members
  set status_member = 'LEFT'::public.member_status_enum,
      ended_at = pg_catalog.now()
  where squad_id = v_squad_ids[1]
    and user_id = v_applicant_id
    and status_member = 'ACTIVE'::public.member_status_enum;
  perform pg_catalog.set_config('nexus.internal', '0', true);

  -- First application and database-side Mission derivation.
  v_application_id :=
    public.submit_squad_application(v_squad_ids[1]);

  if not exists (
    select 1
    from public.squad_applications
    where application_id = v_application_id
      and squad_id = v_squad_ids[1]
      and mission_id = v_fixture_mission_id
      and user_id = v_applicant_id
      and status_application = 'PENDING'::public.application_status_enum
  ) then
    raise exception 'RPC did not derive Mission and applicant from database/auth';
  end if;

  -- Duplicate PENDING application to the same Squad.
  begin
    perform public.submit_squad_application(v_squad_ids[1]);
    raise exception 'Expected duplicate PENDING application to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <>
      'You already have a pending application for this Squad'
    then
      raise;
    end if;
  end;

  -- Applications two and three succeed.
  perform public.submit_squad_application(v_squad_ids[2]);
  perform public.submit_squad_application(v_squad_ids[3]);

  if (
    select pg_catalog.count(*)
    from public.squad_applications
    where user_id = v_applicant_id
      and mission_id = v_fixture_mission_id
      and status_application = 'PENDING'::public.application_status_enum
  ) <> 3 then
    raise exception 'Expected exactly three PENDING applications';
  end if;

  -- The fourth application must fail atomically. The profile FOR UPDATE lock
  -- in the RPC/trigger serializes this count across concurrent submitters for
  -- the same applicant; the partial unique index covers same-Squad races.
  begin
    perform public.submit_squad_application(v_squad_ids[4]);
    raise exception 'Expected fourth PENDING application to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <>
      'A user may have at most 3 pending Squad applications per Mission'
    then
      raise;
    end if;
  end;

  if (
    select pg_catalog.count(*)
    from public.squad_applications
    where user_id = v_applicant_id
      and mission_id = v_fixture_mission_id
      and status_application = 'PENDING'::public.application_status_enum
  ) <> 3 then
    raise exception 'Failed fourth application left a partial write';
  end if;

  if pg_catalog.has_table_privilege(
    'anon', 'public.squad_applications', 'INSERT'
  ) or pg_catalog.has_table_privilege(
    'authenticated', 'public.squad_applications', 'INSERT'
  ) then
    raise exception 'Direct INSERT protection is not active';
  end if;

  if pg_catalog.has_function_privilege(
    'anon',
    'public.submit_squad_application(uuid)',
    'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'authenticated',
    'public.submit_squad_application(uuid)',
    'EXECUTE'
  ) then
    raise exception 'submit_squad_application RPC ACL is incorrect';
  end if;
end;
$test$;

rollback;

-- This row must return true. It proves the disposable Mission and all rows
-- cascading from its Squads/applications were rolled back.
select not exists (
  select 1
  from public.missions
  where mission_id = 'a1100000-0000-4000-8000-000000000001'::uuid
) as join_squad_runtime_fixture_rolled_back;
