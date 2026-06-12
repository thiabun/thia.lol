# Profile Customization Safety Rules

Date: 2026-06-12

## Purpose

Profiles are moving toward curated personal spaces: identity pages, social profiles, personal websites, creator hubs, and possible blog surfaces. That direction needs guardrails while the module system grows, because customization can break readability, moderation, performance, accessibility, and user trust if it is treated as unlimited page building.

This document defines the safety framework for profile customization and profile modules. The first module foundation exists for safe text, links, and badge showcase modules; embeds, integrations, arbitrary themes, privacy controls, analytics, ads, and blog posts remain out of scope.

The current profile implementation already supports constrained identity customization: avatar, banner, profile background image, accent token, theme token, structured Connections, featured badges, followers/following/moot panels, and Feed / Replies / Rooms tabs. Future work should build on that constrained model instead of adding arbitrary CSS, HTML, JavaScript, or unsupported controls.

## Core Principles

- Expressive but readable: members can show personality, but text, identity, reports, and actions must remain clear.
- Curated, not arbitrary: members choose from known fields, presets, media slots, and module types rather than open-ended page code.
- Beautiful by default: empty or low-content profiles must still feel complete, not unfinished.
- Mobile-safe: every customization must collapse to a single readable mobile stack with no horizontal page scroll.
- Accessible: contrast, focus states, keyboard paths, reduced motion, labels, and semantic structure remain product requirements.
- Moderation-friendly: profile identity, content, links, badges, reports, block/mute/follow/message controls, and admin summaries must stay visible and inspectable.
- Performance-aware: customization should not make profiles heavy, blocking, autoplaying, or dependent on many third-party requests.
- No fake controls: do not show switches, module cards, integration states, badges, or privacy options unless the underlying behavior exists.
- No overclaiming safety or privacy: copy may explain practical behavior, but it must not imply that blocking, moderation, embeds, or privacy controls do more than they actually do.
- No arbitrary CSS, HTML, or JavaScript: user-provided code is not a profile feature.

## Current Baseline

Current profile customization fields:

- `profiles.avatar_url`
- `profiles.banner_url`
- `profiles.profile_background`
- `profiles.profile_accent`
- `profiles.profile_theme`
- `profiles.links`
- featured badge ordering through `user_badges.featured_order`

Current frontend token options:

- Profile accent: default, `sunveil`, `frostveil`, `leaf`, `rose`.
- Profile theme: default, `soft`, `clear`, `glow`.

Current profile text and media constraints:

- Display name: required, maximum 120 characters.
- Bio: optional, maximum 500 characters.
- Location: optional, maximum 120 characters.
- Connections: maximum 10, each input maximum 300 characters.
- Profile images: JPEG, PNG, or WebP uploads, maximum 10 MB, converted to WebP.
- Upload purposes include `avatar`, `banner`, and `profile_background`.
- Upload resize targets are 512x512 for avatars, 1600x600 for banners, and 1920x1080 for profile backgrounds.

Current supported Connection platforms:

- Website
- YouTube
- Twitch
- TikTok
- Instagram
- X / Twitter
- Bluesky
- GitHub
- Discord
- Spotify

Current backend behavior:

- `PATCH /api/me/profile` requires authentication and CSRF.
- Links are normalized and validated server-side.
- External profile links must be HTTPS.
- Website links reject HTML/script-like input.
- Discord allows safe invite URLs or a safe display value.
- Spotify is restricted to `open.spotify.com`.
- Known social platforms use host allowlists when a URL is supplied.
- Profile customization columns are migration-aware and return a clean readiness error when missing.
- Profile modules use `profile_modules` after migration `20260612_0001_add_profile_modules.sql`.
- Public module reads return only public active modules for active users.
- Owner module mutations require authentication and CSRF.
- First-pass module types are `about`, `links`, `featured_badges`, and `custom_text`.
- Module config validation rejects unknown keys, unsafe text, unsafe URLs, arbitrary embeds, and arbitrary HTML/CSS/JS.

Future implementation should keep this baseline and tighten it where needed. In particular, future API work should move profile accent/theme handling from generic token validation to explicit allowlists before those values affect more UI.

## Allowed Customization

Allowed now or likely allowed later, subject to validation:

- Avatar image.
- Banner image.
- Profile background image with controlled opacity/crop/treatment.
- Featured badges from real earned and visible badges.
- Profile accent or preset from a known allowlist.
- Profile theme treatment from a known allowlist.
- Structured Connections using supported platforms and safe URLs.
- Module ordering for known module types.
- Module visibility using known states such as public, hidden, and owner-preview draft if later implemented.
- Featured modules, with a small count limit.
- Featured posts and featured rooms using real eligible public content.
- Safe external links through the existing Connection model or future module-specific URL validation.
- Curated media embeds only when a specific integration is approved, allowlisted, lazy-loaded, and honestly described.
- Profile layout presets if later added, as constrained templates that preserve mobile stacking and action visibility.

Allowed customization must never hide these profile controls or contexts:

- Display name and handle.
- Avatar or equivalent identity marker.
- Report profile.
- Follow/unfollow.
- Message, when the moot relationship permits it.
- Block/unblock.
- Mute/unmute.
- Remove follower, where available to the owner.
- Followers/following/moot counts or their future equivalents.
- Featured badges and badge provenance.
- Joined date or moderation-relevant account context when shown.
- Admin/moderation context for reports.

## Disallowed Customization

The following are not allowed:

- Arbitrary CSS.
- Arbitrary HTML.
- Custom JavaScript.
- Script embeds.
- User-supplied iframe embeds unless a specific integration is reviewed and allowlisted later.
- Autoplay media.
- Unreadable color combinations.
- Flashing, strobing, or rapidly pulsing visuals.
- Deceptive UI that imitates system dialogs, site navigation, login forms, warnings, or moderation notices.
- Impersonation-oriented layouts that make a profile appear to be another user, an admin panel, a login page, or an official platform notice.
- Hidden text or hidden links.
- Content that intentionally breaks layout, overlaps controls, or creates horizontal page scroll.
- External trackers, tracking pixels, analytics tags, or affiliate scripts.
- Unsafe SVG or other scriptable media.
- Unlimited custom sections or unbounded module counts.
- Fake moderation badges.
- Fake trust badges.
- Fake verification markers.
- Fake admin, moderator, founder, partner, sponsor, or official status.
- Integration controls that imply Twitch, Spotify, Apple Music, YouTube, GitHub, Discord, or other services are live when only a link exists.
- Profile privacy controls before privacy behavior is implemented and tested.

## Visual Safety Rules

### Contrast And Readability

- Body text, labels, buttons, tabs, and moderation controls should meet WCAG AA contrast targets where practical: 4.5:1 for normal text and 3:1 for large text or essential UI graphics.
- Profile presets must be tested in both light and dark app themes.
- Accent colors may decorate borders, badges, highlights, and buttons, but they must not become the only readability mechanism.
- User-selected background media must not sit directly behind text without a product-controlled overlay, blur, opacity, or surface treatment.
- Profile content must render as text nodes, not raw HTML.
- Long handles, URLs, display names, and module titles must wrap or truncate without breaking layout.

### Density And Layout

- The profile should remain scannable: identity first, social context second, modules/activity after that.
- Avoid turning every section into a separate floating card. Use cards for repeated items, modules, and modals.
- Limit active profile modules in the first module release. A recommended first limit is 8 public or draft modules per profile.
- Limit featured modules. A recommended first limit is 1 or 2 featured modules.
- Keep module titles short and module bodies bounded by type-specific limits.
- Profile modules must not overlap the primary navigation, mobile bottom nav, footer, report form, or action menus.

### Media

- Avatars should remain square/circular crops at known dimensions.
- Banners should use stable aspect-ratio rules and object-fit crop behavior.
- Profile backgrounds should be decorative only and must not carry required text.
- Image uploads should continue through the authenticated upload pipeline, WebP conversion, size checks, and purpose-specific resizing.
- External hotlinked media should not be used for first-pass modules. Prefer uploaded media references or link cards.
- Media captions, if added later, must be plain text with length limits.

### Motion

- Motion should support orientation and state changes, not distract from reading.
- No flashing or strobing.
- Avoid infinite decorative loops in profile customization.
- Respect `prefers-reduced-motion`.
- Autoplay audio or video is not allowed.
- Embeds, if later approved, must be lazy-loaded and static until the user chooses to interact where practical.

### Mobile Rules

- Mobile profile layout must be a single readable stack.
- No horizontal page scroll.
- Action clusters must wrap without pushing controls off-screen.
- Tabs must remain reachable and readable.
- Module media must scale to the viewport.
- Fixed-position or sticky module UI must not collide with the mobile bottom nav.
- Profile backgrounds must not create giant vertical dead space.

## Content Safety Rules

### Text

- Display names, bios, locations, module titles, module body text, captions, and link labels must be plain text.
- Reject control characters and script-like input.
- Enforce max lengths server-side and client-side.
- Normalize whitespace.
- Preserve useful line breaks only where the module type explicitly supports longer text.
- Do not revive `profiles.traits` as an unstructured public customization surface.

Recommended first module text limits:

- Module title: 80 characters.
- Short module body: 500 characters.
- Long-form module body, if ever added: separate product decision and stronger moderation path required.
- Button/link label: 40 characters.

### Links

- Normalize links at write time.
- Require HTTPS for public external links.
- Reject credentials in URLs.
- Reject HTML, `javascript:`, `data:`, and other script-like schemes.
- Store normalized URL, platform, display label, and original safe value where useful.
- Keep platform allowlists explicit.
- Do not display raw long URLs when a safe label exists.
- Discord may remain a display-only value when it is not a safe invite URL.

### Badges And Trust Markers

- Only persisted real badges from `badges` and `user_badges` may render as badges.
- Only visible, not revoked badges may render publicly.
- Users may feature badges they actually have, within the feature limit.
- Users must not be able to create badge-like trust markers through custom modules, images, labels, or decorative controls.
- Verification, moderation, founder, admin, partner, sponsor, or official markers require controlled product/admin logic.

### Reports And Moderation

- Profile-level reporting covers the identity, links, badges, and modules rendered on the profile until module-level reporting exists.
- Every public module must be attributable to its owner profile.
- Future module-level reporting should be considered if modules become independently meaningful objects with their own content, media, or external links.
- Hidden, deleted, removed, or moderated modules must not render publicly.
- Suspended or deactivated users should not expose public modules.
- Admin summaries should show enough module context to review a report without rendering unsafe embed code or following external resources automatically.

### Adult / Public Testing Considerations

- Avoid manipulative loops, streak pressure, scarcity pressure, and opaque engagement prompts.
- Do not add profile features aimed at minors.
- Do not imply legal, privacy, or safety guarantees beyond implemented behavior.
- External links and embeds can point to off-platform content; copy must be honest about that boundary.
- NSFW, illegal, private-info, impersonation, spam/scam, harassment, and copyright concerns must remain reportable through the existing report categories or a future expanded set.

## Module Safety Rules

Future modules must be known types with bounded settings. A module is not a free-form content block.

Required metadata for each future module:

- `id`
- `owner_user_id`
- `module_type`
- `title`
- `visibility`
- `sort_order`
- `config_json`
- `schema_version`
- `status`
- `created_at`
- `updated_at`

Optional metadata when needed:

- `moderation_status`
- `moderation_reason`
- `reviewed_by`
- `reviewed_at`
- `deleted_at`
- `featured_order`

Allowed initial visibility states:

- `public`: visible on the public profile if the owner is active and the module is valid.
- `hidden`: saved but not visible publicly.
- `draft`: owner-preview only, if preview mode is implemented.

Allowed initial status states:

- `active`
- `hidden`
- `removed`
- `deleted`

Each module type must define:

- Allowed fields.
- Required fields.
- Maximum title length.
- Maximum body length.
- Maximum media count.
- Allowed media purposes.
- Allowed URL hosts.
- Whether embeds are allowed.
- Whether the module is reportable directly or through the profile.
- Fallback state when data is unavailable.
- Empty state when owner-configured content is missing.
- Privacy behavior.
- Performance budget.
- Validation schema version.

Recommended first module catalog constraints:

| Module | Allowed fields | Suggested limits | URLs / embeds | Report behavior | Fallback |
| --- | --- | --- | --- | --- | --- |
| About | title, body | title 80, body 500 | no URLs unless rendered as safe text | profile report first | hide empty body |
| Connections | title, selected connection ids/order | title 80, max 10 links | existing Connection rules, no embeds | profile report first | hide empty list |
| Featured Post | title, post id | title 80, one public eligible post | no external embeds | report post and profile | hide if post unavailable |
| Featured Room | title, room id | title 80, one public eligible room | no external embeds | report room and profile | hide if room unavailable |
| Badge Showcase | title, badge grant ids/order | title 80, max 12 visible badges | no URLs/embeds | profile report first | hide empty list |
| Custom Text | title, body, optional safe link | title 80, body 500, one link | HTTPS allowlist by type, no embeds | profile report first | hide empty body |
| Room Showcase | title, room ids/order | title 80, max 6 public rooms | no external embeds | report room and profile | hide unavailable rooms |

Performance budgets for first modules:

- Keep the public profile initial render mostly static data already needed for the profile.
- Avoid module fan-out that requires one request per module.
- Prefer one profile modules endpoint that returns all public modules for a profile.
- Embeds must not load on initial page render unless explicitly approved.
- Images must use fixed dimensions or aspect ratios to avoid layout shift.
- Module failures should not break the whole profile.

## Integration Safety Rules

All integrations start link-first. Embeds and API-backed cards require a separate product and privacy decision.

General integration rules:

- Link-first before embed-first.
- API keys, OAuth secrets, webhook secrets, and service tokens must never be stored client-side.
- Do not add integrations without clear user-facing copy about what is shown and what is not.
- Do not claim live status unless live status is API-backed and verified.
- Embeds require an explicit allowlist of host, path shape, sandbox behavior, loading behavior, and fallback state.
- Embeds must be lazy-loaded and should not autoplay.
- Third-party content must have a fallback state when blocked, unavailable, region-limited, deleted, or rate-limited.
- Integrated content must remain reportable through the profile or a module-level report path.
- Admin summaries must not execute third-party embeds.

Integration-specific guidance:

- Twitch: link to channel first. Do not show live/offline status unless API-backed. Chat embeds are high risk and should not ship before moderation, privacy, tracking, and performance review.
- Spotify: current Connections allow `open.spotify.com` links. Playlist/song cards should be static link cards first. Embeds require privacy and performance review.
- Apple Music: link card first. Embeds require host allowlist, regional fallback, and privacy review.
- YouTube: current Connections allow YouTube links. Latest-video or channel cards require API quota, moderation, and fallback decisions. Embeds must use explicit allowlists and lazy loading.
- GitHub: repository/project cards should use public URLs only. Do not require OAuth in the first version. Never imply access to private repositories.
- Discord: safe invite URL or display value only. Do not embed Discord chat.
- Bluesky, X / Twitter, TikTok, Instagram: link-only in first passes. Embeds require separate privacy, tracking, moderation, and performance review.

## Data Model Guardrails

Do not add a `profile_modules` migration until the module system issue is explicitly approved. When it is approved, use an idempotent migration and update `backend/database/schema.sql`.

Recommended future table shape:

```sql
CREATE TABLE profile_modules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  module_type VARCHAR(50) NOT NULL,
  title VARCHAR(80) NULL,
  visibility ENUM('public', 'hidden', 'draft') NOT NULL DEFAULT 'public',
  sort_order INT UNSIGNED NOT NULL,
  config_json JSON NOT NULL,
  schema_version INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('active', 'hidden', 'removed', 'deleted') NOT NULL DEFAULT 'active',
  moderation_status VARCHAR(40) NULL,
  moderation_reason VARCHAR(255) NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

Recommended constraints and indexes:

- Foreign key `owner_user_id` to `users.id` with `ON DELETE CASCADE`.
- Foreign key `reviewed_by` to `users.id` with `ON DELETE SET NULL`.
- Index `(owner_user_id, visibility, status, sort_order)`.
- Index `(module_type)`.
- Unique order per owner for active non-deleted modules where database support permits it; otherwise enforce in transactions.
- Maximum module count enforced at write time.
- Module type allowlist enforced at write time.
- JSON schema version stored with every module.
- `config_json` limited by payload size and type-specific validator.
- Media references should point to uploaded media URLs or future media-library rows owned by the same user.
- Safe URL storage should use normalized HTTPS URLs and type-specific host allowlists.
- Owner isolation must prevent selecting another user's hidden/draft posts, private rooms, media, or badge grants.

Module config JSON guardrails:

- Store only known keys for the module type.
- Reject unknown keys unless a migration/schema-version path explicitly permits them.
- Store IDs for internal references, not copied private object payloads.
- Store normalized URLs, not raw user-entered URL strings.
- Do not store HTML, CSS, scripts, iframe markup, or embed code.
- Include enough versioning to migrate old module config safely.

## API Guardrails

Future profile module endpoints must enforce:

- Authenticated session for all mutations.
- CSRF token for all authenticated mutations.
- Ownership checks for profile/module updates.
- Admin/moderator checks for moderation actions.
- Module type allowlist.
- JSON schema validation by module type and schema version.
- Strict field allowlists.
- Server-side length limits.
- Server-side media count limits.
- Server-side URL normalization.
- HTTPS-only external URLs.
- Host allowlists for platform-specific URLs.
- Maximum module count per profile.
- Maximum payload size.
- Sort order normalization in a transaction.
- Visibility/status/moderation checks before public rendering.
- Internal reference checks for posts, rooms, badges, and media.
- Clean `422` errors for invalid input.
- Clean `403` errors for auth/ownership failures.
- Clean `404` errors for missing public modules or profiles.
- Clean `409` errors for migration/readiness conflicts.
- No generic `500` for expected validation failures.

Future public reads should:

- Return only modules owned by active users.
- Return only public, active, non-deleted modules.
- Exclude modules with invalid config rather than breaking the whole profile.
- Exclude modules referencing hidden, removed, deleted, private, or non-owned content.
- Apply current block/mute filters where the existing product behavior requires it.
- Avoid N+1 queries per module.
- Keep `/api/health` lightweight and DB-free.

## Frontend Guardrails

Profile editor rules:

- Existing edit behavior must keep display name, bio, location, avatar, banner, profile background, accent/theme, and Connections working.
- Future module editors must preview changes before save where practical.
- Do not show controls for unsupported modules, integrations, embeds, privacy options, or layout modes.
- Empty states must be honest and should not imply future modules already exist.
- Destructive actions such as delete module, clear media, or remove featured item must confirm.
- Mobile preview is required where practical before broader customization ships.
- Drag/reorder must have a keyboard-accessible fallback such as move up/down buttons.
- Reduced-motion support must be preserved.
- Visual customization must not break readability.
- Profile report, follow, message, block, mute, and admin/moderation controls must remain visible in every preset.
- If a module fails to load, show a calm module-level unavailable state or omit the module according to type rules; do not fail the entire profile.

Rendering rules:

- Render user-generated text as React text nodes.
- Do not use `dangerouslySetInnerHTML` for profile content.
- Use known components for buttons, links, badges, cards, tabs, dialogs, and upload controls.
- Use stable dimensions, aspect ratios, and overflow handling.
- Use accessible labels and focus states.
- External links should open safely with `rel="noopener noreferrer"` where they open a new tab.
- Do not render embed markup from user config.

## Moderation / Reporting Guardrails

- Existing profile reports should cover profile-level content, including identity, Connections, badge display, and first-pass modules.
- Future module-level reporting may be needed when modules can contain significant text, media, featured content, or integrations.
- Admin report summaries should include module type, title, owner, visibility, status, relevant text snippets, normalized URLs, and internal references.
- Admin report summaries should not load third-party embeds or automatically fetch external content.
- Hidden, removed, deleted, or moderation-blocked modules should not render publicly.
- Suspended users should not expose profile modules publicly.
- Deactivated/deleted users, if later implemented, should not expose modules publicly.
- Fake badges, fake verification, and fake official markers must be impossible through module config and normal user media paths.
- Moderator/admin badge and trust markers must remain controlled by badge/admin systems, not module customization.

## Implementation Readiness Checklist

Every future profile customization or module implementation issue should answer these before coding:

- [ ] Which existing fields or new module types are in scope?
- [ ] Is this docs-only, frontend-only, API-only, migration-backed, or a full vertical slice?
- [ ] Does it avoid arbitrary CSS, HTML, JavaScript, and user-supplied iframes?
- [ ] Are all user-editable fields plain text or constrained tokens?
- [ ] Are type-specific max lengths defined?
- [ ] Are module count and featured count limits defined?
- [ ] Are supported media types, upload purposes, and media counts defined?
- [ ] Are external URLs normalized and host-allowlisted?
- [ ] Does the UI avoid fake controls and unsupported integration claims?
- [ ] Does mobile render as a single stack with no horizontal scroll?
- [ ] Does reduced motion still work?
- [ ] Are profile report, follow, message, block, mute, and moderation-relevant context still visible?
- [ ] Are owner, visitor, blocked, muted, and suspended/deactivated states considered?
- [ ] Are public read filters defined for hidden, draft, removed, deleted, private, or unavailable references?
- [ ] Are API errors specified as `422`, `403`, `404`, or `409` where appropriate?
- [ ] Is API-backed smoke required, and is a working API target available?
- [ ] If a migration is needed, is it idempotent, documented, and split into a small deployable step?
- [ ] Are manual cPanel upload paths and migration runner instructions clear?

## Recommended Follow-Up Issues

### #22 Profile Module System Foundation

Suggested acceptance criteria:

- [x] Adds an idempotent `profile_modules` migration only after the table shape is approved.
- [x] Stores owner, module type, visibility, sort order, config JSON, schema version, status, and timestamps.
- [x] Enforces a module type allowlist.
- [x] Enforces maximum module count.
- [x] Adds server-side validation for each first module type.
- [x] Public reads return only public, active, valid modules for active users.
- [x] No arbitrary CSS, HTML, JavaScript, iframes, embeds, or integrations are added.
- [x] Profile report remains available and covers rendered modules.
- [ ] API-backed tests run against a working API path or are marked blocked.

### #23 Profile Module Editor And Preview Mode

Suggested acceptance criteria:

- [ ] Editor supports only module types implemented by #22.
- [ ] Editor includes preview before save where practical.
- [ ] Editor does not show unsupported integrations, embeds, layout modes, or privacy controls.
- [ ] Reordering has keyboard-accessible controls.
- [ ] Destructive actions require confirmation.
- [ ] Mobile preview or mobile layout smoke coverage verifies no horizontal overflow.
- [ ] Empty states are honest and do not advertise unavailable modules.
- [ ] Save/update/delete mutations are CSRF-protected and ownership-checked.

### #24 Featured Posts And Featured Rooms

Suggested acceptance criteria:

- [ ] Featured post selection allows only the owner's eligible public posts or replies.
- [ ] Featured room selection allows only eligible public rooms the owner owns or participates in, according to the approved product rule.
- [ ] Hidden, removed, deleted, private, unavailable, or blocked references do not render publicly.
- [ ] Featured cards preserve normal post/room/profile navigation and report behavior.
- [ ] No copied stale post/room payload is trusted over current API visibility checks.
- [ ] Empty and unavailable states are readable and honest.
- [ ] API-backed smoke covers selection, rendering, and removal against a working API path.

### Later Integration Issues

Create separate issues for each integration family:

- Twitch link/status/card.
- Spotify playlist/song card.
- Apple Music card.
- YouTube channel/latest video card.
- GitHub project cards.
- Expanded social link cards.

Each integration issue should include:

- [ ] Link-first scope.
- [ ] Whether API-backed metadata is required.
- [ ] Secret storage plan, with no client-side secrets.
- [ ] Host allowlist.
- [ ] Privacy and third-party loading copy.
- [ ] Lazy-loading and fallback requirements.
- [ ] Moderation/report behavior.
- [ ] Explicit statement that fake live status is not allowed.

## Non-Goals For The Next Slice

- No profile module editor until module storage and validation exist.
- No embeds until link-first cards and privacy/performance decisions are approved.
- No arbitrary profile themes.
- No profile privacy controls until behavior is implemented and testable.
- No analytics, ads, tracking pixels, or affiliate scripts.
- No module-level monetization.
- No production migrations without a dedicated implementation issue.
