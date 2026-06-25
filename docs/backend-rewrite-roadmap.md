# Backend API Ownership

> **Status: Current architecture note.** The product API runs through the
> Node/MariaDB service. The old staged preview path is retired.

## Current Direction

The active backend is a TypeScript API on Node:

- Fastify for HTTP routing.
- MariaDB for current production storage.
- Zod-style validation and explicit route payload mapping where useful.
- Vitest for backend tests.
- Caddy routes product `/api/*` traffic to the Node service and adds
  `X-Thia-API-Runtime: node`.

The long-term database direction can still be PostgreSQL with Drizzle, but that
needs a separate implementation plan and migration window. Do not start a broad
database rewrite inside a feature task.

## Current Route Ownership

Production Node ownership includes product `/api/*` traffic, including:

- public reads for profiles, posts, rooms, badges, stats, search, feeds, and
  share cards
- private reads for auth, settings, onboarding, follow requests, notifications,
  integrations, push, and chat
- auth/session writes
- profile/account editor writes
- social/content and room mutations
- uploads
- chat, reports, admin/moderation, setup, diagnostics, and migrations
- sitemap and social-preview HTML compatibility aliases such as
  `/api/post-share.php`, `/api/profile-share.php`, and `/api/sitemap.php`

Canonical profile and post URLs (`/@handle` and `/@handle/posts/:postId`) are
also Node-owned for social-preview HTML and must be matched before the static
SPA fallback in Caddy.

`/api-next/*` is retired and should return `404`.

## Database Strategy

MariaDB remains the production database during VPS stabilization.

PostgreSQL migration needs a separate implementation plan covering:

- schema mapping from MariaDB to PostgreSQL
- data export/import commands
- ID and timestamp compatibility
- session/auth migration behavior
- media URL preservation
- migration rollback
- read parity and write consistency tests

Do not cut over auth/session tables until password login, CSRF, cookie behavior,
2FA, and session expiry are proven against production-like data.

## Acceptance Bar For API Changes

Before changing an API route:

- Existing frontend calls require no behavior change unless the issue asks for
  one.
- Tests cover success, not found, invalid input, and auth requirements where
  relevant.
- Protected writes require authentication and CSRF.
- `npm run build:api` and `npm run test:api` pass.
- Live deploy verification checks `/api/*` for `X-Thia-API-Runtime: node`.
