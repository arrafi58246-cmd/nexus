# Client privilege hardening and operations concurrency — 11 October 2026

## Deployed change

Migration `20261011115308_restrict_skill_endorsement_client_privileges.sql` was applied to the connected NEXUS database. It removes TRUNCATE, REFERENCES, TRIGGER and (PostgreSQL 17+) MAINTAIN on **only** `public.user_skills` and `public.endorsements` from PUBLIC, anon and authenticated. It does not change table data, RLS, CRUD grants, service_role access, existing triggers, or foreign keys. Existing client triggers/FKs do not need client privileges to create new triggers/FKs.

Checks inspect effective privileges, including inheritance, and fail the migration if a client still has the removed permissions. All four CRUD privileges were checked individually after deployment. Both tables still have RLS enabled. SQL NULL/row access restrictions remain the responsibility of existing policies; this is not a complete RLS audit.

The CLI was unavailable (`npx --offline supabase --help` returned ENOTCACHED). A temporary SQL draft was tested and applied via Supabase MCP; the repository filename uses the actual remote migration version, not a fabricated timestamp.

## Validation

- Isolated PGlite: migration and repeat application passed. Separate live checks verified every preserved/removed table privilege.
- Connected database under authenticated: Skill INSERT, SELECT, DELETE and eligible Endorsement INSERT/SELECT passed; all test data rolled back.
- [Read-only privilege assertions](../supabase/tests/skill_endorsement_privilege_checks.sql) passed on the connected database. No destructive TRUNCATE test was run.
- Local `npm run lint` and `npm run build`: PASS. No application UI changed.

## Real concurrent database sessions

Seven temporary pg_cron jobs started at 11:59 UTC (18:59 WIB), each in a separate PostgreSQL connection. The test used dedicated QA accounts. Job SQL had statement/lock timeouts. All seven workers succeeded and all temporary jobs were unscheduled afterward. Run history was retained.

### Cleanup versus chat: both orders committed

Two disposable QA Missions/Squads were seeded with one synthetic old message each and last activity older than 720 hours.

1. **Chat wins first:** authenticated worker inserted a new message and held its transaction open for 16 seconds. The cleanup worker verified that this worker was sleeping in the open transaction, called the real private cleanup function, and confirmed the locked Squad's old message remained. Final state: old and new messages both present, fresh activity timestamp.
2. **Cleanup wins first:** the real cleanup worker deleted the second Squad's old message, held the row lock, then committed. A new authenticated chat INSERT waited until cleanup committed, then succeeded. A separate observer asserted the sender PID was blocked by the cleanup PID. Final state: exactly the new message remained, fresh activity timestamp.

The cleanup transaction recorded all message IDs outside its deletion target and asserted none disappeared before committing. It required exactly one deleted message. This prevented a successful test from silently deleting unrelated eligible chat. No unrelated message content was retrieved.

| Worker | PID | Start UTC | End UTC |
|---|---|---|---|
| Chat first | 1386204 | 11:59:00.109653 | 11:59:16.143060 |
| Cleanup first | 1386198 | 11:59:00.107062 | 11:59:17.150340 |
| Chat after cleanup | 1386202 | 11:59:00.109025 | 11:59:17.157314 |
| Cleanup lock observer | 1386203 | 11:59:00.101794 | 11:59:06.124174 |

### Season closure versus approval: rollback-only contention

- A called the real admin `public.close_active_season` for the current Season, held the transaction for 16 seconds, then **rolled back**.
- B created a synthetic claim and certificate metadata entirely inside its own transaction, switched to the authenticated admin role, and attempted real approval. It waited on A's advisory lock.
- An independent observer asserted A and B had distinct PIDs, B waited on an advisory lock, and A was the blocker.
- After A rolled back, B continued against the original ACTIVE Season. It asserted `reviewed_at` was stamped after the wait, and the expected Legacy XP was assigned to that still-active Season. B then **rolled back**, including its claim, metadata and XP.

| Worker | PID | Start UTC | End UTC |
|---|---|---|---|
| Season closure | 1386199 | 11:59:00.096289 | 11:59:16.186061 |
| Claim approval | 1386200 | 11:59:00.108408 | 11:59:16.203526 |
| Season lock observer | 1386201 | 11:59:00.104022 | 11:59:06.118692 |

**Limit:** this proves real closure/review serialization and post-lock review timing. It does not simulate a committed rollover at July midnight while a real approval commits. Committed on-time/late behavior and rollover boundary logic were exercised sequentially in the earlier rollback tests; do not combine those two evidence types into a claim of full committed rollover concurrency. The reverse review-first order and Verified-result concurrency remain separate follow-ups.

## Cleanup and final state

The first cleanup attempt tried to remove Missions before Squads and was blocked by the RESTRICT foreign key; its transaction rolled back. The corrected cleanup deleted only the tagged QA Squads first, then the tagged Missions. Shared source Storage objects were not deleted.

Verified after cleanup:

- QA Missions, Squads, messages, claims, matching notifications, temporary jobs: **all zero**.
- Original active Season: `b2c84427-2b0e-45c5-8a27-b6e41ebd4407`.
- XP total: **1,115**; badge count: **13**, unchanged from before testing.

## Security advisor and remaining scope

Security advisor counts were unchanged before/after this scoped change. Existing findings remain:

| Finding | Count | Reference |
|---|---|---|
| Security-definer views | 2 | [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view) |
| Mutable function search_path | 11 | [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) |
| Anon-executable security-definer functions | 6 | [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) |
| Authenticated-executable security-definer functions | 22 | [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |
| Leaked-password protection disabled | 1 | [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |

These findings are not all automatically vulnerabilities; review each function/view and its intended access before changing it. This PR does not grant a clean security bill to the entire database.

Browser sessions, UI refresh after cleanup, simultaneous result submission versus cleanup, and the next real weekly badge execution remain outside these tests. No frontend collaborator branch was modified.

Recovery: if an unexpected application dependency on a revoked privilege is found, investigate and grant only that exact privilege to its required server role in a new migration. Do not re-grant all client privileges by default.

