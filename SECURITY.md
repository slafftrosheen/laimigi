# Security boundaries

## Credentials and roles

- Never commit `.env.local`, Supabase service keys, AI provider keys or the encryption master key.
- Never copy them into issue bodies, logs, browser storage, screenshots or tests. Test fixtures use unmistakably nonfunctional local values.
- `root_admin` is a database role, not an email check, signup flag or frontend route convention. Signup metadata cannot grant privileges.
- All private route loads and mutations check the current request's authenticated role. Supabase RLS independently scopes family and curriculum data.
- A request hook verifies Origin on every POST, PUT, PATCH and DELETE in both development and production. JSON mutation routes and sensitive form actions also verify it before processing input.
- Requests and provider responses are bounded; AI HTTP calls have timeouts and reject redirects.

## AI storage and execution

API keys use a versioned AES-256-GCM envelope with a fresh nonce and provider-bound authenticated data. The master key is a server runtime secret. Database credential rows are outside the exposed schema, and ciphertext retrieval is service-role only. Admin loads use an explicit safe-column allowlist.

The server calls only fixed official OpenAI/OpenRouter endpoints. No client-supplied base URL, tools, system prompt, or provider headers can redirect credential-bearing requests. OpenAI calls use `store: false`; other provider policies still apply to data sent to those providers.

Only staff can request drafts. The application does not attach children's personal data to those requests. Educators should enter lesson topics rather than identifiable student information. Output is untrusted text, rendered without raw HTML and never automatically published.

Request admission is transactional in PostgreSQL. Quotas count reserved and failed requests, preventing retry-based evasion. These are usage limits, not a hard currency budget. Enable provider-side account spending limits separately.

## Known foundation boundaries

This is a development foundation, not a production safeguarding certification. Entering a hero installs a server-owned lock for that signed Supabase Auth session. The request hook and database policies restrict it to the active hero and eligible learning material. Clearing a UI preference or refreshing the token does not remove the lock. Returning to adult pages requires the current adult account password and a newly verified Auth session. Failed attempts are limited to five per session in 15 minutes. All tabs using the same session share the lock.

This protects application navigation and PostgREST access; it is not a sandbox against an extracted bearer token, developer tools or a compromised device. Supabase Auth endpoints have their own security controls outside PostgreSQL RLS. Enable the hosted **Require current password when changing password** setting and confirmation of email changes at both addresses; the local config enables the password requirement, but SQL migrations cannot configure the hosted Auth service. The secure-password-change setting alone exempts fresh sessions. An actor who obtains an adult bearer token may still reach other account-management endpoints depending on hosted Auth settings. Before production, verify those settings, root MFA and the intended device threat model. Already rendered adult pages are not remotely erased when a session enters child mode.

Root can list adult accounts and assign roles; it does not get unrestricted family-record access through browser database queries. The narrowly used service credential still bypasses RLS by design and must stay on the server. Database/project owners remain privileged operators.

The UI includes no open chat, public child profiles, payments, recording or live video. Camera and microphone permissions are disabled until a supported classroom flow is added.

Application errors sent to clients are sanitized. Audits and AI usage intentionally omit credentials, ciphertext, prompts and responses. A full operational retention/monitoring policy and root MFA are follow-up work before production use.

## Learning integrity

Teacher answer keys stay in a private table and are returned only through the authorized editor RPC. Learner submissions carry the content revision, and database transactions enforce the active hero, publication, age/language match and step order. Revision changes invalidate saved step confirmations for the new version. Reading and reflection are self-confirmed activities; the system does not claim to prove comprehension.

XP comes only from the completion RPC and an immutable per-hero/per-lesson reward ledger. Replays, retries and revised-content completion do not award again. Deleting a lesson retains the existing reward; deleting a hero removes that hero’s learning data. Achievements describe personal milestones, with no public ranking or attendance streak pressure.

## Changes and validation

Preserve the tests covering role escalation, family isolation, secret protection, quota gates, same-origin mutations, redirect validation and non-echoed API keys. Hosted Supabase/PostgREST/Auth and Vercel runtime behavior must be checked after service configuration; local fixtures do not certify those external services.

If you find a vulnerability, report it privately to the repository owner. Do not publish live credentials or children's data in GitHub issues.
