-- Run as project postgres in one session. Dedicated QA students and new fixture
-- only; no Auth login, approved result or XP is created. Every write rolls back.
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
  final_at timestamptz;
  scenario text;
  allowed boolean;
  sender uuid;
  receiver uuid;
  actual boolean;
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
  m.nama_lomba:='QA FINALIZED ROSTER '||m.mission_id;
  m.deadline_pendaftaran:=now()+interval '1 day';m.deadline_lomba:=now()+interval '2 days';
  m.min_anggota_tim:=2;m.max_anggota_tim:=2;
  insert into public.missions select (m).*;
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  sid:=public.create_squad(m.mission_id,'QA FINAL ROSTER '||m.mission_id,'QA',2::smallint,
    jsonb_build_array(jsonb_build_object('primary_class_id',c,'slot_dibutuhkan',1)));
  perform set_config('request.jwt.claim.sub',u[2]::text,true);
  aid:=public.submit_squad_application(sid);
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform public.decide_squad_application(aid,'ACCEPTED');
  perform public.finalize_squad(sid);
  begin
    update public.squads set finalized_at=finalized_at-interval '1 hour' where squad_id=sid;
    raise exception using errcode='ZX999',message='Leader rewrote the finalization anchor';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'finalized_at is managed by Squad finalization' then raise;end if;end;
  update public.squads set finalized_at=finalized_at where squad_id=sid;
  if (select count(*) from public.finalized_squad_members where squad_id=sid)<>2 then
    raise exception 'Actual finalize did not expose both final participants';end if;
  begin
    insert into public.endorsements(squad_id,from_user_id,to_user_id,communication,contribution,teamwork,responsibility)
      values(sid,u[1],u[2],4,4,4,4);
    raise exception using errcode='ZX999',message='Rating allowed before completion';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'Endorsements are allowed only after Mission Completed' then raise;end if;end;
  perform set_config('role',owner_role,true);
  perform set_config('nexus.internal','1',true);
  update public.squads set status_squad='MISSION_COMPLETED',completed_at=clock_timestamp() where squad_id=sid;
  select finalized_at into final_at from public.squads where squad_id=sid;
  perform set_config('nexus.internal','',true);

  foreach scenario in array array['ACTIVE','LEFT_BEFORE','LEFT_EXACT','KICKED_BEFORE','JOINED_LATE','REMOVED_AFTER','REJOINED'] loop
    allowed:=scenario in ('ACTIVE','REMOVED_AFTER','REJOINED');
    update public.squad_members set
      joined_at=case when scenario='JOINED_LATE' then final_at+interval '1 microsecond'
        when scenario in ('LEFT_BEFORE','LEFT_EXACT','KICKED_BEFORE') then final_at-interval '1 hour' else final_at end,
      ended_at=case when scenario in ('LEFT_BEFORE','KICKED_BEFORE') then final_at-interval '1 microsecond'
        when scenario='LEFT_EXACT' then final_at
        when scenario='REMOVED_AFTER' then final_at+interval '1 microsecond' else null end,
      status_member=case when scenario in ('LEFT_BEFORE','LEFT_EXACT') then 'LEFT'::public.member_status_enum
        when scenario='KICKED_BEFORE' then 'KICKED'::public.member_status_enum
        when scenario='REMOVED_AFTER' then 'ADMIN_REMOVED'::public.member_status_enum
        else 'ACTIVE'::public.member_status_enum end
      where squad_id=sid and user_id=u[2];
    -- A previous membership period must not contaminate a later valid rejoin.
    if scenario='REJOINED' then
      insert into public.squad_members(squad_id,mission_id,user_id,role_squad,status_member,joined_at,ended_at)
      values(sid,m.mission_id,u[2],'ANGGOTA','LEFT',final_at-interval '2 hours',final_at-interval '1 hour');
    end if;
    perform set_config('role','authenticated',true);
    if exists(select 1 from public.finalized_squad_members where squad_id=sid and user_id=u[2])<>allowed then
      raise exception 'Roster mismatch: %',scenario;end if;
    -- Check both sender and recipient; forging from_user_id must not bypass it.
    foreach sender in array u loop
      receiver:=case when sender=u[1] then u[2] else u[1] end;
      perform set_config('request.jwt.claim.sub',sender::text,true);
      actual:=false;
      begin
        insert into public.endorsements(squad_id,from_user_id,to_user_id,communication,contribution,teamwork,responsibility)
          values(sid,receiver,receiver,4,4,4,4);
        actual:=true;
      exception when sqlstate 'P0001' then
        if sqlerrm<>'Both users must be members at Squad finalization' then raise;end if;end;
      if actual<>allowed then raise exception 'Write mismatch: %, %',scenario,sender;end if;
    end loop;
    perform set_config('role',owner_role,true);
    delete from public.endorsements where squad_id=sid;
  end loop;
  if not exists(select 1 from pg_class where oid='public.finalized_squad_members'::regclass
    and reloptions @> array['security_invoker=true']) then raise exception 'View must obey underlying RLS';end if;
  if has_table_privilege('anon','public.finalized_squad_members','SELECT')
    or has_table_privilege('authenticated','public.finalized_squad_members','INSERT,UPDATE,DELETE') then
    raise exception 'View grants are too broad';end if;
  perform set_config('role','anon',true);
  begin
    perform 1 from public.finalized_squad_members limit 1;
    raise exception using errcode='ZX999',message='Anonymous roster access allowed';
  exception when insufficient_privilege then null;end;
  perform set_config('role',owner_role,true);
end $test$;
rollback;
select 'PASS: finalize roster, before/exact exit, late join, post-finalization removal, rejoin, sender/recipient guard and view ACL; rolled back' as result;
