# Release access review — 15 October 2026

Scope: close the remaining public view/RPC permission review using the current
database and earlier [RPC](RPC_AUTHORIZATION_REVIEW_2026-10-13.md) and
[view](PROFILE_XP_VIEW_REVIEW_2026-10-12.md) findings. This is a bounded review,
not certification of every endpoint, race, Storage operation or Auth setting.

## Finding and applied change

current_seasonal_xp_totals still granted authenticated INSERT/UPDATE/DELETE.
Its GROUP BY aggregate is not automatically updatable, so this was unnecessary
permission, not a demonstrated working write bypass. The new catalog assertion
failed on this exact grant before the change and passed after the prospective
rollback and permanent migration.

Applied `20261015041025_restrict_seasonal_xp_view_writes.sql` (4 lines): revoke
these three privileges from PUBLIC/anon/authenticated. Authenticated SELECT,
service grants, view definition and underlying RLS/policies remain unchanged.
No data backfill/deletion, RPC/signature change, new table or dependency.
The CLI-created filename was aligned to the actual MCP migration version.

## Reviewed access retained

| Surface | Boundary and rationale |
|---|---|
| public_profiles | ACTIVE caller guard + security_barrier; sanitized peer data excludes email/NIM. Definer supports the existing cross-user projection without exposing private profile RLS. |
| career_xp_totals | Same ACTIVE guard/barrier; existing cross-user aggregate contract, not access to raw ledger. Target visibility was not redefined. |
| Seasonal XP / final roster views | security_invoker; authenticated SELECT only; underlying RLS applies. |
| All 18 authenticated public definers | Explicit reviewed signature list, pinned search_path; no anon EXECUTE. This includes solo disband added after the 17-function review. |
| Create / submit / recruitment | Existing ACTIVE/onboarding, applicant/leader/admin and state/ownership guards. Create/submit are not newly redefined as STUDENT-only RPCs. |
| Transfer / solo disband | Active STUDENT leader, own Squad, required membership and pre-finalized states; source retains locking/rechecks. |
| Finalize / kick / leave | Leader/admin or own-member boundary, state guards, restored transaction-local internal mode. |
| Room / pending list / Mission leaders / leaderboard | Room requires ACTIVE non-admin member and open Room; pending list belongs to caller's Squads; leader names are sanitized; leaderboard requires ACTIVE STUDENT and derives faculty/program from the profile. |
| Badge / season RPCs | equip checks badge ownership; close/refresh require current Admin before private dispatch. |
| is_admin / is_active_user | Current database profile, not user_metadata; is_admin retains trusted service-role handling. |
| Nine nexus_private functions | Direct EXECUTE denied to anon/authenticated. Clients cannot CREATE objects in public. |

## Verification executed

- New security_release_catalog_readonly.sql: live PASS after apply. Checks all
  public tables have RLS, reviewed definer list, no anon/private execution,
  four read-only display views, view modes/barriers, closed internal leaderboard
  views, pinned paths and the public profile column allowlist. No writes.
- New security_release_roles_rollback.sql: live PASS after apply. ACTIVE Student
  and Admin keep the same public-profile/Career XP output as owner; seasonal XP
  SELECT works and Student cannot read foreign rows through that invoker view.
- Both a nonexistent profile and a temporarily suspended dedicated QA Student
  fail 16 RPC probes each (32 total). Helpers reject forged ADMIN/ACTIVE metadata;
  missing/suspended callers cannot read the two guarded display views.
- Transfer's new probe checks a foreign/nonexistent Squad; it does not newly prove
  a suspended legitimate leader's transfer case. Earlier fixture-based leader
  tests remain the evidence for that case and were not rerun here.
- Temporary suspension and legacy-email compatibility changes were rolled back;
  no Auth user, password or session was modified. These are SQL role/JWT tests,
  not Auth login, REST/PostgREST, browser or true concurrent COMMIT tests.
- View definition MD5 unchanged: a16141e21baee94d642c99c8fa69a675.
  Public policy fingerprint unchanged: e8acc267642d53d6c1a0c93e1cbdc4d4.
- Counts before/after: profiles 9, Missions 3, Squads 7, memberships 11,
  endorsements 3, XP transactions 8, badges 24, notifications 28.
  Application code is unchanged; the candidate uses the normal CI checks.

## Remaining notices and limits

Advisor counts remain 2 [guarded definer views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view),
18 [authenticated definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
and 1 [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
The first two are retained with the controls above; do not revoke required RPCs
or switch the display views to invoker merely to suppress advisor notices.

Leaked-password protection is still disabled. Current official Auth docs make
it available on Pro and above through the Email provider's password settings.
The connected Supabase tools do not provide an Auth-settings update operation;
no plan purchase or Auth configuration change was made. This remains a release
configuration item, not a completed fix. Browser Realtime/reconnect, mobile,
hosting/Auth redirects and backup/recovery are also separate outstanding gates.

Pulling requires no manual SQL rerun. For recovery, use a new forward migration;
keep SELECT/RLS and service access, and do not restore unused write grants merely
to address an unrelated integration error.
