# Season and badge population alignment — 10 October 2026

Scope: LB-01 and the resolved population part of G09.

## Verified difference and change

The live RPC ranks only STUDENT ACTIVE profiles, including zero XP. The previous three internal leaderboard views and close_active_season included ADMIN/SUSPENDED profiles.

Migration `20261010031408_align_season_leaderboard_population.sql` replaces the three internal view definitions and existing close function in place. Filtering happens before rank/population calculation, and NULL ordering matches the live RPC. Existing grants, admin guards, ledger assignment and historical badge behavior are preserved. The refresh function consumes these views unchanged, including the existing >3% and <=10% contender rule.

Remote migration: applied successfully. Live university population changed from seven profiles (including one admin) to six eligible students and zero admins.

## Runtime validation

`supabase/tests/season_population_runtime_rollback.sql`: PASS on the connected database.

- authenticated students cannot refresh badges or close a Season;
- internal views remain inaccessible to anon/authenticated direct reads;
- a temporarily suspended eligible fixture is excluded before ranking;
- all three scope rankings match the live RPC, including zero XP and deterministic ties;
- repeated badge refresh adds no duplicate awards and preserves historical/equipped badges;
- a temporary close saves the same pre-close rank, population and XP in history, excludes admin/suspended profiles, and marks the Season CLOSED atomically;
- XP ledger contents and profile business fields remain unchanged;
- all temporary mutations, including closure/awards/suspension, are rolled back.

After rollback: ACTIVE Season remains 2026/2027, four ledger rows totaling 1,115 XP, 13 badges, zero persisted user/leaderboard history. Security advisor finding identities are unchanged before/after the migration.

The regression does not test simultaneous close/approval or the real browser history for a persisted closed Season.

## Data impact and recovery

No Season is closed by the migration; no XP, history or badge rows are rewritten or removed. Existing historical badges are not revoked. Definitions are replaced without DROP/recreate, preserving access grants. If definition rollback is required, restore the prior definitions in a new migration; do not edit the applied migration or delete history/ledger.

## Unresolved work

The active Season ends on 30 June 2027. pg_cron/pg_net are not installed, and no scheduling is introduced here. Season cutoff timezone, approval arriving after closure, concurrent approval/close and next-Season activation still need G10 decisions/tests. Exact 3% and current-vs-historical badge presentation remain G09 decisions. Idle cleanup still needs G07 activity/deletion rules.

The migration file was generated with Supabase CLI and its version label synchronized to the actual remote applied version `20261010031408`; SQL contents are unchanged. The existing expired-Mission migration was also renamed from `20261010010000` to its applied remote version `20261010014205`. The fetched remote statement and repository SQL were identical; SQL is unchanged. Both filenames now match remote migration history, preventing duplicate pending migrations on future CLI pushes.
