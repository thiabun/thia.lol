# thia.lol Product Audit and Roadmap

Date: 2026-06-10

This audit captures the current product and technical state before adding more social features. It is intentionally scoped to planning: no auth, session, API, database, or runtime behavior changes are part of this document.

Hard product rule: thia.lol must not build addictive mechanics aimed at minors. The platform should be aimed at adults and avoid manipulative dark patterns. Social loops should be rewarding, transparent, user-controllable, and easy to leave or tune.

## 1. Current Architecture Summary

### Frontend

- Vite, React, TypeScript, Tailwind CSS, Motion for React, React Router.
- App routes currently include `/`, `/discover`, `/rooms`, `/rooms/:slug`, `/chat`, `/notifications`, `/@/:handle`, `/admin`, `/login`, `/register`, `/terms`, `/privacy`, `/cookies`, `/community-guidelines`, `/copyright`, `/moderation`, `/legal`, and `/legal/contact`.
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
  - `/api/chat/conversations`, `/api/chat/conversations/:id/messages`, and `/api/chat/conversations/:id/read`.
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
  - `conversations`
  - `conversation_members`
  - `messages`
- Migration runner docs exist in `docs/migration-runner.md`.
- Current migration files:
  - `20260609_0001_add_post_replies.sql`
  - `20260609_0002_add_post_reblogs.sql`
  - `20260609_0003_fix_session_expiry_datetime.sql`
  - `20260610_0001_clean_starter_copy.sql`
  - `20260610_0002_add_user_follows.sql`
  - `20260610_0003_add_notifications.sql`
  - `20260610_0004_add_post_reblogs_created_at_index.sql`
  - `20260610_0005_add_chat_direct_messages.sql`
  - `20260610_0006_add_profile_customization_fields.sql`
  - `20260610_0007_add_badges.sql`
  - `20260610_0008_add_rooms_2_foundation.sql`
  - `20260610_0009_moderation_reports_2_foundation.sql`
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
| Rooms | Working, v2 foundation | Public room list/detail pages, room search, room post feeds, room destination in composer, room creation/editing, customization fields, owner/member roles, join/leave, member counts, member listing, and admin metadata now exist. | Private/member rooms, ownership transfer, full room moderation queues, bans/mutes UI, role management UI, and richer governance workflows are deferred. |
| Profiles | Partial, foundation improved | Public profile pages show avatar, display name, handle, bio, location, links, joined date, public stats, posts, replies, rooms, follower/following/moot context, and real badge display. Registration creates a basic profile. See `docs/profile-badges-plan.md`. | Needs privacy controls, pinned posts, hidden-badge management UI, and richer identity controls. |
| Follows/Moots | Working, foundation | Users can follow/unfollow active profiles, profile payloads expose follower/following/moot counts and current-user relationship state, basic followers/following lists exist, and follow/moot notifications are created. | Needs remove-follower controls, block/mute, deeper feed integration, and chat permission enforcement. |
| Badges | Working, v1 foundation | `badges` and `user_badges` persist real badge definitions and earned grants. Starter definitions are seeded without fake user grants. Public endpoints expose definitions and profile badges, users can feature badges, admins/moderators can grant/revoke badges, profile headers show featured badges, the Badges tab shows earned badges, and badge grants create notifications when notification storage is available. | Automatic earning rules, full hidden-badge management UI, definition editor UI, room-earned/social criteria, and abuse-resistant criteria/progress models are deferred. |
| Likes | Working, partial | Like/unlike maps to `post_reactions.type = glow`; UI shows like count and liked state. | Reaction naming is internally broader than UI. Needs transparent counts, optional hiding/muting decisions, anti-spam/rate-limit review, and adult-focused non-manipulative loop design. |
| Notifications | Working, foundation | Private notifications exist for follows, moots, likes, replies, reblogs, messages, and badge grants. Authenticated users can view notifications, see unread count, mark one read, and mark all read. | Needs push/email decisions, notification preferences, richer grouping, pagination, read-on-open behavior decisions, and safety controls around high-volume activity. |
| Admin/moderation | Working, v2 foundation | Reports can be created from posts with structured target, category, details, reporter, and timestamp fields. Admins/moderators can view open reports first, see category, target type, target summary, reporter/reported summaries, created date, status, details, moderator notes, and action counts. Admins/moderators can mark reports reviewed, dismiss reports, hide/remove reported posts, suspend reported users, and mark linked reports actioned. | Appeals, profile/room/message report UI, room owner/mod queues, room bans/mutes, advanced audit logs, law-enforcement/legal request workflows, admin notification routing, and public report-status views are deferred. |
| Discover/Home | Working, foundation | Home uses `/api/feed/home` for a personalized ranked feed when logged in and a general ranked feed when logged out. Discover uses `/api/feed/discover` for ranked public posts plus active rooms and people to watch only when backed by real data. | Needs user feed controls, chronological mode, hide/mute/block controls, joined-room weighting after memberships exist, and better transparency surfaces. |
| Chat/DMs | Working, v1 foundation | `/chat` is a real private 1:1 direct-message surface for moots only. Conversation/message tables exist, API endpoints enforce authentication and membership, and profiles show Message only for moot relationships. | Attachments, post/room sharing, group chats, push/email notifications, realtime polling/WebSockets, message reporting, blocking, deletion, retention controls, and broader request/inbox behavior are deferred. |
| Legal/cookies/copyright pages | Working, v1 foundation | Public Terms, Privacy Policy, Cookie Policy, Community Guidelines, Copyright/Takedown Policy, Moderation Policy, and Legal Contact pages exist at top-level routes with `/legal` as the policy index/contact page. Footer links, account-popover legal link, report-form policy links, and a discreet localStorage-backed cookie notice are implemented. | Needs legal review, self-service data export, fuller deletion workflows, automated appeals, advanced age/region controls, and deeper retention/account-control decisions. |

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

- Implemented notification types: follow, moot, like, reply, reblog, and message.
- Push notifications, email notifications, preferences, grouping, and high-volume controls are deferred.
- Notifications should stay short, private, and action-oriented.

### Chat as Moots-First DMs

Chat should start as moots-first direct messages:

- DMs allowed by default only between moots.
- Non-moot requests should be a later, explicit product decision.
- Blocking/reporting must exist before broadening reach.
- Message notifications and per-conversation read state now exist for moots-only 1:1 DMs. Media, deletion, retention, and moderation access need decisions before expansion.

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

- Terms of Service exists at `/terms`.
- Privacy Policy exists at `/privacy`.
- Cookie Policy exists at `/cookies`.
- Community Guidelines exist at `/community-guidelines`.
- Copyright/Takedown Policy exists at `/copyright`.
- Moderation Policy exists at `/moderation`.
- Legal Contact and policy index exists at `/legal`; `/legal/contact` redirects there.
- Moderation, reporting, and manual appeal explanation exists in policy copy. A full in-product appeal system is deferred.
- DSA-inspired transparency basics:
  - public contact point exists,
  - report handling explanation exists,
  - moderation action categories are documented,
  - manual appeal path is documented,
  - basic transparency notes for recommender/feed logic are documented.
- GDPR/UK GDPR/PECR/ePrivacy-aware consent basics:
  - essential auth/security cookies are distinguished from optional cookies,
  - avoid non-essential cookies until consent exists,
  - cookie notice acknowledgement is stored locally; optional consent preferences are still deferred until optional cookies exist,
  - privacy contact and data rights language exists,
  - retention, deletion, and account data handling are explained at a v1 level.
- User content license language:
  - users retain ownership,
  - platform receives limited license needed to host, display, process, distribute, moderate, and operate the service,
  - deletion/removal effects are explained with backup, safety, legal, moderation, and earlier-interaction limits,
  - public content visibility and resharing basics are explained.
- Deferred legal/compliance work:
  - lawyer review before treating the policies as final legal advice,
  - self-service data export,
  - automated deletion/account closure workflows beyond manual requests and existing content deletion,
  - full moderation appeals/status system,
  - advanced age, country, and region controls,
  - detailed retention schedule and data-processing inventory,
  - optional analytics/marketing consent controls if those tools are ever introduced.

## 7. Prioritized Implementation Roadmap

### Phase 1: Product Shell, Navigation, and Copy Cleanup

Goal: make the current platform shell coherent before deeper features.

- Remove Admin from primary desktop nav; keep Admin inside account popover for admins only.
- Add Chat nav placeholder only if it clearly communicates unavailable/coming-soon state.
- Clarify Home vs Discover copy.
- Decide whether Home is logged-in-first or public-first.
- Clean up any remaining labels that imply missing features are complete.
- Legal/trust foundation pages now exist; keep future edits practical and avoid overclaiming compliance.
- Verify smoke tests against a working API path for any API-backed changes.

### Phase 2: Rooms

Goal: turn rooms into real community spaces.

- Rooms 2.0 foundation implemented:
  - public-only room creation with validated name, slug, summary, mood, accent, icon, banner, and rules fields.
  - idempotent `room_memberships` storage with owner, moderator, and member roles plus muted/banned foundation fields.
  - creators become room owners and existing `created_by` owners are backfilled as owner memberships.
  - room detail pages show banner, icon, summary, rules, owner/mod markers, member count, post count, join/leave, posting, and role-gated edit controls.
  - room index cards show customization, owner, joined state, member counts, and post counts.
  - admin room metadata shows ownership, member counts, post counts, and a direct room link.
  - room icon and banner uploads use authenticated `/api/uploads/image` purposes.
  - `room_owner` badge is granted when a member creates their first public room if badge storage is ready.
- Deferred room work:
- Add room-level reporting and moderation context.
- Decide private/member room rollout only after access controls are tested.
- Add ownership transfer.
- Add room bans/mutes UI and role management UI.
- Add room moderation queues and audit views.

### Phase 3: Profiles and Badges

Goal: make identity feel owned and expressive without becoming chaotic.

- Foundation document added in `docs/profile-badges-plan.md`.
- Public profile pages now use real API data for posts, replies, reblogs, rooms, and badges.
- Add profile editing.
- Add customization fields with strict design constraints.
- Badge v1 implemented:
  - `badges` and `user_badges` schema.
  - Seeded definitions for `founder`, `early_user`, `bug_hunter`, `moderator`, `room_owner`, and `mutual_magnet`.
  - Public badge definitions and profile badge endpoints.
  - Admin/moderator grant and revoke flow.
  - Profile header featured badges and Badges tab display.
  - Current-user featured badge ordering.
- Deferred:
  - automatic badge earning rules.
  - badge definition editor UI.
  - full hidden-badge management UI.
  - compact author-surface badge display.
  - privacy/user-control decisions beyond v1 visibility and featuring.

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
  - Message notifications are created for the other direct conversation member without exposing message content in notification payloads.
  - Badge grant notifications are created when a moderator/admin grants a badge.
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

- Foundation implemented:
  - `conversations`, `conversation_members`, and `messages` schema exists for private 1:1 direct conversations.
  - Direct conversations are uniquely keyed by the two member ids, so creating the same moot DM returns the existing conversation instead of duplicating it.
  - `GET /api/chat/conversations` lists only conversations the authenticated user belongs to.
  - `POST /api/chat/conversations` accepts a target handle or user id and only creates/returns a direct conversation when both users follow each other.
  - `GET /api/chat/conversations/:id/messages` and `POST /api/chat/conversations/:id/messages` enforce membership server-side.
  - `POST /api/chat/conversations/:id/read` stores the authenticated member's read timestamp.
  - Message bodies are required, trimmed, capped at 2000 characters, and rendered through React text nodes.
  - `/chat` now has logged-out, loading, empty, conversation list, selected conversation, message list, composer, send, and error states.
  - Profiles show Message only when the viewer is logged in, is not viewing their own profile, and the profile relationship is a moot.
  - Message notifications are created for the recipient only and do not include message body content.
- Deferred:
  - Attachments.
  - Sharing posts or rooms into chat.
  - Group chats.
  - Push/email notifications.
  - Realtime polling, typing indicators, or WebSockets.
  - Message reporting, blocking, deletion, retention controls, and broader non-moot request/inbox behavior.

### Phase 9: Legal, Trust, and Compliance Polish

Goal: make the public trust layer match the product.

- Foundation implemented:
  - `/terms`, `/privacy`, `/cookies`, `/community-guidelines`, `/copyright`, `/moderation`, and `/legal` are public routes.
  - `/legal/contact` redirects to `/legal` for a single clean contact surface.
  - The footer contains discreet legal/trust links and the account popover includes Legal.
  - A small cookie notice explains necessary cookies and states that analytics/marketing cookies are not currently used.
  - Report forms link to Community Guidelines and Moderation Policy.
- Deferred:
  - legal review before broader launch.
  - self-service data export.
  - automated account deletion and content-retention workflows.
  - full moderation appeal/status system.
  - advanced age and region controls.
  - optional-cookie consent preferences if analytics or marketing tools are introduced later.

### Phase 10: Moderation / Reports 2.0 Foundation

Goal: make reporting structured enough for practical admin review without building a full case-management system.

- Foundation implemented:
  - Report categories are standardized as `harassment`, `hate`, `sexual_content`, `non_consensual_content`, `private_info`, `spam_or_scam`, `impersonation`, `copyright`, `violence_or_threats`, `self_harm`, `illegal_content`, and `other`.
  - Post report UI asks "What's wrong?", captures optional details, shows a clear "Report sent" success state, and links to `/community-guidelines`, `/moderation`, and `/copyright` when copyright is selected.
  - `/api/reports` accepts `targetType`, `targetId`, `category`, and optional `details`; old `reason` values map into canonical categories for compatibility.
  - Post reports are implemented. Existing profile/user reporting remains API-compatible but no public profile report UI is exposed yet.
  - Room and message targets are intentionally deferred and rejected by the API until their moderation context is designed.
  - `/api/admin/reports` is limited to admins/moderators and returns category, target, reporter, reported user, post summary, review, action, and note fields.
  - Admins/moderators can mark reports reviewed, dismiss reports, hide or remove reported posts, and suspend reported users. Hide/remove/suspend actions mark linked reports as `actioned`.
  - Report statuses are `open`, `reviewed`, `dismissed`, and `actioned`.
- Deferred:
  - Appeals and user-visible report/action status.
  - Public profile, room, and message report UI.
  - Room owner/mod report queues, room bans, room mutes, and room-specific enforcement logs.
  - Advanced immutable audit logs, moderation analytics, and transparency exports.
  - Law-enforcement, legal request, emergency escalation, and rights-holder workflow tooling.
  - Admin/mod notification routing for new reports.

## 8. Immediate Non-Feature Follow-Ups

- Confirm the production migration state, especially whether `post_reblogs` and `post_reblogs_created_at_index` exist and whether any schema drift exists outside committed migrations.
- Decide whether public registration remains open, restricted, or invite/admin-controlled while moderation capacity is small.
- Have the v1 legal/trust pages reviewed before growing rooms, chat, or discovery.
- Keep future smoke tests honest: API-backed behavior must be tested against a working local PHP API or deployed base URL.
