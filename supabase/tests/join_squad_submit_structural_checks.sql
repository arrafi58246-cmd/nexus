-- Read-only checks for Join Squad Tahap A. Run after applying
-- 20260908010000_submit_squad_application.sql.
with rpc as (
  select
    proc.oid,
    proc.proowner,
    proc.prosecdef,
    proc.provolatile,
    proc.proconfig,
    proc.proacl,
    pg_catalog.pg_get_functiondef(proc.oid) as definition
  from pg_catalog.pg_proc as proc
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = proc.pronamespace
  where namespace.nspname = 'public'
    and proc.proname = 'submit_squad_application'
    and pg_catalog.pg_get_function_identity_arguments(proc.oid) =
      'p_squad_id uuid'
    and pg_catalog.pg_get_function_result(proc.oid) = 'uuid'
)
select check_name, passed, observed
from (
  select
    'submit RPC signature and security settings'::text as check_name,
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(rpc.prosecdef)
      and pg_catalog.bool_and(rpc.provolatile = 'v')
      and pg_catalog.bool_and(
        pg_catalog.pg_get_userbyid(rpc.proowner) = 'postgres'
      )
      and pg_catalog.bool_and(
        rpc.proconfig = array['search_path=']
        or rpc.proconfig = array['search_path=""']
      ) as passed,
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'owner', pg_catalog.pg_get_userbyid(rpc.proowner),
          'security_definer', rpc.prosecdef,
          'volatility', rpc.provolatile,
          'settings', rpc.proconfig
        )
      ),
      '[]'::jsonb
    ) as observed
  from rpc

  union all

  select
    'submit RPC execute ACL',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        not pg_catalog.has_function_privilege('anon', rpc.oid, 'EXECUTE')
      )
      and pg_catalog.bool_and(
        pg_catalog.has_function_privilege(
          'authenticated', rpc.oid, 'EXECUTE'
        )
      )
      and pg_catalog.bool_and(
        not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              rpc.proacl,
              pg_catalog.acldefault('f', rpc.proowner)
            )
          ) as acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        )
      ),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'public_execute', exists (
            select 1
            from pg_catalog.aclexplode(
              coalesce(
                rpc.proacl,
                pg_catalog.acldefault('f', rpc.proowner)
              )
            ) as acl
            where acl.grantee = 0
              and acl.privilege_type = 'EXECUTE'
          ),
          'anon_execute', pg_catalog.has_function_privilege(
            'anon', rpc.oid, 'EXECUTE'
          ),
          'authenticated_execute', pg_catalog.has_function_privilege(
            'authenticated', rpc.oid, 'EXECUTE'
          )
        )
      ),
      '[]'::jsonb
    )
  from rpc

  union all

  select
    'ordinary roles have no direct application INSERT',
    not pg_catalog.has_table_privilege(
      'anon', 'public.squad_applications', 'INSERT'
    )
      and not pg_catalog.has_table_privilege(
        'authenticated', 'public.squad_applications', 'INSERT'
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
          and acl.privilege_type = 'INSERT'
      ),
    pg_catalog.jsonb_build_object(
      'public_insert', exists (
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
          and acl.privilege_type = 'INSERT'
      ),
      'anon_insert', pg_catalog.has_table_privilege(
        'anon', 'public.squad_applications', 'INSERT'
      ),
      'authenticated_insert', pg_catalog.has_table_privilege(
        'authenticated', 'public.squad_applications', 'INSERT'
      )
    )

  union all

  select
    'application guard trigger is enabled',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(trg.tgenabled <> 'D')
      and pg_catalog.bool_and(fn.proname = 'guard_squad_application_insert'),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'trigger', trg.tgname,
          'enabled', trg.tgenabled,
          'function', fn.proname
        )
      ),
      '[]'::jsonb
    )
  from pg_catalog.pg_trigger as trg
  join pg_catalog.pg_class as relation on relation.oid = trg.tgrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  join pg_catalog.pg_proc as fn on fn.oid = trg.tgfoid
  where namespace.nspname = 'public'
    and relation.relname = 'squad_applications'
    and trg.tgname = 'squad_applications_guard_insert'
    and not trg.tgisinternal

  union all

  select
    'pending duplicate unique index remains active',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(idx.indisunique)
      and pg_catalog.bool_and(idx.indisvalid)
      and pg_catalog.bool_and(idx.indisready)
      and pg_catalog.bool_and(idx.indpred is not null),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.pg_get_indexdef(idx.indexrelid)
      ),
      '[]'::jsonb
    )
  from pg_catalog.pg_index as idx
  join pg_catalog.pg_class as index_relation
    on index_relation.oid = idx.indexrelid
  join pg_catalog.pg_class as table_relation
    on table_relation.oid = idx.indrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = table_relation.relnamespace
  where namespace.nspname = 'public'
    and table_relation.relname = 'squad_applications'
    and index_relation.relname =
      'squad_applications_one_pending_per_squad_user_uq'

  union all

  select
    'RPC contains serializer and compatible lock order',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        position(
          'from public.squad_applications as application'
          in lower(rpc.definition)
        ) > 0
      )
      and pg_catalog.bool_and(
        position(
          'from public.squad_applications as application'
          in lower(rpc.definition)
        ) < position(
          'from public.squads as squad'
          in lower(rpc.definition)
        )
      )
      and pg_catalog.bool_and(
        position('from public.profiles as profile' in lower(rpc.definition))
          < position(
            'select pg_catalog.count(*)'
            in lower(rpc.definition)
          )
      )
      and pg_catalog.bool_and(
        position('for update' in lower(rpc.definition)) > 0
      ),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'application_lock_position', position(
            'from public.squad_applications as application'
            in lower(rpc.definition)
          ),
          'squad_lock_position', position(
            'from public.squads as squad'
            in lower(rpc.definition)
          ),
          'profile_lock_position', position(
            'from public.profiles as profile'
            in lower(rpc.definition)
          )
        )
      ),
      '[]'::jsonb
    )
  from rpc
) as checks
order by check_name;
