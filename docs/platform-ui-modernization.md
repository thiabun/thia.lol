# Platform UI Modernization

> **Status: Active.** Use this for the current UI modernization direction.
> Implementation should be split into focused GitHub Issues rather than tracked
> as an expanding checklist in this file.
> Product UI/UX rules and component inventory live in
> `docs/product-ui-ux-guidelines.md`.

Date: 2026-06-13

## Purpose

Modernize the platform UI after the Public Readiness V2 profile customization improvements. The goal is a quieter, more intentional social product: less copy, fewer default-looking controls, stronger custom components, clearer mobile workflows, and better bug reporting without rewriting the whole app.

This plan is frontend and documentation focused. It does not approve API/session changes, migrations, analytics, ads, arbitrary profile styling, fake integrations, or a new server architecture.

## Current Problems

Audit examples to hunt down and fix in small slices:

- Default-looking form controls, especially selects on high-visibility composer, report, room, profile, and admin surfaces.
- Too many boxes, borders, and nested panels.
- Excessive explanatory copy where the UI can be self-evident.
- Inconsistent button styles and action hierarchy.
- Inconsistent cards across posts, rooms, people, admin rows, and empty states.
- Uneven empty states: some are calm and centered, others read like placeholder text.
- Cramped mobile surfaces in modals, chat, profile customization, and room editing.
- Modal/sheet inconsistency between composer, profile customization, room editor, report forms, and chat picker.
- Old sections that feel like admin tools on public pages.
- Sticky or floating action conflicts, especially mobile Post actions and bottom navigation.

## Modernization Principles

- Less copy, more intuitive controls.
- Custom accessible components over browser-default-looking controls.
- Fewer nested boxes; use panels only when they frame a real tool, repeated item, or modal.
- Stronger spacing hierarchy so pages scan before they explain.
- Mobile-first flows with no horizontal scroll.
- Full-screen mobile sheets where the task needs room, especially editors and larger pickers.
- Motion should support state changes and respect reduced-motion settings.
- Empty, loading, validation, and error states should be consistent and specific.
- GitHub-backed issue reporting is the active public bug pipeline.
- Polish real behavior only; do not add fake controls, unsupported claims, or decorative features that imply unbuilt product depth.

## Component Targets

Modernize these components and surfaces over focused follow-up tasks:

- Buttons and button groups.
- Segmented controls and tab rows.
- Selects/dropdowns.
- Text inputs.
- Textareas.
- Modals, dialogs, and mobile sheets.
- Action menus.
- Post composer.
- Room editor.
- Profile editor.
- Admin and report surfaces.
- Empty states.
- Search page.
- Chat layout.
- Notification layout.
- Footer and navigation.

## Bug Hunt Checklist

Check these across Home, Discover, Search, Rooms, room detail, Chat, Notifications, Profile, Admin, and legal pages:

- Mobile bottom nav overlap.
- Duplicate floating actions.
- Sticky footer interactions.
- Modal overflow.
- Desktop and mobile no horizontal scroll.
- Frostveil contrast in dark mode.
- Reduced-motion behavior.
- Click target isolation between cards, links, buttons, menus, and nav.
- Form validation states.
- Empty states.
- Loading states.
- API error states.

## GitHub Issue Reporting Pipeline

Public bug reports should go to GitHub Issues using the existing bug-report template:

```text
https://github.com/thiabun/thia.lol/issues/new?template=bug_report.yml
```

The app footer now exposes a direct `Report a bug` link to that template. Public guidance should stay lightweight:

- Include what happened.
- Include the route or page.
- Include device/browser when relevant.
- Add a screenshot or recording only if it is safe to share.
- Do not include passwords, cookies, CSRF/session tokens, migration tokens, API keys, OAuth secrets, database details, private DMs, or other private data.

Sensitive safety, privacy, account, or moderation concerns should avoid public details and use a private channel with Thia or the legal/contact path instead.

## Initial Cleanup Slice

This pass starts with a narrow implementation slice:

- Mobile dock Post action is a real dock cell instead of a lifted floating button.
- Room pages use the single mobile dock Post action, with the current room preselected.
- Footer exposes the GitHub bug-reporting entry point.
- Shared select fields receive custom styling while keeping native select semantics.

Follow-up tasks should continue one component family or one route family at a time.
