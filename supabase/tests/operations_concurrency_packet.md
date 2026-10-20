# Operations concurrency SQL packet

Owner-run QA only. Evidence from the executed 11 October run is in [the report](../../docs/privilege_hardening_operations_concurrency_qa.md). These commands are not application endpoints or migrations.

Replace `<QA_STUDENT_UUID>`, `<QA_ADMIN_UUID>`, `<ACTIVE_SEASON_UUID>` with approved QA fixtures; retain the setup's account checks or adapt them to the explicitly selected dedicated account. Schedule the seven worker commands to start at the same time in separate sessions. Do not submit them through a connector that serializes requests. The 2026-10-11 run used temporary pg_cron jobs; ensure their names are unused and unschedule them after one execution. Product jobs must remain untouched.

The expected delays are intentional (chat first 16 s, cleanup starts after 1 s and holds 16 s, second chat/review after 3 s, observers after 6 s). Every worker uses timeouts. Inspect failures before rerunning. The claim and Season workers must end in ROLLBACK. The cleanup workers COMMIT only synthetic chat changes after the non-target message preservation assertion.

Use the exact temporary job names with the `nexus-qa-backend-` prefix from this run. Confirm that the prefix is unused before scheduling. Cleanup resolves their current IDs by name and must not touch product jobs. If a worker fails, inspect and clean only recorded fixture IDs; verification assertions intentionally stop the success cleanup when the final state differs.

## Setup

```sql
begin;
set local lock_timeout='3s'; set local statement_timeout='15s';
do $qa$
declare m public.missions%rowtype; mid uuid; sid uuid; u uuid:='<QA_STUDENT_UUID>';
begin
if exists(select 1 from public.missions where mission_id in('d5120000-0000-4000-8000-000000000001','d5120000-0000-4000-8000-000000000002')) then raise exception 'QA Mission IDs occupied'; end if;
if not exists(select 1 from public.profiles where user_id=u and nama_lengkap='Mahasiswa Test NEXUS 2' and status_akun='ACTIVE' and role_app='STUDENT') then raise exception 'QA actor unavailable'; end if;
perform set_config('request.jwt.claim.sub',u::text,true);
perform set_config('request.jwt.claim.role','authenticated',true);
for i in 1..2 loop
select * into strict m from public.missions order by mission_id limit 1;
mid:=('d5120000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
sid:=('d5130000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
m.mission_id:=mid; m.source_submission_id:=null; m.nama_lomba:='QA concurrency cleanup 20261011 '||i;
m.deadline_pendaftaran:=clock_timestamp()+interval '1 day'; m.deadline_lomba:=clock_timestamp()+interval '2 days';
m.min_anggota_tim:=2;m.max_anggota_tim:=2;
insert into public.missions select(m).*;
insert into public.squads(squad_id,mission_id,ketua_id,nama_squad,deskripsi_squad,kapasitas_anggota)
values(sid,mid,u,'QA concurrency cleanup '||i,'Dedicated disposable concurrency fixture',2);
insert into public.squad_messages(message_id,squad_id,sender_id,content)
values(('d5140000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,sid,u,'QA old message');
perform set_config('nexus.internal','1',true);
update public.squads set last_activity_at=clock_timestamp()-interval '721 hours' where squad_id=sid;
perform set_config('nexus.internal','0',true);
end loop;
end $qa$;
commit;
select count(*) as qa_squads from public.squads where squad_id in('d5130000-0000-4000-8000-000000000001','d5130000-0000-4000-8000-000000000002');
```

## Worker: chatFirst

```sql
begin; set local lock_timeout='35s'; set local statement_timeout='40s'; set local application_name='nexus_qa_chat_first';
select set_config('request.jwt.claim.sub','<QA_STUDENT_UUID>',true); select set_config('request.jwt.claim.role','authenticated',true); set local role authenticated;
insert into public.squad_messages(message_id,squad_id,sender_id,content) values('d5140000-0000-4000-8000-000000000003','d5130000-0000-4000-8000-000000000001',auth.uid(),'QA concurrent new message first'); select pg_sleep(16); commit;
```

## Worker: cleanupFirst

```sql
begin; set local lock_timeout='35s'; set local statement_timeout='40s'; set local application_name='nexus_qa_cleanup_first';
select pg_sleep(1);
do $qa$ declare outside_ids uuid[]; deleted integer; begin
if not exists(select 1 from pg_stat_activity where application_name='nexus_qa_chat_first' and wait_event='PgSleep') then raise exception 'Chat-first worker not holding transaction'; end if;
select array_agg(message_id) into outside_ids from public.squad_messages where squad_id<>'d5130000-0000-4000-8000-000000000002';
deleted:=nexus_private.cleanup_idle_squad_chat();
if deleted<>1 or exists(select 1 from public.squad_messages where message_id='d5140000-0000-4000-8000-000000000002') then raise exception 'Expected exactly one old QA message deleted'; end if;
if exists(select 1 from unnest(outside_ids) id where not exists(select 1 from public.squad_messages m where m.message_id=id)) then raise exception 'Non-target message deleted; rollback'; end if;
if not exists(select 1 from public.squad_messages where message_id='d5140000-0000-4000-8000-000000000001') then raise exception 'Locked active Squad was not skipped'; end if;
end $qa$;
select pg_sleep(16); commit;
```

## Worker: chatSecond

```sql
begin; set local lock_timeout='35s'; set local statement_timeout='40s'; set local application_name='nexus_qa_chat_second';
select pg_sleep(3);
select set_config('request.jwt.claim.sub','<QA_STUDENT_UUID>',true); select set_config('request.jwt.claim.role','authenticated',true); set local role authenticated;
insert into public.squad_messages(message_id,squad_id,sender_id,content) values('d5140000-0000-4000-8000-000000000004','d5130000-0000-4000-8000-000000000002',auth.uid(),'QA new message after cleanup'); commit;
```

## Worker: cleanupObserver

```sql
begin; set local lock_timeout='35s'; set local statement_timeout='40s'; set local application_name='nexus_qa_cleanup_observer';
select pg_sleep(6); do $$ begin
if not exists(select 1 from pg_stat_activity a join pg_stat_activity b on a.pid=any(pg_blocking_pids(b.pid)) where a.application_name='nexus_qa_cleanup_first' and b.application_name='nexus_qa_chat_second' and b.wait_event_type='Lock' and a.pid<>b.pid) then raise exception 'Missing cleanup/chat lock overlap'; end if;
end $$; commit;
```

## Worker: seasonClose

```sql
begin; set local lock_timeout='35s'; set local statement_timeout='40s'; set local application_name='nexus_qa_season_close';
select set_config('request.jwt.claim.sub','<QA_ADMIN_UUID>',true); select set_config('request.jwt.claim.role','authenticated',true); set local role authenticated;
select public.close_active_season('<ACTIVE_SEASON_UUID>');
select pg_sleep(16); rollback;
```

## Worker: seasonReview

```sql
begin; set local lock_timeout='35s'; set local statement_timeout='40s'; set local application_name='nexus_qa_season_review';
select pg_sleep(3);
do $qa$ declare u uuid:='<QA_STUDENT_UUID>'; claim uuid:=gen_random_uuid(); path text; tier bigint; xp integer; started timestamptz; begin
select tier_id,legacy_xp into strict tier,xp from public.xp_rules where hasil_kompetisi='PARTICIPANT' order by tier_id limit 1;
perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
path:=u||'/'||claim||'/'||gen_random_uuid()||'.pdf';
insert into storage.objects(bucket_id,name,owner_id,metadata) values('achievement-certificates',path,u::text,'{"size":100,"mimetype":"application/pdf"}');
perform set_config('role','authenticated',true);
insert into public.achievement_claims(achievement_claim_id,user_id,nama_kompetisi,penyelenggara,achievement_date,submitted_tier_id,hasil_kompetisi,sertifikat_path,preview_xp)
values(claim,u,'QA concurrency rollback claim','QA',(clock_timestamp() at time zone 'Asia/Jakarta')::date,tier,'PARTICIPANT',path,0);
perform set_config('request.jwt.claim.sub','<QA_ADMIN_UUID>',true);
started:=clock_timestamp();
update public.achievement_claims set status_validation='APPROVED',approved_tier_id=tier where achievement_claim_id=claim;
perform set_config('role','postgres',true);
if not exists(select 1 from public.achievement_claims where achievement_claim_id=claim and reviewed_at>started+interval '8 seconds') then raise exception 'Review timestamp not stamped after wait'; end if;
if not exists(select 1 from public.xp_transactions where achievement_claim_id=claim and xp_amount=xp and season_id='<ACTIVE_SEASON_UUID>') then raise exception 'Review did not resume against restored active Season'; end if;
end $qa$; rollback;
```

## Worker: seasonObserver

```sql
begin; set local lock_timeout='35s'; set local statement_timeout='40s'; set local application_name='nexus_qa_season_observer';
select pg_sleep(6); do $$ begin
if not exists(select 1 from pg_stat_activity a join pg_stat_activity b on a.pid=any(pg_blocking_pids(b.pid)) where a.application_name='nexus_qa_season_close' and b.application_name='nexus_qa_season_review' and b.wait_event='advisory' and a.pid<>b.pid) then raise exception 'Missing Season/review advisory-lock overlap'; end if;
end $$; commit;
```

## Verify and clean up

```sql
begin; set local lock_timeout='3s'; set local statement_timeout='15s';
do $$ begin
if (select count(distinct j.jobid) from cron.job j join cron.job_run_details r using(jobid) where j.jobname like 'nexus-qa-backend-%' and r.status='succeeded')<>7 then raise exception 'Concurrency workers not all passed'; end if;
if (select count(*) from public.squad_messages where squad_id='d5130000-0000-4000-8000-000000000001')<>2
or (select count(*) from public.squad_messages where squad_id='d5130000-0000-4000-8000-000000000002')<>1
or not exists(select 1 from public.squad_messages where message_id='d5140000-0000-4000-8000-000000000004')
or exists(select 1 from public.squad_messages where message_id='d5140000-0000-4000-8000-000000000002') then raise exception 'Cleanup/chat final state failed'; end if;
if (select count(*) from public.squads where squad_id in('d5130000-0000-4000-8000-000000000001','d5130000-0000-4000-8000-000000000002') and last_activity_at>clock_timestamp()-interval '1 hour')<>2 then raise exception 'New chat did not update activity'; end if;
end $$;
select cron.unschedule(jobid) from cron.job where jobname like 'nexus-qa-backend-%';
delete from public.squads where squad_id in('d5130000-0000-4000-8000-000000000001','d5130000-0000-4000-8000-000000000002') and nama_squad like 'QA concurrency cleanup %' and mission_id in('d5120000-0000-4000-8000-000000000001','d5120000-0000-4000-8000-000000000002');
delete from public.missions where mission_id in('d5120000-0000-4000-8000-000000000001','d5120000-0000-4000-8000-000000000002') and nama_lomba like 'QA concurrency cleanup 20261011 %' and source_submission_id is null;
commit;
select jsonb_build_object('qa_missions',(select count(*) from public.missions where mission_id::text like 'd5120000-0000-4000-8000-%'),'qa_squads',(select count(*) from public.squads where squad_id::text like 'd5130000-0000-4000-8000-%'),'qa_messages',(select count(*) from public.squad_messages where message_id::text like 'd5140000-0000-4000-8000-%'),'qa_jobs',(select count(*) from cron.job where jobname like 'nexus-qa-backend-%'),'qa_claims',(select count(*) from public.achievement_claims where nama_kompetisi='QA concurrency rollback claim'),'qa_notifications',(select count(*) from public.notifications where title like '%QA concurrency%' or body like '%QA concurrency%'),'active_season',(select season_id from public.seasons where status_season='ACTIVE'),'xp_total',(select sum(xp_amount) from public.xp_transactions),'badge_count',(select count(*) from public.user_badges)) as final_check;
```

