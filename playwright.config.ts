import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3000' },
  webServer: [
    {
      command: 'npm run start --workspace api',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      // The e2e run is deterministic: no real AI call, and only the local web origin may call the API.
      env: { GROQ_API_KEY: '', CORS_ORIGINS: 'http://localhost:3000' },
    },
    {
      command: 'npm run start --workspace web',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { NEXT_PUBLIC_API_URL: 'http://localhost:3001' },
    },
  ],
});
