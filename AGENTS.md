# Codex Collaboration Guide

This repository is for `thia.lol`, a static-first social platform hosted on Pebblehost/cPanel.

Read this file before making changes. The project is intentionally shaped around cPanel constraints, so do not replace the architecture with a server framework, hosted edge runtime, or Vercel-only workflow unless explicitly requested.

## Current architecture

- Frontend: Vite, React, TypeScript, Tailwind CSS, Motion for React, React Router.
- Static build output: `dist/`.
- Production web root: `public_html/`.
- PHP API deployment target: `public_html/api/`.
- Config deployment target: normally `public_html/config/config.php`, protected by `public_html/config/.htaccess`.
- Database: MySQL/MariaDB through cPanel.
- Domain root: `https://thia.lol/`.
- Vite base path: `/`.

## Git sync rule

Before starting implementation, sync with the remote branch:

```bash
git pull --rebase
```

After verification passes and the commit is created, push the commit so GitHub Actions can deploy it:

```bash
git push
```

If `git pull --rebase` or `git push` fails, stop and report the error instead of continuing with hidden local-only changes.

## Deployment invariant

The contents of `dist/` go directly into `public_html/`.

Correct:

```text
public_html/
  .htaccess
  index.html
  ambient-veil.webp
  assets/
```

Wrong:

```text
public_html/dist/index.html
```

The API is deployed separately:

```text
public_html/api/
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

Config is not committed and must be created on the server:

```text
public_html/config/config.php
```

## Do not do these things

- Do not migrate the app to Next.js server rendering.
- Do not assume Node is available on the cPanel server.
- Do not require Composer unless explicitly asked.
- Do not commit `config/config.php`, database passwords, FTP credentials, cookies, or secrets.
- Do not remove the `/api` exclusion from the frontend `.htaccess`.
- Do not make `index.html` aggressively cached.
- Do not create public registration features without moderation, rate limits, and CSRF checks.
- Do not use `dangerouslySetInnerHTML` for user content.

## Preferred change style

Make small, verifiable changes.

Every implementation summary should include:

1. Files changed.
2. Why each change was made.
3. Commands run.
4. Whether these passed:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run optimize:assets`
   - `npm run build`
5. Commit SHA and whether `git push` succeeded.
6. Exact files or folders to upload to cPanel if manual upload is needed.
7. Exact URLs to test after deployment.

## Smoke test rule

Do not treat a missing local API as an expected or harmless smoke-test warning.

If the Vite dev server logs `/api` proxy connection failures because no local PHP API is running, the smoke test environment is incomplete.

Codex must either:

- start or configure a local PHP API server,
- run smoke tests against a real deployed base URL, or
- report the smoke test as blocked.

Do not claim smoke tests passed if API-backed behavior was not actually exercised.

Any task touching auth, posts, replies, rooms, profiles, media, or API-backed UI must verify against a working API path.

If local PHP cannot be started, document exactly what command or config is missing and how to unblock it.

Proxy warnings are only acceptable for purely static UI tasks that do not depend on API behavior, and this must be stated clearly.

## Backend rule

Keep `/api/health` lightweight and able to respond without touching the database.

Use `/api/health?db=1` for database connectivity checks.

If cPanel returns a generic 500 error, debug in this order:

1. cPanel `Errors` page or `error_log` files.
2. `public_html/api/.htaccess` compatibility.
3. PHP version and extensions.
4. Config file path and syntax.
5. Database credentials.
6. File permissions.

## Security baseline

- Use PDO prepared statements for SQL.
- Use `password_hash()` and `password_verify()` for passwords.
- Use HttpOnly, Secure, SameSite=Lax cookies for sessions.
- Hash session tokens in the database.
- Require CSRF tokens for authenticated mutating requests.
- Hide raw exception details in production.
- Validate and constrain all user-submitted input.

## Product direction

`thia.lol` should be a polished social platform, not a personal homepage centered on Thia.

Thia is represented as a secondary/founder profile, for example `/@thia`, while the platform itself remains the main identity.

Design language:

- Light mode: `Sunveil`, warm solarised soft yellow, calm, skin-lit, fluid.
- Dark mode: `Frostveil`, cool solarised blue, moonlit, icy, quiet.
- Motion should feel springy, liquid, and alive, but not distracting.

Build the platform like a living place, not a pile of unrelated widgets.
