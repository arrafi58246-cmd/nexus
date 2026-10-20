-- Owner-run fixtures using existing dedicated QA students. Every change rolls back.
-- SQL role/JWT simulation exercises DB guards, not Auth/browser login.
begin;
set local statement_timeout='30s';
do $test$
declare
  owner_role text := current_setting('role');
  u uuid[];
  c bigint;
  m public.missions%rowtype;
  ma uuid;
  sa uuid;
  sb uuid;
  fresh uuid;
  a1 uuid;
  a2 uuid;
  a3 uuid;
  req jsonb;
  notif_count bigint;
begin
  select array_agg(user_id order by nama_lengkap) into u from (
    select user_id,nama_lengkap from public.profiles where role_app='STUDENT' and status_akun='ACTIVE'
      and primary_class_id is not null and nama_lengkap like 'Mahasiswa Test NEXUS%'
    order by nama_lengkap limit 4) q;
  if coalesce(array_length(u,1),0)<>4 then raise exception 'Requires four dedicated active QA students'; end if;
  select primary_class_id into c from public.primary_classes order by primary_class_id limit 1;
  req:=jsonb_build_array(jsonb_build_object('primary_class_id',c,'slot_dibutuhkan',1));
  select * into m from public.missions order by mission_id limit 1;
  if m.mission_id is null then raise exception 'Requires a Mission template'; end if;
  m.mission_id:=gen_random_uuid();m.source_submission_id:=null;
  m.nama_lomba:='QA SOLO DISBAND '||m.mission_id;m.tahun_lomba:=extract(year from now());
  m.deadline_pendaftaran:=now()+interval '1 day';m.deadline_lomba:=now()+interval '2 days';
  m.min_anggota_tim:=2;m.max_anggota_tim:=2;
  insert into public.missions select (m).*;ma:=m.mission_id;
  if has_function_privilege('anon','public.disband_solo_squad(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.disband_solo_squad(uuid)','EXECUTE') then
    raise exception 'Disband ACL incorrect';end if;
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  sa:=public.create_squad(ma,'QA SOLO '||ma,'QA',2::smallint,req);
  insert into public.squad_messages(squad_id,sender_id,content) values(sa,u[1],'QA retained chat');
  perform set_config('request.jwt.claim.sub',u[2]::text,true);
  sb:=public.create_squad(ma,'QA OTHER '||ma,'QA',2::smallint,req);
  begin perform public.disband_solo_squad(sa);raise exception using errcode='ZX999',message='Nonleader disbanded';
  exception when sqlstate '42501' then null;end;
  perform set_config('request.jwt.claim.sub',u[3]::text,true);
  a1:=public.submit_squad_application(sa);a3:=public.submit_squad_application(sb);
  perform set_config('request.jwt.claim.sub',u[4]::text,true);
  a2:=public.submit_squad_application(sa);
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  begin update public.squads set status_squad='DISBANDED' where squad_id=sa;
    raise exception using errcode='ZX999',message='Direct disband allowed';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'Disbanded state is managed only by the solo disband RPC' then raise;end if;end;

  -- LOCAL_DISBAND_FAILURE_INJECTION

  perform public.disband_solo_squad(sa);
  if public.nexus_internal_mode() then raise exception 'Internal mode leaked';end if;
  perform set_config('role',owner_role,true);
  if not exists(select 1 from public.squads where squad_id=sa and status_squad='DISBANDED'
    and disbanded_at is not null and disbanded_by=u[1] and completed_at is null)
    or (select count(*) from public.squad_members where squad_id=sa and status_member='ACTIVE')<>0
    or not exists(select 1 from public.squad_members where squad_id=sa and user_id=u[1]
      and status_member='LEFT' and ended_at is not null and removed_by=u[1]) then
    raise exception 'Disband state/history incorrect';end if;
  if (select count(*) from public.squad_applications where application_id in(a1,a2)
      and status_application='CANCELLED' and decided_by=u[1] and decided_at is not null)<>2
    or (select status_application from public.squad_applications where application_id=a3)<>'PENDING' then
    raise exception 'Cancellation escaped target Squad';end if;
  select count(*) into notif_count from public.notifications
    where notification_type='SQUAD_DISBANDED' and body like '%'||ma::text||'%' and user_id in(u[3],u[4]);
  if notif_count<>2 then raise exception 'Pelamar notifications incorrect';end if;
  if (select count(*) from public.squad_requirements where squad_id=sa)<>1
    or (select count(*) from public.squad_messages where squad_id=sa)<>1 then
    raise exception 'Retained requirements/chat lost';end if;
  begin update public.squad_members set status_member='ACTIVE',ended_at=null where squad_id=sa;
    raise exception using errcode='ZX999',message='Closed membership reactivated';
  exception when sqlstate '22023' then null;end;
  begin update public.squads set status_squad='OPEN_RECRUITMENT',disbanded_at=null,disbanded_by=null where squad_id=sa;
    raise exception using errcode='ZX999',message='Squad reopened directly';
  exception when sqlstate 'P0001' then null;end;
  perform set_config('role','authenticated',true);
  perform public.disband_solo_squad(sa);
  begin perform public.get_squad_room_members(sa);raise exception using errcode='ZX999',message='Chat room remained open';
  exception when sqlstate '42501' then null;end;
  begin insert into public.squad_messages(squad_id,sender_id,content) values(sa,u[1],'QA blocked');
    raise exception using errcode='ZX999',message='Closed chat allowed write';
  exception when sqlstate '42501' then null;end;
  fresh:=public.create_squad(ma,'QA RECREATE '||ma,'QA',2::smallint,req);
  perform set_config('request.jwt.claim.sub',u[3]::text,true);
  begin perform public.submit_squad_application(sa);raise exception using errcode='ZX999',message='Closed recruitment allowed';
  exception when sqlstate 'P0001' then null;end;
  perform set_config('request.jwt.claim.sub',u[2]::text,true);
  perform public.decide_squad_application(a3,'ACCEPTED');
  begin perform public.disband_solo_squad(sb);raise exception using errcode='ZX999',message='Non-solo allowed';
  exception when sqlstate '22023' then
    if sqlerrm<>'Only a solo active leader can disband' then raise;end if;end;
  perform public.finalize_squad(sb);
  begin perform public.disband_solo_squad(sb);raise exception using errcode='ZX999',message='Finalized allowed';
  exception when sqlstate '22023' then null;end;
  perform set_config('role',owner_role,true);
  if (select count(*) from public.notifications where notification_type='SQUAD_DISBANDED'
    and body like '%'||ma::text||'%')<>notif_count then raise exception 'Retry duplicated notifications';end if;
  if exists(select 1 from public.xp_transactions where mission_result_submission_id in
    (select result_submission_id from public.mission_result_submissions where squad_id in(sa,sb,fresh))) then
    raise exception 'Unexpected XP';end if;
end;
$test$;
select 'PASS: solo disband state, scope, notifications/history, idempotence and deny cases; fixtures rolled back' result;
rollback;
