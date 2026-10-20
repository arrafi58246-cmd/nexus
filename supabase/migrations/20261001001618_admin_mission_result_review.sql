-- Preserve the submitted result while recording the admin's final decision.
-- Existing APPROVED rows predate this field and retain NULL for historical data.
alter table public.mission_result_submissions
  add column approved_hasil_kompetisi public.hasil_kompetisi_enum;

alter table public.mission_result_submissions
  add constraint mission_result_final_outcome_only_approved
  check (status_validation = 'APPROVED' or approved_hasil_kompetisi is null);

create or replace function public.guard_mission_result_update()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_xp integer;
begin
  if public.nexus_internal_mode() then
    return new;
  end if;

  if old.status_validation = 'APPROVED' and new is distinct from old then
    raise exception 'Approved Mission Results are immutable';
  end if;

  if public.is_admin() then
    if old.status_validation <> 'PENDING'
       or new.status_validation not in ('APPROVED', 'REJECTED') then
      raise exception 'Only a PENDING Mission Result can be reviewed';
    end if;

    if new.squad_id is distinct from old.squad_id
       or new.submitted_by is distinct from old.submitted_by
       or new.submitted_at is distinct from old.submitted_at
       or new.hasil_kompetisi is distinct from old.hasil_kompetisi
       or new.submitted_tier_id is distinct from old.submitted_tier_id
       or new.sertifikat_path is distinct from old.sertifikat_path
       or new.dokumen_pendukung_path is distinct from old.dokumen_pendukung_path
       or new.preview_xp is distinct from old.preview_xp then
      raise exception 'Submitted Mission Result evidence is immutable during review';
    end if;

    if new.status_validation = 'APPROVED' then
      if new.approved_tier_id is null or new.approved_hasil_kompetisi is null then
        raise exception 'Approved tier and result are required';
      end if;

      select xr.verified_xp into v_xp
      from public.xp_rules xr
      where xr.tier_id = new.approved_tier_id
        and xr.hasil_kompetisi = new.approved_hasil_kompetisi;

      if v_xp is null then
        raise exception 'No XP rule exists for the approved tier/result';
      end if;

      new.approved_xp := v_xp;
      new.rejection_reason := null;
    else
      if new.rejection_reason is null
         or length(btrim(new.rejection_reason)) = 0
         or length(new.rejection_reason) > 1000 then
        raise exception 'A rejection reason up to 1000 characters is required';
      end if;
      new.rejection_reason := btrim(new.rejection_reason);
      new.approved_tier_id := null;
      new.approved_hasil_kompetisi := null;
      new.approved_xp := null;
    end if;

    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
    return new;
  end if;

  if auth.uid() is null or old.submitted_by <> auth.uid() then
    raise exception 'Only the submitter or admin may update this result';
  end if;

  if old.status_validation <> 'REJECTED' or new.status_validation <> 'PENDING' then
    raise exception 'A user may only resubmit a rejected Mission Result';
  end if;

  if new.squad_id is distinct from old.squad_id
     or new.submitted_by is distinct from old.submitted_by
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Mission Result ownership and Squad are immutable';
  end if;

  select xr.verified_xp into v_xp
  from public.xp_rules xr
  where xr.tier_id = new.submitted_tier_id
    and xr.hasil_kompetisi = new.hasil_kompetisi;

  if v_xp is null then
    raise exception 'No XP rule exists for the submitted tier/result';
  end if;

  new.preview_xp := v_xp;
  new.approved_tier_id := null;
  new.approved_hasil_kompetisi := null;
  new.approved_xp := null;
  new.rejection_reason := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  return new;
end;
$$;

-- An invoker RPC keeps the decision and its existing XP/status/chat triggers
-- in one transaction. The status predicate serializes competing reviewers.
create function public.review_mission_result(
  p_result_submission_id uuid,
  p_decision public.validation_status_enum,
  p_approved_tier_id bigint default null,
  p_approved_hasil public.hasil_kompetisi_enum default null,
  p_rejection_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_result_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an active admin may review Mission Results';
  end if;

  if p_decision = 'APPROVED' then
    if p_approved_tier_id is null or p_approved_hasil is null
       or p_rejection_reason is not null then
      raise exception 'Approved tier and result are required without a rejection reason';
    end if;

    update public.mission_result_submissions r
    set status_validation = 'APPROVED',
        approved_tier_id = p_approved_tier_id,
        approved_hasil_kompetisi = p_approved_hasil,
        rejection_reason = null
    where r.result_submission_id = p_result_submission_id
      and r.status_validation = 'PENDING'
      and exists (
        select 1 from public.squads s
        where s.squad_id = r.squad_id and s.status_squad = 'FINALIZED'
      )
    returning r.result_submission_id into v_result_id;
  elsif p_decision = 'REJECTED' then
    if p_approved_tier_id is not null or p_approved_hasil is not null
       or p_rejection_reason is null
       or length(btrim(p_rejection_reason)) = 0
       or length(p_rejection_reason) > 1000 then
      raise exception 'A rejection reason up to 1000 characters is required';
    end if;

    update public.mission_result_submissions r
    set status_validation = 'REJECTED',
        rejection_reason = btrim(p_rejection_reason)
    where r.result_submission_id = p_result_submission_id
      and r.status_validation = 'PENDING'
      and exists (
        select 1 from public.squads s
        where s.squad_id = r.squad_id and s.status_squad = 'FINALIZED'
      )
    returning r.result_submission_id into v_result_id;
  else
    raise exception 'Invalid review decision';
  end if;

  if v_result_id is null then
    raise exception 'The Mission Result is no longer pending for a finalized Squad';
  end if;
  return v_result_id;
end;
$$;

revoke all on function public.review_mission_result(
  uuid, public.validation_status_enum, bigint, public.hasil_kompetisi_enum, text
) from public, anon;
grant execute on function public.review_mission_result(
  uuid, public.validation_status_enum, bigint, public.hasil_kompetisi_enum, text
) to authenticated;
