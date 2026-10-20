begin;

create or replace function public.create_squad(
  p_mission_id uuid,
  p_nama_squad text,
  p_deskripsi_squad text,
  p_kapasitas_anggota smallint,
  p_requirements jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_squad_id uuid;
  v_requirement jsonb;
  v_numeric_value numeric;
  v_total_slots numeric;
  v_min_anggota_tim smallint;
  v_max_anggota_tim smallint;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  if public.is_active_user() is not true then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.user_id = v_user_id
      and profile.primary_class_id is not null
  ) then
    raise exception using
      errcode = '42501',
      message = 'Onboarding must be completed before creating a Squad';
  end if;

  if p_mission_id is null then
    raise exception using errcode = '22023', message = 'Mission is required';
  end if;

  select mission.min_anggota_tim, mission.max_anggota_tim
  into v_min_anggota_tim, v_max_anggota_tim
  from public.missions as mission
  where mission.mission_id = p_mission_id
  for share;

  if not found then
    raise exception 'Mission not found';
  end if;

  if v_min_anggota_tim is null or v_max_anggota_tim is null then
    raise exception using
      errcode = '22023',
      message = 'Mission team size limits are not configured';
  end if;

  if v_max_anggota_tim = 1 then
    raise exception using
      errcode = '22023',
      message = 'Individual Missions do not support Squads';
  end if;

  if p_kapasitas_anggota is null or p_kapasitas_anggota < 2 then
    raise exception using
      errcode = '22023',
      message = 'Squad capacity must be at least 2';
  end if;

  if p_kapasitas_anggota < v_min_anggota_tim then
    raise exception using
      errcode = '22023',
      message = 'Squad capacity is below the Mission minimum';
  end if;

  if p_kapasitas_anggota > v_max_anggota_tim then
    raise exception using
      errcode = '22023',
      message = 'Squad capacity is above the Mission maximum';
  end if;

  if p_nama_squad is null or p_nama_squad !~ '[^[:space:]]' then
    raise exception using
      errcode = '22023',
      message = 'Squad name must not be empty';
  end if;

  if p_deskripsi_squad is null
    or p_deskripsi_squad !~ '[^[:space:]]'
  then
    raise exception using
      errcode = '22023',
      message = 'Squad description must not be empty';
  end if;

  if p_requirements is null
    or pg_catalog.jsonb_typeof(p_requirements) <> 'array'
  then
    raise exception using
      errcode = '22023',
      message = 'Requirements must be a JSON array';
  end if;

  if pg_catalog.jsonb_array_length(p_requirements) = 0 then
    raise exception using
      errcode = '22023',
      message = 'At least one requirement is required';
  end if;

  for v_requirement in
    select requirement.value
    from pg_catalog.jsonb_array_elements(p_requirements) as requirement(value)
  loop
    if pg_catalog.jsonb_typeof(v_requirement) <> 'object' then
      raise exception using
        errcode = '22023',
        message = 'Each requirement must be a JSON object';
    end if;

    if not (v_requirement ? 'primary_class_id')
      or not (v_requirement ? 'slot_dibutuhkan')
      or (v_requirement - 'primary_class_id' - 'slot_dibutuhkan') <> '{}'::jsonb
    then
      raise exception using
        errcode = '22023',
        message = 'Each requirement must contain only primary_class_id and slot_dibutuhkan';
    end if;

    if pg_catalog.jsonb_typeof(v_requirement -> 'primary_class_id') <> 'number'
    then
      raise exception using
        errcode = '22023',
        message = 'Requirement primary_class_id must be an integer';
    end if;

    v_numeric_value := (v_requirement ->> 'primary_class_id')::numeric;

    if v_numeric_value <> pg_catalog.trunc(v_numeric_value)
      or v_numeric_value < -9223372036854775808
      or v_numeric_value > 9223372036854775807
    then
      raise exception using
        errcode = '22023',
        message = 'Requirement primary_class_id must be a valid bigint integer';
    end if;

    if pg_catalog.jsonb_typeof(v_requirement -> 'slot_dibutuhkan') <> 'number'
    then
      raise exception using
        errcode = '22023',
        message = 'Requirement slot_dibutuhkan must be an integer';
    end if;

    v_numeric_value := (v_requirement ->> 'slot_dibutuhkan')::numeric;

    if v_numeric_value <> pg_catalog.trunc(v_numeric_value)
      or v_numeric_value <= 0
      or v_numeric_value > 32767
    then
      raise exception using
        errcode = '22023',
        message = 'Requirement slot_dibutuhkan must be a positive smallint integer';
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_requirements) as requirement(value)
    group by (((requirement.value ->> 'primary_class_id')::numeric)::bigint)
    having pg_catalog.count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'Requirement primary_class_id values must be unique';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_requirements) as requirement(value)
    where not exists (
      select 1
      from public.primary_classes as primary_class
      where primary_class.primary_class_id =
        ((requirement.value ->> 'primary_class_id')::numeric)::bigint
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'Every requirement must reference a valid Primary Class';
  end if;

  select coalesce(
    pg_catalog.sum((requirement.value ->> 'slot_dibutuhkan')::numeric),
    0::numeric
  )
  into v_total_slots
  from pg_catalog.jsonb_array_elements(p_requirements) as requirement(value);

  if v_total_slots <> (p_kapasitas_anggota::numeric - 1::numeric) then
    raise exception using
      errcode = '22023',
      message = 'Total requirement slots must equal Squad capacity minus one';
  end if;

  insert into public.squads (
    mission_id,
    ketua_id,
    nama_squad,
    deskripsi_squad,
    kapasitas_anggota,
    status_squad,
    finalized_at,
    completed_at
  ) values (
    p_mission_id,
    v_user_id,
    p_nama_squad,
    p_deskripsi_squad,
    p_kapasitas_anggota,
    'OPEN_RECRUITMENT'::public.squad_status_enum,
    null,
    null
  )
  returning squad_id into v_squad_id;

  insert into public.squad_requirements (
    squad_id,
    primary_class_id,
    slot_dibutuhkan
  )
  select
    v_squad_id,
    ((requirement.value ->> 'primary_class_id')::numeric)::bigint,
    ((requirement.value ->> 'slot_dibutuhkan')::numeric)::smallint
  from pg_catalog.jsonb_array_elements(p_requirements) as requirement(value);

  return v_squad_id;
end;
$function$;

alter function public.create_squad(uuid, text, text, smallint, jsonb)
  owner to postgres;

revoke all on function public.create_squad(uuid, text, text, smallint, jsonb)
  from public;
revoke all on function public.create_squad(uuid, text, text, smallint, jsonb)
  from anon;
grant execute on function public.create_squad(uuid, text, text, smallint, jsonb)
  to authenticated;

revoke insert on table public.squads
  from public, anon, authenticated;
revoke insert on table public.squad_requirements
  from public, anon, authenticated;

commit;
