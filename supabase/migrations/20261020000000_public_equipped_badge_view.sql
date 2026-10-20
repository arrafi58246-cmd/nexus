-- Peer profile: let an ACTIVE viewer see ONLY another student's single equipped badge.
-- user_badges stays owner-only; this definer view is a sanitized read contract, in the same
-- style as public.public_profiles (ACTIVE-caller guard + security_barrier).
-- Exposed: badge name/type, scope, rank position/population, scope names. Nothing else.
create or replace view public.public_equipped_badges with (security_barrier = true) as
select ub.user_id,
       bd.badge_name,
       bd.badge_type,
       ub.reward_context,
       ub.scope_type,
       ub.rank_position,
       ub.population_total,
       ps.nama_program_studi as program_studi_name,
       f.nama_fakultas as fakultas_name
from public.user_badges ub
join public.badge_definitions bd on bd.badge_id = ub.badge_id
join public.profiles p on p.user_id = ub.user_id
left join public.program_studi ps on ps.program_studi_id = ub.program_studi_id
left join public.fakultas f on f.fakultas_id = ub.fakultas_id
where ub.is_equipped
  and p.status_akun = 'ACTIVE'::public.status_akun_enum
  and (select current_user in ('postgres', 'service_role') or public.is_active_user());

revoke all on public.public_equipped_badges from public, anon;
revoke insert, update, delete on public.public_equipped_badges from authenticated;
grant select on public.public_equipped_badges to authenticated;

-- Rollback: drop view public.public_equipped_badges;
