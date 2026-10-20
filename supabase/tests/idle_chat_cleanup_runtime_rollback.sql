-- Owner-only regression. All fixture/chat cleanup mutations ROLLBACK.
begin;
do $$
declare
  v_student uuid;
  v_template public.missions%rowtype;
  v_mission public.missions%rowtype;
  v_squad uuid;
  v_ids uuid[] := '{}';
  v_run timestamptz;
  v_before timestamptz;
  v_path text;
  v_result uuid;
  v_tier bigint;
  v_mode text := current_setting('nexus.internal',true);
  v_ledger jsonb;
  v_badges jsonb;
  v_histories jsonb;
  v_members integer;
  v_role text := current_setting('role');
begin
  select user_id into v_student from public.profiles
    where role_app='STUDENT' and status_akun='ACTIVE' order by user_id limit 1;
  select * into v_template from public.missions order by mission_id limit 1;
  if v_student is null or v_template.mission_id is null then raise exception 'Need student and Mission template'; end if;
  select tier_id into v_tier from public.xp_rules where hasil_kompetisi='PARTICIPANT' order by tier_id limit 1;
  select coalesce(jsonb_agg(to_jsonb(x) order by xp_transaction_id),'[]') into v_ledger from public.xp_transactions x;
  select coalesce(jsonb_agg(to_jsonb(x) order by user_badge_id),'[]') into v_badges from public.user_badges x;
  select jsonb_build_object('user',(select jsonb_agg(to_jsonb(x)) from public.season_user_history x),
    'board',(select jsonb_agg(to_jsonb(x)) from public.season_leaderboard_history x)) into v_histories;
  if has_schema_privilege('authenticated','nexus_private','USAGE')
    or has_function_privilege('anon','nexus_private.cleanup_idle_squad_chat(timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','nexus_private.touch_squad_activity()','EXECUTE') then
    raise exception 'Private cleanup/activity function exposed';
  end if;
  perform set_config('request.jwt.claim.sub',v_student::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_student,'role','authenticated')::text,true);
  for i in 1..5 loop
    v_mission:=v_template;v_mission.mission_id:=gen_random_uuid();v_mission.source_submission_id:=null;
    v_mission.nama_lomba:='QA cleanup '||v_mission.mission_id;
    v_mission.deadline_pendaftaran:=clock_timestamp()+interval '1 hour';
    v_mission.deadline_lomba:=clock_timestamp()+interval '2 hours';
    v_mission.min_anggota_tim:=2;v_mission.max_anggota_tim:=2;v_mission.tier_id:=v_tier;
    insert into public.missions select (v_mission).*;
    v_squad:=gen_random_uuid();v_ids:=array_append(v_ids,v_squad);
    insert into public.squads(squad_id,mission_id,ketua_id,nama_squad,deskripsi_squad,kapasitas_anggota)
      values(v_squad,v_mission.mission_id,v_student,'QA cleanup '||i,'QA',2);
    insert into public.squad_messages(squad_id,sender_id,content) values(v_squad,v_student,'QA synthetic message');
    if i=4 then
      -- Pending result must protect even an idle FINALIZED Squad.
      perform set_config('nexus.internal','1',true);
      update public.squads set status_squad='FINALIZED',finalized_at=clock_timestamp() where squad_id=v_squad;
      perform set_config('nexus.internal',coalesce(v_mode,''),true);
      v_result:=gen_random_uuid();v_path:=v_student||'/'||v_squad||'/'||v_result||'.pdf';
      insert into storage.objects(bucket_id,name,owner_id,metadata)
        values('mission-result-certificates',v_path,v_student::text,'{"size":100,"mimetype":"application/pdf"}');
      insert into public.mission_result_submissions(result_submission_id,squad_id,submitted_by,hasil_kompetisi,
        submitted_tier_id,sertifikat_path,preview_xp)
        values(v_result,v_squad,v_student,'PARTICIPANT',v_tier,v_path,0);
    end if;
  end loop;
  select count(*) into v_members from public.squad_members where squad_id=any(v_ids);
  v_run:=clock_timestamp();
  perform set_config('nexus.internal','1',true);
  update public.squads set last_activity_at=case when squad_id=v_ids[2] then v_run-interval '720 hours'
    when squad_id=v_ids[3] then v_run-interval '719 hours' else v_run-interval '721 hours' end
    where squad_id=any(v_ids);
  perform set_config('nexus.internal',coalesce(v_mode,''),true);
  -- Direct timestamp-only edits do not fake activity.
  update public.squads set last_activity_at=clock_timestamp() where squad_id=v_ids[1];
  if (select last_activity_at from public.squads where squad_id=v_ids[1])<>v_run-interval '721 hours' then
    raise exception 'Timestamp-only write spoofed activity'; end if;
  v_before:=clock_timestamp();
  insert into public.squad_messages(squad_id,sender_id,content) values(v_ids[5],v_student,'QA new activity');
  if (select last_activity_at from public.squads where squad_id=v_ids[5])<v_before then
    raise exception 'Chat did not touch activity'; end if;
  perform nexus_private.cleanup_idle_squad_chat(v_run);
  if exists(select 1 from public.squad_messages where squad_id=v_ids[1]) then raise exception 'Idle chat survived'; end if;
  if (select count(*) from public.squad_messages where squad_id=any(v_ids[2:5]))<>5 then
    raise exception 'Exact boundary/recent/pending/active chat wrongly deleted'; end if;
  if (select count(*) from public.squads where squad_id=any(v_ids))<>5
    or (select count(*) from public.squad_members where squad_id=any(v_ids))<>v_members
    or not exists(select 1 from public.mission_result_submissions where result_submission_id=v_result and status_validation='PENDING') then
    raise exception 'Cleanup damaged Squad/member/result records'; end if;
  if (select last_activity_at from public.squads where squad_id=v_ids[1])<>v_run-interval '721 hours' then
    raise exception 'Cleanup counted as activity'; end if;
  perform nexus_private.cleanup_idle_squad_chat(v_run);
  if (select count(*) from public.squad_messages where squad_id=any(v_ids[2:5]))<>5 then raise exception 'Repeat not idempotent'; end if;
  -- Real requirement/recruitment/member updates are activity; no-op updates are not.
  v_before:=clock_timestamp();
  update public.squad_members set removal_reason='QA change' where squad_id=v_ids[1];
  if (select last_activity_at from public.squads where squad_id=v_ids[1])<v_before then raise exception 'Membership activity missed'; end if;
  select last_activity_at into v_before from public.squads where squad_id=v_ids[1];
  update public.squad_members set removal_reason=removal_reason where squad_id=v_ids[1];
  if (select last_activity_at from public.squads where squad_id=v_ids[1])<>v_before then raise exception 'No-op counted as activity'; end if;
  if v_ledger is distinct from (select coalesce(jsonb_agg(to_jsonb(x) order by xp_transaction_id),'[]') from public.xp_transactions x)
    or v_badges is distinct from (select coalesce(jsonb_agg(to_jsonb(x) order by user_badge_id),'[]') from public.user_badges x)
    or v_histories is distinct from (select jsonb_build_object('user',(select jsonb_agg(to_jsonb(x)) from public.season_user_history x),
      'board',(select jsonb_agg(to_jsonb(x)) from public.season_leaderboard_history x))) then raise exception 'History/XP/badges changed'; end if;
  perform set_config('role','authenticated',true);
  begin
    perform nexus_private.cleanup_idle_squad_chat();
    raise exception 'Student invoked cleanup';
  exception when insufficient_privilege then null; end;
  perform set_config('role',v_role,true);
end;
$$;
rollback;
select 'PASS: idle chat cleanup fixtures rolled back' as result;
