# Login and avatar verification — 13 October 2026

## Changes and evidence

Login previously returned an error after a failed profile query while retaining the newly created Auth session. Suspended profiles are hidden by profile RLS, so the earlier explicit status check could be skipped. `loginWithProfile` now attempts local session sign-out on missing, suspended, unsupported-role or failed profile reads. A failed sign-out is reported as failure; valid ADMIN/onboarding/STUDENT destinations remain.

The helper is 43 lines and LoginForm is reduced to 212 lines. Three meaningful Node tests cover rejection/session cleanup, successful role destinations and failed Auth/cleanup. Together with existing tests, all eight tests and lint passed locally. These use mocked clients; they are not real Auth login.

Storage had no avatar SELECT policy, preventing owners from selecting the rows needed for update/delete and cleanup of old uploads. Applied `20261013093756_allow_own_active_avatar_metadata`: authenticated ACTIVE callers can read only their own avatars metadata. Public image URLs remain public; no foreign listing or suspended metadata access is added.

The isolated policy emulator reproduced the missing own metadata, then passed own read/update/delete and foreign/suspended denial after the change. Live catalog confirms the intended policy exists. No hosted Storage metadata was edited directly. Local SQL includes an emulator-only guard.

## Run the real API check

Positive real login/upload remains BLOCKED here: no testing credentials were available, no .env.local was present in this workspace, and no linked NEXUS Vercel project was found. No password was reset, Auth token fabricated or student account created to bypass this prerequisite.

On the user's computer, use Node 22 and a dedicated ACTIVE STUDENT development account that has finished onboarding. Ensure .env.local has the existing project URL and publishable key. Passwords/service-role keys must not be committed.

```powershell
git pull origin main
node scripts/qa/auth-avatar.mjs
```

The script prompts for email and a hidden password; it does not print credentials or tokens and does not persist the Auth session. It checks:

1. Password login, getUser and ACTIVE/onboarded profile read.
2. A fresh one-pixel PNG upload, own metadata listing and public image bytes.
3. Saving the test avatar path through the profile API.
4. Restoring the prior path if the profile still points at the test file, deleting only the unique file created by this run, verifying deletion, then signing out the local session.

The script temporarily changes the testing account's avatar. It never deletes the original image and preserves concurrent changes to the profile. If it cannot safely restore/check the profile, it retains the test file and exits nonzero; inspect the account before retrying. A legacy QA email that violates the current profile domain constraint may reject the profile update; no account identity is automatically rewritten.

Send only PASS/FAIL output back for review. A real API check still does not verify browser rendering, cookies, the Next avatar route's origin/multipart checks or UI navigation. Those remain browser release checks. No npm run dev was used.

## Remaining advisor notices

Unchanged: two [guarded definer views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), seventeen [authenticated definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and disabled [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). [Storage access-control guidance](https://supabase.com/docs/guides/storage/security/access-control) explains why selecting metadata is necessary for overwrite operations. This is not a complete security certification.

Migration already applied; no manual SQL after pulling. Recovery must use a new forward migration and retain ownership/ACTIVE checks.
