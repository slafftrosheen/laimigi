# Laimīgie bērni

A multilingual family learning portal for the Daugavpils centre: one adult account, several child heroes, a shared learning world, and a separate workspace for educators.

**Foundation release 0.1.0.** This repository contains a working SvelteKit application and its Supabase migrations. It does not create a hosted Supabase project or a Vercel deployment merely by being cloned.

## Stack

- **SvelteKit 3 / Svelte 5 / TypeScript** for the application, server-rendered pages and protected actions.
- **Supabase** for adult authentication, PostgreSQL, family data, role enforcement and row-level security.
- **Vercel** Node.js 24 runtime through the official SvelteKit adapter.
- **OpenRouter and OpenAI API** server integrations, configured by root admin inside the application.
- **Vitest, PGlite and Playwright** for security, SQL policy and browser checks.

## What works in this base

| Area              | Included                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| Public UI         | Responsive landing page, accessible illustrated map, LV/RU/EN language switching; Latvian default.                    |
| Adult access      | Email/password signup, login/logout, email confirmation callbacks, password recovery.                                 |
| Families          | Separate heroes with nicknames, age leagues, emblems and learning languages.                                          |
| Learning          | Published-material library, independent content filters, hero-specific world, lesson completion saved per hero.       |
| Educators         | Draft creation, editing and publishing; teachers manage their own lessons.                                            |
| Roles             | Parent, teacher, admin and root admin; explicit first-root bootstrap; root-only role changes.                         |
| AI administration | Add/replace/remove encrypted provider keys, select models, enable/disable, token/request limits and connection tests. |
| Staff AI          | Text draft generation through a chosen enabled provider; output remains a draft for human review.                     |
| Engineering       | Versioned SQL migration, local configuration, CI, lockfile, deployment guide and documented boundaries.               |

Live classrooms, video storage, subscriptions/payments, mini-games, XP economy, invitations, translations of lesson content, and child-mode reauthentication are **not implemented** in this release. Nothing charges a family or automatically publishes generated content.

## Local development

Use Node.js 24 and npm:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The public UI works with an empty environment. Authentication and private routes stay unavailable until Supabase is configured. There is no demo login or production authorization bypass.

To enable the data-backed app, follow [deployment setup](docs/deployment.md). All cloud account identifiers, credentials and model choices belong to your own deployment.

## Checks

```bash
npm run verify
npx playwright install chromium
npm run test:e2e
```

`verify` runs TypeScript/Svelte checks, formatting/lint, server unit tests, PostgreSQL policy tests and the production Vercel build. The SQL suite executes the actual migration in PGlite with minimal Supabase Auth stubs. Browser tests use a separate test-only HTTP service; they do not contact real AI or Supabase accounts.

## Documentation

- [Deployment and first root admin](docs/deployment.md)
- [Database schema, RLS and RPCs](docs/database.md)
- [Application flows and architecture](docs/architecture.md)
- [Security boundaries and remaining work](SECURITY.md)

## AI credential handling

After signing in as root admin, open `/admin/ai`. Enter an OpenRouter or OpenAI API key, choose a model ID available to that key, save, and run the connection test. A connection test makes a small billable provider request and counts toward the configured request limit.

The setting is an **OpenAI API credential**, not a ChatGPT website session token. No browser session token or subscription-login mechanism is accepted here. Credentials are encrypted with AES-256-GCM and stored outside the exposed database schema. They are not returned to clients. The server's encryption master key and Supabase service credential stay in deployment environment settings.
