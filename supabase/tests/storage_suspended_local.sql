-- LOCAL EMULATOR ONLY. Never write hosted Storage metadata through SQL.
-- Harness must load actual Storage policies and set nexus.qa.storage_emulator=1.
begin;
do $test$
declare
  owner_role text := current_setting('role');
  student uuid; bucket text; object_name text; affected integer;
begin
  if current_setting('nexus.qa.storage_emulator',true) is distinct from '1' then
    raise exception 'Run only in the isolated Storage policy emulator';
  end if;
  select user_id into student from public.profiles
    where nama_lengkap like 'Mahasiswa Test NEXUS%' and role_app='STUDENT'
      and status_akun='ACTIVE' order by user_id limit 1;
  if student is null then raise exception 'QA Student required'; end if;
  perform set_config('request.jwt.claim.sub',student::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',student,'role','authenticated')::text,true);
  foreach bucket in array array['avatars','mission-documents','achievement-certificates','mission-result-certificates'] loop
    object_name:=student::text||'/qa-'||gen_random_uuid()||'.png';
    perform set_config('role','authenticated',true);
    insert into storage.objects(bucket_id,name,owner_id,metadata)
      values(bucket,object_name,student::text,'{}');
    -- The existing avatar policy set has no SELECT policy; do not invent one.
    if bucket<>'avatars' then
      update storage.objects set metadata='{"qa":true}' where bucket_id=bucket and name=object_name;
      get diagnostics affected=row_count;
      if affected<>1 then raise exception 'Active owner update failed: %',bucket; end if;
    end if;
    begin
      insert into storage.objects(bucket_id,name,owner_id,metadata)
        values(bucket,gen_random_uuid()::text||'/foreign.png',student::text,'{}');
      raise exception using errcode='ZX999',message='Foreign-path upload permitted';
    exception when insufficient_privilege then null;
    end;
    perform set_config('role',owner_role,true);
    perform set_config('nexus.internal','1',true);
    update public.profiles set status_akun='SUSPENDED' where user_id=student;
    perform set_config('nexus.internal','',true);
    perform set_config('role','authenticated',true);
    begin
      insert into storage.objects(bucket_id,name,owner_id,metadata)
        values(bucket,student::text||'/blocked-'||gen_random_uuid()||'.png',student::text,'{}');
      raise exception using errcode='ZX999',message='Suspended Storage INSERT permitted';
    exception when insufficient_privilege then null;
    end;
    update storage.objects set metadata='{"blocked":true}' where bucket_id=bucket and name=object_name;
    get diagnostics affected=row_count;
    if affected<>0 then raise exception 'Suspended Storage UPDATE permitted'; end if;
    delete from storage.objects where bucket_id=bucket and name=object_name;
    get diagnostics affected=row_count;
    if affected<>0 then raise exception 'Suspended Storage DELETE permitted'; end if;
    perform set_config('role',owner_role,true);
    perform set_config('nexus.internal','1',true);
    update public.profiles set status_akun='ACTIVE' where user_id=student;
    perform set_config('nexus.internal','',true);
    perform set_config('role','authenticated',true);
    if bucket<>'avatars' then
      delete from storage.objects where bucket_id=bucket and name=object_name;
      get diagnostics affected=row_count;
      if affected<>1 then raise exception 'Reactivated owner DELETE failed'; end if;
    end if;
    perform set_config('role',owner_role,true);
  end loop;
end;
$test$;
rollback;
select 'PASS: isolated Storage policy emulator; active uploads, foreign paths, suspended writes and private-document reactivation' as result;
