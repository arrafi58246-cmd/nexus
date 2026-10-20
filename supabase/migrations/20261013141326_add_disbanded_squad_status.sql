-- Commit the enum extension before migrations use the new value.
alter type public.squad_status_enum add value if not exists 'DISBANDED';
