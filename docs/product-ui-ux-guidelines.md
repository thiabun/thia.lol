# Product UI/UX Guidelines

> **Status: Active canonical reference.** Future product, frontend, and Codex
> implementation work should use this document as required context.

Date: 2026-07-10

Related context:

- `AGENTS.md`
- `docs/README.md`
- `docs/brand-guidelines.md`
- `docs/profile-customization-safety-rules.md`

## Purpose

`thia.lol` is a compact social place for posts, rooms, profiles, messages, and
trust surfaces. The interface should feel clear, easy, modern, sleek, refined,
friendly, compact, and alive.

This document is the product design standard for the app. It does not approve a
new frontend stack, server architecture, analytics layer, ad system, payment
flow, or fake feature expansion. Improve the existing Vite, React, TypeScript,
Tailwind CSS, Motion for React, and React Router app.

The standard is based on the current product shape:

- The app should feel like a living place, not a stack of disconnected widgets.
- Compactness matters because social content is scanned repeatedly.
- Real state matters more than decorative metrics.
- Shared primitives should carry polish across routes.
- Public claims, controls, integrations, and stats must be honest.

## Design Principles

### Purpose

Every screen should answer three questions quickly:

1. What is this?
2. What matters here?
3. What can I do next?

If a section, metric, sentence, or visual treatment does not help answer those
questions, remove it or reduce it.

### Responsibility

Act in people's best interest. Do not add misleading stats, fake live states,
fake integrations, fake trust signals, or controls that imply behavior that does
not exist. API-backed UI must be verified against a working API path.

### Simplicity

Use direct labels, clear hierarchy, and fewer sections. Prefer compact rows,
lists, and restrained panels over sprawling dashboards or decorative grids.

### Craft

Spacing, type, focus, hover, loading, empty, error, disabled, and selected
states are part of the feature. Do not leave them to browser defaults or route
local drift.

### Delight

The product can feel springy and alive through motion, hover response, soft
state transitions, and small interaction details. Delight should never make the
app louder, slower, harder to read, or more theatrical.

## Product Feel

`thia.lol` should feel:

- clear
- easy
- modern
- sleek
- refined
- friendly
- compact
- alive

It should not feel:

- bulky
- overbuilt
- corporate
- cluttered
- AI-generated
- infantilizing
- overexplained
- card-heavy
- needlessly verbose
- fake-polished

## Themes

The selectable site themes are generic Light and Dark modes. Their product mood
names are:

- Light: `Glinda`
- Dark: `Elphaba`

These are tonal product names only. Do not add character art, fandom jokes,
theatrical styling, stage imagery, magic props, or any other theme literalism.
`thia.lol` should still feel like `thia.lol`.

### Glinda, Light Mode

Glinda is pink-toned light mode:

- soft
- bright
- clean
- friendly
- refined
- elegant
- modern

Pink guides the tone through accents, focus states, selected states, and small
brand details. It must not contaminate every surface. The base UI should still
use readable light neutrals, disciplined borders, and strong text contrast.

### Elphaba, Dark Mode

Elphaba is green-toned dark mode:

- rich
- sleek
- calm
- sharp
- alive
- modern
- refined

Green creates identity through action states, focus, selected navigation, and
status surfaces. It must not become neon sludge. The dark base should stay calm,
deep, and legible.

### Theme Migration

Older persisted values may still contain `sunveil` or `frostveil`. Runtime code,
API validation, and migrations should map old values to the new model:

- `sunveil` -> `light` for the global site theme
- `frostveil` -> `dark` for the global site theme
- `sunveil` -> `glinda` for profile and room presets
- `frostveil` -> `elphaba` for profile and room presets

Old names may appear only in compatibility code, tests that prove migration, or
historical SQL migrations. Product-facing copy and active design docs should use
Light, Dark, Glinda, and Elphaba.

## Brand Identity

The primary identity remains the minimal bunny mark plus `thia.lol` wordmark.
Thia is a founder profile, for example `/@thia`, not the whole product.

Use the brand compactly:

- Header: bunny mark plus wordmark once.
- Footer: compact brand treatment near legal and copyright context.
- Auth and legal entry points: one restrained logo or mark where it builds
  trust and orientation.
- Cookie and loading states: one small mark is acceptable when it does not
  compete with the action or message.
- Social previews and docs: horizontal lockups are appropriate.

Avoid repeating the bunny as decoration across feeds, post cards, profile
modules, room cards, empty states, or backgrounds.

## Layout And Density

### Compact By Default

Default toward compact layouts. Optimize for scanability, density, and
readability before adding vertical space.

Prefer:

- short route headers
- dense but readable rows
- grouped controls with clear hierarchy
- modest panel padding
- compact empty, loading, and error states
- type sizes that match the surface size

Avoid:

- giant cards
- giant pills
- giant buttons
- page sections styled as floating cards
- excessive whitespace used as a substitute for hierarchy
- repeated panels with the same visual weight

Large space is allowed for focused editors, thread reading, room editing,
profile customization, and full-screen mobile sheets. Even then, keep the
content crisp.

### Container Rules

Cards and panels are for real containers:

- repeated social items
- rooms and search results
- modals, sheets, dialogs, and framed tools
- focused state notices
- data groups that compare equivalent items

Do not wrap every subsection in a panel. Do not put UI cards inside decorative
cards. When hierarchy feels weak, remove chrome before adding a new panel.

### Rows And Columns

Rows should be easy to scan:

- primary identity first
- short secondary metadata
- one action cluster
- stable icon sizing
- compact edit or overflow actions where appropriate
- no duplicated action for the same context

Columns should have a real purpose. Side rails are for related navigation,
rooms, people, or state summaries. Do not use side rails for filler text or fake
metrics.

## Component Standards

Use existing shared primitives first:

- `Button` and `ButtonLink`
- `IconButton`
- shared field components
- `ModalSheet`
- `Panel`
- `RouteHeader`
- `RouteStateNotice`
- `CompactStateNotice`
- `ApiStateNotice`
- `EmptyState`
- `Badge`
- `SegmentedControl`

When a local variant is needed, keep it small and reuse token values for color,
radius, border, shadow, spacing, type, and focus behavior.

### Buttons

Buttons should be compact, direct, and stateful:

- Primary: one clear next action.
- Secondary: safe supporting action.
- Ghost or quiet: low-emphasis navigation or inline action.
- Danger: destructive action only.
- Icon-only: familiar compact actions such as close, search, theme,
  notifications, report, overflow, remove, and refresh.

Every icon-only control needs `aria-label`, focus state, and a stable hit area.

### Forms And Inputs

Form controls should use shared field primitives unless the surface has a
special interaction need, such as chat composition or mention editing.

Inputs need:

- visible label or accessible label
- clear focus ring
- useful placeholder, not instructions repeated from the label
- inline error or owning sheet error
- stable height across default, focus, disabled, and error states

### Tabs And Segmented Controls

Tabs should be compact and predictable. Selected state should use color, weight,
or a small indicator, not a large block that overwhelms content.

Use tabs for view changes such as Feed, Replies, Rooms, and profile module
filters. Use segmented controls for compact mode choices.

### Menus, Modals, And Sheets

Menus should use one row pattern for equivalent links and actions. Close on item
selection, support Escape, support outside click, and keep rows compact.

Use `ModalSheet` for new dialogs, editors, reports, confirmations, and pickers.
Headers should be short. Footers should be action-oriented. Busy sheets should
prevent accidental close until pending work resolves.

### State Notices

Empty, loading, and error states should be proportional to their context.

Use route-level notices for whole-page states and compact notices for embedded
tools, panes, threads, and lists.

Good:

- "No rooms found"
- "Try a shorter search."
- "Replies are not available"
- "Try refreshing in a moment."

Bad:

- "Something went wrong" when the affected surface is known
- repeated title and body with the same phrase
- raw `Loading` text inside a card
- decorative empty-state copy that adds no action or context

### Toasts And Status

Toasts and inline statuses should say what changed and what remains possible.
They should not praise the app or use vague product fluff.

## Copy Tone

Copy should be short, direct, useful, and honest.

Prefer:

- concrete labels
- one useful sentence when context is needed
- route descriptions that explain scope
- button text that describes the command
- empty-state text that says what is missing

Avoid:

- unnecessary subheadings
- repetitive explanations
- obvious instructions
- placeholder marketing text
- implementation language
- filler statements

If a heading already explains the section, do not add a second sentence that
repeats it.

## Navigation

Navigation should feel lightweight and calm.

### Desktop

- Keep the brand compact.
- Keep primary nav stable: Home, Discover, Search, Rooms, Chat.
- Keep Admin, Legal, and account destinations out of primary nav.
- Active state should be subtle and readable.
- Do not add explanatory copy to nav items.

### Mobile

- Mobile is a primary product layout, not a compressed desktop canvas.
- Routes use one clear vertical reading and interaction flow at 320-430 CSS
  pixels. Columns stack, action clusters wrap, and focused workspaces become a
  list-to-detail flow.
- The fixed dock should leave content primary. Every route reserves the dock's
  full height plus the safe-area inset; focused chat, room, and editing panes
  may hide it when they provide an explicit Back action.
- The center Post action may be emphasized, but should not become a floating
  hero control.
- Search can remain in the mobile header.
- Dock, footer, cookie notice, and modals must not fight for the same bottom
  space.
- Primary controls and icon actions use at least a 44 x 44 CSS pixel effective
  touch target on coarse pointers. Hover must never be the only way to discover
  or operate an action.
- Full-height sheets and focused composers follow the visual viewport so the
  mobile keyboard cannot cover their footer or primary action.
- Page-level horizontal scrolling is never an accepted responsive technique.
  Flex/grid tracks use zero minimums and media, embeds, long text, and loading
  transitions stay inside their owning surface.

## Social Surfaces

### Feeds And Posts

Feeds should feel readable and conversational. Repeated post cards need clear
identity, body, media, and one action row. Keep metadata compact.

Native video should autoplay muted only while focused in the viewport, pause
when focus moves away, retain visible controls, and never outrank consented
profile music on profile pages.

Feed media must reserve its aspect from stored dimensions where available,
remain `object-fit: contain`, and keep the same viewport-bounded width before,
during, and after loading or autoplay. Root overflow clipping does not count as
fixing an oversized post or attachment.

Avoid:

- duplicated reply/report/delete controls
- large action rows for repeated posts
- fake popularity indicators
- route copy that competes with the feed

### Rooms

Rooms are shared places. Room cards should show name, slug, summary, member/post
context, and owner when useful. Room theme should tint the surface without
making the card feel like a separate product.

Avoid decorative stripes, oversized arrows, or repeated badges when the room
identity already carries enough signal.

### Chat

Chat should feel like a focused workspace:

- conversation list
- selected conversation
- readable message bubbles
- compact composer
- clear empty state

Do not turn messages into cards. Preserve density and keyboard usability.

### Notifications

Notifications should read as a compact activity list. Unread state should be
obvious but calm. Mark-read actions should stay close to the affected row or in
one route-level action.

## Profiles

Profiles are identity surfaces. They should show personality and ownership
without becoming cluttered dashboards.

Prefer:

- strong identity hierarchy
- compact social context
- optional featured content that feels intentional
- modules that add personality without overwhelming identity
- owner-only prompts that are useful and short

Avoid:

- repeated metadata
- unnecessary sections
- too many pills
- too many equal-weight panels
- hidden technical/editor language on public profile views
- making Thia's profile the platform center of gravity

Profile modules are glanceable surfaces:

- one module, one clear purpose
- most relevant content first
- public empty modules are hidden
- owner empty states are compact
- larger spans must add real media, activity, metadata, or controls
- module shells keep padding, title treatment, focus states, and overflow
  consistent
- no nested decorative cards

Do not resurrect retired profile editor patterns. Future profile customization
work should use the current constrained model and real backend/API persistence.

## Auth And Trust

Auth pages should orient people quickly. If someone is already signed in, show
the current account state clearly and keep forms secondary or out of the way.

Legal and trust pages can carry more text, but their index should stay scannable
with clear categories and direct policy links.

## Accessibility

Accessibility is part of the visual standard:

- readable contrast in both themes
- visible focus states
- keyboard paths for menus, sheets, tabs, forms, and action rows
- semantic headings
- accurate labels for icon-only buttons
- reduced-motion support
- no horizontal page scroll on mobile
- controls do not overlap content or each other
- text does not clip or overflow its container

Profile and room custom themes must preserve text, action, report, and
moderation readability.

## Motion

Motion should clarify:

- route entry
- hover and tap response
- menu and sheet anchoring
- thread relationships
- state changes

Do not use motion to hide layout instability, delay interaction, or decorate
empty space. Respect reduced-motion settings and prefer shared presets from
`src/lib/motionPresets.ts`.

## Good And Bad Patterns

| Good | Bad |
| --- | --- |
| One route header, one clear action group. | Route header plus multiple equal subheaders before content. |
| Compact post rows with one action row. | Repeated oversized action buttons under every post. |
| Room cards with identity, summary, and one calm theme tint. | Decorative stripes, arrows, badges, and stats all competing. |
| Real counts from API-backed data. | Fake metrics added for visual balance. |
| Empty state names the missing content and recovery action. | Generic "Something went wrong" or repeated "No items yet" copy. |
| Shared `ModalSheet` confirmation. | `window.confirm` or route-local dialog behavior. |
| Light/Dark UI labels with Glinda/Elphaba documented as mood names. | Sunveil/Frostveil in product-facing copy. |
| Settings changes use existing recent design patterns. | Reworking settings only because adjacent surfaces changed. |

## Surface Inventory

Core routes that should stay coherent:

- `/`
- `/discover`
- `/search`
- `/rooms`
- `/rooms/:slug`
- `/chat`
- `/notifications`
- `/settings`
- `/onboarding`
- `/@/:handle`
- `/:profileHandle`
- `/:profileHandle/posts/:postId`
- `/login`
- `/register`
- `/legal`
- policy routes such as `/terms`, `/privacy`, `/cookies`, and safety pages
- share render routes used for generated cards

Implementation should audit both anonymous and authenticated states where the
route differs.

## Future Codex Task Checklist

Before changing UI, answer:

1. Does this preserve compactness and scanability?
2. Does it use an existing shared primitive before creating a local variant?
3. Are identical actions using identical behavior?
4. Is the copy useful, short, and non-repetitive?
5. Are cards or panels framing real content rather than filling space?
6. Are icon-only actions accessible?
7. Does motion clarify state, hierarchy, or interaction?
8. Does the change respect mobile dock, footer, and sheet constraints?
9. If the change touches API-backed behavior, was it verified against a working
   API path or clearly marked blocked?
10. Are old theme values migrated or aliased without exposing old names in
    product-facing copy?
