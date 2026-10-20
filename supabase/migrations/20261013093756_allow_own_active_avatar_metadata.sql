-- Needed by Storage remove/update; public image URLs already remain public.
-- No foreign-user listing and no suspended-account metadata access.
create policy nexus_avatars_select_own_active on storage.objects
for select to authenticated
using (bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.is_active_user()));
