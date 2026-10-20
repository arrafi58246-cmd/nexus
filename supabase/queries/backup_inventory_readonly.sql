-- Operator-only aggregate inventory. Does not export database records or file bytes.
-- Run on source and isolated restored database with equivalent operator access.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH table_counts AS (
  SELECT c.relname AS table_name,
    ((xpath('/row/total/text()', query_to_xml(
      format('SELECT count(*) AS total FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text)::bigint AS row_count
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
), bucket_counts AS (
  SELECT b.id, b.public, count(o.id) AS object_count,
    coalesce(sum(CASE WHEN o.metadata->>'size' ~ '^[0-9]+$' THEN (o.metadata->>'size')::bigint ELSE 0 END), 0) AS recorded_bytes
  FROM storage.buckets b LEFT JOIN storage.objects o ON o.bucket_id = b.id
  GROUP BY b.id, b.public
), file_references AS (
  SELECT 'avatars' AS bucket_id, foto_profil_path AS object_name FROM public.profiles
  UNION ALL SELECT 'mission-documents', dokumen_path FROM public.mission_submissions
  UNION ALL SELECT 'mission-documents', dokumen_path FROM public.missions
  UNION ALL SELECT 'mission-result-certificates', sertifikat_path FROM public.mission_result_submissions
  UNION ALL SELECT 'mission-result-certificates', dokumen_pendukung_path FROM public.mission_result_submissions
  UNION ALL SELECT 'achievement-certificates', sertifikat_path FROM public.achievement_claims
), expected_files AS (
  SELECT DISTINCT bucket_id, object_name FROM file_references WHERE nullif(btrim(object_name), '') IS NOT NULL
)
SELECT jsonb_build_object(
  'captured_at', transaction_timestamp(),
  'postgres_major', current_setting('server_version_num')::int / 10000,
  'database_bytes', pg_database_size(current_database()),
  'auth_user_count', (SELECT count(*) FROM auth.users),
  'public_table_counts', (SELECT jsonb_object_agg(table_name, row_count ORDER BY table_name) FROM table_counts),
  'storage_buckets', (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM bucket_counts b),
  'referenced_file_count', (SELECT count(*) FROM expected_files),
  'missing_storage_metadata_count', (SELECT count(*) FROM expected_files f WHERE NOT EXISTS
    (SELECT 1 FROM storage.objects o WHERE o.bucket_id = f.bucket_id AND o.name = f.object_name)),
  'public_rls_enabled_table_count', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity),
  'public_policy_count', (SELECT count(*) FROM pg_policies WHERE schemaname='public')
) AS inventory;
ROLLBACK;
