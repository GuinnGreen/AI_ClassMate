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
