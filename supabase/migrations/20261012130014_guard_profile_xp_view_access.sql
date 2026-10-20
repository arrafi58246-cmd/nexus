-- Preserve existing display columns and ACTIVE-caller visibility.
-- Definer views remain necessary for sanitized cross-user display without
-- widening SELECT on private profiles or the underlying XP ledger.
create or replace view public.public_profiles with (security_barrier = true) as
select p.user_id, p.nama_lengkap, p.tahun_masuk, p.program_studi_id,
       ps.fakultas_id, p.primary_class_id, p.bio, p.foto_profil_path, p.created_at
from public.profiles p
join public.program_studi ps on ps.program_studi_id = p.program_studi_id
where p.status_akun = 'ACTIVE'::public.status_akun_enum
  and (select current_user in ('postgres', 'service_role') or public.is_active_user());

create or replace view public.career_xp_totals with (security_barrier = true) as
select p.user_id, coalesce(sum(xt.xp_amount), 0::bigint)::integer as career_xp
from public.profiles p
left join public.xp_transactions xt on xt.user_id = p.user_id
where (select current_user in ('postgres', 'service_role') or public.is_active_user())
group by p.user_id;

-- Views are a read contract. Profile edits still use profiles and its RLS/guard.
revoke all on public.public_profiles, public.career_xp_totals from public, anon;
revoke insert, update, delete on public.public_profiles, public.career_xp_totals
  from authenticated;
grant select on public.public_profiles, public.career_xp_totals to authenticated;
