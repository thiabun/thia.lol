# Profiles and Badges Foundation

Date: 2026-06-10

This document captures the Phase 3 foundation for profile identity pages and badges. It is planning plus lightweight implementation guidance; it does not introduce a badge economy or profile-editing workflow yet.

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

Not currently present:

- banner URL
- profile theme/accent
- profile background
- structured social link objects
- pinned posts
- badge/user badge tables

### API

Implemented public profile read routes:

- `GET /api/profiles/:handle`
- `GET /api/profiles/:handle/posts`
- `GET /api/profiles/:handle/replies`
- `GET /api/profiles/:handle/rooms`

Profile payload currently exposes:

- user identity, including avatar URL
- bio
- location
- links as a string array
- traits as a string array
- joined/updated timestamps
- public stats for posts, replies, rooms, and reactions

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
- profile tabs for Posts, Replies, Reblogs, Rooms when present, and Badges

Reblogs are disabled because no reblog product/API flow is wired. Badges show an honest coming-later state because no badge schema exists.

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

Proposed badge fields:

- `id`: stable numeric database id.
- `key`: unique stable string such as `founding_member`.
- `name`: short public label.
- `description`: public explanation of what the badge means.
- `rarity`: controlled value such as `common`, `uncommon`, `rare`, `special`, or `staff`.
- `source`: controlled value:
  - `system`
  - `admin-granted`
  - `room-earned`
  - `event`
  - `social`
- `visual_style`: constrained style token for color/material treatment.
- `icon`: constrained icon key, not arbitrary HTML.
- `criteria`: nullable JSON for transparent criteria.
- `created_at`
- `updated_at`

Proposed user badge fields:

- `id`
- `user_id`
- `badge_id`
- `earned_at`
- `source_context`: nullable JSON for room/event/source detail.
- `featured_order`: nullable integer for profile ordering.
- `visibility`: `public`, `hidden`, or `revoked`.
- `progress`: nullable JSON for transparent progress where applicable.
- `created_at`
- `updated_at`

Recommended display rules:

- Profiles show featured public badges first.
- The Badges tab shows public earned badges grouped or sorted by featured order then earned date.
- Hidden badges remain visible only to the owning user after profile privacy decisions are added.
- Revoked badges should not render publicly.
- Criteria/progress should be understandable and non-manipulative.

Recommended first badge sources:

- `admin-granted` for trusted/manual status.
- `system` for verified platform milestones that can be computed safely.
- `room-earned` only after room membership/roles are implemented.
- `event` only for time-limited community events with clear public criteria.
- `social` only after follows/moots exist and abuse controls are in place.

## Follow and Moot Badge Ideas

Follows and moots now provide enough graph data for future social badges, but badge awarding is still deferred until abuse controls, visibility rules, and transparent criteria are implemented.

Future candidates:

- `Early Follower`: followed a profile, room owner, or platform account during an early launch window with criteria shown publicly.
- `Mutual Magnet`: has a meaningful number of mutual follows without relying on hidden ranking or pressure loops.
- `Room Connector`: forms mutual connections through room participation after room membership and room roles exist.

## Deferred Work

- Badge schema and migrations.
- Badge admin award/revoke flow.
- Automatic criteria workers.
- Profile badge featuring controls.
- Profile editing UI and API.
- Banner/theme/background customization.
- Badge awarding from followers, following, moots, or rooms.
