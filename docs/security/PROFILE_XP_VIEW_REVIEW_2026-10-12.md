# Profile and XP view access — 12 October 2026

## Finding and fix

Before this change, an authenticated caller with no ACTIVE NEXUS profile could read both `public_profiles` and `career_xp_totals`. Reproduced in the connected database using a nonexistent subject and an authenticated SQL role. The frontend's ACTIVE check did not protect direct database/API reads.

Applied `20261012130014_guard_profile_xp_view_access` (23 lines):

- Both views require `is_active_user()` for application callers. Suspension is checked against the current profile, not a cached account-status JWT claim.
- Trusted PostgreSQL `postgres` and `service_role` retain access. The bypass checks the database role, not user-editable metadata.
- `security_barrier` protects view filtering; the caller-only predicate uses a scalar subquery so it can be evaluated once per statement.
- Views expose SELECT only to authenticated clients. PUBLIC/anon have no grants. Profile edits continue through `profiles` RLS/guards.

Column names/types and visible rows for ACTIVE Student/Admin remain unchanged. Public profiles still exclude email/NIM and SUSPENDED targets. Career XP remains the existing cross-user aggregate contract, including all target profiles; this change does not redefine XP visibility or expose individual ledger rows. Onboarding requirements and existing ACTIVE admin visibility were not changed.

## Verification actually executed

| Check | Result |
| --- | --- |
| Isolated migration and view role matrix | PASS |
| Live `profile_xp_views_runtime_rollback.sql` | PASS |
| Existing live `client_role_access_runtime_rollback.sql` | PASS |
| Full view-output and public-policy fingerprints before/after | Identical |

The 108-line test checks ACTIVE Student/Admin output against owner output, missing-profile denial, suspension with unchanged JWT, reactivation, service reads, anonymous SELECT grants, authenticated write grants and view barriers. Existing role regression also checks private-profile isolation and member/outsider/admin chat boundaries.

The suspension test temporarily changes one dedicated QA student's status and legacy email inside a rollback transaction. Nothing is committed. These tests simulate SQL roles/JWT context; real Auth login, HTTP/PostgREST, browser, concurrency and production-scale performance were not tested. No `npm run dev` was used.

## Remaining advisor notices

- Two [definer-view findings](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view) remain. Definer execution supports sanitized cross-user output without opening private profile/ledger RLS. Both now have explicit caller guards. Switching blindly to invoker would change their data contract.
- Seventeen [authenticated definer-function notices](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) remain for the separate RPC authorization review.
- [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled; Auth settings were not changed.

This closes the missing ACTIVE-caller check on these two views, not all suspended-account paths. Future public Career XP display changes should define target visibility explicitly; do not silently narrow the contract to self-only. References: PRD sections 2.1/5 and [Supabase RLS/view guidance](https://supabase.com/docs/guides/database/postgres/row-level-security#views).

## Rollout and recovery

Migration already applied remotely; no manual SQL rerun after pulling. No data backfill, deletion, new table or new RPC. No base-table policy changed. For a regression, prefer a new forward migration; do not restore anonymous access or drop caller checks. Prior view definitions remain in migration history, but restoring them would restore the reported exposure.
