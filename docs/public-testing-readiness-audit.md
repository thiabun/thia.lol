# Public Testing Readiness Audit

Date: 2026-06-10

## Current product status

Pass 3 continued the stabilization pass in static/API-inspection mode because production login is rate-limited with HTTP 429. The app has real PHP API-backed posts, replies, reblogs, rooms, profiles, follows/moots, notifications, chat, uploads, badges, legal pages, and admin/moderation foundations. Pass 3 specifically addressed thread/reply visibility, reply parity, post-body thread opening, compact reply composition, nested reply display, and mocked thread action coverage without attempting authenticated production smoke.

## Visible UI issues found

- Profile public tabs were too broad: Posts, Replies, Reblogs, Rooms, Followers, Following, and Badges made the profile feel like separate dashboards instead of a compact identity surface.
- Profile stats used "Reactions" even though the product UI only supports likes.
- Profile empty banner and upload previews used decorative ambient imagery instead of neutral empty states.
- Room cards and room pages showed mood badges and duplicate public/room state pills.
- Room edit exposed Mood even though the room product direction removes mood from public room customization.
- Post cards still rendered post mood badges.
- Legal/footer links existed, but the required copyright notice was missing.

## Public copy issues found

- Public-facing UI used "Reactions" for likes.
- Room UI showed "mood", which is decorative and not behaviorally meaningful.
- Post UI showed post mood badges.
- Some loading/error copy was acceptable and was not changed in this pass.

## Generated/dev/mock/demo wording found

- Public runtime code still contains retired starter filtering in `src/lib/api.ts`; that is implementation cleanup, not public copy.
- Smoke tests intentionally contain mock/demo/dev/API/backend terms to verify retired copy does not render publicly.
- Technical docs and API files contain backend/API/dev wording where appropriate.
- No primary public UI instance of "mock", "demo", "starter", "generated", "playground", or "dev" was found in the runtime pages inspected.

## Profile issues found

- Public profile tabs did not match the required Feed, Replies, Rooms model.
- Reblogs were isolated in a separate tab instead of being combined into Feed.
- Followers, following, and badges were heavyweight tabs instead of compact profile context.
- Traits were still publicly displayed and editable.
- Featured badges supported only three badges while the spec allows up to four.
- Raw link editing has been replaced by structured Connections stored in the existing `profiles.links` JSON column with backward-compatible reads for legacy string links.
- Profile edit sends structured connection objects and the PHP endpoint now validates/normalizes both legacy string links and structured connection objects before writing JSON.
- Profile save hardening found the likely mismatch risk in `links`: the old endpoint accepted string arrays only, while the product now needs structured objects. The endpoint now rejects unsupported platforms, HTML/script-like input, non-HTTPS custom URLs, unsafe Discord values, unsupported Spotify hosts, and excessive connection counts with 422 errors instead of falling into generic failures.
- API-backed profile edit could not be live-verified without authenticated credentials and a writable API path in this environment.

## Room issues found

- Room cards, room pages, room search, and room edit still used room mood.
- Empty room icon/banner upload previews used decorative ambient imagery instead of neutral empty states.
- Moderator management now has owner/admin add/remove controls in room edit/settings backed by `room_memberships.role`.
- Room deletion is implemented as a soft-delete foundation with a confirmation field. Deleted rooms are hidden from public room lists, room detail, profile room lists, public post/feed eligibility, and public room stats.
- Room edit save now requires the Rooms 2 storage plus the room soft-delete migration. The API returns a 503 when storage is not ready rather than hiding the issue.
- API-backed room edit could not be live-verified without authenticated credentials and a writable API path in this environment.

## Post/thread/comment issues found

- `posts.parent_id` is a self-reference with `ON DELETE SET NULL`; app-level deletion is soft deletion through `status = 'removed'` plus `deleted_at`, so hard-delete FK behavior is not the normal visibility path.
- Replies are stored as posts with `parent_id`, can already have replies, and use the same like/reblog/delete/report endpoints when the target post is public, published, and visible.
- Static inspection found ghost-reply risk: profile reply counts, shared post selection, reply counts, and reactable/replyable lookups checked the reply row itself but did not consistently require visible parent/root context.
- Profile Feed already combines top-level posts and reblogs; the stale mocked smoke test still expected a separate Reblogs tab and was updated.
- Reply creation via `/api/posts/:id/replies` did not accept `mediaUrl`, even though top-level post creation did.
- The thread modal existed, but the composer was always visible for authenticated users and post-body clicks did not open the thread.
- Thread reply previews had weaker controls than posts: no media rendering, no reply-level action row, no reply deletion, and no nested reply loading.

## Chat issues found

- Chat exists and profiles can start a moot-only DM.
- In the original pass, the Chat page "New chat" / "Message a moot" workflow from the chat surface was deferred. See the 2026-06-11 addendum for the implemented picker.

## Upload/media issues found

- Upload limits and WebP conversion are documented.
- Empty upload previews in profile and room editors used decorative ambient texture instead of neutral empty slots.
- No video/audio claims were found in the upload UI inspected.

## Admin/moderation issues found

- Admin can remain technical, but room mood is still surfaced in admin room metadata.
- Report and badge admin flows were not deeply refactored in Pass 1.

## Legal/footer issues found

- Legal pages and footer links exist.
- Required Norwegian/international copyright notice was missing from the global footer.

## Performance/bundle issues found

- `src/App.tsx` eagerly imported all major route pages, including Admin, Legal, Chat, Notifications, Profile, and Room editors through their route pages.
- Low-risk route-level lazy loading is appropriate for this pass.
- Further modal/component splitting should be a later measured pass.

## API/database issues found

- API timestamps are returned as SQL-style strings without timezone markers in several endpoints.
- Feed ranking compares `p.created_at` to `UTC_TIMESTAMP()`, which indicates UTC intent. The frontend must parse timezone-less database timestamps as UTC unless the API changes to emit ISO 8601 with offsets.
- Profile customization and Rooms 2 API paths explicitly detect missing migration columns/tables and return 409/503 style readiness errors.
- Post/reply query consistency now depends on shared `public_post_visible_sql()` and `post_ancestor_visibility_sql()` helpers. The ancestor helper checks visible parent, grandparent, and great-grandparent context, which covers the nested depth currently rendered in the thread UI.
- `GET /api/feed/home`, `GET /api/feed/discover`, room feeds, profile posts, and profile replies continue to exclude child replies unless explicitly loading a thread/profile replies context.
- Public stats now count top-level public posts for the public post total instead of counting replies as posts.
- Profile reblogs now allow reblogged replies to preserve reply reblog parity.
- No migrations were run in this pass.

## Bugs fixed in the pass

- Added shared public post and ancestor visibility SQL helpers and applied them to shared post selection, profile reply counts, reply counts, reactable/replyable post lookups, and direct post payload loading. Replies whose visible parent/root context is removed no longer appear as normal public profile/feed content within the supported rendered thread depth.
- Fixed a profile-stat inconsistency in the post payload query where profile post counts could include replies.
- Updated public stats so the public post total counts top-level posts.
- Added reply image parity: `POST /api/posts/:id/replies` now accepts the same validated `mediaUrl` upload path as top-level posts.
- Kept broad Home/Discover/room feeds top-level-only while allowing Profile Replies and thread reply loading to show replies in context.
- Preserved reply reblog support by allowing profile reblogs to include reblogged reply posts.
- Made post body/media clicks open the full thread while avatar/display name/handle links navigate to profile, room badges navigate to rooms, and like/reblog/reply/report/delete controls keep their own behavior.
- Reworked the thread modal to show root post context, room context, timestamp, stats/actions, report/delete controls, hidden-by-default compact reply composer, and reply list.
- Added compact reply composer with text validation, 2000-character limit display, cancel/send states, and image upload UI through the existing authenticated upload path.
- Added reply-level media rendering, like/reblog/reply/report controls, owner/admin/moderator delete gating, and lazy nested reply loading up to the rendered thread depth.
- Added mocked Playwright coverage for post body thread opening, control isolation, hidden reply composer, reply media UI, nested replies, reply delete gating, reply reblog action, thread report submission, profile Feed reblogs, and static API ghost-reply query inspection.
- Fixed timezone-naive frontend parsing for SQL-style API timestamps by adding a shared UTC-aware date parser and wiring posts, room activity, notifications, chat, admin dates, profile joined dates, and badge dates through it.
- Removed room mood from public room cards, room pages, room search, room editing, and admin room metadata display.
- Removed post mood badges from post cards and thread previews.
- Removed the ambient artwork special case from post media rendering so `/ambient-veil.webp` is not displayed as if it were user-provided media.
- Removed profile traits from public profile display and profile editing.
- Simplified public profile tabs to Feed, Replies, and Rooms. Feed now combines profile posts and reblogs.
- Increased featured badge support from three to four badges in frontend and API validation.
- Replaced raw profile link editing with structured Connections for Website, YouTube, Twitch, TikTok, Instagram, X/Twitter, Bluesky, GitHub, Discord, and Spotify.
- Added profile connection normalization and validation in frontend and PHP while keeping legacy string link reads compatible.
- Added compact interactive Followers, Following, Moots, and Badges profile pills. Followers/following/badges now open focused panels instead of heavyweight tabs.
- Moved own-profile badge featuring into the Badges focused panel and kept the four-featured-badge limit.
- Added room moderator add/remove endpoints and room settings UI using `room_memberships.role`, with owner demotion protection.
- Added soft room deletion with confirmation and public query filters that preserve posts, memberships, uploads, and moderation history instead of hard-deleting content.
- Replaced generic public API client fallback errors with "Could not load this right now."
- Added the required global copyright notice to the footer.
- Added route-level lazy loading for major pages.

## Migrations added in Pass 2

- `backend/database/migrations/20260610_0010_add_room_soft_delete.sql`
  - Adds nullable `rooms.deleted_at`.
  - Adds `rooms_deleted_at_idx`.
  - Must be deployed to `public_html/api/migrations/` and run through the documented migration runner.
  - Was not run by Codex.

## Bugs deferred with reason

Deferred item: Full profile edit save verification against production/deployed API.
Reason: Authenticated credentials and a writable working API path are not available in this environment.
Risk: A production-only schema/config error could remain.
Recommended next task: Run an authenticated deployed smoke test for `/api/me/profile`, including display name, bio, location, avatar, banner, empty customization clears, and structured Connections.

Deferred item: Profile edit Internal Server Error root-cause confirmation on production.
Reason: Static inspection found `/api/me/profile` correctly routed, CSRF-protected, and migration-aware. Pass 2 fixed the likely links payload/storage mismatch by adding structured connection validation and legacy compatibility. Local reproduction is blocked by missing local MySQL/cPanel config and authenticated test credentials. A remaining live 500 still requires cPanel `error_log` or deployed authenticated reproduction.
Risk: A server-only PHP/database/config error may still break profile saves.
Recommended next task: Reproduce the save on the deployed site with an admin/test account, capture the request payload and cPanel error log, then fix any remaining exact SQL/PHP error or run the documented pending migration if that is the cause.

Deferred item: Room edit Internal Server Error root-cause confirmation on production.
Reason: Static inspection found `/api/rooms/:slug` update correctly routed, CSRF-protected, permission-checked, and guarded by `require_rooms2_storage()`. Pass 2 added the soft-delete storage requirement and public deletion filters. Local reproduction is blocked by missing local MySQL/cPanel config and authenticated test credentials. A missing Rooms 2 or room soft-delete migration should return 503, so a live 500 still requires cPanel `error_log` or deployed authenticated reproduction.
Risk: Room customization saves may still fail for owners/moderators in production.
Recommended next task: Reproduce the room edit save on the deployed site with an owner/admin account, capture the request payload and cPanel error log, then fix the exact SQL/PHP error or run the documented pending migration if that is the cause.

Deferred item: Authenticated production verification for thread reply create/delete/reblog/report/media upload.
Reason: Production login is currently rate-limited with HTTP 429. This pass intentionally did not attempt production login or authenticated production smoke.
Risk: A production-only schema/config/permission issue could still affect live reply mutations.
Recommended next task: After the rate limit clears, run authenticated deployed smoke for reply create, reply image upload, reply delete, reply reblog, and thread report with a safe test account.

Deferred item: Unbounded deep ancestor filtering.
Reason: Query filtering now covers the parent/grandparent/great-grandparent depth rendered by the thread UI. A fully unbounded recursive ancestor check would require a broader database compatibility decision for MySQL/MariaDB recursive CTE support or a root/thread id migration.
Risk: Extremely deep legacy reply chains beyond the rendered depth could still need a stronger root visibility model.
Recommended next task: If deeper threads become a product goal, add an idempotent `posts.root_id` or `posts.thread_id` migration and backfill it through the migration runner.

Deferred item: Chat "New chat" / "Message a moot" from the Chat page.
Reason: Resolved by the 2026-06-11 addendum implementation.
Risk: Deployed behavior still needs authenticated API-backed verification after the commit is live.
Recommended next task: Run deployed authenticated smoke for `/chat`, `GET /api/chat/moots`, and selecting an eligible moot in the picker.

Deferred item: Admin room metadata cleanup beyond public room mood removal.
Reason: Admin organization was not the highest-risk public surface for Pass 1.
Risk: Admin surfaces remain noisier than ideal.
Recommended next task: Reorganize admin room/profile/report panels and remove implementation-heavy copy where it is not diagnostically useful.

Deferred item: Full API-backed public testing checklist.
Reason: Authenticated live test credentials are not available, the new room soft-delete migration was not run by Codex, and database-mutating smoke setup should not be done implicitly.
Risk: Profile edit, room edit, join/leave, uploads, replies, reblogs, badge grants, chat, and admin behavior cannot be honestly marked passed.
Recommended next task: Run `THIA_BASE_URL=https://thia.lol` smoke tests with test credentials and confirm `/api/health` plus `/api/health?db=1`.

## Recommended next tasks

1. Wait for the production login HTTP 429 rate limit to clear, then run authenticated deployed smoke for profile, room, upload, and thread/reply mutations.
2. Deploy and run `20260610_0010_add_room_soft_delete.sql` through the migration runner if it is still pending, then verify room edit, moderator management, and deletion on the deployed site.
3. Decide whether threads need a permanent `root_id`/`thread_id` model before supporting deeper-than-rendered reply trees.
4. Run deployed authenticated smoke for the Chat page "Message a moot" picker after deployment.
5. Add ownership transfer and deeper room moderation tools.

## 2026-06-11 Chat picker addendum

- Added a Chat page "Message a moot" picker backed by `GET /api/chat/moots`.
- The new endpoint requires an authenticated session, uses the existing `user_follows` table, returns only reciprocal follows for the current user, and filters targets to active users.
- Selecting a moot still goes through `POST /api/chat/conversations`, so server-side moots-only enforcement and direct-conversation uniqueness remain the source of truth.
- No migration was added.
- Local coverage uses mocked UI tests and PHP source-inspection checks; deployed API-backed chat picker smoke still needs a working authenticated API path.

## 2026-06-11 Profile navigation behavior addendum

- Added a reusable profile-link component for inline identity links and compact identity rows.
- Fixed static identity text so profile navigation is available from reblog attribution, chat conversation headers, chat conversation list identities, chat moot picker identities, notification actor names, follower/following focused panels, room owner and moderator rows, room-card owner labels, room edit moderator settings, admin badge recent grants, admin room owner labels, and admin report user labels.
- Kept explicit action controls as buttons or room/chat links: like, reblog, reply, report, delete, room open links, chat open/message actions, badge revoke, moderator removal, and admin moderation actions retain their own behavior.
- Chat message bubbles are intentionally unchanged because they do not show a separate sender avatar/name/handle in the current 1:1 layout; the selected conversation header and conversation list identity now link to the other participant profile.
- No API changes or migrations were added.
- Local coverage uses mocked Playwright smoke tests for post/thread, chat, notifications, follower/following panels, badge/admin, and room identity links. Deployed API-backed manual verification is still recommended after deployment.

## 2026-06-11 Broader report target addendum

- Added profile, room, and chat-message report paths using the same structured report categories and policy links as post/reply reports.
- Profile reports target the profile user directly and suppress the public self-report action. The API rejects self-profile reports and requires the reported profile user to be active.
- Room reports target public, non-deleted rooms and include the room owner as reported-user context when available. The UI suppresses reporting a room owned by the current user.
- Chat message reports target an individual message and are shown only for messages sent by the other participant in the current authenticated conversation. The API requires conversation membership before accepting a message report and does not expose adjacent private messages in the admin report payload.
- Admin report rows now include target-specific summaries for profiles, rooms, and messages, while existing post hide/remove, user suspend, review, and dismiss actions remain the only enforcement controls in this scoped pass.
- No migration was added. The existing `reports.target_type` schema already supports `post`, `profile`, `room`, and `message`.
- Local coverage uses mocked Playwright smoke tests and PHP source-inspection checks. Deployed API-backed verification is still recommended with authenticated test accounts.

## 2026-06-11 Thread Experience V2 visual foundation addendum

- Widened the thread modal and centered the header title/context so the surface feels more intentional on desktop while staying bounded on mobile.
- Reworked the modal-only root/reply presentation into one connected conversation container with avatar rails, lighter reply rows, and less card fragmentation.
- Suppressed fallback `Profile feed` metadata inside the thread modal while preserving real room links, author/profile links, and existing action isolation.
- Removed the duplicate authenticated root Reply button inside the modal; the root action row remains the single root reply entry point for that context.
- Preserved existing reply create, media upload UI, nested reply loading, like, reblog, report, and delete behavior. No API changes, PHP changes, database changes, or migrations were added.
- Local coverage uses mocked Playwright thread tests for modal opening, desktop width, connected container/rows, profile and room links, empty state, reply composer, nested replies, reblog, report, and delete controls. API-backed deployed reply mutation verification is still recommended before launch sign-off.
