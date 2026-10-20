-- Run after the Phase 1 migration and before the legacy backfill.
-- Replace the zero UUID with a dedicated ACTIVE, onboarded test account UUID.
-- This transaction never persists data.
begin;

do $test$
declare
  v_user_id constant uuid :=
    '00000000-0000-0000-0000-000000000000'::uuid;
  v_mission_id constant uuid :=
    'b0cf942a-aee0-4533-99c8-b7539d7132f8'::uuid;
  v_primary_class_id bigint;
  v_error_message text;
begin
  if v_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Replace the dedicated test account UUID before running the NULL-limit test';
  end if;

  select profile.primary_class_id
  into v_primary_class_id
  from public.profiles as profile
  where profile.user_id = v_user_id
    and profile.status_akun = 'ACTIVE'
    and profile.primary_class_id is not null;

  if v_primary_class_id is null then
    raise exception 'Dedicated MIS-03 test account is missing, inactive, or has not completed onboarding';
  end if;

  if exists (
    select 1
    from public.squad_members as member
    where member.user_id = v_user_id
      and member.mission_id = v_mission_id
      and member.status_member = 'ACTIVE'
  ) then
    raise exception 'Dedicated MIS-03 test account already has an active membership on the NULL-limit fixture';
  end if;

  if not exists (
    select 1
    from public.missions as mission
    where mission.mission_id = v_mission_id
      and mission.min_anggota_tim is null
      and mission.max_anggota_tim is null
  ) then
    raise exception 'NULL-limit fixture is missing or has already been backfilled';
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_user_id::text, true
  );
  perform pg_catalog.set_config(
    'request.jwt.claim.role', 'authenticated', true
  );

  begin
    perform public.create_squad(
      v_mission_id,
      'MIS03 NULL Limits',
      'Must fail',
      3::smallint,
      pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'primary_class_id', v_primary_class_id,
          'slot_dibutuhkan', 2
        )
      )
    );
    raise exception 'Expected NULL Mission limits to reject Create Squad';
  exception when sqlstate '22023' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Mission team size limits are not configured' then
      raise;
    end if;
  end;

  if exists (
    select 1
    from public.squads
    where mission_id = v_mission_id
      and nama_squad = 'MIS03 NULL Limits'
  ) then
    raise exception 'NULL-limit rejection left a partial Squad';
  end if;
end;
$test$;

rollback;
