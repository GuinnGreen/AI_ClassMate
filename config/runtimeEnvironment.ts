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
