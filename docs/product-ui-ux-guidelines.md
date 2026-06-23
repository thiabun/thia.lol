# Product UI/UX Guidelines

> **Status: Active canonical reference.** Future product, frontend, and Codex
> implementation issues should use this document as required context.

Date: 2026-06-14

Source issue: [#14 Product UI/UX guidelines and component inventory](https://github.com/thiabun/thia.lol/issues/14)

Implementation follow-up: [#32 Product UI/UX overhaul pass](https://github.com/thiabun/thia.lol/issues/32)

Related context:

- `AGENTS.md`
- `docs/README.md`
- `docs/brand-guidelines.md`
- `docs/profile-customization-safety-rules.md`

## Purpose

This is the product UI/UX guideline for `thia.lol` after the Public Readiness
V2 work. It is not a design-system rewrite and does not approve a new frontend
stack, server architecture, Tailwind replacement, analytics, ads, or fake
feature expansion.

Use this document to keep future changes coherent, compact, and practical. The
standard is based on real V2 lessons: cards and panels became too common, copy
often explained obvious UI, similar actions drifted into different behavior,
and local modal/state/menu patterns made the platform feel less intentional
than the underlying product.

## Implementation Grounding

These guidelines assume the existing architecture:

- Vite
- React
- TypeScript
- Tailwind CSS
- Motion for React
- React Router
- static build output deployed to the PebbleHost VPS

Future work should improve the current component stack instead of replacing it.
Use existing primitives in `src/components/ui`, social surfaces in
`src/components/social`, shared motion presets in `src/lib/motionPresets.ts`,
and Tailwind tokens/classes already used by the app before inventing a new
local pattern.

## Current Product Guardrails

- GitHub Issues are the active tracker. Do not turn docs into open-ended task
  queues.
- Do not add analytics scripts, ad scripts, trackers, payment flows, optional
  cookies, or monetization claims without an explicit issue and policy review.
- Do not add fake controls, fake integrations, fake media, or unsupported
  product depth just to make a screen look fuller.
- Keep API-backed UX honest. Auth, posts, replies, rooms, profiles, media,
  chat, notifications, moderation, and settings need verification against a
  working API path.
- Profile module data is compatibility data unless a future issue defines the
  replacement editor. Render safely; do not expose editor controls or destructive
  migration behavior by accident.
- Prefer performance-friendly polish: route splitting, compact surfaces, stable
  layout, reduced duplicated chrome, and no broad framework replacement.

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

It should feel like a living social place. The product can breathe through
hierarchy, spacing, subtle motion, and interaction polish, but it should not
become loud, theatrical, or decorative.

`thia.lol` should not feel:

- bulky
- overbuilt
- corporate
- cluttered
- AI-generated
- infantilizing
- overexplained
- card-heavy
- needlessly verbose

## Visual Mood

Sunveil and Frostveil describe mood, contrast, and warmth. They are not an
excuse to make the interface one-note.

Light mode should feel like Sunveil:

- warm solarised soft yellow
- calm
- skin-lit
- fluid

Dark mode should feel like Frostveil:

- cool solarised blue
- moonlit
- icy
- quiet

Use these moods through subtle surfaces, accents, focus states, and motion.
Avoid turning whole pages into a single yellow, blue, beige, slate, or purple
wash. Important controls and content should remain legible before they feel
atmospheric.

## Brand Identity

The primary brand system is the minimal bunny mark plus `thia.lol` wordmark.
The bunny subtly hides a `T` in its nose and mouth, which makes the mark
distinct without needing extra explanation in the UI.

Use the brand compactly:

- Header: bunny mark plus wordmark, once.
- Footer: compact bunny/wordmark treatment near legal and copyright context.
- Auth and legal entry points: one restrained `logo-main` image or contained
  bunny mark where it builds trust and orientation.
- Cookie and loading states: one small circle or squircle bunny mark is
  acceptable when it does not compete with the action or message.
- Favicons/app icons: bunny mark, with the pink variant allowed.
- Social previews and docs: horizontal lockups are appropriate, but avoid them
  in compact in-app surfaces outside the top bar.
- Routine product surfaces: do not repeat the bunny as decoration across feeds,
  post cards, profile modules, rooms, or repeated list items.

The pink background variant is a brand/social/app-icon asset, not a selectable
product theme. Sunveil and Frostveil remain the only app themes unless a future
issue explicitly changes the theme model.

## Core Rules

### 1. Compact By Default

Default toward compact layouts. Optimize for scanability, density, and
readability before adding more vertical space.

Prefer:

- short route headers
- dense but readable rows
- grouped controls with clear hierarchy
- modest panel padding
- compact empty, loading, and error states inside dense tools
- type sizes that match the surface size

Avoid:

- giant cards
- giant pills
- giant buttons
- page sections that look like floating cards
- excessive whitespace used as a substitute for hierarchy
- repeated panels with the same visual weight

Large space is allowed when the task needs it, such as profile customization,
room editing, thread reading, or a focused modal/sheet. Even then, the content
should stay crisp.

### 2. One Pattern Per Action Family

Identical actions should use identical interaction patterns, spacing, motion,
and visual treatment unless there is a clear product reason.

Examples:

- Menu items should behave like menu items whether they navigate or call a
  function. The account menu logout row should not feel different from profile,
  legal, or admin menu rows.
- Report actions should use the shared report trigger and `ModalSheet` flow,
  not route-local inline forms.
- Editor status messages should use shared sheet/status primitives, not plain
  paragraphs in one editor and bordered alerts in another.
- Delete, hide, block, mute, and remove-follower flows should share a
  confirmation pattern appropriate to their risk.

If a component needs a local variant, document the product reason in the issue
or PR summary.

### 3. Cards Are For Real Containers

Cards and panels are useful, but overuse makes the app feel assembled from
feature blocks.

Use cards/panels for:

- repeated social items, such as posts, rooms, search results, and rows
- modals, sheets, dialogs, and framed tools
- focused states that need a clear boundary
- data groups that compare equivalent items

Avoid cards/panels for:

- every subsection on a page
- decorative wrapper sections
- explanatory copy blocks
- nested boxes inside boxes unless the nested element is an actual control or
  repeated item
- fake content, fake media, or placeholder identity surfaces

When hierarchy feels weak, remove chrome before adding another panel.

### 4. Copy Must Earn Its Place

Public copy should be short, direct, useful, and honest.

Prefer:

- concrete labels
- one clear sentence when context is needed
- route descriptions that explain scope, not marketing value
- button text that describes the command
- empty-state text that says what is missing and, when useful, what to do next

Avoid:

- unnecessary subheadings
- repetitive explanations
- obvious instructions
- placeholder-feeling marketing text
- implementation language
- filler statements such as "Small for now, easy to follow."

If a heading already explains the section, do not add a second sentence that
repeats it. If a state is already visually obvious, skip the explanation.

### 5. Ambient Veil Is Retired

`AmbientImage` and `ambient-veil.webp` are retired from active UI and build
assets. Do not reintroduce them as fake content, fake media, fake user
identity, fake room identity, or a placeholder for something the user expects
to inspect.

Future placeholders should be:

- neutral
- honest
- visually quiet
- clearly different from user-uploaded media

Good placeholders include dashed upload slots, initials, simple icons, muted
empty states, and explicit "No image yet" style states when needed.

### 6. Icon-First Actions

When an action is represented by a widely recognizable icon, prefer an
icon-only control with accessible labeling.

Requirements:

- `aria-label`
- `title` when helpful for mouse users
- keyboard focus state
- correct button/link semantics
- no layout shift between default, hover, active, and disabled states

Prefer icon-only controls for:

- close
- search in compact nav
- notifications
- theme
- account menu trigger
- report in dense post/chat metadata
- remove image
- remove moderator
- compact overflow/more actions

Avoid:

- icon plus redundant text in dense action rows
- oversized action rows for familiar commands
- text labels that make repeated controls wrap unnecessarily

Exceptions:

- menus
- lists
- destructive confirmations
- onboarding or first-run flows
- places where text genuinely improves comprehension

## Navigation

Navigation should feel lightweight. It should help people move without
dominating the content.

### Desktop Nav

- Keep the brand compact. `thia.lol` is enough; do not add a generic subtitle
  under it.
- Keep primary nav items short and stable: Home, Discover, Search, Rooms, Chat.
- Keep Admin, Legal, and account-specific destinations out of primary nav.
- Active states should be subtle: soft surface, text weight, or a quiet ring,
  not a large branded block.
- Do not add nav copy that explains each destination inline.
- Preserve clear focus states and link semantics.

### Mobile Dock

- The dock should be visually compact and leave content feeling primary.
- Active states should be subtle.
- The center Post action may be emphasized, but it should not become a large
  floating hero control that competes with content.
- Search can remain in the mobile header unless a stronger mobile search
  affordance is deliberately designed.
- The dock, footer, and cookie notice must not fight for the same bottom space.
- Short pages must still make the footer feel like the page ending, not a second
  surface trapped below navigation.

### Menus

- Use one menu item pattern for equivalent rows, whether the row is a link or a
  button.
- Close menus on item selection.
- Support Escape and outside click where the menu is popover-like.
- Keep rows compact, with one icon and one label unless a destructive or
  safety-sensitive action needs more context.
- Do not put long policy copy inside routine action menus.
- If a menu action opens a confirmation, keep the confirmation in a shared
  dialog/sheet pattern.

### Panels And Sheets

- Use `ModalSheet` for new modal, dialog, and mobile sheet work.
- Use mobile `full` for larger editors and pickers that need room.
- Use mobile `sheet` or `dialog` only for smaller, focused tasks.
- Keep headers short and footers action-oriented.
- Busy sheets should prevent accidental close until the pending task resolves.
- Status inside sheets should use `ModalSheetStatus` or a future shared status
  primitive, not one-off paragraphs.

## Social Surfaces

### Conversations

Conversations should feel connected. Parent posts, replies, and nested replies
should read as one thread, not unrelated cards stacked in a modal.

Preserve:

- thread rails and visual connection cues
- compact reply nesting
- one clear primary reply entry point per context
- click behavior where the post body opens the thread while explicit controls
  remain isolated
- compact loading, empty, and error states in the thread

Avoid:

- duplicate reply controls
- reply/report/delete controls repeated in multiple places for the same context
- isolated cards that break the conversation rhythm
- narrow desktop thread layouts that waste usable width

### Identity

Identity should be easy to scan without crowding content.

Show:

- avatar
- display name
- handle
- badges or relationship context only when relevant
- room context for posts when it affects navigation

Avoid:

- repeated metadata in multiple adjacent places
- many badges with equal visual weight
- large identity panels where a compact row would work
- decorative identity placeholders that look like real media

### Actions

Actions should appear where the user expects them, once per context.

Rules:

- Primary actions can include text when they start a larger task: Post, Create
  room, Message a moot.
- Dense repeated actions should be icon-first when recognizable.
- Destructive actions require clear labeling and, when risk is meaningful, a
  confirmation pattern.
- Auth-required actions should navigate to login or show a concise state, not
  fail silently.
- Action errors must be visible near the action or in the owning sheet.

## Profiles

Profiles are identity surfaces. They should show personality and ownership
without becoming cluttered dashboards.

Prefer:

- a strong identity hierarchy
- compact stats and social context
- optional featured content that feels intentional
- modules that add personality without overwhelming the main identity
- owner-only prompts that are useful and short

Avoid:

- repeated metadata
- unnecessary sections
- too many pills
- too many equal-weight panels
- hidden technical or editor language on public profile views
- making Thia's profile the platform's center of gravity

Profile surfaces should support richer personal spaces over time, but every new
block should answer a product question: what does this help visitors understand
about this member?

### Profile Modules As Glanceable Surfaces

Use a glanceable module rubric for profile modules: modules should be
personalized, single-purpose, adaptive to size, and honest about freshness.
They should not copy platform chrome.

Rules:

- One module, one clear purpose.
- Put the most relevant content or action first.
- Hide public empty modules; owners get compact edit-mode empty states.
- Larger spans must add real media, activity, metadata, or controls.
- `1x1` and `2x1` modules carry one idea; `3x1` adds one supporting detail;
  `2x2` and `3x2` are for richer previews; `4x3` and `6x3` are for larger
  identity layouts or rich creator embeds; `3x4`, `3x6`, and `6x5` are for
  activity or stream-plus-chat creator embeds that earn the height.
- Live/recent labels require API-backed timestamps. Plain links and embeds stay
  static link cards.
- Module shells should keep padding, title treatment, focus states, and
  internal overflow consistent. Avoid nested decorative cards.

## Empty, Loading, And Error States

State surfaces should be calm, specific, and proportional to the context.

Use:

- route-level state for whole-page loading, empty, or unavailable states
- compact state for chat panes, thread sections, picker lists, and embedded tools
- error states with a recovery action when retry is possible
- direct language that names the affected surface

Avoid:

- raw `Loading` text inside cards
- repeated titles and descriptions, such as "No badges yet" twice
- dashed boxes with placeholder-feeling copy
- generic "Something went wrong" copy when the affected surface is known
- claiming a smoke test passed if API-backed behavior was not exercised

`RouteStateNotice`, `CompactStateNotice`, `ApiStateNotice`, and `EmptyState`
are current foundations. Future work should converge these into one coherent
state family instead of adding route-local variants.

## Motion

Motion should make the interface feel alive, but it must clarify instead of
perform.

Use motion to:

- show entry and exit
- reinforce hover, tap, and active states
- clarify nested thread relationships
- make sheets and menus feel anchored
- improve perceived quality during state changes

Do not use motion to:

- draw attention to itself
- delay interaction
- animate decorative filler
- make reading or replying harder
- hide layout instability

Respect reduced-motion settings. Prefer shared motion presets from
`src/lib/motionPresets.ts` over one-off animation values.

## Component Inventory

### Keep Direction

| Surface or component | Why it works | Rule for future work |
| --- | --- | --- |
| Chat message bubbles | Compact, readable, and clearly conversational. Report is tucked into metadata as a compact icon. | Preserve bubble density and metadata hierarchy. Do not turn messages into cards. |
| Thread modal connected layout | Root and replies use rails, compact nesting, and a wider sheet. | Keep conversations connected. Extend this direction for thread work. |
| New `ModalSheet` system | Handles focus, Escape, outside click, busy state, mobile full/sheet/dialog variants, and accessible close buttons. | Use this for new dialogs, editors, reports, and pickers. |
| Compact report icons | Dense surfaces can report without adding heavy rows or inline forms. | Keep report triggers icon-first in posts, threads, chat, profiles, and rooms where space is tight. |
| Shared `Button` and `ButtonLink` | Variants and sizes cover most actions and include motion/focus behavior. | Prefer these before composing local button classes. Add variants only when repeated need proves it. |
| Shared field components | Text, textarea, select, and search fields have consistent labeling and focus treatment. | Reuse them for forms. Move custom textareas and inputs toward these primitives. |
| Profile header direction | Strong identity first, with owner actions, follow/message, social context, links, and badges grouped. | Keep the identity hierarchy, but reduce secondary clutter where possible. |
| Room cards | Good public discovery object with icon, room identity, metrics, and subtle hover. | Keep as repeated discovery cards, but avoid using this much chrome for every room subsection. |
| `RouteHeader` and compact state direction | Chat shows stronger route hierarchy and more coherent states. | Continue converging route headers and state notices across sparse routes. |

### Modernize

| Surface or component | Current issue | Direction |
| --- | --- | --- |
| Account and profile menus | Local implementations can drift, including link rows versus action rows. | Create one menu/popover primitive with consistent row behavior, Escape, outside click, and mobile fallback rules. |
| Home stats and sidebar | Metric cards plus filler copy add visual weight. | Make stats compact, remove filler, and use shared loading/error treatment. |
| Profile tabs and segmented controls | Route-local horizontal tab patterns are repeated. | Create a shared compact tab/segmented-control pattern. |
| Profile focused panels | Followers, following, and badges panels are useful but copy and confirmations vary. | Normalize empty/loading/error copy and destructive confirmation behavior. |
| Profile customization modules | Powerful but dense, with nested cards and local controls. | Extract primitives before copying this pattern to other editors. |
| Room editor | Uses `ModalSheet`, but upload, moderator, and delete sections still feel locally built. | Share upload controls and status patterns across profile and room editing. |
| Chat composer | Uses a custom textarea. | Move toward shared `TextareaField` behavior without hurting chat density. |
| Search result cards | Clean but route-local. | Consider shared compact person/room result rows. |
| Admin/moderation workspace | Functional but visually dense and same-weight. | Reorganize into a clearer workspace while preserving behavior. |
| State notices | Multiple good primitives exist, but usage is uneven. | Consolidate into route, compact, inline, and sheet variants. |
| Upload controls | Profile, room, and post upload controls repeat similar logic and copy. | Create one image-upload control family. |

### Avoid Repeating

| Pattern | Why to avoid it | Replacement direction |
| --- | --- | --- |
| Old bulky cards and panels | They make routes feel heavy and fragmented. | Use unboxed sections, compact rows, or one purposeful panel. |
| Excessive explanatory copy | It makes the product feel generated and unsure. | Use direct labels and one useful sentence at most. |
| Filler copy like "Small for now, easy to follow." | It does not help the user decide or act. | Remove it or replace it with specific state/data context. |
| Ambient Veil as fake media or content | It implies identity or content that does not exist. | Use honest placeholders, initials, icons, or quiet empty states. |
| Route-local modal/sheet systems | Different close, scroll, focus, and mobile behavior weakens trust. | Use `ModalSheet` and shared confirmation/status patterns. |
| Inline report forms in dense rows | They make posts, profiles, rooms, and chat bubbles cramped. | Open the shared report sheet from compact triggers. |
| Browser `window.confirm` | It breaks product tone and is hard to style or explain. | Use shared confirmation dialogs/sheets. |
| Native-looking controls where custom primitives exist | They make polished surfaces feel unfinished. | Use shared fields, buttons, tabs, menus, and selectors. |
| Giant pills and oversized action rows | They reduce scanability and make social surfaces feel bulky. | Use compact icon controls, compact buttons, and list rows. |
| Duplicate controls for the same context | They make actions feel uncertain. | Show one clear action per context. |

## Future Codex Task Checklist

Before changing UI, a future issue or Codex task should answer:

1. Does this preserve compactness and scanability?
2. Does it use an existing shared primitive before creating a local variant?
3. Are identical actions using identical behavior?
4. Is the copy useful, short, and non-repetitive?
5. Are cards or panels framing real content rather than filling space?
6. Are icon-only actions accessible with `aria-label`, title where useful, and
   keyboard support?
7. Does motion clarify state, hierarchy, or interaction?
8. Does the change respect mobile dock, footer, and sheet constraints?
9. If the change touches API-backed behavior, was it verified against a working
   API path or clearly marked blocked?

Future issues can link this document directly as the product standard for
Public Readiness V2 UI work.
