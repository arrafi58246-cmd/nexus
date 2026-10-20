-- Dedicated QA fixtures only. All writes roll back. See docs/skills_concurrency_endorsement_access_qa.md.
-- Run the whole file in one session; on any error issue ROLLBACK before reuse.
begin;
select set_config('qa.member_id','11111111-1111-4111-8111-111111111111',true);
select set_config('qa.peer_id','22222222-2222-4222-8222-222222222222',true);
select set_config('qa.outsider_id','33333333-3333-4333-8333-333333333333',true);
select set_config('qa.completed_squad','44444444-4444-4444-8444-444444444444',true);
do $fixture$ begin
 if current_setting('qa.member_id')='11111111-1111-4111-8111-111111111111'
 or current_setting('qa.peer_id')='22222222-2222-4222-8222-222222222222'
 or current_setting('qa.outsider_id')='33333333-3333-4333-8333-333333333333'
 or current_setting('qa.completed_squad')='44444444-4444-4444-8444-444444444444'
 then raise exception 'Replace all four dedicated QA UUID placeholders'; end if;
 if (select count(*) from public.profiles where user_id in(current_setting('qa.member_id')::uuid,current_setting('qa.peer_id')::uuid,current_setting('qa.outsider_id')::uuid)
 and role_app='STUDENT' and status_akun='ACTIVE' and primary_class_id is not null)<>3
 then raise exception 'Three distinct ACTIVE onboarded QA students required'; end if;
 if not exists(select 1 from public.squads where squad_id=current_setting('qa.completed_squad')::uuid and status_squad='MISSION_COMPLETED')
 or (select count(distinct user_id) from public.finalized_squad_members where squad_id=current_setting('qa.completed_squad')::uuid
 and user_id in(current_setting('qa.member_id')::uuid,current_setting('qa.peer_id')::uuid))<>2
 or exists(select 1 from public.squad_members where squad_id=current_setting('qa.completed_squad')::uuid and user_id=current_setting('qa.outsider_id')::uuid)
 then raise exception 'Invalid completed Squad fixture'; end if;
 if not exists(select 1 from public.squads where squad_id=current_setting('qa.completed_squad')::uuid
   and completed_at<=clock_timestamp() and clock_timestamp()<completed_at+interval '336 hours')
 then raise exception 'Completed QA fixture must be within the 14-day endorsement window';end if;
 if not exists(select 1 from public.endorsements where squad_id=current_setting('qa.completed_squad')::uuid)
 then raise exception 'Existing fixture rating required for meaningful UPDATE/DELETE denial checks'; end if;
end $fixture$;

set local lock_timeout='3s';
set local statement_timeout='20s';
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',current_setting('qa.outsider_id'),true);
set local role authenticated;
do $t$ declare msg text; changed integer; begin
  -- Outsider attempts to impersonate an existing member. Trigger must use the actor.
  begin
    insert into public.endorsements(squad_id,from_user_id,to_user_id,communication,contribution,teamwork,responsibility)
    values(current_setting('qa.completed_squad')::uuid,current_setting('qa.member_id')::uuid,current_setting('qa.peer_id')::uuid,4,4,4,4);
    raise exception 'FAIL outsider/forged sender accepted';
  exception when sqlstate 'P0001' then get stacked diagnostics msg=message_text;
    if msg<>'Both users must be members at Squad finalization' then raise; end if;
  end;
  update public.endorsements set communication=1 where squad_id=current_setting('qa.completed_squad')::uuid;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'FAIL outsider update'; end if;
  delete from public.endorsements where squad_id=current_setting('qa.completed_squad')::uuid;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'FAIL outsider delete'; end if;
end $t$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('qa.member_id'),true);
set local role authenticated;
do $t$ declare msg text; sid uuid; begin
  begin
    insert into public.endorsements(squad_id,from_user_id,to_user_id,communication,contribution,teamwork,responsibility)
    values(current_setting('qa.completed_squad')::uuid,auth.uid(),current_setting('qa.outsider_id')::uuid,4,4,4,4);
    raise exception 'FAIL outsider recipient accepted';
  exception when sqlstate 'P0001' then get stacked diagnostics msg=message_text;
    if msg<>'Both users must be members at Squad finalization' then raise; end if;
  end;
  select squad_id into strict sid from public.squads where status_squad<>'MISSION_COMPLETED' limit 1;
  begin
    insert into public.endorsements(squad_id,from_user_id,to_user_id,communication,contribution,teamwork,responsibility)
    values(sid,auth.uid(),current_setting('qa.peer_id')::uuid,4,4,4,4);
    raise exception 'FAIL incomplete Squad accepted';
  exception when sqlstate 'P0001' then get stacked diagnostics msg=message_text;
    if msg<>'Endorsements are allowed only after Mission Completed' then raise; end if;
  end;
end $t$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
set local role anon;
do $t$ declare msg text; begin
  if exists(select 1 from public.endorsements) then raise exception 'FAIL anonymous read'; end if;
  begin
    insert into public.endorsements(squad_id,from_user_id,to_user_id,communication,contribution,teamwork,responsibility)
    values(current_setting('qa.completed_squad')::uuid,current_setting('qa.member_id')::uuid,current_setting('qa.peer_id')::uuid,4,4,4,4);
    raise exception 'FAIL anonymous insert';
  exception when insufficient_privilege then null;
    when sqlstate 'P0001' then get stacked diagnostics msg=message_text;
      if msg<>'Endorsements are allowed only after Mission Completed' then raise; end if;
  end;
end $t$;
reset role;
-- Only the dedicated QA profile is temporarily suspended; restore via ROLLBACK.
update public.profiles set status_akun='SUSPENDED', email_unesa='qa-access-rollback-20261011@mhs.unesa.ac.id'
where user_id=current_setting('qa.member_id')::uuid;
select set_config('request.jwt.claim.sub',current_setting('qa.member_id'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $t$ begin
  if public.is_active_user() then raise exception 'FAIL suspension setup'; end if;
  begin
    insert into public.endorsements(squad_id,from_user_id,to_user_id,communication,contribution,teamwork,responsibility)
    values(current_setting('qa.completed_squad')::uuid,auth.uid(),current_setting('qa.peer_id')::uuid,4,4,4,4);
    raise exception 'FAIL suspended insert';
  exception when insufficient_privilege then null;
  end;
end $t$;
reset role;
rollback;
select 'PASS: outsider sender/recipient, forged sender, unfinished Squad, anonymous read/write, outsider update/delete, suspended write; rolled back' as result;
