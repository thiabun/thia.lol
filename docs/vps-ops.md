# VPS Operations

> **Status: Operational reference.** Use this for production SSH, Caddy,
> MariaDB, backups, media storage, and incident checks on the PebbleHost VPS.

## Access Model

Production host:

```text
45.143.196.174
https://thia.lol
```

SSH is key-only. Use a named deploy/admin user with the minimum sudo access
needed for operational tasks. Do not store private SSH keys, database passwords,
session cookies, migration tokens, or production config in the repo.

Useful checks:

```bash
ssh codex@45.143.196.174
systemctl is-active ssh fail2ban mariadb php8.3-fpm caddy thia-db-backup.timer
sudo ufw status verbose
```

## Production Paths

```text
/srv/thia.lol/www/                 # public web root
/srv/thia.lol/www/api/             # PHP API
/srv/thia.lol/www/api/migrations/  # deployed SQL migrations
/srv/thia.lol/www/uploads/         # public uploaded media
/srv/thia.lol/config/config.php    # server-only config
/srv/thia.lol/config/node-api.env  # server-only Fastify API environment
/srv/thia.lol/node-api/            # deployed Fastify preview API
/srv/thia.lol/backups/db/          # daily MariaDB dumps
/etc/caddy/Caddyfile               # Caddy routing and TLS config
```

`/srv/thia.lol/config/config.php` must remain outside the web root and must not
be committed. `/srv/thia.lol/www/uploads/` is runtime data and must survive
deploys.

## Health Checks

```bash
curl --fail-with-body https://thia.lol/api/health
curl --fail-with-body 'https://thia.lol/api/health?db=1'
curl --head https://thia.lol/
curl --head https://thia.lol/uploads/media/2026/06/avatar-289fd7cc6ee3b099388526741d620ae1.webp
```

Logs:

```bash
sudo journalctl -u caddy -n 120 --no-pager
sudo journalctl -u thia-node-api -n 120 --no-pager
sudo journalctl -u php8.3-fpm -n 120 --no-pager
sudo journalctl -u mariadb -n 120 --no-pager
sudo journalctl -u fail2ban -n 120 --no-pager
```

## Caddy

Config lives at:

```text
/etc/caddy/Caddyfile
```

Validate before reload:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy owns HTTPS for `thia.lol` and redirects `www.thia.lol` to the apex.
The TypeScript API preview is proxied under `/api-next/*`.

Selected production read routes are served by the Node API and marked with:

```text
X-Thia-API-Runtime: node
```

Current Node-served production reads:

```text
GET/HEAD /api/rooms
GET/HEAD /api/rooms/:slug
GET/HEAD /api/stats
GET/HEAD /api/profiles/:handle
GET/HEAD /api/profiles/:handle/rooms
GET/HEAD /api/profiles/:handle/modules
GET/HEAD /api/profiles/:handle/badges
GET/HEAD /api/profiles/:handle/followers
GET/HEAD /api/profiles/:handle/following
```

Profile subroutes such as `/api/profiles/:handle/posts`,
`/api/profiles/:handle/replies`, `/api/profiles/:handle/reblogs`, profile
share-card routes, follow/block/mute/star mutations, and profile writes remain
on PHP. All other `/api/*` traffic remains on PHP unless explicitly cut over
later.

## Node API Preview

The Fastify preview service runs as:

```text
thia-node-api.service
```

Useful checks:

```bash
systemctl is-active thia-node-api.service
curl --fail-with-body https://thia.lol/api-next/health
curl --fail-with-body 'https://thia.lol/api-next/health?db=1'
curl --fail-with-body https://thia.lol/api-next/posts
curl --fail-with-body https://thia.lol/api-next/feed/home
curl --fail-with-body https://thia.lol/api-next/feed/discover
curl --fail-with-body https://thia.lol/api-next/rooms/general/posts
curl --fail-with-body https://thia.lol/api-next/profiles/thia/posts
curl --fail-with-body https://thia.lol/api/rooms
curl --fail-with-body https://thia.lol/api/stats
curl --fail-with-body https://thia.lol/api/profiles/thia
curl --fail-with-body https://thia.lol/api/profiles/thia/modules
curl --fail-with-body https://thia.lol/api/profiles/thia/followers
```

The service reads environment variables from `/srv/thia.lol/config/node-api.env`.
Besides the MariaDB connection values, the read-preview routes use:

```text
THIA_SESSION_COOKIE_NAME=thia_session
THIA_PUBLIC_BASE_URL=https://thia.lol
```

Do not commit that file or print its database password in logs.

Cutover verification:

```bash
node scripts/check-api-cutover.mjs
```

Rollback for the profile extras is Caddy-only: restore the latest
`/etc/caddy/Caddyfile.bak-profile-extras-*` backup or remove the five
`nodeApiProfile*` matcher/handler blocks, then run
`sudo caddy validate --config /etc/caddy/Caddyfile` and
`sudo systemctl reload caddy`.

Rollback for the current Node read cutover is Caddy-only: restore the backed-up
`/etc/caddy/Caddyfile` or remove the Node read handlers, validate Caddy, reload
Caddy, and rerun `scripts/smoke-live.sh`.

## MariaDB Backups

Daily database backups are created by:

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

Restore a backup only during an approved rollback window:

```bash
sudo systemctl stop php8.3-fpm
sudo mariadb -e "DROP DATABASE IF EXISTS thia_lol; CREATE DATABASE thia_lol CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
gzip -dc /srv/thia.lol/backups/db/thia_lol-YYYYMMDDTHHMMSSZ.sql.gz | sudo mariadb thia_lol
sudo systemctl start php8.3-fpm
curl --fail-with-body 'https://thia.lol/api/health?db=1'
```

Before restoring, take a fresh safety dump unless the database is too damaged to
dump:

```bash
sudo mariadb-dump --single-transaction --routines --triggers thia_lol \
  | gzip -9 \
  | sudo tee /srv/thia.lol/backups/db/pre-restore-$(date -u +%Y%m%dT%H%M%SZ).sql.gz >/dev/null
```

## Security Cleanup

- Keep `migration_token` server-only.
- Keep `account_setup_token` empty unless actively using one-time setup.
- Keep `integration_encryption_key` stable; changing it can break stored
  provider tokens.
- Keep VAPID keys stable if push subscriptions are active.
- Never leave full imported server snapshots containing `config.php` readable in
  staging folders.
