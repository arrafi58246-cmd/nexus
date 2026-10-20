# Squad lifecycle — 12 October 2026

## Approved behavior

- Successful Create Squad cancels **only the creator's PENDING applications on the same Mission**. Other Missions/users and historical outcomes remain unchanged. Squad, initial leader membership, requirements and cancellation form one transaction: any failure rolls everything back.
- On OPEN_RECRUITMENT/FULL Squads, the current active STUDENT leader may transfer leadership to another ACTIVE member whose account is an ACTIVE STUDENT. The old leader becomes ANGGOTA and remains in the Squad until they separately choose Leave.
- Transfer updates both membership roles and `squads.ketua_id` atomically, preserves membership IDs/history, count and Squad status, and always leaves one active leader.
- FINALIZED/MISSION_COMPLETED Squads cannot transfer or self-leave. No new admin override, role, status or auto-disband was added. A sole leader must wait for another eligible member; sole-leader cancellation/disband remains a product decision.

## Frontend contract

| Operation | Callable contract | Success | Access and refresh |
|---|---|---|---|
| Create | Existing `createSquad` action / `create_squad` RPC and its existing parameters | Existing response/UUID, now with same-Mission auto-cancel | Existing access checks; action refreshes Mission, My Squad and dashboard |
| Transfer | `transferSquadLeadership(squadId: string, newLeaderId: string)` in `src/app/squads/[squadId]/actions.ts` | `{ success: true }` | Active STUDENT current leader; affected room, My Squad, Mission and dashboard revalidated |
| Transfer failure | Same action | `{ success: false, message: string }` | Display safe message; do not show success or update roles optimistically |
| Leave | Existing `leaveSquad(squadId)` after successful transfer | Existing response | Former leader now follows ordinary ANGGOTA leave behavior |

Next.js invokes the Server Action through POST; it is not a new `/api` route. For a separate Supabase frontend, call the authenticated RPC:

```ts
const { error } = await supabase.rpc('transfer_squad_leadership', {
  p_squad_id: squadId,
  p_new_leader_id: newLeaderId,
});
if (error) {
  // Show a safe message and reload current Squad state.
} else {
  // Reload Squad ownership and members; SQL return type is void.
}
```

RPC SQLSTATE `42501`: missing authentication, nonleader or inactive/nonstudent actor. `22023`: missing/self target, ineligible successor or finalized Squad. Database state remains authoritative if the roster changes between UI preflight and RPC. Realtime is not required: refresh after success; other open clients see the new state on refresh. The new RPC's HTTP response was not separately exercised in this session.

## Implementation and deployment

Migration `20261012073134_atomic_squad_creation_and_leadership_transfer.sql` was applied to the connected Supabase project on 12 October 2026. It preserves existing RPC signatures and RLS, adds an authenticated-only transfer RPC with an empty search path, joins Create/submit to decide/cancel's existing per-applicant advisory lock, and changes Leave to lock Squad before membership. Existing frontends remain compatible.

Repository changes: Create form notice, related-page revalidation, transfer Server Action/button in Squad Room, the new migration, PRD decisions G05/G06, and regression tests. Transfer uses existing member data; it adds no polling or per-member database reads on page load.

## Verified results

| Check | Result | Scope |
|---|---|---|
| Isolated PostgreSQL engine runtime | PASS | Actual functions, constraints and triggers; injected failure during cancellation and after role changes fully rolled back; suspended successor rejected. Local fixture did not reproduce production RLS |
| Connected Supabase RPC regression | PASS | Four dedicated QA students, fresh Mission fixtures, authenticated SQL role/JWT simulation with actual RLS and triggers; all fixtures rolled back |
| Create scope/rollback | PASS | Two same-Mission applications cancelled; other-Mission and other-user applications retained; failed Create leaves no Squad or cancellation |
| Transfer/Leave | PASS | Nonleader, self, nonmember, former member, unauthenticated and finalized guards; exactly one leader, preserved member IDs, former leader can leave, FULL reopens |
| Function permissions/internal flag | PASS | Anonymous transfer denied; empty search path; internal mode restored after Create, transfer and Leave |
| Server Action regression | PASS — 5 tests | Invalid IDs, authentication/roles, ownership/state, RPC parameters/revalidation, safe failure after database rejection |
| ESLint / production build | PASS | Local Next.js 16.3.4 / TypeScript build |
| Cleanup verification | PASS | Zero `QA SQUAD LIFECYCLE%` Missions remain |

Re-run (owner SQL runner for the second file):

```sh
node --test tests/squad-leadership-action.test.mjs
```

`supabase/tests/squad_lifecycle_runtime_rollback.sql` requires four dedicated active/onboarded profiles named `Mahasiswa Test NEXUS%` and a Mission template. It does not create accounts or persist test data.

**Not yet verified:** real Auth login and button interactions in a browser, independent concurrent database sessions for these new paths, or integration with the collaborator's unmerged UI branch. Sequential database and local failure-injection tests are not claims of those results.

## Next release work

Follow the existing release plan: resolve the recorded dependency security findings, finish targeted privilege review, integrate the collaborator UI when ready, then run STUDENT/ADMIN browser journeys and deployment smoke checks. Release readiness remains conditional on those gates, rather than a percentage inferred from this feature alone.
