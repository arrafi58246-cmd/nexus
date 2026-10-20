-- Read-only catalog assertions. Does not execute TRUNCATE or other maintenance.
do $test$
declare t record; r text; p text; f text;
begin
  for t in select c.oid,c.relname,c.relkind,c.relrowsecurity from pg_class c
    where c.relnamespace='public'::regnamespace and c.relkind in('r','v') loop
    if t.relkind='r' and not t.relrowsecurity then raise exception 'RLS disabled on %',t.relname;end if;
    foreach r in array array['anon','authenticated'] loop
      foreach p in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(r,t.oid,p) then raise exception '% still has % on %',r,p,t.relname;end if;
      end loop;
      if current_setting('server_version_num')::integer>=170000 and has_table_privilege(r,t.oid,'MAINTAIN') then
        raise exception '% still has MAINTAIN on %',r,t.relname;end if;
    end loop;
  end loop;
  foreach f in array array['after_mission_submission_review','after_squad_insert_add_leader',
    'after_xp_transaction_award_badges','guard_profile_insert','handle_new_nexus_user','rls_auto_enable'] loop
    foreach r in array array['anon','authenticated'] loop
      if has_function_privilege(r,'public.'||f||'()','EXECUTE') then raise exception '% can directly execute %',r,f;end if;
    end loop;
    if not has_function_privilege('service_role','public.'||f||'()','EXECUTE') then
      raise exception 'Service function access regressed: %',f;end if;
  end loop;
  foreach f in array array['nexus_internal_mode','set_updated_at','guard_profile_update','check_user_skill_limit',
    'guard_squad_update','guard_mission_result_insert','guard_achievement_claim_insert','guard_endorsement_insert',
    'guard_admin_report_insert','guard_admin_report_update','guard_notification_update'] loop
    if not exists(select 1 from pg_proc where oid=('public.'||f||'()')::regprocedure
      and proconfig @> array['search_path=""']) then raise exception 'Search path not pinned: %',f;end if;
  end loop;
  if has_schema_privilege('anon','public','CREATE') or has_schema_privilege('authenticated','public','CREATE') then
    raise exception 'Client may create public schema objects';end if;
  if has_table_privilege('authenticated','public.squads','INSERT')
    or has_table_privilege('authenticated','public.squad_requirements','INSERT')
    or has_table_privilege('authenticated','public.squad_applications','INSERT')
    or has_table_privilege('authenticated','public.squad_applications','UPDATE') then
    raise exception 'RPC-only write boundary regressed';end if;
end;
$test$;
select 'PASS: maintenance denied; RLS and RPC boundaries retained; internal entry points restricted; search paths pinned' as result;
