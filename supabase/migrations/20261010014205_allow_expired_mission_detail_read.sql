-- Keep Discovery limited to open registration in its query.
-- Authenticated students with completed onboarding may still open an old Mission URL.
-- Preserve admin and historical Squad member access from the prior policy.
-- The existing missions_read policy remains in place; only its SELECT condition changes.
alter policy missions_read
on public.missions
using (
  deadline_pendaftaran > now()
  or public.is_admin()
  or exists (
    select 1
    from public.squads s
    join public.squad_members sm on sm.squad_id = s.squad_id
    where s.mission_id = missions.mission_id
      and sm.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role_app = 'STUDENT'
      and p.status_akun = 'ACTIVE'
      and p.primary_class_id is not null
  )
);
