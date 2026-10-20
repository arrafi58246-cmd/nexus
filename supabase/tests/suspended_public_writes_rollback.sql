-- Database-owner SQL role/JWT test. No Storage metadata writes or Auth login.
begin;
set local statement_timeout = '30s';
do $test$
declare
  owner_role text := current_setting('role');
  student uuid; admin_id uuid; notification uuid; affected integer;
  skill bigint; mission_submission uuid;
  template public.missions%rowtype; rule public.xp_rules%rowtype;
  submission public.mission_submissions%rowtype;
  operation text;
begin
  select p.user_id into student from public.profiles p
  where p.nama_lengkap like 'Mahasiswa Test NEXUS%' and p.role_app='STUDENT'
    and p.status_akun='ACTIVE' and p.primary_class_id is not null
    and (select count(*) from public.user_skills us where us.user_id=p.user_id)<5
  order by p.user_id limit 1;
  select user_id into admin_id from public.profiles
    where role_app='ADMIN' and status_akun='ACTIVE' order by user_id limit 1;
  select s.skill_id into skill from public.skills s
    where not exists(select 1 from public.user_skills us where us.user_id=student and us.skill_id=s.skill_id)
    order by s.skill_id limit 1;
  select * into template from public.missions order by mission_id limit 1;
  select * into rule from public.xp_rules order by xp_rule_id limit 1;
  if student is null or admin_id is null or skill is null or template.mission_id is null or rule.tier_id is null then
    raise exception 'Requires dedicated QA Student with a spare Skill slot, Admin, Mission and XP rule';
  end if;
  -- Normalize only the QA fixture's legacy email within this rollback transaction.
  perform set_config('nexus.internal','1',true);
  update public.profiles set email_unesa=student::text||'@mhs.unesa.ac.id' where user_id=student;
  perform set_config('nexus.internal','',true);
  insert into public.notifications(user_id,notification_type,title,body)
    values(student,'QA_SUSPENSION','QA','QA') returning notification_id into notification;
  submission:=jsonb_populate_record(null::public.mission_submissions,
    to_jsonb(template)||jsonb_build_object('mission_submission_id',gen_random_uuid(),
      'submitted_by',student,'nama_lomba','QA SUSPENSION '||gen_random_uuid(),
      'deadline_pendaftaran',now()+interval '1 day','deadline_lomba',now()+interval '2 days',
      'dokumen_path',student::text||'/qa-suspension.pdf','status_review','PENDING',
      'submitted_at',now(),'resubmission_count',0,'min_anggota_tim',2,'max_anggota_tim',3));

  -- Owner creates only a public-table fixture; no file metadata is fabricated.
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  insert into public.mission_submissions select (submission).*;
  mission_submission:=submission.mission_submission_id;

  perform set_config('request.jwt.claim.sub',student::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',student,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  update public.profiles set bio='QA active profile edit' where user_id=student;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Active profile edit failed'; end if;
  insert into public.user_skills(user_id,skill_id) values(student,skill);
  update public.notifications set is_read=true where notification_id=notification;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Active notification update failed'; end if;

  perform set_config('role',owner_role,true);
  perform set_config('nexus.internal','1',true);
  update public.profiles set status_akun='SUSPENDED' where user_id=student;
  perform set_config('nexus.internal','',true);
  perform set_config('role','authenticated',true);
  if public.is_active_user() then raise exception 'Suspension fixture failed'; end if;
  foreach operation in array array[
    format('update public.profiles set bio=''QA blocked'' where user_id=%L',student),
    format('delete from public.user_skills where user_id=%L and skill_id=%s',student,skill),
    format('update public.mission_submissions set deskripsi_singkat=''QA blocked'' where mission_submission_id=%L',mission_submission),
    format('update public.notifications set is_read=false where notification_id=%L',notification)
  ] loop
    execute operation;
    get diagnostics affected=row_count;
    if affected<>0 then raise exception 'Suspended write succeeded: %',operation; end if;
  end loop;
  submission.mission_submission_id:=gen_random_uuid();
  submission.nama_lomba:='QA suspended attempt '||gen_random_uuid();
  begin
    insert into public.mission_submissions select (submission).*;
    raise exception using errcode='ZX999',message='Suspended Mission insert succeeded';
  exception when raise_exception then
    if sqlerrm<>'Only active onboarded students may submit Missions' then raise; end if;
  end;
  begin
    insert into public.achievement_claims(user_id,nama_kompetisi,penyelenggara,
      achievement_date,submitted_tier_id,hasil_kompetisi,sertifikat_path)
    values(student,'QA blocked claim','QA',current_date,rule.tier_id,
      rule.hasil_kompetisi,student::text||'/qa-blocked.pdf');
    raise exception using errcode='ZX999',message='Suspended claim insert succeeded';
  exception when raise_exception then
    if sqlerrm<>'Only active students may submit claims' then raise; end if;
  end;
  begin
    perform public.equip_badge(gen_random_uuid());
    raise exception using errcode='ZX999',message='Suspended badge RPC succeeded';
  exception when raise_exception then
    if sqlerrm<>'Account is not active' then raise; end if;
  end;

  -- Active admin can still manage the suspended user's notification.
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  update public.notifications set is_read=false where notification_id=notification;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Admin notification access regressed'; end if;
  perform set_config('role',owner_role,true);
  perform set_config('nexus.internal','1',true);
  update public.profiles set status_akun='ACTIVE' where user_id=student;
  perform set_config('nexus.internal','',true);
  perform set_config('request.jwt.claim.sub',student::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',student,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  update public.notifications set is_read=true where notification_id=notification;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Reactivated notification access failed'; end if;
  perform set_config('role',owner_role,true);
end;
$test$;
rollback;
select 'PASS: active profile/skill/notification writes; suspended profile/skill/Mission/claim/notification and badge denials; admin/reactivation; rollback' as result;
