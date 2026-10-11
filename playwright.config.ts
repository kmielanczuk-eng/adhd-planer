import { defineConfig, devices } from '@playwright/test'

const executablePath = process.env.PW_CHROMIUM ?? (process.env.CI ? undefined : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome')

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173/adhd-planer/',
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: executablePath ? { executablePath } : {} } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 860 }, launchOptions: executablePath ? { executablePath } : {} } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/adhd-planer/',
    reuseExistingServer: true,
  },
})
