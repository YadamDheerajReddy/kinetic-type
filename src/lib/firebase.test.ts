import { beforeAll, describe, expect, it, vi } from 'vitest'

describe('getFirebaseConfig', () => {
  beforeAll(() => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'kinetic-type-test.firebaseapp.com')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'kinetic-type-test')
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'kinetic-type-test.firebasestorage.app')
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '000000000000')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:000000000000:web:0000000000000000000000')
  })

  it('maps env vars to a Firebase config object', async () => {
    const { getFirebaseConfig } = await import('./firebaseConfig')

    expect(getFirebaseConfig()).toEqual({
      apiKey: 'test-api-key',
      authDomain: 'kinetic-type-test.firebaseapp.com',
      projectId: 'kinetic-type-test',
      storageBucket: 'kinetic-type-test.firebasestorage.app',
      messagingSenderId: '000000000000',
      appId: '1:000000000000:web:0000000000000000000000',
    })
  })
})
