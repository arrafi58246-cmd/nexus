# Document and certificate verification — 13 October 2026

## Completed

Live configuration verified: mission-documents is private with a 10,485,760-byte limit; achievement-certificates and mission-result-certificates are private with 5,000,000-byte limits. All allow PDF/JPEG/PNG. Existing validators enforce those separate limits and matching MIME/header signatures.

Four new validator tests pass: supported signatures; empty/truncated/unsupported/mismatched files; exact limits versus one byte over; duplicate document fields and correct deadline error fields. Lint and all twelve Node tests passed locally. Signature checks are not full document parsing, malware scanning or proof that all file contents are valid.

Found a Storage integrity gap: owners could overwrite/delete referenced Mission-result evidence; the existing reference protection covered Mission documents and achievement certificates only. Applied `20261013123149_protect_referenced_result_evidence`, adding two restrictive UPDATE/DELETE policies for the result bucket. They preserve ownership/ACTIVE rules and protect both certificate and supporting paths while referenced. Resubmission can still clean up an old file after releasing its reference. Two path indexes support the new lookups; no scale benchmark was run.

An isolated policy emulator reproduced referenced-certificate UPDATE, then passed referenced update/delete denial and cleanup of unreferenced/replaced evidence after the patch. Live catalog verifies both policies and indexes. The emulator disables result lifecycle triggers/FKs solely for synthetic reference fixtures; it does not certify submission, review or XP behavior. No hosted Storage metadata was edited directly, no source reference was changed and no file was deleted remotely.

## Real API check to run

```powershell
git pull origin main
node scripts/qa/documents.mjs
```

Use the same dedicated STUDENT development account that passed the avatar check, with Node 22 and existing URL/publishable key in .env.local. The shared helper prompts for a hidden password, verifies an ACTIVE/onboarded profile, avoids persisting tokens, and closes only its testing session.

For all three private buckets, the script uploads a tiny generated PDF, verifies signed download bytes, rejects unsigned public access, checks disallowed text/html MIME rejection, then removes its own unique temporary files and verifies cleanup. It creates no Mission, claim, Squad result or XP record. Signed URLs and tokens are never printed. API errors do not count as successful negative tests unless their reason/status matches the intended rejection.

Default uploads are small. Optional live one-byte-over-limit checks upload about 20 MB total:

```powershell
node scripts/qa/documents.mjs --size-limits
```

Every attempted own-path upload is tracked for cleanup, including ambiguous errors and unexpected accepted invalid files. If cleanup fails, the script returns nonzero and prints a testing run ID so the corresponding folder can be inspected; it never deletes other runs' files. Do not interpret a failed cleanup as a successful complete test.

Real document API checks are PREPARED / NOT RUN by the agent because no testing credentials were supplied here. The CLI passed syntax checks; its complete network flow still needs the user's output. Bucket configuration/catalog checks and unit/emulator tests do not replace that run. Browser forms, Next multipart/origin behavior, evidence-backed submissions, admin review, signed URL expiry and cross-account access remain separate release checks.

## Prior user-reported result

On 13 October, the user reported PASS for real Auth login/profile, avatar upload/public read, profile-path save, restoration and cleanup using auth-avatar.mjs. This is reported evidence for the avatar API path, not an independent agent run or browser QA. No email/password was copied into this report.

## Remaining security notices

Advisors remain at two [guarded definer views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), seventeen [authenticated definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and disabled [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This review does not declare the whole application secure or ready to deploy.

Migration already applied; no manual SQL after pulling. Use a forward migration for recovery and retain referenced-evidence, ownership and ACTIVE checks. No development server was started.
