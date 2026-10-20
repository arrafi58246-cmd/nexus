-- Read-only post-deployment structural checks. Runtime behavior tests still
-- require authorized test users and disposable Mission fixtures.
select
  check_name,
  passed,
  observed
from (
  select
    'MIS-03 columns are nullable smallint without defaults'::text as check_name,
    pg_catalog.count(*) = 4
      and pg_catalog.bool_and(column_default is null)
      and pg_catalog.bool_and(is_nullable = 'YES')
      and pg_catalog.bool_and(udt_name = 'int2') as passed,
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'table', table_name,
        'column', column_name,
        'nullable', is_nullable,
        'type', udt_name,
        'default', column_default
      ) order by table_name, column_name
    ) as observed
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('missions', 'mission_submissions')
    and column_name in ('min_anggota_tim', 'max_anggota_tim')

  union all

  select
    'approved legacy fixture limits are exact',
    pg_catalog.count(*) = 2
      and pg_catalog.bool_and(
        case mission_id
          when 'b0cf942a-aee0-4533-99c8-b7539d7132f8'::uuid
            then min_anggota_tim = 3 and max_anggota_tim = 5
          when 'ec25cbda-7b36-4cbf-b044-f6da49789e6d'::uuid
            then min_anggota_tim = 3 and max_anggota_tim = 3
          else false
        end
      ),
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'mission_id', mission_id,
        'min', min_anggota_tim,
        'max', max_anggota_tim
      ) order by mission_id
    )
  from public.missions
  where mission_id in (
    'b0cf942a-aee0-4533-99c8-b7539d7132f8'::uuid,
    'ec25cbda-7b36-4cbf-b044-f6da49789e6d'::uuid
  )

  union all

  select
    'create_squad signature and hardened execution privileges',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(p.prosecdef)
      and pg_catalog.bool_and(
        pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      )
      and pg_catalog.bool_and(
        p.proconfig = array['search_path=']
        or p.proconfig = array['search_path=""']
      )
      and pg_catalog.bool_and(
        not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      )
      and pg_catalog.bool_and(
        not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              p.proacl,
              pg_catalog.acldefault('f', p.proowner)
            )
          ) as acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        )
      )
      and pg_catalog.bool_and(
        pg_catalog.has_function_privilege(
          'authenticated', p.oid, 'EXECUTE'
        )
      ),
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
        'security_definer', p.prosecdef,
        'owner', pg_catalog.pg_get_userbyid(p.proowner),
        'settings', p.proconfig,
        'public_execute', exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              p.proacl,
              pg_catalog.acldefault('f', p.proowner)
            )
          ) as acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        ),
        'anon_execute', pg_catalog.has_function_privilege(
          'anon', p.oid, 'EXECUTE'
        ),
        'authenticated_execute', pg_catalog.has_function_privilege(
          'authenticated', p.oid, 'EXECUTE'
        )
      )
    )
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_squad'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) =
      'p_mission_id uuid, p_nama_squad text, p_deskripsi_squad text, p_kapasitas_anggota smallint, p_requirements jsonb'

  union all

  select
    'MIS-03 Mission triggers exist and are enabled',
    pg_catalog.count(*) = 2
      and pg_catalog.bool_and(trg.tgenabled <> 'D'),
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'trigger', trg.tgname,
        'enabled', trg.tgenabled
      ) order by trg.tgname
    )
  from pg_catalog.pg_trigger as trg
  join pg_catalog.pg_class as relation
    on relation.oid = trg.tgrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'missions'
    and trg.tgname in (
      'missions_guard_team_size_insert',
      'missions_guard_team_size_update'
    )

  union all

  select
    'ordinary roles have no direct Squad INSERT',
    not pg_catalog.has_table_privilege('anon', 'public.squads', 'INSERT')
      and not pg_catalog.has_table_privilege(
        'authenticated', 'public.squads', 'INSERT'
      )
      and not pg_catalog.has_table_privilege(
        'anon', 'public.squad_requirements', 'INSERT'
      )
      and not pg_catalog.has_table_privilege(
        'authenticated', 'public.squad_requirements', 'INSERT'
      ),
    pg_catalog.jsonb_build_object(
      'anon_squads', pg_catalog.has_table_privilege(
        'anon', 'public.squads', 'INSERT'
      ),
      'authenticated_squads', pg_catalog.has_table_privilege(
        'authenticated', 'public.squads', 'INSERT'
      ),
      'anon_requirements', pg_catalog.has_table_privilege(
        'anon', 'public.squad_requirements', 'INSERT'
      ),
      'authenticated_requirements', pg_catalog.has_table_privilege(
        'authenticated', 'public.squad_requirements', 'INSERT'
      )
    )
) as checks
order by check_name;
