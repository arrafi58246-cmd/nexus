-- Audited public application objects only. Preserve CRUD, service-role powers,
-- RLS policies, function bodies, triggers, FK constraints and all application data.
-- Table maintenance/DDL is not a client feature, including for an app ADMIN.
do $migration$
declare
  v_targets text[] := array['achievement_claims',
    'admin_reports',
    'badge_definitions',
    'career_xp_totals',
    'current_seasonal_xp_totals',
    'endorsements',
    'fakultas',
    'leaderboard_fakultas',
    'leaderboard_program_studi',
    'leaderboard_universitas',
    'mission_result_submissions',
    'mission_submissions',
    'mission_tiers',
    'missions',
    'notifications',
    'primary_classes',
    'profiles',
    'program_studi',
    'public_profiles',
    'rank_milestones',
    'rank_rules',
    'season_leaderboard_history',
    'season_user_history',
    'seasons',
    'skills',
    'squad_applications',
    'squad_members',
    'squad_messages',
    'squad_requirements',
    'squads',
    'user_badges',
    'user_skills',
    'xp_rules',
    'xp_transactions'];
  v_table text; v_role text; v_priv text; v_key text;
  v_before jsonb := '{}'::jsonb;
  v_rls_before jsonb;
  v_policies_before jsonb;
begin
  select jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,c.relforcerowsecurity) order by c.relname)
    into v_rls_before from pg_class c where c.relnamespace='public'::regnamespace and c.relname=any(v_targets);
  select jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname) into v_policies_before
    from pg_policies p where p.schemaname='public';
  foreach v_table in array v_targets loop
    foreach v_role in array array['anon','authenticated','service_role'] loop
      foreach v_priv in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if v_role='service_role' or v_priv in ('SELECT','INSERT','UPDATE','DELETE') then
          v_key:=v_role||':'||v_table||':'||v_priv;
          v_before:=v_before||jsonb_build_object(v_key,has_table_privilege(v_role,format('public.%I',v_table),v_priv));
        end if;
      end loop;
      if v_role='service_role' and current_setting('server_version_num')::integer>=170000 then
        v_before:=v_before||jsonb_build_object(v_role||':'||v_table||':MAINTAIN',has_table_privilege(v_role,format('public.%I',v_table),'MAINTAIN'));
      end if;
    end loop;
    execute format('revoke truncate, references, trigger on table public.%I from public, anon, authenticated',v_table);
    if current_setting('server_version_num')::integer>=170000 then
      execute format('revoke maintain on table public.%I from public, anon, authenticated',v_table);
    end if;
  end loop;
  -- Reject the whole migration if inherited grants remain or app/service access changes.
  foreach v_table in array v_targets loop
    foreach v_role in array array['anon','authenticated'] loop
      foreach v_priv in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(v_role,format('public.%I',v_table),v_priv) then
          raise exception 'Unexpected inherited client privilege: % % %',v_role,v_table,v_priv;
        end if;
      end loop;
      if current_setting('server_version_num')::integer>=170000
        and has_table_privilege(v_role,format('public.%I',v_table),'MAINTAIN') then
        raise exception 'Unexpected inherited client MAINTAIN on %',v_table;
      end if;
    end loop;
  end loop;
  for v_key in select jsonb_object_keys(v_before) loop
    if has_table_privilege(split_part(v_key,':',1),format('public.%I',split_part(v_key,':',2)),split_part(v_key,':',3))
      is distinct from (v_before->>v_key)::boolean then
      raise exception 'CRUD/service access changed: %',v_key;
    end if;
  end loop;
  if v_rls_before is distinct from (select jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,c.relforcerowsecurity) order by c.relname)
      from pg_class c where c.relnamespace='public'::regnamespace and c.relname=any(v_targets))
    or v_policies_before is distinct from (select jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname)
      from pg_policies p where p.schemaname='public') then
    raise exception 'RLS or policies changed unexpectedly';
  end if;
end;
$migration$;

-- All 11 bodies were inspected: application objects already schema-qualified;
-- remaining unqualified calls are PostgreSQL built-ins. Bodies remain unchanged.
alter function public.nexus_internal_mode() set search_path = '';
alter function public.set_updated_at() set search_path = '';
alter function public.guard_profile_update() set search_path = '';
alter function public.check_user_skill_limit() set search_path = '';
alter function public.guard_squad_update() set search_path = '';
alter function public.guard_mission_result_insert() set search_path = '';
alter function public.guard_achievement_claim_insert() set search_path = '';
alter function public.guard_endorsement_insert() set search_path = '';
alter function public.guard_admin_report_insert() set search_path = '';
alter function public.guard_admin_report_update() set search_path = '';
alter function public.guard_notification_update() set search_path = '';

-- Trigger/event-trigger entry points are not application RPCs. Existing triggers
-- continue running; their owner/service privileges are preserved.
revoke execute on function public.after_mission_submission_review(),
  public.after_squad_insert_add_leader(),
  public.after_xp_transaction_award_badges(),
  public.guard_profile_insert(),
  public.handle_new_nexus_user(),
  public.rls_auto_enable()
  from public, anon, authenticated;

do $verify$
declare f text; r text;
begin
  foreach f in array array['after_mission_submission_review','after_squad_insert_add_leader',
    'after_xp_transaction_award_badges','guard_profile_insert','handle_new_nexus_user','rls_auto_enable'] loop
    foreach r in array array['anon','authenticated'] loop
      if has_function_privilege(r,'public.'||f||'()','EXECUTE') then
        raise exception 'Client execution retained on internal function %',f;
      end if;
    end loop;
    if not has_function_privilege('service_role','public.'||f||'()','EXECUTE') then
      raise exception 'Service execution lost on internal function %',f;
    end if;
  end loop;
end;
$verify$;
