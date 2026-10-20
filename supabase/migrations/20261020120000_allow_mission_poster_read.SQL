
20261020120000 allow mission poster read · SQL
-- Poster Mission yang sudah disetujui (dipakai missions.dokumen_path) boleh dibaca
-- oleh user yang login, supaya kartu di halaman /missions bisa menampilkan posternya.
-- Hanya gambar JPG/PNG yang dibuka. PDF dan dokumen pengajuan yang masih PENDING
-- atau REJECTED tetap private. Policy ini hanya menambah akses baca.
--
-- Untuk membatalkan:
--   drop policy if exists nexus_mission_posters_select_approved on storage.objects;
drop policy if exists nexus_mission_posters_select_approved on storage.objects;
create policy nexus_mission_posters_select_approved on storage.objects
for select to authenticated
using (
  bucket_id = 'mission-documents'
  and name ~* '\.(jpg|png)$'
  and exists (
    select 1 from public.missions m where m.dokumen_path = name
  )
);
 
Claude finished the response
