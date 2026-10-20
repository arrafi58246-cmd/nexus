# Client access review — 12 October 2026

## Outcome and scope

Applied migration `20261012123802_harden_client_maintenance_and_internal_functions` to the connected NEXUS database on PostgreSQL 17.6. This is a bounded privilege review, not a complete security certification. No development server was started.

Ordinary application roles had unnecessary maintenance privileges. RLS does not govern table-wide TRUNCATE/REFERENCES operations ([PostgreSQL documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)). The migration removes TRUNCATE, REFERENCES, TRIGGER and MAINTAIN from PUBLIC, anon and authenticated on an explicit list of 34 inspected relations. Application ADMIN still uses authenticated and does not need database maintenance permissions.

The migration snapshots and asserts preservation of all existing client CRUD grants, service_role table permissions, RLS flags and policy definitions. All 28 public tables already had RLS enabled. No rows, policies, function bodies, foreign keys or application code were changed.

## Object mapping

| Group | Audited relations | Preserved access boundary |
| --- | --- | --- |
| Profile and rewards | profiles, user_skills, endorsements, user_badges, xp_transactions | Existing CRUD grants plus RLS/guards; user_skills and endorsements had already lost maintenance grants in an earlier migration |
| Master data | fakultas, program_studi, primary_classes, skills, badge_definitions, rank_milestones, rank_rules, xp_rules, mission_tiers | Existing reads/admin writes and policies |
| Missions and review | missions, mission_submissions, mission_result_submissions, achievement_claims, admin_reports | Existing ownership/admin policies and guards |
| Squad | squads, squad_requirements, squad_applications, squad_members, squad_messages | RPC-only INSERT on squads/requirements/applications and UPDATE on applications remain denied directly; chat membership rules unchanged |
| Notification and seasons | notifications, seasons, season_leaderboard_history, season_user_history | Existing policies unchanged |
| Public display views | public_profiles, career_xp_totals, current_seasonal_xp_totals | Existing authenticated grants retained; anonymous grants remain absent |
| Internal leaderboard views | leaderboard_fakultas, leaderboard_program_studi, leaderboard_universitas | No client grants added |

Eleven existing function bodies were inspected and their search_path pinned to an empty string. Application objects were already schema-qualified. See the migration for the complete function list.

Direct client EXECUTE was removed from six trigger/event-trigger entry points: after_mission_submission_review, after_squad_insert_add_leader, after_xp_transaction_award_badges, guard_profile_insert, handle_new_nexus_user and rls_auto_enable. Service access remains. These are not ordinary callable RPCs; unnecessary EXECUTE grants alone do not demonstrate an exploitable HTTP endpoint.

## Executed verification

| Check | Environment | Result |
| --- | --- | --- |
| Migration preservation assertions | Connected database during apply | PASS |
| client_privilege_hardening_checks.sql | Connected database after apply | PASS: maintenance denied, RLS enabled, search paths pinned, internal EXECUTE restricted, RPC write boundaries retained |
| client_role_access_runtime_rollback.sql | Connected database before and after apply | PASS |
| squad_lifecycle_runtime_rollback.sql | Connected database after apply | PASS |
| Migration plus Squad regression | Isolated PGlite harness | PASS; harness does not reproduce live RLS |

The role test switches SQL role and JWT claims using dedicated QA students and an active admin. It verifies own versus foreign private profiles, sanitized peer profiles, own XP reads, own versus foreign notifications, blocked self-promotion, student versus admin Mission updates, member versus outsider chat, admin chat denial, and anonymous private-data denial. Chat uses an actual inserted fixture message so denial assertions are not based on an empty table. Every runtime fixture is rolled back. The Squad regression exercises create, leadership transfer, membership and finalize behavior.

These are database-level tests, not real Auth login, HTTP/PostgREST, browser or concurrent-session tests. Auth signup and every review/reward trigger were not individually exercised. Suspended-account behavior across every feature remains outside this matrix. No claim is made that all application flows are verified.

## Advisor comparison and remaining work

| Advisor | Before | After |
| --- | ---: | ---: |
| Mutable function search_path | 11 | 0 |
| Anonymous SECURITY DEFINER function EXECUTE | 6 | 0 |
| Authenticated SECURITY DEFINER function EXECUTE | 23 | 17 |
| SECURITY DEFINER views | 2 | 2 |
| Leaked password protection disabled | 1 | 1 |

Post-apply advisor observation: 2026-10-12 12:41 UTC. Remaining findings are not a clean security bill:

- [Definer views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view): public_profiles intentionally exposes sanitized ACTIVE peer profiles, excluding email/NIM; changing to invoker would restrict it to the caller's private profile policy. career_xp_totals exposes user IDs and aggregate career XP to authenticated callers. Review intended cross-user/suspended-user scope separately before changing either view. current_seasonal_xp_totals is already invoker.
- [Authenticated definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): 17 application RPCs/policy helpers retain execution. The advisor is a review prompt, not proof of a vulnerability. This change does not certify every RPC's internal authorization.
- [Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection): remains disabled; no Auth settings were changed.

Next release work: review those view/RPC authorization boundaries, cover suspended-account paths and Auth signup, then verify frontend integration and deployment. The existing development-only dependency advisories are tracked separately in DEPENDENCY_REVIEW_2026-10-12.md.

The migration is already applied remotely; pulling this commit does not require manually rerunning SQL. Future tables/functions still require explicit grant review; this migration intentionally does not change schema-wide default privileges.
