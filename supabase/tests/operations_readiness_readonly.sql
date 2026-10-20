-- Run in the SQL Editor as the project owner. Read-only diagnostics only.
-- Coverage compares CURRENT standings with retained badges: a nonzero missing
-- count between weekly runs can be legitimate, so it is not a security failure.
begin transaction isolation level repeatable read read only;

with standings as (
  select user_id, season_id, 'UNIVERSITAS'::text scope_type,
    null::bigint program_studi_id, null::bigint fakultas_id,
    rank_position, population_total from public.leaderboard_universitas
  union all
  select user_id, season_id, 'FAKULTAS', null::bigint, fakultas_id,
    rank_position, population_total from public.leaderboard_fakultas
  union all
  select user_id, season_id, 'PROGRAM_STUDI', program_studi_id, null::bigint,
    rank_position, population_total from public.leaderboard_program_studi
), expected as (
  select *, case rank_position when 1 then 'LB_CHAMPION'
    when 2 then 'LB_RUNNER_UP' when 3 then 'LB_THIRD'
    else 'LB_CONTENDER' end badge_code
  from standings
  where rank_position between 1 and 3
    or (rank_position > 3 and rank_position::numeric / nullif(population_total, 0) > 0.03
      and rank_position::numeric / nullif(population_total, 0) <= 0.10)
), coverage as (
  select e.*, exists (
    select 1 from public.user_badges b
    join public.badge_definitions d using (badge_id)
    where b.user_id=e.user_id and b.season_id=e.season_id
      and b.reward_context='LEADERBOARD' and b.scope_type::text=e.scope_type
      and b.program_studi_id is not distinct from e.program_studi_id
      and b.fakultas_id is not distinct from e.fakultas_id
      and d.badge_code=e.badge_code
  ) awarded from expected e
), jobs as (
  select j.jobname, j.schedule, j.active, r.status, r.start_time,
    r.start_time at time zone 'Asia/Jakarta' start_wib,
    r.end_time, r.return_message
  from cron.job j left join lateral (
    select status, start_time, end_time, return_message
    from cron.job_run_details where jobid=j.jobid order by start_time desc limit 1
  ) r on true
  where j.jobname in ('nexus-season-rollover', 'nexus-weekly-leaderboard-badges',
    'nexus-idle-squad-chat-cleanup')
)
select jsonb_build_object(
  'checked_at', now(),
  'jobs', (select jsonb_agg(j order by jobname) from jobs j),
  'current_badge_coverage', (select jsonb_agg(c) from (
    select scope_type, count(*) expected, count(*) filter (where not awarded) missing
    from coverage group by scope_type
  ) c),
  'weekly_run_awards', (select count(*) from public.user_badges b
    join jobs j on j.jobname='nexus-weekly-leaderboard-badges'
      and b.awarded_at between j.start_time and j.end_time),
  'duplicate_equipped_users', (select count(*) from (
    select user_id from public.user_badges where is_equipped group by user_id having count(*)>1
  ) d),
  'missions', (select jsonb_build_object('total', count(*),
    'missing_team_limits', count(*) filter (where min_anggota_tim is null or max_anggota_tim is null),
    'solo_limits', count(*) filter (where max_anggota_tim<2)) from public.missions),
  'active_seasons', (select count(*) from public.seasons where status_season='ACTIVE'),
  'xp_total', (select coalesce(sum(xp_amount),0) from public.xp_transactions),
  'badge_total', (select count(*) from public.user_badges),
  'remaining_qa_jobs', (select count(*) from cron.job where jobname like 'nexus-qa-%')
) as readiness;

rollback;
