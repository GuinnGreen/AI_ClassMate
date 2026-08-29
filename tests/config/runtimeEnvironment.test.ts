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
