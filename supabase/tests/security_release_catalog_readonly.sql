-- Owner-run catalog assertions. No rows, roles, grants or schema are changed.
begin read only;
set local statement_timeout='15s';
do $test$
declare
  allowed oid[] := array[
    'public.cancel_squad_application(uuid)'::regprocedure::oid,
    'public.close_active_season(uuid)'::regprocedure::oid,
    'public.create_squad(uuid,text,text,smallint,jsonb)'::regprocedure::oid,
    'public.decide_squad_application(uuid,text)'::regprocedure::oid,
    'public.disband_solo_squad(uuid)'::regprocedure::oid,
    'public.equip_badge(uuid)'::regprocedure::oid,
    'public.finalize_squad(uuid)'::regprocedure::oid,
    'public.get_current_leaderboard(text,text,integer,integer,integer)'::regprocedure::oid,
    'public.get_leader_pending_squad_applications(uuid)'::regprocedure::oid,
    'public.get_mission_squad_leaders(uuid)'::regprocedure::oid,
    'public.get_squad_room_members(uuid)'::regprocedure::oid,
    'public.is_active_user()'::regprocedure::oid,
    'public.is_admin()'::regprocedure::oid,
    'public.kick_squad_member(uuid,uuid,text)'::regprocedure::oid,
    'public.leave_squad(uuid)'::regprocedure::oid,
    'public.refresh_leaderboard_badges(uuid)'::regprocedure::oid,
    'public.submit_squad_application(uuid)'::regprocedure::oid,
    'public.transfer_squad_leadership(uuid,uuid)'::regprocedure::oid
  ];
  name text;
begin
  if exists(select 1 from pg_class where relnamespace='public'::regnamespace
    and relkind in ('r','p') and not relrowsecurity) then
    raise exception 'A public table has RLS disabled';end if;
  foreach name in array array['anon','authenticated'] loop
    if has_schema_privilege(name,'public','CREATE') then
      raise exception 'Client may create objects in public: %',name;end if;
    if exists(select 1 from pg_proc where pronamespace='nexus_private'::regnamespace
      and has_function_privilege(name,oid,'EXECUTE')) then
      raise exception 'Client may execute a private function: %',name;end if;
  end loop;
  if exists(select 1 from pg_proc where pronamespace='public'::regnamespace
    and prosecdef and has_function_privilege('anon',oid,'EXECUTE')) then
    raise exception 'Anon may execute a public definer';end if;
  if exists(select 1 from pg_proc where pronamespace='public'::regnamespace
    and prosecdef and has_function_privilege('authenticated',oid,'EXECUTE')
    and not(oid=any(allowed))) then
    raise exception 'An authenticated definer requires a new authorization review';end if;
  if (select count(*) from pg_proc where oid=any(allowed) and prosecdef
    and has_function_privilege('authenticated',oid,'EXECUTE'))<>cardinality(allowed) then
    raise exception 'Reviewed RPC signature or EXECUTE contract changed';end if;
  if exists(select 1 from pg_proc where oid=any(allowed) and not exists(
    select 1 from unnest(coalesce(proconfig,'{}')) setting where setting like 'search_path=%')) then
    raise exception 'Reviewed RPC search_path is not pinned';end if;

  foreach name in array array['public_profiles','career_xp_totals',
    'current_seasonal_xp_totals','finalized_squad_members'] loop
    if has_table_privilege('anon','public.'||name,'SELECT')
      or not has_table_privilege('authenticated','public.'||name,'SELECT')
      or has_table_privilege('authenticated','public.'||name,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') then
      raise exception 'Display view grants are incorrect: %',name;end if;
    if name in ('public_profiles','career_xp_totals') then
      if not exists(select 1 from pg_class where oid=('public.'||name)::regclass
        and reloptions @> array['security_barrier=true']) then
        raise exception 'Missing guarded definer-view barrier: %',name;end if;
    elsif not exists(select 1 from pg_class where oid=('public.'||name)::regclass
      and reloptions @> array['security_invoker=true']) then
      raise exception 'Missing invoker view option: %',name;end if;
  end loop;
  foreach name in array array['leaderboard_fakultas','leaderboard_program_studi','leaderboard_universitas'] loop
    if has_table_privilege('anon','public.'||name,'SELECT')
      or has_table_privilege('authenticated','public.'||name,'SELECT') then
      raise exception 'Raw internal leaderboard view exposed: %',name;end if;
  end loop;
  if exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='public_profiles' and column_name not in ('user_id','nama_lengkap',
      'tahun_masuk','program_studi_id','fakultas_id','primary_class_id','bio','foto_profil_path','created_at')) then
    raise exception 'Public profile projection changed; review privacy before release';end if;
end $test$;
rollback;
select 'PASS: RLS, 18 reviewed definers, no anon/private execution, read-only display views and private profile projection' as result;
