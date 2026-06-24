# VPS Deployment Automation

> **Status: Operational reference.** Production deploys now target the
> PebbleHost VPS over SSH. The old cPanel/FTP flow is historical fallback only.

`thia.lol` production runs on the VPS at `https://thia.lol` with Caddy,
PHP-FPM, MariaDB, and a static Vite frontend. GitHub Actions deploys built
files over SSH/rsync.

## Production Layout

```text
/srv/thia.lol/
  config/
    config.php                 # server-only, never committed
    node-api.env               # server-only Node API environment
  node-api/                    # Fastify preview API deploy target
    package.json
    package-lock.json
    server/
      dist/
  www/
    index.html
    assets/
    deploy-meta.json
    api/
      index.php
      bootstrap.php
      migrations/
    uploads/                   # server-owned runtime media
  backups/
    db/
      thia_lol-*.sql.gz
```

Deployment must never overwrite or delete:

```text
/srv/thia.lol/config/config.php
/srv/thia.lol/config/node-api.env
/srv/thia.lol/www/uploads/
/srv/thia.lol/backups/
```

`/srv/thia.lol/config/node-api.env` must include the MariaDB connection values
plus:

```text
THIA_SESSION_COOKIE_NAME=thia_session
THIA_SESSION_COOKIE_DOMAIN=
THIA_SESSION_LIFETIME_SECONDS=2592000
THIA_PUBLIC_BASE_URL=https://thia.lol
THIA_API_LOG_LEVEL=info
THIA_CSRF_SECRET=<same value as PHP security.csrf_secret>
THIA_SECURITY_INTEGRATION_ENCRYPTION_KEY=<same value as PHP security.integration_encryption_key>
THIA_WEB_ROOT=/srv/thia.lol/www
THIA_INTEGRATION_SPOTIFY_CLIENT_ID=<optional>
THIA_INTEGRATION_SPOTIFY_CLIENT_SECRET=<optional>
THIA_INTEGRATION_SPOTIFY_REDIRECT_URI=<optional override>
THIA_INTEGRATION_YOUTUBE_CLIENT_ID=<optional>
THIA_INTEGRATION_YOUTUBE_CLIENT_SECRET=<optional>
THIA_INTEGRATION_YOUTUBE_API_KEY=<optional>
THIA_INTEGRATION_YOUTUBE_REDIRECT_URI=<optional override>
THIA_INTEGRATION_TWITCH_CLIENT_ID=<optional>
THIA_INTEGRATION_TWITCH_CLIENT_SECRET=<optional>
THIA_INTEGRATION_TWITCH_EMBED_PARENT=thia.lol
THIA_INTEGRATION_TWITCH_REDIRECT_URI=<optional override>
THIA_INTEGRATION_GITHUB_CLIENT_ID=<optional>
THIA_INTEGRATION_GITHUB_CLIENT_SECRET=<optional>
THIA_INTEGRATION_GITHUB_REDIRECT_URI=<optional override>
THIA_INTEGRATION_APPLE_MUSIC_DEVELOPER_TOKEN=<optional>
THIA_INTEGRATION_APPLE_MUSIC_STOREFRONT=us
```

## GitHub Actions Deploy

The production workflow is `.github/workflows/deploy.yml`.

Required repository secrets:

```text
VPS_HOST=45.143.196.174
VPS_USER=deploy
VPS_SSH_KEY=<private key for that user>
```

The deploy job:

- runs `npm ci`
- runs `npm run optimize:assets`
- runs `npm run typecheck`
- runs `npm run lint`
- runs `npm run build`
- runs `npm run build:api`
- writes `dist/deploy-meta.json`
- rsyncs `dist/` to `/srv/thia.lol/www/`
- rsyncs `api/` to `/srv/thia.lol/www/api/`
- rsyncs `backend/database/migrations/` to `/srv/thia.lol/www/api/migrations/`
- rsyncs the built Node API to `/srv/thia.lol/node-api/`
- runs `npm ci --omit=dev` on the VPS, restarts `thia-node-api.service`, and
  confirms the service is active
- runs `scripts/smoke-live.sh` against `https://thia.lol`
- runs `scripts/smoke-api-next.sh` against the Node preview API
- runs `scripts/compare-api-parity.mjs` for production/preview read parity
- runs `scripts/check-api-cutover.mjs` for Node-served production read and write routes

Anonymous preview/cutover smoke expects private read routes to return JSON
`401`s and preview auth write validation failures to return JSON `401`, `403`,
or `422` depending on whether the route is unauthenticated, missing CSRF, or
missing required fields. To check authenticated private read parity manually,
pass a real browser session without storing it:

```bash
COOKIE_HEADER='thia_session=<redacted>' scripts/smoke-api-next.sh
COOKIE_HEADER='thia_session=<redacted>' node scripts/compare-api-parity.mjs
```

Auth/session write routes should be live-smoked only with a controlled
throwaway account and read-back checks. Do not parity-check login/register/2FA by
submitting the same mutation to PHP and Node. The production auth/session write
routes are Node-owned after controlled smoke, and `scripts/check-api-cutover.mjs`
uses no-cookie validation checks to enforce routing without creating sessions or
accounts.

Social/content and profile/account editor mutation routes should be live-smoked with
`THIA_MUTATION_SMOKE=1 node scripts/smoke-api-next-mutations.mjs` before Caddy
cutover, then with
`API_PREFIX=/api THIA_MUTATION_SMOKE=1 node scripts/smoke-api-next-mutations.mjs`
after Caddy cutover. The script uses throwaway accounts, creates reversible
posts/rooms/profile edits/account edits, checks read-back behavior, and
performs API cleanup where possible. Remove any remaining `codexmut*` smoke
accounts from MariaDB after failures or interrupted runs.

The `deploy` SSH user should be able to write `/srv/thia.lol/www/`,
`/srv/thia.lol/www/api/`, `/srv/thia.lol/www/api/migrations/`, and
`/srv/thia.lol/node-api/`. It should be able to restart only
`thia-node-api.service` through passwordless sudo. It should not be able to
write `/srv/thia.lol/www/uploads/` or read `/srv/thia.lol/config/config.php`.

The frontend rsync uses `--delete` but excludes `/api/`, `/config/`, and
`/uploads/`. API deploy excludes `/migrations/` because migrations are deployed
as their own controlled step.

## Manual Deploy Fallback

Use this only when GitHub Actions is unavailable and after local verification
passes.

```bash
npm run typecheck
npm run lint
npm run optimize:assets
npm run build
npm run build:api
```

Then deploy from the repository root:

```bash
rsync -az --delete \
  --exclude '/api/' \
  --exclude '/config/' \
  --exclude '/uploads/' \
  --exclude '.DS_Store' \
  dist/ deploy@45.143.196.174:/srv/thia.lol/www/

rsync -az --delete \
  --exclude '/migrations/' \
  --exclude '.DS_Store' \
  --exclude 'config.php' \
  api/ deploy@45.143.196.174:/srv/thia.lol/www/api/

rsync -az --delete \
  --exclude '.DS_Store' \
  backend/database/migrations/ \
  deploy@45.143.196.174:/srv/thia.lol/www/api/migrations/

rm -rf .deploy-node-api
mkdir -p .deploy-node-api/server
cp package.json package-lock.json .deploy-node-api/
cp -R server/dist .deploy-node-api/server/dist
rsync -az --delete \
  --exclude '.DS_Store' \
  .deploy-node-api/ deploy@45.143.196.174:/srv/thia.lol/node-api/
ssh deploy@45.143.196.174 'cd /srv/thia.lol/node-api && npm ci --omit=dev && sudo -n /bin/systemctl restart thia-node-api.service && systemctl is-active thia-node-api.service'
```

Do not copy `config/config.php`, database dumps, `.env` files, cookies, or local
test credentials.

## Post-Deploy Checks

Run after every deploy:

```bash
scripts/smoke-live.sh
```

The live smoke checks `/@thia` with a crawler user agent and requires
profile-specific Open Graph metadata pointing at the generated profile
share-card, not the default `/brand/thia-og.png` fallback.

Also spot-check:

```text
https://thia.lol/
https://thia.lol/deploy-meta.json
https://thia.lol/api/health
https://thia.lol/api/health?db=1
https://thia.lol/api-next/health
https://thia.lol/api-next/health?db=1
https://thia.lol/api-next/search?q=thia
https://thia.lol/api-next/badges
https://thia.lol/api-next/rooms/general/members
https://thia.lol/api-next/posts
https://thia.lol/api-next/feed/home
https://thia.lol/api-next/feed/discover
https://thia.lol/api-next/rooms/general/posts
https://thia.lol/api-next/profiles/thia/posts
https://thia.lol/api-next/auth/me
https://thia.lol/api-next/me/settings
https://thia.lol/api-next/me/onboarding
https://thia.lol/api-next/me/follow-requests
https://thia.lol/api-next/me/posts
https://thia.lol/api-next/notifications
https://thia.lol/api/rooms
https://thia.lol/api/rooms/general
https://thia.lol/api/rooms/general/members
https://thia.lol/api/search?q=thia
https://thia.lol/api/badges
https://thia.lol/api/stats
https://thia.lol/api/profiles/thia
https://thia.lol/api/profiles/thia/rooms
https://thia.lol/api/profiles/thia/modules
https://thia.lol/api/profiles/thia/badges
https://thia.lol/api/profiles/thia/followers
https://thia.lol/api/profiles/thia/following
https://thia.lol/api/posts
https://thia.lol/api/posts/pc359fe2da759
https://thia.lol/api/posts/99/replies
https://thia.lol/api/rooms/general/posts
https://thia.lol/api/profiles/thia/posts
https://thia.lol/api/profiles/thia/replies
https://thia.lol/api/profiles/thia/reblogs
https://thia.lol/api/feed/home
https://thia.lol/api/feed/discover
https://thia.lol/api/auth/me
https://thia.lol/api/me/settings
https://thia.lol/api/me/onboarding
https://thia.lol/api/me/follow-requests
https://thia.lol/api/me/posts
https://thia.lol/api/notifications
https://thia.lol/@thia
```

`/api/rooms`, `/api/rooms/:slug`, `/api/rooms/:slug/members`, `/api/search`,
`/api/badges`, `/api/stats`, `/api/profiles/:handle`, the profile extras,
posts, room/profile post lists, and `/feed/home` and `/feed/discover` are
Node-served production read routes and should include the
`X-Thia-API-Runtime: node` header. Node responses should also include
`X-Thia-Request-Id` for journal correlation. Private reads for auth/me,
settings, onboarding, follow requests, my posts, and notifications are also
Node-served. Method-specific auth, low-risk private, and social/content writes
are also Node-served after controlled smoke.

The first low-risk private writes are also Node-served and verified without
mutating data by expecting unauthenticated `401` responses, or `403` responses
when a session cookie is provided without a CSRF token:

```text
POST /api/notifications/read
POST /api/notifications/read-all
POST /api/notifications/:id/read
PATCH /api/me/onboarding
PATCH /api/me/privacy
PATCH /api/me/preferences
```

Auth/session writes are Node-served and should include
`X-Thia-API-Runtime: node`:

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

Social/content writes are Node-served and should include
`X-Thia-API-Runtime: node` for the matching methods:

```text
POST/DELETE /api/profiles/:handle/follow
POST/DELETE /api/profiles/:handle/block
POST/DELETE /api/profiles/:handle/mute
POST/DELETE /api/profiles/:handle/star
DELETE /api/profiles/:handle/follower
POST /api/me/follow-requests/:id/approve
DELETE /api/me/follow-requests/:id
POST /api/posts
POST /api/posts/:id/replies
PATCH/DELETE /api/posts/:id
POST/DELETE /api/posts/:id/like
POST/DELETE /api/posts/:id/reblog
POST /api/posts/:id/reactions
DELETE /api/posts/:id/reactions/:type
POST /api/posts/:identifier/shares/messages
POST /api/rooms
PATCH/DELETE /api/rooms/:slug
POST/DELETE /api/rooms/:slug/join
POST/DELETE /api/rooms/:slug/moderators
```

Profile/account editor writes are Node-served and should include
`X-Thia-API-Runtime: node` for the matching methods:

```text
PATCH /api/me/profile
PATCH /api/me/profile/featured
GET/HEAD/POST /api/me/profile/modules
PATCH/DELETE /api/me/profile/modules/:id
POST /api/me/profile/modules/:id/restore
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

Uploads, full chat routes, admin/moderation, share-card PNG/cache/proxy routes,
integrations/OAuth, legacy share HTML shells, push subscription/status routes,
setup, migrations, diagnostics, sitemap, and `POST /api/me/profile` are
Node-served in production and should include `X-Thia-API-Runtime: node`.

The product PHP fallback is retired. Caddy now sends unmatched product `/api/*`
requests to the Node catch-all after stripping `/api`. PHP API files may remain
in the deploy tree as emergency rollback references, but they are not the active
product route owner.

For upload-sensitive changes, also check one known media URL under:

```text
https://thia.lol/uploads/media/
```

## Rollback

Preferred rollback is a new commit that reverts the bad change and lets GitHub
Actions redeploy. If production is broken badly enough that a fast server-side
rollback is required:

1. SSH to the VPS.
2. Confirm `/api/health` failure mode before changing anything.
3. Restore files from the previous known-good deploy source if available.
4. Restore MariaDB only if the failure is data/schema related.
5. Re-run:

```bash
curl --fail-with-body https://thia.lol/api/health
curl --fail-with-body 'https://thia.lol/api/health?db=1'
scripts/smoke-live.sh
```

Database backups live in:

```text
/srv/thia.lol/backups/db/
```

See `docs/vps-ops.md` for restore commands.

## Historical cPanel Notes

The old cPanel layout was:

```text
public_html/
public_html/api/
public_html/config/config.php
public_html/uploads/
```

Do not use this as the production deploy target anymore. Old Web Disk and FTP
helpers may remain in the repo as emergency historical fallback references, but
new production automation should target the VPS paths above.
