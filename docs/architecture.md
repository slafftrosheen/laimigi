# Application architecture and flows

## Decisions

SvelteKit owns presentation and request-scoped server code in one repository. This suits the requested Vercel deployment and keeps provider keys and service credentials outside the browser. Supabase owns adult identity, PostgreSQL persistence and row-level authorization. The initial UI has no direct browser Supabase client; authentication cookies can therefore be HttpOnly.

The game world is a lightweight SVG/HTML navigation surface. It has semantic controls and works with touch, a keyboard, and reduced-motion preferences. A game engine can be added to individual mini-games later without making adult forms and lessons depend on a canvas renderer.

## Route map

| Route                                 | Audience               | Behavior                                                                                        |
| ------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `/`                                   | Everyone               | Public introduction and world preview.                                                          |
| `/auth/login`, `/auth/signup`         | Adults                 | Supabase password access and adult-account acknowledgement.                                     |
| `/auth/forgot`, `/auth/reset`         | Adults                 | Recovery email and authenticated password update.                                               |
| `/auth/callback`, `/auth/confirm`     | Auth flow              | PKCE exchange or token-hash verification with safe local redirects.                             |
| `/family`                             | Signed-in adult        | Own family, hero creation/editing/removal and progress summary.                                 |
| `/play/[heroId]/enter`                | Owning adult, POST     | Install a server-owned Auth-session lock for the selected hero.                                 |
| `/auth/adult`                         | Locked adult session   | Verify the adult password and install a new unlocked session.                                   |
| `/play/[heroId]`                      | Owning family          | Child-facing locations and content matched to the hero's age/language.                          |
| `/learn`                              | Signed-in adult/family | Published content with independent language, age and location filters.                          |
| `/learn/[lessonId]`                   | Signed-in adult/family | Read and confirm ordered activities, resume progress and complete the current content revision. |
| `/studio`, `/studio/[lessonId]`       | Teacher/admin/root     | Draft, edit and publish curriculum; teachers are scoped to their own records.                   |
| `/studio/assistant`                   | Teacher/admin/root     | Request an AI-assisted draft from an enabled provider.                                          |
| `/admin`, `/admin/users`, `/admin/ai` | Root only              | Configuration status, role management and provider administration.                              |
| `/api/ai/draft`                       | Staff, POST only       | Validated, same-origin request; quotas; server-only provider call.                              |
| `/locale`                             | POST only              | Persist a valid interface language and redirect within the app.                                 |
| `/health`                             | Everyone               | Application liveness, without service connectivity claims or secret metadata.                   |

## Family learning flow

1. Adult registers, confirms email and signs in. A database trigger creates a parent role and owned family.
2. Adult creates a hero with an invented nickname, age band, emblem and content language. No child Auth identity is created.
3. Entering the hero installs a server-owned lock for the signed Auth session and opens the learning world. The map and list refer to the same location IDs; the list remains available for accessibility. Adult routes require password reauthentication before this session can return.
4. Only published materials for the hero's age band and learning language appear. An empty location explains that content has not been published yet.
5. A lesson opens as reading, choice and reflection steps, with an optional overview. The database validates ownership, active child session, age, language, publication, content revision and sequential completion. Wrong answers can be retried without removing saved work.
6. Completion is idempotent and earns 25 XP once per hero/lesson. The immutable ledger retains earned progress through lesson revisions and removal. Personal milestones and 100-XP level steps are derived from real rewards; no public leaderboard or login streak is implemented.

UI language comes from a persistent cookie and defaults to Latvian. A hero's content language and the library language filter are separate. Translations of interface text are complete for the implemented screens; lesson rows are distinct language versions without an editorial translation-linking workflow yet.

## Educator flow

Staff sign in using the same adult Auth system. Teachers build a draft from ordered blocks, preview it without recording progress, duplicate it when useful, and explicitly publish. Editor metadata and private answer keys load as one consistent authorized snapshot; every update checks the exact original updated_at token, so stale tabs cannot silently overwrite newer work. A teacher cannot edit another teacher's lesson. Admin/root can manage curriculum across authors; this does not grant blanket access to children's profiles.

AI drafting begins with a staff-entered topic, output language, age band and provider. The service loads provider settings and decrypts the credential on the server, reserves a request in PostgreSQL, calls a fixed provider endpoint, and returns plain text. A request ledger records outcome metadata only. The educator reviews the response and transfers selected text into a draft; publishing remains a separate human action.

## Root administration flow

First-root assignment happens once through a trusted bootstrap script. Afterwards, root manages existing adult roles through a guarded page and database RPC. The last root cannot be removed accidentally. Every settings action independently rechecks authorization; entering a protected layout is not enough to authorize later requests.

Provider settings contain only model/configuration fields and a key hint. Ciphertext lives in the non-exposed private schema; the master key lives in runtime secrets. Public/default provider URLs are fixed in source, not editable request input, to avoid sending credentials to an arbitrary destination.

## Deliberate next-stage work

- Live session scheduling, capacity, enrolment and a real video provider.
- Media uploads and private signed delivery with appropriate storage policies.
- Rich media activities, reviewed translation linking and accessible narration beyond the implemented text/choice/reflection blocks.
- Richer age-specific character art, inventory and standalone mini-games beyond the implemented personal achievement crests.
- Family subscription and payment lifecycle, once the centre agrees commercial terms.
- Staff invitations, MFA policy, recovery procedures, operational monitoring and production readiness review.

The base keeps these future areas explicit so an attractive screen does not imply a service already exists.
