# Application architecture and flows

## Decisions

SvelteKit owns presentation and request-scoped server code in one repository. This suits the requested Vercel deployment and keeps provider keys and service credentials outside the browser. Supabase owns adult identity, PostgreSQL persistence and row-level authorization. The initial UI has no direct browser Supabase client; authentication cookies can therefore be HttpOnly.

The game world is a lightweight SVG/HTML navigation surface. It has semantic controls and works with touch, a keyboard, and reduced-motion preferences. A game engine can be added to individual mini-games later without making adult forms and lessons depend on a canvas renderer.

## Route map

| Route                                 | Audience               | Behavior                                                                      |
| ------------------------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| `/`                                   | Everyone               | Public introduction and world preview.                                        |
| `/auth/login`, `/auth/signup`         | Adults                 | Supabase password access and adult-account acknowledgement.                   |
| `/auth/forgot`, `/auth/reset`         | Adults                 | Recovery email and authenticated password update.                             |
| `/auth/callback`, `/auth/confirm`     | Auth flow              | PKCE exchange or token-hash verification with safe local redirects.           |
| `/family`                             | Signed-in adult        | Own family, hero creation and removal.                                        |
| `/play/[heroId]`                      | Owning family          | Child-facing locations and content matched to the hero's age/language.        |
| `/learn`                              | Signed-in adult/family | Published content with independent language, age and location filters.        |
| `/learn/[lessonId]`                   | Signed-in adult/family | Read a published lesson and mark it complete for an eligible owned hero.      |
| `/studio`, `/studio/[lessonId]`       | Teacher/admin/root     | Draft, edit and publish curriculum; teachers are scoped to their own records. |
| `/studio/assistant`                   | Teacher/admin/root     | Request an AI-assisted draft from an enabled provider.                        |
| `/admin`, `/admin/users`, `/admin/ai` | Root only              | Configuration status, role management and provider administration.            |
| `/api/ai/draft`                       | Staff, POST only       | Validated, same-origin request; quotas; server-only provider call.            |
| `/locale`                             | POST only              | Persist a valid interface language and redirect within the app.               |
| `/health`                             | Everyone               | Application liveness, without service connectivity claims or secret metadata. |

## Family learning flow

1. Adult registers, confirms email and signs in. A database trigger creates a parent role and owned family.
2. Adult creates a hero with an invented nickname, age band, emblem and content language. No child Auth identity is created.
3. Selecting the hero opens their learning world. The map and list refer to the same location IDs; the list remains available for accessibility.
4. Only published materials for the hero's age band and learning language appear. An empty location explains that content has not been published yet.
5. A lesson opens as readable content. A family can mark completion for an eligible owned hero. The database independently validates ownership, age band and publication.
6. Completion is idempotent. There are no fake XP awards, leaderboards or engagement streaks in the foundation.

UI language comes from a persistent cookie and defaults to Latvian. A hero's content language and the library language filter are separate. Translations of interface text are complete for the implemented screens; lesson rows are distinct language versions without an editorial translation-linking workflow yet.

## Educator flow

Staff sign in using the same adult Auth system. Teachers create a draft, edit it, and explicitly publish. A teacher cannot edit another teacher's lesson. Admin/root can manage curriculum across authors; this does not grant blanket access to children's profiles.

AI drafting begins with a staff-entered topic, output language, age band and provider. The service loads provider settings and decrypts the credential on the server, reserves a request in PostgreSQL, calls a fixed provider endpoint, and returns plain text. A request ledger records outcome metadata only. The educator reviews the response and transfers selected text into a draft; publishing remains a separate human action.

## Root administration flow

First-root assignment happens once through a trusted bootstrap script. Afterwards, root manages existing adult roles through a guarded page and database RPC. The last root cannot be removed accidentally. Every settings action independently rechecks authorization; entering a protected layout is not enough to authorize later requests.

Provider settings contain only model/configuration fields and a key hint. Ciphertext lives in the non-exposed private schema; the master key lives in runtime secrets. Public/default provider URLs are fixed in source, not editable request input, to avoid sending credentials to an arbitrary destination.

## Deliberate next-stage work

- Child/adult session locking and reauthentication before returning from play mode to adult settings.
- Live session scheduling, capacity, enrolment and a real video provider.
- Media uploads and private signed delivery with appropriate storage policies.
- A complete content format beyond plain-text lessons: interaction blocks, save position, reviewed translations and accessible narration.
- Age-specific character art, inventory, pedagogical achievements and mini-games.
- Family subscription and payment lifecycle, once the centre agrees commercial terms.
- Staff invitations, MFA policy, recovery procedures, operational monitoring and production readiness review.

The base keeps these future areas explicit so an attractive screen does not imply a service already exists.
