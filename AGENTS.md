# Laimīgie bērni — contributor instructions

## Product boundaries

- Family education portal for ages 4–6, 7–9 and 10–12. Adults authenticate; children have pseudonymous heroes owned by their family.
- Latvian is the default UI language. Keep complete LV/RU/EN dictionary parity. Content language is independent of UI language.
- Child-facing routes use a consistent illustrated game world; family, staff and administration use clear conventional interfaces.
- Keep unavailable features honest. Do not simulate live video, payments, multiplayer, or published materials in production.

## Repository conventions

- SvelteKit 3 + Svelte 5 runes + TypeScript; configuration lives in `vite.config.ts`.
- Server code belongs under `src/lib/server` or route server files. Use `#lib` imports.
- Explicit environment declarations live in `src/env.ts`. No browser import of private credentials or service clients.
- Authorize every server load, action and endpoint. A layout check is not an authorization boundary.
- Use the request-scoped Supabase client for family and curriculum operations so RLS applies.
- Reserve the service client for documented, restricted administrative or AI tasks. Do not return service query payloads wholesale.
- Roles live in `user_roles`, never client-editable signup metadata. Root bootstrap is an explicit out-of-band operation.
- AI provider keys are encrypted server-side. Never return, log, seed, commit or send them to the browser after saving.
- No generated curriculum is published automatically. Adults review AI output.
- Add migrations rather than editing migrations once they have been applied to a shared project.

## Verification

- `npm run verify` runs type checks, lint, unit/security tests, SQL policy tests and the Vercel build.
- `npm run test:e2e` runs real UI flows against local test-only Supabase fixtures. These do not replace hosted integration testing.
- Record live configuration and verification gaps honestly; don't claim a hosted deployment or migration without evidence.
- Work on the branch requested by the user. Never force-push over unrelated changes. Keep secrets and generated build artifacts out of Git.
