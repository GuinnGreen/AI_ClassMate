# Workstream A Safe Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve and verify the current application changes, isolate development from production Firebase, establish automated test gates for the app, Functions, Firestore Rules, browser, and Guide, and generate an auditable release manifest without migrating or deleting teacher data.

**Architecture:** Keep the current React/Firebase behavior intact while adding a pure runtime-environment boundary, explicit emulator wiring, characterization tests, and CI verification. Work in two existing repositories: the main app repository at `classmate-ai---智慧班級經營系統/` and the Guide repository at its parent workspace. No task changes schema, production teacher data, account claims, App Check enforcement, or production Firestore Rules semantics.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Firebase 12, Firebase Emulator Suite, Firebase Rules Unit Testing, Vitest, Testing Library, Playwright, GitHub Actions, Node.js 20.

**Spec:** `docs/superpowers/specs/2026-08-29-system-hardening-and-optimization-design.md`

## Global Constraints

- Existing teacher accounts, student records, scores, attendance, notes, AI comments, settings, archives, and exports must not be migrated, rewritten, deleted, or reseeded in Workstream A.
- The five existing modified app files must be reviewed, built, typechecked, and committed separately before new implementation begins.
- Existing Guide changes and untracked media/scripts belong to the user; stage only the exact Guide files listed by each task.
- Never run `guide/npm run capture` against production-backed local development. Capture is allowed only when the rendered app reports `development` and Firebase emulators enabled.
- Local automated Firebase tests use project ID `demo-classmate-ai`; no production project ID or credentials are accepted by test scripts.
- Production Pages deployment remains source-only for Functions and Rules in this workstream; the release manifest must label those components as externally deployed rather than claiming deployment parity.
- Every task ends with its own verification and commit. Do not push or deploy from this plan.
- Use Node.js 20 for local and CI commands.
- No production backup, production migration, production Rules deployment, account-claim mutation, or App Check enforcement occurs in Workstream A.

---

## File Map

### Main app repository

- `config/runtimeEnvironment.ts`: pure environment parsing and safety policy.
- `components/EnvironmentBanner.tsx`: visible non-production environment marker.
- `firebase.ts`: Firebase initialization plus guarded emulator connectors.
- `index.tsx`: expose non-sensitive runtime markers for safe automation.
- `.env.example`, `.env.development`, `.env.test`, `.env.production`: documented, emulator-only development/test, and non-secret production mode configuration.
- `vite-env.d.ts`: typed Vite environment variables.
- `vitest.config.ts`, `vitest.rules.config.ts`, `tests/setup.ts`: unit/component and Rules test configuration.
- `tests/config/runtimeEnvironment.test.ts`: environment policy tests.
- `tests/firestore/firestore.rules.test.ts`: current tenant-isolation characterization tests.
- `functions/src/inputValidation.ts`: pure schedule request input validation.
- `functions/test/inputValidation.test.ts`, `functions/vitest.config.ts`: Functions test foundation.
- `playwright.config.ts`, `tests/e2e/login.smoke.spec.ts`: unauthenticated desktop/mobile smoke tests.
- `scripts/releaseManifest.ts`, `scripts/generate-release-manifest.mjs`, `tests/scripts/releaseManifest.test.ts`: deterministic release identity generation.
- `package.json`, `package-lock.json`, `functions/package.json`, `functions/package-lock.json`: reproducible scripts and test dependencies.
- `firebase.json`: local emulator ports.
- `.github/workflows/deploy.yml`: verify gates, pinned Guide ref, release manifest, and stale frontend LLM-secret removal.
- `README.md`: safe local-development and verification commands.

### Guide repository

- `guide/scripts/scenes/absence.ts`: correct DOM element narrowing for `offsetParent`.
- `guide/scripts/scenes/tags.ts`: correct DOM element narrowing for `offsetParent`.
- `guide/scripts/captureUtils.ts`: refuse destructive capture unless the app reports emulator-backed development.
- `guide/package.json`: add `typecheck` and `verify` scripts.

---

### Task 1: Preserve and commit the five existing app fixes

**Files:**
- Verify and commit: `App.tsx`
- Verify and commit: `components/Sidebar.tsx`
- Verify and commit: `components/StudentDetailWorkspace.tsx`
- Verify and commit: `functions/src/index.ts`
- Verify and commit: `services/firebaseService.ts`

**Interfaces:**
- Consumes: current dirty working tree based on commit `659f25a`.
- Produces: one verified baseline commit containing only the five pre-existing modifications; later tasks start from this commit.

- [ ] **Step 1: Confirm the exact dirty-file boundary**

Run:

```bash
git status --short
git diff --stat
git diff --name-only
```

Expected: exactly the five source files above are modified, with no staged files.

- [ ] **Step 2: Review the patch for data-loss or destructive behavior**

Run:

```bash
git diff -- App.tsx components/Sidebar.tsx components/StudentDetailWorkspace.tsx functions/src/index.ts services/firebaseService.ts
```

Expected: callback/memo changes, note-sync cancellation, transactional point operations, quota reservation/refund, and image MIME validation only. Stop if the patch contains credentials, deployment commands, collection-wide deletion, or schema migration.

- [ ] **Step 3: Typecheck and build the main app**

Run:

```bash
npx tsc --noEmit
npm run build
```

Expected: both commands exit 0. Vite may report the existing large-chunk warning; no build error is allowed.

- [ ] **Step 4: Typecheck and build Functions**

Run:

```bash
npm --prefix functions run build
```

Expected: exit 0 with generated output under `functions/lib/` only.

- [ ] **Step 5: Stage only the five reviewed files**

Run:

```bash
git add App.tsx components/Sidebar.tsx components/StudentDetailWorkspace.tsx functions/src/index.ts services/firebaseService.ts
git diff --cached --name-only
git diff --cached --check
```

Expected: the cached file list contains exactly five paths and `git diff --cached --check` prints nothing.

- [ ] **Step 6: Commit the verified baseline**

Run:

```bash
git commit -m "fix: preserve concurrent writes and AI quota integrity"
```

Expected: one commit containing only the five source files. Do not push.

---

### Task 2: Add unit-test infrastructure and a typed runtime-environment policy

**Files:**
- Create: `config/runtimeEnvironment.ts`
- Create: `components/EnvironmentBanner.tsx`
- Create: `tests/config/runtimeEnvironment.test.ts`
- Create: `tests/setup.ts`
- Create: `vitest.config.ts`
- Create: `.env.development`
- Create: `.env.test`
- Create: `.env.production`
- Modify: `.env.example`
- Modify: `vite-env.d.ts`
- Modify: `firebase.ts`
- Modify: `index.tsx`
- Modify: `App.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: Vite `import.meta.env` values.
- Produces: `RuntimeEnvironmentConfig`, `resolveRuntimeEnvironment(env)`, and singleton `runtimeEnvironment`.
- Produces DOM markers `data-app-environment` and `data-firebase-emulators` on `<html>` for Guide capture safety.

- [ ] **Step 1: Install the main test dependencies**

Run:

```bash
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @firebase/rules-unit-testing firebase-tools @playwright/test
```

Expected: `package.json` and `package-lock.json` change; application runtime dependencies remain unchanged.

- [ ] **Step 2: Add failing environment-policy tests**

Create `tests/config/runtimeEnvironment.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { resolveRuntimeEnvironment } from '../../config/runtimeEnvironment';

describe('resolveRuntimeEnvironment', () => {
  it('accepts emulator-backed development', () => {
    expect(resolveRuntimeEnvironment({
      VITE_APP_ENV: 'development',
      VITE_USE_FIREBASE_EMULATORS: 'true',
      VITE_ALLOW_REMOTE_FIREBASE: 'false',
    })).toEqual({
      name: 'development',
      useFirebaseEmulators: true,
      allowRemoteFirebase: false,
      isProduction: false,
    });
  });

  it('rejects development connected to remote Firebase without explicit opt-in', () => {
    expect(() => resolveRuntimeEnvironment({
      VITE_APP_ENV: 'development',
      VITE_USE_FIREBASE_EMULATORS: 'false',
      VITE_ALLOW_REMOTE_FIREBASE: 'false',
    })).toThrow('Development must use Firebase emulators unless VITE_ALLOW_REMOTE_FIREBASE=true');
  });

  it('rejects production configured to use emulators', () => {
    expect(() => resolveRuntimeEnvironment({
      VITE_APP_ENV: 'production',
      VITE_USE_FIREBASE_EMULATORS: 'true',
      VITE_ALLOW_REMOTE_FIREBASE: 'false',
    })).toThrow('Production cannot use Firebase emulators');
  });

  it('rejects staging pointed at the production Firebase project', () => {
    expect(() => resolveRuntimeEnvironment({
      VITE_APP_ENV: 'staging',
      VITE_USE_FIREBASE_EMULATORS: 'false',
      VITE_ALLOW_REMOTE_FIREBASE: 'true',
      VITE_FIREBASE_PROJECT_ID: 'ai-teacher-classroom',
    })).toThrow('Staging cannot use the production Firebase project');
  });

  it('requires explicit opt-in for remote staging Firebase', () => {
    expect(() => resolveRuntimeEnvironment({
      VITE_APP_ENV: 'staging',
      VITE_USE_FIREBASE_EMULATORS: 'false',
      VITE_ALLOW_REMOTE_FIREBASE: 'false',
      VITE_FIREBASE_PROJECT_ID: 'ai-teacher-classroom-staging',
    })).toThrow('Staging remote Firebase requires VITE_ALLOW_REMOTE_FIREBASE=true');
  });

  it('rejects unknown environment names', () => {
    expect(() => resolveRuntimeEnvironment({
      VITE_APP_ENV: 'preview',
      VITE_USE_FIREBASE_EMULATORS: 'false',
      VITE_ALLOW_REMOTE_FIREBASE: 'false',
    })).toThrow('Unsupported VITE_APP_ENV: preview');
  });
});
```

- [ ] **Step 3: Add Vitest configuration and verify the test fails**

Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/firestore/**', 'tests/e2e/**'],
    restoreMocks: true,
  },
});
```

Add these scripts to the root `package.json`:

```json
"typecheck": "tsc --noEmit",
"test": "vitest",
"test:run": "vitest run",
"verify": "npm run typecheck && npm run test:run && npm run build"
```

Run:

```bash
npm run test:run -- tests/config/runtimeEnvironment.test.ts
```

Expected: FAIL because `config/runtimeEnvironment.ts` does not exist.

- [ ] **Step 4: Implement the pure environment policy**

Create `config/runtimeEnvironment.ts`:

```typescript
export type AppEnvironment = 'development' | 'staging' | 'production';

export interface RuntimeEnvironmentConfig {
  name: AppEnvironment;
  useFirebaseEmulators: boolean;
  allowRemoteFirebase: boolean;
  isProduction: boolean;
}

type RuntimeEnvInput = Record<string, string | boolean | undefined>;

function readBoolean(value: string | boolean | undefined): boolean {
  return value === true || value === 'true';
}

export function resolveRuntimeEnvironment(env: RuntimeEnvInput): RuntimeEnvironmentConfig {
  const name = env.VITE_APP_ENV;
  if (name !== 'development' && name !== 'staging' && name !== 'production') {
    throw new Error(`Unsupported VITE_APP_ENV: ${String(name)}`);
  }

  const useFirebaseEmulators = readBoolean(env.VITE_USE_FIREBASE_EMULATORS);
  const allowRemoteFirebase = readBoolean(env.VITE_ALLOW_REMOTE_FIREBASE);

  if (name === 'development' && !useFirebaseEmulators && !allowRemoteFirebase) {
    throw new Error('Development must use Firebase emulators unless VITE_ALLOW_REMOTE_FIREBASE=true');
  }
  if (name === 'production' && useFirebaseEmulators) {
    throw new Error('Production cannot use Firebase emulators');
  }
  if (name === 'staging' && !useFirebaseEmulators && !allowRemoteFirebase) {
    throw new Error('Staging remote Firebase requires VITE_ALLOW_REMOTE_FIREBASE=true');
  }
  if (name === 'staging' && env.VITE_FIREBASE_PROJECT_ID === 'ai-teacher-classroom') {
    throw new Error('Staging cannot use the production Firebase project');
  }

  return {
    name,
    useFirebaseEmulators,
    allowRemoteFirebase,
    isProduction: name === 'production',
  };
}

export const runtimeEnvironment = resolveRuntimeEnvironment(import.meta.env);
```

- [ ] **Step 5: Add typed environment variables and safe test configuration**

Add to `vite-env.d.ts` inside `ImportMetaEnv`:

```typescript
readonly VITE_APP_ENV: 'development' | 'staging' | 'production';
readonly VITE_USE_FIREBASE_EMULATORS: 'true' | 'false';
readonly VITE_ALLOW_REMOTE_FIREBASE: 'true' | 'false';
```

Append to `.env.example`:

```dotenv
VITE_APP_ENV=development
VITE_USE_FIREBASE_EMULATORS=true
VITE_ALLOW_REMOTE_FIREBASE=false
```

Create both `.env.development` and `.env.test` with the same non-secret emulator-only values:

```dotenv
VITE_APP_ENV=development
VITE_USE_FIREBASE_EMULATORS=true
VITE_ALLOW_REMOTE_FIREBASE=false
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-classmate-ai.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-classmate-ai
VITE_FIREBASE_STORAGE_BUCKET=demo-classmate-ai.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:demo
VITE_FIREBASE_MEASUREMENT_ID=G-DEMO000000
```

Create `.env.production` with runtime mode flags only; Firebase values continue to come from CI secrets or the developer's ignored `.env.local`:

```dotenv
VITE_APP_ENV=production
VITE_USE_FIREBASE_EMULATORS=false
VITE_ALLOW_REMOTE_FIREBASE=true
```

Vite mode-specific files override generic `.env.local` values, so `npm run dev` uses project `demo-classmate-ai` even when the developer has production credentials in `.env.local`.

- [ ] **Step 6: Connect Firebase SDKs to emulators only when policy allows**

Modify `firebase.ts` imports:

```typescript
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { runtimeEnvironment } from './config/runtimeEnvironment';
```

After creating `auth`, `db`, and `functions`, add:

```typescript
const emulatorMarker = globalThis as typeof globalThis & {
  __CLASSMATE_EMULATORS_CONNECTED__?: boolean;
};

if (runtimeEnvironment.useFirebaseEmulators && !emulatorMarker.__CLASSMATE_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  emulatorMarker.__CLASSMATE_EMULATORS_CONNECTED__ = true;
}
```

- [ ] **Step 7: Expose non-sensitive automation markers and render the environment banner**

Create `components/EnvironmentBanner.tsx`:

```tsx
import { runtimeEnvironment } from '../config/runtimeEnvironment';

export function EnvironmentBanner() {
  if (runtimeEnvironment.isProduction) return null;
  return (
    <div className="fixed left-1/2 top-2 z-[10000] -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-black shadow">
      {runtimeEnvironment.name.toUpperCase()}
      {runtimeEnvironment.useFirebaseEmulators ? ' · FIREBASE EMULATOR' : ' · REMOTE FIREBASE'}
    </div>
  );
}
```

In `index.tsx`, before `createRoot`, add:

```typescript
import { runtimeEnvironment } from './config/runtimeEnvironment';

document.documentElement.dataset.appEnvironment = runtimeEnvironment.name;
document.documentElement.dataset.firebaseEmulators = String(runtimeEnvironment.useFirebaseEmulators);
```

In `App.tsx`, import `EnvironmentBanner` and render it directly inside `ToastProvider`, before `AppInner`:

```tsx
<ToastProvider>
  <EnvironmentBanner />
  <AppInner />
</ToastProvider>
```

- [ ] **Step 8: Run the unit test and full verification**

Run:

```bash
npm run test:run -- tests/config/runtimeEnvironment.test.ts
npm run typecheck
npm run build -- --mode test
```

Expected: all commands exit 0. The test build must not contact Firebase.

- [ ] **Step 9: Commit the runtime-environment foundation**

Run:

```bash
git add config/runtimeEnvironment.ts components/EnvironmentBanner.tsx tests/config/runtimeEnvironment.test.ts tests/setup.ts vitest.config.ts .env.development .env.test .env.production .env.example vite-env.d.ts firebase.ts index.tsx App.tsx package.json package-lock.json
git diff --cached --check
git commit -m "test: add guarded Firebase runtime environment"
```

---

### Task 3: Add Firebase Emulator configuration and Rules characterization tests

**Files:**
- Create: `vitest.rules.config.ts`
- Create: `tests/firestore/firestore.rules.test.ts`
- Modify: `firebase.json`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: current `firestore.rules` without changing its semantics.
- Produces: repeatable `npm run test:rules` command against project `demo-classmate-ai`.

- [ ] **Step 1: Add emulator ports**

Extend `firebase.json` with:

```json
"emulators": {
  "auth": { "host": "127.0.0.1", "port": 9099 },
  "firestore": { "host": "127.0.0.1", "port": 8080 },
  "functions": { "host": "127.0.0.1", "port": 5001 },
  "ui": { "enabled": true, "host": "127.0.0.1", "port": 4000 },
  "singleProjectMode": true
}
```

Do not change `.firebaserc`; emulator commands always pass an explicit demo project.

- [ ] **Step 2: Add the dedicated Rules Vitest configuration**

Create `vitest.rules.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/firestore/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
```

- [ ] **Step 3: Add failing tenant-isolation characterization tests**

Create `tests/firestore/firestore.rules.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-classmate-ai';
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterEach(async () => testEnv.clearFirestore());
afterAll(async () => testEnv.cleanup());

describe('Firestore tenant isolation', () => {
  it('allows an authenticated owner to write their student document', async () => {
    const db = testEnv.authenticatedContext('teacher-a').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/teacher-a/students/student-1'), { name: '測試學生' }));
  });

  it('denies cross-tenant reads', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users/teacher-a/students/student-1'), { name: '測試學生' });
    });
    const db = testEnv.authenticatedContext('teacher-b').firestore();
    await assertFails(getDoc(doc(db, 'users/teacher-a/students/student-1')));
  });

  it('denies unauthenticated reads', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users/teacher-a/students/student-1')));
  });
});
```

- [ ] **Step 4: Add exact emulator scripts**

Add to root `package.json`:

```json
"emulators": "firebase emulators:start --project demo-classmate-ai --only auth,firestore,functions",
"test:rules:run": "vitest run --config vitest.rules.config.ts",
"test:rules": "firebase emulators:exec --project demo-classmate-ai --only firestore \"npm run test:rules:run\""
```

- [ ] **Step 5: Run the Rules tests**

Run:

```bash
npm run test:rules
```

Expected: three tests pass. The emulator output must identify project `demo-classmate-ai`, never `ai-teacher-classroom`.

- [ ] **Step 6: Document safe local commands**

In `README.md`, add a development section containing exactly these commands and warnings:

```markdown
### Safe local Firebase development

Run Firebase emulators in one terminal:

    npm run emulators

Run the Vite app with emulator configuration in another terminal:

    npm run dev -- --mode test

Run Firestore Rules tests:

    npm run test:rules

The emulator project is always `demo-classmate-ai`. Do not run seed, capture, migration, or destructive scripts with production Firebase configuration.

Staging credentials are not stored in the repository. A staging environment must set `VITE_APP_ENV=staging`, `VITE_ALLOW_REMOTE_FIREBASE=true`, `VITE_USE_FIREBASE_EMULATORS=false`, and a `VITE_FIREBASE_PROJECT_ID` different from `ai-teacher-classroom`; the runtime guard rejects the production project ID.
```

- [ ] **Step 7: Commit emulator and Rules test support**

Run:

```bash
git add firebase.json vitest.rules.config.ts tests/firestore/firestore.rules.test.ts package.json README.md
git add package-lock.json
git diff --cached --check
git commit -m "test: add Firebase emulator tenant checks"
```

---

### Task 4: Add Functions tests and preserve schedule-input validation

**Files:**
- Create: `functions/src/inputValidation.ts`
- Create: `functions/test/inputValidation.test.ts`
- Create: `functions/vitest.config.ts`
- Modify: `functions/src/index.ts`
- Modify: `functions/package.json`
- Modify: `functions/package-lock.json`

**Interfaces:**
- Produces: `validateScheduleInput(data): ValidScheduleInput`.
- `ValidScheduleInput` contains trimmed `prompt`, `base64Data`, and validated `mimeType`.
- No provider call, Admin SDK write, deployed function name, region, timeout, or quota behavior changes.

- [ ] **Step 1: Install Functions test dependency**

Run:

```bash
npm --prefix functions install --save-dev vitest
```

- [ ] **Step 2: Write failing validation tests**

Create `functions/test/inputValidation.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { validateScheduleInput } from '../src/inputValidation';

describe('validateScheduleInput', () => {
  it('accepts a supported image payload', () => {
    expect(validateScheduleInput({
      prompt: '  辨識課表  ',
      base64Data: 'YWJj',
      mimeType: 'image/png',
    })).toEqual({
      prompt: '辨識課表',
      base64Data: 'YWJj',
      mimeType: 'image/png',
    });
  });

  it('rejects unsupported MIME types', () => {
    expect(() => validateScheduleInput({
      prompt: '辨識課表',
      base64Data: 'YWJj',
      mimeType: 'application/pdf',
    })).toThrow('不支援的影像格式：application/pdf');
  });

  it('rejects oversized base64 payloads', () => {
    expect(() => validateScheduleInput({
      prompt: '辨識課表',
      base64Data: 'a'.repeat(7_000_001),
      mimeType: 'image/jpeg',
    })).toThrow('圖片過大（請壓縮至 5MB 以下）');
  });
});
```

- [ ] **Step 3: Add Functions Vitest configuration and verify failure**

Create `functions/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

Add to `functions/package.json`:

```json
"typecheck": "tsc --noEmit",
"test": "vitest",
"test:run": "vitest run",
"verify": "npm run typecheck && npm run test:run && npm run build"
```

Run:

```bash
npm --prefix functions run test:run
```

Expected: FAIL because `src/inputValidation.ts` does not exist.

- [ ] **Step 4: Implement the pure validator**

Create `functions/src/inputValidation.ts`:

```typescript
import { HttpsError } from 'firebase-functions/v2/https';

export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
] as const;

type AllowedImageMime = typeof ALLOWED_IMAGE_MIMES[number];

export interface ValidScheduleInput {
  prompt: string;
  base64Data: string;
  mimeType: AllowedImageMime;
}

export function validateScheduleInput(data: unknown): ValidScheduleInput {
  const value = data as Record<string, unknown> | null;
  const prompt = typeof value?.prompt === 'string' ? value.prompt.trim() : '';
  const base64Data = typeof value?.base64Data === 'string' ? value.base64Data : '';
  const mimeType = typeof value?.mimeType === 'string' ? value.mimeType : '';

  if (!prompt || !base64Data || !mimeType) {
    throw new HttpsError('invalid-argument', '缺少必要參數');
  }
  if (!ALLOWED_IMAGE_MIMES.includes(mimeType as AllowedImageMime)) {
    throw new HttpsError('invalid-argument', `不支援的影像格式：${mimeType}`);
  }
  if (base64Data.length > 7_000_000) {
    throw new HttpsError('invalid-argument', '圖片過大（請壓縮至 5MB 以下）');
  }

  return { prompt, base64Data, mimeType: mimeType as AllowedImageMime };
}
```

- [ ] **Step 5: Make `parseSchedule` consume the validator**

In `functions/src/index.ts`, remove the local MIME array and replace the manual schedule input parsing with:

```typescript
const { prompt, base64Data, mimeType } = validateScheduleInput(req.data);
```

Add:

```typescript
import { validateScheduleInput } from './inputValidation';
```

Do not alter `reserveQuota`, `refundQuota`, `routeVisionGeneration`, secrets, timeout, memory, region, or returned `{ text }` shape.

- [ ] **Step 6: Run Functions verification**

Run:

```bash
npm --prefix functions run verify
```

Expected: three tests pass, TypeScript exits 0, and Functions build exits 0.

- [ ] **Step 7: Commit the Functions test foundation**

Run:

```bash
git add functions/src/inputValidation.ts functions/test/inputValidation.test.ts functions/vitest.config.ts functions/src/index.ts functions/package.json functions/package-lock.json
git diff --cached --check
git commit -m "test: cover callable image validation"
```

---

### Task 5: Add unauthenticated desktop and mobile browser smoke tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/login.smoke.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `.env.test`, runtime environment markers, and the existing login/register UI.
- Produces: `npm run test:e2e` using Chromium without real credentials or Firebase writes.

- [ ] **Step 1: Add Playwright scripts**

Add to root `package.json`:

```json
"test:e2e": "playwright test",
"test:e2e:install": "playwright install chromium"
```

- [ ] **Step 2: Create Playwright configuration**

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev -- --mode test',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Write the smoke tests**

Create `tests/e2e/login.smoke.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

test('login and registration surfaces render without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ClassMate AI' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-app-environment', 'development');
  await expect(page.locator('html')).toHaveAttribute('data-firebase-emulators', 'true');
  await expect(page.getByText('DEVELOPMENT · FIREBASE EMULATOR')).toBeVisible();

  await page.getByRole('button', { name: /註冊/ }).click();
  await expect(page.locator('input[type="password"]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('mobile login page has no horizontal overflow', async ({ page }) => {
  await page.goto('/');
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
```

- [ ] **Step 4: Install Chromium and run the smoke tests**

Run:

```bash
npm run test:e2e:install
npm run test:e2e
```

Expected: two tests pass in both configured projects; no Firebase account is created and no Firestore document is written.

- [ ] **Step 5: Commit browser smoke coverage**

Run:

```bash
git add playwright.config.ts tests/e2e/login.smoke.spec.ts package.json package-lock.json
git diff --cached --check
git commit -m "test: add desktop and mobile login smoke checks"
```

---

### Task 6: Fix Guide typecheck and block destructive capture outside emulator development

**Repository:** Guide repository at `/Users/guin/Documents/MasterPaper/code`

**Files:**
- Modify: `guide/scripts/scenes/absence.ts`
- Modify: `guide/scripts/scenes/tags.ts`
- Modify: `guide/scripts/captureUtils.ts`
- Modify: `guide/package.json`

**Interfaces:**
- Consumes: main-app HTML markers `data-app-environment` and `data-firebase-emulators`.
- Produces: `assertSafeCaptureEnvironment(page): Promise<void>` and Guide `typecheck`/`verify` scripts.
- Preserves: the user's modified `guide/scripts/capture.ts`, `debug-error.png`, extras scene, generated media, and other untracked files without staging them.

- [ ] **Step 1: Confirm Guide dirty-file ownership before editing**

Run:

```bash
git status --short
git diff -- guide/scripts/capture.ts guide/public/images/debug-error.png
```

Expected: existing user changes remain visible. Do not stage or rewrite either file in this task.

- [ ] **Step 2: Add `typecheck` and `verify` scripts**

Modify `guide/package.json` scripts:

```json
"typecheck": "tsc --noEmit",
"verify": "npm run typecheck && npm run build"
```

- [ ] **Step 3: Run typecheck to preserve the failing baseline**

Run:

```bash
npm --prefix guide run typecheck
```

Expected: four `offsetParent` errors in `absence.ts` and `tags.ts`.

- [ ] **Step 4: Narrow queried elements before reading `offsetParent`**

In `guide/scripts/scenes/absence.ts`, replace both conditions:

```typescript
if ((btn as HTMLElement).offsetParent !== null) {
```

In `guide/scripts/scenes/tags.ts`, replace both conditions:

```typescript
if (h.textContent?.includes('學習態度') && (h as HTMLElement).offsetParent !== null) {
```

```typescript
if (h.textContent?.includes('同儕互動') && (h as HTMLElement).offsetParent !== null) {
```

- [ ] **Step 5: Add the capture safety assertion**

In `guide/scripts/captureUtils.ts`, add:

```typescript
export async function assertSafeCaptureEnvironment(page: Page) {
  const environment = await page.evaluate(() => ({
    appEnvironment: document.documentElement.dataset.appEnvironment,
    firebaseEmulators: document.documentElement.dataset.firebaseEmulators,
  }));

  if (environment.appEnvironment !== 'development' || environment.firebaseEmulators !== 'true') {
    throw new Error(
      `Capture refused: expected development + Firebase emulators, received ${JSON.stringify(environment)}`,
    );
  }
}
```

In `login`, call it immediately after `page.goto` and before typing credentials:

```typescript
await assertSafeCaptureEnvironment(page);
```

This keeps capture compatible with the user's current extras work while making cleanup impossible against a page that reports remote Firebase.

- [ ] **Step 6: Run Guide verification**

Run:

```bash
npm --prefix guide run verify
```

Expected: TypeScript and Vite build both exit 0. Do not run `npm run capture`.

- [ ] **Step 7: Stage only the Guide safety/type files and commit in the Guide repository**

Run from `/Users/guin/Documents/MasterPaper/code`:

```bash
git add guide/package.json guide/scripts/scenes/absence.ts guide/scripts/scenes/tags.ts guide/scripts/captureUtils.ts
git diff --cached --name-only
git diff --cached --check
git commit -m "test: guard guide capture and enforce typecheck"
```

Expected: the commit contains exactly four files. Existing `capture.ts`, image, extras, and other untracked work remain outside the commit.

---

### Task 7: Generate an auditable release manifest

**Repository:** Main app repository

**Files:**
- Create: `scripts/releaseManifest.ts`
- Create: `scripts/generate-release-manifest.mjs`
- Create: `tests/scripts/releaseManifest.test.ts`
- Modify: `package.json`
- Modify: `hooks/useAppUpdate.ts`

**Interfaces:**
- Produces: `createReleaseManifest(input): ReleaseManifest`.
- Produces: `public/version.json` with existing `buildTime` compatibility plus component source identity.
- Functions and Rules are explicitly labeled `deployment: "external"`; the manifest does not claim they were deployed by Pages.

- [ ] **Step 1: Write the failing manifest tests**

Create `tests/scripts/releaseManifest.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createReleaseManifest } from '../../scripts/releaseManifest';

describe('createReleaseManifest', () => {
  const input = {
    appCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    guideCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    rulesHash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    builtAt: '2026-08-29T12:00:00Z',
  };

  it('creates a deterministic component manifest', () => {
    expect(createReleaseManifest(input)).toEqual({
      releaseId: 'aaaaaaaaaaaa-bbbbbbbbbbbb-20260829T120000Z',
      buildTime: '2026-08-29T12:00:00Z',
      schemaCompatibility: [1],
      components: {
        app: { commit: input.appCommit, deployedByThisRelease: true },
        guide: { commit: input.guideCommit, deployedByThisRelease: true },
        functions: { sourceCommit: input.appCommit, deployment: 'external' },
        rules: { sourceHash: input.rulesHash, deployment: 'external' },
      },
    });
  });

  it('rejects malformed commit identities', () => {
    expect(() => createReleaseManifest({ ...input, appCommit: 'main' })).toThrow('appCommit must be a 40-character Git SHA');
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run:

```bash
npm run test:run -- tests/scripts/releaseManifest.test.ts
```

Expected: FAIL because `scripts/releaseManifest.ts` does not exist.

- [ ] **Step 3: Implement the typed manifest generator**

Create `scripts/releaseManifest.ts`:

```typescript
export interface ReleaseManifestInput {
  appCommit: string;
  guideCommit: string;
  rulesHash: string;
  builtAt: string;
}

export interface ReleaseManifest {
  releaseId: string;
  buildTime: string;
  schemaCompatibility: number[];
  components: {
    app: { commit: string; deployedByThisRelease: true };
    guide: { commit: string; deployedByThisRelease: true };
    functions: { sourceCommit: string; deployment: 'external' };
    rules: { sourceHash: string; deployment: 'external' };
  };
}

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

export function createReleaseManifest(input: ReleaseManifestInput): ReleaseManifest {
  if (!SHA_PATTERN.test(input.appCommit)) throw new Error('appCommit must be a 40-character Git SHA');
  if (!SHA_PATTERN.test(input.guideCommit)) throw new Error('guideCommit must be a 40-character Git SHA');
  if (!HASH_PATTERN.test(input.rulesHash)) throw new Error('rulesHash must be a SHA-256 digest');
  if (Number.isNaN(Date.parse(input.builtAt))) throw new Error('builtAt must be ISO-8601');

  const compactTime = input.builtAt.replaceAll('-', '').replaceAll(':', '').replace('.000', '');
  return {
    releaseId: `${input.appCommit.slice(0, 12)}-${input.guideCommit.slice(0, 12)}-${compactTime}`,
    buildTime: input.builtAt,
    schemaCompatibility: [1],
    components: {
      app: { commit: input.appCommit, deployedByThisRelease: true },
      guide: { commit: input.guideCommit, deployedByThisRelease: true },
      functions: { sourceCommit: input.appCommit, deployment: 'external' },
      rules: { sourceHash: input.rulesHash, deployment: 'external' },
    },
  };
}
```

- [ ] **Step 4: Add the Node file writer**

Create `scripts/generate-release-manifest.mjs`:

```javascript
import { mkdir, writeFile } from 'node:fs/promises';
import { createReleaseManifest } from './releaseManifest.ts';

const manifest = createReleaseManifest({
  appCommit: process.env.APP_COMMIT ?? '',
  guideCommit: process.env.GUIDE_COMMIT ?? '',
  rulesHash: process.env.RULES_HASH ?? '',
  builtAt: process.env.BUILD_TIME ?? '',
});

await mkdir('public', { recursive: true });
await writeFile('public/version.json', `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
```

Because Node 20 cannot directly import TypeScript without a loader, add `tsx` as a dev dependency and run the writer through `tsx`:

```bash
npm install --save-dev tsx
```

Add to `package.json`:

```json
"release:manifest": "tsx scripts/generate-release-manifest.mjs"
```

- [ ] **Step 5: Keep update checking backward-compatible**

In `hooks/useAppUpdate.ts`, define the fetched shape as:

```typescript
interface VersionManifest {
  buildTime: string;
  releaseId?: string;
}
```

Cast the JSON response and continue comparing `buildTime`:

```typescript
const data = await res.json() as VersionManifest;
```

Do not require `releaseId` so old deployed files remain compatible.

- [ ] **Step 6: Run tests and a deterministic local generation**

Run:

```bash
npm run test:run -- tests/scripts/releaseManifest.test.ts
APP_COMMIT=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa GUIDE_COMMIT=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb RULES_HASH=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc BUILD_TIME=2026-08-29T12:00:00Z npm run release:manifest
node -e "const m=require('./public/version.json'); if(m.releaseId!=='aaaaaaaaaaaa-bbbbbbbbbbbb-20260829T120000Z') process.exit(1)"
```

Expected: tests pass and the generated release ID matches exactly. Restore `public/version.json` to its pre-task state if it was tracked; the generated local file is build output, not part of the commit.

- [ ] **Step 7: Commit the release-manifest implementation**

Run:

```bash
git add scripts/releaseManifest.ts scripts/generate-release-manifest.mjs tests/scripts/releaseManifest.test.ts hooks/useAppUpdate.ts package.json package-lock.json
git diff --cached --check
git commit -m "build: generate auditable release manifest"
```

---

### Task 8: Make CI verify all components and pin the Guide revision

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `README.md`

**External configuration:**
- GitHub repository variable `GUIDE_REF` in `GuinnGreen/AI_ClassMate`, set to the exact committed Guide SHA from Task 6.

**Interfaces:**
- Consumes: `npm run verify`, `npm run test:rules`, `npm --prefix functions run verify`, Guide `npm run verify`, and `npm run release:manifest`.
- Produces: a Pages artifact whose `version.json` identifies exact app and Guide commits and source identities for externally deployed Functions/Rules.

- [ ] **Step 1: Record the exact Guide commit and configure the repository variable**

Run from the Guide repository:

```bash
GUIDE_SHA=$(git rev-parse HEAD)
test $(printf '%s' "$GUIDE_SHA" | wc -c | tr -d ' ') -eq 40
gh variable set GUIDE_REF --repo GuinnGreen/AI_ClassMate --body "$GUIDE_SHA"
gh variable get GUIDE_REF --repo GuinnGreen/AI_ClassMate
```

Expected: the final command prints the same 40-character SHA. This is external configuration only; it does not deploy the website.

- [ ] **Step 2: Add a CI verify job**

In `.github/workflows/deploy.yml`, add a `verify` job before `build` that:

```yaml
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout main app
        uses: actions/checkout@v4

      - name: Require pinned guide revision
        env:
          GUIDE_REF: ${{ vars.GUIDE_REF }}
        run: test -n "$GUIDE_REF"

      - name: Checkout pinned guide site
        uses: actions/checkout@v4
        with:
          repository: GuinnGreen/AI_ClassMate_guide
          ref: ${{ vars.GUIDE_REF }}
          path: _guide_repo

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install main app dependencies
        run: npm ci

      - name: Verify main app
        run: npm run verify

      - name: Verify Firestore Rules
        run: npm run test:rules

      - name: Install and verify Functions
        run: npm ci --prefix functions && npm --prefix functions run verify

      - name: Install and verify Guide
        working-directory: _guide_repo/guide
        run: npm ci && npm run verify

      - name: Install Chromium
        run: npx playwright install --with-deps chromium

      - name: Run browser smoke tests
        run: npm run test:e2e
```

- [ ] **Step 3: Make deployment depend on verification and use the same pinned Guide ref**

Add `needs: verify` to the existing `build` job. Update its Guide checkout to:

```yaml
      - name: Checkout pinned guide site
        uses: actions/checkout@v4
        with:
          repository: GuinnGreen/AI_ClassMate_guide
          ref: ${{ vars.GUIDE_REF }}
          path: _guide_repo
```

- [ ] **Step 4: Replace the old version writer with the release manifest**

Replace the existing `Write version file` step with:

```yaml
      - name: Write release manifest
        run: |
          BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
          GUIDE_COMMIT=$(git -C _guide_repo rev-parse HEAD)
          RULES_HASH=$(sha256sum firestore.rules | cut -d' ' -f1)
          APP_COMMIT="$GITHUB_SHA" GUIDE_COMMIT="$GUIDE_COMMIT" RULES_HASH="$RULES_HASH" BUILD_TIME="$BUILD_TIME" npm run release:manifest
          echo "BUILD_TIME=$BUILD_TIME" >> "$GITHUB_ENV"
```

- [ ] **Step 5: Remove stale frontend LLM secrets**

From the `Build main app` environment block, remove only:

```yaml
GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
```

Keep all `VITE_FIREBASE_*` values and `VITE_APP_BUILD_TIME`. Add:

```yaml
VITE_APP_ENV: production
VITE_USE_FIREBASE_EMULATORS: 'false'
VITE_ALLOW_REMOTE_FIREBASE: 'true'
```

- [ ] **Step 6: Document what this workflow does not deploy**

Add to `README.md`:

```markdown
### Release identity

`public/version.json` records the exact app and Guide revisions used by the Pages artifact. Cloud Functions and Firestore Rules are labeled `external` because this Pages workflow does not deploy them. A release manifest is evidence of source identity, not proof of live Firebase deployment parity.

The `GUIDE_REF` GitHub repository variable must contain a reviewed 40-character commit SHA from `GuinnGreen/AI_ClassMate_guide`.
```

- [ ] **Step 7: Run all local gates before committing CI**

Run:

```bash
npm run verify
npm run test:rules
npm --prefix functions run verify
npm run test:e2e
```

Then from the Guide repository:

```bash
npm --prefix guide run verify
```

Expected: every command exits 0. No production deployment or capture occurs.

- [ ] **Step 8: Review workflow syntax and commit**

Run from the main app repository:

```bash
git diff --check -- .github/workflows/deploy.yml README.md
git add .github/workflows/deploy.yml README.md
git diff --cached --check
git commit -m "ci: gate releases on app functions rules and guide checks"
```

Expected: only workflow and documentation files are committed. Do not push.

---

### Task 9: Final Workstream A verification and evidence handoff

**Files:**
- Create: `docs/verification/2026-08-29-workstream-a-foundation.md`

**Interfaces:**
- Consumes: outputs and commits from Tasks 1–8.
- Produces: a concise, non-sensitive verification record and the exact starting point for Workstream B planning.

- [ ] **Step 1: Verify both repositories are understood before final checks**

Run in the main app repository:

```bash
git status --short
git log --oneline -10
```

Run in the Guide repository:

```bash
git status --short
git log --oneline -5
```

Expected: only pre-existing user-owned Guide work remains dirty. The main app should be clean unless a generated ignored artifact exists.

- [ ] **Step 2: Run the complete local verification matrix**

Run:

```bash
npm run verify
npm run test:rules
npm --prefix functions run verify
npm run test:e2e
```

Run in the Guide repository:

```bash
npm --prefix guide run verify
```

Expected: all commands exit 0.

- [ ] **Step 3: Write the verification record**

Create `docs/verification/2026-08-29-workstream-a-foundation.md` with:

```markdown
# Workstream A Foundation Verification

## Scope

- Preserved and committed the pre-existing five-file application patch.
- Added guarded runtime environments and Firebase Emulator wiring.
- Added app, Firestore Rules, Functions, browser, and Guide verification gates.
- Added an auditable Pages release manifest.
- Did not migrate, rewrite, delete, seed, or deploy production teacher data.

## Commands

- `npm run verify`
- `npm run test:rules`
- `npm --prefix functions run verify`
- `npm run test:e2e`
- `npm --prefix guide run verify`

## Safety Boundary

- Emulator project: `demo-classmate-ai`
- Production migration performed: no
- Production deployment performed: no
- Guide capture performed: no
- Legacy teacher data changed: no

## Deferred to Workstream B

- Server-only quota and audit Rules
- Teacher claims and App Check enforcement
- Recent-auth callable framework
- Soft delete and archive state machine
```

Append actual command pass counts and the exact main/Guide commit SHAs after running the commands. Do not include Firebase credentials, student names, prompt content, notes, screenshots of teacher data, or `.env.local` values.

- [ ] **Step 4: Commit the verification evidence**

Run:

```bash
git add docs/verification/2026-08-29-workstream-a-foundation.md
git diff --cached --check
git commit -m "docs: record workstream A verification"
```

- [ ] **Step 5: Stop before Workstream B**

Report the verification matrix, commit list, remaining dirty files, and any external GitHub variable change. Do not start Workstream B until its dedicated implementation plan is written and approved.

---

## Plan Self-Review Checklist

- Workstream A only: no schema v2, production migration, production Rules deployment, claims mutation, App Check enforcement, or teacher-data rewrite.
- Current five-file patch receives a separate checkpoint commit before new work.
- Main app, Functions, Rules, browser, and Guide each gain an executable verification command.
- Guide capture safety relies on two independent markers: development environment and emulator connection.
- The Guide repository's pre-existing dirty work is preserved and excluded from task commits.
- Release identity distinguishes source identity from actual Functions/Rules deployment.
- Every created interface is defined before later tasks consume it.
- Every implementation task has a failing or characterization test, an explicit command, expected result, and isolated commit.
- No placeholder values are required at execution time; the Guide SHA is obtained from the exact Task 6 commit and stored as a GitHub repository variable.
