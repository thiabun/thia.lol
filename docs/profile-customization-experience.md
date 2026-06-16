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
- Adding widgets to a desktop or arranging apps on a home screen.

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

## Canvas Dock Model

The active P3 editor is an owner-only inline canvas editor:

- Desktop: a translucent widget dock sits over the live profile. The profile
  canvas remains visible and editable behind it.
- Mobile: the dock compresses into a bottom sheet. Exact desktop placement is
  still ignored for public mobile layout.
- The dock categories are Essentials, Featured, Media, Integrations, and
  Removed.
- Module cards show purpose, size behavior, connection/metadata state where
  relevant, and direct Add or Restore actions.
- The selected-module inspector uses custom controls: segmented size buttons,
  icon nudge controls, show/hide, remove, and module-specific actions where
  supported. Avoid visible raw grid selects as the primary UI.
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
- Visible modules that collide are pushed row-major to the next valid fit.
- Hidden and deleted modules do not occupy cells.
- If no 6 x 9 fit exists, save fails atomically.
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

- Use platform cards with icons, platform labels, helper text, and validation messages.
- Keep platform-specific validation aligned with current frontend/backend rules.
- Generate links from handles where supported, such as GitHub, Twitch, TikTok, Instagram, X/Twitter, Bluesky, and YouTube handles.
- Require explicit safe URLs for URL-only platforms such as Website and Spotify.
- Keep Discord limited to safe display values or supported invite URLs.
- Keep empty states useful: suggest adding a platform, not fake integrations.

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

Integrations belong in the canvas dock, not in a settings dashboard or fake
global switches.

- Provider cards show configured/unconfigured state and connected account
  identity when OAuth is available and connected.
- `Connect` starts the CSRF-protected OAuth flow and returns to the profile
  editor with success/error query state.
- `Disconnect` revokes the local connection state.
- `Use link` accepts allowlisted provider URLs and resolves metadata through the
  server before creating modules.
- Suggestions are API-backed where available. If a provider is missing config,
  missing OAuth, or failing, the UI should degrade to pasted URLs and compact
  outbound cards.
- Spotify and Apple Music create `music` modules. YouTube, Twitch, and GitHub
  create `creator_live` modules. Apple Music user-token auth is deferred; this
  pass supports Apple Music URLs, generated embeds, and configured
  developer-token metadata only.
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
