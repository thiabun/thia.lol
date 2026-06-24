# Backend Rewrite Roadmap

> **Status: Planning reference.** Production remains the PHP/MariaDB API until
> the new backend proves route parity and rollback safety.

## Direction

The target backend is a TypeScript API on Node, introduced gradually beside the
current PHP API.

Preferred stack:

- Fastify for HTTP routing.
- PostgreSQL 16 for the long-term database.
- Drizzle for schema and migrations.
- Zod for request validation.
- Vitest for backend tests.

## Migration Strategy

Use a strangler migration:

1. Keep the existing PHP API live.
2. Add a new internal Caddy route for the TypeScript service.
3. Move low-risk read endpoints first.
4. Add parity tests before switching public `/api/*` traffic for a route.
5. Keep each production route on PHP until explicit preview smoke, controlled
   mutation checks, Caddy rollback notes, and cutover verification exist.

Do not replace the production API in one big cutover.

## Current Route Ownership

Production Node ownership is limited to parity-proven reads: rooms, search,
badges, stats, profiles/profile extras, posts, room/profile post lists, post
detail/replies, home/discover feeds, auth/me, settings, onboarding, follow
requests, my posts, notifications, low-risk private writes, auth/session
writes, social/content writes, and profile/account editor writes.

Preview-only Node coverage now also exists for uploads, full chat,
admin/moderation, share-card image/cache routes, push subscription/status
routes, setup, migrations, diagnostics, sitemap, and `POST /me/profile`.
Those routes must not be added to production `/api/*` Caddy ownership until
live preview smoke and route-specific rollback checks pass. Integrations remain
PHP-owned pending a separate OAuth/provider config port.

Private read previews also remain available under `/api-next/*`:

```text
GET /api-next/auth/me
GET /api-next/me/settings
GET /api-next/me/onboarding
GET /api-next/me/follow-requests
GET /api-next/me/posts
GET /api-next/me/profile/modules
GET /api-next/me/profile/canvas-draft
GET /api-next/notifications
```

These routes use the existing MariaDB sessions table and PHP-compatible CSRF
HMAC generation. Re-run authenticated parity with
`COOKIE_HEADER='thia_session=...'` before expanding into private writes.

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

## Safe Route Candidates

Public read-only routes are the preferred early migration targets:

```text
GET /api-next/health
GET /api/profiles/{handle}
GET /api/rooms
GET /api/posts
GET /api/search
GET /api/badges
GET /api/rooms/{slug}/members
```

Next safe candidates after private-read parity:

```text
POST /api/notifications/read
POST /api/notifications/read-all
POST /api/notifications/{id}/read
PATCH /api/me/onboarding
PATCH /api/me/preferences
PATCH /api/me/privacy
```

These low-risk writes are now the first Node-owned mutation batch. They are
verified with unauthenticated or missing-CSRF checks so production smoke tests do
not mutate data.

Auth/session writes are now Node-owned in production after controlled
test-account smoke:

```text
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/register
POST /api/auth/2fa/verify
POST /api/me/security/2fa/setup
POST /api/me/security/2fa/enable
DELETE /api/me/security/2fa
POST /api/me/security/2fa/recovery-codes
```

These routes use PHP-compatible password verification, session token hashing,
cookie attributes, CSRF validation for protected settings, and 2FA encryption,
with `/api-next/*` still available for preview/smoke comparisons. Production
verification must avoid destructive parity checks; use no-cookie validation
checks or controlled throwaway accounts with cleanup.

Social/content mutations are now Node-owned in production after controlled
throwaway-account smoke:

```text
POST/DELETE /api/profiles/{handle}/follow
POST/DELETE /api/profiles/{handle}/block
POST/DELETE /api/profiles/{handle}/mute
POST/DELETE /api/profiles/{handle}/star
DELETE /api/profiles/{handle}/follower
POST /api/me/follow-requests/{id}/approve
DELETE /api/me/follow-requests/{id}
POST /api/posts
POST /api/posts/{id}/replies
PATCH/DELETE /api/posts/{id}
POST/DELETE /api/posts/{id}/like
POST/DELETE /api/posts/{id}/reblog
POST /api/posts/{id}/reactions
DELETE /api/posts/{id}/reactions/{type}
POST /api/posts/{identifier}/shares/messages
POST /api/rooms
PATCH/DELETE /api/rooms/{slug}
POST/DELETE /api/rooms/{slug}/join
POST/DELETE /api/rooms/{slug}/moderators
```

These routes use the existing MariaDB schema, PHP-compatible sessions and CSRF,
generic mutation errors, and no-cookie or missing-CSRF routing checks in
`scripts/check-api-cutover.mjs`. Live mutation testing must use controlled
accounts and read-back assertions, not double-submit destructive parity checks.

Profile/account editor writes are now Node-owned in production after controlled
throwaway-account smoke:

```text
PATCH /api/me/profile
PATCH /api/me/profile/featured
GET/HEAD/POST /api/me/profile/modules
PATCH/DELETE /api/me/profile/modules/{id}
POST /api/me/profile/modules/{id}/restore
PATCH /api/me/profile/module-order
PATCH /api/me/profile/canvas
GET/HEAD/PATCH/DELETE /api/me/profile/canvas-draft
POST /api/me/profile/canvas-draft/commit
PATCH /api/me/badges/featured
DELETE /api/me/posts
PATCH /api/me/account/email
PATCH /api/me/account/handle
PATCH /api/me/account/password
DELETE /api/me/account
DELETE /api/me/account/deletion
POST /api/me/account/deletion/cancel
```

These routes reuse MariaDB, PHP-compatible sessions/CSRF, current upload URL
fields, profile module/canvas storage, badge visibility storage, and account
deletion/session invalidation behavior. Upload storage itself is still PHP-owned.

Avoid moving until authenticated mutation smoke accounts, upload checks, and
side-effect rollback checks are in place:

```text
POST /api/uploads/*
full chat routes
admin/moderation routes
```

## Acceptance Bar For Route Cutover

Before a route moves to the TypeScript API:

- PHP and TypeScript responses match the documented public shape.
- Existing frontend calls require no behavior change.
- Tests cover success, not found, invalid input, and auth requirements where
  relevant.
- Caddy rollback is one config change.
- `scripts/smoke-live.sh` still passes after deployment.
