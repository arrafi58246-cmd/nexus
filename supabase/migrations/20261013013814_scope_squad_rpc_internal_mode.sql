-- Preserve existing authorization, bodies and grants; restore the caller flag after success.

CREATE OR REPLACE FUNCTION public.kick_squad_member(p_squad_id uuid, p_user_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_previous_internal text := pg_catalog.current_setting('nexus.internal', true);
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
$function$;

CREATE OR REPLACE FUNCTION public.finalize_squad(p_squad_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_previous_internal text := pg_catalog.current_setting('nexus.internal', true);
  v_squad public.squads%ROWTYPE;
  v_minimum smallint;
  v_active_count bigint;
BEGIN
  IF NOT public.is_active_user() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Account is not active';
  END IF;

  SELECT * INTO v_squad
  FROM public.squads
  WHERE squad_id = p_squad_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Squad not found';
  END IF;

  IF v_squad.ketua_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the Squad leader or admin may Finalize the Squad';
  END IF;

  IF v_squad.status_squad NOT IN ('OPEN_RECRUITMENT', 'FULL') THEN
    RAISE EXCEPTION 'Only an Open or Full Squad can be Finalized';
  END IF;

  SELECT min_anggota_tim INTO v_minimum
  FROM public.missions
  WHERE mission_id = v_squad.mission_id;

  IF v_minimum IS NULL THEN
    RAISE EXCEPTION 'Mission minimum team size is not set';
  END IF;

  SELECT count(*) INTO v_active_count
  FROM public.squad_members
  WHERE squad_id = p_squad_id
    AND status_member = 'ACTIVE';

  IF v_active_count < v_minimum THEN
    RAISE EXCEPTION 'Minimum active Squad members not met';
  END IF;

  PERFORM pg_catalog.set_config('nexus.internal', '1', true);
  UPDATE public.squads
  SET status_squad = 'FINALIZED',
      finalized_at = pg_catalog.now()
  WHERE squad_id = p_squad_id;
  perform pg_catalog.set_config('nexus.internal', coalesce(v_previous_internal, ''), true);
END;
$function$;
