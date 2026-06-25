# VPS Operations

> **Status: Operational reference.** Use this for production SSH, Caddy,
> Node API, MariaDB, backups, media storage, and incident checks on the
> PebbleHost VPS.

## Access Model

Production host:

```text
45.143.196.174
https://thia.lol
```

SSH is key-only. Do not store private SSH keys, database passwords, session
cookies, migration tokens, or production config in the repo.

Local Codex desktop checkouts usually have these key files:

```text
~/.ssh/thia_lol_vps_ed25519             # codex VPS/admin key
~/.ssh/thia_lol_github_actions_ed25519  # deploy/GitHub Actions-style key
```

The local SSH agent may be empty, so pass the identity explicitly:

```bash
ssh -i ~/.ssh/thia_lol_vps_ed25519 -o IdentitiesOnly=yes codex@45.143.196.174
ssh -i ~/.ssh/thia_lol_github_actions_ed25519 -o IdentitiesOnly=yes deploy@45.143.196.174
```

`codex` can run passwordless sudo for Caddy and other VPS ops. `deploy` matches
the GitHub Actions deployment surface and should be used for deploy-target
checks when admin access is not needed.

Useful checks:

```bash
ssh -i ~/.ssh/thia_lol_vps_ed25519 -o IdentitiesOnly=yes codex@45.143.196.174
systemctl is-active ssh fail2ban mariadb caddy thia-node-api.service thia-db-backup.timer
sudo ufw status verbose
```

## Production Paths

```text
/srv/thia.lol/www/                 # public web root
/srv/thia.lol/www/uploads/         # public uploaded media
/srv/thia.lol/config/node-api.env  # server-only Node API environment
/srv/thia.lol/migrations/          # deployed SQL migrations
/srv/thia.lol/node-api/            # deployed Fastify API
/srv/thia.lol/backups/db/          # daily MariaDB dumps
/etc/caddy/Caddyfile               # Caddy routing and TLS config
```

`/srv/thia.lol/config/node-api.env` must remain outside the web root and must
not be committed. `/srv/thia.lol/www/uploads/` is runtime data and must survive
deploys.

## Health Checks

```bash
curl --fail-with-body https://thia.lol/api/health
curl --fail-with-body 'https://thia.lol/api/health?db=1'
curl -i https://thia.lol/api/rooms | sed -n '1,20p'
curl -i https://thia.lol/api-next/health | sed -n '1,20p'
curl --head https://thia.lol/
```

Expected:

- `/api/health` returns JSON `ok: true`.
- `/api/health?db=1` returns JSON `ok: true` when MariaDB is reachable.
- `/api/*` responses include `X-Thia-API-Runtime: node`.
- `/api-next/*` returns `404`.

## Caddy

Caddy owns HTTPS for `thia.lol`, redirects `www.thia.lol` to the apex, serves
the static web root, and proxies API/social-preview routes to the Node service.

Config path:

```text
/etc/caddy/Caddyfile
```

Validate before reload:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Canonical profile and post URLs must be routed to the Node share-shell service
before the static SPA fallback so social crawlers see profile/post metadata
instead of the default `index.html` Open Graph tags.

The product API route should strip `/api`, proxy to `127.0.0.1:3100`, and set:

```text
X-Thia-API-Runtime: node
```

The retired preview route should return `404`:

```text
/api-next/*
```

## Node API

The Fastify service runs as:

```text
thia-node-api.service
```

Useful checks:

```bash
systemctl is-active thia-node-api.service
sudo journalctl -u thia-node-api.service -n 120 --no-pager
sudo journalctl -u thia-node-api.service --since "30 minutes ago" --no-pager
```

The service reads environment variables from:

```text
/srv/thia.lol/config/node-api.env
```

Keep production at `THIA_API_LOG_LEVEL=info` unless actively debugging. Do not
print database passwords, CSRF secrets, encryption keys, migration tokens,
OAuth secrets, authorization headers, or cookies.

When a Node-served route returns 500:

```bash
curl -i https://thia.lol/api/feed/home
sudo journalctl -u thia-node-api.service --since "30 minutes ago" --no-pager | grep '<request-id>'
systemctl is-active thia-node-api.service
node scripts/check-api-cutover.mjs
```

Node logs are structured and should include route name, method, sanitized URL,
status, request id, and sanitized error metadata. They must not contain cookies,
authorization headers, session tokens, raw SQL, stack traces, or config values.

## Deploy Checks

Deploy-target checks with the `deploy` user:

```bash
ssh -i ~/.ssh/thia_lol_github_actions_ed25519 -o IdentitiesOnly=yes deploy@45.143.196.174 '
  set -euo pipefail
  test -w /srv/thia.lol/www
  test -w /srv/thia.lol/migrations
  test -w /srv/thia.lol/node-api
  test -d /srv/thia.lol/www/uploads
  test ! -w /srv/thia.lol/www/uploads
  find /srv/thia.lol/www/uploads -maxdepth 0 -type d -group www-data -perm -0020 -perm -2000 | grep -q .
  systemctl is-active thia-node-api.service
'
```

Post-deploy verification:

```bash
scripts/smoke-live.sh
node scripts/check-api-cutover.mjs
```

## Migrations

Committed SQL migrations live in:

```text
backend/database/migrations/
```

Deployed SQL migrations live in:

```text
/srv/thia.lol/migrations/
```

The Node API runner is protected by admin session plus `THIA_MIGRATION_TOKEN`.
See `docs/thia-migration-runner-guide.md`.

## Uploads

Uploads live under:

```text
/srv/thia.lol/www/uploads/
```

The directory should be group-owned by `www-data`, group-writable, and setgid.
The `thia-node-api` runtime user should be in the `www-data` group. Do not
rsync over or delete this directory.

## Backups

Database backups live in:

```text
/srv/thia.lol/backups/db/
```

System units:

```text
thia-db-backup.timer
thia-db-backup.service
```

Check timer and recent backups:

```bash
systemctl list-timers thia-db-backup.timer --no-pager
sudo find /srv/thia.lol/backups/db -type f -name 'thia_lol-*.sql.gz' -printf '%TY-%Tm-%Td %TH:%TM %p\n' | sort
```

Create an immediate backup:

```bash
sudo systemctl start thia-db-backup.service
```

Before restoring, take a fresh safety dump unless the database is too damaged to
dump:

```bash
sudo mariadb-dump --single-transaction --routines --triggers thia_lol \
  | gzip -9 \
  | sudo tee /srv/thia.lol/backups/db/pre-restore-$(date -u +%Y%m%dT%H%M%SZ).sql.gz >/dev/null
```

Restore a backup only during an approved rollback window:

```bash
sudo systemctl stop thia-node-api.service
sudo mariadb -e "DROP DATABASE IF EXISTS thia_lol; CREATE DATABASE thia_lol CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
gzip -dc /srv/thia.lol/backups/db/thia_lol-YYYYMMDDTHHMMSSZ.sql.gz | sudo mariadb thia_lol
sudo systemctl start thia-node-api.service
curl --fail-with-body 'https://thia.lol/api/health?db=1'
```

## Security Cleanup

- Keep `THIA_MIGRATION_TOKEN` server-only.
- Keep `THIA_ACCOUNT_SETUP_TOKEN` empty unless actively using one-time setup.
- Keep `THIA_SECURITY_INTEGRATION_ENCRYPTION_KEY` stable; changing it can break
  stored provider tokens.
- Keep VAPID keys stable if push subscriptions are active.
- Never leave full imported server snapshots containing `node-api.env` readable
  in staging folders.
