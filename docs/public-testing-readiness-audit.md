# Public Testing Readiness Audit

Date: 2026-06-10

## Current product status

Pass 1 is a stabilization and cleanup pass, not a feature sprint. The app has real PHP API-backed posts, replies, reblogs, rooms, profiles, follows/moots, notifications, chat, uploads, badges, legal pages, and admin/moderation foundations. The main public-testing risks found at the start of the pass were visible scaffolding language, profile/room customization rough edges, timezone-naive timestamp parsing, profile tab sprawl, room mood copy, and eager route loading.

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
- Raw link editing remains string-based; structured Connections are not implemented yet.
- Profile edit sends customization fields and is guarded by migration checks. Saving non-empty customization before the migration is applied returns a 409, not a silent UI workaround.
- API-backed profile edit could not be live-verified without authenticated credentials and a writable API path in this environment.

## Room issues found

- Room cards, room pages, room search, and room edit still used room mood.
- Empty room icon/banner upload previews used decorative ambient imagery instead of neutral empty states.
- Moderator management exists as display foundation only; add/remove moderator controls are not implemented.
- Room deletion is not implemented and requires a content/cascade decision before public testing.
- Room edit save requires the Rooms 2 migration. The API returns a 503 when storage is not ready rather than hiding the issue.
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
- Replaced generic public API client fallback errors with "Could not load this right now."
- Added the required global copyright notice to the footer.
- Added route-level lazy loading for major pages.

## Bugs deferred with reason

Deferred item: Structured profile Connections replacing raw link editing.
Reason: Requires storage shape, normalization UI, icon mapping, and migration/backward compatibility decisions beyond the safest Pass 1 scope.
Risk: Raw links remain less polished and can produce inconsistent display labels.
Recommended next task: Implement structured connection objects in existing `profiles.links` JSON with normalization, validation, icons, and migration-safe read compatibility.

Deferred item: Profile follower/following/badge modals or focused panels.
Reason: Pass 1 can remove heavyweight tabs and keep compact counts, but modal UX needs separate interaction and accessibility work.
Risk: Followers/following/badge browsing becomes less discoverable after tab simplification.
Recommended next task: Add compact profile header pills that open accessible modal panels for followers, following, moots, and badges.

Deferred item: Full profile edit save verification against production/deployed API.
Reason: Authenticated credentials and a writable working API path are not available in this environment.
Risk: A production-only schema/config error could remain.
Recommended next task: Run an authenticated deployed smoke test for `/api/me/profile`, including display name, bio, location, avatar, banner, and empty customization clears.

Deferred item: Profile edit Internal Server Error root-cause confirmation on production.
Reason: Static inspection found `/api/me/profile` correctly routed, CSRF-protected, and migration-aware; local reproduction is blocked by missing local MySQL/cPanel config and authenticated test credentials. The API should return 409 if customization columns are missing, so a live 500 still requires cPanel `error_log` or deployed authenticated reproduction.
Risk: A server-only PHP/database/config error may still break profile saves.
Recommended next task: Reproduce the save on the deployed site with an admin/test account, capture the request payload and cPanel error log, then fix the exact SQL/PHP error or run the documented pending migration if that is the cause.

Deferred item: Room moderator management controls.
Reason: Requires new protected API endpoints and owner/admin demotion rules; current pass is avoiding role mutation without live API verification.
Risk: Room owners cannot delegate moderation through the UI.
Recommended next task: Add `POST/DELETE /api/rooms/:slug/moderators` by handle using `room_memberships.role`, with owner protection and Playwright/API smoke coverage.

Deferred item: Room edit Internal Server Error root-cause confirmation on production.
Reason: Static inspection found `/api/rooms/:slug` update correctly routed, CSRF-protected, permission-checked, and guarded by `require_rooms2_storage()`. Local reproduction is blocked by missing local MySQL/cPanel config and authenticated test credentials. A missing Rooms 2 migration should return 503, so a live 500 still requires cPanel `error_log` or deployed authenticated reproduction.
Risk: Room customization saves may still fail for owners/moderators in production.
Recommended next task: Reproduce the room edit save on the deployed site with an owner/admin account, capture the request payload and cPanel error log, then fix the exact SQL/PHP error or run the documented pending migration if that is the cause.

Deferred item: Room deletion.
Reason: Deletion needs a clear content model for posts, replies, uploads, memberships, and moderation history before adding a destructive action.
Risk: Public testing may accumulate test rooms that owners cannot remove.
Recommended next task: Decide soft-delete vs hard-delete, add idempotent migration if needed, document cascade behavior, then add owner/admin delete with confirmation.

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
Reason: Authenticated live credentials and local PHP/MySQL config are not available in this environment.
Risk: Profile edit, room edit, join/leave, uploads, replies, reblogs, badge grants, chat, and admin behavior cannot be honestly marked passed.
Recommended next task: Run `THIA_BASE_URL=https://thia.lol` smoke tests with test credentials and confirm `/api/health` plus `/api/health?db=1`.

## Recommended next tasks

1. Run authenticated deployed smoke tests with a working API path and document exact profile/room edit responses.
2. Implement structured profile Connections in `profiles.links` JSON with backward-compatible reads.
3. Add room moderator add/remove endpoints and UI.
4. Decide and implement room deletion semantics.
5. Run a dedicated thread/comment parity pass.
6. Add Chat page moot picker/start-DM flow.
