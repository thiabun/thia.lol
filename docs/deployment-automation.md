# VPS Deployment Automation

> **Status: Operational reference.** Production deploys target the PebbleHost
> VPS over SSH. Product API traffic is Node-only on `/api/*`; `/api-next/*` is
> retired.

`thia.lol` production runs on the VPS at `https://thia.lol` with Caddy, Node,
MariaDB, and a static Vite frontend. GitHub Actions deploys built files over
SSH/rsync.

## Production Layout

```text
/srv/thia.lol/
  config/
    node-api.env               # server-only Node API environment
  migrations/                  # deployed SQL migrations
  node-api/                    # Fastify API deploy target
    package.json
    package-lock.json
    server/
      dist/
  www/
    index.html
    assets/
    deploy-meta.json
    uploads/                   # server-owned runtime media
  backups/
    db/
      thia_lol-*.sql.gz
```

Deployment must never overwrite or delete:

```text
/srv/thia.lol/config/node-api.env
/srv/thia.lol/www/uploads/
/srv/thia.lol/backups/
```

`/srv/thia.lol/config/node-api.env` must include the MariaDB connection values
plus the runtime settings from `server/env.example`. Production should set:

```text
THIA_PUBLIC_BASE_URL=https://thia.lol
THIA_API_LOG_LEVEL=info
THIA_WEB_ROOT=/srv/thia.lol/www
THIA_UPLOAD_ROOT=/srv/thia.lol/www/uploads
THIA_MIGRATIONS_DIR=/srv/thia.lol/migrations
```

Do not commit that file or print its database password, CSRF secret, encryption
key, migration token, OAuth secrets, or session cookies in logs.

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
- rsyncs `backend/database/migrations/` to `/srv/thia.lol/migrations/`
- rsyncs the built Node API to `/srv/thia.lol/node-api/`
- runs `npm ci --omit=dev` on the VPS, restarts `thia-node-api.service`, and
  confirms the service is active
- runs `scripts/smoke-live.sh` against `https://thia.lol`
- runs `scripts/check-api-cutover.mjs` to prove `/api/*` is Node-served and
  `/api-next/*` is retired

Anonymous routing smoke expects private routes to return JSON `401`s and
protected mutation checks to return JSON `401`, `403`, or `422` depending on
whether the route is unauthenticated, missing CSRF, or missing required fields.
To check authenticated private reads manually, pass a real browser session
without storing it:

```bash
COOKIE_HEADER='thia_session=<redacted>' node scripts/check-api-cutover.mjs
```

Live mutation testing should use controlled throwaway accounts and read-back
checks. Do not run destructive production parity checks.

The `deploy` SSH user should be able to write `/srv/thia.lol/www/`,
`/srv/thia.lol/migrations/`, and `/srv/thia.lol/node-api/`. It should be able
to restart only `thia-node-api.service` through passwordless sudo. It should not
be able to write `/srv/thia.lol/www/uploads/` or read
`/srv/thia.lol/config/node-api.env`. The `thia-node-api` runtime user should be
in the `www-data` group, the uploads directory should be `www-data`
group-owned with group write and setgid bits, and the Node service sandbox
should include `/srv/thia.lol/www/uploads` in `ReadWritePaths`.

The frontend rsync uses `--delete` but excludes `/api/`, `/config/`, and
`/uploads/`. `/api/` is excluded only to avoid deleting anything Caddy may route
around during the same deploy; the Node API is deployed to `/srv/thia.lol/node-api/`.

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
  --exclude '.DS_Store' \
  backend/database/migrations/ \
  deploy@45.143.196.174:/srv/thia.lol/migrations/

rm -rf .deploy-node-api
mkdir -p .deploy-node-api/server
cp package.json package-lock.json .deploy-node-api/
cp -R server/dist .deploy-node-api/server/dist
rsync -az --delete \
  --exclude '.DS_Store' \
  .deploy-node-api/ deploy@45.143.196.174:/srv/thia.lol/node-api/
ssh deploy@45.143.196.174 'cd /srv/thia.lol/node-api && npm ci --omit=dev && sudo -n /bin/systemctl restart thia-node-api.service && systemctl is-active thia-node-api.service'
```

Do not copy database dumps, `.env` files, cookies, local test credentials, or
server-only config.

## Post-Deploy Checks

Run after every deploy:

```bash
scripts/smoke-live.sh
node scripts/check-api-cutover.mjs
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
https://thia.lol/api/rooms
https://thia.lol/api/search?q=thia
https://thia.lol/api/badges
https://thia.lol/api/profiles/thia
https://thia.lol/api/posts
https://thia.lol/api/auth/me
https://thia.lol/api-next/health
https://thia.lol/@thia
```

Every `/api/*` route should include:

```text
X-Thia-API-Runtime: node
```

`/api-next/health` should return `404`.

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
3. Restore the previous Node API deploy source if available.
4. Restore MariaDB only if the failure is data/schema related.
5. Re-run:

```bash
curl --fail-with-body https://thia.lol/api/health
curl --fail-with-body 'https://thia.lol/api/health?db=1'
scripts/smoke-live.sh
node scripts/check-api-cutover.mjs
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
public_html/uploads/
```

Do not use this as the production deploy target anymore.
