# Thread Experience Redesign

Date: 2026-06-11

Status: research, audit, and planning only. This document does not approve a frontend implementation, backend implementation, migration, or route change by itself.

Related Public Readiness v2 track: Thread Experience Redesign.

## Current Experience Audit

The current thread experience is implemented inside `src/components/social/PostCard.tsx`. `PostCard` owns the `threadOpen` and `threadComposerOpen` state, renders the feed card, and conditionally portals a `ThreadModal` into `document.body`.

Thread entry points:

- The feed post body/media area is a full-width button with `data-testid="post-body-open-thread"` and opens the modal.
- The visible Reply action in the post action row opens the same modal with the root reply composer open.
- Author avatar/name/handle navigate to the profile.
- The room badge navigates to the room.
- Like, reblog, report, delete, and hide remain isolated actions.
- There is no dedicated route such as `/posts/:id`, `/@handle/posts/:id`, or `/rooms/:slug/posts/:id`.
- Browser URL and history do not change when a thread opens.

Thread modal:

- The modal is a centered dialog capped at `max-w-2xl`.
- It uses a sticky header with the title `Thread` and a close icon button.
- The body renders a root post preview, a separate root action row, optional reply composer, and a reply list.
- Loading, error, and empty states are rendered as bordered cards.
- The modal closes on Escape and backdrop pointer down.
- Body scroll is locked while the modal is open.

Thread layout:

- The root post preview is a separate bordered card inside the modal.
- Replies are separate bordered cards with their own action rows.
- Nested replies add left margin and stronger left border, but they still read as card stacks rather than one connected conversation.
- The modal repeats much of the feed card structure instead of having a thread-specific conversation layout.

Post card structure:

- Post cards are framed `Panel` components with avatar, author identity, timestamp, room badge, social-proof pills, post body/media button, and action row.
- The room badge and social-proof pills sit between identity and body, which can interrupt scan order in dense conversations.
- The card itself is not the thread target; only the body/media button and Reply action open the modal.

Reply rendering:

- Replies reuse the same `Post` model.
- Reply previews show avatar, author identity, timestamp, body, optional media, and the full reply action row.
- Reply actions include Reply, Like, Reblog, Report, and Delete where allowed.
- Reply count can reveal a `Show n replies` button for lazy nested loading.

Reply composer placement:

- The root reply composer is hidden until the user clicks Reply.
- When authenticated and the composer is closed, the modal also renders a separate compact Reply button below the root action row.
- Nested reply composers render inside the reply card they belong to.
- Logged-out users get a `Log in to reply` prompt with a login link.

Reply nesting:

- Nested replies load lazily through `GET /api/posts/:id/replies`.
- Rendering currently allows nesting while `depth < 3`.
- Backend ancestor visibility helpers cover the currently rendered parent, grandparent, and great-grandparent depth.
- There is no permanent thread root model such as `posts.root_id` or `posts.thread_id`.

Mobile behavior:

- The modal uses `max-h-[calc(100dvh-2rem)]`, horizontal margins, and an internal scroll area.
- It behaves close to a full-screen sheet on small screens, but visually remains a centered modal.
- Nested reply indentation consumes valuable horizontal space on small screens.
- The global mobile dock is fixed at the bottom of the viewport and the footer reserves large bottom padding, so footer/dock behavior remains a separate Public Readiness v2 shell polish issue.

Desktop behavior:

- The desktop modal is visually narrow for a core reading surface.
- `max-w-2xl` leaves unused horizontal room on common laptop and desktop screens.
- The centered modal is useful for lightweight inspection, but it does not feel like a primary conversation destination.
- Long threads are constrained to an internal scroll region instead of a normal document page.

## UX Problems

- Thread content is over-fragmented. The root, reply composer, empty states, and replies each become separate bordered surfaces.
- The conversation lacks a visible spine. Replies are related by vertical order only; there is no clear line, avatar rail, or grouped indentation system tying parent and child messages together.
- Desktop width undersells the thread surface. The modal cap makes a core product experience feel like a secondary overlay.
- The root post is visually downgraded in the modal. It becomes a compact preview card instead of the anchor of the conversation.
- Reply controls repeat. The root action row has a Reply action, and the modal can also show a separate Reply button directly below it.
- Reply nesting is present technically, but the UI does not make branch ownership obvious enough.
- Thread state is not addressable. Users cannot share, refresh, open in a new tab, or navigate directly to a thread.
- Modal navigation is shallow. Back button behavior, scroll restoration, and deep-link return paths are not available.
- Mobile nesting can become cramped quickly because each depth adds margin inside an already narrow modal.
- Empty/loading states are visually heavier than necessary because they use the same card grammar as content.
- Accessibility is partially covered by `role="dialog"`, `aria-modal`, `aria-labelledby`, and labeled close/actions, but focus trapping, focus return, and a route fallback are not yet designed.

## Competitor Analysis

Sources used:

- X Help, [About conversations on X](https://help.x.com/en/using-x/x-conversations)
- Reddit Help, [How do I post and comment on Reddit?](https://support.reddithelp.com/hc/en-us/articles/360060422572-How-do-I-post-and-comment-on-Reddit)
- Bluesky Docs, [Viewing threads](https://docs.bsky.app/docs/tutorials/viewing-threads)
- Bluesky Blog, [New Anti-Toxicity Features on Bluesky](https://bsky.social/about/blog/08-28-2024-anti-toxicity-features)
- Bluesky Blog, [Toward Federation and an Open Network](https://bsky.social/about/blog/11-15-2023-toward-federation)
- Meta, [Introducing Threads](https://about.fb.com/news/2023/07/introducing-threads-new-app-text-sharing/)
- Meta, [New Threads features for a more personalized experience](https://about.fb.com/news/2025/03/new-threads-features-more-personalized-experience-you-control/)
- Instagram Help result, [About replies on Threads](https://www.facebook.com/help/instagram/771310471063900?locale=en_GB)

### X / Twitter

What to learn:

- X treats conversations as a primary post-detail surface, not merely as feed expansion.
- A reply starts from a clear reply icon/action, and the composer clearly communicates who the user is replying to.
- X distinguishes direct reply count from the total conversation. That distinction matters if thia.lol later supports deep thread totals.
- X groups sub-conversations and ranks replies, but thia.lol should avoid opaque engagement-maximizing ranking at this stage.

Implication for thia.lol:

- Use X as the reference for a clean post-detail page, strong root post anchor, clear action row, and simple reply composer.
- Do not copy X's ranking complexity yet.
- Keep action isolation clear: identity links, room links, body/thread target, and action buttons should remain separate.

### Reddit

What to learn:

- Reddit is the strongest reference for branch readability.
- Comments are replies to either the post or another comment.
- On mobile, Reddit places the response box at the bottom of the screen when replying.
- Nested discussion needs visible structural cues and collapse affordances once it grows.

Implication for thia.lol:

- Use Reddit as the reference for nested reply topology: indentation, branch lines, collapse/expand controls, and compact repeated reply units.
- Avoid bringing Reddit's density wholesale into thia.lol; the product should remain calmer and more polished.
- If deep nesting remains, mobile needs a distinct nesting strategy rather than simply increasing left margin.

### Bluesky

What to learn:

- Bluesky's thread model explicitly includes a post, ancestors, and descendants.
- The API shape separates ancestor height and descendant depth, which is a useful mental model for thia.lol's eventual data model.
- Bluesky has invested in thread preferences, reply visibility controls, and hiding replies as product-level conversation health tools.
- Bluesky's feed changes avoid separating replies from their top-level post when context is needed.

Implication for thia.lol:

- A future thread route should be designed around `root`, `ancestors`, `selected post`, and `descendants`, even if Phase 1 only renders root plus current replies.
- Do not add a migration in the first UI redesign, but keep the component architecture compatible with a future `root_id` or `thread_id`.
- Consider reply visibility, hidden replies, and thread gates as later safety tracks, not part of the first layout pass.

### Threads

What to learn:

- Threads is mobile-first, minimal, and action-light.
- Replies appear as their own profile-visible activity while still belonging to the thread context.
- Threads emphasizes user control over who can reply and quote, plus newer reply approvals and filtering.
- Threads' visual system keeps posts and replies close to feed units, with little decorative framing.

Implication for thia.lol:

- Use Threads as a reference for quiet mobile rhythm and low-friction reply reading.
- Keep thia.lol's thread UI lighter than the current card stack.
- Reply controls should be available but not visually loud.

## Recommended Direction

Build Thread v2 as a conversation surface, not as a stack of post cards inside a modal.

Recommended direction for Phase 1:

- Start by redesigning the modal into a wider, connected thread surface.
- Extract thread rendering out of `PostCard.tsx` into dedicated thread components.
- Render the root post and replies on a shared conversation rail.
- Use one primary reply entry point for the root context.
- Keep reply-level Reply actions for nested replies, but avoid duplicate root reply calls to action.
- Make the post card body/card click behavior more intuitive after designing action isolation.
- Keep the existing API in Phase 1.
- Do not add migrations until the route/permalink and thread root model are decided.

Recommended direction after Phase 1:

- Add a full-page thread route if the modal redesign still feels like the wrong long-form surface.
- Decide whether deep threads require a permanent `root_id` or `thread_id`.
- Add Playwright coverage for desktop/mobile thread layout, action isolation, composer placement, and nested replies against mocked API data.
- Run API-backed deployed smoke for reply create/delete/reblog/report/media behavior before claiming thread behavior is launch-ready.

## Modal vs Full Page Evaluation

### Wider modal first

Benefits:

- Lowest implementation risk.
- Preserves current user flow.
- No database or API changes required.
- Can be done as a focused frontend layout/component task.
- Good for quick feed-to-thread inspection.

Costs:

- Still not shareable or directly addressable.
- Browser back/forward behavior remains weak.
- Long conversations remain trapped inside an overlay.
- Mobile remains a pseudo-page with modal semantics.

Recommendation:

- Use a wider modal as the first implementation step because it is the smallest safe change.
- Treat this as a bridge, not the final architecture.

### Full-page route

Benefits:

- Better for long reading, sharing, refresh, and direct links.
- Gives mobile a natural page instead of a constrained overlay.
- Enables route-level loading, skeletons, error states, and scroll restoration.
- Creates a cleaner foundation for ancestors, selected reply permalinks, and moderation links.

Costs:

- Needs route design and navigation decisions.
- May need a direct post fetch endpoint if current feed payloads are not enough.
- A deep route eventually pressures the backend to support a true thread root model.
- Requires more test coverage.

Recommendation:

- Plan a full-page route as the target architecture.
- Do not start with the route until the wider modal and component extraction prove the desired hierarchy.
- Preferred route shape to evaluate: `/posts/:id`, with room/profile contextual links preserved inside the thread.

## Reply Tree Evaluation

Current tree behavior is functional but visually shallow:

- Replies can nest through recursive `ReplyPreview`.
- Depth is capped at three rendered levels.
- Child replies are lazy-loaded.
- Ancestor visibility filtering matches the rendered depth.
- UI indentation is based on margin and border rather than a deliberate branch system.

Keep:

- Lazy loading nested replies.
- Depth limits for Public Readiness v2.
- Reply-level actions.
- Existing ancestor visibility safety checks.

Change:

- Replace nested cards with connected reply rows.
- Add a conversation rail beside avatars.
- Use indentation only where it improves branch clarity.
- Add collapse/expand state design before making deep trees prominent.
- Use smaller action rows for replies than for the root post.

Avoid in Phase 1:

- Infinite nesting.
- Recursive SQL changes.
- A `root_id` / `thread_id` migration.
- Ranking or sorting controls.

## Proposed Information Hierarchy

1. Thread header
   - Back/close control.
   - Title or context label.
   - Optional overflow menu later.

2. Root post
   - Avatar rail.
   - Display name, handle, timestamp.
   - Room context as secondary metadata.
   - Body and media.
   - Primary action row: Reply, Like, Reblog, Report/menu, Delete where allowed.

3. Root reply composer
   - Appears inline under the root post when opened.
   - Uses one clear root reply entry point.
   - For logged-out users, show one concise sign-in prompt in the composer position.

4. Reply list
   - Connected rows sharing the same rail.
   - Reply identity first, then body/media, then compact actions.
   - Nested replies visibly belong to their parent.
   - Lazy child loading stays explicit.

5. Empty/loading/error states
   - Centered within the reply-list area.
   - Lighter than content cards.
   - Specific copy: `No replies yet`, `Loading replies...`, `Replies could not load right now.`

## Proposed Component Structure

Documentation-only proposal:

- `ThreadModal`
  - Owns modal shell, escape/backdrop close, body scroll lock, and modal sizing.
  - Delegates all conversation rendering.

- `ThreadSurface`
  - Owns thread data loading state, root count state, and reply list state.
  - Can later be reused by a full-page `ThreadPage`.

- `ThreadHeader`
  - Renders title/context and close/back action.

- `ThreadRootPost`
  - Renders root post with full hierarchy and primary action row.

- `ThreadReplyComposer`
  - Wraps the existing reply composer behavior with thread-specific placement.

- `ThreadReplyList`
  - Renders loading, error, empty, and reply rows.

- `ThreadReplyItem`
  - Renders a connected reply row with nested children.
  - Owns local child loading and collapse state.

- `PostCard`
  - Returns to being a feed card.
  - Opens a thread through a prop/callback or routing action.
  - Does not contain the full thread implementation long term.

## Mobile Considerations

- Treat the modal as a near-full-screen sheet if Phase 1 remains modal-based.
- Use almost full viewport width with small safe margins.
- Keep the header compact and sticky.
- Avoid large nested left margins; use a rail, subtle inset, or collapsible branch treatment.
- Put the active reply composer close to the target being replied to.
- Ensure the mobile dock does not cover modal controls or the footer on normal pages.
- Verify 320px, 390px, and 430px widths.
- Check that long handles, long room names, and action labels wrap or collapse gracefully.

## Desktop Considerations

- Increase modal width from `max-w-2xl` to a more conversation-appropriate width during Phase 1.
- Consider a two-column desktop thread page later: conversation column plus lightweight context/sidebar.
- Keep the reading column constrained enough for comfortable line length.
- Avoid floating cards inside cards.
- Preserve clear hover/focus states for card/body click targets and action buttons.
- Use available whitespace for hierarchy, not for extra pills.

## Accessibility Considerations

Current strengths:

- The modal uses `role="dialog"`, `aria-modal`, and `aria-labelledby`.
- The close button has an accessible label.
- Main action buttons have labels and pressed/disabled states where relevant.
- Identity and room elements are links, not disguised buttons.

Gaps to address in implementation:

- Add focus trapping inside the modal.
- Return focus to the opener when the modal closes.
- Move initial focus intentionally to the close button, thread heading, or composer when opened through Reply.
- Avoid wrapping large interactive regions around nested controls.
- Ensure the root thread click target and action buttons are distinct for pointer and keyboard users.
- Consider route-based threads for better native browser navigation and assistive technology history.
- Ensure branch lines or nesting cues are not color-only.
- Respect `prefers-reduced-motion` for thread open/close and reply insertion animations.

## Risks

- A frontend-only redesign can improve hierarchy but will not solve shareable threads.
- A full-page route can expose backend/API gaps around direct post loading, root discovery, and removed ancestors.
- Deep nesting without a root model can outgrow the current ancestor visibility limit.
- Wider modals can still feel cramped on mobile if nesting remains margin-based.
- Duplicated component logic can grow if `PostCard`, modal, and future page routes each render post/reply UI separately.
- API-backed reply behavior cannot be honestly marked verified without a working deployed or local PHP API path.
- Over-copying competitor patterns could weaken thia.lol's calmer Sunveil/Frostveil identity.

## Public Readiness v2 Thread Roadmap

Break implementation into small Codex-sized tasks:

1. Thread component extraction plan
   - Move no code yet unless separately approved.
   - Produce an implementation map from current `PostCard.tsx` sections to proposed thread components.
   - Acceptance: no frontend behavior change; document exact component boundaries.

2. Wider modal layout pass
   - Increase modal width and improve header/empty/loading alignment.
   - Keep current API and behavior.
   - Acceptance: desktop and mobile screenshots show unclipped modal and centered states.

3. Connected root and reply layout
   - Replace isolated root/reply cards inside the modal with one connected conversation rail.
   - Acceptance: root and replies read as one thread; no cards nested inside cards.

4. Reply entry point cleanup
   - Remove duplicate root reply CTA.
   - Keep one root Reply action and inline composer placement.
   - Acceptance: authenticated, unauthenticated, and loading auth states are clear.

5. Reply tree visual pass
   - Improve nested reply branch lines, indentation, and lazy child controls.
   - Keep the current rendered depth cap.
   - Acceptance: parent/child ownership is obvious on desktop and mobile.

6. Post card click behavior pass
   - Decide and implement card/body thread click target with explicit action isolation.
   - Acceptance: author, room, like, reblog, reply, report, delete, and hide do not accidentally open the thread.

7. Thread accessibility pass
   - Add focus trap, focus return, initial focus rules, and keyboard verification.
   - Acceptance: Playwright or manual keyboard QA verifies open, navigate, compose, close, and focus return.

8. Thread route decision memo
   - Evaluate `/posts/:id` route and direct post fetch needs after modal redesign.
   - Acceptance: decision recorded before any route/backend work.

9. Full-page thread route foundation, if approved
   - Add route and reusable `ThreadSurface`.
   - Avoid migration unless separately approved.
   - Acceptance: direct URL loads root plus replies and supports browser back/refresh.

10. Thread root data model decision, if needed
    - Decide `root_id`, `thread_id`, recursive query, or depth-limited continuation.
    - Acceptance: database decision documented before any migration is created.

11. API-backed thread smoke verification
    - Run against a working PHP API path.
    - Acceptance: reply create, media reply, reply delete, reply reblog, report, nested load, and permissions are actually exercised.

12. Public Readiness launch polish
    - Final screenshot pass across Home, Discover, Room, Profile Replies, modal/page thread, mobile, and desktop.
    - Acceptance: thread behavior is consistent across all entry points.

## Open Decisions

- Should Phase 1 change only modal layout, or should it include component extraction?
- Should the long-term permalink be `/posts/:id` or scoped under profile/room context?
- Should a reply route open with the selected reply centered, or always show the root first?
- Should reply count remain direct replies only, or eventually become total descendants?
- How much nested depth should thia.lol expose during public testing?
- Should thread reply sorting remain chronological for v2?
- Should collapse controls be part of v2 or deferred until deeper threads exist?

## No Issues Created

No new GitHub Issues were created during this audit. The gaps found fit the existing Public Readiness v2 thread track and the already recommended thread redesign issue.
