# Public Testing Project Triage

Repository state checked after `git pull --rebase` on local HEAD `a22df6e`.

This document reconciles the public-testing roadmap, readiness spec, readiness audit, product audit, deployment docs, media docs, and profile/badges plan against the current repository state. It is planning only. No GitHub Issues or Project cards have been created from this pass.

## Current Reality

The current repository is no longer in the state described by the oldest parts of the audit set.

Completed or effectively completed:

- Public feeds, profile post routes, room post routes, Discover, Home, and public post reads are implemented and the deployed `a22df6e` fix addressed the recent `/api/posts` SQL aliasing outage.
- Pass 3 thread/reply work is present: post-body thread opening, compact reply composer, nested replies, reply media upload parity, reply like/reblog/report/delete controls, and ancestor visibility filtering for the rendered thread depth.
- Public profile cleanup is implemented: Feed, Replies, and Rooms tabs; Feed combines top-level posts and reblogs; followers/following/badges are compact focused panels instead of heavyweight tabs; traits are removed from public editing/display; featured badges support up to four.
- Structured profile Connections are implemented on the frontend and PHP API with legacy string-link read compatibility.
- Profile image customization upload paths exist through the authenticated image upload endpoint.
- Rooms 2 foundation is implemented: creation/editing, customization fields, member roles, join/leave, member counts, member listing, moderator add/remove controls, and soft room deletion support.
- The `20260610_0010_add_room_soft_delete.sql` migration exists in `backend/database/migrations/`.
- Room mood and post mood badges have been removed from public surfaces inspected in the current code.
- Reports 2.0 for posts is implemented: structured categories, report details, admin queue, report statuses, dismiss/review/action controls, post hide/remove, user suspend, and moderation notes.
- Chat is a real moots-only 1:1 DM foundation with conversations, messages, read state, message notifications, and profile-to-chat start through `/chat?with=handle`.
- The Chat page still lists existing conversations only. It does not yet include a native "Message a moot" picker or searchable moot list.
- Legal, privacy, cookie, copyright, community guideline, moderation, and legal contact pages exist. The footer includes legal links and the required copyright notice.
- Route-level lazy loading is implemented in `src/App.tsx`.
- The deploy workflow exists at `.github/workflows/deploy.yml`, runs verification, writes `dist/deploy-meta.json`, deploys frontend/API/migrations to the expected cPanel targets, and runs live unauthenticated smoke checks.
- Issue templates and a pull request template exist under `.github/`.
- Image uploads are documented and implemented as image-only WebP conversion with cPanel-compatible storage under `uploads/`.

Manual or environment-bound reality:

- Authenticated production smoke is no longer a planning blocker, but repo-only inspection still cannot prove profile edit, room edit, upload, chat, report, reply, reblog, or delete mutations against the live database.
- The live migration runner state cannot be determined from git. `20260610_0010_add_room_soft_delete.sql` is committed and deployed with the code, but whether it is applied in production still requires the migration runner or database health checks.
- Local Vite-only smoke remains incomplete for API-backed behavior unless a local PHP/MySQL API or deployed `THIA_BASE_URL` target is used.

## Stale Documentation

Items where existing docs no longer match the repository or the latest project context:

- `docs/public-testing-roadmap.md` still treats auth-backed production smoke blocked by login rate limiting as a P0 planning blocker. Current project context says Thia can do manual testing when needed and authenticated production smoke is no longer a blocker for planning work.
- `docs/public-testing-roadmap.md` lists thread/reply behavior as P1 work to fix. The repository already contains the Pass 3 thread/reply implementation.
- `docs/public-testing-roadmap.md` lists Moderation / reports 2.0 as P1 work. Post reporting and admin report review are now substantially implemented; remaining work is broader target coverage and safety workflows.
- `docs/public-testing-roadmap.md` lists performance route splitting as open P2 work. Route-level lazy loading is implemented; deeper measured bundle work remains valid.
- `docs/public-testing-readiness-audit.md` is a historical pass report. Its production login `429` framing is stale for planning, and several "could not live verify" items should now be treated as manual test cards rather than blockers.
- `docs/product-audit-and-roadmap.md` has an internal stale note saying Chat currently links to a coming-soon placeholder. Chat is now a working route.
- `docs/product-audit-and-roadmap.md` says top-level posts have no media uploads in the feature table. Image uploads for post media are implemented and documented.
- `docs/product-audit-and-roadmap.md` says Admin still exists in primary desktop nav. Current `AppShell` only includes Admin in the account popover for admins.
- `docs/product-audit-and-roadmap.md` has an older Phase 6 note saying reblog notifications are deferred, while Phase 7 and the current code treat reblog notifications as implemented.
- `docs/product-audit-and-roadmap.md` migration inventory omits `20260610_0010_add_room_soft_delete.sql`.
- `docs/thia-migration-runner-guide.md` is still written around the follows/moots migration `20260610_0002_add_user_follows.sql`. It should be generalized or updated to include checking newly deployed migrations such as `20260610_0010_add_room_soft_delete.sql`.
- `docs/profile-badges-plan.md` says not to add uploads until storage and moderation are defined. Image upload support now exists; the stale part should be narrowed to future non-image uploads and richer deletion/moderation lifecycle work.
- `docs/deployment-automation.md` contains suggested tasks for deploy workflow refresh that are mostly complete. The live admin deploy indicator remains open.

## Remaining Public Testing Work

### P0

- Confirm production migration state for `20260610_0010_add_room_soft_delete.sql` and any other pending committed migrations. This is a manual/deployment card, not a repo code change.
- Keep live unauthenticated deployment smoke green for `/`, `/discover`, `/rooms`, `/@thia`, `/deploy-meta.json`, `/api/health`, `/api/health?db=1`, `/api/profiles/thia`, `/api/rooms`, and `/api/posts`.
- Do not add new public registration expansion or broader DM reach until safety and moderation controls are scoped.

### P1

- Add a Chat page "Message a moot" flow that lists or searches eligible moots and preserves moots-only chat rules.
- Run a profile-click behavior sweep across PostCard, thread modal, Chat, Notifications, follower/following panels, badges, rooms, and admin surfaces.
- Add or refine profile, room, and message reporting paths. Current policy copy tells users to use Legal Contact for these concerns, but in-product reporting is still limited.
- Decide and scope first safety controls for social graph and chat: remove follower, block, mute, message deletion/reporting, and retention expectations.
- Create a public-testing launch checklist that combines deployment steps, migration checks, smoke commands, manual test matrix, known limitations, and tester instructions.

### P2

- Admin cleanup: organize reports, rooms, badges, and user moderation panels; reduce implementation-heavy copy where it is not diagnostically useful.
- Add an admin deploy metadata card that fetches `/deploy-meta.json` and shows commit, build time, and environment without exposing secrets.
- Add notification preferences, grouping, pagination, and high-volume controls.
- Add feed controls such as chronological mode, hide/mute/block inputs, and clearer "why this appears" explanations.
- Add profile polish: pinned posts, privacy controls, hidden-badge management UI, and richer identity controls.
- Add room governance: ownership transfer, bans/mutes UI, room-level report queues, and room-specific moderation logs.
- Run measured performance cleanup beyond route-level lazy loading, including large modal/component splitting and dead-code removal where evidence supports it.

### P3

- Decide whether threads need a permanent `posts.root_id` or `posts.thread_id` model before supporting unbounded deep reply trees.
- Add quote-posts only after reblog controls and notification grouping are stronger.
- Add automatic badge criteria/progress, badge definition editor UI, and broader room-earned or social badge rules after abuse controls are stronger.
- Add optional analytics/marketing cookie consent controls only if optional cookies are introduced.
- Add self-service data export, automated account deletion, advanced region/age controls, and fuller retention tooling after legal review.
- Defer chat attachments, post/room sharing into chat, group chats, realtime, typing indicators, read receipts, and non-moot requests until safety controls are in place.
- Defer private/member-only rooms until access controls and moderation workflows are tested.

## Recommended GitHub Issues

### 1. Confirm live migration and deployment readiness

- Priority: P0
- Rationale: The repo contains `20260610_0010_add_room_soft_delete.sql`, but git cannot prove production runner state. Room edit/delete behavior depends on live schema readiness.
- Estimated complexity: Small, mostly manual verification.
- Codex suitability: Partial. Codex can improve docs/scripts, but Thia or an admin must run the live migration status check with server-only credentials.

### 2. Add Chat page moot picker

- Priority: P1
- Rationale: Chat can start from a profile or `?with=handle`, but users cannot discover or start a moot DM from the Chat page itself.
- Estimated complexity: Medium.
- Codex suitability: High if scoped to an eligible-moot endpoint or safe reuse of follower/following intersection plus focused UI and tests.

### 3. Audit and fix profile navigation behavior

- Priority: P1
- Rationale: Avatars, handles, and display names should consistently navigate to profiles unless inside an explicit action.
- Estimated complexity: Medium.
- Codex suitability: High. This is a contained frontend behavior and smoke-test pass.

### 4. Create public-testing launch checklist

- Priority: P1
- Rationale: The project needs one practical checklist for deploy, migrations, smoke, manual testing, known limitations, tester instructions, and bug reporting.
- Estimated complexity: Small.
- Codex suitability: High. Documentation-only and directly aligned with current planning.

### 5. Add profile, room, and message report paths

- Priority: P1
- Rationale: Post reporting exists, but profile, room, and message concerns still rely on Legal Contact. Public testing with chat and rooms needs clearer safety paths.
- Estimated complexity: Large.
- Codex suitability: Medium. Codex can implement scoped target support, but product decisions are needed for room owner queues, message visibility, and abuse handling.

### 6. Scope first block, mute, and remove-follower controls

- Priority: P1
- Rationale: Follows, moots, feeds, rooms, and chat are live enough that basic user safety controls should be specified before broader testing.
- Estimated complexity: Large.
- Codex suitability: Medium. Best first as a spec/design issue, then split into implementation tasks.

### 7. Clean up admin surfaces

- Priority: P2
- Rationale: Admin is functional but still dense. Reports, rooms, badges, and users should be easier to scan during public testing.
- Estimated complexity: Medium.
- Codex suitability: High for UI organization and copy cleanup; lower for policy decisions.

### 8. Add admin deploy metadata indicator

- Priority: P2
- Rationale: The workflow writes `deploy-meta.json`, but the admin UI does not surface it yet. This would make live version confirmation easier after deploys.
- Estimated complexity: Small.
- Codex suitability: High.

### 9. Add notification controls and grouping

- Priority: P2
- Rationale: Notifications exist for major interactions, but public testing can generate noisy activity without preferences, grouping, pagination, or high-volume controls.
- Estimated complexity: Medium to large.
- Codex suitability: Medium. Needs product limits and API/UI changes.

### 10. Add room governance tools

- Priority: P2
- Rationale: Rooms have owners/moderators and soft deletion, but ownership transfer, bans/mutes, room report queues, and room-specific enforcement logs are deferred.
- Estimated complexity: Large.
- Codex suitability: Medium. Split into smaller issues before implementation.

### 11. Add profile privacy and badge management polish

- Priority: P2
- Rationale: Profiles are coherent now, but pinned posts, privacy controls, hidden-badge management, and richer identity controls remain open.
- Estimated complexity: Medium to large.
- Codex suitability: Medium. Hidden-badge UI is high suitability; privacy controls need product decisions.

### 12. Decide long-term thread root model

- Priority: P3
- Rationale: Current ancestor filtering covers the rendered thread depth. Unbounded deep replies need either recursive database support decisions or a root/thread id migration.
- Estimated complexity: Medium for decision, large for migration/backfill.
- Codex suitability: Medium. Codex can draft and implement after the database direction is chosen.

## Recommended GitHub Project Structure

Use a GitHub Project named:

```text
thia.lol Public Testing
```

Suggested columns:

- Inbox
- Ready
- In Progress
- Review
- Blocked
- Done

Suggested labels:

- `type: bug`
- `type: feature`
- `type: polish`
- `type: docs`
- `type: performance`
- `type: test`
- `area: api`
- `area: auth`
- `area: deploy`
- `area: docs`
- `area: feeds`
- `area: profiles`
- `area: posts`
- `area: threads`
- `area: rooms`
- `area: chat`
- `area: uploads`
- `area: notifications`
- `area: moderation`
- `area: admin`
- `area: badges`
- `area: legal`
- `area: tests`
- `priority: p0`
- `priority: p1`
- `priority: p2`
- `priority: p3`
- `codex-ready`
- `needs-human-test`
- `needs-product-decision`
- `blocked`
- `public-testing`

Recommended Project cards without immediate GitHub Issues:

- Manual card: confirm live migration runner status for `20260610_0010_add_room_soft_delete.sql`.
- Manual card: Thia authenticated smoke pass for profile edit, room edit, uploads, thread reply mutations, reports, reblogs, chat, and badge grant/revoke.
- Manual card: decide public registration stance during early testing.
- Product card: decide the first block/mute/remove-follower scope.
- Product card: decide message moderation visibility and retention before message reporting.
- Product card: decide whether deep thread trees need `root_id`/`thread_id`.
- External card: legal review before treating policy pages as final.

Items that should remain deferred rather than become near-term issues:

- Quote-posts.
- Group chats, chat attachments, realtime chat, typing indicators, and read receipts.
- Private/member-only rooms.
- Push/email notifications.
- Optional analytics and marketing consent controls while no optional cookies are used.
- Self-service data export and automated account deletion until legal/product requirements are clearer.
- Automatic badge earning rules before abuse controls and transparent criteria are designed.

## Suggested Next Three Codex Tasks

1. Create `docs/public-testing-launch-checklist.md` with deployment steps, migration checks, smoke commands, manual testing matrix, known limitations, tester instructions, and bug report guidance.
2. Implement the Chat page "Message a moot" flow with eligible moot listing/search, empty state, moots-only enforcement, and smoke coverage.
3. Run the profile navigation behavior sweep and fix avatar/display-name/handle navigation inconsistencies across public surfaces with focused tests.
