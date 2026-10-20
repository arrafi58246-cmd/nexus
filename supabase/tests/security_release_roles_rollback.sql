-- SQL role/JWT simulation, not Auth/HTTP/browser. Dedicated QA profile only;
-- suspension and legacy-email compatibility update are rolled back together.
begin;
set local statement_timeout='25s';
set local lock_timeout='3s';
do $test$
declare
  owner_role text := current_setting('role');
  student uuid; admin_id uuid; caller uuid; sid uuid; fake uuid := gen_random_uuid();
  expected_profiles jsonb; expected_xp jsonb; actual jsonb;
  scenario record;
begin
  select user_id into student from public.profiles where nama_lengkap like 'Mahasiswa Test NEXUS%'
    and role_app='STUDENT' and status_akun='ACTIVE' order by user_id limit 1;
  select user_id into admin_id from public.profiles where role_app='ADMIN' and status_akun='ACTIVE' limit 1;
  select squad_id into sid from public.squads order by squad_id limit 1;
  if student is null or admin_id is null or sid is null then raise exception 'QA Student, Admin and existing Squad required';end if;
  select jsonb_agg(to_jsonb(p) order by user_id) into expected_profiles from public.public_profiles p;
  select jsonb_agg(to_jsonb(x) order by user_id) into expected_xp from public.career_xp_totals x;
  if expected_profiles is null or expected_xp is null then raise exception 'Nonempty fixtures required';end if;
  foreach caller in array array[student,admin_id] loop
    perform set_config('request.jwt.claim.sub',caller::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',caller,'role','authenticated',
      'user_metadata',jsonb_build_object('role_app','ADMIN','status_akun','ACTIVE'))::text,true);
    perform set_config('role','authenticated',true);
    select jsonb_agg(to_jsonb(p) order by user_id) into actual from public.public_profiles p;
    if actual is distinct from expected_profiles then raise exception 'ACTIVE public-profile output changed';end if;
    select jsonb_agg(to_jsonb(x) order by user_id) into actual from public.career_xp_totals x;
    if actual is distinct from expected_xp then raise exception 'ACTIVE Career XP output changed';end if;
    if exists(select 1 from public.seasons where status_season='ACTIVE')
      and not exists(select 1 from public.current_seasonal_xp_totals where user_id=caller) then
      raise exception 'ACTIVE caller lost seasonal XP SELECT';end if;
    if caller=student and exists(select 1 from public.current_seasonal_xp_totals where user_id<>caller) then
      raise exception 'Invoker seasonal view bypassed private-row RLS';end if;
    if public.is_admin() is distinct from (caller=admin_id) then raise exception 'Metadata changed account role';end if;
    perform set_config('role',owner_role,true);
  end loop;
  perform set_config('nexus.internal','1',true);
  update public.profiles set status_akun='SUSPENDED',email_unesa=student::text||'@mhs.unesa.ac.id' where user_id=student;
  perform set_config('nexus.internal','',true);

  foreach caller in array array[fake,student] loop
    perform set_config('request.jwt.claim.sub',caller::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',caller,'role','authenticated',
      'user_metadata',jsonb_build_object('role_app','ADMIN','status_akun','ACTIVE'))::text,true);
    perform set_config('role','authenticated',true);
    if public.is_active_user() or public.is_admin() then raise exception 'Claims bypassed profile status/role';end if;
    if exists(select 1 from public.public_profiles) or exists(select 1 from public.career_xp_totals) then
      raise exception 'Missing/suspended caller read guarded views';end if;
    for scenario in select * from (values
      (format('select public.cancel_squad_application(%L)',fake),'42501','Account is not active'),
      (format('select public.close_active_season(%L)',fake),'P0001','Admin permission required'),
      (format('select public.create_squad(%L,''QA'',''QA'',2::smallint,''[]''::jsonb)',fake),'42501','Not authorized'),
      (format('select public.decide_squad_application(%L,''ACCEPTED'')',fake),'42501','Account is not active'),
      (format('select public.disband_solo_squad(%L)',fake),'42501','An active Student leader is required'),
      (format('select public.equip_badge(%L)',fake),'P0001','Account is not active'),
      (format('select public.finalize_squad(%L)',fake),'P0001','Account is not active'),
      ('select public.get_current_leaderboard(''UNIVERSITAS'')','42501','Leaderboard is available to active students only'),
      (format('select public.get_leader_pending_squad_applications(%L)',fake),'42501','Account is not active'),
      (format('select public.get_mission_squad_leaders(%L)',fake),'42501','Not authorized'),
      (format('select public.get_squad_room_members(%L)',fake),'42501','Not authorized'),
      (format('select public.kick_squad_member(%L,%L)',fake,student),'P0001','Account is not active'),
      (format('select public.leave_squad(%L)',fake),'P0001','Account is not active'),
      (format('select public.refresh_leaderboard_badges(%L)',fake),'P0001','Admin permission required'),
      (format('select public.submit_squad_application(%L)',sid),'42501','Account is not active'),
      (format('select public.transfer_squad_leadership(%L,%L)',fake,admin_id),'42501','Only the current Squad leader can transfer leadership')
    ) cases(sql,code,message) loop
      begin
        execute scenario.sql;
        raise exception using errcode='ZX999',message='Restricted RPC unexpectedly succeeded';
      exception when others then
        if sqlstate<>scenario.code or sqlerrm<>scenario.message then raise;end if;
      end;
    end loop;
    perform set_config('role',owner_role,true);
  end loop;
end $test$;
rollback;
select 'PASS: ACTIVE Student/Admin view output; missing/suspended callers and forged metadata denied on guarded views and 16 RPC probes; rolled back' as result;
