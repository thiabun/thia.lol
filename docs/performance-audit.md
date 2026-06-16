# Performance Audit

> **Status: Active audit for issue [#6](https://github.com/thiabun/thia.lol/issues/6).**
> This document records measured bundle state, cleanup applied, and remaining
> performance risks. It does not authorize architecture, router, API, SSR, or
> framework changes.

Date: 2026-06-15

## Scope

Issue #6 asked for a measured frontend performance and bundle cleanup pass:

- inspect production build output, chunk sizes, lazy-loaded routes, shared
  chunks, vendor chunks, and asset sizes;
- reduce obvious eager loading without changing product behavior;
- remove high-confidence dead code;
- document remaining risks instead of micro-optimizing blindly.

The audit used `npm run build` output from Vite 8.0.16. The build did not emit a
large chunk warning before or after this pass.

## Baseline Build

Measured before changes with `npm run build`.

| Chunk or asset | Raw | Gzip | Finding |
| --- | ---: | ---: | --- |
| `index-*.js` | 417.97 kB | 133.48 kB | App entry included route shell, shared app code, and framework/vendor code. |
| `ProfilePage-*.js` | 94.09 kB | 25.74 kB | Profile visitor route carried the owner-only customization editor. |
| `index-*.css` | 72.01 kB | 11.71 kB | Largest non-JS asset; expected from Tailwind app styles. |
| `AdminPage-*.js` | 23.33 kB | 6.03 kB | Already route-level lazy loaded. |
| `LegalPage-*.js` | 23.33 kB | 7.95 kB | All legal routes share one lazy route chunk. |
| `PostCard-*.js` | 22.59 kB | 6.58 kB | Shared social card includes thread modal/reply/report behavior. |
| `ChatPage-*.js` | 18.10 kB | 5.51 kB | Already route-level lazy loaded. |
| `RoomPage-*.js` | 10.86 kB | 3.78 kB | Room editor shared chunk was loaded with room routes. |
| `RoomEditModal-*.js` | 9.97 kB | 3.46 kB | Shared by room list/detail but eagerly required by those route chunks. |

## Changes Applied

### Route And Modal Loading

- The retired profile customization modal has been removed from `ProfilePage`.
  P3 customization should introduce a new owner editor with its own bundle
  boundary instead of reviving the old chunk.
- `RoomEditModal` is now lazy-loaded from `RoomsPage` and `RoomPage` only after
  create/edit actions.
- `PostComposerModal` is now lazy-loaded from `AppShell` after the first Post
  action. It stays mounted after first activation so the shared `ModalSheet`
  close behavior can still animate after `open` changes.
- `AppShell` no longer calls `getRooms()` at startup just to feed the composer.
  Room options load when the authenticated composer opens.

### Vendor Organization

`vite.config.ts` now splits stable vendor code into named chunks:

- `react-vendor`
- `router-vendor`
- `motion-vendor`
- `profile-icons`

Lucide icon modules were left to Vite/Rolldown tree-shaking. Grouping all
Lucide usage into one manual chunk could make route-only icons load with the
initial shell because the shell itself uses Lucide icons.

### Dead Code Cleanup

Removed unused legacy API client exports:

- `getFeed()`
- `addReaction()`
- `removeReaction()`
- associated `ReactionType`, `ReactionResult`, and `ReportReason` aliases

No source or smoke test references remained. Current product code uses
`getHomeFeed()`, `getDiscoverFeed()`, `likePost()`, `unlikePost()`,
`reblogPost()`, and `unreblogPost()`.

## Current Build

Measured after changes with `npm run build`.

| Chunk or asset | Raw | Gzip | Finding |
| --- | ---: | ---: | --- |
| `react-vendor-*.js` | 181.79 kB | 57.20 kB | Largest remaining chunk; framework code, expected and cacheable. |
| `motion-vendor-*.js` | 129.06 kB | 42.07 kB | Motion is used broadly by shell, routes, buttons, cards, and sheets. |
| `index-*.css` | 76.32 kB | 12.06 kB | Stable stylesheet size; no committed raster assets were found. |
| `index-*.js` | 58.65 kB | 18.84 kB | App entry remains separated from profile route code. |
| `router-vendor-*.js` | 42.25 kB | 15.08 kB | Router code is separated and cacheable. |
| `ProfilePage-*.js` | 50.75 kB | 13.61 kB | Profile route no longer carries owner-only customization editor. |
| `AdminPage-*.js` | 23.46 kB | 6.09 kB | Admin remains isolated to `/admin`. |
| `LegalPage-*.js` | 23.42 kB | 7.99 kB | Legal remains isolated to legal routes. |
| `PostCard-*.js` | 22.86 kB | 6.65 kB | Still the largest shared social component chunk. |
| `ChatPage-*.js` | 18.29 kB | 5.58 kB | Chat remains isolated to `/chat`. |

The largest route-specific improvement was `ProfilePage`: 94.09 kB raw /
25.74 kB gzip before, 36.17 kB raw / 10.28 kB gzip after.

## Asset Review

- `find public src` found no committed raster/vector image assets under the
  active frontend asset paths.
- `npm run optimize:assets` reported: `No generated raster assets are required
  for the current build.`
- The emitted `dist/` payload is JS, CSS, `index.html`, and `.htaccess`.
- `react-icons` is only used for profile connection brand icons and is isolated
  in `profile-icons`.
- `ambient-veil.webp` is retired and not present as a committed asset. The
  frontend still ignores a `/ambient-veil.webp` media URL in `PostCard` as a
  compatibility guard for stale data.

## Remaining Risks

- Motion is a large shared dependency. Reducing it would require a product/UI
  decision about how much animation should remain global; this pass only split
  it into a cacheable vendor chunk.
- `PostCard` still includes thread modal, reply composer, report, media upload,
  like, reblog, hide, and delete behavior in one shared social chunk. A future
  safe optimization is to split thread modal/reply internals behind the thread
  open action.
- `ModalSheet` is used by chat, reports, profile panels, composer, room editor,
  and profile header controls. Its chunk impact is modest, but modal users are
  widespread.
- Legal pages share one lazy chunk. This is acceptable because legal routes are
  not initial product routes, but individual legal route splitting could be done
  later if those pages grow.
- Admin is route-isolated, but the admin page itself remains dense. Future admin
  work should split report, room, badge, and moderation workspaces only after a
  measured need appears.
- Route-state primitives remain overlapping (`ApiStateNotice`, `EmptyState`,
  `RouteStateNotice`, `CompactStateNotice`, `ModalSheetStatus`). Consolidation
  may improve maintainability but was not required for this measured pass.

## Future Recommendations

1. Measure a future `PostCard` split that lazy-loads thread modal/reply internals
   on first thread open.
2. Revisit broad `motion/react` usage only with visual regression screenshots,
   because removing motion can change product feel.
3. Keep admin/profile editors behind explicit user actions as those surfaces
   grow.
4. Add bundle visualization tooling only if chunk attribution becomes hard to
   reason about from Vite output; do not add build dependencies just for this
   small pass.
5. Continue running API-backed smoke tests against a real PHP/MySQL API path
   whenever auth, posts, replies, rooms, profiles, media, or chat behavior
   changes.
