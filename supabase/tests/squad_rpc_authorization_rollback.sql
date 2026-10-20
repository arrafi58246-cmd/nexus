-- Owner-only SQL role/JWT simulation. Fresh Squad fixtures; every write rolls back.
begin;
set local statement_timeout = '30s';
do $test$
declare
  owner_role text := current_setting('role');
  u uuid[]; admin_id uuid; actor uuid; c bigint;
  m public.missions%rowtype;
  v_squad_id uuid; other_squad uuid; accepted_id uuid; pending_id uuid;
  season_id uuid; test_case record; 
begin
  select array_agg(user_id order by nama_lengkap) into u from (
    select user_id,nama_lengkap from public.profiles
    where nama_lengkap like 'Mahasiswa Test NEXUS%' and role_app='STUDENT'
      and status_akun='ACTIVE' and primary_class_id is not null
    order by nama_lengkap limit 4) q;
  select user_id into admin_id from public.profiles
    where role_app='ADMIN' and status_akun='ACTIVE' order by user_id limit 1;
  select s.season_id into season_id from public.seasons s where status_season='ACTIVE' limit 1;
  if coalesce(array_length(u,1),0)<>4 or admin_id is null or season_id is null then
    raise exception 'Requires four dedicated QA students, an active admin and season';
  end if;
  select primary_class_id into c from public.primary_classes order by primary_class_id limit 1;
  select * into m from public.missions order by mission_id limit 1;
  if m.mission_id is null then raise exception 'Mission template required'; end if;
  m.mission_id:=gen_random_uuid(); m.source_submission_id:=null;
  m.nama_lomba:='QA RPC AUTH '||m.mission_id;
  m.deadline_pendaftaran:=now()+interval '1 day'; m.deadline_lomba:=now()+interval '2 days';
  m.min_anggota_tim:=2; m.max_anggota_tim:=3;
  insert into public.missions select (m).*;
  perform set_config('nexus.internal','',true);

  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  v_squad_id:=public.create_squad(m.mission_id,'QA primary','QA',3::smallint,
    jsonb_build_array(jsonb_build_object('primary_class_id',c,'slot_dibutuhkan',2)));
  perform set_config('request.jwt.claim.sub',u[3]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[3],'role','authenticated')::text,true);
  other_squad:=public.create_squad(m.mission_id,'QA other leader','QA',2::smallint,
    jsonb_build_array(jsonb_build_object('primary_class_id',c,'slot_dibutuhkan',1)));
  perform set_config('request.jwt.claim.sub',u[2]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[2],'role','authenticated')::text,true);
  accepted_id:=public.submit_squad_application(v_squad_id);
  perform set_config('request.jwt.claim.sub',u[4]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[4],'role','authenticated')::text,true);
  pending_id:=public.submit_squad_application(v_squad_id);
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'role','authenticated')::text,true);
  perform public.decide_squad_application(accepted_id,'ACCEPTED');
  if (select count(*) from public.get_leader_pending_squad_applications(m.mission_id))<>1 then
    raise exception 'Leader pending list fixture failed'; end if;
  if (select count(*) from public.get_squad_room_members(v_squad_id))<>2 then
    raise exception 'Leader room access regressed'; end if;

  -- Ordinary member and leader of ANOTHER Squad cannot act as this leader/admin.
  foreach actor in array array[u[2],u[3]] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated',
      'user_metadata',jsonb_build_object('role_app','ADMIN'))::text,true);
    if public.is_admin() then raise exception 'User metadata elevated privileges'; end if;
    for test_case in select * from (values
      (format('select public.close_active_season(%L)',season_id),'P0001','Admin permission required'),
      (format('select public.refresh_leaderboard_badges(%L)',season_id),'P0001','Admin permission required'),
      (format('select public.finalize_squad(%L)',v_squad_id),'P0001','Only the Squad leader or admin may Finalize the Squad'),
      (format('select public.kick_squad_member(%L,%L)',v_squad_id,u[2]),'P0001','Only the Squad leader or admin may remove a member'),
      (format('select public.decide_squad_application(%L,''ACCEPTED'')',pending_id),'42501','Only the Squad leader or admin may decide this application'),
      (format('select public.cancel_squad_application(%L)',pending_id),'42501','Only the applicant or admin may cancel this application'),
      (format('select public.transfer_squad_leadership(%L,%L)',v_squad_id,u[4]),'42501','Only the current Squad leader can transfer leadership')
    ) as cases(sql,code,message) loop
      begin
        execute test_case.sql;
        raise exception using errcode='ZX999',message='Unauthorized RPC succeeded';
      exception when others then
        if sqlstate<>test_case.code or sqlerrm<>test_case.message then raise; end if;
      end;
    end loop;
    if exists(select 1 from public.get_leader_pending_squad_applications(m.mission_id)) then
      raise exception 'Foreign pending applications disclosed'; end if;
  end loop;
  -- Outsider and admin cannot read the private room roster.
  foreach actor in array array[u[3],admin_id] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
    begin
      perform public.get_squad_room_members(v_squad_id);
      raise exception using errcode='ZX999',message='Unauthorized room roster read';
    exception when insufficient_privilege then
      if sqlerrm<>'Not authorized' then raise; end if;
    end;
  end loop;

  -- Suspend the actual leader but retain the same JWT subject.
  perform set_config('role',owner_role,true);
  perform set_config('nexus.internal','1',true);
  update public.profiles set status_akun='SUSPENDED',email_unesa=u[1]::text||'@mhs.unesa.ac.id'
    where user_id=u[1];
  perform set_config('nexus.internal','',true);
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  for test_case in select * from (values
    (format('select public.finalize_squad(%L)',v_squad_id),'P0001','Account is not active'),
    (format('select public.kick_squad_member(%L,%L)',v_squad_id,u[2]),'P0001','Account is not active'),
    (format('select public.decide_squad_application(%L,''ACCEPTED'')',pending_id),'42501','Account is not active'),
    (format('select public.transfer_squad_leadership(%L,%L)',v_squad_id,u[2]),'42501','An active Student leader is required'),
    (format('select public.close_active_season(%L)',season_id),'P0001','Admin permission required')
  ) as cases(sql,code,message) loop
    begin
      execute test_case.sql;
      raise exception using errcode='ZX999',message='Suspended RPC succeeded';
    exception when others then
      if sqlstate<>test_case.code or sqlerrm<>test_case.message then raise; end if;
    end;
  end loop;
  perform set_config('role',owner_role,true);
  perform set_config('nexus.internal','1',true);
  update public.profiles set status_akun='ACTIVE' where user_id=u[1];
  perform set_config('nexus.internal','',true);
  -- Denied calls left the protected fixtures untouched.
  if not exists(select 1 from public.squad_applications where application_id=pending_id and status_application='PENDING')
    or not exists(select 1 from public.squad_members sm where sm.squad_id=v_squad_id and user_id=u[2] and status_member='ACTIVE') then
    raise exception 'Denied RPC changed protected state'; end if;
  perform set_config('role','authenticated',true);

  -- Successful calls restore both ordinary and nested caller settings.
  perform set_config('nexus.internal','qa-sentinel',true);
  perform public.kick_squad_member(v_squad_id,u[2],'QA authorized kick');
  if current_setting('nexus.internal',true)<>'qa-sentinel' then
    raise exception 'kick_squad_member leaked internal mode'; end if;
  perform set_config('nexus.internal','',true);
  perform public.decide_squad_application(pending_id,'ACCEPTED');
  perform public.finalize_squad(v_squad_id);
  if coalesce(current_setting('nexus.internal',true),'')<>'' then
    raise exception 'finalize_squad leaked internal mode'; end if;
  begin
    update public.squads set status_squad='MISSION_COMPLETED' where squads.squad_id=v_squad_id;
    raise exception using errcode='ZX999',message='Post-RPC guard bypass succeeded';
  exception when raise_exception then
    if sqlerrm<>'MISSION_COMPLETED may only be set by approved Mission Result processing' then raise; end if;
  end;
  perform set_config('role',owner_role,true);
  if not exists(select 1 from public.squads s where s.squad_id=v_squad_id and status_squad='FINALIZED')
    or not exists(select 1 from public.squad_members sm where sm.squad_id=v_squad_id and user_id=u[2] and status_member='KICKED') then
    raise exception 'Authorized operations did not persist within test transaction'; end if;
end;
$test$;
rollback;
select 'PASS: member/foreign-leader/admin/suspended RPC boundaries; authorized kick/finalize; internal flag restored; all fixtures rolled back' as result;
