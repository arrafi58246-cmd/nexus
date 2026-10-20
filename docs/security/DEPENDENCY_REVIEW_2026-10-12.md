# Dependency security review — 12 October 2026

## Changes

- Pin Next.js and eslint-config-next from 16.3.4 to **16.3.8**, retaining the existing release line and application behavior.
- Refresh compatible lockfile dependencies: sharp 0.35.4 → 0.35.5 (including platform packages/libvips), source-map-js 1.2.1 → 1.2.2, brace-expansion 1.1.18 → 1.1.21 and 5.0.9 → 5.0.12.
- Add `npm test` for the existing Server Action regression suite and `npm run audit:production`.
- PR CI now runs clean installation, production audit, lint, tests and build. New high/critical production findings fail the audit step. This gate does not claim that development dependencies are vulnerability-free.

No application source, database migration, authentication contract or frontend API was changed. No forced major upgrade or dependency override was used.

## Audit evidence

The checked lockfile has:

| Audit scope | Before | After |
|---|---|---|
| All dependencies | 9 affected packages: 1 critical, 8 high | 5 affected packages: 0 critical, 5 high |
| Production dependencies (`--omit=dev`) | See preceding release audit | **0 findings** |

Machine-readable findings and their dependency chains are in `dependency-audit-2026-10-12.json`. These are npm advisory results at the recorded time, not a claim that all application security risks are eliminated.

The five remaining entries are **one upstream braces advisory propagated through the lint toolchain**:

`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces@3.0.3`

The reviewed advisory reports no patched braces release. The registry still reports braces 3.0.3 as latest; even @next/eslint-plugin-next 16.4.0 still depends on fast-glob 3.3.1. npm's suggested forced downgrade to eslint-config-next 14.2.35 is not applied to this Next.js 16 app. Recheck the upstream chain before release. Avoid treating untrusted uploaded glob patterns as lint configuration; no application import of this chain was introduced.

## Verification

- PASS: ESLint and production Next.js 16.3.8 / TypeScript build.
- PASS: all 5 existing Squad leadership Server Action tests through `npm test`.
- PASS: sharp SVG decode → 32×32 resize → WebP encode, with sharp 0.35.5 and libvips 8.18.7.
- PASS: npm audit production exit 0; full audit still exits 1 for the documented development chain.
- Application source in the isolated check matches merged main/PR33 (the local snapshot lacks the binary favicon; GitHub CI checks the actual repository).
- The owner reported their preceding local test after pulling PR33 as safe. Exact browser scenarios were not supplied; this does not establish full browser or concurrent-request coverage for either change.

GitHub CI is the final check on the submitted commit. No real Auth/browser E2E or deployment smoke test was performed as part of this dependency patch.

## Local update

Stop the running development server, then:

```powershell
git pull origin main
npm ci
npm run dev
```

`npm ci` installs the committed lockfile. The five documented development audit entries may still appear; do not run `npm audit fix --force` to suppress them. There is no SQL migration to rerun.

## References and next checks

- [Next.js 16.3.8 security release](https://github.com/vercel/next.js/releases/tag/v16.3.8)
- [Unpatched braces advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [sharp advisory GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)

Next release gates remain the targeted Supabase privilege review, outstanding concurrency coverage, collaborator UI integration, real STUDENT/ADMIN browser journeys and deployment smoke checks. Run the production audit again against the final release lockfile.
