-- Keep ownership/admin rules and read access; require ACTIVE for notification writes.
alter policy notifications_update_own on public.notifications
using ((select public.is_admin()) or
  (user_id = (select auth.uid()) and (select public.is_active_user())))
with check ((select public.is_admin()) or
  (user_id = (select auth.uid()) and (select public.is_active_user())));

-- Restrictive policies AND with existing ownership/reference policies.
-- Other buckets are unaffected; service_role retains its existing RLS bypass.
create policy nexus_active_storage_insert on storage.objects
as restrictive for insert to authenticated
with check (bucket_id not in ('avatars', 'mission-documents',
  'achievement-certificates', 'mission-result-certificates')
  or (select public.is_active_user()));

create policy nexus_active_storage_update on storage.objects
as restrictive for update to authenticated
using (bucket_id not in ('avatars', 'mission-documents',
  'achievement-certificates', 'mission-result-certificates')
  or (select public.is_active_user()))
with check (bucket_id not in ('avatars', 'mission-documents',
  'achievement-certificates', 'mission-result-certificates')
  or (select public.is_active_user()));

create policy nexus_active_storage_delete on storage.objects
as restrictive for delete to authenticated
using (bucket_id not in ('avatars', 'mission-documents',
  'achievement-certificates', 'mission-result-certificates')
  or (select public.is_active_user()));
