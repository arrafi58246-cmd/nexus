-- D0: new team competitions need official size limits and live evidence.
-- Existing Mission rows and their unresolved legacy limits are untouched.
create or replace function public.guard_new_mission_submission()
returns trigger language plpgsql security invoker
set search_path = '' as $$
declare
  v_size text;
  v_mime text;
  v_submitting boolean := false;
begin
  if new.status_review in ('PENDING', 'APPROVED') then
    if new.min_anggota_tim is null or new.max_anggota_tim is null
       or new.min_anggota_tim < 2 or new.max_anggota_tim < new.min_anggota_tim then
      raise exception 'Team competition requires valid minimum and maximum participants';
    end if;
    if new.deadline_pendaftaran <= pg_catalog.now() then
      raise exception 'Registration deadline has passed';
    end if;
  end if;

  if tg_op = 'INSERT' then
    v_submitting := true;
  elsif old.status_review = 'REJECTED' and new.status_review = 'PENDING' then
    v_submitting := true;
  end if;

  if auth.uid() is not null and not public.is_admin() and v_submitting then
    if new.submitted_by is distinct from auth.uid() or not exists (
      select 1 from public.profiles p where p.user_id = auth.uid()
        and p.role_app = 'STUDENT' and p.status_akun = 'ACTIVE'
        and p.primary_class_id is not null
    ) then
      raise exception 'Only active onboarded students may submit Missions';
    end if;
    if new.dokumen_path !~ ('^' || auth.uid()::text || '/'
      || new.mission_submission_id::text || '/[0-9a-f-]{36}\.(pdf|jpg|png)$') then
      raise exception 'Document path does not belong to this submission';
    end if;
    select o.metadata->>'size', o.metadata->>'mimetype'
      into v_size, v_mime from storage.objects o
      where o.bucket_id = 'mission-documents' and o.name = new.dokumen_path;
    if v_size is null or v_size !~ '^[0-9]{1,8}$'
       or v_size::integer not between 1 and 10485760
       or v_mime is null
       or v_mime not in ('application/pdf', 'image/jpeg', 'image/png') then
      raise exception 'Mission document is missing or invalid';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status_review = 'PENDING'
     and new.status_review = 'APPROVED' and not exists (
      select 1 from storage.objects o where o.bucket_id = 'mission-documents'
        and o.name = old.dokumen_path
    ) then
    raise exception 'Mission document is unavailable';
  end if;
  return new;
end;
$$;

create trigger mission_submission_validate_new
before insert or update on public.mission_submissions
for each row execute function public.guard_new_mission_submission();

revoke all on function public.guard_new_mission_submission() from public, anon, authenticated;

create unique index if not exists mission_submissions_document_path_key
  on public.mission_submissions (dokumen_path);

-- Referenced Mission documents must remain available during and after review.
drop policy if exists nexus_private_docs_update_own_admin on storage.objects;
create policy nexus_private_docs_update_own_admin on storage.objects
for update to authenticated
using (
  bucket_id in ('mission-documents', 'achievement-certificates', 'mission-result-certificates')
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  and (bucket_id <> 'achievement-certificates' or not exists (
    select 1 from public.achievement_claims c where c.sertifikat_path = name
  ))
  and (bucket_id <> 'mission-documents' or not exists (
    select 1 from public.mission_submissions s where s.dokumen_path = name
  ) and not exists (
    select 1 from public.missions m where m.dokumen_path = name
  ))
)
with check (
  bucket_id in ('mission-documents', 'achievement-certificates', 'mission-result-certificates')
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  and (bucket_id <> 'achievement-certificates' or not exists (
    select 1 from public.achievement_claims c where c.sertifikat_path = name
  ))
  and (bucket_id <> 'mission-documents' or not exists (
    select 1 from public.mission_submissions s where s.dokumen_path = name
  ) and not exists (
    select 1 from public.missions m where m.dokumen_path = name
  ))
);

drop policy if exists nexus_private_docs_delete_own_admin on storage.objects;
create policy nexus_private_docs_delete_own_admin on storage.objects
for delete to authenticated
using (
  bucket_id in ('mission-documents', 'achievement-certificates', 'mission-result-certificates')
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  and (bucket_id <> 'achievement-certificates' or not exists (
    select 1 from public.achievement_claims c where c.sertifikat_path = name
  ))
  and (bucket_id <> 'mission-documents' or not exists (
    select 1 from public.mission_submissions s where s.dokumen_path = name
  ) and not exists (
    select 1 from public.missions m where m.dokumen_path = name
  ))
);
