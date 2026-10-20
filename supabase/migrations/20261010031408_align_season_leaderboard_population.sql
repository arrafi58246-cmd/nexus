-- LB-01 / G09: share the STUDENT ACTIVE population with the guarded live RPC.
-- Replace definitions in place to preserve existing ownership and revoked
-- anon/authenticated grants. These views remain internal to badge allocation.
-- Do not change XP assignment, historical rewards, or the 3% contender boundary.

create or replace view public.leaderboard_fakultas as
 SELECT x.season_id,
    x.user_id,
    p.nama_lengkap,
    ps.fakultas_id,
    p.program_studi_id,
    x.seasonal_xp,
    x.reached_at,
    row_number() OVER (PARTITION BY x.season_id, ps.fakultas_id ORDER BY x.seasonal_xp DESC, x.reached_at ASC NULLS FIRST, x.user_id)::integer AS rank_position,
    count(*) OVER (PARTITION BY x.season_id, ps.fakultas_id)::integer AS population_total
   FROM public.current_seasonal_xp_totals x
     JOIN public.profiles p ON p.user_id = x.user_id
     JOIN public.program_studi ps ON ps.program_studi_id = p.program_studi_id
  WHERE p.role_app = 'STUDENT' AND p.status_akun = 'ACTIVE';

create or replace view public.leaderboard_program_studi as
 SELECT x.season_id,
    x.user_id,
    p.nama_lengkap,
    p.program_studi_id,
    ps.fakultas_id,
    x.seasonal_xp,
    x.reached_at,
    row_number() OVER (PARTITION BY x.season_id, p.program_studi_id ORDER BY x.seasonal_xp DESC, x.reached_at ASC NULLS FIRST, x.user_id)::integer AS rank_position,
    count(*) OVER (PARTITION BY x.season_id, p.program_studi_id)::integer AS population_total
   FROM public.current_seasonal_xp_totals x
     JOIN public.profiles p ON p.user_id = x.user_id
     JOIN public.program_studi ps ON ps.program_studi_id = p.program_studi_id
  WHERE p.role_app = 'STUDENT' AND p.status_akun = 'ACTIVE';

create or replace view public.leaderboard_universitas as
 SELECT x.season_id,
    x.user_id,
    p.nama_lengkap,
    p.program_studi_id,
    ps.fakultas_id,
    x.seasonal_xp,
    x.reached_at,
    row_number() OVER (PARTITION BY x.season_id ORDER BY x.seasonal_xp DESC, x.reached_at ASC NULLS FIRST, x.user_id)::integer AS rank_position,
    count(*) OVER (PARTITION BY x.season_id)::integer AS population_total
   FROM public.current_seasonal_xp_totals x
     JOIN public.profiles p ON p.user_id = x.user_id
     JOIN public.program_studi ps ON ps.program_studi_id = p.program_studi_id
  WHERE p.role_app = 'STUDENT' AND p.status_akun = 'ACTIVE';

-- Keep the existing admin guard and transactional season close. No season is
-- closed by this migration and no historical rows or XP are rewritten.
CREATE OR REPLACE FUNCTION public.close_active_season(p_season_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status public.season_status_enum;
begin
  if not public.is_admin() then
    raise exception 'Admin permission required';
  end if;

  select status_season into v_status
  from public.seasons
  where season_id = p_season_id
  for update;

  if v_status is null then
    raise exception 'Season not found';
  end if;

  if v_status <> 'ACTIVE' then
    raise exception 'Only the ACTIVE season can be closed';
  end if;

  perform public.refresh_leaderboard_badges(p_season_id);

  insert into public.season_user_history(
    season_id, user_id, seasonal_xp, season_rank_name, snapshot_at
  )
  select
    p_season_id,
    p.user_id,
    coalesce(x.seasonal_xp, 0),
    rr.rank_name,
    now()
  from public.profiles p
  left join (
    select user_id, sum(xp_amount)::integer as seasonal_xp
    from public.xp_transactions
    where season_id = p_season_id
    group by user_id
  ) x on x.user_id = p.user_id
  join public.rank_rules rr
    on coalesce(x.seasonal_xp, 0) >= rr.min_xp
   and (rr.max_xp is null or coalesce(x.seasonal_xp, 0) <= rr.max_xp)
  where p.role_app = 'STUDENT' and p.status_akun = 'ACTIVE'
  on conflict (season_id, user_id) do update
  set seasonal_xp = excluded.seasonal_xp,
      season_rank_name = excluded.season_rank_name,
      snapshot_at = excluded.snapshot_at;

  with base as (
    select
      p.user_id,
      p.program_studi_id,
      ps.fakultas_id,
      coalesce(sum(xt.xp_amount), 0)::integer as seasonal_xp,
      max(xt.created_at) as reached_at
    from public.profiles p
    join public.program_studi ps on ps.program_studi_id = p.program_studi_id
    left join public.xp_transactions xt
      on xt.user_id = p.user_id
     and xt.season_id = p_season_id
    where p.role_app = 'STUDENT' and p.status_akun = 'ACTIVE'
    group by p.user_id, p.program_studi_id, ps.fakultas_id
  ), ranked as (
    select
      b.*,
      row_number() over (order by seasonal_xp desc, reached_at asc nulls first, user_id)::integer as rank_position,
      count(*) over ()::integer as population_total
    from base b
  )
  insert into public.season_leaderboard_history(
    season_id, user_id, scope_type, program_studi_id, fakultas_id,
    rank_position, population_total, seasonal_xp, snapshot_at
  )
  select
    p_season_id, user_id, 'UNIVERSITAS', null, null,
    rank_position, population_total, seasonal_xp, now()
  from ranked
  on conflict do nothing;

  with base as (
    select
      p.user_id,
      p.program_studi_id,
      ps.fakultas_id,
      coalesce(sum(xt.xp_amount), 0)::integer as seasonal_xp,
      max(xt.created_at) as reached_at
    from public.profiles p
    join public.program_studi ps on ps.program_studi_id = p.program_studi_id
    left join public.xp_transactions xt
      on xt.user_id = p.user_id
     and xt.season_id = p_season_id
    where p.role_app = 'STUDENT' and p.status_akun = 'ACTIVE'
    group by p.user_id, p.program_studi_id, ps.fakultas_id
  ), ranked as (
    select
      b.*,
      row_number() over (
        partition by fakultas_id
        order by seasonal_xp desc, reached_at asc nulls first, user_id
      )::integer as rank_position,
      count(*) over (partition by fakultas_id)::integer as population_total
    from base b
  )
  insert into public.season_leaderboard_history(
    season_id, user_id, scope_type, program_studi_id, fakultas_id,
    rank_position, population_total, seasonal_xp, snapshot_at
  )
  select
    p_season_id, user_id, 'FAKULTAS', null, fakultas_id,
    rank_position, population_total, seasonal_xp, now()
  from ranked
  on conflict do nothing;

  with base as (
    select
      p.user_id,
      p.program_studi_id,
      ps.fakultas_id,
      coalesce(sum(xt.xp_amount), 0)::integer as seasonal_xp,
      max(xt.created_at) as reached_at
    from public.profiles p
    join public.program_studi ps on ps.program_studi_id = p.program_studi_id
    left join public.xp_transactions xt
      on xt.user_id = p.user_id
     and xt.season_id = p_season_id
    where p.role_app = 'STUDENT' and p.status_akun = 'ACTIVE'
    group by p.user_id, p.program_studi_id, ps.fakultas_id
  ), ranked as (
    select
      b.*,
      row_number() over (
        partition by program_studi_id
        order by seasonal_xp desc, reached_at asc nulls first, user_id
      )::integer as rank_position,
      count(*) over (partition by program_studi_id)::integer as population_total
    from base b
  )
  insert into public.season_leaderboard_history(
    season_id, user_id, scope_type, program_studi_id, fakultas_id,
    rank_position, population_total, seasonal_xp, snapshot_at
  )
  select
    p_season_id, user_id, 'PROGRAM_STUDI', program_studi_id, null,
    rank_position, population_total, seasonal_xp, now()
  from ranked
  on conflict do nothing;

  perform set_config('nexus.internal', '1', true);
  update public.seasons
  set status_season = 'CLOSED'
  where season_id = p_season_id;
end;
$function$

