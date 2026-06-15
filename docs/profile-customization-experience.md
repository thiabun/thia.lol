# Profile Customization Experience

> **Status: Active product direction.** Use this for owner profile editor IA,
> preview behavior, Connections, and customization experience. Issue
> [#26](https://github.com/thiabun/thia.lol/issues/26) implemented the first
> safe slice; future work should be tracked in GitHub Issues.

Date: 2026-06-13

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

It should not feel like:

- A database form.
- A fake theme builder.
- A link-in-bio clone.
- A page builder where users can break layout, safety controls, or moderation context.

The first experience layer should keep functionality practical: edit current profile identity, upload current profile images, manage current Connections, manage current safe v1 modules, and preview the combined result.

## Editing Sections

The customization surface should organize existing behavior into five sections:

- Identity: display name, bio, location, and future identity fields if approved.
- Appearance: avatar, banner, and profile background image. Accent/theme controls stay hidden until presets visibly affect public rendering through tested, contrast-safe mappings.
- Connections: platform cards, platform-aware validation, handle-to-link generation where supported, and clearer empty states.
- Modules: current v1 personal-space modules, ordering, visibility, save/delete behavior, and module preview.
- Preview: desktop and mobile-oriented previews of the public profile using current safe data only.

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

## Future Integration Placement

Future integrations belong in Modules or Connections, not in fake global switches.

- Twitch: start as a safe channel link or static card; live status/embeds require separate API/privacy/performance review.
- Spotify: URL-first link/card; embeds or metadata require a later integration issue.
- Apple Music: URL-first link/card; embeds require later review.
- YouTube: channel/video links first; latest-video or embed behavior is later work.
- Blog modules: should follow the long-form content decision in the profile evolution plan before implementation.

## Recommended Implementation Phases

1. Unified customization modal: merge profile editing and module editing entry points, add persistent preview, and redesign Connections as platform cards using existing APIs.
2. Preview maturity: add mobile/desktop preview toggles and better unsaved-state messaging without changing public APIs.
3. Appearance presets spec: define visible, contrast-safe accent/surface/background treatment presets before restoring theme controls.
4. Featured content modules: implement featured posts and featured rooms as separate scoped issues.
5. Integration cards: add link-first Twitch, Spotify, Apple Music, YouTube, GitHub, or Discord cards only after safety, privacy, and performance rules are explicit.
6. Blog direction: decide whether long-form content is a post type, module-backed selected posts, or a separate model before building blog UI.

## Initial Implementation Slice

Issue #26 implements the first safe slice:

- One owner-only `Customize profile` entry point.
- A modal with Identity, Appearance, Connections, Modules, and Preview sections.
- A persistent desktop preview and reachable mobile preview.
- Platform-aware Connection cards.
- Existing profile save, image upload, and module endpoints only.

It intentionally does not add new schema, integrations, broad themes, arbitrary styling, or new module types.

## Implementation Note - 2026-06-16 Compact Pass

Issue #37 tightens the first owner editor into a compact Profiles v3 flow
without changing profile fields, modules, or backend contracts:

- Desktop customization is narrower, with smaller shell padding and a compact
  side preview.
- Mobile keeps the editor full-height, with horizontally scrollable compact
  section tabs and no horizontal page overflow.
- Identity, Appearance, Connections, Featured, Modules, and Preview remain
  reachable in the same flow.
- Profile fields, upload rows, featured pickers, module tiles, layout presets,
  and preview cards use denser spacing so routine edits feel like profile
  adjustment rather than a dashboard.
- Layout customization now lives inside the Modules section of `Customize
  profile`; the public profile no longer shows a separate `Customize layout`
  action.
