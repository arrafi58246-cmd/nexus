# Season automation — 10 October 2026

## Product decision

No grace period. A result approved after its earned-at Season ends or closes receives Career XP only (season_id NULL), never new-Season XP for an old result. CLOSED snapshots stay final. Business dates use Asia/Jakarta. July–June periods are preserved.

## Prepared implementation

Migration 20261010114514_automate_season_rollover_and_weekly_badges.sql introduces owner-only nexus_private workers and preserves guarded public admin RPCs. A shared transaction advisory lock serializes review timestamps, XP assignment, weekly badges and snapshots. Approval stamps clock_timestamp after the lock, so all ACTIVE Squad members use one approval time even across midnight. Existing validation/XP amounts and historical ledger/badges are preserved.

Rollover checks every five minutes, atomically snapshots and closes the expired Season, then activates/creates the current July–June Season. Review also checks rollover, so a delayed cron cannot admit late Seasonal XP. The weekly badge job runs Monday 00:00 WIB. Clients cannot execute private workers. Existing contender percentage and historical additive rewards are preserved.

## Verification

PASS in isolated PGlite with synthetic admin/two-student fixtures and copies of live public constraints, indexes and triggers: cutoff, rollover, real Legacy/Verified review paths, late Career-only credits for both ACTIVE members, weekly idempotence, snapshot preservation and private/admin function permissions. PGlite fixture roles used broad table grants; production RLS was not claimed tested by that isolated run. pg_cron is unavailable locally.

PASS on the connected Supabase database after deployment: supabase/tests/season_automation_runtime_rollback.sql executed with actual schema/RLS and all test changes rolled back. This covers exact WIB cutoff, next-Season activation, repeated run, student authorization denial, real on-time Legacy review and late Legacy/Verified reviews, equal credits, immutable snapshots and historical ledger/badges.

## Deployment status

Applied successfully as remote version 20261010114514; repository filename aligned to that version. Both cron jobs are active. Post-test state: Season 2026/2027 ACTIVE through 30 June 2027; original ledger four rows totaling 1,115 XP and 13 original badges. No test closure or fixtures persisted.

Initial active-database rollback DDL was blocked by automatic review. After the user approved isolated testing then deployment, isolated tests passed and the reviewed migration was applied successfully. Runtime tests then passed on the connected database.

Two-session concurrent approval/closure has NOT been tested. Actual scheduled executions are not yet verified; worker invocation/idempotence was verified by the rollback test. No UI browser changes in this PR.

Idle Squad cleanup is outside this change and still needs G07 decisions.
