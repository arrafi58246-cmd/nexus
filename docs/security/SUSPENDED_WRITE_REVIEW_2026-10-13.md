# Suspended-account writes — 13 October 2026

## Applied change

`20261013015431_restrict_suspended_notification_and_storage_writes` closes two gaps:

- A suspended owner could mark notifications read/unread through direct database access despite the Server Action's ACTIVE check. Reproduced on the connected database, then fixed in `notifications_update_own`. Active owners and active admins retain their existing permissions.
- Existing Storage owner policies did not require ACTIVE. Three restrictive INSERT/UPDATE/DELETE policies now add this requirement for avatars, mission-documents, achievement-certificates and mission-result-certificates. They AND with existing ownership and referenced-document rules; they do not grant access themselves.

No SELECT policy, bucket publicity/limits, object data, RPC, grant, or other public-table policy changed. Other buckets are unaffected. Catalog comparison found exactly one modified policy and three new restrictive policies. service_role still has its existing RLS bypass. The migration is already applied remotely; pulling requires no manual SQL.

## Evidence

| Check | Result |
| --- | --- |
| Connected database baseline | Suspended notification UPDATE succeeded; other tested public writes denied; rollback |
| Isolated database baseline | Suspended notification UPDATE and Storage INSERT permitted before patch |
| suspended_public_writes_rollback.sql after patch | PASS on connected database |
| storage_suspended_local.sql | PASS in isolated PGlite emulator with copied live policies |
| Existing client_role_access_runtime_rollback.sql | PASS on connected database |
| Live policy catalog comparison | Only intended changes; existing Storage policies unchanged |

Public runtime coverage: active profile edits, Skill insertion, notification updates; suspended profile edit, Skill deletion, Mission update/insert, claim insert, notification update and equip-badge RPC denied; active admin notification management and account reactivation remain functional. The same JWT subject is retained across suspension. Mission/claim INSERT tests require the exact account-status rejection, not an unrelated invalid-file error.

The Mission update fixture is inserted into a public table by the owner with no JWT; no Storage row or file is fabricated in the hosted project. Positive student Mission/claim submissions requiring real uploaded evidence were not run. Claim resubmission, Mission-result submission, endorsement and every other suspended-account write are not all covered by this test. Their existing ACTIVE policies were inspected, not newly certified by runtime tests.

Storage emulator coverage: active owner INSERT in all four buckets; foreign-path INSERT denial; suspended INSERT/UPDATE/DELETE denial; active private-document UPDATE and DELETE after reactivation. The emulator uses synthetic metadata, actual copied policy predicates and account helper functions. It does not test Storage HTTP, bytes/MIME enforcement, signed URLs, S3, Auth login or browser behavior. Supabase documents that [Storage records must be treated as read-only through SQL](https://supabase.com/docs/guides/storage/schema/design); no hosted Storage metadata was written.

All public runtime fixture changes, including the QA student's temporary status/email and profile/Skill changes, rolled back. The local Storage SQL refuses to run without the emulator's explicit `nexus.qa.storage_emulator=1` setting; do not set that marker in a hosted database.

## Remaining work and limits

- The existing avatar policies have no authenticated SELECT policy. Active avatar INSERT passed locally; active avatar UPDATE/DELETE/upsert require a separate ownership/read-contract review and actual Storage API test. This patch does not silently add a new SELECT grant.
- Suspended users may still read data allowed by existing SELECT policies, including their own notifications and historical submissions. This change restricts writes, not all reads. Public avatar URLs remain public.
- No dev server, real login, HTTP upload, concurrent suspension race or frontend E2E was exercised. Keep these as release checks rather than marking the whole security stage complete.
- Advisors remain at two [guarded definer views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), seventeen [authenticated definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and disabled [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

For recovery, use a forward migration retaining ACTIVE, ownership and referenced-document constraints. No data backfill or restoration is necessary.
