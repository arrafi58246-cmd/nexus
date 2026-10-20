-- Local/sandbox only: simulate WIB cutoff without production fixtures.
insert into public.seasons(nama_season,start_date,end_date,status_season)
values ('Season 2026/2027','2026-07-01','2027-06-30','ACTIVE');
do $$ declare old_id uuid; new_id uuid; begin
select season_id into old_id from public.seasons where status_season='ACTIVE';
if nexus_private.season_for_award('2027-06-30','2027-06-30 23:59:59.999999+07') is distinct from old_id then raise exception 'before cutoff'; end if;
if nexus_private.season_for_award('2027-06-30','2027-07-01 00:00:00+07') is not null then raise exception 'at cutoff'; end if;
if nexus_private.maintain_seasons('2027-06-30 23:59:59.999999+07') is distinct from old_id then raise exception 'premature rollover'; end if;
new_id := nexus_private.maintain_seasons('2027-07-01 00:00:00+07');
if new_id is null or new_id=old_id or (select status_season from public.seasons where season_id=old_id)<>'CLOSED' then raise exception 'rollover failed'; end if;
if nexus_private.maintain_seasons('2027-07-01 00:05+07') is distinct from new_id then raise exception 'not idempotent'; end if;
if nexus_private.season_for_award('2027-06-30','2027-07-01 00:00:01+07') is not null then raise exception 'late old achievement assigned'; end if;
if nexus_private.season_for_award('2027-07-01','2027-07-01 00:00:01+07') is distinct from new_id then raise exception 'new season assignment'; end if;
end $$;
