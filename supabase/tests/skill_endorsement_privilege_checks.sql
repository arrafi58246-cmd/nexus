-- Read-only ACL/RLS assertions. Does NOT attempt destructive TRUNCATE.
do $test$
declare
  v_role text;
  v_table text;
  v_privilege text;
begin
  foreach v_table in array array['public.user_skills','public.endorsements'] loop
    if not (select relrowsecurity from pg_class where oid=v_table::regclass) then
      raise exception 'RLS disabled on %',v_table;
    end if;
    foreach v_role in array array['anon','authenticated'] loop
      foreach v_privilege in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(v_role,v_table,v_privilege) then
          raise exception 'Client % still has % on %',v_role,v_privilege,v_table;
        end if;
      end loop;
      if current_setting('server_version_num')::integer>=170000
        and has_table_privilege(v_role,v_table,'MAINTAIN') then
        raise exception 'Client % still has MAINTAIN on %',v_role,v_table;
      end if;
    end loop;
    -- Preserve the previous CRUD grants, individually checked. RLS still decides rows.
    foreach v_role in array array['anon','authenticated','service_role'] loop
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
        if not has_table_privilege(v_role,v_table,v_privilege) then
          raise exception 'Unexpected CRUD regression: % % %',v_role,v_privilege,v_table;
        end if;
      end loop;
    end loop;
    foreach v_privilege in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
      if not has_table_privilege('service_role',v_table,v_privilege) then
        raise exception 'Unexpected service_role maintenance regression on %',v_table;
      end if;
    end loop;
  end loop;
end;
$test$;
select 'PASS: client maintenance privileges denied; CRUD/service access and RLS preserved' as result;
