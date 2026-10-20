# Idle Squad chat cleanup — 10 October 2026

## Authorized decision

The user approved chat-only cleanup after more than 30 days with no activity, once daily, excluding Squads with PENDING Mission Results. Squad, membership, result/evidence, XP, badges, Endorsements and histories are preserved. The Room remains usable. This explicitly narrows the Handbook wording of deleting the Room.

## Implementation

Applied migration 20261010122145_cleanup_idle_squad_chat.sql. Database triggers record chat inserts, changed Squad fields (including finalize), membership, application/recruitment, requirements, and result submission/resubmission/review events. Timestamp-only direct writes and no-op child updates do not fabricate activity. Deleting chat does not reset activity. Existing activity timestamps are conservatively backfilled from source timestamps without reading message content.

Owner-only nexus_private.cleanup_idle_squad_chat uses strict last_activity_at < run_at - 720 hours. Each candidate is row-locked with FOR NO KEY UPDATE SKIP LOCKED and rechecked for idle/PENDING before deleting only squad_messages. BEFORE child activity triggers acquire that same parent lock, then touch its timestamp. Existing RLS and RPC guards are retained; functions have no public/anon/authenticated/service_role EXECUTE grant. No UI, notification H-3 or Room-closed status is introduced.

Cron job nexus-idle-squad-chat-cleanup is active at 19:00 UTC (02:00 WIB) daily. The migration itself deletes no messages. At deployment zero Squads were eligible after backfill.

## Verification

PASS isolated PGlite synthetic fixtures with copies of live public constraints/indexes/triggers: strict boundary, idle deletion, recent/activity/pending preservation, repeat idempotence, private function authorization, membership activity/no-op behavior and ledger/badge/history preservation. Isolated broad fixture table grants do not prove production RLS.

PASS actual connected Supabase runtime rollback: supabase/tests/idle_chat_cleanup_runtime_rollback.sql. All five fixture Squads and their messages/results rolled back. Original ledger four rows / 1,115 XP and 13 badges remain; zero QA cleanup Squads persist. Job active and remote migration version confirmed.

Not verified: simultaneous cleanup/chat or cleanup/submission in two sessions; actual daily scheduled execution; browser Realtime behavior for mass deletion; every recruitment/finalize/resubmit UI path. Shared locking was inspected, not claimed concurrency-tested. Admin cannot read chat through a newly exposed cleanup API because none was added.

## Operations

Cleanup is irreversible for eligible old messages once the scheduled worker executes. The approved retention policy preserves all other records. To stop future cleanup, the database owner can unschedule nexus-idle-squad-chat-cleanup; do not remove ledger/history or edit applied migration. Future migrations should implement any policy changes.
