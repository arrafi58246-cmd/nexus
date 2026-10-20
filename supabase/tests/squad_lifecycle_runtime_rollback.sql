-- Owner-only QA using four dedicated "Mahasiswa Test NEXUS%" profiles.
-- Exercises actual RPCs as authenticated, with fresh Mission fixtures only.
-- SQL role/JWT simulation is NOT an Auth login or browser E2E test.
-- Every fixture, application, member and notification is rolled back.
begin;
set local statement_timeout = '30s';
do $test$
declare
  v_owner text := current_setting('role');
  u uuid[];
  c bigint;
  m public.missions%rowtype;
  ma uuid;
  mb uuid;
  sa uuid;
  sb uuid;
  sc uuid;
  sd uuid;
  a1 uuid;
  a2 uuid;
  a3 uuid;
  a4 uuid;
  ax uuid;
  requirements jsonb;
  member_ids jsonb;
begin
  select array_agg(user_id order by nama_lengkap) into u from
    (select user_id,nama_lengkap from public.profiles
     where role_app='STUDENT' and status_akun='ACTIVE' and primary_class_id is not null
       and nama_lengkap like 'Mahasiswa Test NEXUS%'
     order by nama_lengkap limit 4) q;
  if coalesce(array_length(u,1),0) <> 4 then
    raise exception 'Requires four dedicated active/onboarded QA Student profiles';
  end if;
  select primary_class_id into c from public.primary_classes order by primary_class_id limit 1;
  requirements := jsonb_build_array(jsonb_build_object('primary_class_id',c,'slot_dibutuhkan',1));
  select * into m from public.missions order by mission_id limit 1;
  if m.mission_id is null then raise exception 'Requires a Mission template'; end if;
  m.mission_id := gen_random_uuid(); m.source_submission_id := null;
  m.nama_lomba := 'QA SQUAD LIFECYCLE '||m.mission_id; m.tahun_lomba := extract(year from now());
  m.deadline_pendaftaran := now()+interval '1 day'; m.deadline_lomba := now()+interval '2 days';
  m.min_anggota_tim := 2; m.max_anggota_tim := 2;
  insert into public.missions select (m).*; ma := m.mission_id;
  m.mission_id := gen_random_uuid(); m.nama_lomba := 'QA SQUAD LIFECYCLE OTHER '||m.mission_id;
  insert into public.missions select (m).*; mb := m.mission_id;

  if has_function_privilege('anon','public.transfer_squad_leadership(uuid,uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.transfer_squad_leadership(uuid,uuid)','EXECUTE') then
    raise exception 'Transfer RPC privileges invalid';
  end if;

  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  sa := public.create_squad(ma,'QA A','QA',2::smallint,requirements);
  sb := public.create_squad(mb,'QA other Mission','QA',2::smallint,requirements);

  perform set_config('request.jwt.claim.sub',u[2]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[2],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  sc := public.create_squad(ma,'QA C','QA',2::smallint,requirements);

  perform set_config('request.jwt.claim.sub',u[3]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[3],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  a1 := public.submit_squad_application(sa);
  a2 := public.submit_squad_application(sc);
  a3 := public.submit_squad_application(sb);

  perform set_config('request.jwt.claim.sub',u[4]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[4],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  a4 := public.submit_squad_application(sc);

  perform set_config('request.jwt.claim.sub',u[3]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[3],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  begin
    perform public.create_squad(ma,'QA invalid','QA',2::smallint,jsonb_build_array(jsonb_build_object('primary_class_id',c,'slot_dibutuhkan',2)));
    raise exception using errcode='ZX999',message='Expected rejection: Total requirement slots must equal Squad capacity minus one';
  exception when sqlstate 'ZX999' then raise;
    when others then if sqlerrm <> 'Total requirement slots must equal Squad capacity minus one' then raise; end if;
  end;

  -- LOCAL_CREATE_FAILURE_INJECTION

  perform set_config('role',v_owner,true);

  if (select count(*) from public.squads where mission_id=ma)<>2
    or (select count(*) from public.squad_applications where application_id in(a1,a2,a3) and status_application='PENDING')<>3 then
    raise exception 'Failed Create changed existing applications or left a Squad';
  end if;

  perform set_config('request.jwt.claim.sub',u[3]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[3],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  sd := public.create_squad(ma,'QA created with Pending','QA',2::smallint,requirements);

  perform set_config('role',v_owner,true);

  if (select count(*) from public.squad_applications where application_id in(a1,a2)
      and status_application='CANCELLED' and decided_at is not null and decided_by is null)<>2
    or (select count(*) from public.squad_applications where application_id in(a3,a4) and status_application='PENDING')<>2
    or (select count(*) from public.squad_members where squad_id=sd and user_id=u[3]
      and role_squad='KETUA' and status_member='ACTIVE')<>1
    or (select count(*) from public.squad_requirements where squad_id=sd)<>1 then
    raise exception 'Create cancellation scope, leader or requirements incorrect';
  end if;
  if public.nexus_internal_mode() then raise exception 'Create leaked internal mode'; end if;

  perform set_config('request.jwt.claim.sub',u[4]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[4],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  ax := public.submit_squad_application(sd);

  perform set_config('request.jwt.claim.sub',u[3]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[3],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  perform public.decide_squad_application(ax,'ACCEPTED');
  -- Existing decide RPC leaves/restores its own mode; force ordinary request boundary.
  perform set_config('nexus.internal','',true);

  begin
    perform public.leave_squad(sd);
    raise exception using errcode='ZX999',message='Expected rejection: Transfer leadership to another active member before leaving';
  exception when sqlstate 'ZX999' then raise;
    when others then if sqlerrm <> 'Transfer leadership to another active member before leaving' then raise; end if;
  end;

  begin
    perform public.transfer_squad_leadership(sd,u[3]);
    raise exception using errcode='ZX999',message='Expected rejection: A different active member is required';
  exception when sqlstate 'ZX999' then raise;
    when others then if sqlerrm <> 'A different active member is required' then raise; end if;
  end;

  begin
    perform public.transfer_squad_leadership(sd,u[2]);
    raise exception using errcode='ZX999',message='Expected rejection: The successor must be an active Student member';
  exception when sqlstate 'ZX999' then raise;
    when others then if sqlerrm <> 'The successor must be an active Student member' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',u[4]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[4],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  begin
    perform public.transfer_squad_leadership(sd,u[3]);
    raise exception using errcode='ZX999',message='Expected rejection: Only the current Squad leader can transfer leadership';
  exception when sqlstate 'ZX999' then raise;
    when others then if sqlerrm <> 'Only the current Squad leader can transfer leadership' then raise; end if;
  end;

  perform set_config('role',v_owner,true);

  select jsonb_agg(squad_member_id order by squad_member_id) into member_ids from public.squad_members where squad_id=sd;

  perform set_config('request.jwt.claim.sub',u[3]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[3],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  -- LOCAL_TRANSFER_FAILURE_INJECTION
  -- LOCAL_SUSPENDED_SUCCESSOR_TEST
  perform public.transfer_squad_leadership(sd,u[4]);

  perform set_config('role',v_owner,true);

  if (select ketua_id from public.squads where squad_id=sd)<>u[4]
    or (select status_squad from public.squads where squad_id=sd)<>'FULL'
    or (select count(*) from public.squad_members where squad_id=sd and status_member='ACTIVE')<>2
    or (select count(*) from public.squad_members where squad_id=sd and status_member='ACTIVE' and role_squad='KETUA')<>1
    or not exists(select 1 from public.squad_members where squad_id=sd and user_id=u[3] and role_squad='ANGGOTA' and status_member='ACTIVE')
    or member_ids is distinct from (select jsonb_agg(squad_member_id order by squad_member_id) from public.squad_members where squad_id=sd) then
    raise exception 'Transfer ownership, roles, count or membership history incorrect';
  end if;
  if public.nexus_internal_mode() then raise exception 'Transfer leaked internal mode'; end if;

  perform set_config('request.jwt.claim.sub',u[3]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[3],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  begin
    perform public.transfer_squad_leadership(sd,u[1]);
    raise exception using errcode='ZX999',message='Expected rejection: Only the current Squad leader can transfer leadership';
  exception when sqlstate 'ZX999' then raise;
    when others then if sqlerrm <> 'Only the current Squad leader can transfer leadership' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',u[4]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[4],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  -- Savepoint: finalize blocks transfer and leave, then restore OPEN/FULL.
  begin
    perform public.finalize_squad(sd);
    perform set_config('nexus.internal','',true);

  begin
    perform public.transfer_squad_leadership(sd,u[3]);
    raise exception using errcode='ZX999',message='Expected rejection: Leadership cannot change after finalization';
  exception when sqlstate 'ZX999' then raise;
    when others then if sqlerrm <> 'Leadership cannot change after finalization' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',u[3]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[3],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  begin
    perform public.leave_squad(sd);
    raise exception using errcode='ZX999',message='Expected rejection: Members cannot leave after the Squad is Finalized';
  exception when sqlstate 'ZX999' then raise;
    when others then if sqlerrm <> 'Members cannot leave after the Squad is Finalized' then raise; end if;
  end;

    raise exception using errcode='ZX001',message='Restore pre-finalization state';
  exception when sqlstate 'ZX001' then null; end;

  perform set_config('request.jwt.claim.sub',u[3]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[3],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  perform public.leave_squad(sd);

  perform set_config('role',v_owner,true);

  if not exists(select 1 from public.squad_members where squad_id=sd and user_id=u[3]
      and status_member='LEFT' and ended_at is not null)
    or not exists(select 1 from public.squads where squad_id=sd and ketua_id=u[4] and status_squad='OPEN_RECRUITMENT')
    or (select count(*) from public.squad_members where squad_id=sd and status_member='ACTIVE')<>1 then
    raise exception 'Former leader leave did not preserve remaining leader/history';
  end if;
  if public.nexus_internal_mode() then raise exception 'Leave leaked internal mode'; end if;

  perform set_config('request.jwt.claim.sub',u[4]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[4],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  begin
    perform public.leave_squad(sd);
    raise exception using errcode='ZX999',message='Expected rejection: Transfer leadership to another active member before leaving';
  exception when sqlstate 'ZX999' then raise;
    when others then if sqlerrm <> 'Transfer leadership to another active member before leaving' then raise; end if;
  end;

  begin
    perform public.transfer_squad_leadership(sd,u[3]);
    raise exception using errcode='ZX999',message='Expected rejection: The successor must be an active Student member';
  exception when sqlstate 'ZX999' then raise;
    when others then if sqlerrm <> 'The successor must be an active Student member' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);

  begin
    perform public.transfer_squad_leadership(sd,u[3]);
    raise exception using errcode='ZX999',message='Expected rejection: Not authorized';
  exception when sqlstate 'ZX999' then raise;
    when others then if sqlerrm <> 'Not authorized' then raise; end if;
  end;

  perform set_config('role',v_owner,true);

  raise notice 'PASS: Create rollback/scope, transfer permissions/roles, finalized guards, former-leader leave, history and internal-mode restoration';
end;
$test$;
rollback;
select 'PASS: Squad lifecycle RPC regression, all fixtures rolled back' as result;
