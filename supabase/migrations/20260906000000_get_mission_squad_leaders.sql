begin;

create function public.get_mission_squad_leaders(p_mission_id uuid)
returns table (
  squad_id uuid,
  nama_ketua text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if public.is_active_user() is not true then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select
    s.squad_id,
    p.nama_lengkap::text as nama_ketua
  from public.squads as s
  left join public.profiles as p
    on p.user_id = s.ketua_id
  where s.mission_id = p_mission_id
    and s.status_squad <> 'MISSION_COMPLETED';
end;
$function$;

revoke all on function public.get_mission_squad_leaders(uuid) from public;
revoke all on function public.get_mission_squad_leaders(uuid) from anon;
grant execute on function public.get_mission_squad_leaders(uuid) to authenticated;

commit;

-- Rollback (jalankan secara terpisah, bukan bersama migration di atas):
-- begin;
-- drop function if exists public.get_mission_squad_leaders(uuid);
-- commit;
