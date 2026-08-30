import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/firestore/**', 'tests/e2e/**'],
    restoreMocks: true,
    env: {
      VITE_APP_ENV: 'development',
      VITE_USE_FIREBASE_EMULATORS: 'true',
      VITE_ALLOW_REMOTE_FIREBASE: 'false',
      VITE_FIREBASE_PROJECT_ID: 'demo-classmate-ai',
    },
  },
});
