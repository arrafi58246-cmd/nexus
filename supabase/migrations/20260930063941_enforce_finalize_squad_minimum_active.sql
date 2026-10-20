-- Finalization requires the Mission's minimum number of ACTIVE members.
-- Pending applications are intentionally left unchanged.
CREATE OR REPLACE FUNCTION public.finalize_squad(p_squad_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
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
END;
$function$;
