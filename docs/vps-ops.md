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

An ignored `.env.local` can hold local hints such as:

```text
THIA_VPS_HOST=45.143.196.174
THIA_VPS_CODEX_USER=codex
THIA_VPS_CODEX_KEY=~/.ssh/thia_lol_vps_ed25519
THIA_VPS_DEPLOY_USER=deploy
THIA_VPS_DEPLOY_KEY=~/.ssh/thia_lol_github_actions_ed25519
```

Useful checks:

```bash
ssh -i ~/.ssh/thia_lol_vps_ed25519 -o IdentitiesOnly=yes codex@45.143.196.174
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
sudo journalctl -u thia-node-api.service -n 120 --no-pager
sudo journalctl -u thia-node-api.service --since "30 minutes ago" --no-pager
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

Canonical profile and post URLs must be routed to the Node share-shell service
before the static SPA fallback so social crawlers see profile/post metadata
instead of the default `index.html` Open Graph tags:

```caddy
@canonicalPostShare {
	method GET HEAD
	path_regexp canonicalPostShare ^/@[A-Za-z0-9_-]{1,40}/posts/[A-Za-z0-9_-]{1,40}/?$
}
handle @canonicalPostShare {
	header X-Thia-API-Runtime node
	reverse_proxy 127.0.0.1:3100
}

@canonicalProfileShare {
	method GET HEAD
	path_regexp canonicalProfileShare ^/@[A-Za-z0-9_-]{1,40}/?$
}
handle @canonicalProfileShare {
	header X-Thia-API-Runtime node
	reverse_proxy 127.0.0.1:3100
}
```

Selected production read routes are served by the Node API and marked with:

```text
X-Thia-API-Runtime: node
```

Node responses also include:

```text
X-Thia-Request-Id: <request-id>
```

Use that id to correlate user-visible failures with
`journalctl -u thia-node-api.service` entries.

Current Node-served production reads:

```text
GET/HEAD /api/rooms
GET/HEAD /api/rooms/:slug
GET/HEAD /api/rooms/:slug/members
GET/HEAD /api/search
GET/HEAD /api/badges
GET/HEAD /api/stats
GET/HEAD /api/profiles/:handle
GET/HEAD /api/profiles/:handle/rooms
GET/HEAD /api/profiles/:handle/modules
GET/HEAD /api/profiles/:handle/badges
GET/HEAD /api/profiles/:handle/followers
GET/HEAD /api/profiles/:handle/following
GET/HEAD /api/posts
GET/HEAD /api/posts/:identifier
GET/HEAD /api/posts/:id/replies
GET/HEAD /api/rooms/:slug/posts
GET/HEAD /api/profiles/:handle/posts
GET/HEAD /api/profiles/:handle/replies
GET/HEAD /api/profiles/:handle/reblogs
GET/HEAD /api/feed/home
GET/HEAD /api/feed/discover
GET/HEAD /api/auth/me
GET/HEAD /api/me/settings
GET/HEAD /api/me/onboarding
GET/HEAD /api/me/follow-requests
GET/HEAD /api/me/posts
GET/HEAD /api/notifications
GET/HEAD /api/me/push
GET/HEAD /api/chat/conversations
GET/HEAD /api/chat/moots
GET/HEAD /api/chat/conversations/:id/messages
GET/HEAD /api/admin/reports
GET/HEAD /api/admin/rooms
GET/HEAD /api/admin/migrations/status
GET/HEAD /api/admin/auth/diagnostics
GET/HEAD /api/admin/auth/session-trace
GET/HEAD /api/posts/:identifier/share-card.png
GET/HEAD /api/profiles/:handle/share-card.png
GET/HEAD /api/share-card/image
GET/HEAD /api/me/integrations
GET/HEAD /api/me/integrations/diagnostics
GET/HEAD /api/me/integrations/:provider/suggestions
GET /api/integrations/:provider/callback
GET/HEAD /api/post-share.php
GET/HEAD /api/profile-share.php
GET/HEAD /@:handle
GET/HEAD /@:handle/posts/:postId
GET/HEAD /sitemap.xml
GET/HEAD /api/sitemap.php
```

Current Node-served low-risk private writes:

```text
POST /api/notifications/read
POST /api/notifications/read-all
POST /api/notifications/:id/read
PATCH /api/me/onboarding
PATCH /api/me/privacy
PATCH /api/me/preferences
```

Current Node-served auth/session writes:

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

These auth routes are enforced by method-specific Caddy matchers and can be
rolled back without database changes because they use the same MariaDB users,
sessions, CSRF, and 2FA storage as PHP.

Current Node-served social/content writes:

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

Current Node-served profile/account editor writes:

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
POST /api/me/profile
```

Current Node-served final-surface writes:

```text
POST /api/uploads/:kind
POST /api/chat/conversations
POST /api/chat/conversations/:id/messages
POST /api/chat/conversations/:id/read
POST /api/reports
POST /api/admin/posts/:id/hide
POST /api/admin/posts/:id/remove
POST /api/admin/users/:id/suspend
POST /api/admin/reports/:id/resolve
POST /api/posts/:identifier/share-card-cache
POST /api/profiles/:handle/share-card-cache
POST/DELETE /api/me/push/subscriptions
POST /api/me/push/test
POST /api/me/integrations/:provider/start
DELETE /api/me/integrations/:provider
POST /api/me/integrations/metadata/resolve
POST /api/setup/thia
POST /api/admin/migrations/run
```

Low-risk private writes, protected 2FA settings, social/content writes,
profile/account editor writes, and room/post/profile mutations require a valid
session and PHP-compatible
`X-CSRF-Token` before mutating data. Public auth login, register, logout, and
2FA challenge verification use PHP-compatible rate limits, session cookies, and
generic auth errors, but do not require CSRF. Safe routing checks should omit
the cookie or omit the CSRF header and assert the `X-Thia-API-Runtime: node`
response header.

Integrations, OAuth callbacks, metadata resolution, and the legacy social-preview
HTML shells are Node-owned in production. PHP copies remain on disk only as
rollback material. The product `/api/*` fallback is a Node catch-all that strips
`/api`, proxies to `127.0.0.1:3100`, and sets `X-Thia-API-Runtime: node`.

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
curl --fail-with-body 'https://thia.lol/api-next/search?q=thia'
curl --fail-with-body https://thia.lol/api-next/badges
curl --fail-with-body https://thia.lol/api-next/rooms/general/members
curl --fail-with-body https://thia.lol/api-next/posts
curl --fail-with-body https://thia.lol/api-next/feed/home
curl --fail-with-body https://thia.lol/api-next/feed/discover
curl --fail-with-body https://thia.lol/api-next/rooms/general/posts
curl --fail-with-body https://thia.lol/api-next/profiles/thia/posts
curl --head https://thia.lol/api-next/posts/pc359fe2da759/share-card.png
curl --fail-with-body https://thia.lol/api-next/sitemap.xml
curl --fail-with-body --cookie 'thia_session=<redacted>' https://thia.lol/api-next/auth/me
curl --fail-with-body --cookie 'thia_session=<redacted>' https://thia.lol/api-next/me/settings
curl --fail-with-body --cookie 'thia_session=<redacted>' https://thia.lol/api-next/me/onboarding
curl --fail-with-body --cookie 'thia_session=<redacted>' https://thia.lol/api-next/me/follow-requests
curl --fail-with-body --cookie 'thia_session=<redacted>' https://thia.lol/api-next/me/posts
curl --fail-with-body --cookie 'thia_session=<redacted>' https://thia.lol/api-next/me/profile/modules
curl --fail-with-body --cookie 'thia_session=<redacted>' https://thia.lol/api-next/me/profile/canvas-draft
curl --fail-with-body --cookie 'thia_session=<redacted>' https://thia.lol/api-next/notifications
curl --fail-with-body https://thia.lol/api/rooms
curl --fail-with-body 'https://thia.lol/api/search?q=thia'
curl --fail-with-body https://thia.lol/api/badges
curl --fail-with-body https://thia.lol/api/rooms/general/members
curl --fail-with-body https://thia.lol/api/stats
curl --fail-with-body https://thia.lol/api/profiles/thia
curl --fail-with-body https://thia.lol/api/profiles/thia/modules
curl --fail-with-body https://thia.lol/api/profiles/thia/followers
```

The service reads environment variables from `/srv/thia.lol/config/node-api.env`.
Besides the MariaDB connection values, the Node API uses:

```text
THIA_SESSION_COOKIE_NAME=thia_session
THIA_SESSION_COOKIE_DOMAIN=
THIA_SESSION_LIFETIME_SECONDS=2592000
THIA_PUBLIC_BASE_URL=https://thia.lol
THIA_API_LOG_LEVEL=info
THIA_CSRF_SECRET=<same value as PHP security.csrf_secret>
THIA_SECURITY_INTEGRATION_ENCRYPTION_KEY=<same value as PHP security.integration_encryption_key>
THIA_SECURITY_ENCRYPTION_CONFIGURED=<true when PHP integration_encryption_key is configured>
THIA_SECURITY_ENCRYPTION_AVAILABLE=true
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

`THIA_API_LOG_LEVEL` may be `trace`, `debug`, `info`, `warn`, `error`,
`fatal`, or `silent`. Keep production at `info` unless actively debugging. Do
not commit that file or print its database password, CSRF secret, encryption
key, or session cookies in logs.

Private reads are available under `/api-next/*` for parity and are also
Node-served in production under `/api/*`:

```text
GET /api-next/auth/me
GET /api-next/me/settings
GET /api-next/me/onboarding
GET /api-next/me/follow-requests
GET /api-next/me/posts
GET /api-next/notifications
POST /api-next/notifications/read
POST /api-next/notifications/read-all
POST /api-next/notifications/:id/read
PATCH /api-next/me/onboarding
PATCH /api-next/me/privacy
PATCH /api-next/me/preferences
```

Anonymous smoke runs should see clean JSON `401` responses for these routes.
Authenticated private reads can be rerun with
`COOKIE_HEADER='thia_session=...'`. Authenticated write smoke should omit
`X-CSRF-Token` unless a controlled test account and read-back plan is being used.

Auth/session preview writes also remain available under `/api-next/*`:

```text
POST /api-next/auth/login
POST /api-next/auth/logout
POST /api-next/auth/register
POST /api-next/auth/2fa/verify
POST /api-next/me/security/2fa/setup
POST /api-next/me/security/2fa/enable
DELETE /api-next/me/security/2fa
POST /api-next/me/security/2fa/recovery-codes
```

Use only a controlled throwaway account for full live auth smoke. Verify
register, login, `/api/auth/me`, logout, failed `/api/auth/me`, 2FA setup, 2FA
enable, 2FA challenge, 2FA verify, recovery code regeneration, and 2FA disable,
then clean up the test account.

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

Product PHP fallback is retired. Any product route not matched by a more
specific Caddy block should still hit the Node catch-all and return the Node
runtime header. Treat missing `X-Thia-API-Runtime: node` on a product API route
as a routing regression.

Cutover verification:

```bash
node scripts/check-api-cutover.mjs
```

Rollback for the profile extras is Caddy-only: restore the latest
`/etc/caddy/Caddyfile.bak-profile-extras-*` backup or remove the five
`nodeApiProfile*` matcher/handler blocks, then run
`sudo caddy validate --config /etc/caddy/Caddyfile` and
`sudo systemctl reload caddy`.

Rollback for the post/feed read cutover is Caddy-only: restore
`/etc/caddy/Caddyfile.bak-post-feed-20260623143105` or remove the
`nodeApiPosts*`, `nodeApiPost*`, `nodeApiRoomPosts`, `nodeApiProfilePosts`, and
`nodeApiFeed*` matcher/handler blocks, then validate and reload Caddy.

Rollback for the public search/badge/member cutover is Caddy-only: restore the
latest `/etc/caddy/Caddyfile.bak-public-reads-*` backup or remove the
`nodeApiSearch`, `nodeApiBadges`, and `nodeApiRoomMembers` matcher/handler
blocks, then validate and reload Caddy.

Rollback for the private read cutover is Caddy-only: restore the latest
`/etc/caddy/Caddyfile.bak-private-reads-*` backup or remove the
`nodeApiAuthMe`, `nodeApiMeSettings`, `nodeApiMeOnboarding`,
`nodeApiMeFollowRequests`, `nodeApiMePosts`, and `nodeApiNotifications`
matcher/handler blocks, then validate and reload Caddy.

Rollback for the low-risk write cutover is Caddy-only: restore
`/etc/caddy/Caddyfile.bak-low-risk-writes-20260624T112153Z` or remove the
`nodeApiNotificationsRead`, `nodeApiNotificationsReadAll`,
`nodeApiNotificationReadOne`, `nodeApiMeOnboardingUpdate`,
`nodeApiMePrivacyUpdate`, and `nodeApiMePreferencesUpdate` matcher/handler
blocks, then validate and reload Caddy.

Rollback for the auth/session write cutover is Caddy-only: restore
`/etc/caddy/Caddyfile.bak-auth-session-20260624T115116Z` or remove the
`nodeApiAuthLogin`, `nodeApiAuthRegister`, `nodeApiAuthLogout`,
`nodeApiAuth2faVerify`, `nodeApiMeSecurity2faSetup`,
`nodeApiMeSecurity2faEnable`, `nodeApiMeSecurity2faDisable`, and
`nodeApiMeSecurity2faRecoveryCodes` matcher/handler blocks, then validate and
reload Caddy. No database rollback is needed unless a separate data issue was
introduced.

Rollback for the social/content mutation cutover is Caddy-only: restore
`/etc/caddy/Caddyfile.bak-content-mutations-20260624T124714Z` or remove the
`nodeApiProfileSocialMutation`, `nodeApiProfileFollowerRemoval`,
`nodeApiFollowRequestApprove`, `nodeApiFollowRequestDelete`,
`nodeApiPostCreate`, `nodeApiPostReplyCreate`, `nodeApiPostUpdateDelete`,
`nodeApiPostLikeMutation`, `nodeApiPostReblogMutation`,
`nodeApiPostReactionCreate`, `nodeApiPostReactionDelete`,
`nodeApiPostShareMessage`, `nodeApiRoomCreate`, `nodeApiRoomUpdateDelete`,
`nodeApiRoomJoinMutation`, and `nodeApiRoomModeratorMutation` matcher/handler
blocks, then validate and reload Caddy.

Rollback for the profile/account editor cutover is Caddy-only: restore
`/etc/caddy/Caddyfile.bak-profile-account-editor-20260624T143912Z` or remove
the `nodeApiProfileEditorUpdate`, `nodeApiProfileModulesIndex`,
`nodeApiProfileModuleMutation`, `nodeApiProfileModuleRestore`,
`nodeApiProfileCanvasDraft`, `nodeApiProfileCanvasDraftCommit`,
`nodeApiMePostsDelete`, `nodeApiAccountDelete`, and
`nodeApiAccountDeletionCancel` matcher/handler blocks, then validate and
reload Caddy.

Rollback for the final-surface cutover is Caddy-only: restore
`/etc/caddy/Caddyfile.bak-final-sprint-20260624T154909Z` or remove the
`nodeApiFinalSitemap`, `nodeApiProfileEditorPostAlias`, `nodeApiUploads`,
`nodeApiChat*`, `nodeApiReportsCreate`, `nodeApiAdmin*`,
`nodeApiShareCardImage`, `nodeApiPostShareCard*`, `nodeApiProfileShareCard*`,
`nodeApiMePush*`, and `nodeApiSetupThia` matcher/handler blocks, then validate
and reload Caddy.

Rollback for the product PHP fallback retirement is Caddy-only: restore
`/etc/caddy/Caddyfile.bak-product-php-retirement-20260624T174508Z` or remove the
integration/share-shell matchers and Node `/api/*` catch-all, then restore the
PHP `/api/*` handler, validate, reload Caddy, and rerun `scripts/smoke-live.sh`
plus `node scripts/check-api-cutover.mjs`.

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
