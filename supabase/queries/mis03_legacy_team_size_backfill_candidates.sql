-- Read-only inventory for obtaining official team-size limits outside NEXUS.
-- This returns Mission facts and aggregate Squad capacities, never user data.
select
  mission.mission_id,
  mission.nama_lomba,
  mission.penyelenggara,
  mission.link_resmi,
  mission.tahun_lomba,
  mission.deadline_pendaftaran,
  mission.deadline_lomba,
  mission.min_anggota_tim,
  mission.max_anggota_tim,
  pg_catalog.count(squad.squad_id) as existing_squad_count,
  pg_catalog.min(squad.kapasitas_anggota) as smallest_existing_squad,
  pg_catalog.max(squad.kapasitas_anggota) as largest_existing_squad
from public.missions as mission
left join public.squads as squad
  on squad.mission_id = mission.mission_id
where mission.min_anggota_tim is null
   or mission.max_anggota_tim is null
group by
  mission.mission_id,
  mission.nama_lomba,
  mission.penyelenggara,
  mission.link_resmi,
  mission.tahun_lomba,
  mission.deadline_pendaftaran,
  mission.deadline_lomba,
  mission.min_anggota_tim,
  mission.max_anggota_tim
order by mission.deadline_pendaftaran, mission.mission_id;
