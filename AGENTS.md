# Codex Collaboration Guide

> **Status: Required operating guide.** Read this before changing the repo.
> Keep the work small enough to verify, but do not be timid about deleting stale
> scaffolding when the replacement is clear.

`thia.lol` is a static-first social platform on a PebbleHost VPS. The app should
feel polished, alive, and a little strange in the good way. The infrastructure
should stay boring.

## Hard Invariants

- Frontend: Vite, React, TypeScript, Tailwind CSS, Motion for React, React Router.
- Static build output: `dist/`.
- Production web root: `/srv/thia.lol/www/`.
- PHP API deployment target: `/srv/thia.lol/www/api/`.
- SQL migrations deployment target: `/srv/thia.lol/www/api/migrations/`.
- Server config: `/srv/thia.lol/config/config.php`, readable by PHP, never web-served.
- Uploads: `/srv/thia.lol/www/uploads/`, server-owned runtime data.
- Database: MariaDB on the VPS.
- Web server: Caddy with PHP-FPM.
- Backups: daily MariaDB dumps under `/srv/thia.lol/backups/db/`.
- Domain root: `https://thia.lol/`.
- Vite base path: `/`.

Do not replace this with Next.js SSR, Vercel-only hosting, Composer, a hosted
edge runtime, or a full backend rewrite unless Thia explicitly asks. The planned
backend direction is a gradual TypeScript API and PostgreSQL strangler migration.

## Git Flow

Before implementation:

```bash
git pull --rebase
```

After verification and commit:

```bash
git push
```

If pull or push fails, stop and report the exact error. Do not leave hidden
local-only work.

If a GitHub issue drives the work:

- Read the issue first and keep its acceptance criteria in scope.
- Reference the issue number in the summary and commit or PR text where useful.
- After a verified push, comment with status, commit SHA, and verification.
- Close the issue if the pushed work fully resolves it.
- Leave it open with clear remaining work if it does not.

## Deploy Shape

The contents of `dist/` go directly into `/srv/thia.lol/www/`.

Correct:

```text
/srv/thia.lol/www/
  .htaccess
  index.html
  assets/
```

Wrong:

```text
/srv/thia.lol/www/dist/index.html
```

The PHP API is deployed separately:

```text
/srv/thia.lol/www/api/
  index.php
  bootstrap.php
  db.php
  auth.php
  read.php
  posts.php
  moderation.php
  migrations.php
  migrations/
  .htaccess
```

Never deploy real config or local uploads from the repo. Preserve:

```text
/srv/thia.lol/config/config.php
/srv/thia.lol/www/uploads/
```

## Do Not Do This

- Do not commit secrets, cookies, database credentials, FTP credentials,
  migration tokens, OAuth tokens, or production config.
- Do not remove the `/api` exclusion from the frontend `.htaccess`.
- Do not make `index.html` aggressively cached.
- Do not create public registration or social expansion features without
  moderation, rate limits, and CSRF checks.
- Do not use `dangerouslySetInnerHTML` for user content.
- Do not turn old planning docs into new task queues. Use GitHub Issues.

## Verification

For normal code changes, run:

```bash
npm run typecheck
npm run lint
npm run optimize:assets
npm run build
```

If API TypeScript changes:

```bash
npm run build:api
npm run test:api
```

If PHP changes and PHP is available:

```bash
find api -name '*.php' -print0 | xargs -0 -n1 php -l
```

Always run:

```bash
git diff --check
```

After `npm run optimize:assets`, check `git status` and make sure asset changes
are expected.

## Smoke Tests

Do not treat a missing local API as harmless.

If Vite logs `/api` proxy connection failures because no local PHP API is
running, API-backed smoke is blocked. Report it that way unless you either:

- start/configure a working local PHP API,
- run against a deployed base URL, or
- are doing purely static UI work and explicitly state that API behavior was not
  part of the smoke.

Any task touching auth, posts, replies, rooms, profiles, media, chat,
notifications, moderation, settings, or API-backed UI must verify against a
working API path.

Keep `/api/health` lightweight and DB-free. Use `/api/health?db=1` for database
connectivity.

If production returns a generic 500, debug in this order:

1. Caddy and PHP-FPM logs with `journalctl`.
2. Caddy routing for `/api/*`.
3. PHP version and extensions.
4. Config path and syntax.
5. Database credentials.
6. File permissions.

## Security Baseline

- Use PDO prepared statements for SQL.
- Use `password_hash()` and `password_verify()` for passwords.
- Use HttpOnly, Secure, SameSite=Lax cookies for sessions.
- Hash session tokens in the database.
- Require CSRF tokens for authenticated mutating requests.
- Hide raw exception details in production.
- Validate and constrain all user-submitted input.

## Product Direction

`thia.lol` is the platform identity. Thia is a founder profile, for example
`/@thia`, not the whole product.

Design language:

- Light mode: `Sunveil`, warm solarised soft yellow, calm, skin-lit, fluid.
- Dark mode: `Frostveil`, cool solarised blue, moonlit, icy, quiet.
- Brand identity: minimal bunny mark plus `thia.lol` wordmark.
- Pink variant: allowed for brand/social/app-icon assets, not a third selectable
  theme unless explicitly requested.
- Motion should feel springy, liquid, and alive without getting in the way.

Build the platform like a living place, not a stack of disconnected widgets.

## Implementation Summaries

Every final implementation summary should include:

1. Files changed.
2. Why each change was made.
3. Commands run and whether they passed.
4. Commit SHA and whether `git push` succeeded.
5. Exact deployed files/folders if manual upload is needed.
6. Exact URLs to test after deployment.
