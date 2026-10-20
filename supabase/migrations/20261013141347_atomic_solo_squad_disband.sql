create or replace function public.disband_solo_squad(p_squad_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_squad public.squads%rowtype;
  v_ids uuid[];
  v_users uuid[];
  v_applicant uuid;
  v_previous_internal text;
begin
  if p_squad_id is null then
    raise exception using errcode='22023', message='Squad is required';
  end if;
  if v_actor is null or not exists (select 1 from public.profiles
    where user_id=v_actor and role_app='STUDENT' and status_akun='ACTIVE' and primary_class_id is not null) then
    raise exception using errcode='42501', message='An active Student leader is required';
  end if;
  select * into v_squad from public.squads where squad_id=p_squad_id;
  if not found or v_squad.ketua_id<>v_actor then
    raise exception using errcode='42501', message='Only the Squad leader can disband';
  end if;

  -- decide/cancel take applicant -> application -> Squad locks. Follow that
  -- order for all seed applicants; never wait for a new application after
  -- obtaining the parent lock. A newly submitted application causes a retry.
  select coalesce(array_agg(application_id order by application_id),'{}'::uuid[]),
    coalesce(array_agg(user_id order by application_id),'{}'::uuid[])
  into v_ids,v_users from public.squad_applications
  where squad_id=p_squad_id and status_application='PENDING';
  for v_applicant in select distinct u from unnest(v_users) u order by u loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('nexus:squad-application:'||v_applicant::text,0));
  end loop;
  perform application_id from public.squad_applications
    where application_id=any(v_ids) order by application_id for update;
  select * into v_squad from public.squads where squad_id=p_squad_id for update;
  if not found or v_squad.ketua_id<>v_actor then
    raise exception using errcode='42501', message='Only the Squad leader can disband';
  end if;
  perform user_id from public.profiles where user_id=v_actor
    and role_app='STUDENT' and status_akun='ACTIVE' and primary_class_id is not null for share;
  if not found then
    raise exception using errcode='42501', message='An active Student leader is required';
  end if;
  if v_squad.status_squad='DISBANDED' and v_squad.disbanded_by=v_actor then return; end if;
  if v_squad.status_squad not in ('OPEN_RECRUITMENT','FULL') then
    raise exception using errcode='22023', message='A Finalized or Completed Squad cannot be disbanded';
  end if;
  perform squad_member_id from public.squad_members where squad_id=p_squad_id
    and status_member='ACTIVE' order by squad_member_id for update;
  if (select count(*) from public.squad_members where squad_id=p_squad_id and status_member='ACTIVE')<>1
    or not exists (select 1 from public.squad_members where squad_id=p_squad_id
      and user_id=v_actor and role_squad='KETUA' and status_member='ACTIVE') then
    raise exception using errcode='22023', message='Only a solo active leader can disband';
  end if;
  if exists (select 1 from public.mission_result_submissions where squad_id=p_squad_id) then
    raise exception using errcode='22023', message='A Squad with result history cannot be disbanded';
  end if;
  if exists (select 1 from public.squad_applications where squad_id=p_squad_id
    and status_application='PENDING' and not(application_id=any(v_ids))) then
    raise exception using errcode='40001', message='Recruitment changed; reload and try again';
  end if;

  v_previous_internal := pg_catalog.current_setting('nexus.internal',true);
  perform pg_catalog.set_config('nexus.internal','1',true);
  update public.squads set status_squad='DISBANDED', disbanded_at=pg_catalog.now(),
    disbanded_by=v_actor where squad_id=p_squad_id;
  update public.squad_members set status_member='LEFT', ended_at=pg_catalog.now(),
    removed_by=v_actor, removal_reason='Squad dibubarkan oleh ketua.'
    where squad_id=p_squad_id and user_id=v_actor and status_member='ACTIVE';
  with cancelled as (
    update public.squad_applications set status_application='CANCELLED',
      decided_at=pg_catalog.now(),decided_by=v_actor
    where squad_id=p_squad_id and status_application='PENDING' and application_id=any(v_ids)
    returning user_id
  )
  insert into public.notifications(user_id,notification_type,title,body)
    select user_id,'SQUAD_DISBANDED','Squad dibubarkan',
      pg_catalog.format('Squad "%s" dibubarkan oleh ketua. Lamaranmu dibatalkan.',v_squad.nama_squad)
    from cancelled;
  perform pg_catalog.set_config('nexus.internal',coalesce(v_previous_internal,''),true);
end;
$$;
revoke all on function public.disband_solo_squad(uuid) from public,anon;
grant execute on function public.disband_solo_squad(uuid) to authenticated,service_role;
