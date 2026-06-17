# Profile Customization Experience

> **Status: Active product direction.** Use this for owner profile editor IA,
> preview behavior, Connections, and customization experience. Issue
> [#26](https://github.com/thiabun/thia.lol/issues/26) implemented the first
> safe slice; future work should be tracked in GitHub Issues.

Date: 2026-06-17

## Purpose

Profile customization is moving from separate edit forms toward a single studio-like workflow. The experience should help members shape identity, links, images, and personal-space modules while keeping the profile readable, safe, and honest about what is actually implemented.

This document complements `docs/profile-personal-space-evolution.md` and `docs/profile-customization-safety-rules.md`. It does not approve arbitrary CSS, HTML, JavaScript, embeds, integrations, analytics, ads, broad profile themes, or new database schema.

## Current Problems

- Edit Profile and Edit Personal Space feel disconnected even though they shape the same public surface.
- The edit modal still reads like a form for database fields instead of a profile studio.
- Connections are validated by platform, but the editing surface still feels generic.
- There is no preview-driven workflow for identity, links, images, and modules together.
- Accent and Theme controls were removed because they were stored but did not visibly affect public profiles.
- The personal-space vision is visible in planning and public profile layout, but not yet in the owner editing experience.

## Product Vision

The profile editor should feel like:

- A profile studio.
- A creator workspace.
- An identity editor.
- A personal space designer.
- Arranging modules on a personal canvas.

It should not feel like:

- A database form.
- A fake theme builder.
- A link-in-bio clone.
- A page builder where users can break layout, safety controls, or moderation context.
- A control panel, admin dashboard, or mission-control settings surface.

The first experience layer should keep functionality practical: edit current profile identity, upload current profile images, manage current Connections, manage current safe v1 modules, and preview the combined result.

## Editing Sections

The customization surface should organize existing behavior into compact
intent-based sections:

- Identity: display name, bio, location, and structured Connections.
- Look: avatar, banner, and profile background image. Accent/theme controls stay hidden until presets visibly affect public rendering through tested, contrast-safe mappings.
- Modules: current v1 modules, layout preset, ordering, visibility, save/delete behavior, and module-native featured post/room selection.
- Preview: desktop and mobile-oriented previews of the public profile using current safe data only.

## Canvas Editor Model

The active P3 editor is an owner-only inline canvas editor:

- Desktop: a compact translucent panel sits on the left side of the live
  profile. The canvas remains visible and editable to the right.
- Mobile: the same actions compress into a bottom sheet. Exact desktop
  placement is still ignored for public mobile layout.
- The panel categories are Essentials, Featured, Media, Integrations, and
  Removed.
- Module cards show purpose, size behavior, connection/metadata state where
  relevant, and direct Add or Restore actions.
- Clicking or tapping a module in Edit Canvas mode selects it. The selected
  module shows a clear ring and replaces its display content with size,
  visibility, remove, and module-specific content controls.
- Drag is the primary placement system in this pass. Direct position controls
  are deferred to a future accessibility toggle in the settings surface.
- Manual module label editing is no longer part of the product surface.
  Product-defined module names and platform-derived connection labels keep the
  canvas scannable. Legacy `title` and `config.label` data can still render for
  backward compatibility.
- Background image, muted looping video background, poster/static fallback where
  supported, reset, and "Background clarity" blur controls live in a compact
  Background popover attached to the live canvas surface, outside the module
  menu.
- Save is a single primary Done action. Cancel exits without persisting draft
  layout changes.

## Module Lifecycle

`profile_info` is the only non-removable identity anchor. Featured post,
featured room, activity, and expressive modules are normal removable modules.

Deleting a module soft-deletes it:

- Public reads exclude it.
- Default owner reads exclude it.
- Editor/library reads can request deleted modules with `includeDeleted=1`.
- Title, config, and saved grid placement are preserved where possible.
- Restore makes the module active and visible, then uses the collision-push
  algorithm to fit the canvas safely.

Deleting featured post or featured room modules clears the profile-level
featured pointer but must not delete the underlying post or room. The deleted
module keeps a restore snapshot of the selected content id when possible. On
restore, the backend may reselect the content if it is still eligible; otherwise
the module returns with a compact owner state to choose content again.

## Movement And Collision

Canvas movement should feel predictable and reversible:

- The moved or selected module is the anchor and claims its requested slot.
- Visible modules that collide try same-row sideways movement first, preferring
  right when possible and then left. Only after same-row fits fail do they move
  downward, scanning nearby columns before farther columns.
- There is no wrap-to-top behavior. If no downward fit exists, save fails
  atomically.
- Hidden and deleted modules do not occupy cells.
- If no 6 x 12 fit exists, save fails atomically.
- Drag feedback should show a ghost or highlighted module, target cell
  affordance, and displaced-module movement through restrained layout
  animation. Respect `prefers-reduced-motion`.

## Preview System

Preview should become a persistent part of customization.

- Desktop preview: a side panel that updates as identity, images, connections, and module drafts change.
- Mobile preview: a reachable Preview section in the same modal, with no horizontal overflow.
- Owner preview: clearly labeled so it is not confused with public view or a saved state.
- Future module preview: module editors should render draft modules with the same safe public renderer where practical.

Preview must render user text as text nodes, not HTML, and must not imply unsupported privacy, verification, integrations, or theme behavior.

## Connections Redesign

Connections should feel platform-aware instead of generic rows.

- Connections is the unified home for custom links, platform links, and
  lightweight integration/provider links. Rich Spotify, Apple Music, YouTube,
  Twitch, and GitHub cards can still remain standalone `music` or
  `creator_live` modules when they need more space.
- Legacy `profiles.links` should render through Connections and should not
  duplicate inside Profile Info or the profile header. Owner migration can
  materialize legacy links into module config after a successful save.
- Use platform cards with icons, concise labels, and validation messages.
- Keep platform-specific validation aligned with current frontend/backend rules.
- Generate links from handles where supported, such as GitHub, Twitch, TikTok, Instagram, X/Twitter, Bluesky, and YouTube handles.
- Require explicit safe URLs for URL-only platforms such as Website and Spotify.
- Keep Discord limited to safe display values or supported invite URLs.
- Keep empty states useful: suggest adding a platform, not fake integrations.

## Integration Status

The editor should distinguish capability levels without exposing secrets:

- Link support: the provider can be used as a safe outbound link or generated
  embed/link card without OAuth.
- Metadata support: server-side non-secret API configuration is present for
  metadata refresh.
- OAuth support: provider OAuth client configuration is present and the editor
  can show `Connect`.
- Missing config diagnostics: link cards may still work, but server config is
  incomplete.

Provider secrets and tokens must never be printed, committed, or sent to the
browser. Missing config diagnostics may name missing keys, but never values.

## Follow-Up Priorities

Onboarding, settings IA, analytics/tracking consent, and ads consent are
separate planning priorities. Do not hide those decisions inside the canvas
editor implementation.

## Theme System Direction

Future profile themes can be Discord-inspired, but must stay constrained.

Allowed later:

- Accent color from an allowlist.
- Surface style from an allowlist.
- Decorative profile effects from reviewed presets.
- Background treatment presets for uploaded profile media.
- Layout presets that preserve mobile stacking and safety actions.

Not allowed:

- Arbitrary CSS.
- Arbitrary HTML.
- Custom JavaScript.
- Unreviewed iframes or embeds.
- Unreadable color combinations.
- Hidden or deceptive controls.
- Fake verification, moderation, privacy, or integration states.

Theme controls must not return to the UI until each option has visible public rendering, contrast checks, mobile checks, and tests.

## Animation Direction

Motion should make customization feel fluid without distracting from editing.

- Use smooth section transitions and preview updates.
- Use subtle reorder feedback for modules.
- Keep editor navigation responsive and predictable.
- Respect reduced-motion preferences.
- Avoid infinite decorative loops, flashing, strobing, and performance-heavy effects.

## Integration Placement

Integrations belong in the canvas editor, not in a settings dashboard or fake
global switches.

- Provider cards show configured/unconfigured state and connected account
  identity when OAuth is available and connected.
- `Connect` starts the CSRF-protected OAuth flow and returns to the profile
  editor with success/error query state.
- Successful OAuth connections should also create or update a lightweight
  Connections entry when a safe provider profile URL can be derived.
- `Disconnect` revokes the local connection state.
- Connected providers expose `Add music` or `Add creator`, creating the
  appropriate module and selecting it for local configuration.
- Selected `music` and `creator_live` modules accept allowlisted provider URLs
  and resolve metadata through the server before saving module config.
- Spotify music modules can use a profile-level Continue overlay for public
  visitors. The first Continue stores device-local consent for that profile and
  may try to start the Spotify embed; later visits can skip the overlay, but
  playback remains best-effort because the browser or Spotify can still block
  audible autoplay.
- Spotify music display should use thia.lol's custom player shell for artwork,
  title, subtitle/artist, description, and compact controls. Spotify still owns
  the actual playback through its embed controller; do not build local Spotify
  audio streaming or hide that provider relationship from users.
- If a provider is missing config, missing OAuth, or failing, the UI should still
  allow safe URL-based module configuration where that provider supports links.
- Spotify and Apple Music create `music` modules. YouTube, Twitch, and GitHub
  create `creator_live` modules. Apple Music user-token auth is deferred; this
  pass supports Apple Music URLs, generated embeds, and configured
  developer-token metadata only.
- Twitch creator modules support status, stream, and stream-plus-chat modes with
  size floors of `1x1`, `3x2`, and `4x3`, with stream-plus-chat expandable to
  `5x3` and `6x5`. Stream-plus-chat is arranged as stream left and chat right,
  and successful embeds use the full module instead of showing the link shell.
  YouTube supports video and playlist URLs plus a connected-channel
  latest-upload mode. GitHub supports public project cards.
- The platform never stores or renders user-supplied iframe HTML. Embeds are
  generated from normalized provider/resource ids only.

## Recommended Implementation Phases

1. P3 customization rebuild: create a new editor from scratch instead of reviving the removed modal, with module-first Connections and a polished preview-first workflow.
2. Preview maturity: add mobile/desktop preview toggles and better unsaved-state messaging without changing public APIs.
3. Appearance presets spec: define visible, contrast-safe accent/surface/background treatment presets before restoring theme controls.
4. Featured content maturity: edit post and room selection from the Featured module in Modules, alongside visibility, order, and layout preferences.
5. Integration cards: add link-first Twitch, Spotify, Apple Music, YouTube, GitHub, or Discord cards only after safety, privacy, and performance rules are explicit.
6. Blog direction: decide whether long-form content is a post type, module-backed selected posts, or a separate model before building blog UI.

## Initial Implementation Slice

Issue #26 implemented the first safe slice, which has since been retired from
the active frontend while P3 customization is redesigned:

- The previous owner-only `Customize profile` entry point and modal are removed.
- Public profiles still render persisted identity, media, modules, featured
  content, badges, and links.
- P3 should build a new editor surface with custom buttons, menus, compact
  cards, and module-first Connections.
- Existing profile save, image upload, and module endpoints only.

It intentionally does not add new schema, integrations, broad themes, arbitrary styling, or new module types.

## Implementation Note - 2026-06-16 Customization Overhaul

Issue #37 is superseded by the P3 customization rebuild. Do not reuse the
removed modal as the baseline. The next editor should be designed around the
modular canvas, link-first expressive modules, custom controls, and a preview
path that feels native to the profile surface.
