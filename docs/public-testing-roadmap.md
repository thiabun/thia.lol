# Public Testing Roadmap

> **Status: Historical / superseded.** This was the v1 public-testing roadmap.
> The priority list below is preserved for context, but active v2 work is now
> tracked in GitHub Issues and oriented by `docs/public-readiness-v2-plan.md`.
> Do not use this file as the current task queue.

This roadmap tracked the public-testing work for `thia.lol`. It is meant to be readable by testers, contributors, Codex, and future Thia at 3 a.m. wondering what the app was supposed to become.

For historical implementation details, read:

- `AGENTS.md`
- `docs/public-readiness-v2-plan.md` for current v2 orientation
- `docs/public-testing-readiness-spec.md`
- `docs/public-testing-readiness-audit.md`
- `docs/product-audit-and-roadmap.md`
- `docs/thia-migration-runner-guide.md`
- `docs/media-uploads.md`

## Board setup recommendation

This v1 board/label recommendation is superseded. Use the v2 board and label
guidance in `docs/public-readiness-v2-plan.md`, and track setup through issue
[#16](https://github.com/thiabun/thia.lol/issues/16).

## Current public-testing priorities

The priority list below is historical. Some items are now implemented, some are
manual verification tasks, and the remaining work should be represented as
GitHub Issues instead of edited here.

### P0: Verify auth-backed production smoke

Production auth smoke was blocked by login rate limiting. Once the rate limit clears, rerun auth-backed smoke with one worker.

Recommended command:

```bash
set -a
. ./.env.local
set +a
npx playwright test tests/smoke/auth.spec.ts tests/smoke/rooms.spec.ts tests/smoke/uploads.spec.ts --workers=1
```

Do not brute-force login if production returns `429`.

### P0: Confirm pending migrations

Confirm the following migrations are deployed and applied before testing related features:

- `20260610_0010_add_room_soft_delete.sql`

Use the migration runner in `docs/thia-migration-runner-guide.md`.

### P1: Threads, replies, and post-click behavior

Fix the thread/reply model so comments behave like real post/thread nodes.

Goals:

- clicking a post opens a full thread
- replies can reply to replies
- replies can support media
- replies can be deleted where allowed
- replies can be reblogged unless intentionally blocked
- report/delete controls work inside the thread
- reply composer is compact and invoked by Reply
- ghost replies do not inflate stats or appear without useful parent context

### P1: Chat start UX

Improve Chat so users can start a DM from the Chat page.

Goals:

- show moots available to message
- allow starting a conversation with a moot
- show useful empty state if no moots exist
- preserve moots-only chat rule

### P1: Profile click behavior audit

Across the app, user avatars, handles, and display names should normally navigate to the profile unless an explicit action is being clicked.

Audit:

- PostCard
- Thread view
- Chat
- Notifications
- Followers/following panels
- Badges
- Rooms
- Admin views

### P1: Moderation / reports 2.0

Make reports more structured and admin review more useful.

Goals:

- clear report categories
- admin report queue polish
- report status
- dismiss/review/action controls
- moderation notes if practical
- no fake appeals system

### P2: Admin cleanup

Admin should remain technical enough to be useful, but less cluttered and less implementation-leaky.

Goals:

- organize panels
- avoid raw implementation copy where not needed
- keep migration/auth diagnostics protected
- improve report, badge, room, and user moderation surfaces

### P2: Performance and bundle cleanup

The app has grown and should continue reducing eager loading and bloat.

Goals:

- keep route-level lazy loading stable
- split heavy modals where useful
- remove dead code/mock data
- reduce large chunk warning where practical
- avoid breaking cPanel routing

### P2: Public testing launch checklist

Create a single checklist for public testing.

Include:

- deployment steps
- migration checks
- smoke commands
- manual testing matrix
- known limitations
- tester instructions
- how to report bugs

## Issue format for Codex-ready work

Each implementation issue should include:

```md
## Goal

## Context

## Scope

## Out of scope

## Acceptance criteria

- [ ] 
- [ ] 

## Files/docs to read

- `AGENTS.md`
- `docs/public-testing-readiness-spec.md`
- relevant docs

## Verification

Run:

- `git pull --rebase`
- `php -l changed api/*.php`, if PHP changed
- `npm run typecheck`
- `npm run lint`
- `npm run optimize:assets`
- `npm run build`
- `git diff --check`

API-backed behavior must use a working API path or be reported as blocked with exact reason.

## Notes
```

## Public tester bug report format

A good public bug report includes:

- what page or route the tester was on
- what they clicked or submitted
- what they expected
- what actually happened
- device/browser
- screenshot or recording if useful

Public reports must not include passwords, cookies, migration tokens, private messages, database details, or config files.
