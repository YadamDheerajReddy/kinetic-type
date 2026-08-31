import type { FirebaseOptions } from 'firebase/app'

/**
 * Pure env-var -> Firebase config mapping, split out from firebase.ts so it's testable
 * without importing 'firebase/auth' / 'firebase/firestore' — those packages perform
 * environment detection (IndexedDB probing, etc.) on import that hangs under jsdom.
 * Real SDK behavior is verified manually in-browser and, from Phase 4, against the
 * Firebase Emulator Suite (TRD §10 Testing Strategy).
 */
export function getFirebaseConfig(): FirebaseOptions {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
}
