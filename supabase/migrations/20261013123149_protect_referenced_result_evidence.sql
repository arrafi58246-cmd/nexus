-- Preserve ownership/ACTIVE policies. Referenced result evidence stays immutable;
-- old files become removable after a successful resubmission changes references.
create index if not exists mission_results_certificate_path_idx
  on public.mission_result_submissions (sertifikat_path);
create index if not exists mission_results_supporting_path_idx
  on public.mission_result_submissions (dokumen_pendukung_path)
  where dokumen_pendukung_path is not null;

create policy nexus_result_evidence_update_unreferenced on storage.objects
as restrictive for update to authenticated
using (bucket_id <> 'mission-result-certificates' or not exists (
  select 1 from public.mission_result_submissions r
  where r.sertifikat_path = objects.name or r.dokumen_pendukung_path = objects.name))
with check (bucket_id <> 'mission-result-certificates' or not exists (
  select 1 from public.mission_result_submissions r
  where r.sertifikat_path = objects.name or r.dokumen_pendukung_path = objects.name));

create policy nexus_result_evidence_delete_unreferenced on storage.objects
as restrictive for delete to authenticated
using (bucket_id <> 'mission-result-certificates' or not exists (
  select 1 from public.mission_result_submissions r
  where r.sertifikat_path = objects.name or r.dokumen_pendukung_path = objects.name));
