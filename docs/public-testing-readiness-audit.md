# Public Testing Readiness Audit

Date: 2026-06-10

## Current product status

Pass 2 continues the stabilization and cleanup pass. The app has real PHP API-backed posts, replies, reblogs, rooms, profiles, follows/moots, notifications, chat, uploads, badges, legal pages, and admin/moderation foundations. Pass 2 specifically addressed profile save hardening, structured profile Connections, compact profile panels, room edit hardening, room moderator management, and soft room deletion foundations.

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

- Post cards render post mood badges.
- Post timestamp parsing treats SQL timestamps without timezone markers as local browser time, which can make a new UTC database timestamp appear about two hours old in Europe/Oslo.
- Thread modal exists, but nested/deep thread behavior, reply media, reply deletion, reply reblog rules, and ghost reply cleanup need a separate pass.

## Chat issues found

- Chat exists and profiles can start a moot-only DM.
- Chat page "New chat" / "Message a moot" workflow from the chat surface is still deferred in this pass.

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
- No migrations were run in this pass.

## Bugs fixed in the pass

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

Deferred item: Reply media, reply deletion, nested thread depth, ghost reply cleanup, and reply reblog parity.
Reason: Thread/comment work touches shared post behavior and needs a separate API-backed pass.
Risk: Replies can still feel weaker than posts and may have count/context inconsistencies.
Recommended next task: Audit `posts.parent_id` queries and implement reply visibility/deletion/reblog/media parity with regression tests.

Deferred item: Chat "New chat" / "Message a moot" from the Chat page.
Reason: Needs API support for searchable/listed moots or a safe existing source; no fake non-moot messaging controls should be added.
Risk: Users may not discover how to start DMs unless they visit a moot profile.
Recommended next task: Add a moots endpoint or reuse following/follower intersection, then add a chat start dialog that only lists eligible moots.

Deferred item: Admin room metadata cleanup beyond public room mood removal.
Reason: Admin organization was not the highest-risk public surface for Pass 1.
Risk: Admin surfaces remain noisier than ideal.
Recommended next task: Reorganize admin room/profile/report panels and remove implementation-heavy copy where it is not diagnostically useful.

Deferred item: Full API-backed public testing checklist.
Reason: Authenticated live test credentials are not available, the new room soft-delete migration was not run by Codex, and database-mutating smoke setup should not be done implicitly.
Risk: Profile edit, room edit, join/leave, uploads, replies, reblogs, badge grants, chat, and admin behavior cannot be honestly marked passed.
Recommended next task: Run `THIA_BASE_URL=https://thia.lol` smoke tests with test credentials and confirm `/api/health` plus `/api/health?db=1`.

## Recommended next tasks

1. Run authenticated deployed smoke tests with a working API path and document exact profile/room edit responses.
2. Deploy and run `20260610_0010_add_room_soft_delete.sql` through the migration runner, then verify room edit, moderator management, and deletion on the deployed site.
3. Run a dedicated thread/comment parity pass.
4. Add Chat page moot picker/start-DM flow.
5. Add ownership transfer and deeper room moderation tools.
