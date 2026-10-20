-- LOCAL POLICY EMULATOR ONLY; result metadata fixtures have no real file bytes.
begin;
do $test$
declare
  owner_role text := current_setting('role');
  student uuid; result_id uuid := gen_random_uuid();
  certificate text; supporting text; loose text; affected integer;
begin
  if current_setting('nexus.qa.storage_emulator',true) is distinct from '1' then
    raise exception 'Run only in the isolated Storage policy emulator';
  end if;
  select user_id into student from public.profiles
    where role_app='STUDENT' and status_akun='ACTIVE' order by user_id limit 1;
  if student is null then raise exception 'QA Student required'; end if;
  certificate:=student::text||'/'||gen_random_uuid()||'/certificate.pdf';
  supporting:=student::text||'/'||gen_random_uuid()||'/supporting.pdf';
  loose:=student::text||'/'||gen_random_uuid()||'/loose.pdf';
  insert into storage.objects(bucket_id,name,owner_id,metadata) values
    ('mission-result-certificates',certificate,student::text,'{}'),
    ('mission-result-certificates',supporting,student::text,'{}'),
    ('mission-result-certificates',loose,student::text,'{}');
  insert into public.mission_result_submissions(result_submission_id,squad_id,submitted_by,
    hasil_kompetisi,submitted_tier_id,sertifikat_path,dokumen_pendukung_path,preview_xp)
  values(result_id,gen_random_uuid(),student,'PARTICIPANT',1,certificate,supporting,1);
  perform set_config('request.jwt.claim.sub',student::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',student,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  if (select count(*) from storage.objects where bucket_id='mission-result-certificates'
    and name in (certificate,supporting))<>2 then raise exception 'Referenced fixture hidden'; end if;
  update storage.objects set metadata='{"changed":true}'
    where bucket_id='mission-result-certificates' and name=certificate;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Referenced certificate update permitted'; end if;
  delete from storage.objects where bucket_id='mission-result-certificates'
    and name in (certificate,supporting);
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Referenced evidence deletion permitted'; end if;
  delete from storage.objects where bucket_id='mission-result-certificates' and name=loose;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Unreferenced cleanup regressed'; end if;
  perform set_config('role',owner_role,true);
  -- Emulate reference release after successful resubmission; this is not a
  -- submission/XP test. The local harness disables result fixture constraints.
  update public.mission_result_submissions set sertifikat_path=student::text||'/replacement.pdf',
    dokumen_pendukung_path=null where result_submission_id=result_id;
  perform set_config('role','authenticated',true);
  delete from storage.objects where bucket_id='mission-result-certificates'
    and name in (certificate,supporting);
  get diagnostics affected=row_count;
  if affected<>2 then raise exception 'Cleanup after reference release failed'; end if;
  perform set_config('role',owner_role,true);
end;
$test$;
rollback;
select 'PASS: isolated referenced result evidence protected; unreferenced/replaced files removable; rollback' as result;
