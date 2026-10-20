-- LOCAL POLICY EMULATOR ONLY. Never mutate hosted Storage metadata via SQL.
begin;
do $test$
declare
  owner_role text := current_setting('role');
  u uuid[]; affected integer; own_path text; foreign_path text;
begin
  if current_setting('nexus.qa.storage_emulator',true) is distinct from '1' then
    raise exception 'Run only in the isolated Storage policy emulator';
  end if;
  select array_agg(user_id order by user_id) into u from (
    select user_id from public.profiles where role_app='STUDENT' and status_akun='ACTIVE'
    order by user_id limit 2) q;
  if coalesce(array_length(u,1),0)<>2 then raise exception 'Two QA Students required'; end if;
  own_path:=u[1]::text||'/'||gen_random_uuid()||'.png';
  foreign_path:=u[2]::text||'/'||gen_random_uuid()||'.png';
  insert into storage.objects(bucket_id,name,owner_id,metadata) values
    ('avatars',own_path,u[1]::text,'{}'),('avatars',foreign_path,u[2]::text,'{}');
  perform set_config('request.jwt.claim.sub',u[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u[1],'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  if (select count(*) from storage.objects where bucket_id='avatars' and name=own_path)<>1 then
    raise exception 'Own avatar metadata hidden'; end if;
  if exists(select 1 from storage.objects where bucket_id='avatars' and name=foreign_path) then
    raise exception 'Foreign avatar metadata disclosed'; end if;
  update storage.objects set metadata='{"qa":true}' where bucket_id='avatars' and name=own_path;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Active avatar update failed'; end if;
  delete from storage.objects where bucket_id='avatars' and name=foreign_path;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Foreign avatar deletion allowed'; end if;
  perform set_config('role',owner_role,true);
  perform set_config('nexus.internal','1',true);
  update public.profiles set status_akun='SUSPENDED' where user_id=u[1];
  perform set_config('nexus.internal','',true);
  perform set_config('role','authenticated',true);
  if exists(select 1 from storage.objects where bucket_id='avatars' and name=own_path) then
    raise exception 'Suspended caller can list avatar metadata'; end if;
  delete from storage.objects where bucket_id='avatars' and name=own_path;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Suspended avatar deletion allowed'; end if;
  perform set_config('role',owner_role,true);
  perform set_config('nexus.internal','1',true);
  update public.profiles set status_akun='ACTIVE' where user_id=u[1];
  perform set_config('nexus.internal','',true);
  perform set_config('role','authenticated',true);
  delete from storage.objects where bucket_id='avatars' and name=own_path;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Active avatar cleanup failed'; end if;
  perform set_config('role',owner_role,true);
end;
$test$;
rollback;
select 'PASS: isolated avatar owner read/update/delete; foreign and suspended metadata denied; rollback' as result;
