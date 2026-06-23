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
- runs `npm ci --omit=dev` on the VPS and restarts `thia-node-api.service`
- runs `scripts/smoke-live.sh` against `https://thia.lol`
- runs `scripts/smoke-api-next.sh` against the Node preview API
- runs `scripts/compare-api-parity.mjs` for production/preview read parity
- runs `scripts/check-api-cutover.mjs` for Node-served production read routes

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
ssh deploy@45.143.196.174 'cd /srv/thia.lol/node-api && npm ci --omit=dev && sudo -n /bin/systemctl restart thia-node-api.service'
```

Do not copy `config/config.php`, database dumps, `.env` files, cookies, or local
test credentials.

## Post-Deploy Checks

Run after every deploy:

```bash
scripts/smoke-live.sh
```

Also spot-check:

```text
https://thia.lol/
https://thia.lol/deploy-meta.json
https://thia.lol/api/health
https://thia.lol/api/health?db=1
https://thia.lol/api-next/health
https://thia.lol/api-next/health?db=1
https://thia.lol/api/rooms
https://thia.lol/api/rooms/general
https://thia.lol/api/stats
https://thia.lol/api/profiles/thia
https://thia.lol/@thia
```

`/api/rooms`, `/api/rooms/:slug`, and `/api/stats` are Node-served production
read routes and should include `X-Thia-API-Runtime: node`. Other production API
routes remain PHP-owned unless explicitly cut over later.

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
