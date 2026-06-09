# Auth Session Diagnostics

Use these browser checks when production appears logged in but authenticated API calls return `401`.

Admin diagnostics are intentionally retained behind the server-only migration token. Login and register responses only include cookie diagnostics when `app.debug` is explicitly `true`.

Production should be used consistently at:

```text
https://thia.lol
```

Frontend API calls are same-origin `/api/...` requests. Avoid mixing `www.thia.lol` and `thia.lol` during auth testing because host-only cookies are scoped to the hostname that set them.

## Browser checks

1. Open `https://thia.lol/login`.
2. Open DevTools, then the Network tab.
3. Submit the login form.
4. Select the `POST /api/auth/login` request and confirm the response includes a `Set-Cookie` header for the configured session cookie name, normally `thia_session`.

Expected cookie attributes:

```text
Name: thia_session
Path: /
Domain: blank or absent
HttpOnly: true
Secure: true on https://thia.lol
SameSite: Lax
Expires: future timestamp
```

If Chrome shows a blocked or rejected cookie reason in the Network panel, note whether it was rejected for domain, secure context, SameSite, or expiry.

5. Open DevTools Application > Cookies > `https://thia.lol` and confirm `thia_session` exists there. It should not be stored under `https://www.thia.lol` during non-www testing.
6. Run this in the Console:

```js
await fetch("/api/auth/me", { credentials: "include" }).then((response) =>
  response.json(),
);
```

Expected result:

```json
{ "ok": true, "data": { "user": { "handle": "thia" } } }
```

7. Run the same Console command again. The second call should still return the same authenticated user.
8. Run it a third time. All three calls should remain authenticated.
9. Like two different posts. If the first succeeds and the second fails with `401`, inspect whether duplicate session cookies are present under DevTools Application > Cookies > `https://thia.lol`.
10. While still logged in as an admin, check migration status with a server-only token:

```js
await fetch("/api/admin/migrations/status", {
  credentials: "include",
  headers: {
    "X-Migration-Token": "replace-with-token-from-server-config",
  },
}).then((response) => response.json());
```

11. If auth still looks unstable, call the token-protected diagnostics endpoint:

```js
await fetch("/api/admin/auth/diagnostics", {
  credentials: "include",
  headers: {
    "X-Migration-Token": "replace-with-token-from-server-config",
  },
}).then((response) => response.json());
```

The diagnostics response reports the request host, HTTPS detection, configured cookie options, whether a raw `Cookie` header was present, whether the configured cookie name appears in `$_COOKIE`, how many same-name cookie candidates were found in the raw `Cookie` header, whether each candidate maps to a row in `sessions`, whether that row is expired, and which cookie variants the backend attempts to clear. It does not reveal raw session tokens or token hashes.

Do not paste real migration tokens into committed files, tickets, docs, or chat.

Secrets used while diagnosing production auth were rotated manually. Keep future rotation records outside the repo.

## Session trace sequence

Use this trace when `/api/auth/me` succeeds once and then returns `401` while the browser still appears to send the same cookie.

1. Log in at `https://thia.lol/login`.
2. Call the read-only trace endpoint:

```js
await fetch("/api/admin/auth/session-trace", {
  credentials: "include",
  headers: {
    "X-Migration-Token": "replace-with-token-from-server-config",
  },
}).then((response) => response.json());
```

3. Call `/api/auth/me`:

```js
await fetch("/api/auth/me", { credentials: "include" }).then((response) =>
  response.json(),
);
```

4. Call `/api/admin/auth/session-trace` again.
5. Call `/api/auth/me` again.
6. If the second `/api/auth/me` returns `401`, call `/api/admin/auth/session-trace` once more without refreshing the page.

The trace endpoint does not clear cookies and does not delete sessions. It reports request host, whether a raw `Cookie` header was present, how many `thia_session` candidates were parsed from the raw `Cookie` header, whether `$_COOKIE` contains `thia_session`, per-candidate token length and token-hash prefix, whether the underlying `sessions` row exists, expiry timing, user status, profile presence, whether the normal session query would accept it, and the newest five sessions for the inferred user. It never returns raw tokens or full token hashes.

## Expiry Column Fix

Root cause found on production: `sessions.expires_at` was created as `TIMESTAMP NOT NULL`. On the deployed MySQL/MariaDB configuration, updating `last_seen_at` also auto-updated `expires_at` to the current timestamp. That made a fresh session expire immediately after the first successful `/api/auth/me`.

Migration `20260609_0003_fix_session_expiry_datetime.sql` changes:

```sql
ALTER TABLE sessions
  MODIFY expires_at DATETIME NOT NULL;

ALTER TABLE sessions
  MODIFY last_seen_at DATETIME NULL DEFAULT NULL;
```

`sessions.expires_at` must remain `DATETIME NOT NULL` and must not have `DEFAULT CURRENT_TIMESTAMP` or `ON UPDATE CURRENT_TIMESTAMP`. It is set explicitly by application code when a session is created. `sessions.last_seen_at` may be updated by `/api/auth/me` through `current_session()`.

After deploying and running the migration, delete damaged production sessions and log in again:

```sql
DELETE FROM sessions;
```

Migration status and run verification:

1. While logged in as an admin, check status with the server-only token:

```js
await fetch("/api/admin/migrations/status", {
  credentials: "include",
  headers: {
    "X-Migration-Token": "replace-with-token-from-server-config",
  },
}).then((response) => response.json());
```

2. Run pending migrations with the same admin session and token:

```js
await fetch("/api/admin/migrations/run", {
  method: "POST",
  credentials: "include",
  headers: {
    "X-Migration-Token": "replace-with-token-from-server-config",
  },
}).then((response) => response.json());
```

3. Check status again and confirm `20260609_0003_fix_session_expiry_datetime.sql` is applied with the expected checksum and `applied_at`.

Verification:

1. Run the migration.
2. Delete old sessions.
3. Log in fresh.
4. Confirm session trace before `/api/auth/me`: `secondsUntilExpiry` is near `2592000` and `normalSessionAccepted` is `true`.
5. Run `/api/auth/me`.
6. Confirm session trace after `/api/auth/me`: same `sessionId`, unchanged `expiresAt`, updated `lastSeenAt`, `secondsUntilExpiry` still near `2592000`, and `normalSessionAccepted` is `true`.
7. Run `/api/auth/me` three times over several minutes. All calls should return `ok: true`.
