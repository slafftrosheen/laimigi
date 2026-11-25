# Database and learning contracts

The versioned SQL files in `supabase/migrations` are the source of truth. They target a Supabase PostgreSQL project and must be applied in filename order. `202611240001_foundation.sql` establishes accounts, curriculum and AI configuration; `202611250001_learning_journey.sql` adds interactive blocks, revision-bound progress and one-time rewards; `202611250002_child_mode.sql` restricts signed Auth sessions to a selected hero. Supabase Auth owns adult identities; children have pseudonymous learning profiles inside their parent's family. No child account, email address, date of birth, school, medical record, or diagnosis is required.

## Applying it to the online development project

Select the intended **development** project in the Supabase dashboard. Either apply the unapplied migration files in order in that project's SQL editor, or link the CLI to the project and review the pending migrations before pushing:

```bash
npx supabase login
npx supabase link --project-ref YOUR_DEVELOPMENT_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

The checked-in `supabase/config.toml` describes an optional local Supabase instance; it does not create, configure, or deploy an online project. Configure the online project's Auth Site URL and allowed callbacks for the actual Vercel deployment separately. Do not apply this initial migration over unrelated existing tables with the same names.

The foundation automatically creates a parent role, adult profile, and owned family for new accounts. Existing Auth accounts are backfilled as parents. Signup metadata never determines a role. Both AI providers start disabled with no model and no credential. Later migrations preserve existing lessons and completions; do not reapply or modify an already applied migration.

## Tables and boundaries

| Table                          | Important fields                                                                                                                                | Browser access                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.profiles`              | `id` = adult Auth ID, `display_name`, `locale`                                                                                                  | Owner reads own profile and changes only name/locale.                                                                                                       |
| `public.user_roles`            | `user_id`, `role`                                                                                                                               | Read own role; root may read all roles. Changes use the protected RPC.                                                                                      |
| `public.families`              | `id`, unique `owner_id`, optional `name`                                                                                                        | Owner reads and renames their family. Ownership is immutable to clients.                                                                                    |
| `public.child_profiles`        | `id`, `family_id`, `nickname`, `age_band`, `avatar`, `locale`                                                                                   | Owner creates, reads, updates and deletes their own heroes. Family assignment cannot be changed.                                                            |
| `public.lessons`               | `id`, `author_id`, `title`, `description`, plain-text `body`, `locale`, `age_band`, `location`, `status`, sanitized `blocks`, `content_version` | Families read published records. Teachers manage their own records; admin/root can manage all curriculum. Versioned content is saved through a checked RPC. |
| `public.lesson_progress`       | composite key `child_profile_id` + `lesson_id`, `status`, `last_step`, `content_version`, `completed_at`, `updated_at`                          | Family reads own progress; RPCs write the current attempt and completion.                                                                                   |
| `public.lesson_block_progress` | composite key `child_profile_id` + `lesson_id` + `content_version` + `block_id`, `completed_at`                                                 | Family reads own confirmations. No browser inserts, updates or deletes.                                                                                     |
| `public.hero_rewards`          | composite key `child_profile_id` + `lesson_id`, `location`, `xp` = 25, `earned_at`                                                              | Family reads own immutable rewards. No browser writes.                                                                                                      |
| `private.lesson_answer_keys`   | composite key `lesson_id` + `block_id`, `correct_option_id`                                                                                     | No direct browser or service access. Author/admin editor RPC returns permitted authored blocks.                                                             |
| `public.ai_provider_settings`  | `provider`, `model`, `enabled`, `max_output_tokens`, `daily_request_limit`, `key_hint`, timestamps                                              | Root reads safe metadata; writes use the root-only RPC. Server can read settings.                                                                           |
| `private.ai_provider_secrets`  | `provider`, `ciphertext`, `updated_at`                                                                                                          | No browser access. Server obtains ciphertext through one service-only RPC.                                                                                  |
| `private.ai_usage`             | request UUID, adult actor ID, provider, status, timestamps                                                                                      | No browser access. No prompts, completions, child data or API keys are logged.                                                                              |
| `private.audit_log`            | actor, action, subject, safe change metadata, timestamp                                                                                         | No browser access. Application callers cannot update or delete the log.                                                                                     |

Roles are `parent`, `teacher`, `admin`, and `root_admin`. Every adult may own a family, including a teacher. A staff role does **not** grant blanket access to other families or children. The runtime service credential bypasses RLS, so ordinary profile, family and lesson queries must use the request's signed-in Supabase client instead.

The table permissions above describe adult sessions. Child mode narrows them further at the database boundary, including when a browser calls PostgREST directly. Its private `child_session_locks` table stores the adult ID, signed Auth session ID, selected hero ID, creation time and reauthentication attempt counter; browser/service roles cannot directly read or mutate those records.

### Value contracts

- Locales: `lv`, `ru`, `en`. Latvian is the initial default.
- Age bands: `4-6`, `7-9`, `10-12`.
- Avatar IDs: `leaf`, `compass`, `crystal`.
- World locations: `school`, `observatory`, `workshop`, `library`, `garden`, `tree`.
- Lesson status: `draft` or `published`. Each lesson row is one language version. Translation grouping and editorial translation workflows are future work.
- Lesson `body` is text. Never render it as trusted HTML.
- Reading bodies, prompts and choice labels are also plain text. Public blocks contain no answer keys.
- Provider IDs: `openrouter`, `openai`. Model ID is chosen by root admin.
- AI output limit: 64–4096 tokens; provider daily request cap: 1–10000.

## Server and RPC contract

All functions have an empty fixed `search_path`. `PUBLIC` execution rights are revoked explicitly. Functions exposed to ordinary authenticated users check the user's database role or family ownership; service-only functions require the service database role at the SQL permission boundary.

| Function                                                                                                                              | Caller                              | Return                            |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------- |
| `current_app_role()`                                                                                                                  | Authenticated user                  | `text` or `NULL`                  |
| `is_staff()` / `is_root_admin()`                                                                                                      | Authenticated user                  | `boolean`                         |
| `configure_ai_provider(...)`                                                                                                          | Signed-in root                      | Safe `ai_provider_settings` row   |
| `get_ai_provider_secret(p_provider text)`                                                                                             | Service role only                   | Ciphertext `text` or `NULL`       |
| `reserve_ai_request(p_user_id uuid, p_provider text)`                                                                                 | Service role only                   | Request `uuid`                    |
| `finish_ai_request(p_request_id uuid, p_status text)`                                                                                 | Service role only                   | `void`                            |
| `set_user_role(p_user_id uuid, p_role text)`                                                                                          | Signed-in root                      | `void`                            |
| `bootstrap_root_admin(p_email text)`                                                                                                  | Service role only                   | Selected adult `uuid`             |
| `save_lesson(p_lesson_id uuid, p_content jsonb, p_expected_updated_at timestamptz = NULL)`                                            | Lesson's staff author or admin/root | Saved lesson `uuid`               |
| `get_lesson_blocks_for_editor(p_lesson_id uuid)`                                                                                      | Lesson's staff author or admin/root | Authored block array `jsonb`      |
| `get_lesson_editor_snapshot(p_lesson_id uuid)`                                                                                        | Lesson's staff author or admin/root | `{ lesson, author_blocks }` JSONB |
| `submit_lesson_block(p_child_profile_id uuid, p_lesson_id uuid, p_block_id uuid, p_content_version integer, p_option_id uuid = NULL)` | Hero's family owner                 | Block result `jsonb`              |
| `complete_lesson_revision(p_child_profile_id uuid, p_lesson_id uuid, p_content_version integer)`                                      | Hero's family owner                 | `lesson_progress` row             |

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

The original `complete_lesson(uuid, uuid)` remains an internal implementation with browser execution revoked. Application code must call `complete_lesson_revision` with the revision rendered on the page. This prevents an old form from acknowledging newly edited content.

## Child sessions and return to adult mode

The lock belongs to `(auth.uid(), auth.jwt().session_id)`, using claims supplied by Supabase Auth. It is not a locale cookie, editable profile field or JavaScript preference. Refreshing an existing Auth session retains that session's lock. Another signed session for the same adult remains separate.

| RPC                                         | Result and boundary                                                                                                                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_child_mode()`                          | `NULL` for an adult session, or `{ "hero_id": "UUID" }` when locked. Missing/malformed signed session ID raises `42501`.                                                                        |
| `enter_child_mode(p_child_profile_id uuid)` | Checks family ownership, locks the current session and returns `{ "hero_id": "UUID" }`. Reentering the same hero is idempotent; switching heroes without adult reauthentication raises `42501`. |
| `reserve_adult_reauth()`                    | Reserves one password-verification attempt for the locked session. Five attempts per 15-minute window; further reservations raise `P0001`. Returns `void`.                                      |

In a locked session, `current_app_role()` returns `NULL`, so staff/root RPCs fail their role checks. The session can read and complete work only for its selected, still-owned hero. Restrictive RLS policies hide adult profiles, families, user roles and AI settings; prevent child-profile or curriculum mutations; and restrict visible materials to published content matching that hero's age band and language. A sibling's progress and rewards remain hidden even though both heroes belong to the same adult account.

There is no authenticated unlock or lock-deletion RPC. The application's return-to-adult flow verifies the adult's password and installs a fresh Auth session. The old session stays locked. The reservation counter applies to that application flow; Supabase Auth's own endpoint rate limits must also be configured and verified in the hosted project.

**Hosted Auth prerequisite:** require the current password for password changes (`auth.email.require_current_password = true` in supported local configuration; enable the corresponding hosted Auth setting). A child-locked token remains the adult's authenticated identity at Supabase Auth's own endpoints. Without that setting, someone holding the token could change the account password and sign in with a new, unrestricted session. RLS and application routes cannot intercept that direct Auth operation. The separate `secure_password_change` setting alone is insufficient for this boundary because recently created sessions can change passwords without the extra nonce. See Supabase's [password security guidance](https://supabase.com/docs/guides/auth/password-security) and [Auth configuration reference](https://supabase.com/docs/guides/local-development/cli/config). The hosted setting has not been applied or verified by these SQL migrations.

The lock deliberately has no foreign key to the hero or Auth session. Deleting a hero or revoking a session must not remove the tombstone and accidentally make a previously issued token an unrestricted adult token. A deleted hero therefore leaves the session locked with no readable hero until adult reauthentication. Retaining or later pruning old lock tombstones needs a verified token-expiry policy; browser callers cannot prune them.

## Interactive learning

### Authoring and public content

`save_lesson` takes `NULL` as `p_lesson_id` to create a new material owned by the calling staff member; leave `p_expected_updated_at` null for creation. Updating an existing ID requires its author or an admin/root role **and** the exact `updated_at` token obtained when opening the editor. It never accepts an author ID from the client. The required `p_content` fields are:

```ts
{
  title: string;           // trimmed length 3–120
  description: string;     // up to 400 characters
  body: string;            // up to 20,000 characters
  locale: 'lv' | 'ru' | 'en';
  age_band: '4-6' | '7-9' | '10-12';
  location: 'school' | 'observatory' | 'workshop' | 'library' | 'garden' | 'tree';
  status: 'draft' | 'published';
  blocks: AuthoredBlock[]; // 0–12 blocks
}
```

An overview body can be empty when interactive blocks exist. A material with no blocks needs at least ten trimmed characters of body text. Existing legacy materials remain readable after migration. Unknown metadata, block or option properties are rejected; the database also caps the serialized input at 512 KiB.

The authored block union is:

```ts
type AuthoredBlock =
	| { id: UUID; type: 'reading'; title: string; body: string }
	| {
			id: UUID;
			type: 'choice';
			prompt: string;
			options: { id: UUID; label: string }[];
			correct_option_id: UUID;
	  }
	| { id: UUID; type: 'reflection'; prompt: string };
```

Block IDs must be unique within the material. A reading title has 1–160 trimmed characters and its body has 1–6,000 characters. Choice/reflection prompts have 1–1,200 trimmed characters. Choices require two to four options, unique option IDs within that choice, labels of 1–400 trimmed characters, and an answer ID matching one of the supplied options. The RPC canonicalizes UUIDs and builds the public payload from these allowed fields.

`lessons.blocks` contains the same structures **without** `correct_option_id`. The RPC writes the public row and the private answer keys atomically. `get_lesson_blocks_for_editor` reconstructs the authored array only for the permitted author/admin. A teacher does not gain access to another teacher's answer keys merely because a material is published.

Editors and duplication use `get_lesson_editor_snapshot`, which returns `{ lesson: <full public lesson row>, author_blocks: <authored array> }` while holding a share lock on the lesson. The metadata, public blocks, private keys and edit token therefore belong to the same version. Do not reconstruct an editor snapshot using separate metadata and answer-key requests.

For updates, `save_lesson` compares `p_expected_updated_at` with the locked row before writing. A missing or outdated token raises SQLSTATE `22023` / `lesson_conflict`; retain the user's unsaved inputs and ask them to reload current material. This checks metadata and publication edits as well as learning content. A lesson-specific trigger advances the token to the greater of `clock_timestamp()` and the previous timestamp plus one microsecond, so even two updates inside one transaction receive different tokens. Keep the database timestamp as its exact string: parsing it through JavaScript `Date` and formatting it again can lose microseconds and cause a false conflict. This edit token is separate from the learner-facing `content_version`.

Direct browser lesson insertion and updates to `body`, `locale`, `age_band`, `blocks` and `content_version` are prohibited. Staff can still update permitted presentation fields or publish/unpublish/delete authorized records directly under RLS. This preserves lightweight publishing controls while keeping learning content and keys together.

### Revision and resume behavior

The initial `content_version` is 1. Saving changes to the overview body, age band, content language, normalized blocks, block order or private answer keys increments it. Saving identical content, renaming a material, changing its description/location or publishing/unpublishing does not increment it.

Confirmations are stored against their exact revision. Historical confirmations remain tagged with the older revision and do not count toward a newer one. The summary `lesson_progress` row retains its earlier version until the next valid interaction; that interaction resets an obsolete completion to `in_progress`, clears its completion time and stores the new completed-block count in `last_step`. Reads must compare `lesson_progress.content_version` with `lessons.content_version` before displaying a current completion.

Both submission and final completion require the page's `p_content_version`. A mismatch or missing revision raises SQLSTATE `22023` with the message `lesson_changed`; reload current content instead of replaying the old form. The server holds a share lock on the lesson while verifying publication, revision and answer keys. Saving a material acquires an update lock, so an edit cannot change those inputs halfway through a submission. A transaction-scoped advisory lock serializes progress changes for each hero/material pair.

### Confirming blocks and completing a lesson

`submit_lesson_block` verifies family ownership, publication, the hero's age band **and** the hero's content language. Earlier blocks in the same revision must already be completed. Reading and reflection blocks accept confirmation with `p_option_id = NULL`; choice blocks require one of their visible option IDs.

The result is:

```ts
{
	correct: boolean; // this submitted answer/confirmation was accepted
	completed: boolean; // this requested block is now marked complete
	completed_count: number; // confirmed blocks in the current revision
	total_blocks: number;
}
```

A wrong choice returns `correct: false` without adding a confirmation or unlocking the next block. The learner can retry. Retrying an already completed block never erases it, even if a later answer is wrong. Reflection stores only the confirmation timestamp: there is no child free-text answer field. Incorrect choices and submitted option IDs are not retained.

Skipping an earlier block raises `22023` / `previous_steps_required`; finalizing unfinished content raises `22023` / `steps_required`. These documented codes can map to friendly interface messages. Other invalid inputs raise `22023`; denied ownership or staff access raises `42501`.

Once the completed count equals the total, `complete_lesson_revision` performs the final acknowledgment. With legacy text-only material, there are no intermediate blocks. The RPC saves one completion summary per hero/material, preserves that revision's first completion timestamp on repeated calls and inserts a single 25 XP reward. Completing a later revision may update the completion summary, but the original reward, its location and `earned_at` remain unchanged.

The reward's key is the hero/material pair, so retries, republishing, changing location and revising content cannot earn another reward for the same material. Previously completed lessons are backfilled using their original completion time. Deleting curriculum removes its blocks, private keys and progress but retains the reward; deleting a hero removes that hero's rewards. XP is derived by summing these records; clients cannot update a balance.

These are small participation rewards, not claims that a child has objectively mastered a subject. There is no public leaderboard or stored performance profile beyond these confirmations.

## First root administrator

1. Apply the migrations in order.
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
node scripts/learning-test.mjs
```

`scripts/db-test.mjs` runs the actual foundation migration in PGlite (PostgreSQL compiled to WebAssembly), with minimal stubs for `auth.users`, `auth.uid()`, and Supabase's database roles. It exercises grants, row-level isolation, role bootstrap/escalation checks, foundation completion, provider secrets, quotas, disabling/removal, and sanitized audit records.

`scripts/learning-test.mjs` applies both the foundation and learning migrations to actual PostgreSQL in PGlite. It covers existing-completion backfill, invalid payloads, answer-key protection, authorized editor snapshots, stale/missing edit tokens, same-transaction token advancement, author scope, direct-write denial, wrong answers, sequential progression, ownership/age/language isolation, stale learning revisions, resumable counts, idempotent rewards, revision replay and deletion behavior. It also provides an `auth.jwt()` stub with session claims for compatibility with session-focused tests.

These tests do not substitute for checking hosted Supabase Auth configuration, PostgREST, email delivery or simultaneous requests against the linked project. PGlite's single-process tests verify SQL behavior and repeated calls; they do not measure hosted contention or prove a multi-connection load test.

The project deliberately has no real family seed data and no embedded credentials. Scheduling/enrollment, video rooms, payment entitlements, media storage policies, broader retention workflows and assessed achievement awards require their own implementation before a production launch.
