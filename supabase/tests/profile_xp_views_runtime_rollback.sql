-- Run as database owner. SQL role/JWT tests, not Auth/browser E2E.
-- Existing dedicated QA student changes stay inside this rollback transaction.
begin;
set local statement_timeout = '30s';
do $test$
declare
  owner_role text := current_setting('role');
  student uuid; admin_id uuid; caller uuid; view_name text; privilege text;
  expected_profiles jsonb; expected_xp jsonb; actual jsonb;
begin
  select user_id into student from public.profiles
  where nama_lengkap like 'Mahasiswa Test NEXUS%' and role_app = 'STUDENT'
    and status_akun = 'ACTIVE' order by user_id limit 1;
  select user_id into admin_id from public.profiles
  where role_app = 'ADMIN' and status_akun = 'ACTIVE' order by user_id limit 1;
  if student is null or admin_id is null then
    raise exception 'Requires a dedicated active QA Student and active Admin';
  end if;
  select jsonb_agg(to_jsonb(p) order by user_id) into expected_profiles
    from public.public_profiles p;
  select jsonb_agg(to_jsonb(x) order by user_id) into expected_xp
    from public.career_xp_totals x;
  if expected_profiles is null or expected_xp is null then
    raise exception 'Empty fixtures would make this test vacuous';
  end if;

  foreach caller in array array[student, admin_id] loop
    perform set_config('request.jwt.claim.sub', caller::text, true);
    perform set_config('request.jwt.claims',
      jsonb_build_object('sub', caller, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select jsonb_agg(to_jsonb(p) order by user_id) into actual
      from public.public_profiles p;
    if actual is distinct from expected_profiles then
      raise exception 'ACTIVE caller public profile output changed';
    end if;
    select jsonb_agg(to_jsonb(x) order by user_id) into actual
      from public.career_xp_totals x;
    if actual is distinct from expected_xp then
      raise exception 'ACTIVE caller Career XP output changed';
    end if;
    perform set_config('role', owner_role, true);
  end loop;

  -- A valid authenticated role alone is not an ACTIVE NEXUS account.
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', current_setting('request.jwt.claim.sub'), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if exists(select 1 from public.public_profiles)
    or exists(select 1 from public.career_xp_totals) then
    raise exception 'Missing-profile caller read display views';
  end if;
  perform set_config('role', owner_role, true);

  -- Keep JWT unchanged across suspension to test stale-token enforcement.
  perform set_config('request.jwt.claim.sub', student::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', student, 'role', 'authenticated')::text, true);
  perform set_config('nexus.internal', '1', true);
  -- Legacy QA emails may fail the current role/domain CHECK on any UPDATE.
  update public.profiles set status_akun = 'SUSPENDED',
    email_unesa = student::text || '@mhs.unesa.ac.id' where user_id = student;
  perform set_config('nexus.internal', '', true);
  perform set_config('role', 'authenticated', true);
  if public.is_active_user() or exists(select 1 from public.public_profiles)
    or exists(select 1 from public.career_xp_totals) then
    raise exception 'Suspended caller read display views';
  end if;
  perform set_config('role', owner_role, true);
  perform set_config('nexus.internal', '1', true);
  update public.profiles set status_akun = 'ACTIVE' where user_id = student;
  perform set_config('nexus.internal', '', true);
  perform set_config('role', 'authenticated', true);
  if not exists(select 1 from public.public_profiles where user_id = student)
    or not exists(select 1 from public.career_xp_totals where user_id = student) then
    raise exception 'Reactivated caller access not restored';
  end if;
  perform set_config('role', owner_role, true);

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
  select jsonb_agg(to_jsonb(x) order by user_id) into actual
    from public.career_xp_totals x;
  if actual is distinct from expected_xp then raise exception 'Service XP access changed'; end if;
  select jsonb_agg(to_jsonb(p) order by user_id) into actual from public.public_profiles p;
  if actual is distinct from expected_profiles then raise exception 'Service profile access changed'; end if;
  perform set_config('role', owner_role, true);

  foreach view_name in array array['public_profiles', 'career_xp_totals'] loop
    if has_table_privilege('anon', 'public.' || view_name, 'SELECT') then
      raise exception 'Anonymous view read permitted: %', view_name;
    end if;
    foreach privilege in array array['INSERT', 'UPDATE', 'DELETE'] loop
      if has_table_privilege('authenticated', 'public.' || view_name, privilege) then
        raise exception 'Client view write permitted: % %', view_name, privilege;
      end if;
    end loop;
    if not exists(select 1 from pg_class where oid = ('public.' || view_name)::regclass
      and reloptions @> array['security_barrier=true']) then
      raise exception 'Missing view security barrier: %', view_name;
    end if;
  end loop;
end;
$test$;
rollback;
select 'PASS: ACTIVE Student/Admin/service output preserved; missing-profile and suspended callers denied; reactivation restored; fixtures rolled back' as result;
