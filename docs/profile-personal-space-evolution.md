# Profile / Personal Space Evolution

> **Status: Active product direction.** Use this for long-term profile and
> personal-space planning. Remaining implementation and product decisions should
> be tracked through issue [#18](https://github.com/thiabun/thia.lol/issues/18)
> and focused follow-up issues, not by extending this document into a task list.

Date: 2026-06-15

Safety rules for future customization and modules are defined in
`docs/profile-customization-safety-rules.md`. Treat that document as required
context before implementing profile modules, module editors, featured content,
or integrations.

The owner-facing customization experience is planned in
`docs/profile-customization-experience.md`. Treat it as the source of truth for
profile editor IA, preview behavior, and future theme/editor direction.

## Purpose

Profiles are already one of the strongest identity surfaces on `thia.lol`, but the current model is still close to a standard social profile: header, bio, connections, badges, counts, and activity tabs. Public Readiness V2 needs profiles to become more flexible and desirable without making the platform feel fragmented, unsafe, unreadable, or impossible to moderate.

The long-term goal is a curated personal space. A profile should be able to act as a social profile, personal website, blog homepage, creator hub, identity page, and showcase for rooms or projects. It should do that while keeping `thia.lol` as the primary product identity and while keeping Thia's profile, for example `/@thia`, as a founder/member space rather than the whole platform.

This document is planning only. It does not implement frontend redesigns, API changes, migrations, integrations, embeds, analytics, ads, private accounts, or paid profile features.

## Profiles v3 - Personal Spaces

Issue [#18](https://github.com/thiabun/thia.lol/issues/18) defines Profiles v3
as the product direction for moving profiles from basic social information pages
into richer personal spaces. The goal is stronger ownership and self-expression
without copying profile-site products one-to-one and without turning profile
customization into unsafe page building.

Profiles v3 should absorb the useful product lessons from richer profile-site
references:

- A full-page visual background can create stronger ownership than a small
  cropped banner.
- A compact identity card can carry name, avatar, status, badges, links, and
  social context without needing many equal-weight stat boxes.
- Music, video, links, and icons can express identity when they are controlled,
  opt-in, and safe.
- Translucent surfaces and media overlays can feel personal, but they become
  unreadable quickly without contrast, dim, blur, and motion rules.
- The current `thia.lol` profile reference shows the main gap: the banner is
  visually cut off, blends into the page background too aggressively, and the
  header reads as a large information card rather than a personal space.

The reference images are product and visual references, not cloning targets.
`guns.lol` is primarily a Linktree/profile-site product; `thia.lol` remains a
social platform where profiles connect to posts, replies, rooms, moots, badges,
reports, moderation, and future modules.

### Product Vision

Profiles v3 are personal spaces that can serve several use cases, in priority
order:

1. Identity surface: who this member is on `thia.lol`, with avatar, name,
   handle, short bio, badges, social context, and safety actions always clear.
2. Social hub: followers, following, moots, rooms, posts, replies, and message
   eligibility in a compact hierarchy.
3. Creator space: featured work, rooms, media, links, music, streams, projects,
   and status when the member wants a richer presence.
4. Content entry point: featured post, featured room, recent activity, and later
   blog/journal surfaces that lead visitors into the rest of the platform.
5. Expressive personal space: theme, background, layout, and modules that let a
   profile feel owned without breaking readability or trust.

Profiles v3 are not:

- Unsafe custom HTML pages.
- Arbitrary CSS or JavaScript playgrounds.
- Random iframe or embed surfaces.
- Pure Linktree clones detached from the social graph.
- Ads, tracker, affiliate, or marketing-cookie surfaces by default.
- Autoplay audio/video traps.
- Moderation nightmares where admins cannot inspect what is rendered.
- A way to make Thia's profile the primary platform identity.

Future analytics, ads, trackers, paid profile features, and optional cookies
need explicit product, legal, privacy, and consent planning before any code is
added. Profiles v3 should leave room for those decisions by using structured
module types and consent-aware extension points, but they are out of scope for
this planning issue.

### Current Problems

The current profile foundation is functional, but several product issues block
the richer personal-space direction:

- Banner media crops unpredictably, scales awkwardly across devices, and can cut
  off the part of the image the owner cares about.
- Banner and background treatments blend into the profile surface too strongly,
  reducing ownership and making uploaded media feel decorative rather than
  intentionally placed.
- Profile header/card density is too high: identity, stats, social context,
  links, badges, owner actions, and tabs compete inside a boxed structure.
- There are too many boxed stats, chips, and bordered groups with similar visual
  weight.
- The profile page communicates information, but it does not yet create the
  stronger sense of vibe and ownership that richer profile products show.
- Earlier Customize Profile passes still felt bulky for routine edits; issue
  #37 now groups editing around Identity, Look, Modules, and Preview so the
  owner flow feels like profile adjustment rather than a dashboard.
- Theme and background controls are limited and not yet expressive enough to
  support clear owner-selected page mood.
- Modules exist, but the catalog is still early and not expressive enough for
  music, media, featured content, creator presence, or richer social identity.

### Capability Priorities

Profiles v3 should be built in small, testable slices. The priority is the
product value and safety order, not a promise that every capability ships.

#### P1 - Foundation Before Integrations

- Compact profile layout refresh that reduces boxed stats, repeated metadata,
  and oversized header/card treatment.
- Better banner/background model with predictable crop, fit, position, overlay,
  blur, dim, and mobile behavior.
- Stronger theme editor using allowlisted accent, surface, text, and focus
  tokens with contrast checks.
- Profile page background image support as a first-class layer, separate from
  the compact identity card.
- Layout presets that preserve mobile stacking and safety action visibility.
- Module ordering and visibility controls using existing safe module storage.
- Compact visitor view with only public, safe, meaningful content.
- Richer owner edit view with preview-first controls, draft/hidden state where
  supported, and no fake public behavior.

#### P2 - Expressive Social And Creator Modules

- Featured post module.
- Featured room module.
- Connections/custom links module with stronger platform presentation.
- Badge showcase module.
- About/status module for a short richer introduction or current mood.
- Gallery/media module after media moderation and storage rules are clearer.
- Creator/live module as a static or link-first card before any live status.
- Compact music player module as a user-initiated link/card first.

#### P3 - Integrations And Rich Media

- Spotify and Apple Music song/playlist cards, starting with safe URL cards.
- YouTube channel/video cards, starting with safe URL cards.
- Twitch channel/live cards, starting with a channel link or static card.
- API-backed metadata only after key ownership, caching, privacy, quota, and
  fallback rules are documented.
- Embeds only after host allowlists, sandbox/loading behavior, cookie/consent
  impact, moderation limits, and performance budgets are approved.
- Video or animated background support only after reduced-motion, mobile
  performance, file size, mute, poster, and fallback behavior are specified.

### Background And Banner Model

The current single "banner" idea is not enough for Profiles v3. Profile media
should become a layered model:

1. Full profile background layer: optional page-level image or video/animated
   media that establishes mood behind the profile content.
2. Compact identity card: readable foreground surface containing avatar,
   display name, handle, bio/status, badges, social context, links, and actions.
3. Header media region: optional true banner or hero strip for users who want a
   distinct header image instead of relying only on a full-page background.

This combination supports both `thia.lol` social readability and stronger
personal ownership. It also makes the old banner problem explicit: a banner is a
banner, not a background, and a background is a decorative layer, not the only
identity surface.

Required controls for uploaded profile visual media:

- `fit`: cover, contain, or fill, with cover as the default for backgrounds and
  a predictable aspect-ratio default for banners.
- `position`: center, top, bottom, left, right, or a small set of combined
  positions.
- Focal point: owner-selectable x/y focal point for cover crops, especially for
  mobile.
- Overlay strength: none, soft, medium, strong, with automatic minimum overlay
  for text readability.
- Blur: none, soft, medium, strong, applied as a rendering treatment rather than
  modifying the uploaded asset.
- Dim: none, soft, medium, strong, with separate light/dark defaults.
- Background span: viewport, profile content, or header-only, with mobile-safe
  defaults.
- Mobile behavior: independent mobile crop/focal point or safe fallback to
  center/contain when the image is narrow.
- Reduced motion behavior: animated backgrounds become static posters; video
  backgrounds do not autoplay for users who prefer reduced motion.
- Data saver behavior: load static poster or compressed image before heavy
  media; never require a video background for profile comprehension.
- File limits: keep existing image limits as the baseline; future video/animated
  media needs stricter duration, dimensions, size, encoding, and poster limits.
- Safe fallbacks: if media is missing, blocked, moderated, too heavy, or fails
  to load, render the default Sunveil/Frostveil profile surface with readable
  identity.

Open product decision: the first implementation should likely ship the full
profile background layer plus compact identity card before adding a separate
advanced banner editor. That directly solves ownership and banner blending while
keeping the current banner as a compatibility field until the new model is
ready.

### Music, Audio, And Video Rules

Music and rich media can make profiles feel owned, but the site must not become
hostile to visitors.

Rules:

- No autoplay audio by default.
- Audio playback must be user-initiated.
- A compact music player can show title, artist/source, cover image, progress
  only when real, and play/pause controls only when playback is actually
  supported.
- Link-first music cards are preferred before embeds or API playback.
- Video backgrounds must always be muted.
- Video backgrounds must have a poster image and must not contain required text.
- Respect `prefers-reduced-motion`; animated/video backgrounds fall back to the
  poster image.
- Respect data saver and mobile performance constraints where detectable.
- Safe embeds only: no user-supplied iframe markup, no arbitrary embed code, and
  no third-party scripts before privacy/cookie review.
- External provider cards must be honest: link, static metadata, API-backed, or
  embed. Do not fake live or now-playing state.
- Music and video modules must remain reportable through profile reporting at
  first, with module-level reporting considered once modules are independently
  meaningful.
- External provider privacy implications must be visible in planning before
  implementation, especially for Spotify, Apple Music, YouTube, and Twitch.
- Upload size, duration, encoding, storage, and bandwidth limits must be defined
  before accepting non-image profile media.
- Copyright and licensing concerns must be explicit: `thia.lol` should not host
  arbitrary copyrighted songs or videos without a separate legal/moderation
  plan.

### Theme And Customization Guardrails

Profiles v3 may allow:

- Accent color from an allowlist.
- Surface color/treatment from an allowlist.
- Text color from safe preset pairings, not arbitrary color pickers at first.
- Focus and action color tokens that preserve keyboard visibility.
- Full profile background image with controlled fit, position, overlay, blur,
  dim, and span.
- True banner/header media with crop controls if retained.
- Profile card surface treatment such as solid, translucent, frosted, or softly
  bordered presets.
- Module order.
- Module visibility where implemented.
- Layout preset, such as classic social, showcase, or creator space, with mobile
  resolving to a readable stack.
- Limited reviewed decorations, such as subtle particles or frame treatments,
  only if they pass motion, contrast, performance, and moderation review.

Profiles v3 must not allow:

- Arbitrary HTML.
- Arbitrary CSS.
- Arbitrary JavaScript.
- User-supplied iframe or embed markup.
- External trackers, tracking pixels, ad scripts, affiliate scripts, or
  analytics tags.
- Seizure-risk flashing, strobing, rapidly pulsing, or forced motion.
- Unbounded page building or unlimited modules.
- Fake verification, admin, founder, partner, sponsor, moderation, privacy, or
  official status.
- Decorations that hide report, follow, message, block, mute, remove-follower,
  admin, or moderation context.

Guardrails:

- Presets must meet contrast targets for normal text, large text, icons, focus
  states, disabled states, and destructive actions.
- Public profile text must render as text nodes.
- Mobile must stay readable with no horizontal overflow.
- Every media slot must have file size, dimensions, type, and fallback rules.
- Animated treatments must respect reduced motion and avoid infinite distracting
  loops.
- Background media must never be the only way to understand the profile.
- Moderated, removed, deleted, hidden, or unavailable media/modules must fail
  closed and not render publicly.
- Default Sunveil/Frostveil themes must remain complete and attractive for users
  who never customize.

### Profile Layout Direction

Profiles v3 should use the issue #14/#32 UI direction: clear, easy, modern,
sleek, refined, friendly, compact, and alive.

Layout direction:

- Lead with identity and vibe, not stats.
- Use one compact identity card or foreground region over a controlled page
  background.
- Keep avatar, display name, handle, bio/status, primary relationship action,
  report/safety menu, and owner edit action easy to find.
- Collapse stats into compact social context instead of a grid of equal-weight
  boxes.
- Keep Connections as recognizable icon/link rows or a module, not a large
  boxed section by default.
- Put modules and recent content below identity in an order that supports
  scanning.
- Keep Feed, Replies, and Rooms available, but consider whether activity becomes
  a section within the personal space rather than the visual center.
- Owner-only prompts should be short and absent from public visitor view.
- Cards should frame actual modules, posts, rooms, or modals, not every
  subsection.

Avoid:

- Too many cards.
- Nested cards.
- Too many borders.
- Giant stat blocks.
- Repeated metadata.
- Decorative empty space.
- Explanatory copy inside the public profile view.

Prioritize:

- Identity.
- Vibe.
- Key social context.
- Modules.
- Recent content.
- Safety actions.
- Fast mobile readability.

### Customize Profile v3

Customize Profile v3 should become a compact, preview-first studio rather than
a large database-style form.

Principles:

- Compact: routine edits should require fewer visible controls at once.
- Bloat-less: remove duplicate helper copy and collapse advanced controls until
  needed.
- Clear: group by what the owner is trying to shape.
- Preview-first: desktop should show a live preview where space allows; mobile
  should have an easy preview mode.
- Honest: no controls for unsupported embeds, integrations, layout modes,
  privacy states, or theme values.
- Safe: all controls map to constrained tokens, validated media, or known module
  settings.

Recommended groups:

- Identity: display name, bio/status, location, avatar, handle display.
- Theme: preset, accent, surface, text pairing, focus/action treatment.
- Background: page background, banner/header media, fit, position, focal point,
  overlay, blur, dim, mobile fallback.
- Modules: add/edit/reorder/hide supported modules; start with About, Custom
  Text, Connections, Badge Showcase, Featured Post, Featured Room, and later
  Music.
- Connections: link cards with platform icons, validation, handle helpers, and
  explicit outbound behavior.
- Music module: link-first card controls before any embed or hosted playback.
- Safety/visibility: module visibility, hidden/draft state where implemented,
  and reminders that reports/safety actions remain visible.

The modal should not become a full page builder. Advanced media and theme
controls can live behind compact disclosure controls, but the public preview
must make the result clear before save.

### Safety, Moderation, Privacy, Legal, And Performance

Risks and mitigations:

| Risk | Mitigation |
| --- | --- |
| Uploaded media contains unsafe, NSFW, copyrighted, impersonating, or private-info content. | Keep profile reporting visible, add admin media context, preserve moderation categories, and define media removal behavior before expanding media types. |
| Copyrighted music or videos are uploaded or embedded in misleading ways. | Start link-first; do not host arbitrary songs/videos; require separate legal and moderation plan before hosted audio/video. |
| External providers track visitors or set optional cookies. | Do not load embeds/scripts by default; perform privacy/cookie review; require consent planning before optional trackers or third-party scripts. |
| Heavy images, videos, or animated backgrounds slow mobile profiles. | Enforce file size, dimension, duration, encoding, poster, lazy-load, and data-saver rules; keep static fallback. |
| Animated backgrounds harm accessibility. | Respect reduced motion, avoid flashing/strobing, provide static poster fallback, and limit decorative loops. |
| Custom themes make text unreadable. | Use preset pairings, contrast checks, minimum overlays, and default fallback themes. |
| Profile impersonation or fake trust markers. | Keep badges/trust markers controlled by badge/admin systems; reject deceptive module labels and official-looking decorations. |
| Unsafe links or embeds expose scams or malicious content. | Normalize URLs, require HTTPS, use host allowlists, reject script schemes, and keep external content reportable through the profile. |
| Modules become hard to moderate. | Use known module types, bounded settings, profile-level reporting first, and module-level reporting/admin summaries when modules become substantial. |
| Public visitor view becomes cluttered or confusing. | Limit module counts, provide layout presets, hide empty modules publicly, and keep owner prompts owner-only. |
| Ads, trackers, analytics, paid cosmetics, or sponsorships appear without consent/legal planning. | Keep all monetization/tracking out of Profiles v3 implementation until a separate analytics/revenue/legal issue approves scope. |
| Admins cannot diagnose what rendered. | Store structured settings, normalized URLs, media references, module type/version, and moderation status; avoid executing third-party embeds in admin summaries. |
| Mobile layout breaks. | Require single-stack mobile rendering, stable aspect ratios, no horizontal overflow, and screenshot/smoke coverage for implementation issues. |

### Product Decisions Made For Issue #18

- Profiles v3 are personal spaces connected to the social platform, not
  standalone profile-site clones.
- The first visual model should separate full-page background from the compact
  identity card and any true banner/header region.
- Banner cropping/scaling is a product bug in the current model and needs
  explicit crop, fit, focal point, overlay, blur, dim, and mobile controls.
- Music and media are valid profile-expression goals, but audio must be
  user-initiated and video backgrounds must be muted with reduced-motion
  fallback.
- Integrations start link-first, then static cards, then API-backed cards, and
  only later reviewed embeds.
- Theme controls should be allowlisted presets and token pairings, not arbitrary
  user CSS.
- Customize Profile v3 should be compact and preview-first, grouped by owner
  intent rather than database fields.
- Follow-up implementation should be split into focused issues after this
  planning direction, with no migrations or code changes in this issue.

### Open Product Questions

- Should the first implementation retire the old banner visually, or keep it as
  an optional header media region alongside the full-page background?
- Which layout presets should exist first: classic social, showcase, creator
  space, or fewer?
- Should users be able to choose separate desktop and mobile focal points for
  background/banner media?
- Should background video be allowed at all during public testing, or should
  animated backgrounds start with GIF/WebP-style image constraints only?
- Should music be a local uploaded asset, external link/card only, or provider
  embed later? The safest first answer is external link/card only.
- Should profile modules become individually reportable in the first expansion,
  or remain covered by profile reports until richer media ships?
- How strict should adult/public-testing media limits be for profile
  backgrounds, galleries, music, and creator modules?
- Should Connections live in the identity card, as a module, or both with owner
  controls?
- Should future paid profile cosmetics or supporter features be allowed, and how
  would they avoid fake status or pressure mechanics?

### Proposed Follow-Up Issues

Do not create these until Thia approves the split. Suggested first issues:

- `[P1] Profile media model and banner/background controls`: define and
  implement full-page background, true banner/header media, fit, position, focal
  point, overlay, blur, dim, mobile behavior, and fallbacks.
- `[P1] Profile layout compacting implementation`: reduce card/stat/chip bloat,
  introduce compact identity card direction, and preserve Feed/Replies/Rooms,
  actions, reports, badges, and Connections.
- `[P1] Profile customization modal v3 redesign`: compact the editor around
  Identity, Theme, Background, Modules, Connections, Music, and
  Safety/visibility with a stronger preview-first flow.
- `[P2] Theme token storage and rendering plan`: define allowlisted accent,
  surface, text, focus, overlay, and card treatment tokens with contrast tests.
- `[P2] Profile module expansion v3`: add featured post, featured room, richer
  Connections, About/status, Badge Showcase, and module ordering/visibility
  refinements in small slices.
- `[P2] Profile music module plan`: decide link-card, static metadata,
  API-backed, or embed scope for Spotify, Apple Music, YouTube Music, and
  uploaded audio; document copyright and autoplay rules.
- `[P2] Profile media moderation/admin diagnostics`: define admin visibility,
  media takedown, report context, moderation status, and module/media summaries.
- `[P2] Background/video performance budget`: set profile media size, duration,
  poster, lazy-loading, mobile, reduced-motion, and data-saver budgets before
  animated/video backgrounds.

## Current Profile State

Current implementation is static-first React backed by PHP/MySQL APIs. The profile surface is centered on `src/pages/ProfilePage.tsx`, `src/components/social/ProfileHeader.tsx`, `src/components/social/ProfileCustomizationModal.tsx`, `src/lib/profileConnections.ts`, `api/profile.php`, `api/follows.php`, `api/read.php`, `api/badges.php`, and `backend/database/schema.sql`.

Implemented public profile behavior:

- Profile info is the first canvas module. It shows avatar, display name, handle, bio, location, joined date, optional banner, structured Connections, featured badges, owner/visitor actions, and only the essential social stats: Likes, Followers, and Following.
- Avatar is stored as `profiles.avatar_url`; banner/background/accent/theme fields live on `profiles` after the profile customization migration.
- Bio and location are plain text with length validation.
- Connections are structured JSON in `profiles.links`, with supported platform types for Website, YouTube, Twitch, TikTok, Instagram, X/Twitter, Bluesky, GitHub, Discord, and Spotify.
- Badges use real persisted badge definitions and user grants. Up to four visible badges can be featured in the profile header.
- Followers and Following are compact pills that open focused panels instead of full profile tabs.
- Featured post, featured room, and Activity are profile modules. Activity contains Feed, Replies, and Rooms. Feed merges top-level posts and reblogs; Replies shows replies; Rooms shows public rooms associated with the profile.
- Profiles can be reported by logged-in users, except self-report is hidden in the UI.
- Follow, unfollow, block, unblock, mute, unmute, and remove-follower foundations exist. Block/mute/remove-follower depend on the pending production migration `20260611_0001_add_user_blocks_and_mutes.sql`.
- Message affordance appears only for moot relationships and is suppressed when the current user has blocked the profile.

Implemented owner edit behavior:

- The edit modal supports display name, bio, location, structured Connections, avatar upload, banner upload, profile background upload, module layout, module visibility/order, and module-native Featured post/room selection. Stored accent/theme values remain hidden until they have visible, tested rendering behavior.
- Upload controls use the authenticated image upload path and WebP conversion rules.
- Profile saves use `PATCH /api/me/profile` with CSRF protection and server-side validation.
- Legacy string links are still normalized for backward compatibility.

### Implementation Note - 2026-06-15 Profiles v3 Phase 1

The first Personal Space Foundation pass is frontend-only. It keeps the existing
profile fields, tabs, modules, featured content, profile editor entry point, and
PHP API behavior, while tightening the public profile presentation:

- Header identity is compact and primary: avatar, display name, handle, bio,
  actions, metadata, social context, links, and featured badges now sit in a
  lighter hierarchy.
- Banner media renders as a short, stable strip with a fixed height and centered
  cover behavior instead of a tall cropped region that visually blends into the
  page.
- Existing `profile_background` is treated only as a soft backing layer in the
  header. A true Profiles v3 page-background system still needs explicit fit,
  position, focal-point, overlay, blur, dim, mobile fallback, API, and migration
  decisions before backend work.
- The existing module section remains the future personal-space foundation, but
  this pass does not add music, gallery, layout-builder, theme-token, or
  marketplace behavior.

### Implementation Note - 2026-06-15 Profiles v3 Phase 2

Issue [#33](https://github.com/thiabun/thia.lol/issues/33) adds the first
Personal Expression slice without broad theme, media, or module expansion:

- Existing `profiles.profile_background` and `profiles.banner_url` now cooperate
  visually. The page renders a soft, cropped, blurred backing layer from the
  background image, falling back to the banner image when no dedicated
  background exists, while the header keeps its short stable banner strip and
  readable foreground surface.
- The background treatment is frontend-only and uses the existing upload fields.
  It does not introduce structured background controls for fit, position, focal
  point, overlay, blur, dim, or mobile-specific crops.
- Featured content is profile-level and intentionally small: one eligible public
  post and one eligible public room render through the registry-backed
  `featured` module inside the profile module grid. Public visitors never see
  empty featured placeholders.
- Owner content selection lives in the existing lazy-loaded Customize Profile
  modal by expanding the Featured module in Modules. Featured post, room,
  visibility, order, and layout preferences are edited in the same module flow;
  the public profile does not show separate featured change actions or setup
  prompts.
- Featured content storage uses `profiles.featured_post_id` and
  `profiles.featured_room_id` from migration
  `20260613_0001_add_profile_featured_content.sql`, with
  `PATCH /api/me/profile/featured` handling CSRF-protected owner updates.
- Featured post eligibility is owner-only and public-only. Deleted, hidden,
  removed, non-public, inactive-author, blocked, unavailable, or private-room
  references fail closed and do not render publicly.
- Featured room eligibility is public rooms the profile owner created or belongs
  to. Deleted, private, unavailable, blocked-owner, or non-eligible references
  fail closed and do not render publicly.

Deferred after Phase 2:

- True structured background/banner controls: fit, position, focal point,
  overlay, blur, dim, span, mobile fallback, and API/storage for those settings.
- A dedicated `profile_featured_content` table or multi-item featured-content
  model. The current single post plus single room fields are enough for this
  scoped slice but not a full featured-content system.
- Featured media thumbnails, gallery/media modules, music modules, layout
  presets, custom theme presets, integrations, embeds, analytics, monetization,
  and module marketplaces.

### Implementation Note - 2026-06-15 Profiles v3 Phase 3

Issue [#34](https://github.com/thiabun/thia.lol/issues/34) adds the first
Personal Space grid foundation. This pass is frontend architecture only: it
does not add drag-and-drop, custom layouts, custom HTML/CSS/JS, gallery/music
modules, embeds, marketplace behavior, or new backend persistence.

Grid architecture:

- `ProfileGridSection` owns the compact section shell used by profile-space
  surfaces.
- `ProfileGrid` owns the responsive grid: one column on mobile, two columns on
  tablet, and at most three columns on wide desktop.
- `ProfileGridModule` owns module span metadata through a small size contract,
  while module cards keep their own content and safety rendering.
- Featured post/room cards and existing profile modules now render through
  these primitives, so future modules can join the same layout without
  rewriting the profile page.

Module sizing model:

- `small`: default one-column module for compact links, badges, and short notes.
- `wide`: spans the tablet row and takes more desktop space for modules that
  need readable text width, such as About or longer link/badge shelves.
- `tall`: reserved for future modules that need vertical emphasis without
  becoming masonry.
- `feature`: reserved for primary highlights that should lead the grid.

Module registry foundation:

- `profileModuleRegistry` is the first shared registry for module label,
  description, fallback title, default size, content checks, badge filtering,
  and summaries.
- Public rendering and owner preview both use this registry, reducing the risk
  that a future module renders differently in preview and on the public profile.
- Existing registry-backed module types are `about`, `custom_text`, `links`,
  `featured_badges`, `featured`, and `activity`.

Future drag/drop considerations:

- Drag-and-drop should attach to persisted module order, not invent visual-only
  layout positions.
- Keyboard-safe up/down ordering remains the baseline interaction until a
  drag/drop library is explicitly approved.
- Any future drag/drop implementation must preserve mobile single-column order,
  public safety action visibility, and bounded desktop columns.

Future persistence requirements:

- The current database persists module type, config, visibility, status, and
  order, but not grid size, layout preset, or featured placement.
- If owners later choose sizes or layouts, store allowlisted size/preset tokens
  per module or profile. Do not store CSS classes, arbitrary grid coordinates,
  or raw layout code.
- Public reads must continue to fail closed when modules, media, referenced
  posts, referenced rooms, or badge grants are hidden, deleted, unavailable, or
  moderated.

Future gallery and music integration points:

- Gallery should become a registry-backed module after media-library,
  moderation, thumbnail, storage, and takedown rules are defined. It should
  likely start as `wide` or `feature` depending on item count, with stable
  aspect ratios and lazy-loaded thumbnails.
- Music should become a registry-backed link-first module before any playback
  or embed behavior. It must remain user-initiated, honest about whether it is
  a static link or API-backed card, and safe under reduced-motion/privacy rules.

Implemented API and storage:

- Public reads: `GET /api/profiles/:handle`, `/posts`, `/replies`, `/reblogs`, `/rooms`, `/badges`, `/followers`, and `/following`.
- Public module reads: `GET /api/profiles/:handle/modules` returns public active profile modules for active users.
- Owner update: `PATCH /api/me/profile`.
- Owner featured content update: `PATCH /api/me/profile/featured`.
- Owner module foundation: `GET`/`POST`/`PATCH`/`DELETE /api/me/profile/modules` and `PATCH /api/me/profile/module-order`.
- Featured badges: `PATCH /api/me/badges/featured`.
- Relationship controls: `POST`/`DELETE /api/profiles/:handle/follow`, `/block`, `/mute`, and `DELETE /api/profiles/:handle/follower`.
- Baseline profile storage is still mostly identity-level fields on `profiles`, plus related tables for posts, rooms, follows, blocks, mutes, badges, and reports.
- Module storage lives in `profile_modules` after migration `20260612_0001_add_profile_modules.sql`.
- Featured content storage lives on `profiles.featured_post_id` and `profiles.featured_room_id` after migration `20260613_0001_add_profile_featured_content.sql`.

### Implementation Note - 2026-06-15 Profiles v3 Phase 4

Issue [#35](https://github.com/thiabun/thia.lol/issues/35) adds owner controls
for the Personal Space grid without turning profiles into a page builder:

- Module visibility continues to use the existing `profile_modules.visibility`
  field. Owners can save known modules as `public`, `hidden`, or `draft`; public
  reads render only active public modules with meaningful content.
- Module order continues to use `profile_modules.position` and the existing
  CSRF-protected `PATCH /api/me/profile/module-order` endpoint. The owner UI
  keeps keyboard-accessible move up/down controls and does not add drag-and-drop.
- Unknown, retired, hidden, deleted, or empty module records are ignored before
  public rendering. The frontend also filters module types through
  `profileModuleRegistry` so only supported modules can produce cards.
- Layout preset storage is profile-level through
  `profiles.profile_layout_preset`, added by migration
  `20260615_0001_add_profile_layout_preset.sql`. Reads fall back to `balanced`
  when the column or value is missing.
- The first allowlisted presets are `balanced`, `compact`, and `showcase`.
  Presets affect grid gaps, desktop max columns, and registry-backed module
  sizing, including the built-in Featured and Activity modules. Mobile remains
  a single stable column.
- Owner layout editing lives inside the existing lazy-loaded Customize Profile
  modal under Modules, with a compact segmented preset control and separate
  layout save action. Public visitors do not see layout controls.

Future drag-and-drop should attach to the same persisted module order and keep
the up/down controls as the keyboard baseline. Future gallery, music, media, and
integration modules should join `profileModuleRegistry` first, define bounded
content checks and grid sizing, and continue to avoid arbitrary HTML, CSS,
JavaScript, iframes, embeds, analytics, monetization, or profile marketplaces.

### Implementation Note - 2026-06-15 Profiles v3 Blank Slate Cleanup

Issue [#36](https://github.com/thiabun/thia.lol/issues/36) removes the last
fixed activity section from public profiles:

- Feed, Replies, and Rooms now live in a built-in `activity` module registered
  through `profileModuleRegistry` and rendered through the same `ProfileGrid`
  and `ProfileGridModule` path as other personal-space modules.
- Activity remains compact: public empty activity does not render as a dead
  panel, while owners can still see a compact owner-only empty state when the
  module is public.
- Activity can be ordered and hidden through the existing module preference
  model. The public module API returns a default Activity module when no saved
  preference exists, and owner module reads create a real built-in row so
  visibility and ordering can persist.
- The public header stats are reduced to Likes, Followers, and Following.
  Posts, Replies, Rooms, Moots, Badges, module counts, and other metadata-first
  counters are intentionally not shown by default.
- Fixed profile sections are being avoided because they make every profile feel
  like the same social dashboard. Future profile content should enter as
  bounded, registry-backed modules with visibility, ordering, compact empty
  behavior, and mobile-safe layout rules.

Follow-up implication: future modules such as gallery, music, links, projects,
or blog/journal surfaces should not add permanent page sections beside the grid.
They should define content checks, default sizing, owner controls, and public
empty behavior before they render on visitor profiles.

### Implementation Note - 2026-06-16 Featured Module Pass

Featured is now a normal built-in module instead of a fixed public profile
section:

- Public profiles render as the profile header plus the module grid. There is no
  fixed Featured heading, owner-only Change action, setup prompt, or public
  placeholder outside the grid.
- `profileModuleRegistry` registers `featured`, and the profile module API
  creates/synthesizes Featured the same way it does Activity so saved visibility
  and ordering preferences can persist.
- Featured content selection remains in Customize Profile by editing the
  Featured module inside the Modules tab, alongside visibility, order, and
  layout controls.
- Featured only renders publicly when the module is active/public and at least
  one eligible featured post or room is available.

### Implementation Note - 2026-06-16 Profiles v3 Modular Canvas Grid

Issue [#38](https://github.com/thiabun/thia.lol/issues/38) supersedes the
earlier three-column grid foundation with a compact 5x5-ready canvas model:

- Desktop profile modules now render on a controlled five-column canvas. Tablet
  remains two columns, and mobile remains a single ordered stack with desktop
  spans ignored.
- Module spans are allowlisted tokens: `1x1`, `2x1`, `1x2`, `2x2`, and `3x1`.
  Unknown or invalid span values fall back to `1x1`; users cannot provide CSS,
  arbitrary coordinates, or custom grid rules.
- `profile_info` is a synthetic frontend-only canvas module and always appears
  first. It carries the core identity surface, banner, avatar, name, handle,
  bio, actions, Likes/Followers/Following, and essential links/badges. It is
  not accepted by the backend module APIs and cannot be hidden or reordered in
  this pass.
- Featured content is split into real built-in modules:
  `featured_post` and `featured_room`. The existing
  `profiles.featured_post_id` and `profiles.featured_room_id` fields remain the
  storage source, and `PATCH /api/me/profile/featured` remains the owner update
  endpoint.
- Legacy combined `featured` module rows are retired for rendering and ordering.
  The API derives initial split built-in preferences from a legacy row's order
  and visibility/status so old preferences fail safely instead of blocking the
  new module model.
- The full profile surface now has a page-level background treatment using the
  existing safe `profile_background` URL, falling back to banner media and then
  the default Sunveil/Frostveil surface. The default blur model is `medium`,
  with readable overlays applied above uploaded media.
- Public empty featured modules do not render. Owners continue to manage
  featured post and room selection from the existing lazy-loaded Customize
  Profile flow, now through separate built-in module tiles.

Deferred after this pass:

- Manual placement, drag-and-drop, grid coordinates, and owner-selected module
  span controls. Future placement controls must remain preset/allowlist based
  and keep keyboard move controls as the baseline.
- Video or animated profile backgrounds. Those need separate media policy,
  poster, duration, file-size, reduced-motion, mobile performance, storage, and
  moderation planning before upload or rendering work.
- New music, gallery, marketplace, custom theme, analytics, monetization, or
  arbitrary embed behavior.

### Implementation Note - 2026-06-16 Profile Customization UI/UX Overhaul

Issue [#37](https://github.com/thiabun/thia.lol/issues/37) now aligns the owner
editor with the modular canvas direction:

- The customization editor uses compact intent groups: Identity, Look, Modules,
  and Preview.
- Connections are edited inside Identity with the same platform-aware
  validation instead of living as a separate top-level destination.
- Look is limited to current supported media slots: avatar, banner, and profile
  background. Accent/theme controls remain hidden until they visibly affect the
  public profile through tested, contrast-safe presets.
- Modules owns layout preset, module visibility, keyboard ordering, add/edit
  flows, and the separate Featured post and Featured room module settings.
- The desktop preview is smaller and supportive; the Preview section remains
  reachable without turning the editor into a second public profile page.
- Public profiles remain header plus module grid, with no fixed Featured
  section, setup prompt, layout action, or "Personal space" label.

Current limitations:

- Profiles now have a minimal module foundation and owner editor/preview for v1 modules, but no integrations, embeds, or module-level report target.
- Profiles now support one featured post and one featured room, but no multi-item
  pinned-content shelf, featured module ranking, or dedicated featured-content
  table.
- The current page state owns profile loading, tabs, panels, badge featuring, editing, follow controls, block/mute controls, and reporting in one route component.
- Profile customization safety rules are documented, but broad visual theming remains deferred.
- `profileAccent` and `profileTheme` may exist in legacy/profile storage but are hidden from the edit UI until supported presets have a visible, tested rendering effect.
- There are no project showcases, galleries, blog entries, pronouns, status/presence, creator mode, or featured post media layouts.
- Blog-like content does not exist as a separate product concept. Posts have `parent_id`, room association, visibility, status, media, and reblogs, but no `post_type` or long-form model.
- `profiles.traits` still exists for storage compatibility, but public editing/display has been removed. Future work should not revive traits as an unstructured customization surface.
- Hidden-badge API support exists through badge visibility, but a full user-facing hidden-badge management UI is deferred.
- Block and mute reduce exposure where practical, but the product must not claim that blocking hides public content everywhere.
- External integrations are currently links, not live integrations or embeds. There are no API keys, webhook flows, iframe embeds, OAuth flows, or live external status cards.
- Connections are validated by platform during profile editing: website and Spotify use explicit HTTPS URLs, while supported social platforms use safe handles and/or profile URLs according to the platform rules.

## Product Vision

Future profiles should feel like:

- An identity page: who someone is on `thia.lol`.
- A personal website: a clean, owned homepage that can stand alone.
- A social profile: activity, follows, moots, rooms, replies, and profile actions.
- A creator hub: featured projects, streams, music, videos, rooms, galleries, and links.
- A blog surface: long-form updates, pinned notes, archives, and homepage-like presentation if Thia chooses that direction.

Profiles should not be just:

- Avatar, bio, links, and posts.
- A generic link-in-bio clone.
- A messy page builder.
- A place where users can break contrast, layout, safety controls, or moderation tooling.
- A set of fake visual controls that imply integrations or privacy features that do not exist.

The platform should be beautiful by default. A new member with no creator content should still have a complete-feeling profile. A creator or founder should be able to grow into richer modules without making non-creators feel empty.

## Core Design Principles

- Expressive but readable: users can signal personality, but text remains legible and actions remain clear.
- Customizable but curated: users choose from controlled presets, modules, media slots, and accent tokens, not arbitrary CSS or page code.
- Modular, not chaotic: a profile is composed from known module types with stable layout rules.
- Beautiful by default: empty profiles should still look intentional.
- Safe for public testing: moderation, reporting, block/mute, and link safety are part of the design, not afterthoughts.
- Mobile-first, desktop-rich: mobile uses a clear stack; desktop can use a richer two-column or feature-panel layout.
- No arbitrary CSS, HTML, script embeds, custom JavaScript, or user-controlled iframes.
- No fake integrations: a Twitch, Spotify, Apple Music, YouTube, GitHub, or Discord module must be honest about whether it is a link, static card, API-backed card, or embed.
- No unreadable profile themes: theme choices must pass contrast and state styling rules.
- User-owned identity without UI breakage: customization should never hide reports, safety actions, author identity, profile metadata, or moderation-relevant context.
- Creator-friendly without creator pressure: modules should enhance active profiles without making ordinary member profiles look unfinished.

## Profile Layers

### Identity Layer

Identity is the stable top of the profile. It should load quickly, be readable in every theme, and remain available even if optional modules fail.

Current and future identity elements:

- Avatar.
- Banner.
- Display name.
- Handle.
- Pronouns, if later supported.
- Bio.
- Location.
- Connections.
- Badges.
- Featured badges.
- Joined date.
- Status or presence, if later supported.

Identity layer rules:

- Keep public identity fields plain text or constrained tokens.
- Keep avatar/banner/background media inside existing upload and moderation rules.
- Do not use arbitrary background CSS, custom fonts, page scripts, or user-provided HTML.
- Keep report, block, mute, follow, and message affordances visually available and not theme-dependent.

### Social Layer

The social layer explains how the member relates to the rest of `thia.lol`.

Current and future social elements:

- Followers.
- Following.
- Moots.
- Rooms.
- Featured room.
- Featured post.
- Recent activity.
- Follow/unfollow.
- Block/mute/remove-follower.
- Chat/message affordance for eligible moots.
- Report profile.

Social layer rules:

- Blocked pairs should not get direct social affordances.
- Muted profiles should still be accessible unless blocked or moderated, but feed surfaces should hide muted content where practical.
- Counts should be accurate but not designed as pressure loops.
- Follower/following visibility controls are a future decision and should not be implied before implementation.

### Personal Space Layer

The personal space layer is the future module area. It should be optional, ordered, and curated.

Possible elements:

- About module.
- Custom text module.
- Personal links and Connections.
- Featured post.
- Featured room.
- Blog or journal module.
- Project showcase.
- Gallery/media module.
- Music module.
- Stream/video cards.
- Room/community showcases.
- Badge showcase.

Personal space rules:

- Modules must have bounded content, known types, validation, and visibility controls.
- Modules should degrade cleanly when an API or external service is unavailable.
- Modules should not autoplay media or load heavy third-party embeds by default.
- Modules must remain reportable through profile reporting at first; module-level reporting can come later if modules become independently moderated objects.

## Module System Proposal

The module system should be introduced after a profile layout refresh, not bolted onto the current header/tabs all at once. A first implementation should support a small catalog and leave integration-heavy modules as planned future work.

| Module | Purpose | User-facing behavior | Configuration | Privacy/safety | Storage needs | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| About | Give the profile a richer self-introduction than the short bio. | Renders a concise text block near the top of the personal space. | Title, body, optional visibility. | Plain text only; length limits; no HTML. | `profile_modules.settings_json` with text fields. | v1 |
| Links / Connections | Present structured external links with platform labels. | Reuses current Connections as a module or header section. | Choose which saved Connections to show, ordering, optional title. | HTTPS validation; safe Discord display; no script URLs. | Could reference `profiles.links` initially, later module settings for order. | v1 |
| Featured Post | Highlight one public post or reply. | Shows a compact post card with author context and normal safety actions. | Select one own public post; optional title. | Must respect post visibility, deleted/hidden/removed state, block filters. | Module setting with `post_id`; optional future `profile_featured_content`. | v1 |
| Featured Room | Highlight one room the user owns or belongs to. | Shows room card or compact room panel. | Select eligible public room; optional title. | Hide deleted/private rooms; respect room moderation. | Module setting with `room_id`. | v1 |
| Badge Showcase | Show selected badges beyond header featured badges. | Curated badge strip/grid with explanations. | Choose badges, order, compact or detailed view. | Only visible badges; hidden/revoked badges never render. | Module references `user_badges` ids or badge ids. | v1 |
| Custom Text | Add a small personal note, update, or announcement. | Text card in the module stack. | Title, body, optional link button. | Plain text, length limits, report through profile. | Module settings JSON. | v1 |
| Room Showcase | Show rooms as communities the member owns or participates in. | Grid/list of selected public rooms. | Select rooms, ordering, title. | Public rooms only in v1; no private room leakage. | Module settings with room ids. | v1 |
| Blog / Journal | Support long-form profile updates. | Shows latest entries or pinned entries on the profile. | Entry selection, archive link, display mode. | Needs moderation, visibility, reporting, content limits. | Future `posts.post_type = 'blog'` or separate `profile_entries`. | v2 |
| Project Showcase | Present creator projects, apps, writing, art, servers, or releases. | Cards with title, description, image, link, status. | Up to a small number of projects, safe URLs, optional image. | Link safety, no misleading claims, no unsafe embeds. | Module settings JSON or future `profile_projects`. | v2 |
| Gallery | Show selected uploaded images/media. | Responsive gallery with thumbnails and captions. | Select uploaded media, captions, ordering. | Moderation and takedown implications; no external hotlink gallery in v1. | Future media library references. | v2 |
| Music | Show a favorite song, playlist, or now-playing style card. | Static card or link-first music panel. | Platform, URL, display title, optional note. | No autoplay; no invasive tracking; no fake live status. | Module settings with validated music URL. | v2/later |
| Spotify Playlist | Highlight Spotify playlist/song. | Link card first; possible oEmbed/embed later only after decision. | Spotify URL, display mode. | Third-party tracking, API/key, embed performance, age/content concerns. | Validated URL; optional cached metadata later. | later |
| Apple Music Playlist/Song | Highlight Apple Music content. | Link card first; possible embed later. | Apple Music URL, display mode. | Third-party tracking, region availability, content ratings. | Validated URL; optional cached metadata later. | later |
| Twitch Live/Status | Show stream presence. | Link/status card first; embed only after privacy/performance review. | Channel, display mode, optional chat link. | Chat embeds are high risk; moderation and tracking concerns. | Validated channel; optional cached status if API-backed. | later |
| YouTube Latest Video | Show channel or latest video. | Link card first; API-backed latest video later. | Channel/video URL, display mode. | API quotas, embed tracking, moderation of off-platform content. | Validated URL; optional cached metadata later. | later |
| GitHub Project Cards | Show public repositories or projects. | Static cards with repo links and optional metadata. | Repository URLs, project names, descriptions. | Avoid leaking private repos; no OAuth in first pass. | Validated GitHub URLs; optional cached metadata later. | v2/later |
| Vinterra / Minecraft | Show server/project identity if relevant. | Static server/project card first. | Name, link, status text, optional image. | Do not imply live server status unless API-backed. | Module settings JSON. | later |

## Customization Model

Recommended customization controls:

- Module ordering through explicit up/down controls first; drag and drop can come later.
- Module visibility: public, hidden, and owner-preview-only draft in later versions.
- Featured modules: one or two modules can be visually promoted on desktop.
- Layout presets: simple stack, showcase, creator hub. Mobile always resolves to a readable stack.
- Theme accents: constrained tokens such as Sunveil, Frostveil, Leaf, Rose, plus validated contrast.
- Banner, avatar, and profile media through existing upload rules.
- Optional profile background treatment as controlled image opacity/blur presets, not arbitrary CSS.
- Pinned content: featured post, featured room, featured module.
- Featured badges and featured links with small count limits.

Explicitly avoid:

- Arbitrary CSS.
- Arbitrary HTML.
- Custom JavaScript.
- Script embeds.
- Unreviewed iframes.
- Autoplay media.
- Unreadable color combinations.
- Unlimited layout freedom.
- Fake visual controls.
- External integration switches that do nothing.

Recommended validation:

- Store only known module types.
- Validate each module type against an allowlist of settings keys.
- Enforce title/body/link/media length limits.
- Enforce maximum module count, for example 8 active modules in the first implementation.
- Enforce a small number of featured modules.
- Normalize and validate URLs at write time.
- Reject HTML/script-like input at write time.
- Keep all user-generated module text rendered as React text nodes.

## Blog / Personal Homepage Direction

Profiles can become blog-like without immediately building a full blog platform. The core product decision is whether long-form profile content is:

1. A post type.
2. A profile module backed by selected existing posts.
3. A separate future content table.

Default recommendation: plan long-form as a future post type, not a separate blog system yet.

Why:

- Posts already have authors, rooms, replies, visibility, status, reports, moderation, reblogs, likes, and profile/feed relationships.
- A `post_type` field could later distinguish `post`, `reply`, `blog`, or `note` without inventing a second moderation universe.
- Blog entries could still appear in a profile Blog module, archive route, and possibly feeds with clear labels.

Open risks:

- Long-form needs editing/drafts decisions. Current posts do not have edit/draft behavior.
- Blog entries may need titles, excerpts, cover images, slugs, and reading layouts.
- Comments/replies on blog entries need clear thread behavior.
- Feed inclusion needs a product decision: should blog posts appear in Home/Discover, profile only, or both?

Recommended path:

- Phase 1: keep blog as a product decision, not code.
- Phase 2: add featured post and pinned content first.
- Phase 3: decide whether a `posts.post_type` migration is worth it.
- Phase 4: add Blog/Journal module only after reporting, moderation, visibility, and UI layout are specified.

## Integration Strategy

External integrations should start link-first, then become static cards, and only later become API-backed cards or embeds when privacy, performance, moderation, and API-key ownership are settled.

| Integration | What is possible | Embed vs link | Privacy/API concerns | Moderation/performance concerns | PRV2 fit |
| --- | --- | --- | --- | --- | --- |
| Twitch stream status | Channel link, static card, live status via Twitch API later, stream embed later. | Link/static card first. Defer stream embed and chat embed. | OAuth/API keys, request quotas, third-party tracking. | Chat embed can expose unmoderated third-party chat; heavy embeds can slow profiles. | Later |
| Twitch chat | Embed is technically possible. | Do not include in PRV2. | Third-party tracking and identity exposure. | High moderation risk; public-testing adult/content concerns. | Later only after explicit decision |
| Spotify playlist/song | Validated Spotify link, static card, oEmbed/embed later. | Link card first. | Third-party tracking; API credentials if metadata is fetched. | Embeds add weight and content outside local moderation. | Later |
| Apple Music playlist/song | Validated Apple Music link, static card, embed later. | Link card first. | Region availability, tracking, API constraints. | Embeds can be heavy and inconsistent. | Later |
| YouTube latest video/channel | Channel/video link, static card, API-backed latest video later. | Link/card first; no autoplay. | API keys/quotas; third-party tracking. | Embeds can load heavy scripts and off-platform content. | Later |
| GitHub project cards | Validated repo/project links; optional public metadata later. | Static link cards first. | Avoid private repo/OAuth scope; API rate limits. | Low to medium moderation risk; descriptions still user content. | v2/later |
| Discord invite/display value | Current Connections already support invite URL or safe display text. | Link/display only. | Invite links can expose servers; no Discord OAuth in v1. | Invite destinations are off-platform and need report handling via profile. | Current link only |
| Bluesky/X/TikTok/Instagram | Current Connections support validated links/handles. | Link only in PRV2. | External identity tracking. | Off-platform content not locally moderated. | Current link only |

Integration rules:

- Never present a card as live unless it is actually API-backed.
- Never require API keys in committed config.
- Never add third-party scripts without a privacy/cookie policy review.
- Never autoplay audio or video.
- Prefer user-clicked outbound links for Public Readiness V2.
- Cache metadata server-side only after deciding retention, refresh frequency, and failure behavior.

## Privacy and Safety

Profile evolution must respect the existing safety baseline:

- Block: remove direct follows, suppress message/follow affordances, reject blocked-pair direct actions where practical, and avoid overclaiming public invisibility.
- Mute: hide muted content from the muting user's feeds where practical without notifying the muted user.
- Remove follower: allow owners to quietly remove a follower without implying a block.
- Reports: profiles are reportable today; future modules should initially be covered by profile reports unless module-level report targets are added.
- Hidden badges: hidden or revoked badges must not render in any showcase, header, or module.
- Profile moderation: suspended users should not appear as active public profiles.
- Safe external links: all external URLs should be normalized and validated; HTML/script-like input should be rejected.
- Embed safety: no autoplay, no script embeds, no arbitrary iframe input, and no unreviewed third-party tracking.
- Adult/public-testing concerns: off-platform media and stream modules must not imply `thia.lol` can moderate all third-party content.
- Privacy claims: do not claim private profiles, private modules, full content hiding, encryption, or legal compliance until those features exist and have been reviewed.

Future visibility controls should be explicit and modest:

- Hide follower/following counts, if chosen.
- Hide selected modules.
- Draft modules visible only to owner in preview mode.
- Private account or followers-only profiles are out of scope for this planning track unless separately scoped.

## Data Model Implications

Current storage should remain responsible for identity-level profile fields:

- `profiles.display_name`
- `profiles.bio`
- `profiles.location`
- `profiles.avatar_url`
- `profiles.banner_url`
- `profiles.profile_accent`
- `profiles.profile_background`
- `profiles.profile_theme`
- `profiles.links`

Do not overload `profiles.links` or `profiles.traits` for modules. `traits` should remain compatibility storage only unless separately deprecated.

Recommended future module table:

```sql
CREATE TABLE profile_modules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  module_type VARCHAR(40) NOT NULL,
  title VARCHAR(120) NULL,
  settings_json JSON NOT NULL,
  visibility ENUM('public', 'hidden', 'draft') NOT NULL DEFAULT 'public',
  position INT UNSIGNED NOT NULL DEFAULT 0,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY profile_modules_user_position_idx (user_id, visibility, position),
  KEY profile_modules_type_idx (module_type),
  CONSTRAINT profile_modules_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
```

Possible future companion storage:

- `profile_module_settings` only if settings need relational querying. Default: avoid this until JSON becomes a real limitation.
- `profile_featured_content` if featured posts/rooms/projects need a stable cross-module model.
- `posts.post_type` for blog/journal content if blog becomes a first-class content type.
- `posts.title`, `posts.slug`, `posts.excerpt`, or `posts.cover_media_url` only if long-form is approved.
- `profile_projects` only if project showcase needs sorting, multiple links, images, and richer lifecycle state.
- `profile_media_items` only if gallery/media library work is approved.
- `profile_external_links` only if structured Connections outgrow `profiles.links`.
- `profile_visibility_settings` only if count/module visibility becomes broad enough to deserve relational storage.

Storage rules:

- Keep migrations idempotent.
- Update `backend/database/schema.sql` alongside migrations.
- Add storage readiness guards that return 503/409 style errors instead of generic 500s.
- Do not run production migrations silently.
- Do not store OAuth tokens or API secrets in module JSON.
- If integration metadata is cached, store only public metadata needed for display and document refresh/deletion behavior.

## API Shape Proposal

Keep route style consistent with current profile APIs: public profile reads under `/api/profiles/:handle/...`, owner mutations under `/api/me/profile/...`, and CSRF on authenticated mutations.

### `GET /api/profiles/:handle/modules`

- Auth: optional.
- Public behavior: returns public modules for active profiles.
- Private behavior: if authenticated owner, may include hidden/draft modules only when `?preview=1` is supported later.
- Validation: normalize handle with current handle rules.
- Response shape:

```json
{
  "profile": {
    "handle": "thia",
    "displayName": "Thia"
  },
  "modules": [
    {
      "id": 1,
      "type": "about",
      "title": "About",
      "visibility": "public",
      "position": 0,
      "isFeatured": false,
      "settings": {
        "body": "Plain text only."
      }
    }
  ]
}
```

- Safety: exclude hidden/draft modules for public viewers; exclude modules referencing unavailable, private, hidden, removed, or blocked content.
- Storage readiness: return `503` if module storage is required but missing.

### `POST /api/me/profile/modules`

- Auth: required.
- CSRF: required.
- Behavior: creates a module for the current user.
- Validation: known `moduleType`, title length, settings schema per module type, module count limit, URL/media/content validation.
- Response: created module plus full normalized module list.
- Safety: reject HTML/script-like text; reject unknown settings keys; prevent modules referencing other users' private or unavailable content.
- Storage readiness: return `503` if `profile_modules` is missing.

### `PATCH /api/me/profile/modules/:id`

- Auth: required.
- CSRF: required.
- Behavior: updates an owned module.
- Validation: module ownership, type-specific settings schema, visibility values, featured limit.
- Response: updated module plus normalized module list.
- Safety: same as create; do not allow changing `user_id`; do not let theme/layout settings hide report/safety controls.

### `DELETE /api/me/profile/modules/:id`

- Auth: required.
- CSRF: required.
- Behavior: deletes or archives an owned module. First pass can hard-delete module rows because module settings are user-owned presentation data, not moderation evidence, unless reports become module-specific.
- Response: `{ "deleted": true, "modules": [...] }`.
- Safety: if module-level reports are introduced later, switch to soft-delete or retain report references.

### `PATCH /api/me/profile/module-order`

- Auth: required.
- CSRF: required.
- Behavior: updates module positions in one request.
- Request shape:

```json
{
  "moduleIds": [4, 2, 9, 1]
}
```

- Validation: all ids must belong to current user; no duplicates; max module count.
- Response: normalized ordered module list.
- Safety: ordering cannot expose hidden/draft modules publicly.

### `PATCH /api/me/profile/featured`

- Auth: required.
- CSRF: required.
- Behavior: updates featured post, featured room, featured modules, and possibly featured links in one owner-facing endpoint.
- Request shape:

```json
{
  "featuredPostId": 42,
  "featuredRoomId": 7,
  "featuredModuleIds": [4, 9],
  "featuredConnectionKeys": ["github|https://github.com/thiabun"]
}
```

- Validation: public/eligible post and room references; owner or membership constraints for rooms; small featured limits.
- Response: normalized profile featured config.
- Safety: remove or ignore references to hidden/deleted/moderated content; avoid leaking private rooms or removed posts.

### `GET /api/profiles/:handle/blog`

- Auth: optional.
- Public behavior: returns approved public blog entries if blog exists.
- Response shape if `posts.post_type` is used:

```json
{
  "entries": [
    {
      "id": 123,
      "title": "Launch notes",
      "excerpt": "A short public excerpt.",
      "createdAt": "2026-06-12 12:00:00",
      "url": "/@thia/blog/launch-notes"
    }
  ]
}
```

- Safety: respect post visibility, status, deleted state, block/mute filters where applicable, and profile moderation.
- Storage readiness: return empty list or `404` until blog support exists; do not add a fake endpoint before implementation.

## UX / UI Direction

Desktop layout:

- Keep a strong profile header with avatar/banner/identity/actions.
- Move optional personal space modules below the identity layer, with a module-ready content area.
- Consider a two-column layout after the layout refresh: primary activity/module column and secondary identity/social column, but only if it remains readable.
- Keep Feed/Replies/Rooms available, but decide whether activity becomes a module, a tab group, or a profile section under the personal space.
- Use modules as clear sections, not nested cards inside cards.

Mobile layout:

- Header first, then actions, then featured badges/links, then selected modules, then activity tabs.
- Module ordering should be owner-controlled but normalized to a single stack.
- Avoid horizontal overflow and oversized controls.
- Keep report/safety actions reachable.

Edit mode:

- First pass: separate profile identity edit from module editor.
- Add a profile preview mode before broad customization.
- Add a module picker with only supported module types.
- Use simple up/down ordering first; drag/reorder can come later.
- Show honest disabled states for later modules rather than fake controls.

Empty states:

- New profiles should not look broken without modules.
- Empty modules should not render publicly.
- Owner view can show prompts to add modules; public view should stay clean.
- Creator tools should not make non-creator profiles feel incomplete.

Public vs owner view:

- Public view shows only public, safe, available modules.
- Owner view can show edit affordances and hidden/draft module state.
- Owner view should clearly distinguish preview from public display.

## Public Readiness V2 Scope Recommendation

### Phase 1 - Foundation Planning / UI Guidelines

- Goal: lock product rules before implementation.
- Scope: this document, profile UI guidelines, issue map, module catalog, open decisions.
- Out of scope: code, migrations, integrations, embeds.
- Risk: low.
- Codex suitability: high.
- Likely files touched: docs only.
- Tests needed: standard repo checks and `git diff --check`.

### Phase 2 - Profile Layout Refresh

- Goal: make profiles module-ready without adding module storage.
- Scope: split profile header/content structure, improve desktop/mobile layout, clarify public vs owner actions, preserve Feed/Replies/Rooms.
- Out of scope: module API, blog, integrations.
- Risk: medium because profile is API-backed and central.
- Codex suitability: high for scoped frontend work.
- Likely files touched: `ProfilePage`, `ProfileHeader`, profile smoke tests.
- Tests needed: profile route Playwright coverage, desktop/mobile visual checks, typecheck, lint, build, API-backed smoke if profile actions are touched.

### Phase 3 - Basic Modules

- Goal: introduce small safe modules.
- Scope: About, Connections, Badge Showcase, Featured Post, Featured Room, Custom Text, Room Showcase.
- Out of scope: blog, external embeds, OAuth, live integrations.
- Risk: medium/high because schema/API work is required.
- Codex suitability: medium if split into small tasks.
- Likely files touched: schema/migration, `api/profile.php` or new profile module API file, `api/index.php`, frontend profile components, tests.
- Tests needed: PHP lint, backend source/regression checks, Playwright profile module tests, deployed or local working API smoke for create/update/order/delete.

### Phase 4 - Blog / Featured Content

- Goal: decide and implement a first blog-like profile surface.
- Scope: product decision on `posts.post_type` vs separate entries vs selected posts; featured/pinned content UI.
- Out of scope: full CMS, newsletters, analytics, monetization.
- Risk: high because content model and moderation implications are broad.
- Codex suitability: medium for implementation after decisions are explicit.
- Likely files touched: posts schema/API, profile API, profile page, post cards, tests, docs.
- Tests needed: API-backed post/blog creation and visibility tests, report/moderation checks, profile archive rendering.

### Phase 5 - External Integrations

- Goal: add carefully validated external cards.
- Scope: link-first music/video/stream/project cards with safe URL validation.
- Out of scope: autoplay, chat embeds, arbitrary iframes, OAuth, third-party scripts without review.
- Risk: medium/high because privacy, tracking, and content moderation become harder.
- Codex suitability: medium for link cards; low for unscoped OAuth/live embeds.
- Likely files touched: module validation, frontend module renderers, policy docs if embeds/scripts are added.
- Tests needed: URL validation, no-script/no-HTML checks, performance review, privacy/cookie review for embeds.

### Phase 6 - Advanced Creator Profile Tools

- Goal: support richer creator hubs after core safety and modules are stable.
- Scope: galleries, project collections, creator layout presets, richer archives, maybe integration metadata caching.
- Out of scope: ads, paid profile features, analytics trackers unless separately planned.
- Risk: high.
- Codex suitability: medium only when broken into tightly scoped issues.
- Likely files touched: multiple frontend/API/schema areas.
- Tests needed: full profile regression suite, API-backed smoke, performance checks, moderation/report workflows.

## Recommended GitHub Issues

Existing issue:

- [#18 Profile and personal-space evolution plan](https://github.com/thiabun/thia.lol/issues/18)
  - Priority: P2.
  - Use: top-level planning issue for this document.
  - Do not duplicate.

Created high-confidence follow-up issues:

### [#21 `[P1] Profile layout refresh for personal-space foundation`](https://github.com/thiabun/thia.lol/issues/21)

- Priority: P1.
- Labels: `enhancement`, `area: profiles`, `area: frontend`, `area: ux`, `public-readiness-v2`, `codex-ready`.
- Summary: Refresh profile layout so the page can support modules later while preserving current API-backed behavior.
- Acceptance criteria:
  - Header, actions, social pills, featured badges, and activity tabs remain available.
  - Desktop layout has a clear future module area.
  - Mobile layout remains a single readable stack.
  - No new schema/API behavior is added.
  - Profile smoke tests cover owner and public views.

### [#22 `[P1] Profile module system foundation`](https://github.com/thiabun/thia.lol/issues/22)

- Priority: P1.
- Labels: `enhancement`, `area: profiles`, `area: api`, `area: database`, `needs-product-decision`.
- Status: Foundation implemented.
- Summary: Add storage and API foundation for ordered safe profile modules.
- Acceptance criteria:
  - Idempotent migration `20260612_0001_add_profile_modules.sql` adds module storage.
  - Public module reads and owner module mutations are implemented with CSRF on mutations.
  - Module type/settings validation is allowlist-based.
  - No arbitrary HTML, CSS, JavaScript, or iframe input is accepted.
  - API-backed profile module smoke is run or explicitly blocked.

### [#23 `[P1] Profile module editor and preview mode`](https://github.com/thiabun/thia.lol/issues/23)

- Priority: P1.
- Labels: `enhancement`, `area: profiles`, `area: frontend`, `area: ux`, `codex-ready`.
- Status: Implemented.
- Summary: Build owner-facing module picker, edit controls, ordering, and preview/public distinction.
- Acceptance criteria:
  - Owner can add, edit, hide, show, reorder, and remove supported v1 modules.
  - Public view never renders hidden/draft modules.
  - Empty owner prompts do not appear to public viewers.
  - Preview mode is visually distinct from public view.
  - Live owner mutation smoke is required after authenticated deployment access is available.

### [#24 `[P2] Featured posts and featured rooms`](https://github.com/thiabun/thia.lol/issues/24)

- Priority: P2.
- Labels: `enhancement`, `area: profiles`, `area: posts`, `area: rooms`, `area: api`.
- Summary: Let users pin one safe public post and one eligible public room to their profile.
- Acceptance criteria:
  - Featured post respects post status, visibility, deletion, and block/mute context.
  - Featured room respects room visibility, deletion, and moderation state.
  - Broken references fail closed and do not render stale private content.

### [#25 `[P2] Profile customization safety rules`](https://github.com/thiabun/thia.lol/issues/25)

- Priority: P2.
- Labels: `documentation`, `area: profiles`, `area: design`, `area: safety`, `codex-ready`.
- Summary: Define allowed profile themes, accents, media treatments, contrast rules, and no-code customization boundaries.
- Acceptance criteria:
  - Allowed tokens and presets are documented.
  - Disallowed CSS/HTML/script/embed behavior is explicit.
  - Report/safety actions remain visible in every profile theme.

Recommended later follow-up issues:

### `[P2] Blog / journal product decision`

- Priority: P2.
- Labels: `documentation`, `area: profiles`, `area: posts`, `needs-product-decision`.
- Summary: Decide whether long-form profile content should be a post type, module-backed selected posts, or separate entries.
- Acceptance criteria:
  - Decision covers storage, routes, feed inclusion, replies, moderation, reporting, drafts/editing, and archive behavior.
  - No blog code is added in the decision issue.

### `[P2] Profile gallery module`

- Priority: P2.
- Labels: `enhancement`, `area: profiles`, `area: uploads`, `needs-product-decision`.
- Summary: Plan and build a safe gallery module after media-library and moderation implications are clear.
- Acceptance criteria:
  - Gallery uses uploaded media references, not arbitrary external image hotlinks.
  - Captions are plain text.
  - Moderated/deleted media cannot render.

### `[P2] Profile privacy controls`

- Priority: P2.
- Labels: `enhancement`, `area: profiles`, `area: privacy`, `needs-product-decision`.
- Summary: Decide and scope profile visibility controls such as hiding counts or modules.
- Acceptance criteria:
  - Controls do not overclaim privacy.
  - Block/mute/remove-follower behavior is respected.
  - Public vs owner view is clearly specified.

### `[P3] Music module planning`

- Priority: P3.
- Labels: `documentation`, `area: profiles`, `needs-product-decision`.
- Summary: Decide link-card vs embed vs API-backed music behavior for Spotify and Apple Music.
- Acceptance criteria:
  - Privacy, cookie, API-key, autoplay, and performance risks are documented.
  - No embed or API integration is added in planning.

### `[P3] Twitch integration planning`

- Priority: P3.
- Labels: `documentation`, `area: profiles`, `needs-product-decision`.
- Summary: Decide whether Twitch should be a link card, live status card, stream embed, or chat embed.
- Acceptance criteria:
  - Chat embed risk is explicitly reviewed.
  - API/key ownership and rate limits are documented.
  - Moderation and third-party content limits are documented.

## Open Product Decisions For Thia

- Should profiles support long-form blog posts?
- If yes, should blog content be a post type, selected post module, or separate content model?
- Should modules be available to everyone, gradually unlocked, or limited during public testing?
- Should customization be simple presets first or full modular sections first?
- Should music/stream integrations be outbound links, static cards, API-backed cards, or embeds?
- Should Twitch chat ever be embedded, given moderation and tracking risks?
- Should profiles have separate public, personal, and creator layout modes?
- Should users be able to hide follower/following/moot counts?
- Should users be able to hide the Rooms tab or activity tabs?
- Should profile modules be moderated only through profile reports at first, or should modules become independent report targets?
- Should adult/public-testing limitations restrict media, music, stream, or gallery modules?
- Should profile backgrounds allow uploaded images or only curated presets?
- Should Connections stay in the header, become a module, or appear in both places?
- Should Thia's profile use the same module system as everyone else, or receive founder-only editorial affordances later?

## Non-Goals

This planning track must not implement:

- Frontend profile redesign.
- Backend migrations.
- API behavior changes.
- External integrations.
- Embeds.
- Analytics.
- Ads.
- Arbitrary CSS.
- Custom HTML.
- Custom JavaScript.
- Private account system.
- Paid profile features.
- OAuth flows.
- Production migrations.
- Auth/session behavior changes.

## Verification Notes For Future Implementation

Any later implementation touching profile modules, profile edit behavior, profile actions, posts, replies, rooms, media, or API-backed UI must verify against a working API path. A Vite dev server with `/api` proxy failures is incomplete for these tests. If a local PHP/MySQL API cannot be started, the implementation summary must mark API-backed smoke as blocked and explain what command, config, or credential is missing.

PHP lint is required for future PHP changes. Migrations must be idempotent, documented, and run through the protected migration runner only by an authorized operator.
