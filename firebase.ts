import { app } from "./firebaseAuth";
export { auth } from "./firebaseAuth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { runtimeEnvironment } from './config/runtimeEnvironment';

export const db = getFirestore(app);
// LLM 呼叫透過此 functions instance 走後端 proxy
export const functions = getFunctions(app, "asia-east1");

const emulatorMarker = globalThis as typeof globalThis & {
  __CLASSMATE_EMULATORS_CONNECTED__?: boolean;
};

if (runtimeEnvironment.useFirebaseEmulators && !emulatorMarker.__CLASSMATE_EMULATORS_CONNECTED__) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  emulatorMarker.__CLASSMATE_EMULATORS_CONNECTED__ = true;
}
