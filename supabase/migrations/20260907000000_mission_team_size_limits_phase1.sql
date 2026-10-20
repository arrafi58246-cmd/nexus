begin;

alter table public.mission_submissions
  add column min_anggota_tim smallint,
  add column max_anggota_tim smallint,
  add constraint mission_submissions_team_size_pair_check check (
    (min_anggota_tim is null and max_anggota_tim is null)
    or
    (min_anggota_tim is not null and max_anggota_tim is not null)
  ),
  add constraint mission_submissions_team_size_range_check check (
    min_anggota_tim is null
    or (
      min_anggota_tim > 0
      and max_anggota_tim > 0
      and min_anggota_tim <= max_anggota_tim
    )
  );

alter table public.missions
  add column min_anggota_tim smallint,
  add column max_anggota_tim smallint,
  add constraint missions_team_size_pair_check check (
    (min_anggota_tim is null and max_anggota_tim is null)
    or
    (min_anggota_tim is not null and max_anggota_tim is not null)
  ),
  add constraint missions_team_size_range_check check (
    min_anggota_tim is null
    or (
      min_anggota_tim > 0
      and max_anggota_tim > 0
      and min_anggota_tim <= max_anggota_tim
    )
  );

create or replace function public.guard_mission_submission_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.min_anggota_tim is null or new.max_anggota_tim is null then
    raise exception using
      errcode = '22023',
      message = 'Mission team size limits are required';
  end if;

  if auth.uid() is not null and not public.is_admin() then
    new.submitted_by := auth.uid();
    new.status_review := 'PENDING';
    new.final_tier_id := null;
    new.alasan_penolakan := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.resubmission_count := 0;
  end if;

  return new;
end;
$function$;

create or replace function public.guard_mission_submission_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if public.nexus_internal_mode() then
    return new;
  end if;

  if old.status_review = 'APPROVED' and new is distinct from old then
    raise exception 'Approved mission submissions are immutable';
  end if;

  if public.is_admin() then
    if new.status_review = 'APPROVED' and old.status_review <> 'APPROVED' then
      if new.final_tier_id is null then
        raise exception 'final_tier_id is required for approval';
      end if;
      if new.min_anggota_tim is null or new.max_anggota_tim is null then
        raise exception using
          errcode = '22023',
          message = 'Mission team size limits are required for approval';
      end if;
      new.alasan_penolakan := null;
      new.reviewed_by := auth.uid();
      new.reviewed_at := pg_catalog.now();
    elsif new.status_review = 'REJECTED' and old.status_review <> 'REJECTED' then
      if new.alasan_penolakan is null
        or pg_catalog.length(pg_catalog.btrim(new.alasan_penolakan)) = 0
      then
        raise exception 'alasan_penolakan is required for rejection';
      end if;
      new.final_tier_id := null;
      new.reviewed_by := auth.uid();
      new.reviewed_at := pg_catalog.now();
    end if;

    return new;
  end if;

  if auth.uid() is null or old.submitted_by <> auth.uid() then
    raise exception 'Only the submitter or an admin may update this submission';
  end if;

  if old.status_review <> 'REJECTED' or new.status_review <> 'PENDING' then
    raise exception 'Users may only resubmit a rejected mission using the same submission ID';
  end if;

  if new.submitted_by is distinct from old.submitted_by
    or new.submitted_at is distinct from old.submitted_at
  then
    raise exception 'Submission ownership and original submission time are immutable';
  end if;

  if new.min_anggota_tim is null or new.max_anggota_tim is null then
    raise exception using
      errcode = '22023',
      message = 'Mission team size limits are required for resubmission';
  end if;

  new.final_tier_id := null;
  new.alasan_penolakan := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.resubmission_count := old.resubmission_count + 1;

  return new;
end;
$function$;

create or replace function public.after_mission_submission_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status_review is distinct from new.status_review then
    if new.status_review = 'APPROVED' then
      insert into public.missions (
        source_submission_id,
        tier_id,
        nama_lomba,
        penyelenggara,
        kategori_penyelenggara,
        link_resmi,
        deadline_pendaftaran,
        deadline_lomba,
        tahun_lomba,
        kategori_lomba,
        cakupan_peserta,
        mode_lomba,
        min_anggota_tim,
        max_anggota_tim,
        biaya_pendaftaran,
        deskripsi_singkat,
        dokumen_path
      ) values (
        new.mission_submission_id,
        new.final_tier_id,
        new.nama_lomba,
        new.penyelenggara,
        new.kategori_penyelenggara,
        new.link_resmi,
        new.deadline_pendaftaran,
        new.deadline_lomba,
        new.tahun_lomba,
        new.kategori_lomba,
        new.cakupan_peserta,
        new.mode_lomba,
        new.min_anggota_tim,
        new.max_anggota_tim,
        new.biaya_pendaftaran,
        new.deskripsi_singkat,
        new.dokumen_path
      )
      on conflict (source_submission_id) do nothing;

      insert into public.notifications (
        user_id,
        notification_type,
        title,
        body
      ) values (
        new.submitted_by,
        'MISSION_SUBMISSION_APPROVED',
        'Mission disetujui',
        pg_catalog.format(
          'Mission "%s" telah disetujui dan tersedia sebagai Mission NEXUS.',
          new.nama_lomba
        )
      );
    elsif new.status_review = 'REJECTED' then
      insert into public.notifications (
        user_id,
        notification_type,
        title,
        body
      ) values (
        new.submitted_by,
        'MISSION_SUBMISSION_REJECTED',
        'Mission ditolak',
        pg_catalog.coalesce(
          new.alasan_penolakan,
          'Pengajuan Mission ditolak oleh admin.'
        )
      );
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.guard_mission_team_size_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.min_anggota_tim is distinct from old.min_anggota_tim
    or new.max_anggota_tim is distinct from old.max_anggota_tim
  then
    if new.min_anggota_tim is null or new.max_anggota_tim is null then
      raise exception using
        errcode = '23514',
        message = 'Configured Mission team size limits cannot be removed';
    end if;

    if exists (
      select 1
      from public.squads as squad
      where squad.mission_id = old.mission_id
        and (
          new.min_anggota_tim is null
          or new.max_anggota_tim is null
          or squad.kapasitas_anggota < new.min_anggota_tim
          or squad.kapasitas_anggota > new.max_anggota_tim
        )
    ) then
      raise exception using
        errcode = '23514',
        message = 'Mission team size limits cannot exclude an existing Squad capacity';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.guard_mission_team_size_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.min_anggota_tim is null or new.max_anggota_tim is null then
    raise exception using
      errcode = '22023',
      message = 'Mission team size limits are required';
  end if;

  return new;
end;
$function$;

create trigger missions_guard_team_size_insert
before insert on public.missions
for each row execute function public.guard_mission_team_size_insert();

create trigger missions_guard_team_size_update
before update of min_anggota_tim, max_anggota_tim on public.missions
for each row execute function public.guard_mission_team_size_update();

revoke all on function public.guard_mission_team_size_insert()
  from public, anon, authenticated;
revoke all on function public.guard_mission_team_size_update()
  from public, anon, authenticated;

create or replace function public.guard_squad_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_deadline timestamptz;
  v_min_anggota_tim smallint;
  v_max_anggota_tim smallint;
begin
  if auth.uid() is not null and not public.is_admin() then
    new.ketua_id := auth.uid();
    new.status_squad := 'OPEN_RECRUITMENT';
    new.finalized_at := null;
    new.completed_at := null;
  end if;

  select
    mission.deadline_pendaftaran,
    mission.min_anggota_tim,
    mission.max_anggota_tim
  into
    v_deadline,
    v_min_anggota_tim,
    v_max_anggota_tim
  from public.missions as mission
  where mission.mission_id = new.mission_id
  for share;

  if not found then
    raise exception 'Mission not found';
  end if;

  if v_deadline <= pg_catalog.now() then
    raise exception 'A new Squad cannot be created after the Mission registration deadline';
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

  if new.kapasitas_anggota < v_min_anggota_tim then
    raise exception using
      errcode = '22023',
      message = 'Squad capacity is below the Mission minimum';
  end if;

  if new.kapasitas_anggota > v_max_anggota_tim then
    raise exception using
      errcode = '22023',
      message = 'Squad capacity is above the Mission maximum';
  end if;

  if exists (
    select 1
    from public.squad_members as member
    where member.user_id = new.ketua_id
      and member.mission_id = new.mission_id
      and member.status_member = 'ACTIVE'
  ) then
    raise exception 'A user may have only one active Squad membership per Mission';
  end if;

  return new;
end;
$function$;

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

  select pg_catalog.coalesce(
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
