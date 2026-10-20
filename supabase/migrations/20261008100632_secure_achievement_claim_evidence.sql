-- Achievement certificates are private and capped at 5,000,000 bytes.
update storage.buckets
set file_size_limit = 5000000,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'achievement-certificates';

create unique index if not exists achievement_claims_certificate_path_key
  on public.achievement_claims (sertifikat_path);

-- Preserve the other private buckets' existing permissions. A certificate in
-- use by any claim may not be overwritten or deleted by its owner or an admin.
drop policy if exists nexus_private_docs_update_own_admin on storage.objects;
create policy nexus_private_docs_update_own_admin on storage.objects
for update to authenticated
using (
  bucket_id in ('mission-documents', 'achievement-certificates', 'mission-result-certificates')
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  and (bucket_id <> 'achievement-certificates' or not exists (
    select 1 from public.achievement_claims c where c.sertifikat_path = name
  ))
)
with check (
  bucket_id in ('mission-documents', 'achievement-certificates', 'mission-result-certificates')
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  and (bucket_id <> 'achievement-certificates' or not exists (
    select 1 from public.achievement_claims c where c.sertifikat_path = name
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
);

create or replace function public.guard_achievement_claim_access()
returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  v_size text;
  v_mime text;
  v_check_evidence boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if tg_op = 'INSERT' then
    v_check_evidence := true;
    if new.user_id is distinct from auth.uid() or not exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role_app = 'STUDENT' and p.status_akun = 'ACTIVE'
    ) then
      raise exception 'Only active students may submit claims';
    end if;
  elsif public.is_admin() then
    v_check_evidence := new.sertifikat_path is distinct from old.sertifikat_path;
    if old.status_validation <> 'PENDING'
       or new.status_validation not in ('APPROVED', 'REJECTED')
       or (new.user_id, new.nama_kompetisi, new.penyelenggara,
           new.achievement_date, new.submitted_tier_id, new.hasil_kompetisi,
           new.sertifikat_path, new.preview_xp, new.submitted_at,
           new.resubmission_count)
          is distinct from
          (old.user_id, old.nama_kompetisi, old.penyelenggara,
           old.achievement_date, old.submitted_tier_id, old.hasil_kompetisi,
           old.sertifikat_path, old.preview_xp, old.submitted_at,
           old.resubmission_count) then
      raise exception 'Only a pending claim may be reviewed';
    end if;
    if new.status_validation = 'APPROVED' and
       (new.approved_tier_id is null or new.rejection_reason is not null) then
      raise exception 'Choose an approved tier';
    end if;
    if new.status_validation = 'APPROVED' and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'achievement-certificates'
        and o.name = old.sertifikat_path
    ) then
      raise exception 'Certificate is unavailable';
    end if;
    if new.status_validation = 'REJECTED' and
       (new.approved_tier_id is not null or
        length(btrim(coalesce(new.rejection_reason, ''))) not between 1 and 1000) then
      raise exception 'A rejection reason is required';
    end if;
  else
    v_check_evidence := new.sertifikat_path is distinct from old.sertifikat_path;
    if old.user_id is distinct from auth.uid()
       or not exists (
         select 1 from public.profiles p
         where p.user_id = auth.uid() and p.role_app = 'STUDENT' and p.status_akun = 'ACTIVE'
       )
       or old.status_validation <> 'REJECTED'
       or new.status_validation <> 'PENDING'
       or (new.user_id, new.approved_tier_id, new.approved_xp,
           new.reviewed_by, new.reviewed_at, new.submitted_at,
           new.resubmission_count)
          is distinct from
          (old.user_id, old.approved_tier_id, old.approved_xp,
           old.reviewed_by, old.reviewed_at, old.submitted_at,
           old.resubmission_count) then
      raise exception 'Only rejected claims may be resubmitted';
    end if;
  end if;

  if (tg_op = 'INSERT' or new.status_validation = 'PENDING')
     and new.achievement_date > current_date then
    raise exception 'Achievement date cannot be in the future';
  end if;

  if v_check_evidence then
    if new.sertifikat_path !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$') then
      raise exception 'Certificate path does not belong to this user';
    end if;
    select o.metadata->>'size', o.metadata->>'mimetype'
      into v_size, v_mime from storage.objects o
      where o.bucket_id = 'achievement-certificates'
        and o.name = new.sertifikat_path;
    if v_size is null or v_size !~ '^[0-9]{1,7}$'
       or v_size::integer not between 1 and 5000000
       or v_mime is null or v_mime not in ('application/pdf', 'image/jpeg', 'image/png') then
      raise exception 'Certificate is missing or invalid';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists achievement_claim_access_guard on public.achievement_claims;
create trigger achievement_claim_access_guard
before insert or update on public.achievement_claims
for each row execute function public.guard_achievement_claim_access();

revoke all on function public.guard_achievement_claim_access() from public, anon, authenticated;
