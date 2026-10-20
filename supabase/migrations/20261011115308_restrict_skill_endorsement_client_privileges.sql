-- Only remove non-CRUD table powers from client roles.
-- Application reads/writes remain subject to the existing RLS policies.
-- Existing triggers and foreign keys do not need client TRIGGER/REFERENCES grants.
revoke truncate, references, trigger
  on table public.user_skills, public.endorsements
  from public, anon, authenticated;

-- MAINTAIN was added in PostgreSQL 17; tolerate older local development servers.
do $migration$
declare
  v_role text;
  v_table text;
  v_privilege text;
begin
  if current_setting('server_version_num')::integer >= 170000 then
    execute 'revoke maintain on table public.user_skills, public.endorsements from public, anon, authenticated';
  end if;
  foreach v_role in array array['anon','authenticated'] loop
    foreach v_table in array array['public.user_skills','public.endorsements'] loop
      foreach v_privilege in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(v_role,v_table,v_privilege) then
          raise exception 'Unexpected inherited % on % for %',v_privilege,v_table,v_role;
        end if;
      end loop;
      if current_setting('server_version_num')::integer >= 170000
        and has_table_privilege(v_role,v_table,'MAINTAIN') then
        raise exception 'Unexpected inherited MAINTAIN on % for %',v_table,v_role;
      end if;
    end loop;
  end loop;
end;
$migration$;

