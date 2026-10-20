-- Join Squad Tahap B runtime regression test.
--
-- Replace all three UUID placeholders with dedicated ACTIVE, onboarded,
-- non-admin test accounts. The script does not discover or print users.
-- Dedicated accounts whose legacy email violates profiles_email_role_check are
-- rejected during preflight; this test never rewrites an email address.
-- Every fixture, status change, DDL failure hook, and notification is rolled
-- back by the enclosing transaction.
begin;

do $preflight$
begin
  if pg_catalog.to_regprocedure(
    'public.join_stage_b_test_fail_accept_notification()'
  ) is not null then
    raise exception
      'Test-only notification failure function name is already in use';
  end if;
end;
$preflight$;

create function public.join_stage_b_test_fail_accept_notification()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.notification_type = 'SQUAD_APPLICATION_ACCEPTED'
    and new.user_id::text = pg_catalog.current_setting(
      'join_stage_b.fail_notification_user',
      true
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'Forced Join Squad Tahap B notification failure';
  end if;

  return new;
end;
$function$;

create trigger join_stage_b_force_notification_failure
before insert on public.notifications
for each row execute function public.join_stage_b_test_fail_accept_notification();

do $test$
declare
  v_applicant_id constant uuid :=
    '11111111-1111-1111-1111-111111111111'::uuid;
  v_leader_id constant uuid :=
    '22222222-2222-2222-2222-222222222222'::uuid;
  v_existing_member_id constant uuid :=
    '33333333-3333-3333-3333-333333333333'::uuid;
  v_fixture_mission_id constant uuid :=
    'b2200000-0000-4000-8000-000000000001'::uuid;
  v_source_mission_id constant uuid :=
    'b0cf942a-aee0-4533-99c8-b7539d7132f8'::uuid;
  v_source public.missions%rowtype;
  v_squad_ids uuid[] := array[]::uuid[];
  v_squad_id uuid;
  v_cancel_application_id uuid;
  v_reject_application_id uuid;
  v_other_application_id uuid;
  v_accept_application_id uuid;
  v_error_message text;
  v_count integer;
  v_index integer;
begin
  if v_applicant_id =
      '11111111-1111-1111-1111-111111111111'::uuid
    or v_leader_id =
      '22222222-2222-2222-2222-222222222222'::uuid
    or v_existing_member_id =
      '33333333-3333-3333-3333-333333333333'::uuid
  then
    raise exception
      'Replace all dedicated Join Squad Tahap B account UUID placeholders';
  end if;

  if pg_catalog.array_length(
    array[
      v_applicant_id,
      v_leader_id,
      v_existing_member_id
    ]::uuid[],
    1
  ) <> (
    select pg_catalog.count(distinct account_id)
    from pg_catalog.unnest(
      array[
        v_applicant_id,
        v_leader_id,
        v_existing_member_id
      ]::uuid[]
    ) as account(account_id)
  ) then
    raise exception 'Tahap B test account UUIDs must be distinct';
  end if;

  select pg_catalog.count(*)
  into v_count
  from public.profiles as profile
  where profile.user_id in (
      v_applicant_id,
      v_leader_id,
      v_existing_member_id
    )
    and profile.status_akun = 'ACTIVE'
    and profile.primary_class_id is not null
    and profile.role_app = 'STUDENT';

  if v_count <> 3 then
    raise exception
      'Dedicated Tahap B accounts must exist, be ACTIVE/onboarded STUDENT accounts';
  end if;

  if exists (
    select 1
    from public.profiles as profile
    where profile.user_id in (v_applicant_id, v_leader_id)
      and profile.role_app = 'STUDENT'
      and pg_catalog.lower(profile.email_unesa) not like '%@mhs.unesa.ac.id'
  ) then
    raise exception
      'Use dedicated accounts compliant with profiles_email_role_check; this test will not alter email';
  end if;

  if exists (
    select 1
    from public.missions
    where mission_id = v_fixture_mission_id
  ) then
    raise exception 'Disposable Tahap B Mission UUID is already in use';
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
    'Join Squad Tahap B Disposable Runtime Fixture',
    v_source.penyelenggara,
    v_source.kategori_penyelenggara,
    'https://example.com/join-squad-stage-b-runtime',
    pg_catalog.now() + interval '7 days',
    pg_catalog.now() + interval '14 days',
    extract(year from pg_catalog.now())::smallint,
    v_source.kategori_lomba,
    v_source.cakupan_peserta,
    v_source.mode_lomba,
    2,
    3,
    v_source.biaya_pendaftaran,
    'Disposable Join Squad Tahap B runtime fixture',
    v_source.dokumen_path
  );

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_leader_id::text, true
  );
  perform pg_catalog.set_config(
    'request.jwt.claim.role', 'authenticated', true
  );

  -- Create three alternate Squads and end each generated leader membership.
  -- The fourth/target Squad keeps its KETUA ACTIVE membership.
  for v_index in 1..3 loop
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
      'Tahap B Alternate Squad ' || v_index::text,
      'Disposable rollback-only Squad',
      3::smallint,
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
    'Tahap B Target Squad',
    'Disposable rollback-only acceptance target',
    3::smallint,
    'OPEN_RECRUITMENT'::public.squad_status_enum,
    null,
    null
  )
  returning squad_id into v_squad_id;
  v_squad_ids := pg_catalog.array_append(v_squad_ids, v_squad_id);

  insert into public.squad_members (
    squad_id,
    mission_id,
    user_id,
    role_squad,
    status_member
  ) values (
    v_squad_ids[4],
    v_fixture_mission_id,
    v_existing_member_id,
    'ANGGOTA'::public.squad_role_enum,
    'ACTIVE'::public.member_status_enum
  );

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_applicant_id::text, true
  );

  -- Applicant submits an application used for cancel authorization tests.
  v_cancel_application_id :=
    public.submit_squad_application(v_squad_ids[1]);

  -- An unauthenticated request is rejected by the function body. The
  -- structural suite separately verifies that anon has no EXECUTE grant.
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
  begin
    perform public.cancel_squad_application(v_cancel_application_id);
    raise exception 'Expected anonymous cancellation to fail';
  exception when sqlstate '42501' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Not authorized' then
      raise;
    end if;
  end;
  perform pg_catalog.set_config(
    'request.jwt.claim.role', 'authenticated', true
  );

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_leader_id::text, true
  );
  perform pg_catalog.set_config('nexus.internal', '0', true);
  begin
    perform public.cancel_squad_application(v_cancel_application_id);
    raise exception 'Expected cancellation by another user to fail';
  exception when sqlstate '42501' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <>
      'Only the applicant or admin may cancel this application'
    then
      raise;
    end if;
  end;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_applicant_id::text, true
  );
  perform pg_catalog.set_config('nexus.internal', '', true);
  perform public.cancel_squad_application(v_cancel_application_id);

  if coalesce(
    pg_catalog.current_setting('nexus.internal', true),
    ''
  ) <> '' then
    raise exception 'Cancel leaked nexus.internal after success';
  end if;

  if not exists (
    select 1
    from public.squad_applications
    where application_id = v_cancel_application_id
      and status_application = 'CANCELLED'::public.application_status_enum
      and decided_at is not null
      and decided_by is null
  ) then
    raise exception 'Applicant cancellation did not preserve decision shape';
  end if;

  begin
    perform public.cancel_squad_application(v_cancel_application_id);
    raise exception 'Expected repeated cancellation to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Only a PENDING application can be cancelled' then
      raise;
    end if;
  end;

  -- Rejection authorization, NULL-decision guard, and decision retry.
  v_reject_application_id :=
    public.submit_squad_application(v_squad_ids[2]);

  begin
    perform public.decide_squad_application(
      v_reject_application_id,
      'REJECTED'
    );
    raise exception 'Expected applicant decision to fail';
  exception when sqlstate '42501' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <>
      'Only the Squad leader or admin may decide this application'
    then
      raise;
    end if;
  end;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_leader_id::text, true
  );
  begin
    perform public.decide_squad_application(v_reject_application_id, null);
    raise exception 'Expected NULL decision to fail';
  exception when sqlstate '22023' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Decision must be ACCEPTED or REJECTED' then
      raise;
    end if;
  end;

  perform pg_catalog.set_config('nexus.internal', '0', true);
  perform public.decide_squad_application(
    v_reject_application_id,
    'REJECTED'
  );

  if pg_catalog.current_setting('nexus.internal', true) is distinct from '0'
  then
    raise exception 'REJECTED decision did not restore nexus.internal';
  end if;

  if not exists (
    select 1
    from public.squad_applications
    where application_id = v_reject_application_id
      and status_application = 'REJECTED'::public.application_status_enum
      and decided_at is not null
      and decided_by = v_leader_id
  ) then
    raise exception 'Leader rejection did not preserve decision shape';
  end if;

  begin
    perform public.decide_squad_application(
      v_reject_application_id,
      'REJECTED'
    );
    raise exception 'Expected repeated decision to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Only PENDING applications can be decided' then
      raise;
    end if;
  end;

  -- Applicant submits two Pending applications for atomic acceptance tests.
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_applicant_id::text, true
  );
  v_other_application_id :=
    public.submit_squad_application(v_squad_ids[3]);
  v_accept_application_id :=
    public.submit_squad_application(v_squad_ids[4]);

  -- Applicant can still cancel a Pending application after the deadline.
  update public.missions
  set deadline_pendaftaran = pg_catalog.now() - interval '1 day'
  where mission_id = v_fixture_mission_id;
  perform pg_catalog.set_config('nexus.internal', '0', true);
  perform public.cancel_squad_application(v_other_application_id);

  if pg_catalog.current_setting('nexus.internal', true) is distinct from '0'
  then
    raise exception 'Deadline cancellation did not restore nexus.internal';
  end if;

  update public.missions
  set deadline_pendaftaran = pg_catalog.now() + interval '7 days'
  where mission_id = v_fixture_mission_id;
  v_other_application_id :=
    public.submit_squad_application(v_squad_ids[3]);

  -- ACCEPT after deadline must fail without changing application/membership.
  update public.missions
  set deadline_pendaftaran = pg_catalog.now() - interval '1 day'
  where mission_id = v_fixture_mission_id;
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_leader_id::text, true
  );
  perform pg_catalog.set_config('nexus.internal', '0', true);
  begin
    perform public.decide_squad_application(
      v_accept_application_id,
      'ACCEPTED'
    );
    raise exception 'Expected ACCEPT after deadline to fail';
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

  -- ACCEPT on non-OPEN Squad must fail.
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.squads
  set status_squad = 'FULL'::public.squad_status_enum
  where squad_id = v_squad_ids[4];
  perform pg_catalog.set_config('nexus.internal', '0', true);
  begin
    perform public.decide_squad_application(
      v_accept_application_id,
      'ACCEPTED'
    );
    raise exception 'Expected ACCEPT on non-OPEN Squad to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'The Squad is no longer open for recruitment' then
      raise;
    end if;
  end;
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.squads
  set status_squad = 'OPEN_RECRUITMENT'::public.squad_status_enum
  where squad_id = v_squad_ids[4];
  perform pg_catalog.set_config('nexus.internal', '0', true);

  -- A non-ACTIVE actor cannot decide.
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.profiles
  set status_akun = 'SUSPENDED'
  where user_id = v_leader_id;
  perform pg_catalog.set_config('nexus.internal', '0', true);
  begin
    perform public.decide_squad_application(
      v_accept_application_id,
      'ACCEPTED'
    );
    raise exception 'Expected inactive leader decision to fail';
  exception when sqlstate '42501' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Account is not active' then
      raise;
    end if;
  end;
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.profiles
  set status_akun = 'ACTIVE'
  where user_id = v_leader_id;
  perform pg_catalog.set_config('nexus.internal', '0', true);

  -- A suspended applicant cannot be accepted and cannot cancel while inactive.
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.profiles
  set status_akun = 'SUSPENDED'
  where user_id = v_applicant_id;
  perform pg_catalog.set_config('nexus.internal', '0', true);
  begin
    perform public.decide_squad_application(
      v_accept_application_id,
      'ACCEPTED'
    );
    raise exception 'Expected suspended applicant acceptance to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Applicant account is not active' then
      raise;
    end if;
  end;
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_applicant_id::text, true
  );
  begin
    perform public.cancel_squad_application(v_accept_application_id);
    raise exception 'Expected inactive applicant cancellation to fail';
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

  -- Existing ACTIVE membership on the Mission blocks acceptance.
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
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_leader_id::text, true
  );
  begin
    perform public.decide_squad_application(
      v_accept_application_id,
      'ACCEPTED'
    );
    raise exception 'Expected ACTIVE membership conflict to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <>
      'Applicant already has an active Squad for this Mission'
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

  -- Capacity is checked under the Squad lock.
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.squads
  set kapasitas_anggota = 2::smallint
  where squad_id = v_squad_ids[4];
  perform pg_catalog.set_config('nexus.internal', '0', true);
  begin
    perform public.decide_squad_application(
      v_accept_application_id,
      'ACCEPTED'
    );
    raise exception 'Expected full-capacity acceptance to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'The Squad is already full' then
      raise;
    end if;
  end;
  perform pg_catalog.set_config('nexus.internal', '1', true);
  update public.squads
  set kapasitas_anggota = 3::smallint
  where squad_id = v_squad_ids[4];
  perform pg_catalog.set_config('nexus.internal', '0', true);

  -- Ketua projection returns the Pending applicant without exposing email/NIM.
  select pg_catalog.count(*)
  into v_count
  from public.get_leader_pending_squad_applications(v_fixture_mission_id)
    as application
  where application.application_id in (
    v_other_application_id,
    v_accept_application_id
  );

  if v_count <> 2 then
    raise exception 'Leader Pending application projection is incomplete';
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_applicant_id::text, true
  );
  select pg_catalog.count(*)
  into v_count
  from public.get_leader_pending_squad_applications(v_fixture_mission_id);

  if v_count <> 0 then
    raise exception 'Non-leader could read the leader application projection';
  end if;

  -- Force the final notification insert to fail after member/application/Squad
  -- writes. The failed RPC statement must roll every preceding write back.
  perform pg_catalog.set_config(
    'join_stage_b.fail_notification_user',
    v_applicant_id::text,
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_leader_id::text, true
  );
  perform pg_catalog.set_config('nexus.internal', '0', true);
  begin
    perform public.decide_squad_application(
      v_accept_application_id,
      'ACCEPTED'
    );
    raise exception 'Expected forced notification failure';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <>
      'Forced Join Squad Tahap B notification failure'
    then
      raise;
    end if;
  end;

  if pg_catalog.current_setting('nexus.internal', true) is distinct from '0'
  then
    raise exception 'Failed ACCEPT did not roll back nexus.internal';
  end if;

  if exists (
    select 1
    from public.squad_members
    where user_id = v_applicant_id
      and mission_id = v_fixture_mission_id
      and status_member = 'ACTIVE'::public.member_status_enum
  ) or not exists (
    select 1
    from public.squad_applications
    where application_id in (
        v_other_application_id,
        v_accept_application_id
      )
      and status_application = 'PENDING'::public.application_status_enum
    group by user_id, mission_id
    having pg_catalog.count(*) = 2
  ) or not exists (
    select 1
    from public.squads
    where squad_id = v_squad_ids[4]
      and status_squad = 'OPEN_RECRUITMENT'::public.squad_status_enum
  ) then
    raise exception 'Forced mid-transaction failure left partial data';
  end if;

  execute 'drop trigger join_stage_b_force_notification_failure on public.notifications';
  perform pg_catalog.set_config(
    'join_stage_b.fail_notification_user',
    '',
    true
  );

  -- Successful atomic acceptance.
  perform pg_catalog.set_config('nexus.internal', '', true);
  perform public.decide_squad_application(
    v_accept_application_id,
    'ACCEPTED'
  );

  if coalesce(
    pg_catalog.current_setting('nexus.internal', true),
    ''
  ) <> '' then
    raise exception 'ACCEPTED decision leaked nexus.internal after success';
  end if;

  if not exists (
    select 1
    from public.squad_applications
    where application_id = v_accept_application_id
      and status_application = 'ACCEPTED'::public.application_status_enum
      and decided_at is not null
      and decided_by = v_leader_id
  ) then
    raise exception 'Accepted application state is incorrect';
  end if;

  if not exists (
    select 1
    from public.squad_applications
    where application_id = v_other_application_id
      and status_application = 'CANCELLED'::public.application_status_enum
      and decided_at is not null
      and decided_by = v_leader_id
  ) then
    raise exception 'Other Mission application was not auto-cancelled';
  end if;

  if not exists (
    select 1
    from public.squad_members
    where squad_id = v_squad_ids[4]
      and mission_id = v_fixture_mission_id
      and user_id = v_applicant_id
      and role_squad = 'ANGGOTA'::public.squad_role_enum
      and status_member = 'ACTIVE'::public.member_status_enum
  ) then
    raise exception 'Accepted applicant membership is missing';
  end if;

  if (
    select pg_catalog.count(*)
    from public.squad_members
    where squad_id = v_squad_ids[4]
      and status_member = 'ACTIVE'::public.member_status_enum
  ) <> 3 or not exists (
    select 1
    from public.squads
    where squad_id = v_squad_ids[4]
      and status_squad = 'FULL'::public.squad_status_enum
  ) then
    raise exception 'Capacity/FULL transition after acceptance is incorrect';
  end if;

  if (
    select pg_catalog.count(*)
    from public.squad_members
    where user_id = v_applicant_id
      and mission_id = v_fixture_mission_id
      and status_member = 'ACTIVE'::public.member_status_enum
  ) <> 1 then
    raise exception 'One ACTIVE membership per Mission was not preserved';
  end if;

  begin
    perform public.decide_squad_application(
      v_accept_application_id,
      'ACCEPTED'
    );
    raise exception 'Expected repeated ACCEPT to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Only PENDING applications can be decided' then
      raise;
    end if;
  end;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_applicant_id::text, true
  );
  begin
    perform public.cancel_squad_application(v_accept_application_id);
    raise exception 'Expected cancellation after decision to fail';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Only a PENDING application can be cancelled' then
      raise;
    end if;
  end;

  if pg_catalog.has_table_privilege(
    'anon', 'public.squad_applications', 'INSERT'
  ) or pg_catalog.has_table_privilege(
    'anon', 'public.squad_applications', 'UPDATE'
  ) or pg_catalog.has_table_privilege(
    'authenticated', 'public.squad_applications', 'INSERT'
  ) or pg_catalog.has_table_privilege(
    'authenticated', 'public.squad_applications', 'UPDATE'
  ) then
    raise exception 'Direct application write protection is not active';
  end if;
end;
$test$;

rollback;

select not exists (
  select 1
  from public.missions
  where mission_id = 'b2200000-0000-4000-8000-000000000001'::uuid
) as join_squad_decision_fixture_rolled_back;
