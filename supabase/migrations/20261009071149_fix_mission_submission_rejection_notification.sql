-- COALESCE is SQL syntax, not a function in pg_catalog. The old trigger
-- aborted admin rejections when it tried to insert their notification.
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
        coalesce(
          new.alasan_penolakan,
          'Pengajuan Mission ditolak oleh admin.'
        )
      );
    end if;
  end if;

  return new;
end;
$function$;
