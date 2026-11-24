import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const executablePath =
	process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
	(existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	workers: 1,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	use: {
		baseURL: 'http://127.0.0.1:4173',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		launchOptions: { executablePath }
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command: 'node tests/fixtures/supabase.mjs',
			url: 'http://127.0.0.1:54329/health',
			reuseExistingServer: false
		},
		{
			command: 'npm run dev -- --host 127.0.0.1 --port 4173',
			url: 'http://127.0.0.1:4173/health',
			reuseExistingServer: false,
			env: {
				PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
				PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable',
				SUPABASE_SECRET_KEY: 'test-service',
				AI_SETTINGS_ENCRYPTION_KEY: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='
			}
		}
	]
});
