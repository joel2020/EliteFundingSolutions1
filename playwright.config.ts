import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'on-first-retry' },
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER ? undefined : {
    command: 'npm run start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      E2E_AUTH_BYPASS: '1',
      NEXT_PUBLIC_SUPABASE_URL: 'https://mdrrcrmowurbrwvdsgnq.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'missing-anon-key-for-build',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
