# Browser test backend

`supabase.mjs` is a loopback-only HTTP fixture for Playwright. The real SvelteKit server, SSR authentication hooks, form actions, cookies, route permissions, encryption, and browser UI run unchanged against this local endpoint. No production demo login, test token bypass, or fixture import is added to application code.

The fixture models just enough Supabase Auth and PostgREST behavior to exercise integration flows deterministically. It is **not** a substitute for Supabase or an RLS proof. `npm run test:db` separately applies and tests the actual SQL migration in PostgreSQL/PGlite.

Accounts use `parent@example.test`, `teacher@example.test`, and `root_admin@example.test`, with the synthetic password `LocalOnlyPassword123!`. The publishable/service values and signing/encryption material are deliberately local dummy values, never real credentials. The fixture's reset/state endpoints exist only in this script, bound to `127.0.0.1`; the application has no such endpoints.

Tests do not contact OpenAI, OpenRouter, hosted Supabase or Vercel. Provider configuration tests save only a made-up string and verify that the actual server encryption path stores an envelope and does not return the input key. Generative calls are tested separately with mocked transport.

Run `npm run test:e2e`. Playwright starts the fixture on port 54329 and the application on port 4173, then closes both. In environments with an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; normal CI can install Chromium using Playwright.

`npm run test:e2e -- http.spec.ts` runs the five browser-independent integration scenarios through the real server using Playwright's HTTP client. These cover session cookies, family/lesson actions, teacher publishing, encrypted settings, permission checks, cross-origin rejection, redirect validation and logout. They do not verify rendering or client-side interactions.

`portal.spec.ts` runs five browser scenarios, including the family journey at desktop and mobile widths. Successful critical screens are attached to the Playwright report and saved as `ui/*.png` within each test's output directory under `test-results`. Screenshots of provider settings are captured only after the dummy key field has been cleared.
