CREATE OR REPLACE FUNCTION public.kick_squad_member(p_squad_id uuid, p_user_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_squad public.squads%rowtype;
  v_member public.squad_members%rowtype;
begin
  if not public.is_active_user() and not public.is_admin() then
    raise exception 'Account is not active';
  end if;

  select * into v_squad
  from public.squads
  where squad_id = p_squad_id
  for update;

  if not found then
    raise exception 'Squad not found';
  end if;

  if v_squad.ketua_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the Squad leader or admin may remove a member';
  end if;

  if not public.is_admin() and v_squad.status_squad in ('FINALIZED', 'MISSION_COMPLETED') then
    raise exception 'The leader cannot kick members after Finalized';
  end if;

  select * into v_member
  from public.squad_members
  where squad_id = p_squad_id
    and user_id = p_user_id
    and status_member = 'ACTIVE'
  for update;

  if not found then
    raise exception 'Active member not found';
  end if;

  if v_member.role_squad = 'KETUA' then
    raise exception 'The Squad leader cannot be removed through this function';
  end if;

  perform set_config('nexus.internal', '1', true);

  update public.squad_members
  set status_member = case when public.is_admin() then 'ADMIN_REMOVED'::public.member_status_enum else 'KICKED'::public.member_status_enum end,
      ended_at = now(),
      removed_by = auth.uid(),
      removal_reason = p_reason
  where squad_member_id = v_member.squad_member_id;

  if not public.is_admin() and v_squad.status_squad = 'FULL' then
    update public.squads
    set status_squad = 'OPEN_RECRUITMENT'
    where squad_id = p_squad_id;
  end if;

  insert into public.notifications(user_id, notification_type, title, body)
  values (
    p_user_id,
    case when public.is_admin() then 'SQUAD_MEMBER_ADMIN_REMOVED' else 'SQUAD_MEMBER_KICKED' end,
    'Perubahan keanggotaan Squad',
    coalesce(p_reason, 'Keanggotaanmu pada Squad telah diakhiri.')
  );
end;
$function$
