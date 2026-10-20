-- Run after restrict_squad_participation_to_students as the database test owner.
-- Uses an open team Mission and two onboarded students without membership there.
-- ALL fixtures and positive-path writes are rolled back; no production cleanup.
begin;
do $test$
declare
  v_mission uuid;
  v_admin uuid;
  v_students uuid[];
  v_leader uuid;
  v_applicant uuid;
  v_class bigint;
  v_capacity smallint;
  v_squad uuid;
  v_application uuid;
  v_legacy_application uuid;
  v_legacy_leader uuid;
begin
  select m.mission_id, greatest(m.min_anggota_tim, 2)::smallint
  into strict v_mission, v_capacity
  from public.missions m
  where m.deadline_pendaftaran > now() and m.max_anggota_tim >= 2
  order by m.mission_id limit 1;
  select user_id into strict v_admin from public.profiles
  where role_app = 'ADMIN' and status_akun = 'ACTIVE' order by user_id limit 1;
  select array_agg(p.user_id order by p.user_id) into v_students
  from public.profiles p
  where p.role_app = 'STUDENT' and p.status_akun = 'ACTIVE'
    and p.primary_class_id is not null
    and not exists (select 1 from public.squad_members sm where sm.user_id = p.user_id
      and sm.mission_id = v_mission and sm.status_member = 'ACTIVE');
  assert cardinality(v_students) >= 2, 'Need two eligible student fixtures';
  v_leader := v_students[1]; v_applicant := v_students[2];
  select primary_class_id into v_class from public.profiles where user_id = v_leader;
  select a.application_id, s.ketua_id into v_legacy_application, v_legacy_leader
  from public.squad_applications a join public.squads s using(squad_id)
  where a.user_id = v_admin and a.status_application = 'PENDING'
  order by a.application_id limit 1;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_leader::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_leader, 'role', 'authenticated')::text, true);
  v_squad := public.create_squad(v_mission, '[ROLLBACK QA] Student role test',
    'Temporary access-control verification', v_capacity,
    jsonb_build_array(jsonb_build_object('primary_class_id', v_class, 'slot_dibutuhkan', v_capacity - 1)));
  assert v_squad is not null, 'Eligible student must still create Squad';

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  -- An editable metadata claim cannot override the real profiles.role_app.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated',
    'user_metadata', jsonb_build_object('role_app', 'STUDENT'))::text, true);
  begin
    perform public.submit_squad_application(v_squad);
    raise exception 'Admin Join RPC was allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_squad(v_mission, '[ROLLBACK QA] Admin must fail', 'Role test', v_capacity,
      jsonb_build_array(jsonb_build_object('primary_class_id', v_class, 'slot_dibutuhkan', v_capacity - 1)));
    raise exception 'Admin Create Squad RPC was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.squad_applications(squad_id, mission_id, user_id)
      values(v_squad, v_mission, v_admin);
    raise exception 'Admin direct application INSERT was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.squad_members(squad_id, mission_id, user_id, role_squad, status_member)
      values(v_squad, v_mission, v_admin, 'ANGGOTA', 'ACTIVE');
    raise exception 'Admin direct membership INSERT was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.squads(mission_id, ketua_id, nama_squad, deskripsi_squad, kapasitas_anggota)
      values(v_mission, v_admin, '[ROLLBACK QA] Admin direct must fail', 'Role test', v_capacity);
    raise exception 'Admin direct Squad INSERT was allowed';
  exception when insufficient_privilege then null; end;

  if v_legacy_application is not null then
    perform set_config('request.jwt.claim.sub', v_legacy_leader::text, true);
    begin
      perform public.decide_squad_application(v_legacy_application, 'ACCEPTED');
      raise exception 'Legacy admin application was accepted';
    exception when raise_exception then
      if sqlerrm <> 'Applicant account is not active' then raise; end if;
    end;
  end if;

  perform set_config('request.jwt.claim.sub', v_applicant::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_applicant, 'role', 'authenticated')::text, true);
  v_application := public.submit_squad_application(v_squad);
  assert v_application is not null, 'Eligible student must still apply';
  begin
    perform public.submit_squad_application(v_squad);
    raise exception 'Duplicate student application was allowed';
  exception when raise_exception then
    if sqlerrm <> 'You already have a pending application for this Squad' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_leader::text, true);
  perform public.decide_squad_application(v_application, 'ACCEPTED');
  assert exists(select 1 from public.squad_members where squad_id = v_squad
    and user_id = v_applicant and status_member = 'ACTIVE'), 'Student acceptance must create membership';
  assert not exists(select 1 from public.squad_members where squad_id = v_squad and user_id = v_admin),
    'Admin must never become a member';
  perform set_config('role', 'none', true);
end;
$test$;
rollback;
select 'PASS: admin RPC/direct writes denied; legacy admin cannot be accepted; student create/apply/accept and duplicate protection preserved; fixtures rolled back' as result;
