import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebase = vi.hoisted(() => ({
  app: {},
  auth: {},
  db: {},
  functions: {},
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
  getFirestore: vi.fn(),
  getFunctions: vi.fn(),
  connectAuthEmulator: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
  connectFunctionsEmulator: vi.fn(),
  runtimeEnvironment: {
    name: 'development' as const,
    useFirebaseEmulators: true,
    allowRemoteFirebase: false,
    isProduction: false,
  },
}));

vi.mock('firebase/app', () => ({ initializeApp: firebase.initializeApp }));
vi.mock('firebase/auth', () => ({
  getAuth: firebase.getAuth,
  connectAuthEmulator: firebase.connectAuthEmulator,
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: firebase.getFirestore,
  connectFirestoreEmulator: firebase.connectFirestoreEmulator,
}));
vi.mock('firebase/functions', () => ({
  getFunctions: firebase.getFunctions,
  connectFunctionsEmulator: firebase.connectFunctionsEmulator,
}));
vi.mock('../config/runtimeEnvironment', () => ({ runtimeEnvironment: firebase.runtimeEnvironment }));

async function loadFirebase() {
  await import('../firebase');
}

describe('Firebase runtime connections', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    firebase.initializeApp.mockReturnValue(firebase.app);
    firebase.getAuth.mockReturnValue(firebase.auth);
    firebase.getFirestore.mockReturnValue(firebase.db);
    firebase.getFunctions.mockReturnValue(firebase.functions);
    Object.assign(firebase.runtimeEnvironment, {
      name: 'development',
      useFirebaseEmulators: true,
      allowRemoteFirebase: false,
      isProduction: false,
    });
    delete (globalThis as typeof globalThis & {
      __CLASSMATE_EMULATORS_CONNECTED__?: boolean;
    }).__CLASSMATE_EMULATORS_CONNECTED__;
  });

  it('connects every Firebase SDK to localhost emulators only once', async () => {
    await loadFirebase();
    await loadFirebase();

    expect(firebase.connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(firebase.connectAuthEmulator).toHaveBeenCalledWith(firebase.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    expect(firebase.connectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(firebase.connectFirestoreEmulator).toHaveBeenCalledWith(firebase.db, '127.0.0.1', 8080);
    expect(firebase.connectFunctionsEmulator).toHaveBeenCalledTimes(1);
    expect(firebase.connectFunctionsEmulator).toHaveBeenCalledWith(firebase.functions, '127.0.0.1', 5001);
  });

  it('leaves Firebase SDKs remote when the policy disallows emulators', async () => {
    Object.assign(firebase.runtimeEnvironment, {
      name: 'production',
      useFirebaseEmulators: false,
      allowRemoteFirebase: true,
      isProduction: true,
    });

    await loadFirebase();

    expect(firebase.connectAuthEmulator).not.toHaveBeenCalled();
    expect(firebase.connectFirestoreEmulator).not.toHaveBeenCalled();
    expect(firebase.connectFunctionsEmulator).not.toHaveBeenCalled();
  });
});
