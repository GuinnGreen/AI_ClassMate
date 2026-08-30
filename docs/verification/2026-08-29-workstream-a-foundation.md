# Workstream A Foundation Verification

## Scope

- Preserved and committed the pre-existing five-file application patch.
- Added guarded runtime environments and Firebase Emulator wiring.
- Added application, Firestore Rules, Functions, browser, and Guide verification gates.
- Added an auditable Pages release manifest and hardened the release workflow.
- No production teacher data was migrated, rewritten, deleted, seeded, viewed, or deployed.

## Verified Revisions

- Main application pre-evidence source: `01086ef539d6242c5a11fd4d60734c7f9b26c009`
- Main application Workstream A range: `cd2b2ed3f293eaadda77ceccf013457e615ade7e..01086ef539d6242c5a11fd4d60734c7f9b26c009`
- Isolated Guide revision: `7dee0b8e721a865da8f7a72cc22471f37d1afd94`
- Guide safety range: `bba701c..7dee0b8e721a865da8f7a72cc22471f37d1afd94`

The main-range commits add transactional point/note protections and quota-reservation safeguards; add runtime, Rules, callable-validation, browser, and Guide-capture safety tests; generate the release manifest; and harden the Pages workflow. The four Guide commits add the capture guard, deterministic local Auth provisioning, nonzero CLI failure handling, and fail-closed WebP encoding. The final Main corrections complete shared-counter serialization and refresh browser quota state at the server-defined Taiwan-day boundary without claiming the deferred server-only audit/Rules work.

Main commit list: `3297806`, `f9ba908`, `e8d53f5`, `283f56f`, `f9fa6d0`, `abf973e`, `72ded9a`, `d38b0d5`, `2eb1cef`, `39d45d1`, `e44f7b2`, `a7d3daa`, `aff6e7b`, `2a00377`, `0a3a656`, `303f7ee`, `f2f1d00`, `fdfd6ff`, and `01086ef`. Guide commit list: `4795cce`, `2b5c146`, `f69f40b`, and `7dee0b8`.

## Commands and Results

All commands used Node `v20.20.2` through the local Node 20 wrapper.

| Command | Result |
| --- | --- |
| `npm run verify` | Pass: 8 test files, 34 tests; typecheck and production build completed. |
| `npm run test:rules` | Pass through its isolated equivalent, `npm run test:rules:run`, under the isolated emulator: 1 test file, 3 tests. |
| `npm --prefix functions run verify` | Pass: 2 test files, 11 tests; typecheck and build completed. |
| `npm --prefix functions run test:emulator:quota` | Pass under the isolated emulator: 1 real-concurrency test covering the 28/30 boundary, failed-use refund, replacement, and server-timestamp quota snapshot. |
| `npm run test:e2e` | Pass: 4 desktop/mobile smoke tests. |
| `npm --prefix guide run verify` | Pass: typecheck, 12 capture-safety tests, and production build. |

The main build retained its pre-existing large-chunk advisory; it did not affect the successful exit status.

## Safety Boundary

- Emulator project: `demo-classmate-ai`
- Production migration performed: no
- Production deployment performed: no
- Guide capture performed: no
- Legacy teacher data changed: no
- No Firebase remote access, production data access, migration, deployment, push, repository dispatch, or GitHub configuration mutation occurred.

The committed Rules configuration remains on `127.0.0.1:8080` for clean CI. A separate unrelated local emulator owns that port, so Rules verification used the established uncommitted `/private/tmp` configuration on `127.0.0.1:8081`, Java 21, and `demo-classmate-ai`. The unrelated 8080 process was neither stopped nor contacted.

Browser verification used the isolated `/private/tmp/classmate-ai-playwright` browser path and the test-mode local server only. The first sandboxed browser launch stopped before page interaction because of the host Mach-port restriction; the same test-only command then passed with the required local browser-launch permission. It did not submit credentials or data.

The original Guide checkout was inspected read-only. Its pre-existing user-owned changes are limited to image/capture asset and script work, plus unrelated local materials; none were staged, changed, or used for verification. Guide verification ran only in the clean isolated Guide worktree at the revision above.

## External Configuration Status

This work did not inspect or mutate remote `GUIDE_REF`. Its pending intended value is `7dee0b8e721a865da8f7a72cc22471f37d1afd94`, to be configured only after that exact Guide revision is published. Until that sequence is completed, the strengthened workflow is designed to fail closed if the variable is missing, invalid, or unresolvable.

## Deferred to Workstream B

- Server-only quota and audit Rules.
- Teacher claims and App Check enforcement.
- Recent-auth callable framework.
- Soft delete and archive state machine.

## Deferred Minor Ledger

- Expand the runtime connector test to prove the global guard survives module re-evaluation.
- Ignore generated Playwright failure artifacts (`test-results/` and, when enabled, `playwright-report/`).
- Add subprocess coverage for release-manifest writer environment mapping, output path, trailing newline, and failure without output.
- Include the Functions and Guide lockfiles in the setup-node cache dependency path.

Workstream B has not started. Its dedicated implementation plan must be written and approved before these deferred items or any new Workstream B changes are undertaken.
