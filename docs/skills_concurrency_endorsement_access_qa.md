# Skills concurrency and Endorsement access QA — 11 October 2026

Scope: CLASS-01/G12 (maximum five Skills) and END-01 (Endorsement access). Code baseline: `2245ac5bde38f45921019e369c7fe65df4a946de`; database definitions and policies were inspected live before testing. No application code, RLS, or schema was changed.

## Results

| Test | Result and evidence |
|---|---|
| Two concurrent Skill inserts with four existing Skills | PASS on the connected Supabase database. A committed the fifth Skill; B waited for A and then received `A user may have at most 5 skills`. B's insert did not persist. |
| Actual overlapping sessions | PASS. A separate observer asserted that A and B had distinct backend PIDs and A appeared in `pg_blocking_pids(B)` while B's wait type was `Lock`. |
| Outsider submits Endorsement while forging a member's sender ID | PASS, denied by the same-completed-Squad guard. The trigger replaced the supplied sender with `auth.uid()`. |
| Member rates an outsider | PASS, denied by the same-completed-Squad guard. |
| Endorsement before Squad completion | PASS, denied with `Endorsements are allowed only after Mission Completed`. |
| Anonymous read and insert | PASS: zero visible Endorsements; insert denied. |
| Outsider updates or deletes another user's rating | PASS: zero affected rows under `authenticated`. |
| Suspended member inserts a rating | PASS: RLS denied INSERT with insufficient privilege. |

These are direct database tests with transaction-local JWT claims and `SET LOCAL ROLE authenticated`/`anon`. They do not authenticate through Supabase Auth, call Next.js Server Actions, or exercise browser UI.

## Concurrency evidence

The initial attempt to issue parallel connector calls completed without observed overlap, so it was **not** counted as a concurrency pass. The successful run used three temporary, narrowly scoped pg_cron jobs launching separate PostgreSQL connections at the same scheduled minute. All jobs were removed after the test; existing product jobs were not modified.

| Worker | Backend PID | Start UTC | End UTC | Result |
|---|---|---|---|---|
| A | 1384578 | 11:36:00.032636 | 11:36:20.067183 | Fifth Skill committed |
| B | 1384579 | 11:36:00.031370 | 11:36:20.079742 | Expected sixth-Skill rejection, rolled back |
| Observer | 1384577 | 11:36:00.027852 | 11:36:08.041128 | Confirmed B blocked by A |

The dedicated QA student originally had zero Skills. Setup committed exactly four tagged fixture rows. A inserted Skill five and held the transaction for 20 seconds. B delayed three seconds before inserting Skill six; the observer checked the blocker relationship after eight seconds. Final total was exactly five. Cleanup deleted only the fixture UUIDs for that QA account and restored the original zero Skills.

The normal deployed trigger locks the owning profile row before counting Skills. The tested isolation is the database's default transaction isolation; this result does not prove every isolation level or administrative write path. The trigger runs on INSERT; no authenticated UPDATE policy exists for `user_skills` in the inspected schema.

## Endorsement fixtures and cleanup

The tests used dedicated existing QA accounts and an existing completed QA Squad. Every Endorsement test was enclosed in one transaction ending in ROLLBACK. No rating was left behind and no successful UPDATE/DELETE of another user's rating occurred.

An initial suspension setup failed because a legacy STUDENT QA profile still used an `@unesa.ac.id` address, violating `profiles_email_role_check` on UPDATE. That attempt rolled back. The successful test temporarily used a synthetic `@mhs.unesa.ac.id` profile address in the same rollback-only transaction; the original email and ACTIVE status were restored. No Auth password/email or actual login identity was changed.

Post-test verification:

- QA student's Skills: 0 (original state).
- Tagged fixture Skill rows: 0.
- Temporary QA cron jobs: 0; run history retained as evidence.
- Temporarily suspended QA profile restored: true.
- Total Skills: 8; total Endorsements: 1; total XP: 1,115.

## Remaining findings and limits

- The inspected ACL grants `TRUNCATE`, `REFERENCES`, and `TRIGGER` on `user_skills` and `endorsements` to both `anon` and `authenticated`, alongside CRUD privileges. This is broader than these frontend flows need. RLS is enabled but does not protect TRUNCATE. No destructive test was run, and direct SQL grants are not proof of a callable REST truncate endpoint. A separate, narrowly reviewed privilege migration is needed; do not revoke privileges across the whole database without mapping dependencies.
- Legacy QA profile email data should be reconciled before using those accounts for frontend testing. This task did not permanently repair accounts or reset passwords.
- Browser/Server Action Endorsement QA remains pending, including Auth sessions and UI errors.
- Full review of ADMIN/incomplete-onboarding Endorsement access, grant inheritance, and all privileged write paths remains pending. The tested negative cases are enumerated above; do not label this a complete security audit.
- Season approval/rollover concurrency and cleanup/new-activity concurrency are separate tests and remain pending.

## Repeating the Skills test

Use a dedicated QA student whose Skill state has been recorded, in a coordinated test window. Prefer two persistent SQL connections. Setup four known Skills and record exact fixture UUIDs. Run A first, wait until its INSERT is holding the transaction, then start B. As an observer, confirm the actual blocker relationship before allowing A to commit. Connection helpers that serialize calls cannot establish this test.

In each worker, use the QA user's transaction-local Auth claims and switch to `authenticated`; do not test INSERT solely as the database owner. A inserts the fifth Skill, keeps the transaction open, then COMMITs. B inserts a distinct sixth Skill; require the exact limit rejection. Assert final count five and absence of B's row. Cleanup must delete only recorded fixture IDs, restoring the original state. Never leave recurring test jobs active or use a personal account.

The companion [rollback SQL](../supabase/tests/endorsement_access_runtime_rollback.sql) covers the access cases. Its UUID placeholders must be replaced with approved dedicated QA accounts and a completed Squad containing both member accounts. It refuses to run with placeholders or an invalid fixture.
