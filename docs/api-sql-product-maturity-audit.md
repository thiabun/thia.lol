# API/SQL Product Maturity Audit

> **Status: Active audit for issue [#20](https://github.com/thiabun/thia.lol/issues/20).**
> This is a planning document only. It does not authorize production
> migrations, API changes, auth/session changes, analytics, ads, trackers, or
> optional cookie behavior.

Date: 2026-06-15

## Scope

This audit reviews API and SQL support needed for the next Public Readiness v2
product phase:

- threads and replies
- Search
- block, mute, and remove-follower
- Profiles v3 / personal spaces
- media and uploads
- moderation and admin diagnostics
- analytics/revenue preparation
- deployment and diagnostics

Out of scope for this issue:

- running production migrations
- creating migrations
- changing PHP API behavior
- touching auth/session behavior
- adding analytics, ads, trackers, optional cookies, paid features, or embeds
- broad schema rewrites
- committing secrets or config

## Current State Summary

The active PHP API source is `api/`. The `backend/api/` directory still exists
as a small skeleton, but deploy automation, route dispatch, and implemented
product endpoints use `api/`.

Current API/database foundations are stronger than the older docs imply:

- posts support public top-level posts, replies through `posts.parent_id`,
  media URLs, likes, reblogs, hidden/removed status, and room association.
- feeds use `GET /api/feed/home` and `GET /api/feed/discover` with ranking,
  relationship context, and viewer block/mute filters where available.
- Search v1 exists as `GET /api/search?q=...` for active public profiles and
  public, non-deleted rooms.
- block/mute/remove-follower API and schema foundation exist through
  `user_blocks`, `user_mutes`, and `user_follows` guarded by readiness checks.
- profiles support identity fields, avatar/banner/background URLs, theme/accent
  tokens, featured post/room fields, badges, follows, relationship state, and
  profile modules.
- profile modules support `about`, `links`, `featured_badges`, and
  `custom_text` with allowlisted settings, ordering, visibility, and soft delete.
- uploads support authenticated image-only uploads converted to WebP under
  `public_html/uploads/media/yyyy/mm/...`.
- moderation supports reports for posts, profiles, rooms, and messages plus
  admin report queues, post hide/remove, user suspension, room admin listing,
  moderator notes, and moderation action logs.
- deployment automation uploads `dist/` contents directly to `public_html/`,
  `api/` to `public_html/api/`, and migration SQL to
  `public_html/api/migrations/`.
- the protected migration runner records checksums in `schema_migrations` and
  requires admin session plus server-only migration token.

Important limits:

- the current schema has no `posts.root_id`, `posts.thread_id`, thread slug, or
  permalink context table.
- ancestor visibility checks are intentionally bounded to parent, grandparent,
  and great-grandparent joins.
- uploads are files plus returned URLs, not a media library with ownership,
  moderation status, references, cleanup, or review queue.
- Search is simple SQL `LIKE` ranking, no post search, no module/content search,
  no autocomplete, and no full-text index.
- admin reports do not yet include module/media summaries, media lifecycle, or
  narrow block/mute relationship booleans in report context.
- analytics/revenue has no implementation and should stay that way until issue
  #19 decisions settle privacy, legal, consent, and product boundaries.

## Product Track Matrix

| Track | Current readiness | Main gaps | Risk | Future issue split |
| --- | --- | --- | --- | --- |
| Threads and replies | `posts.parent_id`, reply endpoints, reply counts, ancestor visibility filters, profile replies feed. | No root/thread id, no permalink route contract, bounded depth, weak cycle/orphan guarantees for parent edits, no full thread context payload. | High | Thread/reply integrity audit; thread permalink/API plan. |
| Search | Public profiles and public rooms search with prepared SQL and block/mute profile filtering. | No posts/modules/media search, no pagination, limited ranking, no full-text/index plan, room search does not apply viewer block/mute owner filters. | Medium | Search v1 database/API expansion plan. |
| Block/mute/remove-follower | Tables, endpoints, profile relationship payload, feed/profile/chat filters, follow/chat guards. | Need live migration confirmation, API smoke, post/reply/like/reblog blocked-pair guards, admin report pair booleans, settings recovery UI later. | Medium/high | Thread/reply integrity audit; block/mute visibility/admin context follow-up. |
| Profiles v3 | Profile customization columns, featured post/room, module table/API, badges, links, safe upload URLs. | Theme tokens are too shallow for v3, background/banner controls need structured fit/focal/overlay/blur/dim, modules lack featured post/room/music/media/gallery/layout presets. | High | Theme token storage; media controls; module v3 expansion; music/media cards. |
| Media/uploads | Authenticated image upload, WebP conversion, purpose limits, cPanel storage preservation. | No media table, ownership, moderation status, reference tracking, cleanup, gallery storage, video/animation constraints, or media review tools. | High | Media library/moderation diagnostics; profile background/banner controls. |
| Moderation/admin | Reports for post/profile/room/message, admin reports, room list, action log, hide/remove/suspend/resolve. | No module/media report target, no report pair block/mute booleans, no media review, no schema-readiness admin diagnostics, no room/profile/user context bundle. | Medium/high | Media moderation/admin diagnostics; health/schema readiness endpoint improvements. |
| Analytics/revenue prep | No trackers, ads, optional cookies, or revenue code. | Need future data-needs memo only: privacy-preserving aggregates, consent/legal implications, retention, cookie policy impact, and what not to collect. | Low for planning, high for implementation | Coordinate with #19; no implementation from #20. |
| Deployment/diagnostics | Health endpoints, migration runner, deploy docs, `scripts/smoke-live.sh`, deploy-meta expectations. | Need schema readiness checks beyond migration status, stronger API-backed smoke credential strategy, clear deploy-meta/admin display, post-deploy fixture plan. | Medium | API-backed smoke harness; health/schema readiness improvements. |

## Track Findings

### 1. Threads And Replies

Current state:

- `posts.parent_id` stores reply parent links.
- `POST /api/posts/:id/replies` creates replies after checking the parent is
  public, published, not deleted, and has visible ancestors.
- `GET /api/posts/:id/replies` returns direct replies ordered oldest first.
- profile feed and replies feed are already split by `parent_id IS NULL` versus
  `parent_id IS NOT NULL`.
- `post_ancestor_visibility_sql()` hides replies when rendered ancestors are
  missing/hidden/removed, but only through a bounded three-ancestor join.

Gaps:

- no durable `root_id` or `thread_id` for whole-thread reads, pagination, or
  permalinks.
- no endpoint that returns root, ancestors, focused post, direct replies, and
  sibling context in one thread payload.
- `PATCH /api/posts/:id` can update `parent_id` with self-parent rejection, but
  there is no full cycle check or immutable-parent rule.
- the FK uses `ON DELETE SET NULL`, which avoids hard FK failures but can create
  top-level-looking children if a hard delete is ever introduced.
- blocked-pair rules do not appear centralized for reply/like/reblog creation.
- bounded ancestor visibility means deeper nested replies may become hidden or
  unsupported rather than first-class permalink targets.

Future migration options:

- Add `posts.root_id BIGINT UNSIGNED NULL` with an index on
  `(root_id, created_at, id)` only after product decides thread depth and
  permalink behavior.
- Prefer backfilling `root_id` in small batches or with a migration that is
  safe on current data size; do not silently infer complex trees on production.
- If immutable parentage is chosen, add API validation first and migrate only
  after current data is audited.

Future API work:

- `GET /api/posts/:id/thread` or `GET /api/threads/:postId` returning root,
  ancestors, focused post, direct replies, counts, and viewer relationship
  context.
- Reject reply/like/reblog actions across blocked pairs where the parent/root
  author has blocked the actor or the actor has blocked the parent/root author.
- Decide whether `POST /api/posts` should continue accepting `parentId` or
  whether all replies must go through `POST /api/posts/:id/replies`.

Required smoke tests:

- Create a reply against a working API, refresh, and verify the reply appears
  in the thread and profile Replies feed.
- Hide/remove a parent and verify child replies fail closed in thread/profile
  reads.
- Attempt self-parent and invalid parent updates in API smoke or backend
  regression tests.
- Verify blocked-pair reply, like, and reblog behavior once implemented.
- Test any permalink endpoint against deployed or local PHP/MySQL API, not a
  Vite-only proxy.

### 2. Search

Current state:

- `GET /api/search?q=...` returns grouped `profiles` and `rooms`.
- query length is clamped to 80 characters; min query length is 2.
- profile search uses prepared `LIKE` patterns over handle, display name, and
  bio, filters active users, excludes the viewer, and uses viewer block/mute
  filtering.
- room search uses prepared `LIKE` patterns over slug, name, and summary, and
  filters public, non-deleted rooms.

Gaps:

- no post search.
- no module/content search.
- no pagination or cursor.
- no explicit result total.
- no full-text or prefix index strategy.
- no search-specific schema readiness endpoint.
- no admin search.
- no autocomplete API.
- room search does not currently apply viewer block/mute filtering to room
  owners or members.

Future migration options:

- Add targeted indexes only after query plans prove need:
  `users(handle)`, `profiles(display_name)`, `rooms(slug/name)`, and possibly
  `posts(created_at/status/visibility)` are already partly covered, so avoid
  speculative indexing.
- If post search becomes central, evaluate MySQL full-text indexes on
  `posts.body` and possibly `rooms.name/summary` with a fallback for MariaDB
  compatibility.
- Do not add external search infrastructure in v2.

Future API work:

- Extend `GET /api/search` with `types`, `limit`, and cursor/page parameters.
- Add posts only after visibility, block/mute, room visibility, removed parent,
  and profile suspension rules are written down.
- Add module search only after module types have stable public text fields and
  moderation/report behavior.

Required smoke tests:

- Public search returns active profiles and public rooms.
- Suspended users, non-public/deleted rooms, hidden/removed posts, and blocked
  or muted profile results are excluded for authenticated viewers.
- Post search, when added, must prove room visibility, ancestor visibility, and
  block/mute filters.
- Search expansion should include API-level tests with real deployed or local
  PHP/MySQL data plus mocked frontend no-result/error states.

### 3. Block, Mute, And Remove Follower

Current state:

- `user_blocks` and `user_mutes` exist in baseline schema and migration
  `20260611_0001_add_user_blocks_and_mutes.sql`.
- `POST/DELETE /api/profiles/:handle/block` and
  `POST/DELETE /api/profiles/:handle/mute` exist.
- `DELETE /api/profiles/:handle/follower` exists.
- blocking deletes follows in both directions and does not restore follows on
  unblock.
- follow creation and chat creation/send check blocked pairs.
- Home, Discover, profile relationship context, follow lists, chat moot picker,
  and people recommendations use block/mute filters where practical.

Gaps:

- production must confirm the migration is applied before relying on live
  controls.
- report rows do not include the recommended limited pair booleans:
  reporter-blocked-reported, reported-blocked-reporter, reporter-muted-reported,
  reported-muted-reporter.
- post/reply/like/reblog create paths need a dedicated blocked-pair integrity
  audit.
- reblog context filtering for muted/blocked rebloggers should be verified.
- no settings/recovery list exists for forgotten blocks/mutes.
- room-level bans/mutes are separate from user blocks/mutes.

Future migration options:

- No new block/mute table migration is recommended now.
- If admin report pair context is added, prefer SQL computed booleans in the
  report query rather than adding sensitive denormalized columns.
- Add indexes only after real report/feed query plans require them.

Future API work:

- Add limited block/mute booleans to admin report payloads only for reports
  involving the pair.
- Add blocked-pair checks to post interactions after a focused thread/reply
  audit.
- Consider `GET /api/me/blocks` and `GET /api/me/mutes` only after product
  decides a settings recovery surface is needed.

Required smoke tests:

- Block creates a row, removes both follows, hides follow/message affordances,
  and rejects follow/chat actions.
- Mute hides feed/search people exposure without changing follows or notifying
  the muted user.
- Remove follower deletes only the follower relationship and does not create a
  block.
- Home, Discover, Search, profile panels, and chat moot picker must be exercised
  against a working API path after live migration.
- If the local PHP API cannot run, mark smoke blocked and run against
  `THIA_BASE_URL` with safe test accounts instead.

### 4. Profiles v3 / Personal Spaces

Current state:

- profile identity fields live in `profiles`.
- current customization fields are `banner_url`, `profile_accent`,
  `profile_background`, and `profile_theme`.
- `PATCH /api/me/profile` validates text, uploaded image URLs, structured
  Connections, and profile tokens.
- `featured_post_id` and `featured_room_id` exist with API validation and public
  fail-closed reads.
- `profile_modules` supports safe v1 modules with type, title, JSON config,
  visibility, position, status, and schema version.
- public module reads return only public active modules; owner reads include
  non-deleted modules.

Gaps:

- theme/accent storage is token-level but not a full v3 theme model.
- background/banner media controls are URL-only: no fit, focal point, overlay,
  blur, dim, mobile fallback, span, poster, or reduced-motion state.
- v1 modules do not include featured post/room modules, gallery/media, music,
  project, creator/live, or layout preset behavior.
- module-level reports do not exist; profile reports cover modules indirectly.
- module config JSON is safe for v1, but future queryable modules may need
  relational companion tables only when JSON becomes a real limitation.
- `profiles.traits` remains compatibility storage and should not be revived as
  unstructured customization.

Future migration options:

- Profiles v3 theme token storage:
  add structured allowlisted token columns or a `profile_theme_settings` table
  only after exact token names are settled.
- Profile background/banner controls:
  add structured fields for media treatment, for example fit, focal x/y,
  position, overlay, blur, dim, span, and mobile fallback. Keep the current URL
  fields as compatibility fields.
- Profile module v3 expansion:
  extend `profile_modules` supported types first; add relational tables only
  for query-heavy objects such as galleries or projects.
- Profile music/media card storage:
  start with validated URL cards in module config. Do not store OAuth tokens or
  provider secrets.
- Layout presets:
  use allowlisted profile layout tokens; do not allow custom CSS/HTML/JS.

Future API work:

- Expand `PATCH /api/me/profile` or add `PATCH /api/me/profile/theme` for
  structured, allowlisted theme/background settings.
- Add module-specific validation for featured post, featured room, gallery,
  media, music, project, and creator cards in separate issues.
- Add owner preview support only when the API can clearly distinguish public,
  hidden, and draft modules.
- Add module/media report targets only when modules/media are substantial enough
  to review independently.

Required smoke tests:

- Save profile identity/customization through a working API and verify public
  read payload.
- Upload avatar/banner/background images and verify returned URLs render after
  refresh.
- Create, update, hide, reorder, and delete modules against a working API.
- Verify public viewers never see hidden/draft/deleted modules.
- Verify featured post/room fail closed after referenced content is hidden,
  removed, deleted, or unavailable.

### 5. Media And Uploads

Current state:

- `POST /api/uploads/image` requires authentication and CSRF.
- accepted types are JPEG, PNG, and WebP.
- max upload size is 10 MB.
- output is WebP with purpose-specific dimensions for avatar, banner, profile
  background, post media, room icon, and room banner.
- uploaded files live under `public_html/uploads/media/...` and must be
  preserved across deploys.

Gaps:

- no `media` table.
- no owner/user reference beyond the URL stored by a profile/post/room field.
- no moderation status, report linkage, reviewed-by, takedown reason, or
  lifecycle state.
- no reference-counting or cleanup job for abandoned uploads.
- no gallery/media library.
- no video/audio/animated background support.
- no upload quota or per-user storage budget.
- no server-side image review queue.

Future migration options:

- Add a media library table only when a concrete feature needs it, with fields
  such as owner id, purpose, URL/path, mime, width, height, size, status,
  created_at, reviewed_by, reviewed_at, and deleted_at.
- Add media references from profile modules/galleries only after the media table
  exists.
- Keep video/animated background migrations out until size, duration, poster,
  reduced-motion, mobile, and legal/copyright rules are approved.

Future API work:

- `GET /api/me/media` for owner library only after ownership and cleanup rules.
- admin media review endpoints only after moderation status exists.
- media delete should be soft-delete or reference-aware; do not unlink files
  blindly while profile/post/room rows may still reference them.

Required smoke tests:

- Upload each supported purpose with a working API and verify type, dimensions,
  URL shape, and public rendering.
- Reject oversized, empty, SVG, HTML, PDF, video, audio, and unknown binary
  files.
- If a media table is added, verify moderation-hidden media fails closed in
  profile, post, room, and module rendering.
- Verify deploy paths preserve `public_html/uploads/`.

### 6. Moderation And Admin Diagnostics

Current state:

- `POST /api/reports` supports `post`, `profile`, `room`, and `message`.
- admin reports include reporter, reported user, post, profile, room, message,
  status, category, notes, action taken, reviewer, and action counts.
- moderators/admins can hide/remove posts, suspend users, and resolve reports.
- `moderation_actions` logs moderator actions.
- admin rooms list provides room context.

Gaps:

- no report target for profile modules or media.
- message report context intentionally exposes only the reported message, not
  adjacent private conversation context.
- no limited block/mute pair booleans in report payload.
- no media review state or admin media queue.
- no schema-readiness dashboard showing which feature tables/columns are live.
- no admin deploy-meta display is guaranteed by this audit.
- no immutable audit-log strategy beyond current moderation action rows.

Future migration options:

- Avoid broad moderation rewrites.
- Add module/media report target types only when module/media storage has stable
  ids and fail-closed public reads.
- Add media moderation fields on a media table, not scattered URL fields.
- Prefer computed diagnostics over stored tracking where possible.

Future API work:

- Add `GET /api/admin/diagnostics/schema` or similar, admin-only, returning
  booleans for expected tables/columns/indexes without exposing secrets.
- Add `GET /api/admin/diagnostics/deploy` only if it reads public
  `/deploy-meta.json` or safe build metadata.
- Extend admin report payloads with report-pair block/mute booleans.
- Add admin media context summaries after media storage exists.

Required smoke tests:

- Submit reports for post, profile, room, and message.
- Verify admin report payload includes correct target context and no raw secrets.
- Hide/remove a reported post and verify linked report moves to actioned.
- Verify any diagnostics endpoint is admin-only and returns safe booleans, not
  config paths, credentials, tokens, cookies, or raw exception details.

### 7. Analytics / Revenue Preparation

Current state:

- No analytics, ads, trackers, optional cookies, paid features, affiliate code,
  or revenue implementation is present in this audit scope.

Future data needs to consider under issue #19:

- purely server-side aggregate counts for product health, if approved.
- privacy-preserving event summaries with retention limits, if approved.
- creator/revenue experiments only after trust, moderation, privacy, legal, and
  consent decisions.
- cookie and consent policy updates before any non-essential client-side
  analytics or advertising.

Do not implement from issue #20:

- tracking pixels
- ad scripts
- marketing cookies
- optional cookie consent changes
- paid feature gates
- affiliate links
- analytics SDKs
- user-level behavioral profiles

Required smoke tests for future #19 work:

- Prove no optional analytics/ad scripts load without consent.
- Prove privacy/cookie policy and consent behavior match implementation.
- Prove any server aggregate endpoint does not expose user-level behavior.

### 8. Deployment And Diagnostics

Current state:

- `/api/health` is lightweight and does not touch the database.
- `/api/health?db=1` checks database connectivity.
- migration status/run endpoints require admin session plus migration token.
- deploy docs preserve `public_html/config/` and `public_html/uploads/`.
- `scripts/smoke-live.sh` checks public routes, deploy-meta, API health, and
  lightweight public API reads.

Gaps:

- no single schema-readiness endpoint summarizes which feature tables/columns
  are available.
- migration status requires admin plus token and is not a normal smoke endpoint.
- API-backed smoke tests need a credential/fixture strategy for mutations.
- frontend tests include many mocked flows, but public-readiness verification
  must still exercise a working PHP/MySQL API for auth/posts/replies/rooms/
  profiles/media.
- deploy-meta exists as an expectation in docs, but the audit did not verify
  live deployment state.

Future API work:

- Add an admin-only schema readiness endpoint with safe booleans:
  posts parent/root columns, reblogs, follows, blocks/mutes, notifications,
  rooms2, reports2, badges, profile customization, profile modules, featured
  content, uploads capability, and migration runner availability.
- Keep `/api/health` DB-free; keep `/api/health?db=1` as DB connectivity only.
- Add smoke fixture docs for deployed test accounts and handles without storing
  credentials in the repo.

Required smoke tests:

- Always check `/api/health` and `/api/health?db=1` after deploys.
- Check `/deploy-meta.json` when deployment metadata is expected.
- Run `scripts/smoke-live.sh` for public route/API reads.
- Run API-backed Playwright smoke with `THIA_BASE_URL` and safe credentials for
  any auth, posts, replies, rooms, profiles, media, chat, or moderation changes.
- Do not mark smoke passed if the Vite dev server logs `/api` proxy failures.

## Recommended Sequencing

1. Close this audit as issue #20 after verification and push.
2. Confirm production migration status for existing pending feature migrations:
   `20260611_0001_add_user_blocks_and_mutes.sql`,
   `20260612_0001_add_profile_modules.sql`, and
   `20260613_0001_add_profile_featured_content.sql`.
3. Add schema-readiness/admin diagnostics before adding more product migrations.
4. Add API-backed smoke credential and fixture strategy before deeper mutation
   work.
5. Audit thread/reply integrity before adding `root_id`, permalinks, or deeper
   thread UI behavior.
6. Expand Search only after visibility/ranking/pagination decisions are scoped.
7. Build Profiles v3 in small slices:
   theme tokens, background/banner controls, module expansion, media/music
   cards, layout presets.
8. Add media library/moderation storage before gallery/video/animated media.
9. Keep analytics/revenue in #19 planning until legal/privacy/cookie decisions
   are explicit.

## Suggested Follow-Up Issues

Do not create these from issue #20 unless explicitly asked.

- `[P2] Profiles v3 theme token storage`
- `[P2] Profile background/banner media controls`
- `[P2] Profile module v3 storage/API expansion`
- `[P2] Profile music/media card storage`
- `[P2] Search v1 API/database expansion plan`
- `[P2] Thread/reply integrity audit`
- `[P2] Media moderation/admin diagnostics`
- `[P2] API-backed smoke test harness and credential strategy`
- `[P2] Health/schema readiness endpoint improvements`
- `[P2] Admin report block/mute context diagnostics`

## Migration Discipline For Proposed Work

Any future migration must:

- be a separate issue with explicit acceptance criteria
- be idempotent where possible
- update `backend/database/schema.sql` in the same commit
- be deployed to `public_html/api/migrations/`
- be applied only through the protected migration runner unless a documented
  phpMyAdmin fallback is approved
- not change an already-applied migration file
- include clean storage-readiness API behavior, usually `503` for missing
  required tables or columns
- include API-backed smoke against a working PHP/MySQL path
- document whether the migration was deployed, whether the runner was used, and
  whether `/api/health?db=1` passed after migration

## Closure Criteria For Issue #20

Issue #20 can be closed when:

- this audit is committed and pushed
- standard verification passes
- no production migration was run
- no API/runtime/auth/session behavior was changed
- the issue is updated with the commit SHA and verification status
