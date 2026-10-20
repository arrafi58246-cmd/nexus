-- Run only after both MIS-03 migrations and structural checks pass.
-- Every write in this script is rolled back, including disposable Missions,
-- Squads, memberships, and requirements.
begin;

do $test$
declare
  -- Replace this zero UUID with the dedicated test account UUID before run.
  v_user_id constant uuid :=
    '00000000-0000-0000-0000-000000000000'::uuid;
  v_primary_class_id bigint;
  v_range_mission_id constant uuid :=
    'b0cf942a-aee0-4533-99c8-b7539d7132f8'::uuid;
  v_exact_mission_id uuid := pg_catalog.gen_random_uuid();
  v_individual_mission_id uuid := pg_catalog.gen_random_uuid();
  v_squad_id uuid;
  v_error_message text;
  v_source public.missions%rowtype;
begin
  if v_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Replace the dedicated test account UUID before running MIS-03 tests';
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
      and member.mission_id = v_range_mission_id
      and member.status_member = 'ACTIVE'
  ) then
    raise exception 'Dedicated MIS-03 test account already has an active membership on the range fixture';
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', v_user_id::text, true
  );
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

  select * into strict v_source
  from public.missions
  where mission_id = v_range_mission_id;

  -- A bound change that excludes existing capacity-3 Squads must fail.
  begin
    update public.missions
    set min_anggota_tim = 4, max_anggota_tim = 5
    where mission_id = v_range_mission_id;
    raise exception 'Expected incompatible Mission limit change to fail';
  exception when sqlstate '23514' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <>
      'Mission team size limits cannot exclude an existing Squad capacity'
    then
      raise;
    end if;
  end;

  insert into public.missions (
    mission_id, source_submission_id, tier_id, nama_lomba, penyelenggara,
    kategori_penyelenggara, link_resmi, deadline_pendaftaran,
    deadline_lomba, tahun_lomba, kategori_lomba, cakupan_peserta,
    mode_lomba, min_anggota_tim, max_anggota_tim, biaya_pendaftaran,
    deskripsi_singkat, dokumen_path
  ) values (
    v_exact_mission_id, null, v_source.tier_id,
    'MIS-03 Disposable Exact Four ' || v_exact_mission_id::text,
    v_source.penyelenggara, v_source.kategori_penyelenggara,
    'https://example.com/mis03-disposable-exact-four',
    pg_catalog.now() + interval '7 days',
    pg_catalog.now() + interval '14 days',
    extract(year from pg_catalog.now())::smallint,
    v_source.kategori_lomba, v_source.cakupan_peserta,
    v_source.mode_lomba, 4, 4, v_source.biaya_pendaftaran,
    'Disposable MIS-03 exact-size runtime fixture',
    v_source.dokumen_path
  );

  insert into public.missions (
    mission_id, source_submission_id, tier_id, nama_lomba, penyelenggara,
    kategori_penyelenggara, link_resmi, deadline_pendaftaran,
    deadline_lomba, tahun_lomba, kategori_lomba, cakupan_peserta,
    mode_lomba, min_anggota_tim, max_anggota_tim, biaya_pendaftaran,
    deskripsi_singkat, dokumen_path
  ) values (
    v_individual_mission_id, null, v_source.tier_id,
    'MIS-03 Disposable Individual ' || v_individual_mission_id::text,
    v_source.penyelenggara, v_source.kategori_penyelenggara,
    'https://example.com/mis03-disposable-individual',
    pg_catalog.now() + interval '7 days',
    pg_catalog.now() + interval '14 days',
    extract(year from pg_catalog.now())::smallint,
    v_source.kategori_lomba, v_source.cakupan_peserta,
    v_source.mode_lomba, 1, 1, v_source.biaya_pendaftaran,
    'Disposable MIS-03 individual runtime fixture',
    v_source.dokumen_path
  );

  -- Range 3-5: capacity 2 must fail.
  begin
    perform public.create_squad(
      v_range_mission_id, 'MIS03 C2', 'Must fail', 2::smallint,
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'primary_class_id', v_primary_class_id, 'slot_dibutuhkan', 1
      ))
    );
    raise exception 'Expected capacity 2 to fail for range 3-5';
  exception when sqlstate '22023' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Squad capacity is below the Mission minimum' then
      raise;
    end if;
  end;

  -- Range 3-5: capacity 3 succeeds with two requirement slots.
  v_squad_id := public.create_squad(
    v_range_mission_id, 'MIS03 C3', 'Must succeed', 3::smallint,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'primary_class_id', v_primary_class_id, 'slot_dibutuhkan', 2
    ))
  );
  delete from public.squads where squad_id = v_squad_id;

  -- Range 3-5: capacity 5 succeeds with four requirement slots.
  v_squad_id := public.create_squad(
    v_range_mission_id, 'MIS03 C5', 'Must succeed', 5::smallint,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'primary_class_id', v_primary_class_id, 'slot_dibutuhkan', 4
    ))
  );
  delete from public.squads where squad_id = v_squad_id;

  -- Range 3-5: capacity 6 must fail.
  begin
    perform public.create_squad(
      v_range_mission_id, 'MIS03 C6', 'Must fail', 6::smallint,
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'primary_class_id', v_primary_class_id, 'slot_dibutuhkan', 5
      ))
    );
    raise exception 'Expected capacity 6 to fail for range 3-5';
  exception when sqlstate '22023' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Squad capacity is above the Mission maximum' then
      raise;
    end if;
  end;

  -- Exact-size 4: capacity 3 must fail and capacity 4 must succeed.
  begin
    perform public.create_squad(
      v_exact_mission_id, 'MIS03 Exact C3', 'Must fail', 3::smallint,
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'primary_class_id', v_primary_class_id, 'slot_dibutuhkan', 2
      ))
    );
    raise exception 'Expected capacity 3 to fail for exact-size 4';
  exception when sqlstate '22023' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Squad capacity is below the Mission minimum' then
      raise;
    end if;
  end;

  v_squad_id := public.create_squad(
    v_exact_mission_id, 'MIS03 Exact C4', 'Must succeed', 4::smallint,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'primary_class_id', v_primary_class_id, 'slot_dibutuhkan', 3
    ))
  );

  if not exists (
    select 1
    from public.squad_requirements
    where squad_id = v_squad_id
    group by squad_id
    having pg_catalog.sum(slot_dibutuhkan) = 3
  ) then
    raise exception 'Exact-size 4 did not preserve requirements = capacity - 1';
  end if;
  delete from public.squads where squad_id = v_squad_id;

  -- Individual Mission rejects Create Squad.
  begin
    perform public.create_squad(
      v_individual_mission_id, 'MIS03 Individual', 'Must fail', 2::smallint,
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'primary_class_id', v_primary_class_id, 'slot_dibutuhkan', 1
      ))
    );
    raise exception 'Expected individual Mission to reject Create Squad';
  exception when sqlstate '22023' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <> 'Individual Missions do not support Squads' then
      raise;
    end if;
  end;

  -- Invalid requirement total must fail without leaving a partial Squad.
  begin
    perform public.create_squad(
      v_exact_mission_id, 'MIS03 Bad Slots', 'Must roll back', 4::smallint,
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'primary_class_id', v_primary_class_id, 'slot_dibutuhkan', 2
      ))
    );
    raise exception 'Expected invalid requirement total to fail';
  exception when sqlstate '22023' then
    get stacked diagnostics v_error_message = message_text;
    if v_error_message <>
      'Total requirement slots must equal Squad capacity minus one'
    then
      raise;
    end if;
  end;

  if exists (
    select 1 from public.squads
    where mission_id in (v_exact_mission_id, v_individual_mission_id)
  ) then
    raise exception 'A failed MIS-03 test left a partial Squad';
  end if;

  if pg_catalog.has_table_privilege(
    'anon', 'public.squads', 'INSERT'
  ) or pg_catalog.has_table_privilege(
    'authenticated', 'public.squads', 'INSERT'
  ) or pg_catalog.has_table_privilege(
    'anon', 'public.squad_requirements', 'INSERT'
  ) or pg_catalog.has_table_privilege(
    'authenticated', 'public.squad_requirements', 'INSERT'
  ) then
    raise exception 'Direct INSERT protection changed unexpectedly';
  end if;
end;
$test$;

rollback;
