-- The existing live views include non-students and run with the view owner's
-- privileges. Keep the ranking projection behind a guarded, limited RPC.
revoke all on public.leaderboard_universitas from public, anon, authenticated;
revoke all on public.leaderboard_fakultas from public, anon, authenticated;
revoke all on public.leaderboard_program_studi from public, anon, authenticated;

-- Profile only needs the caller's own total. The invoker view honors the
-- profiles and xp_transactions SELECT policies.
alter view public.current_seasonal_xp_totals set (security_invoker = true);

create function public.get_current_leaderboard(
  p_scope text,
  p_query text default '',
  p_min_rank integer default 1,
  p_offset integer default 0,
  p_limit integer default 21
)
returns table (
  user_id uuid,
  nama_lengkap text,
  foto_profil_path text,
  nama_program_studi text,
  nama_fakultas text,
  nama_class text,
  seasonal_xp integer,
  rank_position integer,
  population_total integer,
  rank_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program_id bigint;
  v_faculty_id bigint;
begin
  select p.program_studi_id, ps.fakultas_id
    into v_program_id, v_faculty_id
  from public.profiles p
  join public.program_studi ps on ps.program_studi_id = p.program_studi_id
  where p.user_id = (select auth.uid())
    and p.role_app = 'STUDENT'
    and p.status_akun = 'ACTIVE';

  if not found then
    raise exception 'Leaderboard is available to active students only' using errcode = '42501';
  end if;

  if p_scope is null or p_scope not in ('UNIVERSITAS', 'FAKULTAS', 'PROGRAM_STUDI')
    or p_query is null or length(p_query) > 80
    or p_min_rank is null or p_min_rank < 1
    or p_offset is null or p_offset < 0 or p_offset > 10000
    or p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'Invalid leaderboard parameters' using errcode = '22023';
  end if;

  return query
  with active_season as (
    select s.season_id from public.seasons s
    where s.status_season = 'ACTIVE'
    order by s.start_date desc, s.season_id
    limit 1
  ), scores as (
    select p.user_id, p.nama_lengkap, p.foto_profil_path,
      ps.nama_program_studi, f.nama_fakultas, pc.nama_class,
      coalesce(sum(xt.xp_amount), 0)::integer as xp,
      max(xt.created_at) as reached_at
    from active_season s
    cross join public.profiles p
    join public.program_studi ps on ps.program_studi_id = p.program_studi_id
    join public.fakultas f on f.fakultas_id = ps.fakultas_id
    left join public.primary_classes pc on pc.primary_class_id = p.primary_class_id
    left join public.xp_transactions xt
      on xt.user_id = p.user_id and xt.season_id = s.season_id
    where p.role_app = 'STUDENT' and p.status_akun = 'ACTIVE'
      and (p_scope = 'UNIVERSITAS'
        or (p_scope = 'FAKULTAS' and ps.fakultas_id = v_faculty_id)
        or (p_scope = 'PROGRAM_STUDI' and ps.program_studi_id = v_program_id))
    group by p.user_id, p.nama_lengkap, p.foto_profil_path,
      ps.nama_program_studi, f.nama_fakultas, pc.nama_class
  ), ranked as (
    select scores.*,
      row_number() over (order by scores.xp desc, scores.reached_at asc nulls first,
        scores.user_id)::integer as place,
      count(*) over ()::integer as population
    from scores
  )
  select r.user_id, r.nama_lengkap, r.foto_profil_path,
    r.nama_program_studi, r.nama_fakultas, r.nama_class,
    r.xp, r.place, r.population,
    (select rr.rank_name from public.rank_rules rr
      where rr.min_xp <= r.xp and (rr.max_xp is null or rr.max_xp >= r.xp)
      order by rr.min_xp desc, rr.rank_rule_id desc limit 1)
  from ranked r
  where r.place >= p_min_rank
    and (p_query = '' or position(lower(p_query) in lower(r.nama_lengkap)) > 0)
  order by r.place
  offset p_offset limit p_limit;
end;
$$;

revoke all on function public.get_current_leaderboard(text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_current_leaderboard(text, text, integer, integer, integer)
  to authenticated;
