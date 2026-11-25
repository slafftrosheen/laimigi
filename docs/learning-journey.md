# Learning journey, release 0.2

## Adult → hero → activity → adult

The adult opens the family page, creates or edits a pseudonymous hero, and chooses Enter world. This POST installs a lock for the current Supabase Auth session and opens that hero's world. A direct world URL does not silently enter child mode. The lock applies to every tab sharing that login; a separate signed-in device has its own session.

The world shows published material matching the hero's age group and learning language, saved progress, and earned rewards. Interface language remains independent. Returning to the family, teacher or root area requires the adult password. The application verifies the same account through a separate Auth client before replacing the browser session. A wrong password leaves the child session intact. Five attempts are permitted within 15 minutes; a refreshed old session remains locked. Logging out remains available.

## Authoring

Teachers create a draft, enter a title, description and optional overview, choose age/language/location, and add up to 12 activities. A lesson with no activities must have an overview of at least 10 characters. Activities use stable UUIDs and can be rearranged or removed before saving.

| Activity   | Author input                                      | Learner action                    | Saved evidence                                  |
| ---------- | ------------------------------------------------- | --------------------------------- | ----------------------------------------------- |
| Reading    | Title and short text                              | Read, then confirm                | Completion timestamp for this block/revision.   |
| Choice     | Question, two to four options, one correct option | Select an option; retry if needed | Confirmation only after a correct answer.       |
| Reflection | A small observation, discussion or practical task | Try the task, then confirm        | Self-confirmation; no free-text child response. |

The editor receives metadata and private answer keys from one consistent authorized snapshot. Saving checks the exact original updated_at token; a change in another tab produces a conflict and retains the submitted work rather than overwriting newer material. The same player presents an unsaved preview to the teacher. Preview does not create progress or rewards. Copying a lesson creates a new draft owned by the current teacher. A teacher cannot edit or copy another author's lesson through the studio; admin/root can manage curriculum across authors.

All content remains plain text. No raw HTML, arbitrary script, external embed, public child chat or automatic AI publication is introduced. AI-generated text can still be reviewed and transferred into the editor.

## Progress and revisions

A learner completes blocks in order. A wrong choice provides feedback and can be retried; it does not clear earlier confirmations. The server records completed blocks, so reloading or returning later resumes from the unfinished activity. After all activities, an explicit final action completes the lesson.

Body, language, age, activity or answer-key changes increment the content revision. Title, description, location and publication-state changes alone do not. Old progress stays associated with its original revision; new activities must be confirmed for the new revision. Stale open forms are rejected with `lesson_changed`, preventing an old screen from recording confirmation against newly edited material. No data is saved solely because an animation finished.

A plain-text lesson without activity blocks retains a single explicit completion action. Reading/reflection confirmations express participation; these are not verified examinations or diagnoses.

## XP and personal milestones

Completion creates one 25 XP ledger entry per hero and lesson, enforced by a database key. Repeating the same lesson or completing a later revision never adds another award. Existing foundation completions are backfilled once. Removing a lesson preserves the earned reward; removing the hero deletes its history and rewards.

The UI derives level progress at 100 XP per level and three personal milestones: first discovery, five completed lessons, and discoveries in three distinct locations. The same rules use age-appropriate presentation for ages 4–6, 7–9 and 10–12. No public comparison, leaderboard, purchase or daily login streak is involved. XP is a navigation/motivation aid, not an educational grade.

## Boundaries to validate with real services

The SQL tests exercise real migrations in PGlite. HTTP tests run the actual SvelteKit server against an isolated Supabase protocol fixture. Neither replaces hosted Auth, PostgREST or Vercel integration checks. Apply every migration in order before running the new application against the shared development project.

Still to implement: live scheduling/video, media uploads, bespoke mini-games, richer character customization, content translation linking, and subscriptions. Child-mode protection and its bearer-token/device limitations are described in [SECURITY.md](../SECURITY.md).
