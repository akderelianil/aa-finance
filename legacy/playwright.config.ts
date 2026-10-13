// E2E smoke path in a plain browser against the Vite dev server and a throwaway SQLite file (the dev bridge).
// Run: npm run e2e. Needs a Chromium: `npx playwright install chromium`, or point E2E_CHROMIUM at one.
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

const PORT = 5198
const dbFile = join(tmpdir(), `aa-finance-e2e-${process.pid}.sqlite`)
for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) rmSync(f, { force: true })

export default defineConfig({
  testDir: 'evals/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    trace: 'retain-on-failure',
    launchOptions: process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM, args: ['--no-sandbox'] } : {},
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    env: { AA_DEV_DB: dbFile },
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
