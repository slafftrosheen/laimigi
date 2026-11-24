# Database foundation

The migration in `supabase/migrations/202611240001_foundation.sql` is the source of truth. It targets a Supabase PostgreSQL project. Supabase Auth owns adult identities; children have pseudonymous learning profiles inside their parent's family. No child account, email address, date of birth, school, medical record, or diagnosis is required.

## Applying it to the online development project

Select the intended **development** project in the Supabase dashboard. Either apply the migration file in that project's SQL editor, or link the CLI to the project and review the pending migration before pushing:

```bash
npx supabase login
npx supabase link --project-ref YOUR_DEVELOPMENT_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

The checked-in `supabase/config.toml` describes an optional local Supabase instance; it does not create, configure, or deploy an online project. Configure the online project's Auth Site URL and allowed callbacks for the actual Vercel deployment separately. Do not apply this initial migration over unrelated existing tables with the same names.

The migration automatically creates a parent role, adult profile, and owned family for new accounts. Existing Auth accounts are backfilled as parents. Signup metadata never determines a role. Both AI providers start disabled with no model and no credential.

## Tables and boundaries

| Table                         | Important fields                                                                                         | Browser access                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `public.profiles`             | `id` = adult Auth ID, `display_name`, `locale`                                                           | Owner reads own profile and changes only name/locale.                                                            |
| `public.user_roles`           | `user_id`, `role`                                                                                        | Read own role; root may read all roles. Changes use the protected RPC.                                           |
| `public.families`             | `id`, unique `owner_id`, optional `name`                                                                 | Owner reads and renames their family. Ownership is immutable to clients.                                         |
| `public.child_profiles`       | `id`, `family_id`, `nickname`, `age_band`, `avatar`, `locale`                                            | Owner creates, reads, updates and deletes their own heroes. Family assignment cannot be changed.                 |
| `public.lessons`              | `id`, `author_id`, `title`, `description`, plain-text `body`, `locale`, `age_band`, `location`, `status` | Parents read published records. Teachers manage their own records. Admin/root can manage all curriculum records. |
| `public.lesson_progress`      | composite key `child_profile_id` + `lesson_id`, `status`, `last_step`, `completed_at`, `updated_at`      | Family reads own progress; completion is written through a checked RPC.                                          |
| `public.ai_provider_settings` | `provider`, `model`, `enabled`, `max_output_tokens`, `daily_request_limit`, `key_hint`, timestamps       | Root reads safe metadata; writes use the root-only RPC. Server can read settings.                                |
| `private.ai_provider_secrets` | `provider`, `ciphertext`, `updated_at`                                                                   | No browser access. Server obtains ciphertext through one service-only RPC.                                       |
| `private.ai_usage`            | request UUID, adult actor ID, provider, status, timestamps                                               | No browser access. No prompts, completions, child data or API keys are logged.                                   |
| `private.audit_log`           | actor, action, subject, safe change metadata, timestamp                                                  | No browser access. Application callers cannot update or delete the log.                                          |

Roles are `parent`, `teacher`, `admin`, and `root_admin`. Every adult may own a family, including a teacher. A staff role does **not** grant blanket access to other families or children. The runtime service credential bypasses RLS, so ordinary profile, family and lesson queries must use the request's signed-in Supabase client instead.

### Value contracts

- Locales: `lv`, `ru`, `en`. Latvian is the initial default.
- Age bands: `4-6`, `7-9`, `10-12`.
- Avatar IDs: `leaf`, `compass`, `crystal`.
- World locations: `school`, `observatory`, `workshop`, `library`, `garden`, `tree`.
- Lesson status: `draft` or `published`. Each lesson row is one language version. Translation grouping and editorial translation workflows are future work.
- Lesson `body` is text. Never render it as trusted HTML.
- Provider IDs: `openrouter`, `openai`. Model ID is chosen by root admin.
- AI output limit: 64–4096 tokens; provider daily request cap: 1–10000.

## Server and RPC contract

All functions have an empty fixed `search_path`. `PUBLIC` execution rights are revoked explicitly. Functions exposed to ordinary authenticated users check the user's database role or family ownership; service-only functions require the service database role at the SQL permission boundary.

| Function                                                     | Caller              | Return                          |
| ------------------------------------------------------------ | ------------------- | ------------------------------- |
| `current_app_role()`                                         | Authenticated user  | `text` or `NULL`                |
| `is_staff()` / `is_root_admin()`                             | Authenticated user  | `boolean`                       |
| `configure_ai_provider(...)`                                 | Signed-in root      | Safe `ai_provider_settings` row |
| `get_ai_provider_secret(p_provider text)`                    | Service role only   | Ciphertext `text` or `NULL`     |
| `reserve_ai_request(p_user_id uuid, p_provider text)`        | Service role only   | Request `uuid`                  |
| `finish_ai_request(p_request_id uuid, p_status text)`        | Service role only   | `void`                          |
| `set_user_role(p_user_id uuid, p_role text)`                 | Signed-in root      | `void`                          |
| `bootstrap_root_admin(p_email text)`                         | Service role only   | Selected adult `uuid`           |
| `complete_lesson(p_child_profile_id uuid, p_lesson_id uuid)` | Hero's family owner | `lesson_progress` row           |

The provider configuration argument names are:

```text
p_provider text
p_model text
p_enabled boolean
p_max_output_tokens integer
p_daily_request_limit integer
p_ciphertext text = NULL
p_key_hint text = NULL
p_remove_key boolean = false
```

Send `NULL` ciphertext to preserve the current key. For a replacement, the server first encrypts the key and supplies the ciphertext plus exactly its final four characters as `p_key_hint`. Never send the plaintext key to this RPC. Removal deletes the secret and clears the hint; the provider must be disabled in the same call. Mutations return only safe metadata. Enabling a provider without an existing credential fails atomically.

`reserve_ai_request` verifies that its actor is currently a teacher, admin or root; that the provider is enabled with a stored key; and that quotas permit the call. A transaction-scoped advisory lock serializes admission for that provider. The provider's daily cap is global across staff, with UTC day boundaries. A second limit permits five requests per adult/provider in a rolling minute. Reserved and failed requests count toward both limits to prevent repeated retries from evading the cap. This is a request limit, not a monetary spending cap; configure spending controls with the providers too.

`finish_ai_request` accepts only `succeeded` or `failed` and updates only a reserved row. Repeated finalization cannot overwrite an existing terminal status. The application can leave a reservation unfinished after a process interruption; it still counts toward the limit.

AI reservation/configuration errors use `42501` for denied privilege, `22023` for invalid/unavailable configuration, and `P0001` for exceeded quotas. The application should map these to localized generic messages and must not expose raw upstream or credential-related errors.

`complete_lesson` verifies family ownership, publication, and the hero's age band. It stores one completion per hero/lesson and preserves the first completion timestamp across repeated calls. There is no mutable XP balance or public score leaderboard in this foundation. Completion expresses the family's acknowledgment; it is not proof of an assessed learning outcome.

## First root administrator

1. Apply the migration.
2. Register the intended adult in the app and verify their email.
3. Supply the project's URL and server credential in an ignored local environment file. Use `PUBLIC_SUPABASE_URL` plus `SUPABASE_SECRET_KEY` or the legacy `SUPABASE_SERVICE_ROLE_KEY`.
4. Run the explicit bootstrap command:

```bash
node --env-file=.env.local scripts/bootstrap-root-admin.mjs --email your-verified-adult@example.com
```

The script never creates an Auth account, chooses the first registrant, generates a password, or displays a credential. It promotes only the supplied verified account. Repeating the command for the same root is harmless; creating another root through bootstrap is rejected. Further role changes use `set_user_role` from an existing root session. The last root cannot be demoted through this RPC.

The bootstrap function is intentionally service-only. A deployment credential can always exercise broad administrative power; keep it out of client bundles and user-editable settings.

## Verification and limits

```bash
npm run test:db
```

`scripts/db-test.mjs` runs the actual SQL migration in PGlite (PostgreSQL compiled to WebAssembly), with minimal stubs for `auth.users`, `auth.uid()`, and Supabase's database roles. It exercises grants, row-level isolation, role bootstrap/escalation checks, age-scoped completion, provider secrets, quotas, disabling/removal, and sanitized audit records. It does not substitute for checking Supabase Auth configuration, PostgREST, email delivery, or simultaneous requests against the linked hosted project.

This foundation deliberately has no real family seed data and no embedded credentials. Scheduling/enrollment, video rooms, payment entitlements, media storage policies, deletion/retention workflows, child-mode adult reauthentication, and assessed achievement awards still need their own implementation before a production launch.
