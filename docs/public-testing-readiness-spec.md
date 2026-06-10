# Public Testing Readiness Spec

This document is the source of truth for the public-testing cleanup pass. Read it before implementing any large cleanup, bug-fix, profile, room, thread, chat, performance, or public-copy polish work.

The goal is to prepare `thia.lol` for public testing without losing product decisions in a long prompt. If a task asks for public testing readiness, treat this file as required context alongside `AGENTS.md`, `docs/product-audit-and-roadmap.md`, `docs/thia-migration-runner-guide.md`, `docs/media-uploads.md`, and `docs/profile-badges-plan.md`.

## Core objective

Prepare the app and repo for public testing by making the product feel coherent, intentional, fast, and less obviously assembled from generated placeholder language and incremental feature scaffolding.

This is not a new-feature sprint. It is a stabilization, audit, cleanup, UX consolidation, bug-fix, and performance pass.

## Hard rules

1. Do not commit secrets.
2. Do not silently run production migrations.
3. Do not hide API/database bugs behind UI workarounds.
4. Do not touch auth/session behavior unless directly required to fix a verified auth bug.
5. If a migration is needed, make it idempotent, update `backend/database/schema.sql`, document it, and report that it must be run through the migration runner.
6. API-backed behavior must be tested against a working API path. If the API is unavailable, mark those tests as blocked and explain exactly what is missing.
7. Do not call `/api` proxy failures expected when the task depends on API behavior.
8. Do not add fake UI controls. If a button appears, it should work or be clearly and intentionally disabled with honest copy.
9. Do not overclaim security, privacy, encryption, moderation, or legal compliance.
10. Preserve `public_html/config/`, `public_html/uploads/`, and server-only files during deploys.

## Required audit output

Create or update `docs/public-testing-readiness-audit.md` during the cleanup pass.

The audit must include:

- current product status
- visible UI issues found
- public copy issues found
- generated/dev/mock/demo wording found
- profile issues found
- room issues found
- post/thread/comment issues found
- chat issues found
- upload/media issues found
- admin/moderation issues found
- legal/footer issues found
- performance/bundle issues found
- API/database issues found
- bugs fixed in the pass
- bugs deferred with reason
- recommended next tasks

For every deferred item, include:

```text
Deferred item:
Reason:
Risk:
Recommended next task:
```

Nothing should be left as “later” without a reason. That is how features drown in sauce.

## Public-copy cleanup

Public UI and docs should not feel like generated scaffolding. Keep technical docs useful, but remove unnecessary language that makes the project look like it was assembled by automation rather than designed as a product.

### Remove or rewrite public-facing wording like

- mock
- demo
- fallback
- starter
- generated
- local, when it implies local-only fake state
- backend
- API, unless on admin/technical pages where appropriate
- dev
- playground
- soft systems
- ritual
- constellation
- signal
- ambient, except where technically part of an asset or theme
- mood, especially as a room/profile concept
- reaction, unless the product genuinely supports multiple reactions beyond likes

### Preferred public product vocabulary

Use:

- Post
- Reply
- Reblog
- Like
- Room
- Chat
- Profile
- Badge
- Follow
- Following
- Follower
- Moot
- Notifications
- Report
- Edit profile
- Edit room
- Create room
- Join
- Leave
- Save changes
- No posts yet
- No replies yet
- This room is quiet
- Could not load this right now

Avoid decorative words that do not explain real behavior.

## Footer copyright notice

Add a discreet footer notice across the app:

```text
© 2026 Thia Markussen. Alle rettigheter forbeholdt / All rights reserved.
Beskyttet etter norsk opphavsrett og internasjonal opphavsrett / Protected under Norwegian and international copyright law.
```

The footer should be elegant and compact. It should not clutter the primary nav or mobile bottom nav.

## Profile redesign and cleanup

Profiles currently need consolidation. The public profile should feel like a compact social identity surface, not a pile of cards repeating the same facts.

### Profile product decisions

1. The profile tab model should be simplified.
2. Public tabs should be:
   - Feed
   - Replies
   - Rooms
3. Feed should combine top-level posts and reblogs.
4. Replies should show replies/comments.
5. Rooms should show rooms the user owns or belongs to, depending on API support.
6. Followers, following, and badges should not be full heavyweight tabs.
7. Followers, following, and badges should become compact interactive pills/cards that open a modal or focused panel.
8. If modal implementation is too large for the current pass, use compact pills with documented deferred modal work.
9. User-customizable traits should be removed from public profile editing and display.
10. Badges replace the visual/status role that traits were trying to fill.
11. Users should be able to feature up to four badges in the profile header.
12. Featured badges should be visually appealing and compact.
13. Do not show fake badges.
14. Do not show fake profile decoration.
15. Remove default/filler background imagery from profile banners/backgrounds.
16. Empty avatar/banner/background/upload previews should be visually empty or neutral, not filled with unrelated decorative assets.
17. Reduce excessive spacing and duplicate information.
18. Profile layout should feel connected: identity, badges, stats, actions, and feed should visually belong together.

### Profile editing bug

Fix the profile editing “Internal server error” when saving.

Do not paper over the error. Investigate:

- request payload
- PHP validation
- schema fields
- JSON encoding/decoding of links or traits/connections
- missing columns
- SQL errors
- CSRF handling
- uploaded media URL handling
- server error logs if needed

If the bug is database/schema related, add an idempotent migration or adjust API logic safely.

### Connections replace raw links

Replace raw link editing with structured Connections.

Users should choose a platform and enter a username/handle or URL. The app should normalize the final link and show the matching icon.

Initial supported connection types:

- Website / custom URL
- YouTube
- Twitch
- TikTok
- Instagram
- X / Twitter
- Bluesky
- GitHub
- Discord invite or safe Discord display value
- Spotify

Validation rules:

- trim usernames
- normalize URLs
- require `https://` for custom URLs unless intentionally supporting `http://`
- reject HTML/script
- limit number of connections
- store structured JSON if existing profile link storage allows it
- do not create a new complex social-links schema unless necessary

### Profile stats cleanup

Investigate and fix duplicate or misleading profile stats.

Stats should distinguish:

- top-level posts
- replies
- reblogs
- followers
- following
- moots if supported
- rooms if meaningful
- badges earned if meaningful

Do not call likes “reactions” unless the product actually supports multiple reaction types.

## Rooms cleanup and Rooms 2.x refinement

Rooms should feel like ownable, customizable community spaces, not scattered cards.

### Room product decisions

1. Remove visible “mood” from room UI and room editing.
2. Remove confusing extra pills that do not clearly represent room state.
3. Room pages should be tighter and more intentional.
4. Empty room icon/banner previews should be empty or neutral unless media exists.
5. Room metadata should avoid duplicate fields.
6. Room settings should include moderator management.
7. Rooms should be deletable by owner/admin with clear confirmation.
8. Private rooms are deferred unless already supported cleanly.

### Room editing bug

Fix the room customization “Internal server error” on save.

Investigate:

- request payload
- missing columns
- JSON/text fields
- icon/banner upload URLs
- role/permission checks
- CSRF handling
- SQL errors
- route mismatch

Do not paper over it in UI.

### Moderator management

Add foundation for room moderator management:

- owner/admin can add moderator by handle
- owner/admin can remove moderator
- moderators can edit room metadata if the current model allows it
- owner cannot be accidentally demoted without ownership transfer support
- moderation roles should be stored in `room_memberships.role` if available

### Room deletion

Add delete room support if safe:

- owner/admin only
- confirmation required
- clear destructive copy
- prefer soft-delete if existing content visibility model supports it
- if hard-delete, confirm cascades are safe and documented
- posts/comments/uploads behavior must be understood before deletion

If deletion is too risky, add the audit entry with exact risk and the recommended migration/task.

## Comments, replies, and threads

Comments/replies should behave like post/thread nodes, not like a separate weaker system.

### Current known issues

- Deleted parent posts can leave replies floating around.
- Profile stats may count replies as posts incorrectly.
- Replies can appear on profiles without the parent context.
- Replies/comments cannot always be deleted.
- Replies/comments may not support media.
- Replies/comments may not be rebloggable even though they are post-like.
- Commenting on comments should work.
- Thread UI is too shallow.

### Product decisions

1. Replies are posts with `parent_id`.
2. Replies can have replies.
3. Replies should support media if top-level posts support media.
4. Replies should be deletable by owner/admin/moderator rules.
5. Replies should be rebloggable unless there is a clear product reason to block it.
6. Deleted/hidden parent posts should not leave ghost replies inflating profile stats.
7. Profile Feed should show top-level posts and reblogs.
8. Profile Replies should show replies with context where practical.
9. Counts should be accurate and not include deleted/hidden ghost content.

### Database/API requirements

Audit:

- `posts.parent_id`
- foreign key behavior
- delete/hide behavior
- profile post queries
- feed queries
- reply queries
- reblog queries
- notification target URLs

Fix with query filtering or safe migrations where needed.

If cascading delete is used, ensure it matches product expectations. If soft-delete is used, ensure child visibility is handled consistently.

### Thread UX

Clicking a post should open a proper thread view/modal.

Thread should include:

- main post
- reply tree or reply list with context
- like action
- reblog action
- reply action
- report action
- delete action if allowed
- stats
- timestamp
- room/author context

Reply composer should:

- be compact
- be hidden until invoked by the Reply button
- support media if post composer supports media
- have clear cancel/send states

## Post click behavior

Clicking a post card body should open the thread.

Clicking explicit controls should keep their own behavior:

- author/avatar/handle -> profile
- room pill -> room
- like -> like
- reblog -> reblog
- reply -> open reply composer/thread
- report -> report flow
- menu/delete -> action

Avoid nested click conflicts.

## Profile navigation behavior

Across the app, clicking a user avatar, display name, or handle should navigate to the profile unless it is clearly inside another action.

Audit:

- PostCard
- Thread modal
- Chat
- Notifications
- Followers/following surfaces
- Badges/admin grant list
- Rooms/admin views

## Chat cleanup

Chat v1 exists, but users need an obvious way to start a DM from the Chat page.

Add:

- “New chat” or “Message a moot” action
- searchable/listed moots if API can provide them
- clear empty state if no moots
- no fake ability to message non-moots

Moots-only rule remains for v1.

Do not build group chats, attachments, post/room sharing, typing indicators, read receipts, or realtime unless separately scoped.

## Timestamp bug

Known bug: a brand-new post can show as “2 hours ago.”

Investigate and fix root cause.

Check:

- database timestamp defaults
- `CURRENT_TIMESTAMP` timezone
- PHP timezone
- UTC serialization
- frontend date parsing
- missing `Z` suffix
- local time vs UTC conversion
- stale seed/mock data

Do not fix by blindly adding or subtracting hours in the UI unless proven correct.

Add a regression test or smoke note if practical.

## Media/upload cleanup

Uploads are image-only for now.

Keep:

- max 10 MB
- JPEG/PNG/WebP only
- WebP conversion
- no video/audio claims
- no SVG
- uploaded files under `public_html/uploads/`

Cleanup goals:

- empty upload previews should be empty or neutral
- no default ambient image in profile/room/post media previews
- no fake upload controls
- preserve `public_html/uploads/` during deploys

## Admin/moderation cleanup

The admin panel exists, but before public testing it should be less cluttered and more useful.

Audit:

- report queue
- badge grants
- room metadata
- user/profile actions
- migration/status diagnostics
- copy that exposes implementation too loudly

Admin can be technical, but should still be organized.

Do not expose secrets, raw tokens, raw SQL errors, or private filesystem paths.

## Legal/trust polish

Legal pages exist. During readiness cleanup:

- keep footer legal links discreet
- align report copy with Community Guidelines and Moderation Policy
- do not overclaim compliance
- do not claim analytics/marketing cookies if none exist
- do not claim end-to-end encrypted chat
- do not claim automated data export/deletion if not built

## Performance and bloat cleanup

The app has grown. Reduce unnecessary bundle size and obvious bloat where practical.

Investigate:

- Vite large chunk warning
- eagerly loaded admin pages
- eagerly loaded legal pages
- eagerly loaded chat/notifications/profile editor/room editor
- large icon libraries
- unused mock data
- unused components/helpers
- repeated decorative assets
- overuse of `ambient-veil.webp`

Preferred safe fixes:

- route-level `React.lazy` / dynamic imports
- lazy-load Admin, Legal, Chat, Notifications, Profile editor, Room editor where practical
- split large modal components if safe
- remove dead mock data
- remove unused imports
- reduce repeated static copy blocks if easy
- keep cPanel static routing working

Do not break the app just to silence a warning. Performance fixes must be verified.

## Public testing readiness checklist

Before the pass is complete, verify or document blocking reasons for:

- Home loads
- Discover loads
- Rooms page loads
- Room create/edit works or blocked reason is documented
- Room join/leave works or blocked reason is documented
- Profiles load
- Profile edit save works
- Profile image upload works
- Post composer image upload works
- Clicking post opens thread
- Reply composer works
- Replies can be deleted or deferred with reason
- Ghost replies/comments do not inflate post stats
- Reblogs work
- Follow/moot state works
- Notifications load
- Chat loads
- Chat can start DM with a moot or deferred with exact reason
- Badge display works
- Admin badge grant works
- Legal pages load
- Footer copyright appears
- No primary nav legal clutter
- No obvious public mock/demo/dev/generated wording
- Build passes
- API health passes when API available
- Database health passes when API available

## Verification commands

Run at minimum:

```bash
git pull --rebase
php -l changed api/*.php
npm run typecheck
npm run lint
npm run optimize:assets
npm run build
git diff --check
```

If Playwright is available, run relevant smoke tests. API-backed tests require a working API path.

If migrations are added, do not run them silently. Report the filenames and migration runner steps.

## Expected implementation report

Any Codex task using this spec must report:

- files changed
- audit summary
- bugs fixed
- profile changes
- room changes
- thread/comment changes
- chat changes
- timestamp findings/fix
- performance changes
- copy cleanup performed
- copyright/footer changes
- migrations added, if any
- tests and verification results
- smoke test result or blocked reason
- deferred items with reasons
- commit SHA and push result

## Suggested phased execution

This spec is large. It can be implemented in phases.

Recommended order:

1. Audit doc + copy cleanup + footer copyright + performance low-risk cleanup.
2. Profile cleanup and profile edit bug fix.
3. Room cleanup, room edit bug fix, moderator management, room deletion decision.
4. Thread/comment/post click behavior and timestamp bug fix.
5. Chat start-from-chat UX and profile click behavior audit.
6. Final public testing sweep.

If a single task tries to do everything, it must still document deferred items precisely. No vague “left for later.”
