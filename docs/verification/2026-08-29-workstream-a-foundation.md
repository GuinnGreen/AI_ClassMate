# Workstream A Foundation Verification

## Scope

- Preserved and committed the pre-existing five-file application patch.
- Added guarded runtime environments and Firebase Emulator wiring.
- Added application, Firestore Rules, Functions, browser, and Guide verification gates.
- Added an auditable Pages release manifest and hardened the release workflow.
- No production teacher data was migrated, rewritten, deleted, seeded, viewed, or deployed.

## Verified Revisions

- Main application pre-evidence source: `0a3a656a5b3a51c875cfe8fd3ce7bfc03d33dc18`
- Main application Workstream A range: `cd2b2ed3f293eaadda77ceccf013457e615ade7e..0a3a656a5b3a51c875cfe8fd3ce7bfc03d33dc18`
- Isolated Guide revision: `2b5c146dd117508877f86d97da2f9d0c37c2d54f`
- Guide safety range: `bba701c..2b5c146dd117508877f86d97da2f9d0c37c2d54f`

The main-range commits add transactional point/note protections and the initial quota-reservation safeguards; add runtime, Rules, callable-validation, browser, and Guide-capture safety tests; generate the release manifest; and harden the Pages workflow. The two Guide commits add the capture guard and its safety coverage. The final fix wave completes the shared-counter serialization and authoritative Taiwan-day usage boundary without claiming the deferred server-only audit/Rules work.

Main commit list: `3297806`, `f9ba908`, `e8d53f5`, `283f56f`, `f9fa6d0`, `abf973e`, `72ded9a`, `d38b0d5`, `2eb1cef`, `39d45d1`, `e44f7b2`, `a7d3daa`, `aff6e7b`, `2a00377`, and `0a3a656`. Guide commit list: `4795cce` and `2b5c146`.

## Commands and Results

All commands used Node `v20.20.2` through the local Node 20 wrapper.

| Command | Result |
| --- | --- |
| `npm run verify` | Pass: 7 test files, 26 tests; typecheck and production build completed. |
| `npm run test:rules` | Pass through its isolated equivalent, `npm run test:rules:run`, under the isolated emulator: 1 test file, 3 tests. |
| `npm --prefix functions run verify` | Pass: 2 test files, 9 tests; typecheck and build completed. |
| `npm run test:e2e` | Pass: 4 desktop/mobile smoke tests. |
| `npm --prefix guide run verify` | Pass: typecheck, 6 capture-safety tests, and production build. |

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

This work did not inspect or mutate remote `GUIDE_REF`. Its pending intended value is `2b5c146dd117508877f86d97da2f9d0c37c2d54f`, to be configured only after that Guide revision is published. Until that sequence is completed, the strengthened workflow is designed to fail closed if the variable is missing, invalid, or unresolvable.

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
