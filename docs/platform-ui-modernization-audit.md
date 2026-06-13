# Platform UI Modernization Audit

Date: 2026-06-13

## Executive Summary

Public Readiness V2 has made the core product much more cohesive. The strongest remaining UX risk is no longer a single broken page; it is inconsistency across state handling, modal behavior, route hierarchy, and dense card/panel composition.

Audit inputs:

- Required docs: `AGENTS.md`, `README.md`, `docs/public-readiness-v2-plan.md`, `docs/platform-ui-modernization.md`, `docs/profile-customization-experience.md`, `docs/profile-personal-space-evolution.md`, `docs/public-testing-launch-checklist.md`, `docs/public-testing-readiness-audit.md`, and `docs/product-audit-and-roadmap.md`.
- Source inspection of all route pages, shared UI components, social components, composers, editors, reports, profile panels, and admin/moderation UI.
- Deployed read-only visual checks at `https://thia.lol` on desktop `1280x720` and mobile `390x844`.

Scope limits:

- No large implementation work was performed.
- No auth/session/API/database code was changed.
- Authenticated editor and mutation-heavy states were inspected from source only.
- Read-only deployed checks covered logged-out public states and public API-backed content.

Key finding: no horizontal overflow was observed on sampled desktop or mobile public routes. The highest-impact work is a consistency sprint, not a ground-up redesign.

## Highest Priority UX Problems

1. **State surfaces are fragmented**
   - `EmptyState` and `ApiStateNotice` exist, but Rooms, Search, Chat, Thread, Admin, module editor, and form messages still use local variants.
   - Priority: P1.
   - Tracking: [#31](https://github.com/thiabun/thia.lol/issues/31).

2. **Modal and sheet behavior is inconsistent**
   - Thread, Post composer, Room editor, Profile customization, Chat moot picker, Profile panels, block confirmation, and Report forms all use different layout and close/scroll/message patterns.
   - Priority: P1.
   - Tracking: [#29](https://github.com/thiabun/thia.lol/issues/29).

3. **Chat and Notifications lag behind the polished route system**
   - Logged-out Chat and Notifications use centered empty panels without H1-level route hierarchy; authenticated Chat source shows several custom inline state rows.
   - Priority: P1.
   - Tracking: [#28](https://github.com/thiabun/thia.lol/issues/28).

4. **Mobile dock, footer, and first-visit cookie notice still compete**
   - On short mobile pages, the dock can sit between content and footer, and the first-visit cookie notice occupies the same bottom zone.
   - Priority: P1.
   - Tracking: [#10](https://github.com/thiabun/thia.lol/issues/10).

5. **Reports expand inline in dense places**
   - Report forms can open inside post action rows, profile/room pages, and chat bubbles. This is functional but visually heavy and cramped on mobile.
   - Priority: P1.
   - Tracking: [#29](https://github.com/thiabun/thia.lol/issues/29).

6. **Cards and panels still over-fragment several pages**
   - Home, Profile, Admin, and some editor surfaces stack many bordered sub-boxes, which weakens hierarchy.
   - Priority: P1/P2.
   - Tracking: [#14](https://github.com/thiabun/thia.lol/issues/14).

7. **Admin/moderation UI is functional but not yet a workspace**
   - Reports, room metadata, and badge management are stacked with similar visual weight. Report rows are dense and action clusters compete.
   - Priority: P2.
   - Tracking: [#30](https://github.com/thiabun/thia.lol/issues/30).

8. **Profile secondary panels need refinement**
   - Followers/following/badges panels are a good direction, but empty copy repeats itself, remove-follower confirmation is inline, and Moots is a count pill without a focused panel.
   - Priority: P2.
   - Tracking: [#8](https://github.com/thiabun/thia.lol/issues/8), [#31](https://github.com/thiabun/thia.lol/issues/31).

9. **Form and control primitives are not fully shared**
   - `TextField`, `TextareaField`, `SelectField`, and `SearchField` are solid, but Chat still has a custom textarea, module badge selection uses native checkboxes, and menus/tabs are local implementations.
   - Priority: P2.
   - Tracking: [#14](https://github.com/thiabun/thia.lol/issues/14).

10. **Desktop hierarchy is uneven on sparse routes**
    - Search, Chat, Notifications, Admin signed-out, and Discover loading states can feel sparse while Home/Profile feel dense.
    - Priority: P2.
    - Tracking: [#28](https://github.com/thiabun/thia.lol/issues/28), [#31](https://github.com/thiabun/thia.lol/issues/31).

## Route-by-Route Audit

### Home `/`

Current state:

- Stronger product identity than the earlier homepage.
- Uses a hero panel, post feed, current stats, and room sidebar.
- Live check showed real posts on desktop/mobile and no horizontal overflow.

Problems:

- Card density remains high: hero panel, post cards, metric cards, and room cards compete.
- Stats show plain `Loading` values inside metric cards instead of a unified loading treatment.
- The sidebar feels useful on desktop but becomes a long secondary stack on mobile.

Recommendations:

- Keep the current structure, but reduce secondary card emphasis.
- Move stats loading/error handling into the shared state system.
- Review Home as part of a broader card/panel hierarchy pass.

Priority: P2.

### Discover `/discover`

Current state:

- Clear route header and a compact Rising explainer.
- Shows rising posts, active rooms, and people only when real data exists.

Problems:

- Loading state can leave the page feeling sparse: a header plus `Loading feed`.
- The page has less visual richness than Home or Profile when data is slow or unavailable.
- Empty state and loading patterns should align with Home/Search.

Recommendations:

- Use the shared state system for loading/error/no-data.
- Add a stable section frame that does not disappear entirely while data loads.
- Keep ranking explanation short and non-algorithmic.

Priority: P2.

### Search `/search`

Current state:

- Clean route with a strong search input.
- Handles start, too-short, loading, error, no-result, and grouped result states.
- Live checks showed profiles and rooms grouped for `?q=thia`.

Problems:

- Uses a local `SearchNotice` instead of `ApiStateNotice`.
- Start and keep-typing states are useful but visually identical to larger empty states.
- Results use simple custom cards rather than shared people/room result primitives.

Recommendations:

- Keep the route shape.
- Fold local notices into the shared state system.
- Consider a compact state variant for instructional search states.

Priority: P2.

### Rooms `/rooms`

Current state:

- Polished room discovery surface with search and room cards.
- Creation is correctly visible only to signed-in users.
- Live checks showed no horizontal overflow and good mobile stacking.

Problems:

- `RoomNotice` duplicates shared loading/error state behavior.
- Anonymous users get no clear route-level creation/join context beyond hidden Create button.
- Room cards are visually strong, but repeated card chrome adds density quickly.

Recommendations:

- Reuse shared loading/error primitives.
- Keep search prominent.
- Add any anonymous explanation only if it stays short and does not become marketing copy.

Priority: P2.

### Room Page `/rooms/:slug`

Current state:

- Strong room header with banner/icon/accent, metrics, join/post/edit/report controls, rules, moderators, and posts.
- Mobile posting uses the shell dock, which prevents duplicate floating actions.

Problems:

- Rules and moderator empty copy is plain and low-value.
- Report form expands inline.
- Room rules and moderator cards have equal weight even when empty.
- Empty post state says `This room is quiet` but does not provide a next action for eligible signed-in users.

Recommendations:

- Improve empty rules/moderator states as part of the empty-state pass.
- Move report flow into the shared modal/sheet pattern.
- Reduce secondary panel weight when rules/moderators are empty.

Priority: P1/P2.

### Room Editor

Current state:

- Supports create/edit, images, slug/name/summary/accent/rules, moderator management, and soft-delete confirmation.
- Uses shared fields and styled select.

Problems:

- Mobile behavior is a centered modal rather than a full-height sheet.
- Upload controls duplicate profile customization upload UI.
- Moderator management and delete controls live in the same scroll as routine edits.
- Success/error messages are plain inline paragraphs.

Recommendations:

- Convert to the shared editor sheet pattern.
- Reuse one image-upload control family across room and profile editing.
- Keep delete section visually distinct and confirmatory.

Priority: P1.

### Profile Page `/@handle`

Current state:

- Strongest identity surface in the app.
- Header, badges, connections, social pills, modules, and activity tabs are cohesive overall.
- Live checks showed no mobile overflow.

Problems:

- The header still contains many sub-surfaces: stats, social context, connections, badges, profile controls.
- Report profile sits outside the header, which makes safety action placement feel different from room/post reporting.
- Activity tabs are custom and scroll horizontally on mobile.
- Public module loading/errors are hidden for non-owners, which is clean but can mask module failures.

Recommendations:

- Keep the profile header direction.
- Review profile as part of the card density and tab primitive pass.
- Bring report placement into the modal/sheet/reporting system.

Priority: P1/P2.

### Profile Customization

Current state:

- Most mature editor surface.
- Uses Identity, Appearance, Connections, Modules, and Preview sections.
- Desktop preview and mobile preview are already planned and implemented.

Problems:

- It is a large custom system with local tabs, local messages, local confirm dialogs, and custom module tiles.
- Module editor uses native checkboxes for badge selection.
- `window.confirm` is used for unsaved module changes and delete confirmation.
- Preview is strong on XL desktop but otherwise one section among many.

Recommendations:

- Use this as the model for future mobile sheet work, but extract primitives rather than copying it.
- Replace `window.confirm` with shared confirmation dialogs.
- Normalize module editor messages and badge selection controls.

Priority: P1.

### Chat `/chat`

Current state:

- Moots-only chat foundation exists.
- Logged-out state is clear enough.
- Authenticated source has conversation list, messages, composer, moot picker, loading/error states, and report-message controls.

Problems:

- Logged-out state lacks H1 route hierarchy.
- Short mobile pages place the dock between content and footer.
- Authenticated Chat source uses custom inline loading/error rows instead of shared state components.
- `No chats yet` appears in multiple contexts.
- Report form can expand inside a message bubble.

Recommendations:

- Treat Chat as a full route with consistent heading and state hierarchy.
- Normalize empty/loading/error states.
- Move message reporting into a sheet/modal pattern.
- Revisit desktop empty selected-conversation layout.

Priority: P1.

Tracking: [#28](https://github.com/thiabun/thia.lol/issues/28).

### Notifications `/notifications`

Current state:

- Authenticated page supports unread count, mark-one-read, mark-all-read, empty/loading/error states.
- Logged-out state is clear enough.

Problems:

- Logged-out state lacks H1 route hierarchy and has the same short-page mobile dock issue as Chat.
- Notification rows are consistent, but action messages/errors are inline.
- No compact grouping or preference UI exists, which is correctly deferred.

Recommendations:

- Bring logged-out/loading/empty states into the same route frame as other primary pages.
- Keep grouping/preferences deferred.
- Normalize action errors with shared notices.

Priority: P1/P2.

Tracking: [#28](https://github.com/thiabun/thia.lol/issues/28).

### Moderation and Reporting

Current state:

- Report form supports posts, profiles, rooms, and messages.
- Admin page supports report review, room metadata, badge management, and enforcement actions.

Problems:

- Report form is inline and can be awkward in post action rows and chat bubbles.
- Each report form repeats policy copy and links.
- Admin page is visually dense and operational.
- Room metadata and badge management compete with the report queue.

Recommendations:

- Move report submission into a shared compact sheet/dialog.
- Keep policy links, but reduce repeated copy on dense surfaces.
- Reorganize Admin into a clearer workspace without changing enforcement behavior.

Priority: P1 for report form, P2 for Admin.

Tracking: [#29](https://github.com/thiabun/thia.lol/issues/29), [#30](https://github.com/thiabun/thia.lol/issues/30).

### Followers, Following, Moots, and Badges Panels

Current state:

- Followers, Following, and Badges open focused panels.
- Badge featuring is owner-only and scoped.
- Remove follower is implemented with inline confirmation.

Problems:

- Empty copy duplicates title/body: for example `No badges yet` repeated.
- Moots is a count pill, not a focused panel.
- Remove follower confirmation is inline inside a row.
- Loading/error states use shared notices but with generic titles like `Loading`.

Recommendations:

- Normalize focused-panel empty/loading/error language.
- Decide whether Moots should open a focused panel.
- Move remove-follower confirmation into the shared confirmation pattern.

Priority: P2.

### Module Editor

Current state:

- Owner can add, edit, hide/show/draft, reorder, save, and delete supported module types.
- Preview uses the public module renderer where practical.

Problems:

- Dense nested cards inside a large editor.
- Native checkboxes for featured badge selection.
- `No module content to preview` is a raw dashed-box message.
- Ordering/save rules are correct but not visually obvious.
- Uses `window.confirm` for destructive/discard flows.

Recommendations:

- Normalize module state messages.
- Replace native checkbox rows with a styled selectable-card pattern.
- Replace browser confirms with shared dialogs.
- Keep ordering controls keyboard-friendly.

Priority: P1/P2.

### Settings / Edit Profile

Current state:

- There is no separate account settings route.
- Edit profile behavior lives in the owner-only `Customize profile` flow.
- Auth pages handle sign-in/register only.

Problems:

- From a user expectation standpoint, account settings and profile customization may become conflated as the platform grows.
- This audit should not add settings features, but future navigation should avoid fake or unsupported settings surfaces.

Recommendations:

- Keep using `Customize profile` for profile identity/personal-space editing.
- Do not add a generic Settings route until account-level settings are actually scoped.
- If account settings are later added, separate account/security controls from public profile customization.

Priority: P3 planning.

### Navigation

Current state:

- Desktop nav includes Home, Discover, Search, Rooms, Chat.
- Mobile dock includes Home, Discover, Post, Rooms, Chat, with Search in the header.
- Account menu handles auth/legal/admin.

Problems:

- Mobile dock can appear stranded on short pages because it is sticky inside the layout before the footer.
- Cookie notice competes with the bottom dock on first visit.
- Search placement differs desktop/mobile, which is acceptable but should remain intentional.

Recommendations:

- Continue issue #10 with explicit short-page, footer, and cookie-notice acceptance criteria.
- Keep Admin out of primary nav.
- Preserve Search in desktop nav and mobile header unless a stronger command/search affordance is designed.

Priority: P1/P2.

### Footer

Current state:

- Footer has legal/trust links, bug report link, and required copyright notice.
- Mobile footer remains reachable.

Problems:

- Footer is tall on short mobile pages.
- Bug report guidance is useful but visually competes with legal links on very short pages.
- First-visit cookie notice can overlap the footer/dock zone.

Recommendations:

- Keep content, but review compact mobile spacing.
- Coordinate footer and cookie notice with the mobile dock layout.

Priority: P2.

## Empty State Audit

Overall evaluation:

- Usefulness: medium to high. Most states explain what is empty.
- Tone: calm and mostly product-appropriate.
- Visual design: inconsistent. Some use `EmptyState`, others use plain paragraphs or dashed boxes.
- Consistency: medium. The same concept appears as a panel, a paragraph, a dashed box, or inline text depending on the route.

Empty states found:

| Surface | Current state | Evaluation | Priority |
| --- | --- | --- | --- |
| Home feed | `No posts yet` / public posts will appear | Useful, consistent visual | P3 |
| Home rooms sidebar | `No rooms yet` | Useful, but repeats room-list state | P3 |
| Discover posts | `No posts yet` | Useful, consistent visual | P3 |
| Rooms index | `No public rooms yet` | Useful | P3 |
| Rooms search | `No rooms found` / try shorter search | Useful | P3 |
| Room not found | `Room not found` | Clear | P3 |
| Room posts | `No posts yet` / `This room is quiet` | Calm but could include action for eligible users | P2 |
| Room rules | `No room rules have been added yet` | Plain paragraph, low visual polish | P2 |
| Room moderators | `No room moderators yet` | Plain paragraph, acceptable but bland | P2 |
| Search start | `Start with a name or room` | Useful | P3 |
| Search too short | `Keep typing` | Useful | P3 |
| Search no results | `No results found` | Useful | P3 |
| Chat logged out | `Chat` / sign in to see messages | Clear but lacks route H1 | P1 |
| Chat conversation list | `No chats yet` plus button | Useful, but duplicated elsewhere | P1 |
| Chat selected conversation | `No chats yet` | Ambiguous: means no messages in selected chat | P1 |
| Chat no selected conversation | `Messages` / `No chats yet` | Duplicates copy | P1 |
| Chat moot picker | `No moots yet` | Useful and clear | P2 |
| Chat moot search | `No matching moots` | Useful | P3 |
| Notifications logged out | sign in to see notifications | Clear but lacks route H1 | P1 |
| Notifications empty | `No notifications yet` | Useful | P2 |
| Profile not found | `Profile not found` | Clear | P3 |
| Profile header bio | `No bio yet` | Clear, low-impact | P3 |
| Profile modules public owner view | `No profile modules yet` | Useful for owner, correctly hidden for visitors | P2 |
| Profile feed | `No posts yet` | Useful | P3 |
| Profile replies | `No replies yet` | Useful | P3 |
| Profile rooms | `No rooms yet` | Useful | P3 |
| Followers/following panel | `No followers yet`, `No following yet` | Duplicates title/body | P2 |
| Badges panel | `No badges yet` repeated | Duplicates title/body | P2 |
| Profile customization connections | `No connections yet` | Useful | P3 |
| Profile customization modules | `No modules yet` | Useful | P3 |
| Module preview | `No module content to preview` | Raw dashed-box state | P2 |
| Featured badge module | `No earned badges are available` | Useful, plain | P3 |
| Room/Profile image slots | dashed icon placeholders | Good visual direction | P3 |
| Thread modal | `No replies yet` | Compact and useful | P2 |
| Admin reports | `No reports yet` | Useful | P2 |
| Admin rooms/badges zero state | No strong empty state for all zero cases | Needs normalization | P2 |

## Loading State Audit

Overall evaluation:

- Consistency: medium-low. The shared loading notice exists but is not universal.
- Perceived performance: fair. Some pages show full notices; others show text rows or `Loading` inside metrics.
- Visual polish: uneven.

Loading states found:

| Surface | Current state | Evaluation | Priority |
| --- | --- | --- | --- |
| Route lazy load | bare `Loading thia.lol.` full-page text | Too plain for app shell | P2 |
| Home feed | `ApiStateNotice` | Good | P3 |
| Home stats | metric values say `Loading` | Functional but visually inconsistent | P2 |
| Rooms sidebar on Home | no loading placeholder, only error/empty | Acceptable, but can pop in | P3 |
| Discover feed | `ApiStateNotice` | Good, but page feels sparse | P2 |
| Rooms index | local `RoomNotice` | Duplicates shared primitive | P2 |
| Room detail | local `RoomNotice` for room/posts | Duplicates shared primitive | P2 |
| Search | local `SearchNotice` | Duplicates shared primitive | P2 |
| Profile details | `ApiStateNotice` | Good | P3 |
| Profile feed/replies/rooms | `ApiStateNotice` | Good but titles sometimes generic | P3 |
| Profile focused panels | `ApiStateNotice` with generic `Loading` title | Needs better context | P2 |
| Profile modules | `ApiStateNotice` for owner-visible state | Good | P3 |
| Profile customization modules | plain `Loading modules.` paragraph | Needs shared compact state | P2 |
| Chat auth loading | `ApiStateNotice` | Good | P3 |
| Chat conversation list | inline `Loading messages.` | Too plain | P1 |
| Chat message list | inline `Loading messages.` | Too plain | P1 |
| Chat moot picker | inline `Loading moots.` | Too plain | P2 |
| Notifications | `ApiStateNotice` | Good | P3 |
| Admin session/reports | `ApiStateNotice` | Good | P3 |
| Admin rooms/badges | inline `Loading rooms`, `Loading badges` | Too plain | P2 |
| Thread modal | compact `Loading replies...` | Good as compact variant, but not shared | P2 |
| Nested replies | inline `Loading replies...` | Acceptable compact state | P3 |
| Upload/save buttons | `Uploading`, `Saving`, `Working...` labels | Functional, copy should be normalized | P2 |

## Error State Audit

Overall evaluation:

- Clarity: medium. Most errors say what failed.
- Consistency: low to medium. Errors appear as `ApiStateNotice`, custom panels, rose paragraphs, form messages, and inline tiny text.
- Usefulness: medium-low. Most say refresh or retry later; few provide a recovery button.

Error states found:

| Surface | Current state | Evaluation | Priority |
| --- | --- | --- | --- |
| Home feed/rooms | `ApiStateNotice` or inline action error | Clear but mixed | P2 |
| Discover feed/actions | `ApiStateNotice` plus inline action error | Clear | P2 |
| Rooms index | local `RoomNotice` | Clear, inconsistent | P2 |
| Room detail | local `RoomNotice`, inline action errors | Clear, inconsistent | P2 |
| Search | local `SearchNotice`; captured error message stored but generic text shown | Consistent enough, but local | P2 |
| Chat start/conversation/messages/moots | mix of `ApiStateNotice`, inline text, retry button in picker | Needs normalization | P1 |
| Notifications load/action | `ApiStateNotice` plus inline action error | Clear | P2 |
| Profile load | `ApiStateNotice` | Clear | P3 |
| Profile panels/badges/modules | `ApiStateNotice` and inline errors | Mixed | P2 |
| Profile follow/block/mute | inline text under header | Clear but easy to miss | P2 |
| Profile customization | inline profile/module messages | Functional but not visually unified | P1/P2 |
| Room editor | inline message used for success and failure | Ambiguous severity | P1/P2 |
| Post composer/reply composer | inline rose/leaf messages | Functional | P2 |
| Thread modal/replies | compact inline errors | Acceptable compact state | P2 |
| Report form | small inline error under trigger | Can be missed | P1/P2 |
| Auth form | role alert box | Good | P3 |
| Admin reports/rooms/badges/actions | mixed `ApiStateNotice` and rose paragraphs | Needs workspace consistency | P2 |

## Component Audit

### Buttons

- Shared `Button` and `ButtonLink` are strong.
- Many route-local buttons still compose custom classes, especially reaction controls, chat conversation buttons, module controls, and upload labels.
- Primary/secondary/ghost/quiet variants cover most cases, but destructive actions often use secondary plus custom rose classes.

Recommendation: add explicit destructive and compact-icon action conventions rather than local overrides.

### Cards

- `Panel` is consistent and polished.
- Repeated `rounded-card` inner boxes create visual fragmentation in Home, Profile, Admin, module editor, and room detail.

Recommendation: reserve cards for repeated items and actual tools; use unboxed sections for secondary explanatory content.

### Modals and Sheets

- Profile customization is the best mobile-sheet reference.
- Post composer, Room editor, Chat picker, Profile panels, Thread modal, block confirmation, and Report form do not share a common primitive.

Recommendation: build a modal/sheet primitive family before further editor expansion.

### Tabs

- Profile activity tabs, customization section buttons, and module visibility segmented controls are all local.

Recommendation: create shared tab/segmented-control patterns.

### Inputs

- `TextField`, `TextareaField`, `SelectField`, and `SearchField` are good foundations.
- Chat composer uses a custom textarea.
- Upload controls are duplicated.

Recommendation: consolidate form field and upload-control variants.

### Selects

- Native select styling is improved.
- Select behavior is acceptable for cPanel/static constraints.

Recommendation: keep native selects until a real dropdown need exists.

### Dropdowns and Action Menus

- Account menu and profile action menu are local implementations.
- Profile action menu lacks the same outside-click/escape robustness as the account menu.

Recommendation: create one popover/menu primitive with focus, escape, outside-click, and mobile fallback rules.

### Panels

- Panels define the product mood well.
- Overuse weakens hierarchy.

Recommendation: audit where panels can become plain sections or list groups.

### Toasts

- No toast system exists.
- Success and failure messages appear inline as paragraphs.

Recommendation: do not add global toasts yet; first standardize inline status notices and form messages.

### Badges

- Badge tones are consistent.
- Badges are sometimes overused for section labels, metadata, relationship states, and counts.

Recommendation: distinguish metadata badges from action/status badges.

## Mobile Audit

Observed:

- No horizontal overflow in sampled deployed routes at `390x844`.
- Mobile dock tap targets are comfortable.
- Profile, room, rooms, search, and legal stack correctly.

Problems:

- Short pages put the sticky mobile dock between content and footer.
- First-visit cookie notice competes with the dock/footer bottom space.
- Post action rows wrap on mobile; report controls often move to a second line.
- Report forms and chat message reporting are poor sheet candidates in their current inline form.
- Post composer, room editor, chat picker, and profile focused panels are not consistently full mobile sheets.
- Profile tabs and customization tabs rely on horizontal scrolling.

Recommended mobile priorities:

- Fix short-page dock/footer/cookie behavior.
- Convert dense report/editor/picker flows to shared mobile sheets.
- Add a compact state variant so Chat/Notifications/Admin logged-out states feel intentional on short screens.

## Desktop Audit

Observed:

- No horizontal overflow in sampled deployed routes at `1280x720`.
- Desktop shell and nav are stable.
- Home and Profile make strong use of space.

Problems:

- Home can feel dense because feed, hero, stats, and room cards all use card styling.
- Discover can feel sparse when feed data is loading or unavailable.
- Search is clean but visually light.
- Chat/Notifications logged-out states look like centered empty panels rather than full primary routes.
- Admin is dense and form-heavy.
- Profile customization uses desktop space well but is too custom to scale without extracting primitives.

Recommended desktop priorities:

- Balance dense routes and sparse routes through shared route-header/state patterns.
- Make Admin a true workspace.
- Reduce nested card styling in profile/module/admin surfaces.

## Modernization Opportunities

### P0

- No P0 UI blocker found in sampled read-only public routes.
- No sampled route showed a blank screen or horizontal overflow.

### P1

- Standardize loading, empty, and error surfaces. Tracking: [#31](https://github.com/thiabun/thia.lol/issues/31).
- Unify modal and mobile sheet interaction patterns. Tracking: [#29](https://github.com/thiabun/thia.lol/issues/29).
- Polish Chat and Notifications route layout states. Tracking: [#28](https://github.com/thiabun/thia.lol/issues/28).
- Continue mobile dock/footer/cookie short-page polish. Tracking: [#10](https://github.com/thiabun/thia.lol/issues/10).
- Move report submission out of dense inline contexts. Tracking: [#29](https://github.com/thiabun/thia.lol/issues/29).

### P2

- Modernize Admin/moderation workspace. Tracking: [#30](https://github.com/thiabun/thia.lol/issues/30).
- Reduce card/panel over-fragmentation on Home, Profile, Admin, and editors. Tracking: [#14](https://github.com/thiabun/thia.lol/issues/14).
- Normalize focused panels for followers, following, moots, badges, and remove-follower confirmation.
- Consolidate upload controls across profile and room editors.
- Extract shared tabs, segmented controls, and menu primitives.

### P3

- Decide future account Settings scope before adding a route.
- Add optional skeletons only after the state-system pass.
- Consider global toast behavior only after inline status messages are standardized.
- Continue legal/footer micro-spacing polish.

## GitHub Issue Recommendations

Existing issues to reuse:

- [#8 Add missing empty states across public pages](https://github.com/thiabun/thia.lol/issues/8): keep for empty-state copy and visual consistency.
- [#9 Improve accessibility labels for icon-only buttons](https://github.com/thiabun/thia.lol/issues/9): keep for icon-only control audit.
- [#10 Polish mobile spacing on key public pages](https://github.com/thiabun/thia.lol/issues/10): update scope with short-page dock/footer/cookie findings.
- [#14 Product UI/UX guidelines and component inventory](https://github.com/thiabun/thia.lol/issues/14): use this audit as concrete input.
- [#18 Profile and personal-space evolution plan](https://github.com/thiabun/thia.lol/issues/18): keep for profile product decisions, not generic UI cleanup.

New high-confidence issues created:

- [#28 Polish Chat and Notifications route layout states](https://github.com/thiabun/thia.lol/issues/28).
- [#29 Unify modal and mobile sheet interaction patterns](https://github.com/thiabun/thia.lol/issues/29).
- [#30 Modernize admin and moderation workspace UI](https://github.com/thiabun/thia.lol/issues/30).
- [#31 Standardize loading, empty, and error state surfaces](https://github.com/thiabun/thia.lol/issues/31).

No duplicate issues were created for empty states, mobile spacing, icon labels, or broad UI guidelines because existing issues already cover those umbrellas.

## Recommended Next Modernization Sprint

**Recommended sprint: Platform State and Surface Consistency.**

Single highest-impact goal:

- Make the app feel consistent by standardizing state surfaces and modal/sheet behavior before expanding features.

Suggested scope:

- Shared loading/empty/error primitives and compact variants.
- Convert Rooms/Search/Chat/Admin/thread/module editor local notices to the shared system.
- Define modal/sheet primitives.
- Apply the new modal/sheet pattern first to Report form, Post composer, Room editor, Chat moot picker, and Profile focused panels.
- Include mobile dock/footer/cookie acceptance checks for short pages.

Why this first:

- It touches the widest set of visible inconsistencies without requiring migrations or feature expansion.
- It improves public confidence on both empty and error paths.
- It gives later feature work a clear UI foundation.

Required verification for the sprint:

- `npm run typecheck`
- `npm run lint`
- `npm run optimize:assets`
- `npm run build`
- `git diff --check`
- Browser checks at desktop and mobile sizes.
- API-backed smoke only if the implementation changes auth, posts, replies, rooms, profiles, chat, notifications, reports, or other API-backed behavior.
