-- Keep the agreed 5 MB decimal limit enforceable beyond the browser.
do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'mission-result-certificates' and public = false
  ) then
    raise exception 'Private mission-result-certificates bucket is required';
  end if;
end $$;

update storage.buckets
set file_size_limit = 5000000
where id = 'mission-result-certificates';

create function public.guard_mission_result_evidence()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner text := auth.uid()::text;
  v_prefix text;
begin
  if tg_op = 'UPDATE'
     and new.sertifikat_path is not distinct from old.sertifikat_path
     and new.dokumen_pendukung_path is not distinct from old.dokumen_pendukung_path
     and not (old.status_validation = 'REJECTED' and new.status_validation = 'PENDING') then
    return new;
  end if;

  if v_owner is null then
    raise exception 'An authenticated uploader is required';
  end if;
  v_prefix := v_owner || '/' || new.squad_id::text || '/';

  if new.sertifikat_path is null
     or not starts_with(new.sertifikat_path, v_prefix)
     or not exists (
       select 1 from storage.objects o
       where o.bucket_id = 'mission-result-certificates'
         and o.name = new.sertifikat_path
         and o.owner_id = v_owner
     ) then
    raise exception 'The Squad certificate must be uploaded by the submitter';
  end if;

  if new.dokumen_pendukung_path is not null then
    if new.dokumen_pendukung_path = new.sertifikat_path
       or not starts_with(new.dokumen_pendukung_path, v_prefix)
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'mission-result-certificates'
           and o.name = new.dokumen_pendukung_path
           and o.owner_id = v_owner
       ) then
      raise exception 'The supporting document must be uploaded by the submitter';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_mission_result_evidence() from public, anon;
grant execute on function public.guard_mission_result_evidence() to authenticated;

create trigger mission_result_evidence_guard
before insert or update of sertifikat_path, dokumen_pendukung_path, status_validation
on public.mission_result_submissions
for each row execute function public.guard_mission_result_evidence();
