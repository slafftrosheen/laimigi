# Development deployment: Supabase + Vercel

This is the deployment path for the foundation. There is no hosted project ID, production URL or credential committed to the repository. Use a dedicated development Supabase project; keep production separate when the centre launches.

## 1. Connect the online Supabase development project

Create or select the intended project in your Supabase account. Apply all files in `supabase/migrations/` in filename order through the SQL editor, or use the CLI procedure in [database.md](database.md). New projects need the foundation, learning journey and child-mode migrations. Existing foundation projects need only the two new `20261125` migrations; do not reapply the foundation. The application fails closed if the child-session migration is missing. Review the project reference before running a migration. Applying local CLI configuration does not configure a hosted project's Auth settings.

In the online project's Auth settings:

- Keep email confirmation enabled.
- Set minimum password length to 12 or greater.
- Disable anonymous sign-ins.
- Enable **Require current password when changing password**, and keep confirmation of email changes on both old and new addresses enabled. This is a hosted Auth prerequisite for child mode: SQL policies do not govern Auth account updates. The repository sets `auth.email.require_current_password = true` locally, but you must enable it separately for the online project.
- Set the Site URL to the Vercel deployment URL once it exists.
- Allow the local callbacks you use, such as `http://localhost:5173/auth/callback` and `http://localhost:5173/auth/callback?next=/auth/reset`.
- Allow the equivalent HTTPS paths for the chosen Vercel URL. Use exact deployment domains; do not allow arbitrary unrelated Vercel projects.

The current-password requirement exempts verified password recovery flows. The separate secure-password-change setting alone does not cover freshly signed-in sessions. These behaviors are documented in [Supabase's Auth configuration](https://supabase.com/docs/guides/local-development/cli/config#auth.email.require_current_password) and [password security guide](https://supabase.com/docs/guides/auth/password-security). Verify both password recovery and attempted direct password changes with the actual development project's settings.

The app supports two confirmation paths:

1. Supabase's normal PKCE redirect to `/auth/callback` (must be opened in the browser that started the flow).
2. Server token-hash verification at `/auth/confirm`. For confirmation emails that work across devices, configure the Supabase email template to point to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. The password recovery template uses `type=recovery`.

The template Site URL points at the configured deployment. Use PKCE/local redirects for local testing or a separate development email template. Verify email delivery with a real test account before inviting families; no live email delivery was tested by offline CI.

## 2. Set environment variables

Copy `.env.example` to an ignored `.env.local` for your computer. In Vercel, use Project → Settings → Environment Variables for the corresponding deployment environment.

| Variable                          | Where it belongs | Purpose                                                                                          |
| --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| `PUBLIC_SUPABASE_URL`             | App runtime      | URL of the chosen Supabase project.                                                              |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | App runtime      | Supabase publishable key; authorization still depends on Auth and RLS.                           |
| `SUPABASE_SECRET_KEY`             | Server secret    | Service operations used for root administration and AI credential retrieval.                     |
| `AI_SETTINGS_ENCRYPTION_KEY`      | Server secret    | Exactly 32 random bytes encoded in standard base64, used to encrypt stored provider credentials. |

Legacy `PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are accepted as fallbacks. Prefer the current publishable/secret keys for a new project. Never put a service credential or encryption key into a `PUBLIC_*` variable.

Create the encryption master key with a trusted secret generator or a local command, and save it directly to your secret manager or ignored environment file. A local shell example that writes it without printing its value:

```bash
node --input-type=module -e 'import { randomBytes } from "node:crypto"; import { appendFileSync } from "node:fs"; appendFileSync(".env.local", "\nAI_SETTINGS_ENCRYPTION_KEY=" + randomBytes(32).toString("base64") + "\n", { mode: 0o600 });'
```

Run this only when initially setting up an empty encryption value; keep exactly one active definition in the file. Back up the value securely and use the same value across server instances that share the database. Changing it requires re-entering provider keys. Never commit the generated value.

Provider API keys are **not** deployment variables: root admin enters them in `/admin/ai` after setup. Runtime bootstrap credentials remain environment secrets because the database and encryption boundary are needed before that screen can function.

## 3. Import the repository into Vercel

Import `slafftrosheen/laimigi` through Vercel's GitHub integration:

- Framework: SvelteKit.
- Node.js: 24.x.
- Root directory: repository root.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Output directory: leave at the framework default. The adapter produces `.vercel/output`.
- Production branch: `main`, following the owner's requested workflow.

Set the environment variables before enabling account-backed features. Re-deploy after changing them. The public landing page can be deployed before credentials exist, with account actions visibly unavailable.

Vercel runs both the UI and the application's server routes. Supabase is the online database/auth service; this is not a static-only frontend. No video relay or long-running worker is included.

Connecting GitHub in Vercel enables deployments from subsequent `main` pushes. A successful `npm run build` locally only verifies the deployable artifact; it is not evidence of a completed Vercel deployment.

## 4. Bootstrap the first root administrator

Register the intended adult through the portal and verify that email. Then, in a trusted terminal with the development project's server credential in `.env.local`, run:

```bash
npm run admin:bootstrap -- --email YOUR_VERIFIED_ADULT_EMAIL
```

This promotes exactly that verified account. The service-only database RPC refuses to bootstrap a different root after one exists. Ordinary signup always produces a parent role, even if someone sends forged role metadata. No hardcoded root password or automatic first-user promotion exists.

Sign out and sign back in. Open `/admin` to check configuration, `/admin/users` to assign staff roles to existing adult accounts, and `/admin/ai` to configure providers. This release does not send staff invitations.

## 5. Configure AI in the root admin panel

For each desired provider, root selects a model ID available to that account, enters its API credential, sets output/request limits, and saves. The credential field remains blank after saving; the page shows only a four-character hint and status.

Saving does not contact the provider. The explicit **Test connection** action sends a small synthetic request, may incur provider cost, and consumes quota. Both providers start disabled and model selection is empty until configured. Deleting a credential disables its provider.

Teachers use `/studio/assistant` only after a provider is enabled. Their input/output remains in the request and browser; the usage ledger stores no prompt or generated text. Teachers can copy a draft into the lesson editor and review it before publishing. The application does not send child profiles, histories, diagnoses or family details to either provider.

Daily caps count requests, not euros. Use the provider account's own spending controls for a financial limit. Requests that fail after admission also count. Default safety boundaries are a maximum 4,096 output tokens and five requests per adult/provider per minute.

## 6. Verify hosted behavior

After connecting real services, check one verified parent and one staff account end to end: family creation, hero ownership and editing, an interactive lesson, wrong-answer retry, saved progress, revision changes, one-time XP, child-mode restrictions and adult password reauthentication, password recovery, logout, root-only settings, one provider test, and one draft generation. Confirm the intended development project receives writes and that a separate parent cannot read another family's rows.

The repository's offline verification covers the build, real SQL policy behavior in PGlite, provider request contracts and local browser integration. Hosted Auth, PostgREST, email delivery, Vercel runtime secrets and actual AI account/model access need this final live check.
