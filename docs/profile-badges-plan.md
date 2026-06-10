# Profiles and Badges Foundation

Date: 2026-06-10

This document captures the Phase 3 foundation for profile identity pages and badges. Badges v1 is now implemented as real persisted profile status objects with admin grant/revoke controls and featured profile display. It does not introduce an automatic badge-awarding engine yet.

## Current Profile Implementation

### Database

Committed baseline profile storage is `profiles`:

- `user_id`
- `display_name`
- `bio`
- `location`
- `avatar_url`
- `links` JSON
- `traits` JSON
- `created_at`
- `updated_at`

Related profile-facing data:

- `users.handle`, `users.role`, and `users.status`.
- `posts` for public posts and replies.
- `rooms.created_by` for public rooms owned by a profile.
- `post_reactions` for current reaction counts.

Badge storage now exists:

- `badges` stores active badge definitions with stable keys, names, descriptions, rarity, source, icon, accent, and creation time.
- `user_badges` stores earned grants with `user_id`, `badge_id`, `granted_by`, reason, earned date, featured order, and visibility.

Still not present:

- structured social link objects
- pinned posts
- automatic badge criteria/progress tables

### API

Implemented public profile read routes:

- `GET /api/profiles/:handle`
- `GET /api/profiles/:handle/posts`
- `GET /api/profiles/:handle/replies`
- `GET /api/profiles/:handle/rooms`
- `GET /api/profiles/:handle/badges`
- `GET /api/badges`

Profile payload currently exposes:

- user identity, including avatar URL
- bio
- location
- links as a string array
- traits as a string array
- joined/updated timestamps
- public stats for posts, replies, rooms, and reactions

Badge payloads expose:

- badge definition: id, key, name, description, rarity, source, icon, accent, active state, created date
- user badge grant: earned date, reason, granting user when available, visibility, and featured order

Implemented authenticated/admin routes:

- `PATCH /api/me/badges/featured` updates the current user's featured badge order, up to three badges.
- `GET /api/admin/badges` lists badge definitions and recent grants for moderators/admins.
- `POST /api/admin/badges/grant` grants a badge to a user by handle and supports an optional reason.
- `POST /api/admin/badges/revoke` revokes a badge grant by handle and badge key.

No profile edit API is currently implemented. Do not create working edit controls until validation, CSRF-protected update routes, and persistence are added.

### Frontend

The public profile route is `/:profileHandle` for `@handle` paths, with `/@/:handle` still present for router compatibility. The profile page uses API data only.

Current surfaced fields:

- avatar
- display name
- handle
- bio
- location
- external links
- joined date
- stats
- profile tabs for Posts, Replies, API-backed Reblogs, Rooms, social graph lists, and Badges
- featured badges in the profile header when a profile has visible earned badges
- all visible earned badges in the Badges tab with name, rarity, source, description, reason, and earned date
- own-profile feature/unfeature controls in the Badges tab
- admin badge management panel for definitions, grant, recent grants, and revoke

Reblogs now use the post reblog API and show only real shared posts. Badges now use real API data only; no mock or placeholder badge grants are rendered.

### Mock/Test Data

Retired starter copy is filtered in the API client and covered by smoke tests. Profile UI should not add fake bios, links, badges, or fallback profile claims.

## Profile Customization Foundation

Supported now:

- avatar URL display through `profiles.avatar_url`
- plain bio
- location
- links as strings
- traits as simple labels

Missing schema/API before profile editing can be shipped:

- profile update endpoint with CSRF checks
- URL validation for avatar and links at write time
- maximum lengths and count limits for links and traits
- optional banner URL field
- optional constrained accent/theme field
- optional background field with strict presets, not arbitrary CSS
- moderation-safe audit fields for profile updates if needed

Recommended first edit shape:

- display name
- bio
- location
- avatar URL
- up to five links

Do not add uploads until storage, scanning/moderation, file limits, and deletion behavior are defined.

## Badge Model

Badges should be meaningful earned/status markers, not decorative filler or engagement pressure. Avoid streaks, scarcity pressure, and hidden criteria.

Implemented badge fields:

- `id`: stable numeric database id.
- `badge_key`: unique stable string such as `founder`.
- `name`: short public label.
- `description`: public explanation of what the badge means.
- `rarity`: `common`, `rare`, `epic`, `legendary`, or `founder`.
- `source`: source label such as `admin-granted`, `system`, `room-earned`, `event`, or `social`.
- `icon`: constrained icon key for UI mapping.
- `accent`: constrained style token.
- `is_active`
- `created_at`

Implemented user badge fields:

- `id`
- `user_id`
- `badge_id`
- `granted_by`
- `reason`
- `earned_at`
- `featured_order`
- `is_visible`

Implemented display rules:

- Profiles show featured visible badges first in the header.
- If a user has visible badges but no explicit featured ordering, the first three earned badges are used as the default featured set.
- The Badges tab shows visible earned badges sorted by featured order, then earned date.
- Users can feature or unfeature up to three badges from their own public badge list.
- Hidden badge API support exists for the featured endpoint, but full hidden-badge management UI is deferred.
- Revoked badges are deleted from `user_badges` and do not render publicly.

Implemented starter definitions:

- `founder`
- `early_user`
- `bug_hunter`
- `moderator`
- `room_owner`
- `mutual_magnet`

These are seeded as badge definitions only. The `room_owner` badge is now automatically granted when a member creates their first public room through Rooms 2.0 creation; other starter badges still require moderator/admin grant.

## Admin Grant Flow

Moderators and admins can open `/admin`, use the Badge management panel, choose a badge definition, enter a handle, add an optional reason, and grant the badge. The grant records the granting account, reason, earned date, and visibility. Regranting an existing badge updates the grant metadata and makes it visible without creating duplicate user badge rows.

Recent grants are shown in the same panel and can be revoked. Revoke removes the `user_badges` row.

When notification storage is available, a first-time grant creates a private `badge_granted` notification for the recipient. Seed creation does not notify anyone.

## Follow and Moot Badge Ideas

Follows and moots now provide enough graph data for future social badges, but badge awarding is still deferred until abuse controls, visibility rules, and transparent criteria are implemented.

Future candidates:

- `Early Follower`: followed a profile, room owner, or platform account during an early launch window with criteria shown publicly.
- `Mutual Magnet`: has a meaningful number of mutual follows without relying on hidden ranking or pressure loops.
- `Room Connector`: forms mutual connections through room participation after room membership and room roles exist.

## Deferred Work

- Automatic criteria workers.
- Full hidden-badge management UI.
- Badge editor UI for creating/updating definitions.
- Criteria/progress JSON for transparent automatic badges.
- Broader room-earned badge rules beyond the first-room `room_owner` grant.
- Social badge rules after abuse controls and visibility rules are stronger.
- Badge awarding from followers, following, moots, or rooms.
