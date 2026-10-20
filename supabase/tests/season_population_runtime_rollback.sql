-- LB-01 / G09 runtime regression. Run only as a database QA owner.
-- Uses an existing admin, an ACTIVE STUDENT with a valid modern email, and
-- the ACTIVE season. Everything, including suspension/awards/closure, rolls
-- back. No fixture IDs, auth accounts, or ledger entries are created.
begin;
do $test$
declare
  v_admin uuid;
  v_student uuid;
  v_season uuid;
  v_role text := current_setting('role');
  v_expected jsonb;
  v_actual jsonb;
  v_ledger jsonb;
  v_badges jsonb;
  v_users jsonb;
  v_scope text;
  v_count integer;
  v_badge_count integer;
begin
  select user_id into v_admin from public.profiles
    where role_app = 'ADMIN' and status_akun = 'ACTIVE' order by user_id limit 1;
  select user_id into v_student from public.profiles
    where role_app = 'STUDENT' and status_akun = 'ACTIVE'
      and email_unesa like '%@mhs.unesa.ac.id' order by user_id limit 1;
  select season_id into v_season from public.seasons where status_season = 'ACTIVE';
  if v_admin is null or v_student is null or v_season is null then
    raise exception 'Requires an ACTIVE admin/student (modern email) and ACTIVE season';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by xp_transaction_id),'[]'::jsonb)
    into v_ledger from public.xp_transactions x;
  select coalesce(jsonb_agg(to_jsonb(x) order by user_badge_id),'[]'::jsonb)
    into v_badges from public.user_badges x;
  -- Ignore updated_at touched only by the rollback-only status fixture.
  select jsonb_agg(to_jsonb(x) - 'updated_at' order by user_id) into v_users from public.profiles x;

  -- Both mutating functions must reject a student, even with EXECUTE permission.
  perform set_config('request.jwt.claim.sub',v_student::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_student,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.refresh_leaderboard_badges(v_season);
    raise exception 'Student badge refresh unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'Admin permission required' then raise; end if;
  end;
  begin
    perform public.close_active_season(v_season);
    raise exception 'Student season close unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'Admin permission required' then raise; end if;
  end;
  perform set_config('role',v_role,true);

  if has_table_privilege('anon','public.leaderboard_universitas','SELECT')
    or has_table_privilege('authenticated','public.leaderboard_universitas','SELECT')
    or has_table_privilege('authenticated','public.leaderboard_fakultas','SELECT')
    or has_table_privilege('authenticated','public.leaderboard_program_studi','SELECT') then
    raise exception 'Internal leaderboard views became client-readable';
  end if;

  -- Test an excluded suspended student without changing their email or XP.
  perform set_config('nexus.internal','1',true);
  update public.profiles set status_akun='SUSPENDED' where user_id=v_student;
  select count(*) into v_count from public.profiles
    where role_app='STUDENT' and status_akun='ACTIVE';
  if (select count(*) from public.leaderboard_universitas) <> v_count
    or exists (select 1 from public.leaderboard_universitas l join public.profiles p using(user_id)
      where p.role_app <> 'STUDENT' or p.status_akun <> 'ACTIVE' or l.population_total <> v_count) then
    raise exception 'Internal views include admin/suspended users or wrong population';
  end if;
  -- Restore this row before checking live ranking as that same user.
  update public.profiles set status_akun='ACTIVE' where user_id=v_student;

  for v_scope in select unnest(array['UNIVERSITAS','FAKULTAS','PROGRAM_STUDI']) loop
    perform set_config('role','authenticated',true);
    select coalesce(jsonb_agg(jsonb_build_object('user_id',l.user_id,
      'scope',v_scope,'rank',l.rank_position,'population',l.population_total,
      'xp',l.seasonal_xp) order by l.user_id),'[]'::jsonb)
    into v_actual from public.get_current_leaderboard(v_scope,'',1,0,50) l;
    perform set_config('role',v_role,true);
    select coalesce(jsonb_agg(jsonb_build_object('user_id',l.user_id,
      'scope',v_scope,'rank',l.rank_position,'population',l.population_total,
      'xp',l.seasonal_xp) order by l.user_id),'[]'::jsonb)
    into v_expected from (
      select user_id,rank_position,population_total,seasonal_xp from public.leaderboard_universitas where v_scope='UNIVERSITAS'
      union all
      select user_id,rank_position,population_total,seasonal_xp from public.leaderboard_fakultas
        where v_scope='FAKULTAS' and fakultas_id=(select ps.fakultas_id from public.profiles p join public.program_studi ps using(program_studi_id) where p.user_id=v_student)
      union all
      select user_id,rank_position,population_total,seasonal_xp from public.leaderboard_program_studi
        where v_scope='PROGRAM_STUDI' and program_studi_id=(select program_studi_id from public.profiles where user_id=v_student)
    ) l;
    if v_actual <> v_expected then raise exception 'Live/internal ranking mismatch: %',v_scope; end if;
  end loop;

  -- Snapshot/awards must also exclude a suspended student.
  update public.profiles set status_akun='SUSPENDED' where user_id=v_student;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.refresh_leaderboard_badges(v_season);
  perform set_config('role',v_role,true);
  select count(*) into v_badge_count from public.user_badges;
  perform set_config('role','authenticated',true);
  if public.refresh_leaderboard_badges(v_season) <> 0 then
    raise exception 'Repeat refresh produced duplicate awards';
  end if;
  perform set_config('role',v_role,true);
  if (select count(*) from public.user_badges) <> v_badge_count then
    raise exception 'Badge count changed on repeated refresh';
  end if;
  if exists(select 1 from jsonb_array_elements(v_badges) b
    where not exists(select 1 from public.user_badges ub where to_jsonb(ub)=b)) then
    raise exception 'Historical/equipped badges changed';
  end if;

  select jsonb_agg(to_jsonb(l) order by scope_type,user_id) into v_expected from (
    select user_id,'UNIVERSITAS'::text as scope_type, rank_position,population_total,seasonal_xp from public.leaderboard_universitas
    union all
    select user_id,'FAKULTAS',rank_position,population_total,seasonal_xp from public.leaderboard_fakultas
    union all
    select user_id,'PROGRAM_STUDI',rank_position,population_total,seasonal_xp from public.leaderboard_program_studi
  ) l;
  perform set_config('role','authenticated',true);
  perform public.close_active_season(v_season);
  perform set_config('role',v_role,true);
  select jsonb_agg(jsonb_build_object('user_id',user_id,'scope_type',scope_type::text,
    'rank_position',rank_position,'population_total',population_total,'seasonal_xp',seasonal_xp)
    order by scope_type::text,user_id) into v_actual
    from public.season_leaderboard_history where season_id=v_season;
  if v_actual <> v_expected then raise exception 'Closed history differs from pre-close ranking'; end if;
  if (select count(*) from public.season_user_history where season_id=v_season) <>
    (select count(*) from public.profiles where role_app='STUDENT' and status_akun='ACTIVE')
    or exists(select 1 from public.season_user_history h join public.profiles p using(user_id)
      where h.season_id=v_season and (p.role_app<>'STUDENT' or p.status_akun<>'ACTIVE')) then
    raise exception 'Season user snapshot has wrong population';
  end if;
  if (select status_season from public.seasons where season_id=v_season) <> 'CLOSED' then
    raise exception 'Season was not closed atomically';
  end if;
  update public.profiles set status_akun='ACTIVE' where user_id=v_student;
  if v_ledger <> (select coalesce(jsonb_agg(to_jsonb(x) order by xp_transaction_id),'[]'::jsonb) from public.xp_transactions x)
    or v_users <> (select jsonb_agg(to_jsonb(x) - 'updated_at' order by user_id) from public.profiles x) then
    raise exception 'Ledger or profiles changed';
  end if;
  raise notice 'PASS: auth guards, exclusions, zero-XP/ties, all scopes, idempotent badges, snapshot parity, ledger preservation';
end;
$test$;
rollback;
select 'PASS: all fixture mutations rolled back' as result;
