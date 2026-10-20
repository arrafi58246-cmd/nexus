-- Profiles are self-readable through RLS. Expose only the display fields of
-- current Squad members to another current member of this same Squad.
create function public.get_squad_room_members(p_squad_id uuid)
returns table (
  member_user_id uuid,
  nama_lengkap text,
  nama_class text,
  role_squad text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or public.is_active_user() is not true
     or public.is_admin() is true
     or not exists (
       select 1
       from public.squad_members sm
       join public.squads s on s.squad_id = sm.squad_id
       where sm.squad_id = p_squad_id
         and sm.user_id = auth.uid()
         and sm.status_member = 'ACTIVE'
         and s.status_squad <> 'MISSION_COMPLETED'
     ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select
    sm.user_id,
    p.nama_lengkap::text,
    pc.nama_class::text,
    sm.role_squad::text,
    sm.joined_at
  from public.squad_members sm
  join public.profiles p on p.user_id = sm.user_id
  left join public.primary_classes pc
    on pc.primary_class_id = p.primary_class_id
  where sm.squad_id = p_squad_id
    and sm.status_member = 'ACTIVE'
  order by (sm.role_squad = 'KETUA') desc, sm.joined_at, sm.user_id;
end;
$$;

revoke all on function public.get_squad_room_members(uuid)
from public, anon;
grant execute on function public.get_squad_room_members(uuid)
to authenticated;

-- RLS does not cover TRUNCATE. Keep only the privileges chat actually needs
-- from the existing grants; a wider grant review is tracked separately.
revoke truncate on table public.squad_messages
from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'supabase_realtime publication is missing';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'squad_messages'
  ) then
    alter publication supabase_realtime add table public.squad_messages;
  end if;
end;
$$;
