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
5. Keep auth, sessions, uploads, chat, and moderation on PHP until explicit
   parity and rollback plans exist.

Do not replace the production API in one big cutover.

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

## First Safe Route Candidates

Start with public read-only routes after the deploy path is stable:

```text
GET /api-next/health
GET /api/profiles/{handle}
GET /api/rooms
GET /api/posts
```

Avoid early rewrites of:

```text
POST /api/auth/login
POST /api/uploads/*
POST/PATCH/DELETE post mutations
chat routes
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
