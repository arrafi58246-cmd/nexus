-- A bounded public read contract. Private ledger/claims/results RLS stays intact.
-- The privileged projection lives outside the public API schema; the public
-- wrapper is SECURITY INVOKER. Both entry points require an ACTIVE caller.
create schema if not exists nexus_profile_private;
revoke all on schema nexus_profile_private from public, anon;
grant usage on schema nexus_profile_private to authenticated;

create function nexus_profile_private.get_peer_verified_mission_history(p_user_id uuid)
returns table (
  history_id uuid, source text, name text, organizer text, squad_name text,
  result text, earned_at date, recorded_at timestamptz, xp integer, mission_id uuid
)
language sql stable security definer set search_path = '' as $function$
  select h.* from (
    select xt.xp_transaction_id as history_id, 'SQUAD'::text as source,
           m.nama_lomba as name, m.penyelenggara as organizer, s.nama_squad as squad_name,
           coalesce(r.approved_hasil_kompetisi, r.hasil_kompetisi)::text as result,
           xt.earned_at, xt.created_at as recorded_at, xt.xp_amount as xp, m.mission_id
    from public.xp_transactions xt
    join public.profiles p on p.user_id = xt.user_id
    join public.mission_result_submissions r on r.result_submission_id = xt.mission_result_submission_id
    join public.squads s on s.squad_id = r.squad_id
    join public.missions m on m.mission_id = s.mission_id
    where xt.user_id = p_user_id and xt.xp_source_type = 'VERIFIED_MISSION'
      and r.status_validation = 'APPROVED' and s.status_squad = 'MISSION_COMPLETED'
      and p.status_akun = 'ACTIVE' and p.role_app = 'STUDENT'
      and (select auth.uid() is not null and public.is_active_user())
    union all
    select xt.xp_transaction_id, 'EXTERNAL'::text, a.nama_kompetisi, a.penyelenggara,
           null::text, a.hasil_kompetisi::text, xt.earned_at, xt.created_at,
           xt.xp_amount, null::uuid
    from public.xp_transactions xt
    join public.profiles p on p.user_id = xt.user_id
    join public.achievement_claims a on a.achievement_claim_id = xt.achievement_claim_id
      and a.user_id = xt.user_id
    where xt.user_id = p_user_id and xt.xp_source_type = 'LEGACY_ACHIEVEMENT'
      and a.status_validation = 'APPROVED'
      and p.status_akun = 'ACTIVE' and p.role_app = 'STUDENT'
      and (select auth.uid() is not null and public.is_active_user())
  ) h order by h.recorded_at desc, h.history_id asc limit 3;
$function$;
revoke all on function nexus_profile_private.get_peer_verified_mission_history(uuid)
  from public, anon;
grant execute on function nexus_profile_private.get_peer_verified_mission_history(uuid)
  to authenticated;

create function public.get_peer_verified_mission_history(p_user_id uuid)
returns table (
  history_id uuid, source text, name text, organizer text, squad_name text,
  result text, earned_at date, recorded_at timestamptz, xp integer, mission_id uuid
)
language sql stable security invoker set search_path = '' as $function$
  select * from nexus_profile_private.get_peer_verified_mission_history(p_user_id);
$function$;
revoke all on function public.get_peer_verified_mission_history(uuid) from public, anon;
grant execute on function public.get_peer_verified_mission_history(uuid) to authenticated;
comment on function public.get_peer_verified_mission_history(uuid) is
  'Latest 3 APPROVED credited results for an ACTIVE student, readable by ACTIVE authenticated viewers; excludes evidence, review notes and reviewer identity.';

-- Rollback: drop function public.get_peer_verified_mission_history(uuid);
-- drop function nexus_profile_private.get_peer_verified_mission_history(uuid);
-- Leave the private schema in place in case it has later dependents.
