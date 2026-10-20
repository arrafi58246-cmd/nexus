-- Existing data is used only inside this rollback transaction.
begin;
do $test$
declare
  v_user uuid; v_own uuid; v_foreign uuid; v_count integer; v_denied boolean:=false;
begin
  select p.user_id into v_user from public.profiles p
  join public.user_badges b on b.user_id=p.user_id
  where p.role_app='STUDENT' and p.status_akun='ACTIVE' and p.primary_class_id is not null
  group by p.user_id having count(*)>1 order by count(*) desc,p.user_id limit 1;
  select user_badge_id into v_own from public.user_badges where user_id=v_user
    order by is_equipped asc,awarded_at desc,user_badge_id limit 1;
  select user_badge_id into v_foreign from public.user_badges where user_id<>v_user limit 1;
  assert v_user is not null and v_own is not null and v_foreign is not null, 'Missing badge fixtures';

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  select count(*) into v_count from (
    select b.user_badge_id,d.badge_name,b.is_equipped,b.awarded_at,
      s.nama_season,ps.nama_program_studi,f.nama_fakultas
    from public.user_badges b join public.badge_definitions d on d.badge_id=b.badge_id
    left join public.seasons s on s.season_id=b.season_id
    left join public.program_studi ps on ps.program_studi_id=b.program_studi_id
    left join public.fakultas f on f.fakultas_id=b.fakultas_id
    where b.user_id=auth.uid()
    order by b.is_equipped desc,b.awarded_at desc,b.user_badge_id limit 12
  ) collection;
  assert v_count>1 and v_count<=12, 'Collection query failed';
  begin
    perform public.equip_badge(v_foreign);
  exception when raise_exception then v_denied:=true;
  end;
  assert v_denied, 'Foreign badge could be equipped';
  perform public.equip_badge(v_own);
  assert (select count(*) from public.user_badges where user_id=auth.uid() and is_equipped)=1;
  assert (select is_equipped from public.user_badges where user_badge_id=v_own and user_id=auth.uid());
end;
$test$;
rollback;
select '{"collection":"PASS","own_equip":"PASS","foreign_equip":"DENIED","cleanup":"ROLLBACK"}'::jsonb as result;
