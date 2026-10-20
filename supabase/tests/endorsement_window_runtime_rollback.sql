-- Dedicated QA students only; all fixture writes roll back. No Auth/browser claim.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
do $test$
declare
  owner_role text := current_setting('role');
  u uuid[];
  c bigint;
  m public.missions%rowtype;
  sid uuid;
  aid uuid;
  elapsed interval;
  old_flag text;
begin
  select array_agg(user_id order by nama_lengkap) into u from (
    select user_id,nama_lengkap from public.profiles where role_app='STUDENT'
      and status_akun='ACTIVE' and primary_class_id is not null
      and nama_lengkap like 'Mahasiswa Test NEXUS%' order by nama_lengkap limit 2
  ) q;
  if coalesce(array_length(u,1),0)<>2 then raise exception 'Requires two dedicated QA students';end if;
  select primary_class_id into c from public.profiles where user_id=u[2];
  select * into m from public.missions order by mission_id limit 1;
  if m.mission_id is null then raise exception 'Requires a Mission template';end if;
  m.mission_id:=gen_random_uuid();m.source_submission_id:=null;
  m.nama_lomba:='QA ENDORSEMENT WINDOW '||m.mission_id;
  m.deadline_pendaftaran:=now()+interval '1 day';m.deadline_lomba:=now()+interval '2 days';
  m.min_anggota_tim:=2;m.max_anggota_tim:=2;
  insert into public.missions select (m).*;
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  sid:=public.create_squad(m.mission_id,'QA ENDORSEMENT '||m.mission_id,'QA',2::smallint,
    jsonb_build_array(jsonb_build_object('primary_class_id',c,'slot_dibutuhkan',1)));
  perform set_config('request.jwt.claim.sub',u[2]::text,true);
  aid:=public.submit_squad_application(sid);
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform public.decide_squad_application(aid,'ACCEPTED');
  perform public.finalize_squad(sid);
  perform set_config('role',owner_role,true);
  old_flag:=current_setting('nexus.internal',true);
  perform set_config('nexus.internal','1',true);
  -- Fixture completion only: no approved result, XP, badge or approval notification.
  update public.squads set status_squad='MISSION_COMPLETED',completed_at=clock_timestamp()
    where squad_id=sid;
  perform set_config('nexus.internal',coalesce(old_flag,''),true);
  perform set_config('role','authenticated',true);
  insert into public.endorsements(squad_id,from_user_id,to_user_id,communication,contribution,teamwork,responsibility)
    values(sid,u[2],u[2],4,4,4,4);
  if not exists(select 1 from public.endorsements where squad_id=sid and from_user_id=u[1] and to_user_id=u[2])
    then raise exception 'Sender identity was not enforced';end if;
  begin
    insert into public.endorsements(squad_id,from_user_id,to_user_id,communication,contribution,teamwork,responsibility)
      values(sid,u[1],u[2],4,4,4,4);
    raise exception using errcode='ZX999',message='Duplicate rating allowed';
  exception when unique_violation then null;end;

  foreach elapsed in array array[interval '336 hours',interval '337 hours',interval '-1 hour'] loop
    perform set_config('role',owner_role,true);
    perform set_config('nexus.internal','1',true);
    update public.squads set completed_at=clock_timestamp()-elapsed where squad_id=sid;
    perform set_config('nexus.internal',coalesce(old_flag,''),true);
    perform set_config('role','authenticated',true);
    begin
      insert into public.endorsements(squad_id,from_user_id,to_user_id,communication,contribution,teamwork,responsibility)
        values(sid,u[1],u[2],4,4,4,4);
      raise exception using errcode='ZX999',message='Expired or future completion accepted';
    exception when sqlstate 'P0001' then
      if sqlerrm<>'Endorsement window is closed' then raise;end if;end;
  end loop;
  if (select count(*) from public.endorsements where squad_id=sid)<>1 then
    raise exception 'Rejected writes changed the existing rating';end if;
  perform set_config('role',owner_role,true);
end $test$;
rollback;
select 'PASS: real guards/RLS, open window, sender ownership, duplicate, exact/expired/future cutoff; fixtures rolled back' as result;
