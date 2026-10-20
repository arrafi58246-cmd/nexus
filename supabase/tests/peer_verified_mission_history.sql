-- Run as the project database owner. Requires two ACTIVE students and at least
-- one credited APPROVED result. All temporary account-status changes ROLLBACK.
begin;
do $test$
declare
  v_viewer uuid; v_target uuid; v_admin uuid; v_count integer; v_total integer;
  v_denied boolean := false; v_payload jsonb;
begin
  select p.user_id into v_target from public.profiles p
  join public.xp_transactions x on x.user_id=p.user_id
  where p.role_app='STUDENT' and p.status_akun='ACTIVE'
  group by p.user_id order by count(*) desc,p.user_id limit 1;
  select user_id into v_viewer from public.profiles
    where role_app='STUDENT' and status_akun='ACTIVE' and user_id<>v_target limit 1;
  select user_id into v_admin from public.profiles where role_app='ADMIN' limit 1;
  assert v_target is not null and v_viewer is not null, 'Missing approved-history fixture';
  select count(*) into v_total from public.xp_transactions where user_id=v_target;
  assert not has_function_privilege('anon','public.get_peer_verified_mission_history(uuid)','EXECUTE');
  assert not has_function_privilege('anon','nexus_profile_private.get_peer_verified_mission_history(uuid)','EXECUTE');
  assert not (select prosecdef from pg_proc where oid='public.get_peer_verified_mission_history(uuid)'::regprocedure);

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_viewer,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  select count(*),jsonb_agg(to_jsonb(h)) into v_count,v_payload
    from public.get_peer_verified_mission_history(v_target) h;
  assert v_count>0 and v_count<=3 and v_count<=v_total, 'Peer history is missing or unbounded';
  assert not exists(select 1 from public.xp_transactions where user_id=v_target), 'Private ledger exposed';
  assert not exists(select 1 from public.achievement_claims where user_id=v_target), 'Private claims exposed';
  assert not exists(select 1 from public.profiles where user_id=v_target), 'Private profile exposed';
  assert not exists(select 1 from jsonb_array_elements(v_payload) e,
    lateral jsonb_object_keys(e) k where k not in
      ('history_id','source','name','organizer','squad_name','result','earned_at','recorded_at','xp','mission_id')),
    'Unexpected public-history fields';
  assert (select count(*) from public.get_peer_verified_mission_history(null))=0;
  if v_admin is not null then
    assert (select count(*) from public.get_peer_verified_mission_history(v_admin))=0, 'Admin result exposed';
  end if;

  execute 'set local role postgres';
  -- Every published row must be an approved credit belonging to this user.
  assert not exists(
    select 1 from jsonb_array_elements(v_payload) h
    left join public.xp_transactions x on x.xp_transaction_id=(h->>'history_id')::uuid
    left join public.mission_result_submissions r on r.result_submission_id=x.mission_result_submission_id
    left join public.achievement_claims a on a.achievement_claim_id=x.achievement_claim_id
    where x.user_id is distinct from v_target
      or (h->>'source'='SQUAD' and r.status_validation is distinct from 'APPROVED')
      or (h->>'source'='EXTERNAL' and (a.status_validation is distinct from 'APPROVED' or a.user_id<>v_target))
  ), 'Unapproved or foreign result exposed';

  perform set_config('request.jwt.claims','{}',true);
  update public.profiles set status_akun='SUSPENDED' where user_id=v_viewer;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_viewer,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  assert (select count(*) from public.get_peer_verified_mission_history(v_target))=0, 'Suspended viewer can read';

  execute 'set local role postgres';
  perform set_config('request.jwt.claims','{}',true);
  update public.profiles set status_akun='ACTIVE' where user_id=v_viewer;
  update public.profiles set status_akun='SUSPENDED' where user_id=v_target;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_viewer,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  assert (select count(*) from public.get_peer_verified_mission_history(v_target))=0, 'Suspended target exposed';

  execute 'set local role postgres';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  execute 'set local role authenticated';
  assert (select count(*) from public.get_peer_verified_mission_history(v_target))=0, 'Missing account can read';
  execute 'set local role postgres';
  perform set_config('request.jwt.claims','{}',true);
  execute 'set local role anon';
  begin
    perform * from public.get_peer_verified_mission_history(v_target);
  exception when insufficient_privilege then v_denied:=true;
  end;
  assert v_denied, 'Anonymous execution allowed';
end;
$test$;
rollback;
select '{"peer_history":"PASS","private_data":"HIDDEN","inactive_accounts":"DENIED","anon":"DENIED","cleanup":"ROLLBACK"}'::jsonb as result;
