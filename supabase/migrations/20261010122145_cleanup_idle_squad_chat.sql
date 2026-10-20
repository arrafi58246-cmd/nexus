-- OPS-01 / G07 decision 10 Oct 2026: chat-only idle cleanup, preserve all history.
-- Workers/trigger functions are private; no new client RPC or RLS bypass endpoint.
create or replace function nexus_private.stamp_squad_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not public.nexus_internal_mode() then new.last_activity_at := clock_timestamp(); end if;
  elsif row(new.nama_squad,new.deskripsi_squad,new.kapasitas_anggota,new.status_squad,new.ketua_id,new.finalized_at)
    is distinct from row(old.nama_squad,old.deskripsi_squad,old.kapasitas_anggota,old.status_squad,old.ketua_id,old.finalized_at) then
    new.last_activity_at := greatest(old.last_activity_at,clock_timestamp());
  elsif pg_trigger_depth() = 1 and not public.nexus_internal_mode() then
    -- Clients cannot fabricate activity by writing only the timestamp.
    new.last_activity_at := old.last_activity_at;
  end if;
  return new;
end;
$$;

create trigger squads_activity_stamp before insert or update on public.squads
for each row execute function nexus_private.stamp_squad_activity();

create or replace function nexus_private.touch_squad_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_squad uuid;
  v_mode text;
begin
  if tg_op = 'UPDATE' and new is not distinct from old then return new; end if;
  if tg_op = 'UPDATE' and new.squad_id is distinct from old.squad_id then
    raise exception 'Squad activity source cannot be moved between Squads';
  end if;
  if tg_op = 'DELETE' then v_squad := old.squad_id; else v_squad := new.squad_id; end if;
  -- BEFORE insert obtains the same row lock as cleanup, before the source is visible.
  -- NO KEY UPDATE is compatible with FK key-share locks from unrelated child reads.
  perform 1 from public.squads where squad_id=v_squad for no key update;
  v_mode := current_setting('nexus.internal',true);
  perform set_config('nexus.internal','1',true);
  update public.squads set last_activity_at=greatest(last_activity_at,clock_timestamp())
    where squad_id=v_squad;
  perform set_config('nexus.internal',coalesce(v_mode,''),true);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Deleting chat (cleanup or completed Mission) is NOT user activity.
create trigger squad_messages_activity before insert on public.squad_messages
for each row execute function nexus_private.touch_squad_activity();
create trigger squad_members_activity before insert or update or delete on public.squad_members
for each row execute function nexus_private.touch_squad_activity();
create trigger squad_applications_activity before insert or update or delete on public.squad_applications
for each row execute function nexus_private.touch_squad_activity();
create trigger mission_result_activity before insert or update on public.mission_result_submissions
for each row execute function nexus_private.touch_squad_activity();
create trigger squad_requirements_activity before insert or update or delete on public.squad_requirements
for each row execute function nexus_private.touch_squad_activity();

-- Preserve known past activity at deployment. Never shorten an existing timestamp.
-- This reads message timestamps only; never message content.
do $$
declare v_mode text := current_setting('nexus.internal',true);
begin
  perform set_config('nexus.internal','1',true);
  update public.squads s set last_activity_at=greatest(s.last_activity_at,s.created_at,s.finalized_at,s.completed_at,
    (select max(m.created_at) from public.squad_messages m where m.squad_id=s.squad_id),
    (select max(greatest(m.joined_at,m.ended_at)) from public.squad_members m where m.squad_id=s.squad_id),
    (select max(greatest(a.created_at,a.decided_at)) from public.squad_applications a where a.squad_id=s.squad_id),
    (select max(greatest(r.submitted_at,r.reviewed_at)) from public.mission_result_submissions r where r.squad_id=s.squad_id));
  perform set_config('nexus.internal',coalesce(v_mode,''),true);
end;
$$;

create or replace function nexus_private.cleanup_idle_squad_chat(p_run_at timestamptz default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_squad uuid; v_cutoff timestamptz; v_rows integer; v_deleted integer:=0;
begin
  -- Owner-only optional clock supports isolated boundary tests; clients have no EXECUTE.
  v_cutoff := coalesce(p_run_at,clock_timestamp())-interval '720 hours';
  for v_squad in
    select s.squad_id from public.squads s
    where s.last_activity_at<v_cutoff
      and exists(select 1 from public.squad_messages m where m.squad_id=s.squad_id)
      and not exists(select 1 from public.mission_result_submissions r
        where r.squad_id=s.squad_id and r.status_validation='PENDING')
    order by s.squad_id
    for no key update of s skip locked
  loop
    -- Recheck AFTER acquiring each lock, including pending results.
    if exists(select 1 from public.squads s where s.squad_id=v_squad and s.last_activity_at<v_cutoff)
      and not exists(select 1 from public.mission_result_submissions r
        where r.squad_id=v_squad and r.status_validation='PENDING') then
      delete from public.squad_messages where squad_id=v_squad;
      get diagnostics v_rows=row_count;
      v_deleted:=v_deleted+v_rows;
    end if;
  end loop;
  return v_deleted;
end;
$$;

revoke all on function nexus_private.stamp_squad_activity(),nexus_private.touch_squad_activity(),
  nexus_private.cleanup_idle_squad_chat(timestamptz) from public,anon,authenticated,service_role;
-- pg_cron installed by the prior Season automation migration; UTC cron timezone.
-- Daily 19:00 UTC = 02:00 WIB, away from weekly badge refresh.
select cron.schedule('nexus-idle-squad-chat-cleanup','0 19 * * *',
  'select nexus_private.cleanup_idle_squad_chat();');
