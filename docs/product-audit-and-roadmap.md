# thia.lol Product Audit and Roadmap

Date: 2026-06-10

This audit captures the current product and technical state before adding more social features. It is intentionally scoped to planning: no auth, session, API, database, or runtime behavior changes are part of this document.

Hard product rule: thia.lol must not build addictive mechanics aimed at minors. The platform should be aimed at adults and avoid manipulative dark patterns. Social loops should be rewarding, transparent, user-controllable, and easy to leave or tune.

## 1. Current Architecture Summary

### Frontend

- Vite, React, TypeScript, Tailwind CSS, Motion for React, React Router.
- App routes currently include `/`, `/discover`, `/rooms`, `/rooms/:slug`, `/chat`, `/@/:handle`, `/admin`, `/login`, and `/register`.
- Main shell includes desktop navigation, mobile bottom dock, account menu, theme toggle, and post composer modal.
- API access is centralized through `src/lib/apiClient.ts` and `src/lib/api.ts`.
- Frontend user content rendering uses React text nodes in inspected surfaces; no `dangerouslySetInnerHTML` use was found.

### PHP API

- cPanel-friendly PHP API lives in `api/`, with routing in `api/index.php`.
- Main implemented areas:
  - `/api/health` and `/api/health?db=1`.
  - `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`.
  - `/api/posts`, `/api/posts/:id`, `/api/posts/:id/replies`, `/api/posts/:id/like`, `/api/posts/:id/reactions`.
  - `/api/feed/home` and `/api/feed/discover`.
  - `/api/profiles/:handle`, `/api/profiles/:handle/posts`, `/api/profiles/:handle/follow`, `/api/profiles/:handle/followers`, `/api/profiles/:handle/following`.
  - `/api/rooms`, `/api/rooms/:slug`, `/api/rooms/:slug/posts`.
  - `/api/stats`.
  - `/api/reports`.
  - `/api/admin/reports`, `/api/admin/posts/:id/hide`, `/api/admin/users/:id/suspend`, `/api/admin/reports/:id/resolve`.
  - `/api/admin/migrations/status` and `/api/admin/migrations/run`.
- Auth uses hashed passwords, hashed session tokens, HttpOnly/Secure/SameSite=Lax cookies, CSRF tokens for mutating authenticated requests, and basic auth rate limits.
- Moderation and admin endpoints exist, but policy pages and user-facing appeal flows do not.

### Database and Migrations

- Baseline schema is in `backend/database/schema.sql`.
- Core tables in the baseline schema:
  - `users`
  - `profiles`
  - `rooms`
  - `posts`
  - `post_reactions`
  - `user_follows`
  - `sessions`
  - `auth_rate_limits`
  - `reports`
  - `moderation_actions`
- Migration runner docs exist in `docs/migration-runner.md`.
- Current migration files:
  - `20260609_0001_add_post_replies.sql`
  - `20260609_0002_add_post_reblogs.sql`
  - `20260609_0003_fix_session_expiry_datetime.sql`
  - `20260610_0001_clean_starter_copy.sql`
- Reblog migration exists and Phase 7 wires a real reblog product flow.

### Deployment

- Static build output is `dist/`.
- Production web root is `public_html/`.
- Correct deployment invariant: contents of `dist/` go directly into `public_html/`, not `public_html/dist/`.
- PHP API deployment target is `public_html/api/`.
- Config target is normally `public_html/config/config.php`, protected by `public_html/config/.htaccess`; real config and secrets are not committed.
- Deployment automation docs exist in `docs/deployment-automation.md`.

### Playwright and Testing Status

- Playwright is configured in `playwright.config.ts`.
- Tests live under `tests/smoke/`.
- Package scripts include:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run optimize:assets`
  - `npm run build`
  - `npm run test:e2e`
  - `npm run test:smoke`
- Smoke tests cover some UI layout behavior, account menu behavior, auth persistence, composer layout, and retired mock copy checks.
- Smoke tests can run against local Vite or a deployed base URL via `THIA_BASE_URL`.
- API-backed smoke tests require a real reachable API path. A Vite-only local server without local PHP API support is incomplete for auth/posts/replies/rooms/profiles/API-backed UI verification.

## 2. Current Feature Inventory and Classification

| Feature | Classification | Current State | Main Product Gaps |
| --- | --- | --- | --- |
| Auth | Working, partial | Register, login, logout, session persistence, CSRF, cookie diagnostics, rate limiting, admin setup support. | Needs broader account settings, password reset/email verification decisions, consent/legal integration, production hardening review. |
| Posts | Working, partial | Public top-level posts can be created, listed, deleted by author, hidden by moderators/admins, and shown in home/discover/profile/room feeds. | No media uploads, drafts, editing UI, visibility controls, audience controls, advanced moderation states, or feed ranking. |
| Replies | Working, partial | Replies exist through `parent_id`, thread modal, reply creation, reply counts, ordered reply loading, and reply notifications. | No deep permalink/thread page, nested reply product decision, or moderation/visibility UX beyond inherited post systems. |
| Reblogs | Working, foundation | `post_reblogs` stores one reblog per post/user. API routes support reblog/undo, post payloads expose counts/state/context, Home can label followed-user reblogs, profile Reblogs is API-backed, PostCard has a Reblog action, and reblog notifications are created. | Quote-posts are deferred. Needs production tuning for duplicate feed rows, richer notification grouping, and longer-term safety controls around high-volume resharing. |
| Rooms | Partial, needs design/product decision | Public room list/detail pages, room search, room post feeds, room destination in composer, and room metadata exist. | No room creation UI, memberships, roles, moderators, rules, join/leave, private/member rooms, room moderation surface, or subreddit/community-style governance model. |
| Profiles | Partial, foundation improved | Public profile pages show avatar, display name, handle, bio, location, links, joined date, public stats, posts, replies, rooms, follower/following/moot context, and honest disabled/coming-later surfaces for unsupported areas. Registration creates a basic profile. See `docs/profile-badges-plan.md`. | No profile editing UI/API, banner/theme/background customization, privacy controls, pinned posts, badge persistence, or rich identity controls. |
| Follows/Moots | Working, foundation | Users can follow/unfollow active profiles, profile payloads expose follower/following/moot counts and current-user relationship state, basic followers/following lists exist, and follow/moot notifications are created. | Needs remove-follower controls, block/mute, deeper feed integration, and chat permission enforcement. |
| Badges | Planned, no persistence yet | No badge/user badge tables exist. Profile UI has an honest Badges coming-later state, and the proposed badge/user-badge model is documented in `docs/profile-badges-plan.md`. | Add small schema, admin grant/revoke path, featured ordering, visibility controls, and transparent criteria only after the model is approved. |
| Likes | Working, partial | Like/unlike maps to `post_reactions.type = glow`; UI shows like count and liked state. | Reaction naming is internally broader than UI. Needs transparent counts, optional hiding/muting decisions, anti-spam/rate-limit review, and adult-focused non-manipulative loop design. |
| Notifications | Working, foundation | Private notifications exist for follows, moots, likes, replies, and reblogs. Authenticated users can view notifications, see unread count, mark one read, and mark all read. | Needs push/email decisions, notification preferences, richer grouping, pagination, read-on-open behavior decisions, and safety controls around high-volume activity. |
| Admin/moderation | Working, partial | Reports can be created from posts; admins/moderators can view report queue, hide posts, suspend users, resolve/dismiss reports, and log moderation actions. | Admin still appears in desktop nav for admins and should move only into account popover. Needs appeal flow, policy pages, moderation transparency, audit views, and better user-facing report status decisions. |
| Discover/Home | Working, foundation | Home uses `/api/feed/home` for a personalized ranked feed when logged in and a general ranked feed when logged out. Discover uses `/api/feed/discover` for ranked public posts plus active rooms and people to watch only when backed by real data. | Needs user feed controls, chronological mode, hide/mute/block controls, joined-room weighting after memberships exist, and better transparency surfaces. |
| Chat/DMs | Placeholder, needs design/product decision | `/chat` exists as a coming-soon page and primary nav item. No conversation/message tables, API, or working messaging UI exist. | Define moots-first DMs, request/inbox behavior, blocking/reporting, safety defaults, retention, notifications, and abuse controls before implementation. |
| Legal/cookies/copyright pages | Missing, needs design/product decision | Auth cookie implementation exists, but no public Terms, Privacy, Cookie Policy, Community Guidelines, Copyright/Takedown Policy, or consent preference pages were found. | Need legal copy, consent model, user content license terms, reporting/appeal explanations, and transparency basics. |

## 3. Product Direction

### Rooms as Community Spaces

Rooms should become subreddit/community-style spaces: topic-centered, browseable, and governed by room-level rules and moderators. A room should eventually have:

- Clear topic, description, rules, visibility, and moderation stance.
- Join/leave membership where relevant.
- Room roles such as owner, moderator, member, muted/banned.
- Room-level post permissions and reporting context.
- Public room discovery that does not require algorithmic pressure to participate.

### Profiles as Customizable Identity Pages

Profiles should be member-owned identity pages, not just author headers. They should support:

- Display name, avatar, bio, links, traits, location, and optional profile sections.
- Customization that fits Sunveil/Frostveil without letting pages become unreadable or unsafe.
- Pinned content and room/follow context.
- Badge display with user control over ordering or visibility.
- Privacy and safety choices that are understandable.

### Badges as Earned Status Markers

Badges should be earned status markers, not engagement bait. They should communicate trust, contribution, participation, or platform milestones in a way users can understand.

Guidelines:

- Avoid streaks, scarcity pressure, or mechanics that exploit compulsion.
- Prefer transparent criteria and manual/admin-reviewed badges where trust matters.
- Let users control which badges appear prominently on their profile.
- Include revoke/hide paths for moderation and user preference.

### Follows/Moots as Core Social Graph

The platform needs a social graph before meaningful feeds, chat, and identity features can mature.

- Follow: one-way interest signal.
- Moot: mutual follow or explicitly mutual connection, depending product decision.
- Social graph should power Home, profile context, chat permissions, notifications, and safety controls.
- User controls must include unfollow, remove follower/moot where appropriate, block/mute later, and feed preference controls.

### Discover/Home as Algorithmic Feeds

Home and Discover should be distinct:

- Home: primarily people and rooms the user chose, with transparent ranking and chronological controls.
- Discover: public exploration across rooms, people, and posts, with clear labels for why something appears.

Algorithmic behavior should be simple and explainable at first: recency, followed people, joined rooms, room activity, replies, likes, and moderation-safe popularity windows. Avoid opaque engagement maximization.

### Notifications as Private Feedback

Notifications should tell a member when someone directly interacts with them without becoming a pressure loop.

- Implemented notification types: follow, moot, like, reply, and reblog.
- Push notifications, email notifications, preferences, grouping, and high-volume controls are deferred.
- Notifications should stay short, private, and action-oriented.

### Chat as Moots-First DMs

Chat should start as moots-first direct messages:

- DMs allowed by default only between moots.
- Non-moot requests should be a later, explicit product decision.
- Blocking/reporting must exist before broadening reach.
- Message notifications, read state, media, deletion, retention, and moderation access need decisions before implementation.

### Admin Navigation

Admin should be removed from the main desktop navigation and live inside the account popover for admins only. The current account popover already includes Admin for admins, but the desktop nav still includes Admin for admins. That should be cleaned up in Phase 1.

## 4. Navigation Proposal

### Desktop

- Home
- Discover
- Rooms
- Chat
- Post
- Account popover
  - Profile
  - Settings/account actions when added
  - Admin for admins only
  - Log out

### Mobile

- Home
- Discover
- Post
- Rooms
- Chat

Notes:

- Post should remain a primary creation action.
- Admin should not occupy primary navigation.
- Chat currently links to an honest coming-soon placeholder. Do not add working messaging until the product has a moots/social graph and safety model.

## 5. Suggested Database Areas to Audit Later

- `follows`
- `room_memberships`
- `room_roles` / room moderators
- `badges`
- `user_badges`
- Profile customization
- `conversations` / `messages`
- notification preferences and delivery settings
- `reports` / moderation actions
- Consent and cookie preferences

Specific audit questions:

- Which tables already exist in production but not in the baseline schema?
- Which migrations have been applied on production?
- Does the migration runner record all schema changes reliably?
- Which foreign keys and indexes are needed before feeds/chat scale?
- Which data needs retention, deletion, export, or user control for privacy compliance?

## 6. Legal and Compliance Checklist

- Terms of Service.
- Privacy Policy.
- Cookie Policy.
- Community Guidelines.
- Copyright/Takedown Policy.
- Moderation, reporting, and appeal flow.
- DSA-inspired transparency basics:
  - public contact point,
  - report handling explanation,
  - moderation action notice language,
  - appeal path,
  - basic transparency notes for recommender/feed logic.
- GDPR/UK GDPR/PECR/ePrivacy-aware consent basics:
  - distinguish essential auth/security cookies from analytics/optional cookies,
  - avoid non-essential cookies until consent exists,
  - store consent preferences if optional cookies are introduced,
  - provide privacy contact and data rights language,
  - explain retention, deletion, and account data handling.
- User content license language:
  - users retain ownership,
  - platform receives limited license needed to host, display, distribute, moderate, and operate the service,
  - clarify deletion/removal effects,
  - clarify public content visibility and resharing rules.

## 7. Prioritized Implementation Roadmap

### Phase 1: Product Shell, Navigation, and Copy Cleanup

Goal: make the current platform shell coherent before deeper features.

- Remove Admin from primary desktop nav; keep Admin inside account popover for admins only.
- Add Chat nav placeholder only if it clearly communicates unavailable/coming-soon state.
- Clarify Home vs Discover copy.
- Decide whether Home is logged-in-first or public-first.
- Clean up any remaining labels that imply missing features are complete.
- Add route/page plan for legal pages without publishing placeholder legal claims as final policy.
- Verify smoke tests against a working API path for any API-backed changes.

### Phase 2: Rooms

Goal: turn rooms into real community spaces.

- Define room model: public/members/private, owner, moderators, members.
- Add `room_memberships` and room role/moderation schema after audit.
- Add room creation/editing flow for approved users or admins.
- Add room rules/about surfaces.
- Add join/leave and member counts based on real membership.
- Add room-level reporting and moderation context.
- Decide private/member room rollout only after access controls are tested.

### Phase 3: Profiles and Badges

Goal: make identity feel owned and expressive without becoming chaotic.

- Foundation document added in `docs/profile-badges-plan.md`.
- Public profile pages now use real API data for posts, replies, reblogs, and rooms, with badge surfaces kept honest until backend support exists.
- Add profile editing.
- Add customization fields with strict design constraints.
- Add badge and user badge schema.
- Add badge display on profile and compact author surfaces.
- Add admin or rules-based badge awarding.
- Add privacy/user-control decisions for badges and profile fields.

### Phase 4: Follows, Moots, and Social Graph

Goal: create the graph that powers feeds, identity, and chat.

- Follow/unfollow, mutual moot detection, profile counts, relationship context, and basic followers/following lists now exist.
- Add remove follower/moot and safety controls as needed.
- Use graph data later for Home ranking, Discover context, notifications, and Chat permissions.

### Phase 5: Discover/Home Algorithms

Goal: separate chosen social context from public discovery.

- Foundation implemented:
  - `GET /api/feed/home` returns public top-level posts ranked for the current viewer when logged in, or a general ranked feed when logged out.
  - `GET /api/feed/discover` returns ranked public top-level posts, active public rooms, and people to watch.
  - Feed post payloads include author, room, body, media URL when present, reply/like counts, current-user liked state, optional reblog count/state/context if the table exists, created time, and lightweight social context for UI labels.
  - Home and Discover no longer share the same recent-only `/api/posts` ordering.
- Current Home score:
  - moot author bonus: `120`
  - followed author bonus: `80`
  - current user's own author penalty: `-45`
  - likes: `likes * 3`
  - replies: `replies * 4`
  - reblogs when available: `reblogs * 5`
  - room activity: up to `12`
  - freshness bonus: `24` within 24 hours, `12` within 72 hours, `6` within 7 days
  - age decay: up to `35`
- Current Discover score:
  - likes: `likes * 3`
  - replies: `replies * 4`
  - reblogs when available: `reblogs * 5`
  - small current-viewer author bonus: `12` for moots, `8` for follows
  - room activity: up to `10`
  - freshness bonus: `30` within 6 hours, `18` within 24 hours, `8` within 72 hours
  - age decay: up to `40`
- Deferred:
  - joined-room weighting after room memberships exist.
  - chronological/feed-control option.
  - hide, mute, block, and preference controls.
  - richer explanation labels beyond relationship and followed-like social proof.
  - production tuning after real usage data, without engagement-maximizing dark patterns.

### Phase 6: Notifications

Goal: give members private feedback when people interact with them.

- Foundation implemented:
  - `notifications` table with recipient, actor, type, optional post/room targets, JSON data, read state, and timestamps.
  - `GET /api/notifications` returns recent private notifications plus unread count.
  - `POST /api/notifications/read`, `POST /api/notifications/:id/read`, and `POST /api/notifications/read-all` mark notifications read.
  - Follow notifications are created when a new follow is inserted.
  - Moot notifications are created for both members when a new follow creates a mutual connection.
  - Like notifications are created when a new `glow` reaction is inserted on another member's post.
  - Reply notifications are created when someone replies to another member's post.
  - The UI exposes notifications through a header bell and `/notifications` page with empty, loading, error, unread, mark-one-read, and mark-all-read states.
- Deferred:
  - Reblog notifications are active through Phase 7.
  - Push notifications and email notifications.
  - Notification preferences.
  - Notification grouping, pagination, and high-volume controls.
  - Read-on-open behavior and richer per-type settings.

### Phase 7: Reblogs

Goal: let members share another member's post into their own profile/feed without building quote-posts yet.

- Foundation implemented:
  - `POST /api/posts/:id/reblog` creates a reblog for the authenticated user with CSRF protection.
  - `DELETE /api/posts/:id/reblog` undoes the authenticated user's reblog with CSRF protection.
  - Reblog create/delete are idempotent, duplicate rows are prevented by `post_reblogs_unique`, and self-reblogs are blocked because product copy does not support them yet.
  - Post payloads include `reblogCount`, `rebloggedByMe`, existing-compatible `rebloggedByCurrentUser`, and optional `rebloggedBy`/`rebloggedAt` context.
  - Home scoring gives a followed-user reblog bonus and can show `@handle reblogged` for followed-user reblogs.
  - Discover ranking uses real `reblogCount`.
  - Profile Reblogs is backed by `GET /api/profiles/:handle/reblogs` and shows only real reblogs.
  - PostCard includes Reblog/Reblogged action copy with count and simple motion.
  - `reblog` notifications are created for another member's post and deduped.
- Deferred:
  - Quote-posts.
  - Reblog-specific feed controls and grouping.
  - High-volume notification grouping and reblog preference controls.

### Phase 8: Chat/DMs

Goal: ship safe, moots-first direct messages.

- Add conversations/messages schema.
- Limit DMs to moots by default.
- Add message report/block flows before or with launch.
- Decide read receipts, typing indicators, deletion, retention, and message notifications.
- Keep Chat in nav only when the feature has a working safety baseline.

### Phase 9: Legal, Trust, and Compliance Polish

Goal: make the public trust layer match the product.

- Publish Terms, Privacy Policy, Cookie Policy, Community Guidelines, and Copyright/Takedown Policy.
- Add reporting/appeal documentation and user-facing moderation notices.
- Add consent preferences before any non-essential cookies or analytics.
- Add transparency copy for feeds/recommendations.
- Review account deletion/export needs before broader launch.

## 8. Immediate Non-Feature Follow-Ups

- Confirm the production migration state, especially whether `post_reblogs` and `post_reblogs_created_at_index` exist and whether any schema drift exists outside committed migrations.
- Decide whether public registration remains open, restricted, or invite/admin-controlled while moderation capacity is small.
- Draft first legal pages before growing rooms, chat, or discovery.
- Keep future smoke tests honest: API-backed behavior must be tested against a working local PHP API or deployed base URL.
