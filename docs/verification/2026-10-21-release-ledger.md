# 2026-10-21 reliability release ledger

Scope: reconcile existing Main PR #2 and Guide PR #1, fix data overwrite, server-only quota permissions, and AI error persistence; verify before user-authorized deployment.

1. Reconciliation: main dirty patch ID 0acc2a9077694ffe912c131590656c7a1672c9a3 exactly matches existing commit 3297806. Original working copies remain untouched. Guide extras capture and untracked media/video scripts remain local; they are unrelated to the reviewed safety release and must not be executed against production.
2. Add regressions for point updates after note-only records, log write denial, and AI failure/switching behavior; RED then GREEN.
3. Verify app, Functions, Guide, real Firestore rules/concurrent operations, and desktop/mobile browser flows.
4. Independent final review and regression fixes.
5. Deploy compatible Firebase backend/rules first, merge Guide preserving pinned SHA, configure GUIDE_REF, merge Main, verify Pages and live Firebase parity.

Ruling: earlier Workstream A no-deploy limits are superseded by explicit user authorization for this release. No student-data migration, capture seeding, or destructive production tests.

## Implementation and verification
- Main existing dirty patch is already preserved in PR commit 3297806; no user checkout changes applied.
- Rules: removed overlapping owner-write grant for logs, including nested descendants; counters remain server-only. Rules regression failed before fix and passed after.
- Data: use latest transaction snapshots for notes, attendance and points; preserve unknown fields and complete legacy daily shape. Added first-write/reset regressions (RED→GREEN) and real emulator concurrent note/absence/point/double-delete test.
- AI: failures and invalid payloads reject; drafts remain intact; stale student requests are ignored; saves occur before animation and copy/save are blocked while busy. Regressions reproduced before fixes.
- Independent final reviewer found animation partial-save and old-client partial-record compatibility issues; both fixed with failing regressions followed by green suites. No other concrete blocker reported.
- Main: typecheck, 56/56 unit/component tests and production build passed (Node 22.23.1).
- Functions: typecheck, 11/11 tests and build passed.
- Rules + actual student write concurrency: 8/8 passed against demo-classmate-ai.
- Actual server quota concurrency: 1/1 passed against demo-classmate-ai.
- Desktop/mobile browser: 6/6 passed, including real emulator login and scoring, mocked AI quota failure preserving stored comment. AI providers are not exercised by this browser test.
- Guide: typecheck, 13/13 tests and production build passed; pinned source remains 30966f4a56492af09353da300dcf3936ae63f607.
- CI now executes the same emulator-backed integration gate instead of only unauthenticated smoke tests.
- Production rules were read back and backed up locally before deployment; no teacher data exported.

Ruling: unrelated Guide captureExtras, video assets and scripts remain in the original user checkout; introducing an unreviewed capture workflow would expand this reliability release.
Deferred: bundle-size warning, dependency modernization, visual polish, archive semantics and broader AI privacy redesign remain outside the requested priority fixes.

## Release status
Deployment pending final committed source and backend rollout. Final live identifiers will be recorded after verification.

Ruling: deployment preflight reported Node.js 20 decommission on 2026-10-30. Upgrade Functions runtime/engine and CI to Node.js 22 without changing dependency versions. Functions typecheck, 11 tests and build passed again using Node 22.23.1; the final runtime rollout follows the already-running first backend deployment.
