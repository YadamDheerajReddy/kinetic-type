import { type FirebaseApp, getApps, initializeApp } from 'firebase/app'
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth'
import { type Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { getFirebaseConfig } from './firebaseConfig'

/**
 * Firebase Cloud Tier (TRD §01, §05) — provisioned in Phase 0, wired up here so the SDK
 * is ready to use, but NOT invoked anywhere in the app yet. Anonymous sign-in and the
 * Firestore sync engine are Phase 4 work (Implementation Plan §06); this module only
 * needs to exist and initialize without throwing for Phase 0's purposes.
 *
 * Tiers 01-03 (UI, worker, local IndexedDB) are fully functional with zero network
 * access — this tier activates only after explicit opt-in sign-in and must never sit
 * on the typing-critical path.
 */
export const firebaseApp: FirebaseApp = getApps()[0] ?? initializeApp(getFirebaseConfig())
export const auth: Auth = getAuth(firebaseApp)
export const db: Firestore = getFirestore(firebaseApp)

// Local dev talks to the Firebase Emulator Suite, never the real project (TRD §11
// Environments: "Local" row). Start emulators with `npm run firebase:emulators` and set
// VITE_USE_FIREBASE_EMULATORS=true in .env.local to opt in.
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
