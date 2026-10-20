-- Owner-only QA. All temporary certificates, sources, credits, badges and snapshots ROLLBACK.
begin;
do $test$
declare
  v_role text := current_setting('role');
  v_admin uuid;
  v_student uuid;
  v_member uuid;
  v_season public.seasons%rowtype;
  v_next uuid;
  v_claim uuid := gen_random_uuid();
  v_late uuid := gen_random_uuid();
  v_result uuid := gen_random_uuid();
  v_squad uuid := gen_random_uuid();
  v_mission public.missions%rowtype;
  v_path text;
  v_tier bigint;
  v_xp integer;
  v_verified integer;
  v_before timestamptz;
  v_old_ledger jsonb;
  v_old_badges jsonb;
  v_snapshot jsonb;
  v_board jsonb;
  v_count integer;
begin
  select user_id into v_admin from public.profiles where role_app='ADMIN' and status_akun='ACTIVE' order by user_id limit 1;
  select user_id into v_student from public.profiles where role_app='STUDENT' and status_akun='ACTIVE' order by user_id limit 1;
  select user_id into v_member from public.profiles where role_app='STUDENT' and status_akun='ACTIVE' and user_id<>v_student order by user_id limit 1;
  select * into v_season from public.seasons where status_season='ACTIVE';
  select tier_id,legacy_xp,verified_xp into v_tier,v_xp,v_verified from public.xp_rules where hasil_kompetisi='PARTICIPANT' order by tier_id limit 1;
  if v_admin is null or v_student is null or v_member is null or v_season.season_id is null then raise exception 'Requires admin, two students and ACTIVE Season'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by xp_transaction_id),'[]') into v_old_ledger from public.xp_transactions x;
  select coalesce(jsonb_agg(to_jsonb(x) order by user_badge_id),'[]') into v_old_badges from public.user_badges x;

  -- Clients cannot invoke jobs, private cores, or inject an artificial clock.
  if has_schema_privilege('anon','nexus_private','USAGE')
    or has_schema_privilege('authenticated','nexus_private','USAGE')
    or has_schema_privilege('service_role','nexus_private','USAGE')
    or has_function_privilege('authenticated','nexus_private.maintain_seasons(timestamptz)','EXECUTE')
    or has_function_privilege('anon','nexus_private.run_weekly_badges()','EXECUTE')
    or has_function_privilege('authenticated','public.guard_xp_transaction_source()','EXECUTE') then
    raise exception 'Private scheduler/trigger function exposed';
  end if;
  perform set_config('request.jwt.claim.sub',v_student::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_student,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.close_active_season(v_season.season_id);
    raise exception 'Student closed Season';
  exception when raise_exception then if sqlerrm<>'Admin permission required' then raise; end if; end;
  begin
    perform nexus_private.maintain_seasons('2099-07-01+07');
    raise exception 'Student invoked private worker';
  exception when insufficient_privilege then null; end;
  perform set_config('role',v_role,true);

  -- Nested block is a rollback savepoint: simulate the real next July boundary,
  -- including a pre-created UPCOMING Season, without closing it persistently.
  begin
    if nexus_private.season_for_award(v_season.end_date,
      ((v_season.end_date+1)::timestamp at time zone 'Asia/Jakarta')-interval '1 microsecond')
      is distinct from v_season.season_id then raise exception 'Before-WIB-cutoff assignment failed'; end if;
    if nexus_private.season_for_award(v_season.end_date,
      (v_season.end_date+1)::timestamp at time zone 'Asia/Jakarta') is not null then
      raise exception 'At-WIB-cutoff old achievement received Seasonal XP';
    end if;
    if nexus_private.maintain_seasons(((v_season.end_date+1)::timestamp at time zone 'Asia/Jakarta')-interval '1 microsecond')
      is distinct from v_season.season_id then raise exception 'Premature closure'; end if;
    insert into public.seasons(nama_season,start_date,end_date,status_season)
      values ('QA upcoming '||gen_random_uuid(),v_season.end_date+1,(v_season.end_date+interval '1 year')::date,'UPCOMING')
      on conflict (start_date,end_date) do nothing;
    v_next:=nexus_private.maintain_seasons((v_season.end_date+1)::timestamp at time zone 'Asia/Jakarta');
    if v_next is null or v_next=v_season.season_id then raise exception 'Rollover failed'; end if;
    if (select status_season from public.seasons where season_id=v_season.season_id)<>'CLOSED'
      or (select count(*) from public.seasons where status_season='ACTIVE')<>1 then raise exception 'Rollover not atomic'; end if;
    if nexus_private.maintain_seasons((v_season.end_date+1)::timestamp at time zone 'Asia/Jakarta') is distinct from v_next then raise exception 'Rollover repeat failed'; end if;
    if nexus_private.season_for_award(v_season.end_date,(v_season.end_date+1)::timestamp at time zone 'Asia/Jakarta') is not null
      or nexus_private.season_for_award(v_season.end_date+1,(v_season.end_date+1)::timestamp at time zone 'Asia/Jakarta') is distinct from v_next then
      raise exception 'Old/new source assignment after rollover failed';
    end if;
    if (select count(*) from public.season_user_history where season_id=v_season.season_id)<>
      (select count(*) from public.profiles where role_app='STUDENT' and status_akun='ACTIVE') then raise exception 'Wrong snapshot population'; end if;
    raise exception using errcode='ZX001',message='Rollback simulated boundary';
  exception when sqlstate 'ZX001' then null; end;

  -- Real review-trigger path for an on-time Legacy achievement.
  v_path:=v_student||'/'||v_claim||'/'||gen_random_uuid()||'.pdf';
  insert into storage.objects(bucket_id,name,owner_id,metadata)
    values('achievement-certificates',v_path,v_student::text,'{"size":100,"mimetype":"application/pdf"}');
  perform set_config('role','authenticated',true);
  insert into public.achievement_claims(achievement_claim_id,user_id,nama_kompetisi,penyelenggara,achievement_date,submitted_tier_id,hasil_kompetisi,sertifikat_path,preview_xp)
    values(v_claim,v_student,'QA on-time','QA',(clock_timestamp() at time zone 'Asia/Jakarta')::date,v_tier,'PARTICIPANT',v_path,0);
  perform set_config('role',v_role,true);
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  v_before:=clock_timestamp();
  perform set_config('role','authenticated',true);
  update public.achievement_claims set status_validation='APPROVED',approved_tier_id=v_tier where achievement_claim_id=v_claim;
  perform set_config('role',v_role,true);
  if not exists(select 1 from public.xp_transactions where achievement_claim_id=v_claim and user_id=v_student and xp_amount=v_xp and season_id=v_season.season_id and created_at>=v_before) then raise exception 'On-time Legacy review failed'; end if;

  -- Prepare another claim and a two-member Mission Result BEFORE closing.
  perform set_config('request.jwt.claim.sub',v_student::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_student,'role','authenticated')::text,true);
  v_path:=v_student||'/'||v_late||'/'||gen_random_uuid()||'.pdf';
  insert into storage.objects(bucket_id,name,owner_id,metadata)
    values('achievement-certificates',v_path,v_student::text,'{"size":100,"mimetype":"application/pdf"}');
  perform set_config('role','authenticated',true);
  insert into public.achievement_claims(achievement_claim_id,user_id,nama_kompetisi,penyelenggara,achievement_date,submitted_tier_id,hasil_kompetisi,sertifikat_path,preview_xp)
    values(v_late,v_student,'QA late','QA',(clock_timestamp() at time zone 'Asia/Jakarta')::date,v_tier,'PARTICIPANT',v_path,0);
  perform set_config('role',v_role,true);
  select * into v_mission from public.missions order by mission_id limit 1;
  v_mission.mission_id:=gen_random_uuid(); v_mission.source_submission_id:=null;
  v_mission.nama_lomba:='QA late Mission'; v_mission.tier_id:=v_tier;
  v_mission.deadline_pendaftaran:=clock_timestamp()+interval '1 hour';
  v_mission.deadline_lomba:=clock_timestamp()+interval '2 hours';
  v_mission.min_anggota_tim:=2; v_mission.max_anggota_tim:=2;
  insert into public.missions select (v_mission).*;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  insert into public.squads(squad_id,mission_id,ketua_id,nama_squad,deskripsi_squad,kapasitas_anggota,status_squad,finalized_at)
    values(v_squad,v_mission.mission_id,v_student,'QA late Squad','QA',2,'FINALIZED',clock_timestamp());
  insert into public.squad_members(squad_id,mission_id,user_id,role_squad,status_member)
    values(v_squad,v_mission.mission_id,v_member,'ANGGOTA','ACTIVE');
  perform set_config('request.jwt.claim.sub',v_student::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_student,'role','authenticated')::text,true);
  v_path:=v_student||'/'||v_squad||'/'||gen_random_uuid()||'.pdf';
  insert into storage.objects(bucket_id,name,owner_id,metadata)
    values('mission-result-certificates',v_path,v_student::text,'{"size":100,"mimetype":"application/pdf"}');
  insert into public.mission_result_submissions(result_submission_id,squad_id,submitted_by,hasil_kompetisi,submitted_tier_id,sertifikat_path,preview_xp)
    values(v_result,v_squad,v_student,'PARTICIPANT',v_tier,v_path,0);

  -- Weekly worker needs no JWT; repeated runs do not duplicate awards.
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  perform nexus_private.run_weekly_badges();
  select count(*) into v_count from public.user_badges;
  if nexus_private.run_weekly_badges()<>0 or (select count(*) from public.user_badges)<>v_count then raise exception 'Weekly badges not idempotent'; end if;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.close_active_season(v_season.season_id);
  perform set_config('role',v_role,true);
  select jsonb_agg(to_jsonb(h) order by user_id) into v_snapshot from public.season_user_history h where season_id=v_season.season_id;
  select jsonb_agg(to_jsonb(h) order by scope_type,user_id) into v_board from public.season_leaderboard_history h where season_id=v_season.season_id;

  perform set_config('role','authenticated',true);
  update public.achievement_claims set status_validation='APPROVED',approved_tier_id=v_tier where achievement_claim_id=v_late;
  update public.mission_result_submissions set status_validation='APPROVED',approved_tier_id=v_tier,approved_hasil_kompetisi='PARTICIPANT' where result_submission_id=v_result;
  perform set_config('role',v_role,true);
  if not exists(select 1 from public.xp_transactions where achievement_claim_id=v_late and xp_amount=v_xp and season_id is null) then raise exception 'Late Legacy lost Career XP or altered Season'; end if;
  if (select count(*) from public.xp_transactions where mission_result_submission_id=v_result and xp_amount=v_verified and season_id is null and earned_at=(v_mission.deadline_lomba at time zone 'Asia/Jakarta')::date)<>2 then raise exception 'Late Verified result must credit both members Career-only'; end if;
  if (select status_squad from public.squads where squad_id=v_squad)<>'MISSION_COMPLETED' then raise exception 'Late Mission did not complete'; end if;
  if v_snapshot is distinct from (select jsonb_agg(to_jsonb(h) order by user_id) from public.season_user_history h where season_id=v_season.season_id)
    or v_board is distinct from (select jsonb_agg(to_jsonb(h) order by scope_type,user_id) from public.season_leaderboard_history h where season_id=v_season.season_id) then raise exception 'Late approval changed final snapshots'; end if;
  if exists(select 1 from jsonb_array_elements(v_old_ledger) b where not exists(select 1 from public.xp_transactions x where to_jsonb(x)=b))
    or exists(select 1 from jsonb_array_elements(v_old_badges) b where not exists(select 1 from public.user_badges x where to_jsonb(x)=b)) then raise exception 'Historical ledger/badges altered'; end if;
  begin
    perform public.close_active_season(v_season.season_id);
    raise exception 'Closed Season reopened/snapshotted';
  exception when raise_exception then if sqlerrm<>'Only the ACTIVE season can be closed' then raise; end if; end;
  raise notice 'PASS: WIB boundary, rollover, permissions, weekly idempotence, real Legacy/Verified late approval, immutable snapshots and historical ledger/badges';
end;
$test$;
rollback;
select 'PASS: Season automation runtime fixtures rolled back' as result;
