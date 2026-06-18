# Profile Customization Experience

> **Status: Transition state.** The experimental module/canvas editor is retired
> from the active product surface. Public modules remain readable and data/API
> compatibility is preserved while the replacement editor is planned.

Date: 2026-06-18

## Purpose

Profile customization should help members quickly keep their identity and media
current without forcing them through a brittle layout editor. The current active
surface is intentionally narrow: owners can edit profile identity and media,
while persisted modules render as read-only compatibility content.

This document complements `docs/profile-personal-space-evolution.md` and
`docs/profile-customization-safety-rules.md`. It does not approve arbitrary CSS,
HTML, JavaScript, broad profile themes, analytics, ads, or new schema.

## Active Editor

The active owner entry point is `Edit profile`.

It supports:

- Display name.
- Bio, including multiple lines.
- Location.
- Avatar upload through the shared crop/zoom modal.
- Banner upload through the shared crop/zoom modal.
- Profile background image upload through the shared crop/zoom modal.
- Profile background video upload where the backend purpose allows it.
- Background clarity.

Identity and media edits autosave through existing profile APIs. The UI must
show saving, saved, and error states clearly so owners do not believe they need
to save a separate layout after changing an avatar, banner, background, bio, or
location.

## Retired Experimental Surface

The P3 module/canvas editor is not active during this transition.

Owners should not currently see:

- Module drag handles.
- Module selection controls.
- Module placement controls.
- Module size controls.
- Pin controls.
- Add, remove, restore, or configure module controls.
- Integration setup panels inside the editor.
- Collision previews.
- Desktop or mobile canvas editor panels.

The backend tables, module rows, grid fields, pin fields, integration tables,
and canvas endpoints remain intact for recovery, migration, and compatibility.
Do not drop or mutate existing module data as part of this transition.

## Public Rendering

Persisted modules continue to render publicly through safe module renderers:

- Profile info.
- About/text.
- Connections.
- Badges.
- Featured post and featured room.
- Gallery/media.
- Creator/live cards.
- Music cards.
- Activity.

Public and non-owner visitors must not see editor controls. Owners also see
modules as read-only while the replacement editor is planned.

## Replacement Requirements

The next module editor must be designed from the beginning around:

- Mobile-first layout, not a desktop editor squeezed onto phones.
- Small-screen performance at 1080p and below.
- Keyboard and assistive-technology access.
- Non-drag alternatives for layout changes.
- Clear undo/recovery behavior.
- Autosave or obvious save boundaries.
- Public preview that cannot be confused with draft-only state.
- Module data recovery without destructive edits.

The replacement should keep the word "module" as the product term.

## Connections And Integrations

Connections and rich integrations are preserved in data and public rendering,
but their editing UI is temporarily unavailable in the active product surface.
The next system should make Connections and integrations feel direct and
provider-aware, without requiring users to manually construct provider URLs when
OAuth or handle normalization can do that safely.

Provider secrets and tokens must never be printed, committed, or sent to the
browser. Missing config diagnostics may name missing keys, but never values.

## Theme System Direction

Theme editing and custom color profile overrides remain deferred. Do not add
theme controls until selected presets visibly affect public rendering, pass
contrast checks, work on mobile, and have a recovery path.

## Follow-Up Priorities

Onboarding, settings IA, analytics/tracking consent, and ads consent are
separate planning priorities. They should not be hidden inside profile editor
work.
