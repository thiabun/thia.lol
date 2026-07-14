# Codex Collaboration Guide

> **Status: Required operating guide.** Read this before changing the repo.
> Keep work small enough to verify, but delete stale scaffolding when the
> replacement is clear.

`thia.lol` is a static-first social platform on a PebbleHost VPS. The app should
feel polished, alive, and a little strange in the good way. The infrastructure
should stay boring.

## Hard Invariants

- Frontend: Vite, React, TypeScript, Tailwind CSS, Motion for React, React Router.
- Static build output: `dist/`.
- Production web root: `/srv/thia.lol/www/`.
- Node API deployment target: `/srv/thia.lol/node-api/`.
- Node API config: `/srv/thia.lol/config/node-api.env`, server-only, never web-served.
- SQL migrations deployment target: `/srv/thia.lol/migrations/`.
- Uploads: `/srv/thia.lol/www/uploads/`, server-owned runtime data.
- Database: MariaDB on the VPS.
- Web server: Caddy reverse-proxying the Node API.
- Backups: daily MariaDB dumps under `/srv/thia.lol/backups/db/`.
- Domain root: `https://thia.lol/`.
- Product API: `/api/*`, always Node-served and marked with `X-Thia-API-Runtime: node`.
- Retired preview API: `/api-next/*` should return `404`.
- Vite base path: `/`.

Do not replace this with Next.js SSR, Vercel-only hosting, Composer, a hosted
edge runtime, or a full backend rewrite unless Thia explicitly asks. The
long-term database direction can still be PostgreSQL, but the current production
API is Node on MariaDB.

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
- Close the issue only if the pushed work fully resolves it.

## Deploy Shape

The contents of `dist/` go directly into `/srv/thia.lol/www/`.

Correct:

```text
/srv/thia.lol/www/
  .htaccess
  index.html
  assets/
  uploads/
```

Wrong:

```text
/srv/thia.lol/www/dist/index.html
```

The Node API is deployed separately and runs behind Caddy:

```text
/srv/thia.lol/node-api/
  package.json
  package-lock.json
  server/dist/
```

SQL migrations are deployed separately:

```text
/srv/thia.lol/migrations/
  20260625_0001_example.sql
```

Local Codex desktop checkouts may already have the VPS keys, but the SSH agent
often has no identities loaded. Use explicit identities:

```bash
ssh -i ~/.ssh/thia_lol_vps_ed25519 -o IdentitiesOnly=yes codex@45.143.196.174
ssh -i ~/.ssh/thia_lol_github_actions_ed25519 -o IdentitiesOnly=yes deploy@45.143.196.174
```

Use `codex` for sudo-level VPS/Caddy operations. Use `deploy` for deploy-path
checks that mirror GitHub Actions. Never commit private keys or copied secret
values; `.env.local` is ignored and can hold local path hints only.

Never deploy real config or local uploads from the repo. Preserve:

```text
/srv/thia.lol/config/node-api.env
/srv/thia.lol/www/uploads/
/srv/thia.lol/backups/
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

Always run:

```bash
git diff --check
```

After `npm run optimize:assets`, check `git status` and make sure asset changes
are expected.

## Smoke Tests

Do not treat a missing local API as harmless.

Local `/api/*` requests should proxy to the Node API on `127.0.0.1:3100`.
API-backed smoke is blocked unless you either:

- start/configure a working local Node API,
- run against a deployed base URL, or
- are doing purely static UI work and explicitly state that API behavior was not
  part of the smoke.

Any task touching auth, posts, replies, rooms, profiles, media, chat,
notifications, moderation, settings, or API-backed UI must verify against a
working API path.

Keep `/api/health` lightweight and DB-free. Use `/api/health?db=1` for database
connectivity.

If production returns a generic 500, debug in this order:

1. `journalctl -u thia-node-api.service`.
2. Caddy routing for `/api/*`.
3. Node API environment and file permissions.
4. Database credentials and MariaDB connectivity.
5. Migration status and storage-readiness errors.

## Security Baseline

- Use parameterized SQL through the Node database helpers.
- Use `bcrypt`/existing password-hash compatibility helpers for passwords.
- Use HttpOnly, Secure, SameSite=Lax cookies for sessions.
- Hash session tokens in the database.
- Require CSRF tokens for authenticated mutating requests.
- Hide raw exception details in production.
- Validate and constrain all user-submitted input.

## Product Direction

`thia.lol` is the platform identity. Thia is a founder profile, for example
`/@thia`, not the whole product.

Design language:

- Light mode: `Light`, Glinda mood, warm pink, calm, skin-lit, fluid.
- Dark mode: `Dark`, Elphaba mood, deep green, moonlit, verdant, quiet.
- Site-wide profile mode: `Profile Theme`, an explicit signed-in opt-in that
  carries the member's constrained profile colors, surfaces, background, and
  glass treatment through the rest of the site.
- Public profile pages remain themed to the profile owner regardless of the
  viewer's selected site theme.
- Brand identity: minimal bunny mark plus `thia.lol` wordmark.
- Pink variant: allowed for brand/social/app-icon assets, not a separate
  selectable brand theme.
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
