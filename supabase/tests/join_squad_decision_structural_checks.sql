-- Read-only structural checks for Join Squad Tahap B.
-- Run after 20260908020000_harden_squad_application_decisions.sql.
with target_functions as (
  select
    proc.oid,
    proc.proname,
    proc.proowner,
    proc.prosecdef,
    proc.provolatile,
    proc.proconfig,
    proc.proacl,
    pg_catalog.pg_get_function_identity_arguments(proc.oid) as arguments,
    pg_catalog.pg_get_function_result(proc.oid) as result,
    pg_catalog.pg_get_functiondef(proc.oid) as definition,
    proc.prosrc as source
  from pg_catalog.pg_proc as proc
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = proc.pronamespace
  where namespace.nspname = 'public'
    and (
      (
        proc.proname = 'cancel_squad_application'
        and pg_catalog.pg_get_function_identity_arguments(proc.oid) =
          'p_application_id uuid'
      )
      or (
        proc.proname = 'decide_squad_application'
        and pg_catalog.pg_get_function_identity_arguments(proc.oid) =
          'p_application_id uuid, p_decision text'
      )
      or (
        proc.proname = 'get_leader_pending_squad_applications'
        and pg_catalog.pg_get_function_identity_arguments(proc.oid) =
          'p_mission_id uuid'
      )
    )
),
decision_function as (
  select *
  from target_functions
  where proname = 'decide_squad_application'
),
cancel_function as (
  select *
  from target_functions
  where proname = 'cancel_squad_application'
),
leader_read_function as (
  select *
  from target_functions
  where proname = 'get_leader_pending_squad_applications'
)
select check_name, passed, observed
from (
  select
    'Tahap B function signatures and security settings'::text as check_name,
    pg_catalog.count(*) = 3
      and pg_catalog.bool_and(fn.prosecdef)
      and pg_catalog.bool_and(
        pg_catalog.pg_get_userbyid(fn.proowner) = 'postgres'
      )
      and pg_catalog.bool_and(
        fn.proconfig = array['search_path=']
        or fn.proconfig = array['search_path=""']
      )
      and pg_catalog.bool_and(
        case fn.proname
          when 'get_leader_pending_squad_applications'
            then fn.provolatile = 's'
          else fn.provolatile = 'v'
        end
      ),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'function', fn.proname,
          'arguments', fn.arguments,
          'result', fn.result,
          'owner', pg_catalog.pg_get_userbyid(fn.proowner),
          'security_definer', fn.prosecdef,
          'volatility', fn.provolatile,
          'settings', fn.proconfig
        ) order by fn.proname
      ),
      '[]'::jsonb
    )
  from target_functions as fn

  union all

  select
    'Tahap B function execute ACL',
    pg_catalog.count(*) = 3
      and pg_catalog.bool_and(
        not pg_catalog.has_function_privilege(
          'anon', fn.oid, 'EXECUTE'
        )
      )
      and pg_catalog.bool_and(
        pg_catalog.has_function_privilege(
          'authenticated', fn.oid, 'EXECUTE'
        )
      )
      and pg_catalog.bool_and(
        not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              fn.proacl,
              pg_catalog.acldefault('f', fn.proowner)
            )
          ) as acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        )
      ),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'function', fn.proname,
          'public_execute', exists (
            select 1
            from pg_catalog.aclexplode(
              coalesce(
                fn.proacl,
                pg_catalog.acldefault('f', fn.proowner)
              )
            ) as acl
            where acl.grantee = 0
              and acl.privilege_type = 'EXECUTE'
          ),
          'anon_execute', pg_catalog.has_function_privilege(
            'anon', fn.oid, 'EXECUTE'
          ),
          'authenticated_execute', pg_catalog.has_function_privilege(
            'authenticated', fn.oid, 'EXECUTE'
          )
        ) order by fn.proname
      ),
      '[]'::jsonb
    )
  from target_functions as fn

  union all

  select
    'ordinary roles cannot INSERT or UPDATE applications directly',
    not pg_catalog.has_table_privilege(
      'anon', 'public.squad_applications', 'INSERT'
    )
      and not pg_catalog.has_table_privilege(
        'anon', 'public.squad_applications', 'UPDATE'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', 'public.squad_applications', 'INSERT'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', 'public.squad_applications', 'UPDATE'
      )
      and not exists (
        select 1
        from pg_catalog.pg_class as relation
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = relation.relnamespace
        cross join lateral pg_catalog.aclexplode(
          coalesce(
            relation.relacl,
            pg_catalog.acldefault('r', relation.relowner)
          )
        ) as acl
        where namespace.nspname = 'public'
          and relation.relname = 'squad_applications'
          and acl.grantee = 0
          and acl.privilege_type in ('INSERT', 'UPDATE')
      ),
    pg_catalog.jsonb_build_object(
      'anon_insert', pg_catalog.has_table_privilege(
        'anon', 'public.squad_applications', 'INSERT'
      ),
      'anon_update', pg_catalog.has_table_privilege(
        'anon', 'public.squad_applications', 'UPDATE'
      ),
      'authenticated_insert', pg_catalog.has_table_privilege(
        'authenticated', 'public.squad_applications', 'INSERT'
      ),
      'authenticated_update', pg_catalog.has_table_privilege(
        'authenticated', 'public.squad_applications', 'UPDATE'
      )
    )

  union all

  select
    'application RLS, read policy, and insert guard remain active',
    relation.relrowsecurity
      and pg_catalog.count(distinct pol.polname)
        filter (where pol.polname = 'squad_applications_read_relevant') = 1
      and pg_catalog.count(distinct trg.tgname)
        filter (where trg.tgname = 'squad_applications_guard_insert') = 1
      and coalesce(
        pg_catalog.bool_and(trg.tgenabled <> 'D')
          filter (where trg.tgname = 'squad_applications_guard_insert'),
        false
      ),
    pg_catalog.jsonb_build_object(
      'rls_enabled', relation.relrowsecurity,
      'read_policy', pg_catalog.count(distinct pol.polname)
        filter (where pol.polname = 'squad_applications_read_relevant'),
      'enabled_insert_guard', pg_catalog.count(distinct trg.tgname)
        filter (
          where trg.tgname = 'squad_applications_guard_insert'
            and trg.tgenabled <> 'D'
        )
    )
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  left join pg_catalog.pg_policy as pol
    on pol.polrelid = relation.oid
  left join pg_catalog.pg_trigger as trg
    on trg.tgrelid = relation.oid
    and not trg.tgisinternal
  where namespace.nspname = 'public'
    and relation.relname = 'squad_applications'
  group by relation.relrowsecurity

  union all

  select
    'decision and membership integrity objects remain valid',
    (
      select pg_catalog.count(*) = 2
      from pg_catalog.pg_constraint as con
      join pg_catalog.pg_class as relation
        on relation.oid = con.conrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'squad_applications'
        and con.conname in (
          'squad_applications_decision_shape',
          'squad_applications_squad_mission_fk'
        )
        and con.convalidated
    )
      and (
        select pg_catalog.count(*) = 1
        from pg_catalog.pg_index as idx
        join pg_catalog.pg_class as index_relation
          on index_relation.oid = idx.indexrelid
        join pg_catalog.pg_class as table_relation
          on table_relation.oid = idx.indrelid
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = table_relation.relnamespace
        where namespace.nspname = 'public'
          and table_relation.relname = 'squad_members'
          and index_relation.relname =
            'squad_members_one_active_squad_per_mission_uq'
          and idx.indisunique
          and idx.indisvalid
          and idx.indisready
      ),
    pg_catalog.jsonb_build_object(
      'decision_shape', exists (
        select 1
        from pg_catalog.pg_constraint
        where conname = 'squad_applications_decision_shape'
          and convalidated
      ),
      'active_membership_unique', exists (
        select 1
        from pg_catalog.pg_class
        where relname = 'squad_members_one_active_squad_per_mission_uq'
      )
    )

  union all

  select
    'decision function has deterministic locks and acceptance guards',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        position(
          'pg_catalog.pg_advisory_xact_lock'
          in lower(fn.definition)
        ) > 0
      )
      and pg_catalog.bool_and(
        position(
          'pg_catalog.pg_advisory_xact_lock'
          in lower(fn.definition)
        ) < position(
          'order by application.application_id'
          in lower(fn.definition)
        )
      )
      and pg_catalog.bool_and(
        position(
          'order by application.application_id'
          in lower(fn.definition)
        ) > 0
      )
      and pg_catalog.bool_and(
        position(
          'order by application.application_id'
          in lower(fn.definition)
        ) < position('into v_squad' in lower(fn.definition))
      )
      and pg_catalog.bool_and(
        position('v_decision is null' in lower(fn.definition)) > 0
      )
      and pg_catalog.bool_and(
        position(
          'the mission registration deadline has passed'
          in lower(fn.definition)
        ) > 0
      )
      and pg_catalog.bool_and(
        position(
          'applicant account is not active'
          in lower(fn.definition)
        ) > 0
      )
      and pg_catalog.bool_and(
        position(
          'applicant already has an active squad for this mission'
          in lower(fn.definition)
        ) > 0
      ),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'applicant_advisory_lock', position(
            'pg_catalog.pg_advisory_xact_lock'
            in lower(fn.definition)
          ),
          'ordered_application_lock', position(
            'order by application.application_id'
            in lower(fn.definition)
          ),
          'locked_squad', position(
            'into v_squad'
            in lower(fn.definition)
          ),
          'profile_lock', position(
            'from public.profiles as profile'
            in lower(fn.definition)
          )
        )
      ),
      '[]'::jsonb
    )
  from decision_function as fn

  union all

  select
    'cancel function locks and permits only Pending transition',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        position(
          'pg_catalog.pg_advisory_xact_lock'
          in lower(fn.definition)
        ) > 0
      )
      and pg_catalog.bool_and(
        position('for update' in lower(fn.definition)) > 0
      )
      and pg_catalog.bool_and(
        position(
          'only a pending application can be cancelled'
          in lower(fn.definition)
        ) > 0
      )
      and pg_catalog.bool_and(
        position(
          'only the applicant or admin may cancel this application'
          in lower(fn.definition)
        ) > 0
      ),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'applicant_advisory_lock', position(
            'pg_catalog.pg_advisory_xact_lock'
            in lower(fn.definition)
          ),
          'application_lock', position(
            'for update' in lower(fn.definition)
          )
        )
      ),
      '[]'::jsonb
    )
  from cancel_function as fn

  union all

  select
    'cancel restores internal mode on its success path',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        position(
          $token$v_internal_mode := pg_catalog.current_setting('nexus.internal', true)$token$
          in lower(fn.source)
        ) > 0
      )
      and pg_catalog.bool_and(
        position(
          $token$v_internal_mode := pg_catalog.current_setting('nexus.internal', true)$token$
          in lower(fn.source)
        ) < position(
          $token$pg_catalog.set_config('nexus.internal', '1', true)$token$
          in lower(fn.source)
        )
      )
      and pg_catalog.bool_and(
        pg_catalog.regexp_count(
          lower(fn.source),
          $pattern$pg_catalog\.set_config\('nexus\.internal', '1', true\)$pattern$
        ) = 1
      )
      and pg_catalog.bool_and(
        pg_catalog.regexp_count(
          lower(fn.source),
          $pattern$pg_catalog\.set_config\(\s*'nexus\.internal',\s*coalesce\(v_internal_mode, ''\),\s*true\s*\)$pattern$
        ) = 1
      )
      and pg_catalog.bool_and(
        position(
          $token$pg_catalog.set_config('nexus.internal', '1', true)$token$
          in lower(fn.source)
        ) < position(
          'update public.squad_applications'
          in lower(fn.source)
        )
      )
      and pg_catalog.bool_and(
        position(
          'update public.squad_applications'
          in lower(fn.source)
        ) < position(
          $token$coalesce(v_internal_mode, '')$token$
          in lower(fn.source)
        )
      ),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'enable_count', pg_catalog.regexp_count(
            lower(fn.source),
            $pattern$pg_catalog\.set_config\('nexus\.internal', '1', true\)$pattern$
          ),
          'restore_count', pg_catalog.regexp_count(
            lower(fn.source),
            $pattern$pg_catalog\.set_config\(\s*'nexus\.internal',\s*coalesce\(v_internal_mode, ''\),\s*true\s*\)$pattern$
          )
        )
      ),
      '[]'::jsonb
    )
  from cancel_function as fn

  union all

  select
    'decision restores internal mode on REJECTED and ACCEPTED success paths',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        position(
          $token$v_internal_mode := pg_catalog.current_setting('nexus.internal', true)$token$
          in lower(fn.source)
        ) > 0
      )
      and pg_catalog.bool_and(
        position(
          $token$v_internal_mode := pg_catalog.current_setting('nexus.internal', true)$token$
          in lower(fn.source)
        ) < position(
          $token$pg_catalog.set_config('nexus.internal', '1', true)$token$
          in lower(fn.source)
        )
      )
      and pg_catalog.bool_and(
        pg_catalog.regexp_count(
          lower(fn.source),
          $pattern$pg_catalog\.set_config\('nexus\.internal', '1', true\)$pattern$
        ) = 2
      )
      and pg_catalog.bool_and(
        pg_catalog.regexp_count(
          lower(fn.source),
          $pattern$pg_catalog\.set_config\(\s*'nexus\.internal',\s*coalesce\(v_internal_mode, ''\),\s*true\s*\)$pattern$
        ) = 2
      )
      and pg_catalog.bool_and(
        pg_catalog.regexp_count(
          pg_catalog.split_part(lower(fn.source), 'return;', 1),
          $pattern$pg_catalog\.set_config\('nexus\.internal', '1', true\)$pattern$
        ) = 1
      )
      and pg_catalog.bool_and(
        pg_catalog.regexp_count(
          pg_catalog.split_part(lower(fn.source), 'return;', 1),
          $pattern$pg_catalog\.set_config\(\s*'nexus\.internal',\s*coalesce\(v_internal_mode, ''\),\s*true\s*\)$pattern$
        ) = 1
      )
      and pg_catalog.bool_and(
        pg_catalog.regexp_count(
          pg_catalog.split_part(lower(fn.source), 'return;', 2),
          $pattern$pg_catalog\.set_config\('nexus\.internal', '1', true\)$pattern$
        ) = 1
      )
      and pg_catalog.bool_and(
        pg_catalog.regexp_count(
          pg_catalog.split_part(lower(fn.source), 'return;', 2),
          $pattern$pg_catalog\.set_config\(\s*'nexus\.internal',\s*coalesce\(v_internal_mode, ''\),\s*true\s*\)$pattern$
        ) = 1
      )
      and pg_catalog.bool_and(
        position(
          $token$pg_catalog.set_config('nexus.internal', '1', true)$token$
          in pg_catalog.split_part(lower(fn.source), 'return;', 1)
        ) < position(
          'update public.squad_applications'
          in pg_catalog.split_part(lower(fn.source), 'return;', 1)
        )
      )
      and pg_catalog.bool_and(
        position(
          'insert into public.notifications'
          in pg_catalog.split_part(lower(fn.source), 'return;', 1)
        ) < position(
          $token$coalesce(v_internal_mode, '')$token$
          in pg_catalog.split_part(lower(fn.source), 'return;', 1)
        )
      )
      and pg_catalog.bool_and(
        position(
          $token$pg_catalog.set_config('nexus.internal', '1', true)$token$
          in pg_catalog.split_part(lower(fn.source), 'return;', 2)
        ) < position(
          'insert into public.squad_members'
          in pg_catalog.split_part(lower(fn.source), 'return;', 2)
        )
      )
      and pg_catalog.bool_and(
        position(
          'insert into public.notifications'
          in pg_catalog.split_part(lower(fn.source), 'return;', 2)
        ) < position(
          $token$coalesce(v_internal_mode, '')$token$
          in pg_catalog.split_part(lower(fn.source), 'return;', 2)
        )
      ),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'enable_count', pg_catalog.regexp_count(
            lower(fn.source),
            $pattern$pg_catalog\.set_config\('nexus\.internal', '1', true\)$pattern$
          ),
          'restore_count', pg_catalog.regexp_count(
            lower(fn.source),
            $pattern$pg_catalog\.set_config\(\s*'nexus\.internal',\s*coalesce\(v_internal_mode, ''\),\s*true\s*\)$pattern$
          ),
          'rejected_restore_after_notification', position(
            $token$coalesce(v_internal_mode, '')$token$
            in pg_catalog.split_part(lower(fn.source), 'return;', 1)
          ),
          'accepted_restore_after_notification', position(
            $token$coalesce(v_internal_mode, '')$token$
            in pg_catalog.split_part(lower(fn.source), 'return;', 2)
          )
        )
      ),
      '[]'::jsonb
    )
  from decision_function as fn

  union all

  select
    'leader projection is Pending-only and ownership-scoped',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        position(
          'squad.ketua_id = auth.uid()'
          in lower(fn.definition)
        ) > 0
      )
      and pg_catalog.bool_and(
        position(
          '''pending''::public.application_status_enum'
          in lower(fn.definition)
        ) > 0
      )
      and pg_catalog.bool_and(
        fn.result =
          'TABLE(application_id uuid, squad_id uuid, applicant_name text, primary_class_name text, created_at timestamp with time zone)'
      ),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'result', fn.result,
          'owner_filter', position(
            'squad.ketua_id = auth.uid()'
            in lower(fn.definition)
          )
        )
      ),
      '[]'::jsonb
    )
  from leader_read_function as fn
) as checks
order by check_name;
