# Public Readiness v2 Plan

> **Status: Active.** This is the v2 orientation map and issue index. GitHub
> Issues are the active tracker for v2 work; keep this document focused on
> context, classification, and links instead of growing it into another task
> queue. Use issue [#16](https://github.com/thiabun/thia.lol/issues/16) for
> project-board and label workflow setup.

Date: 2026-06-11

Source brief: `Public readiness v2.md`, supplied for this planning pass.

## Public Readiness v2 Goal

Public Readiness v1 built the working platform foundation: accounts, profiles, posts, replies, reblogs, rooms, follows, moots, chat, reports, moderation, uploads, badges, legal pages, deploy automation, launch checklist, and Codex/GitHub workflow basics.

Public Readiness v2 should make `thia.lol` feel cohesive, polished, desirable, and launch-ready. The goal is not to rewrite the app or rush monetization. The goal is to turn the current collection of working feature foundations into one recognizable product with stronger interaction patterns, clearer design rules, cleaner docs, and GitHub Issues as the source of truth for active work.

## Current State After v1

Complete or substantially complete:

- Static-first Vite/React frontend with PHP/MySQL API deployment shape for cPanel.
- Public posts, replies, nested thread foundation, media uploads, likes, reblogs, reports, delete/hide controls, and ancestor visibility filtering for the currently rendered thread depth.
- Profiles with editable identity, structured Connections, avatar/banner customization, follows/following/moots, badges, profile tabs, and profile navigation cleanup.
- Rooms 2 foundation with creation, editing, customization, join/leave, owner/moderator roles, moderator controls, and soft-delete support.
- Moots-only chat foundation with conversation list, messages, read state, message notifications, and a Chat page moot picker.
- Reports and moderation foundation for posts, profiles, rooms, and chat messages.
- Legal/trust pages, cookie notice, footer legal links, and deploy automation.
- Launch checklist and public-testing documentation.

Still fragile or unfinished:

- Thread UI works, but the brief correctly identifies it as visually cramped and too card-fragmented for a modern conversation product.
- Some v1 docs are stale or historical and compete with GitHub Issues as work trackers.
- Project labels and board structure are still mostly recommendations instead of an enforced source of truth.
- Mobile bottom navigation, footer spacing, and top-bar copy need a product-shell polish pass.
- Search v1 exists as `/search` plus `GET /api/search?q=...` for public profiles and public, non-deleted rooms; posts, private chat messages, admin search, autocomplete, and richer ranking remain future work.
- Profiles need a longer-term personal-space direction before adding rich integrations.
- Block, mute, and remove-follower are scoped; API/data foundation exists, while full frontend controls and settings surfaces remain follow-up work.
- Analytics, revenue, ads, and API/SQL product maturity need planning before any tracker, ad, or monetization code is added.
- Production-authenticated verification remains environment-bound for mutations that require a working deployed API and test accounts.

## Product Problems Identified

- Disconnected UI: screens often work individually, but repeated cards, panels, and pills can make the product feel assembled from feature blocks instead of one coherent place.
- Thread modal weakness: the current modal is too narrow and visually shallow for an important conversation surface.
- Isolated post/reply cards: thread replies should feel connected to the parent conversation, not like unrelated cards stacked in a modal.
- Redundant controls: replies and thread controls should appear once per context, with one clear entry point for replying.
- Footer and bottom-bar layout issues: the mobile dock should not fight the footer, and the footer should be compact enough to feel like site chrome rather than a second page.
- Top bar cleanup: remove the "social app" sublabel under `thia.lol`; the product name is strong enough by itself.
- Search direction is still shallow: v1 covers public profiles and rooms, but posts, ranking, autocomplete, privacy constraints, and nav placement need GitHub Issues before expansion.
- Stale and fragmented docs: historical audits, roadmaps, and checklists are useful, but active progress should move into GitHub Issues and a Project board.
- Need for stronger product/design guidelines: future Codex tasks need shared rules for layout density, cards, motion, copy, empty states, and social surfaces.
- Need for richer profiles and personal spaces: profile pages should support identity, blogging-like use, creator presence, and future media integrations without making Thia the whole platform identity.
- Revenue and analytics planning: the project should plan durable revenue, privacy-preserving analytics, and optional ads/sponsorships, but should not add trackers, ad code, or monetization claims yet.

## Public Readiness v2 Epics

### 1. Thread Experience Redesign

- Goal: make threads feel connected, spacious, and intuitive.
- Scope: wider modal or full-page route exploration; connected visual reply layout; improved title and empty-state alignment; one clear reply entry point; better click behavior for post cards; action isolation for author, room, like, reblog, reply, report, and delete.
- Out of scope: database migrations unless a deeper thread route requires a separately approved `root_id` or `thread_id` decision; quote-posts; realtime comments.
- Recommended first issue: redesign thread modal layout and interaction model using X/Twitter and Reddit as references.
- Codex suitability: High for frontend layout and tests; medium if API/thread permalink changes are included.
- Risk level: Medium because thread behavior is core and API-backed reply actions need real verification.

### 2. Product UI/UX Guidelines

- Goal: give future implementation work a clear product standard.
- Scope: document rules for cards, connected social surfaces, density, empty states, nav, footer, copy, profile identity, motion, and Sunveil/Frostveil usage.
- Out of scope: full design system rewrite; replacing Tailwind; brand overhaul.
- Recommended first issue: write a product UI guideline and component inventory tied to existing app surfaces.
- Codex suitability: High for audit and docs; medium for visual QA because screenshots require careful review.
- Risk level: Low.

### 3. Repository and Docs Cleanup

- Goal: reduce planning sprawl and make old docs clearly historical, current, or actionable.
- Scope: classify docs, add archive/deprecated banners where appropriate, merge duplicate planning, and move active work into GitHub Issues.
- Out of scope: deleting useful history blindly; rewriting every doc; deleting source briefs without Thia approval.
- Recommended first issue: archive or update stale v1 public-testing docs after the v2 plan is approved.
- Codex suitability: High.
- Risk level: Low to medium because stale docs can still contain useful deployment and safety context.

### 4. GitHub Issues and Project Workflow

- Goal: make GitHub Issues and the Project board the active work-tracking system.
- Scope: create v2 issues, configure labels, define statuses, link docs from issues, and stop using long docs as active task queues.
- Out of scope: replacing GitHub with another tracker; relying on memory or chat history for active scope.
- Recommended first issue: configure Public Readiness v2 labels and Project board fields/statuses.
- Codex suitability: Medium. Codex can create issues and suggest labels; Thia may need to own Project board decisions.
- Risk level: Low.

### 5. Search Foundation

- Goal: grow the initial Search foundation carefully before navigation and data models get more crowded.
- Scope: define follow-up searchable entities, empty states, privacy/safety constraints, ranking limits, and API-backed implementation paths.
- Out of scope: full-text search engine; external search services; indexing private chats; analytics-driven ranking.
- Current state: Search v1 for public profiles and public, non-deleted rooms is implemented under issue [#17](https://github.com/thiabun/thia.lol/issues/17).
- Recommended follow-up issue: decide whether posts, handles, tags, or room content should be added next, and document the visibility constraints before implementation.
- Codex suitability: Medium. Planning is high suitability; implementation may need SQL/API decisions.
- Risk level: Medium.

### 6. Profile / Personal Space Evolution

- Goal: make profiles feel like member-owned spaces that can support identity, blogging-like use, and future creator integrations.
- Scope: richer profile sections, pinned posts, custom blocks, personal links, future Twitch stream/chat embeds, Spotify/Apple Music playlist/song embeds, and guardrails for readability/safety.
- Out of scope: adding Twitch, Spotify, Apple Music, or ad integrations in this task; making Thia the primary platform identity.
- Recommended first issue: define the profile personal-space model before building integrations.
- Codex suitability: Medium. Product modeling needs Thia's judgment; scoped implementation tasks can be high suitability later.
- Risk level: Medium to high because customization can harm readability, safety, and performance if unconstrained.

### 7. Layout and Navigation Polish

- Goal: make the product shell quieter, neater, and less crowded.
- Scope: remove the top-bar "social app" label; make mobile bottom nav stop before the footer or reserve footer space cleanly; compact footer spacing; inspect nav space for future Search.
- Out of scope: replacing navigation architecture; adding a Search feature before the Search spec; changing auth/session behavior.
- Recommended first issue: extend the existing mobile spacing issue with bottom dock/footer/top-bar acceptance criteria.
- Codex suitability: High.
- Risk level: Low.

### 8. Analytics and Revenue Planning

- Goal: decide what can be measured or monetized without compromising trust or overclaiming.
- Scope: privacy-preserving analytics options, cookie/consent implications, server-side event aggregates, sponsorship/ad principles, revenue experiments, and API/SQL reporting needs.
- Out of scope: adding trackers, ad scripts, paid features, affiliate links, or marketing cookies in v2 foundation work.
- Recommended first issue: write an analytics/revenue decision memo with legal/privacy constraints and no-code recommendations.
- Codex suitability: Medium. Codex can draft options and implementation impact; Thia should make the revenue/product calls.
- Risk level: High if implemented too early; low for planning only.

### 9. API/SQL Product Maturity

- Goal: stop treating the database as something to avoid while still protecting production safety.
- Scope: identify which product improvements need SQL/API support, schema-readiness checks, migration discipline, health checks, admin diagnostics, and API-backed smoke requirements.
- Out of scope: production migrations in planning work; auth/session changes; broad schema rewrites.
- Recommended first issue: audit v2 API/SQL needs for threads, search, block/mute, profiles, analytics, and moderation.
- Codex suitability: Medium.
- Risk level: Medium to high because database work must be small, reversible where possible, and verified against a working API path.

## Thread Redesign Direction

Thread v2 should use X/Twitter and Reddit as references without copying either product wholesale.

Guidance:

- Explore a wider modal first, and evaluate a full-page thread route as a follow-up if permalinks, deep replies, or mobile behavior justify it.
- Present the root post and replies as one connected conversation, not separate cards floating in the same panel.
- Use visual connection cues: vertical thread lines, grouped reply indentation, reduced card borders, and inward nesting where useful.
- Keep layout compact without feeling cramped. The modal should use available horizontal space on desktop.
- Reduce redundant reply controls. A thread should have one obvious primary reply entry point per context.
- Center or better align the "Thread" title, loading states, and empty states within the modal.
- Make clicking the post card/body open the thread intuitively while preserving action isolation:
  - author/avatar/handle opens profile
  - room pill opens room
  - like toggles like
  - reblog toggles reblog
  - reply opens composer/thread
  - report opens report flow
  - delete/menu performs the explicit action
- Keep API-backed reply create/delete/reblog/report/media behavior honest: test against a working API path or mark smoke blocked.
- Do not add a deep thread database migration until the product decision about `posts.root_id` or `posts.thread_id` is made.

## Design/Product Guidelines Draft

- Conversations should visually connect. Parent posts and replies should look like one thread.
- Identity should be obvious. A member's avatar, display name, handle, and badges should be easy to scan without crowding the post body.
- Actions should appear once per context. Duplicate reply/report/delete controls make the product feel noisy and uncertain.
- Cards should not over-fragment the product. Use cards for repeated items, modals, and framed tools, not for every subsection of a page.
- Empty states should be calm, centered, and specific.
- Feature copy should be plain. Avoid decorative filler and implementation language on public surfaces.
- Mobile bottom nav and footer should not fight each other. The footer must remain reachable and feel like the lowest page element.
- Profile pages should support personal identity and future creator/blog use while preserving platform coherence.
- Sunveil and Frostveil should guide mood, contrast, and motion, but not become one-note palettes.
- Motion should help state changes feel alive, not distract from reading or replying.
- Public surfaces should never overclaim privacy, moderation, analytics, or legal guarantees.

## Docs Cleanup Plan

Do not delete docs in this pass unless a file is clearly obsolete and duplicated elsewhere. Prefer banners, merges, or issue migration first.

### Active Product And Planning Docs

- `AGENTS.md`: repo operating rules and deployment constraints.
- `README.md`: public repo overview, local commands, testing, and deployment notes.
- `docs/public-readiness-v2-plan.md`: active v2 orientation and issue map.
- `docs/product-audit-and-roadmap.md`: active product/architecture reference, with older roadmap sections superseded by GitHub Issues.
- `docs/platform-ui-modernization.md`: active UI modernization direction.
- `docs/block-mute-remove-follower-scope.md`: active product/API scope for safety controls until implemented.
- `docs/profile-badges-plan.md`: active profile/badge foundation reference.

### Operational References

- `docs/public-testing-launch-checklist.md`: deploy, migration, smoke, manual testing, and go/no-go checklist.
- `docs/deployment-automation.md`: cPanel/GitHub Actions deployment workflow reference.
- `docs/thia-migration-runner-guide.md` and `docs/migration-runner.md`: migration runner references; reconcile later if they drift.
- `docs/media-uploads.md`: image upload behavior and cPanel storage reference.
- `docs/admin-setup.md` and `docs/auth-session-diagnostics.md`: admin/session operational references.

### Historical / Superseded Docs

- `docs/public-testing-readiness-spec.md`: historical v1 implementation spec. Preserve hard safety/API-smoke rules, but do not use it as the active v2 source of truth.
- `docs/public-testing-readiness-audit.md`: historical v1 pass report and addendum log. Keep for audit trail; current work belongs in GitHub Issues.
- `docs/public-testing-roadmap.md`: historical v1 public-testing roadmap. Its priority list is superseded by GitHub Issues and the v2 plan.
- `docs/public-testing-project-triage.md`: historical v1 transition triage. Useful for provenance, but not the active tracker.

### Update

- Add status notes to active, operational, and historical docs.
- Update stale feature inventory entries that still describe implemented foundations as deferred.
- Point active v2 work to GitHub Issues and project board workflow issue [#16](https://github.com/thiabun/thia.lol/issues/16).
- Keep deployment, migration, safety, legal, upload, and API-smoke warnings intact.

### Merge

- Treat the label/board guidance in this document as the canonical v2 recommendation until issue [#16](https://github.com/thiabun/thia.lol/issues/16) is completed.
- Historical label lists in `docs/public-testing-project-triage.md` and `docs/public-testing-roadmap.md` should point here instead of being maintained separately.
- Merge duplicate migration-runner guidance if `docs/thia-migration-runner-guide.md` and `docs/migration-runner.md` drift.

### Proposed Archive Candidates

- `docs/public-testing-readiness-spec.md`: archive candidate because v1 implementation scope is complete or superseded. Keep until hard rules are copied into active operational docs where needed.
- `docs/public-testing-readiness-audit.md`: archive candidate because it is a completed pass report. Keep until any still-useful deferred items are represented as GitHub Issues.
- `docs/public-testing-roadmap.md`: archive candidate because active priorities now live in GitHub Issues and this v2 plan.
- `docs/public-testing-project-triage.md`: archive candidate because its recommendations have either been implemented, moved to the launch checklist, or carried forward into GitHub Issues.
- User-supplied `Public readiness v2.md` source brief and attachments: preserve only if Thia wants uploaded planning briefs tracked in the repository; otherwise keep this plan as the committed source of truth and do not commit source-brief attachments by accident.

### Delete Only If Clearly Obsolete

- No docs should be deleted in this task.
- Delete candidates should first be listed in a GitHub issue with the replacement doc/link and reason.

## GitHub Issues Plan

Existing issues to carry forward instead of duplicating:

| Issue | Priority | Area labels | How it fits v2 |
| --- | --- | --- | --- |
| [#6](https://github.com/thiabun/thia.lol/issues/6) `[P2] Performance and bundle cleanup pass` | P2 | `area: performance`, `area: frontend` | Keep as a measured performance track after visual/product polish. |
| [#8](https://github.com/thiabun/thia.lol/issues/8) `[Task]: Add missing empty states across public pages` | P2 | `area: ux`, `area: copy` | Use for calm, centered empty states outside the thread-specific redesign. |
| [#10](https://github.com/thiabun/thia.lol/issues/10) `[Task]: Polish mobile spacing on key public pages` | P1 | `area: layout`, `area: mobile` | Extended with bottom dock/footer spacing, top-bar label removal, and Search placement consideration. |
| [#11](https://github.com/thiabun/thia.lol/issues/11) profile save internal server error | P1 | `area: profiles`, `area: api`, `type: bug` | Keep as API-backed production verification/fix work. |
| [#12](https://github.com/thiabun/thia.lol/issues/12) block, mute, and remove-follower controls | P1 | `area: safety`, `area: api`, `area: profiles` | Carry forward as the main user-control/safety implementation scope. |

Recommended new v2 issues:

### [#13 Public Readiness v2 thread experience redesign](https://github.com/thiabun/thia.lol/issues/13)

- Priority: P1
- Area labels: `area: threads`, `area: ux`, `area: frontend`, `codex-ready`
- Summary: Redesign the thread modal/experience so posts and replies feel connected, spacious, and intuitive.
- Acceptance criteria:
  - [ ] Desktop thread modal uses available width more effectively or a full-page route proposal is documented.
  - [ ] Root post and replies read as one connected thread, not isolated cards.
  - [ ] Reply entry points are reduced to one clear action per context.
  - [ ] "Thread" title, loading state, and empty states are aligned intentionally.
  - [ ] Clicking the post body/card opens the thread while explicit controls keep isolated behavior.
  - [ ] Screenshots or Playwright coverage verify desktop and mobile states.

### [#14 Product UI/UX guidelines and component inventory](https://github.com/thiabun/thia.lol/issues/14)

- Priority: P1
- Area labels: `area: design`, `area: docs`, `area: frontend`
- Summary: Document product rules for connected conversations, cards, density, motion, copy, empty states, profiles, nav, and legal/trust surfaces.
- Acceptance criteria:
  - [ ] Guidelines cover conversations, identity, actions, cards, empty states, copy, mobile nav/footer, profiles, and motion.
  - [ ] Existing components/surfaces are inventoried with keep/change notes.
  - [ ] Future Codex tasks can link to the guidelines as required context.

### [#15 Repository docs cleanup and archive pass](https://github.com/thiabun/thia.lol/issues/15)

- Priority: P1
- Area labels: `area: docs`, `public-readiness-v2`, `codex-ready`
- Summary: Mark stale v1 docs as historical, update docs that remain active, and avoid deleting useful context blindly.
- Acceptance criteria:
  - [ ] Active docs, historical docs, and operational docs are clearly labeled.
  - [ ] Stale v1 roadmap/checklist claims are corrected or marked superseded.
  - [ ] No useful deployment, migration, safety, or legal context is removed without replacement.

### [#16 GitHub Issues and Project workflow setup](https://github.com/thiabun/thia.lol/issues/16)

- Priority: P1
- Area labels: `area: project`, `area: docs`, `needs-product-decision`
- Summary: Configure v2 labels/statuses and make GitHub Issues/Project the source of truth for active work.
- Acceptance criteria:
  - [ ] Labels cover type, priority, area, Codex readiness, product decisions, and human testing.
  - [ ] Project board statuses match the v2 workflow.
  - [ ] Active docs point to GitHub Issues for work tracking.

### [#17 Search foundation plan](https://github.com/thiabun/thia.lol/issues/17)

- Priority: P2
- Area labels: `area: search`, `area: api`, `area: frontend`, `needs-product-decision`
- Summary: Define Search v1 before adding a route or nav item.
- Implementation note, 2026-06-12: Search v1 now has a `/search` route and `GET /api/search?q=...` endpoint for public profiles and public, non-deleted rooms. Posts, private chat messages, admin search, analytics, suggestions, and external search services remain out of scope.
- Acceptance criteria:
  - [x] Searchable entities are chosen for v1.
  - [x] Privacy and safety constraints are documented.
  - [x] API/SQL approach is proposed without external services.
  - [x] Empty, loading, error, and no-result states are specified.

### [#18 Profile and personal-space evolution plan](https://github.com/thiabun/thia.lol/issues/18)

- Priority: P2
- Area labels: `area: profiles`, `area: product`, `needs-product-decision`
- Summary: Define how profiles evolve into richer personal spaces for identity, posts/blogging, and future creator integrations.
- Acceptance criteria:
  - [ ] Profile use cases are prioritized.
  - [ ] Customization guardrails are documented.
  - [ ] Twitch, Spotify, Apple Music, and similar integrations are scoped as future work, not implemented.
  - [ ] Safety, performance, and moderation risks are listed.

### [#19 Analytics, revenue, and ads planning](https://github.com/thiabun/thia.lol/issues/19)

- Priority: P2
- Area labels: `area: product`, `area: privacy`, `area: revenue`, `needs-product-decision`
- Summary: Plan revenue and analytics maturity without adding trackers, ads, or optional cookies yet.
- Acceptance criteria:
  - [ ] Analytics options are compared with cookie/privacy impact.
  - [ ] Revenue options are listed with trust and moderation risks.
  - [ ] No tracker, ad script, marketing cookie, or monetization code is added.
  - [ ] Legal/cookie policy updates required for future implementation are identified.

### [#20 API/SQL product maturity audit](https://github.com/thiabun/thia.lol/issues/20)

- Priority: P2
- Area labels: `area: api`, `area: database`, `area: tests`, `codex-ready`
- Summary: Identify which v2 product tracks require API/SQL work and define safe migration/testing discipline.
- Acceptance criteria:
  - [ ] Threads, search, block/mute, profiles, analytics, moderation, and admin diagnostics are reviewed.
  - [ ] Needed schema/API changes are split into small future issues.
  - [ ] No production migration is run.
  - [ ] API-backed smoke requirements are documented for each track.

## Suggested Project Board Structure

Use a GitHub Project named:

```text
thia.lol Public Readiness
```

Suggested statuses:

- Inbox
- Needs product decision
- Ready for Codex
- In progress
- Needs review
- Needs human/API test
- Blocked
- Done

Suggested labels:

- `type: bug`
- `type: feature`
- `type: polish`
- `type: docs`
- `type: performance`
- `type: test`
- `type: security`
- `area: api`
- `area: database`
- `area: deploy`
- `area: docs`
- `area: design`
- `area: layout`
- `area: search`
- `area: profiles`
- `area: posts`
- `area: threads`
- `area: rooms`
- `area: chat`
- `area: moderation`
- `area: admin`
- `area: analytics`
- `area: revenue`
- `area: tests`
- `priority: p0`
- `priority: p1`
- `priority: p2`
- `priority: p3`
- `public-readiness-v2`
- `codex-ready`
- `needs-human-test`
- `needs-product-decision`
- `blocked`

## First Three Codex Implementation Tasks

1. Thread Experience Redesign
   - Reason: it is the clearest user-visible gap in the brief and affects the core social loop.
   - Verification: desktop/mobile screenshots, existing mocked tests where practical, and deployed/API-backed smoke for reply mutations when touched.

2. Layout, Navigation, and Footer Polish
   - Reason: removing the "social app" label, reducing footer/dock conflict, and compacting the footer are small, high-confidence shell improvements.
   - Verification: responsive screenshots and `npm run typecheck`, `npm run lint`, `npm run optimize:assets`, `npm run build`, `git diff --check`.

3. Docs Cleanup and Issue Migration
   - Reason: v2 should not continue v1's many-doc progress tracking pattern.
   - Verification: docs diff review, issue links, and no deletion of useful operational context.

## Open Product Decisions For Thia

- Should thread v2 remain a modal-first experience, or should the product add a full-page thread route/permalink soon?
- How deep should replies nest visually before the UI switches to "show more" or a dedicated route?
- Should `posts.root_id` or `posts.thread_id` be added before deeper thread work?
- What should the first global Search search: posts, profiles, rooms, handles, or all of them?
- Should Search appear in the top nav, account menu, or a command/search affordance?
- How customizable should profiles become before readability and moderation suffer?
- Should profiles support blog-like long-form posts, pinned sections, or curated post collections?
- Which creator integrations matter first: Twitch, Spotify, Apple Music, YouTube, or something else?
- Should music/stream embeds be external links first, API-backed embeds later, or server-rendered cards?
- What is the acceptable analytics stance: no analytics, server-only aggregate analytics, privacy-preserving external analytics, or opt-in analytics?
- What revenue models fit the product: donations, memberships, cosmetics, creator support, sponsorships, ads, or no monetization until launch?
- What ad categories or sponsorships are unacceptable for the platform?
- Who owns GitHub Project triage and label hygiene after Codex creates issues?
- Which v1 docs should be archived after this plan is adopted?
- What level of public launch polish is required before inviting broader testers?
