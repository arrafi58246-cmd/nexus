begin;

-- These values are approved only for the two named test fixtures. They are
-- not defaults and must not be reused for real Missions.
do $block$
declare
  v_first_count integer;
  v_second_count integer;
begin
  select pg_catalog.count(*)
  into v_first_count
  from public.missions as mission
  where mission.mission_id = 'b0cf942a-aee0-4533-99c8-b7539d7132f8'::uuid
    and mission.nama_lomba = 'NEXUS Test Hackathon 2026'
    and mission.min_anggota_tim is null
    and mission.max_anggota_tim is null;

  select pg_catalog.count(*)
  into v_second_count
  from public.missions as mission
  where mission.mission_id = 'ec25cbda-7b36-4cbf-b044-f6da49789e6d'::uuid
    and mission.nama_lomba = 'NEXUS Application Limit Test 2026'
    and mission.min_anggota_tim is null
    and mission.max_anggota_tim is null;

  if v_first_count <> 1 or v_second_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Legacy Mission fixtures do not match the expected IDs, names, or empty limits';
  end if;

  if exists (
    select 1
    from public.squads as squad
    where squad.mission_id in (
      'b0cf942a-aee0-4533-99c8-b7539d7132f8'::uuid,
      'ec25cbda-7b36-4cbf-b044-f6da49789e6d'::uuid
    )
      and squad.kapasitas_anggota <> 3
  ) then
    raise exception using
      errcode = '23514',
      message = 'Legacy backfill would invalidate an existing Squad capacity';
  end if;
end;
$block$;

update public.missions
set min_anggota_tim = 3, max_anggota_tim = 5
where mission_id = 'b0cf942a-aee0-4533-99c8-b7539d7132f8'::uuid;

update public.missions
set min_anggota_tim = 3, max_anggota_tim = 3
where mission_id = 'ec25cbda-7b36-4cbf-b044-f6da49789e6d'::uuid;

-- APPROVED source submissions are immutable through their normal application
-- flow. The verified internal-mode helper reads nexus.internal = '1'. Lock the
-- table against concurrent writes and enable that mode only for this sync.
lock table public.mission_submissions in share row exclusive mode;

select pg_catalog.set_config('nexus.internal', '1', true);

update public.mission_submissions as submission
set
  min_anggota_tim = mission.min_anggota_tim,
  max_anggota_tim = mission.max_anggota_tim
from public.missions as mission
where mission.source_submission_id = submission.mission_submission_id
  and mission.mission_id in (
    'b0cf942a-aee0-4533-99c8-b7539d7132f8'::uuid,
    'ec25cbda-7b36-4cbf-b044-f6da49789e6d'::uuid
  )
  and submission.status_review = 'APPROVED'::public.review_status_enum
  and submission.min_anggota_tim is null
  and submission.max_anggota_tim is null;

select pg_catalog.set_config('nexus.internal', '', true);

do $block$
begin
  if not exists (
    select 1 from public.missions
    where mission_id = 'b0cf942a-aee0-4533-99c8-b7539d7132f8'::uuid
      and min_anggota_tim = 3 and max_anggota_tim = 5
  ) or not exists (
    select 1 from public.missions
    where mission_id = 'ec25cbda-7b36-4cbf-b044-f6da49789e6d'::uuid
      and min_anggota_tim = 3 and max_anggota_tim = 3
  ) then
    raise exception 'Legacy Mission backfill verification failed';
  end if;
end;
$block$;

commit;
