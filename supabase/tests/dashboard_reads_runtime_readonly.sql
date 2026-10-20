-- Owner SQL Editor: evaluate dashboard SQL reads as each existing ACTIVE
-- STUDENT. No credentials are retrieved; this is SQL/RLS QA, not Auth/REST QA.
begin transaction isolation level repeatable read read only;

do $test$
declare
  student record;
  season_id_current uuid;
  expected_career integer;
  expected_seasonal integer;
  actual_xp integer;
  leaderboard_count integer;
  tested integer := 0;
begin
  select season_id into strict season_id_current from public.seasons
    where status_season='ACTIVE';
  for student in select user_id from public.profiles
    where role_app='STUDENT' and status_akun='ACTIVE' and primary_class_id is not null
  loop
    select coalesce(sum(xp_amount),0)::integer into expected_career
      from public.xp_transactions where user_id=student.user_id;
    select coalesce(sum(xp_amount),0)::integer into expected_seasonal
      from public.xp_transactions where user_id=student.user_id and season_id=season_id_current;

    perform set_config('request.jwt.claim.sub',student.user_id::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',student.user_id,'role','authenticated')::text,true);
    execute 'set local role authenticated';

    select career_xp into strict actual_xp from public.career_xp_totals where user_id=student.user_id;
    if actual_xp is distinct from expected_career then raise exception 'Career XP read mismatch'; end if;
    select seasonal_xp into strict actual_xp from public.current_seasonal_xp_totals
      where user_id=student.user_id and season_id=season_id_current;
    if actual_xp is distinct from expected_seasonal then raise exception 'Season XP read mismatch'; end if;
    select count(*) into leaderboard_count from public.get_current_leaderboard('PROGRAM_STUDI','',1,0,5);
    if leaderboard_count not between 1 and 5 then raise exception 'Dashboard leaderboard unavailable'; end if;
    perform m.mission_id, m.nama_lomba, mt.kode_tier, s.squad_id
      from public.squad_members sm
      join public.squads s on s.squad_id=sm.squad_id
      join public.missions m on m.mission_id=s.mission_id
      left join public.mission_tiers mt on mt.tier_id=m.tier_id
      where sm.user_id=student.user_id and sm.status_member='ACTIVE'
        and s.status_squad<>'MISSION_COMPLETED';
    perform s.squad_id, count(sm.squad_member_id)
      from public.squads s left join public.squad_members sm
        on sm.squad_id=s.squad_id and sm.mission_id=s.mission_id and sm.status_member='ACTIVE'
      where s.status_squad<>'MISSION_COMPLETED' group by s.squad_id;

    execute 'reset role';
    tested := tested + 1;
  end loop;
  if tested=0 then raise exception 'No eligible students; test was not run'; end if;
  perform set_config('nexus.qa_dashboard_students',tested::text,true);
end;
$test$;

select 'PASS' as sql_rls_status,
  current_setting('nexus.qa_dashboard_students')::integer as eligible_students_tested,
  'No HTTP, browser, password login, or write flows tested' as boundary;
rollback;
