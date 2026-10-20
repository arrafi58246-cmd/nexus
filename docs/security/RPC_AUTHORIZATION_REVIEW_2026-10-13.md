# RPC authorization review — 13 October 2026

## Result

Reviewed the 17 public SECURITY DEFINER functions executable by authenticated users. None grants anon EXECUTE; the eight inspected `nexus_private` functions grant neither anon nor authenticated EXECUTE. This is source/catalog review plus the bounded runtime tests below, not certification of all RPC inputs or every Server Action.

Found and reproduced: successful `kick_squad_member` and `finalize_squad` left transaction-local `nexus.internal=1`. Later operations in the same transaction could consequently skip guards that honor this setting. No cross-request exploit was demonstrated; ordinary separate HTTP transactions do not retain a transaction-local setting.

Both functions now save the caller's setting and restore it after success, matching existing create/decide/cancel/leave/transfer behavior. The test also verifies that a subsequent attempt to set MISSION_COMPLETED directly is rejected. No role policy, signature, grant, business authorization or application UI was changed.

## Rollout history

- An initial function-level SET approach was rejected by Supabase with `permission denied to set parameter nexus.internal`; it created no migration entry. No parameter privilege was granted to work around that restriction.
- `20261013013814_scope_squad_rpc_internal_mode` saved the setting in both functions and restored it in finalize. Verification caught the missing kick restoration caused by different source line endings.
- `20261013013907_restore_kick_rpc_internal_mode` completed kick restoration. The first applied migration remains immutable. Both files are required and already applied remotely.

Final SQL files are 132 and 73 lines; the runtime test is 149 lines. Pulling does not require manually rerunning SQL.

## Authorization mapping from inspected source

| Functions | Existing boundary retained |
| --- | --- |
| close_active_season, refresh_leaderboard_badges | is_admin gate before calling private implementations |
| decide_squad_application | Current Squad leader or active admin; account/ownership rechecked after locking |
| cancel_squad_application | Applicant or active admin; PENDING only |
| kick_squad_member, finalize_squad | Current leader or admin; state/member rules; internal setting now restored |
| transfer_squad_leadership | Current active STUDENT leader to active STUDENT member, before finalization |
| leave_squad | Own active membership; leader must transfer first; forbidden after finalization |
| get_leader_pending_squad_applications | Active caller; results restricted to caller's own Squads |
| get_squad_room_members | Active member of non-completed Squad; admin explicitly denied |
| create_squad, submit_squad_application | Active/onboarded account plus Mission/application/membership rules; do not interpret this as a separate explicit STUDENT-only role gate |
| get_mission_squad_leaders | Active caller; sanitized names of leaders for specified Mission |
| get_current_leaderboard | Active STUDENT; scope derived from caller's program/faculty |
| equip_badge | Active caller; badge ownership checked |
| is_admin, is_active_user | Read account role/status from profiles; is_admin also recognizes service-role JWT |

Existing admin intervention permissions are recorded, not newly enabled. Product decisions about removing those existing privileges are outside this patch.

## Executed tests

| Test | Result and limits |
| --- | --- |
| Isolated PGlite baseline/final test | Baseline flag leak reproduced; final matrix PASS; does not reproduce all live RLS |
| Connected database baseline | Both flag leaks reproduced; role denials passed; rollback |
| squad_rpc_authorization_rollback.sql after both migrations | PASS |
| Existing squad_lifecycle_runtime_rollback.sql | PASS after final migration |

Fresh Mission/Squad fixtures test ordinary members and a leader of another Squad against admin-only season operations, finalize, kick, accept, cancel and transfer. Exact error code/message must match. Forged user_metadata ADMIN does not elevate privileges. Outsider/admin room roster access is denied. A suspended actual leader is denied finalize/kick/accept/transfer, with the same JWT subject retained. Authorized kick/accept/finalize work and restore the caller setting. All data changes, including a temporary dedicated QA student's status/email update, roll back.

Not rerun here: successful admin season close/badge award, real Auth/HTTP/browser flows, concurrent suspension races, all equip-badge/leaderboard edge cases, every suspended-account path, and Server Action authorization. No dev server was started. Admin season positive-path evidence remains in earlier season-automation tests; this run tests denial before dispatch.

## Remaining advisor notices

Unchanged: two [guarded definer views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), seventeen [authenticated definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and disabled [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Do not revoke all RPC execution merely to hide notices.

Next: complete suspended-account coverage in remaining write paths and verify Auth/frontend integration. For recovery, use a new forward migration; do not restore the flag leak. PostgreSQL reference: [function configuration scope](https://www.postgresql.org/docs/current/sql-createfunction.html).
