-- Owner-only SQL role/JWT simulation against fresh fixtures. No Auth login/browser.
-- All writes are rolled back. No destructive maintenance operation is executed.
begin;
set local statement_timeout='30s';
do $test$
declare
  v_owner text:=current_setting('role');
  u uuid[]; a uuid; c bigint;
  m public.missions%rowtype;
  s uuid; msg uuid; n1 uuid; n2 uuid; affected integer;
begin
  select array_agg(user_id order by nama_lengkap) into u from (
    select user_id,nama_lengkap from public.profiles
    where nama_lengkap like 'Mahasiswa Test NEXUS%' and role_app='STUDENT'
      and status_akun='ACTIVE' and primary_class_id is not null
    order by nama_lengkap limit 2) q;
  select user_id into a from public.profiles where role_app='ADMIN' and status_akun='ACTIVE' order by user_id limit 1;
  if coalesce(array_length(u,1),0)<>2 or a is null then raise exception 'Requires two dedicated QA Students and active Admin'; end if;
  select primary_class_id into c from public.primary_classes order by primary_class_id limit 1;
  select * into m from public.missions order by mission_id limit 1;
  if m.mission_id is null then raise exception 'Requires Mission template'; end if;
  m.mission_id:=gen_random_uuid();m.source_submission_id:=null;
  m.nama_lomba:='QA ROLE ACCESS '||m.mission_id;
  m.deadline_pendaftaran:=now()+interval '1 day';m.deadline_lomba:=now()+interval '2 days';
  m.min_anggota_tim:=2;m.max_anggota_tim:=2;
  insert into public.missions select (m).*;
  insert into public.notifications(user_id,notification_type,title,body)
    values(u[1],'QA_ROLE_ACCESS','QA','QA owner') returning notification_id into n1;
  insert into public.notifications(user_id,notification_type,title,body)
    values(u[2],'QA_ROLE_ACCESS','QA','QA other') returning notification_id into n2;

  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  if not public.is_active_user() or public.is_admin() then raise exception 'Student identity wrong';end if;
  if (select count(*) from public.profiles where user_id=u[1])<>1
    or (select count(*) from public.profiles where user_id in(u[2],a))<>0 then
    raise exception 'Student private profile isolation failed';end if;
  if (select count(*) from public.public_profiles where user_id=u[2])<>1 then
    raise exception 'Sanitized public-profile read regressed';end if;
  if (select count(*) from public.career_xp_totals where user_id=u[1])<>1 then
    raise exception 'Career XP read regressed';end if;
  if exists(select 1 from public.xp_transactions where user_id<>u[1]) then
    raise exception 'Student can read another private XP ledger';end if;
  if (select count(*) from public.notifications where notification_id=n1)<>1
    or (select count(*) from public.notifications where notification_id=n2)<>0 then
    raise exception 'Notification ownership failed';end if;
  update public.notifications set is_read=true where notification_id=n1;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Own notification update denied';end if;
  update public.notifications set is_read=true where notification_id=n2;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Foreign notification update allowed';end if;
  begin
    update public.profiles set role_app='ADMIN' where user_id=u[1];
    raise exception using errcode='ZX999',message='Student role escalation allowed';
  exception when raise_exception then
    if sqlerrm<>'Identity, academic placement, role, and account status are not editable from Edit Profile' then raise;end if;
  end;
  update public.missions set nama_lomba='QA unauthorized' where mission_id=m.mission_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Student edited Mission master';end if;
  s:=public.create_squad(m.mission_id,'QA role Squad','QA',2::smallint,
    jsonb_build_array(jsonb_build_object('primary_class_id',c,'slot_dibutuhkan',1)));
  insert into public.squad_messages(squad_id,sender_id,content)
    values(s,u[1],'QA role access fixture') returning message_id into msg;
  if (select count(*) from public.squad_messages where message_id=msg)<>1 then
    raise exception 'Active member cannot read own Squad chat';end if;

  perform set_config('request.jwt.claim.sub',u[2]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[2],'role','authenticated')::text,true);
  if exists(select 1 from public.squad_messages where squad_id=s) then raise exception 'Outsider read chat';end if;
  begin
    insert into public.squad_messages(squad_id,sender_id,content) values(s,u[2],'QA blocked outsider');
    raise exception using errcode='ZX999',message='Outsider wrote chat';
  exception when insufficient_privilege then null;end;

  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  if not public.is_admin() then raise exception 'Admin identity wrong';end if;
  if (select count(*) from public.profiles where user_id in(u[1],u[2]))<>2 then
    raise exception 'Admin profile review regressed';end if;
  update public.missions set nama_lomba='QA ROLE ACCESS ADMIN '||m.mission_id where mission_id=m.mission_id;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Admin Mission update regressed';end if;
  if exists(select 1 from public.squad_messages where squad_id=s) then raise exception 'Admin read private chat';end if;
  begin
    insert into public.squad_messages(squad_id,sender_id,content) values(s,a,'QA blocked admin');
    raise exception using errcode='ZX999',message='Admin wrote private chat';
  exception when insufficient_privilege then null;end;

  perform set_config('role',v_owner,true);
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  perform set_config('role','anon',true);
  if exists(select 1 from public.profiles) or exists(select 1 from public.notifications)
    or exists(select 1 from public.squad_messages) or exists(select 1 from public.xp_transactions) then
    raise exception 'Anonymous private data read allowed';end if;
  begin
    perform 1 from public.public_profiles limit 1;
    raise exception using errcode='ZX999',message='Anonymous public-profile view access allowed';
  exception when insufficient_privilege then null;end;
  perform set_config('role',v_owner,true);
end;
$test$;
rollback;
select 'PASS: Student/Admin/outsider/anonymous role matrix; all fixtures rolled back' as result;
