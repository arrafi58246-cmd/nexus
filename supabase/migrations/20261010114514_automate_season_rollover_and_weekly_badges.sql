-- G09/G10: WIB July-June Seasons, Career-only late approval, and weekly awards.
-- Lock (771901,1) serializes review/credit, badge refresh and final snapshots.
-- Private owner-only cores let pg_cron run without impersonating an app admin.
create schema nexus_private;
revoke all on schema nexus_private from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION nexus_private.refresh_leaderboard_badges(p_season_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_season_id uuid;
  v_count integer := 0;
  v_rows integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(771901, 1);

  if p_season_id is null then
    select season_id into v_season_id
    from public.seasons
    where status_season = 'ACTIVE';
  else
    v_season_id := p_season_id;
  end if;

  if v_season_id is null then
    raise exception 'No season selected and no ACTIVE season exists';
  end if;

  insert into public.user_badges(
    user_id, badge_id, season_id, reward_context, scope_type,
    rank_position, population_total, is_equipped
  )
  select
    l.user_id,
    bd.badge_id,
    l.season_id,
    'LEADERBOARD',
    'UNIVERSITAS',
    l.rank_position,
    l.population_total,
    false
  from public.leaderboard_universitas l
  join public.badge_definitions bd
    on bd.badge_code = case
      when l.rank_position = 1 then 'LB_CHAMPION'
      when l.rank_position = 2 then 'LB_RUNNER_UP'
      when l.rank_position = 3 then 'LB_THIRD'
      else 'LB_CONTENDER'
    end
  where l.season_id = v_season_id
    and (
      l.rank_position between 1 and 3
      or (
        l.rank_position > 3
        and (l.rank_position::numeric / l.population_total::numeric) > 0.03
        and (l.rank_position::numeric / l.population_total::numeric) <= 0.10
      )
    )
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  insert into public.user_badges(
    user_id, badge_id, season_id, reward_context, scope_type,
    fakultas_id, rank_position, population_total, is_equipped
  )
  select
    l.user_id,
    bd.badge_id,
    l.season_id,
    'LEADERBOARD',
    'FAKULTAS',
    l.fakultas_id,
    l.rank_position,
    l.population_total,
    false
  from public.leaderboard_fakultas l
  join public.badge_definitions bd
    on bd.badge_code = case
      when l.rank_position = 1 then 'LB_CHAMPION'
      when l.rank_position = 2 then 'LB_RUNNER_UP'
      when l.rank_position = 3 then 'LB_THIRD'
      else 'LB_CONTENDER'
    end
  where l.season_id = v_season_id
    and (
      l.rank_position between 1 and 3
      or (
        l.rank_position > 3
        and (l.rank_position::numeric / l.population_total::numeric) > 0.03
        and (l.rank_position::numeric / l.population_total::numeric) <= 0.10
      )
    )
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  insert into public.user_badges(
    user_id, badge_id, season_id, reward_context, scope_type,
    program_studi_id, rank_position, population_total, is_equipped
  )
  select
    l.user_id,
    bd.badge_id,
    l.season_id,
    'LEADERBOARD',
    'PROGRAM_STUDI',
    l.program_studi_id,
    l.rank_position,
    l.population_total,
    false
  from public.leaderboard_program_studi l
  join public.badge_definitions bd
    on bd.badge_code = case
      when l.rank_position = 1 then 'LB_CHAMPION'
      when l.rank_position = 2 then 'LB_RUNNER_UP'
      when l.rank_position = 3 then 'LB_THIRD'
      else 'LB_CONTENDER'
    end
  where l.season_id = v_season_id
    and (
      l.rank_position between 1 and 3
      or (
        l.rank_position > 3
        and (l.rank_position::numeric / l.population_total::numeric) > 0.03
        and (l.rank_position::numeric / l.population_total::numeric) <= 0.10
      )
    )
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  return v_count;
end;
$function$;


CREATE OR REPLACE FUNCTION nexus_private.close_active_season(p_season_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_status public.season_status_enum;
  v_snapshot_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(771901, 1);

  v_snapshot_at := clock_timestamp();
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

  perform nexus_private.refresh_leaderboard_badges(p_season_id);

  insert into public.season_user_history(
    season_id, user_id, seasonal_xp, season_rank_name, snapshot_at
  )
  select
    p_season_id,
    p.user_id,
    coalesce(x.seasonal_xp, 0),
    rr.rank_name,
    v_snapshot_at
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
    rank_position, population_total, seasonal_xp, v_snapshot_at
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
    rank_position, population_total, seasonal_xp, v_snapshot_at
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
    rank_position, population_total, seasonal_xp, v_snapshot_at
  from ranked
  on conflict do nothing;

  update public.seasons
  set status_season = 'CLOSED'
  where season_id = p_season_id;
end;
$function$;


create function nexus_private.maintain_seasons(p_run_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_today date;
  v_year integer;
  v_start date;
  v_end date;
  v_active public.seasons%rowtype;
  v_target public.seasons%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(771901, 1);
  -- Read the clock AFTER waiting for a concurrent approval/closure.
  v_today := (coalesce(p_run_at, clock_timestamp()) at time zone 'Asia/Jakarta')::date;
  select * into v_active from public.seasons where status_season = 'ACTIVE' for update;

  if v_active.season_id is not null then
    if v_today between v_active.start_date and v_active.end_date then
      return v_active.season_id;
    elsif v_today > v_active.end_date then
      perform nexus_private.close_active_season(v_active.season_id);
    else
      raise exception 'ACTIVE Season starts in the future';
    end if;
  end if;

  v_year := extract(year from v_today)::integer;
  if extract(month from v_today) < 7 then v_year := v_year - 1; end if;
  v_start := make_date(v_year, 7, 1);
  v_end := make_date(v_year + 1, 6, 30);

  select * into v_target from public.seasons
    where start_date = v_start and end_date = v_end for update;
  if v_target.season_id is not null and v_target.status_season = 'CLOSED' then
    -- An admin may close early. Never reopen or rewrite a final snapshot.
    return null;
  end if;

  if exists (
    select 1 from public.seasons s
    where s.season_id is distinct from v_target.season_id
      and s.start_date <= v_end and s.end_date >= v_start
  ) then
    raise exception 'Overlapping Season dates require admin correction';
  end if;

  if v_target.season_id is null then
    insert into public.seasons(nama_season, start_date, end_date, status_season)
    values ('Season ' || v_year || '/' || (v_year + 1), v_start, v_end, 'ACTIVE')
    returning * into v_target;
  else
    update public.seasons set status_season = 'ACTIVE'
      where season_id = v_target.season_id and status_season = 'UPCOMING';
  end if;
  return v_target.season_id;
end;
$function$;

create function nexus_private.season_for_award(p_earned_at date, p_approved_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_season uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(771901, 1);
  select s.season_id into v_season from public.seasons s
  where s.status_season = 'ACTIVE'
    and p_earned_at between s.start_date and s.end_date
    and (p_approved_at at time zone 'Asia/Jakarta')::date between s.start_date and s.end_date;
  return v_season;
end;
$function$;

create function nexus_private.run_weekly_badges()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_season uuid;
begin
  v_season := nexus_private.maintain_seasons();
  if v_season is null then return 0; end if;
  return nexus_private.refresh_leaderboard_badges(v_season);
end;
$function$;

create or replace function public.refresh_leaderboard_badges(p_season_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.is_admin() then raise exception 'Admin permission required'; end if;
  return nexus_private.refresh_leaderboard_badges(p_season_id);
end;
$function$;

create or replace function public.close_active_season(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.is_admin() then raise exception 'Admin permission required'; end if;
  perform nexus_private.close_active_season(p_season_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_achievement_claim_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_xp integer;
begin
  if public.nexus_internal_mode() then
    return new;
  end if;

  if old.status_validation = 'APPROVED' and new is distinct from old then
    raise exception 'Approved Achievement Claims are immutable';
  end if;

  if public.is_admin() then
    if old.status_validation = 'PENDING' and new.status_validation = 'APPROVED' then
      -- Lock before stamping review time. One timestamp applies to every Squad member.
      perform pg_catalog.pg_advisory_xact_lock(771901, 1);
      perform nexus_private.maintain_seasons();
    end if;
    if new.status_validation = 'APPROVED' and old.status_validation <> 'APPROVED' then
      if new.approved_tier_id is null then
        raise exception 'approved_tier_id is required for approval';
      end if;

      select xr.legacy_xp into v_xp
      from public.xp_rules xr
      where xr.tier_id = new.approved_tier_id
        and xr.hasil_kompetisi = new.hasil_kompetisi;

      if v_xp is null then
        raise exception 'No XP rule exists for the approved tier/result';
      end if;

      new.approved_xp := v_xp;
      new.rejection_reason := null;
      new.reviewed_by := auth.uid();
      new.reviewed_at := clock_timestamp();
    elsif new.status_validation = 'REJECTED' and old.status_validation <> 'REJECTED' then
      if new.rejection_reason is null or length(btrim(new.rejection_reason)) = 0 then
        raise exception 'rejection_reason is required for rejection';
      end if;
      new.approved_tier_id := null;
      new.approved_xp := null;
      new.reviewed_by := auth.uid();
      new.reviewed_at := clock_timestamp();
    end if;

    return new;
  end if;

  if auth.uid() is null or old.user_id <> auth.uid() then
    raise exception 'Only the claim owner or admin may update this claim';
  end if;

  if old.status_validation <> 'REJECTED' or new.status_validation <> 'PENDING' then
    raise exception 'Users may only resubmit a rejected claim using the same claim ID';
  end if;

  if new.user_id is distinct from old.user_id
    or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Claim ownership and original submission time are immutable';
  end if;

  select xr.legacy_xp into v_xp
  from public.xp_rules xr
  where xr.tier_id = new.submitted_tier_id
    and xr.hasil_kompetisi = new.hasil_kompetisi;

  if v_xp is null then
    raise exception 'No XP rule exists for the submitted tier/result';
  end if;

  new.preview_xp := v_xp;
  new.approved_tier_id := null;
  new.approved_xp := null;
  new.rejection_reason := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.resubmission_count := old.resubmission_count + 1;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.guard_mission_result_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_xp integer;
begin
  if public.nexus_internal_mode() then
    return new;
  end if;

  if old.status_validation = 'APPROVED' and new is distinct from old then
    raise exception 'Approved Mission Results are immutable';
  end if;

  if public.is_admin() then
    if old.status_validation = 'PENDING' and new.status_validation = 'APPROVED' then
      -- Lock before stamping review time. One timestamp applies to every Squad member.
      perform pg_catalog.pg_advisory_xact_lock(771901, 1);
      perform nexus_private.maintain_seasons();
    end if;
    if old.status_validation <> 'PENDING'
       or new.status_validation not in ('APPROVED', 'REJECTED') then
      raise exception 'Only a PENDING Mission Result can be reviewed';
    end if;

    if new.squad_id is distinct from old.squad_id
       or new.submitted_by is distinct from old.submitted_by
       or new.submitted_at is distinct from old.submitted_at
       or new.hasil_kompetisi is distinct from old.hasil_kompetisi
       or new.submitted_tier_id is distinct from old.submitted_tier_id
       or new.sertifikat_path is distinct from old.sertifikat_path
       or new.dokumen_pendukung_path is distinct from old.dokumen_pendukung_path
       or new.preview_xp is distinct from old.preview_xp then
      raise exception 'Submitted Mission Result evidence is immutable during review';
    end if;

    if new.status_validation = 'APPROVED' then
      if new.approved_tier_id is null or new.approved_hasil_kompetisi is null then
        raise exception 'Approved tier and result are required';
      end if;

      select xr.verified_xp into v_xp
      from public.xp_rules xr
      where xr.tier_id = new.approved_tier_id
        and xr.hasil_kompetisi = new.approved_hasil_kompetisi;

      if v_xp is null then
        raise exception 'No XP rule exists for the approved tier/result';
      end if;

      new.approved_xp := v_xp;
      new.rejection_reason := null;
    else
      if new.rejection_reason is null
         or length(btrim(new.rejection_reason)) = 0
         or length(new.rejection_reason) > 1000 then
        raise exception 'A rejection reason up to 1000 characters is required';
      end if;
      new.rejection_reason := btrim(new.rejection_reason);
      new.approved_tier_id := null;
      new.approved_hasil_kompetisi := null;
      new.approved_xp := null;
    end if;

    new.reviewed_by := auth.uid();
    new.reviewed_at := clock_timestamp();
    return new;
  end if;

  if auth.uid() is null or old.submitted_by <> auth.uid() then
    raise exception 'Only the submitter or admin may update this result';
  end if;

  if old.status_validation <> 'REJECTED' or new.status_validation <> 'PENDING' then
    raise exception 'A user may only resubmit a rejected Mission Result';
  end if;

  if new.squad_id is distinct from old.squad_id
     or new.submitted_by is distinct from old.submitted_by
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Mission Result ownership and Squad are immutable';
  end if;

  select xr.verified_xp into v_xp
  from public.xp_rules xr
  where xr.tier_id = new.submitted_tier_id
    and xr.hasil_kompetisi = new.hasil_kompetisi;

  if v_xp is null then
    raise exception 'No XP rule exists for the submitted tier/result';
  end if;

  new.preview_xp := v_xp;
  new.approved_tier_id := null;
  new.approved_hasil_kompetisi := null;
  new.approved_xp := null;
  new.rejection_reason := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  return new;
end;
$function$;


create or replace function public.guard_xp_transaction_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_expected integer;
  v_expected_user uuid;
  v_earned_at date;
  v_approved_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(771901, 1);
  if new.xp_source_type = 'VERIFIED_MISSION' then
    select r.approved_xp, (m.deadline_lomba at time zone 'Asia/Jakarta')::date, r.reviewed_at
      into v_expected, v_earned_at, v_approved_at
    from public.mission_result_submissions r
    join public.squads s on s.squad_id = r.squad_id
    join public.missions m on m.mission_id = s.mission_id
    where r.result_submission_id = new.mission_result_submission_id
      and r.status_validation = 'APPROVED';
    if v_expected is null then
      raise exception 'Verified XP requires an APPROVED Mission Result';
    end if;
    if not exists (
      select 1 from public.mission_result_submissions r
      join public.squad_members sm on sm.squad_id = r.squad_id
      where r.result_submission_id = new.mission_result_submission_id
        and sm.user_id = new.user_id and sm.status_member = 'ACTIVE'
    ) then
      raise exception 'Verified XP user must be an ACTIVE member of the approved Squad';
    end if;
  else
    select a.approved_xp, a.user_id, a.achievement_date, a.reviewed_at
      into v_expected, v_expected_user, v_earned_at, v_approved_at
    from public.achievement_claims a
    where a.achievement_claim_id = new.achievement_claim_id
      and a.status_validation = 'APPROVED';
    if v_expected is null then
      raise exception 'Legacy XP requires an APPROVED Achievement Claim';
    end if;
    if v_expected_user <> new.user_id then
      raise exception 'Legacy XP user must match the Achievement Claim owner';
    end if;
  end if;
  if new.xp_amount <> v_expected then
    raise exception 'XP amount must equal the approved XP value';
  end if;
  if v_approved_at is null then raise exception 'Approved source requires review time'; end if;

  if pg_trigger_depth() = 1 then
    -- Direct owner/admin ledger INSERT also obeys today's cutoff, even if cron is late.
    perform nexus_private.maintain_seasons();
    v_approved_at := clock_timestamp();
  end if;
  -- Normal review-trigger inserts use the timestamp captured under this same lock.
  -- Every member receives the same Season, even if a bulk insert crosses midnight.
  new.earned_at := v_earned_at;
  new.season_id := nexus_private.season_for_award(v_earned_at, v_approved_at);
  new.created_at := v_approved_at;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.after_achievement_claim_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_season_id uuid;
begin
  if old.status_validation is distinct from new.status_validation then
    if new.status_validation = 'APPROVED' then
      -- The ledger guard assigns the Season using the locked approval timestamp.
      v_season_id := null;

      insert into public.xp_transactions(
        user_id,
        xp_amount,
        xp_source_type,
        achievement_claim_id,
        season_id,
        earned_at
      ) values (
        new.user_id,
        new.approved_xp,
        'LEGACY_ACHIEVEMENT',
        new.achievement_claim_id,
        v_season_id,
        new.achievement_date
      )
      on conflict do nothing;

      insert into public.notifications(user_id, notification_type, title, body)
      values (
        new.user_id,
        'ACHIEVEMENT_APPROVED',
        'Achievement disetujui',
        format('Achievement tervalidasi. Kamu menerima %s Legacy XP.', new.approved_xp)
      );
    elsif new.status_validation = 'REJECTED' then
      insert into public.notifications(user_id, notification_type, title, body)
      values (
        new.user_id,
        'ACHIEVEMENT_REJECTED',
        'Achievement ditolak',
        coalesce(new.rejection_reason, 'Klaim achievement ditolak oleh admin.')
      );
    end if;
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.after_mission_result_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_mission public.missions%rowtype;
  v_season_id uuid;
  v_earned_at date;
  v_internal text;
begin
  if old.status_validation is distinct from new.status_validation then
    if new.status_validation = 'APPROVED' then
      select m.* into v_mission
      from public.squads s
      join public.missions m on m.mission_id = s.mission_id
      where s.squad_id = new.squad_id;

      if not found then
        raise exception 'Mission not found for Squad';
      end if;

      -- Explicit v1 convention: Verified Mission earned_at uses the Mission's deadline_lomba date,
      -- because the source documents do not define a separate achievement/result date field.
      v_earned_at := (v_mission.deadline_lomba at time zone 'Asia/Jakarta')::date;

      -- The ledger guard assigns the Season using the locked approval timestamp.
      v_season_id := null;

      insert into public.xp_transactions(
        user_id,
        xp_amount,
        xp_source_type,
        mission_result_submission_id,
        season_id,
        earned_at
      )
      select
        sm.user_id,
        new.approved_xp,
        'VERIFIED_MISSION',
        new.result_submission_id,
        v_season_id,
        v_earned_at
      from public.squad_members sm
      where sm.squad_id = new.squad_id
        and sm.status_member = 'ACTIVE'
      on conflict do nothing;

      v_internal := current_setting('nexus.internal', true);
      perform set_config('nexus.internal', '1', true);

      update public.squads
      set status_squad = 'MISSION_COMPLETED',
          completed_at = now()
      where squad_id = new.squad_id;

      perform set_config('nexus.internal', coalesce(v_internal, ''), true);

      delete from public.squad_messages
      where squad_id = new.squad_id;

      insert into public.notifications(user_id, notification_type, title, body)
      select
        sm.user_id,
        'MISSION_RESULT_APPROVED',
        'Hasil Mission disetujui',
        format('Hasil Mission disetujui. Kamu menerima %s XP.', new.approved_xp)
      from public.squad_members sm
      where sm.squad_id = new.squad_id
        and sm.status_member = 'ACTIVE';

    elsif new.status_validation = 'REJECTED' then
      insert into public.notifications(user_id, notification_type, title, body)
      select
        sm.user_id,
        'MISSION_RESULT_REJECTED',
        'Hasil Mission perlu diperbaiki',
        coalesce(new.rejection_reason, 'Submit Mission Result ditolak oleh admin.')
      from public.squad_members sm
      where sm.squad_id = new.squad_id
        and sm.status_member = 'ACTIVE';
    end if;
  end if;

  return new;
end;
$function$;


-- Trigger functions need no client EXECUTE privilege. Existing admin RPCs stay guarded.
revoke all on function public.guard_achievement_claim_update(),
  public.guard_mission_result_update(), public.guard_xp_transaction_source(),
  public.after_achievement_claim_review(), public.after_mission_result_review()
  from public, anon, authenticated, service_role;
revoke all on all functions in schema nexus_private from public, anon, authenticated, service_role;
revoke all on function public.close_active_season(uuid),
  public.refresh_leaderboard_badges(uuid) from public, anon;
grant execute on function public.close_active_season(uuid),
  public.refresh_leaderboard_badges(uuid) to authenticated, service_role;

-- pg_cron is already preloaded on the project; jobs run as the database owner.
create extension if not exists pg_cron with schema pg_catalog;
do $cron_timezone$
begin
  if current_setting('cron.timezone') not in ('GMT', 'UTC') then
    raise exception 'NEXUS cron schedules require cron.timezone GMT/UTC';
  end if;
end;
$cron_timezone$;
select cron.schedule('nexus-season-rollover', '*/5 * * * *',
  'select nexus_private.maintain_seasons();');
-- Sunday 17:00 UTC = Monday 00:00 WIB.
select cron.schedule('nexus-weekly-leaderboard-badges', '0 17 * * 0',
  'select nexus_private.run_weekly_badges();');
