# Auth Session Diagnostics

Use these browser checks when production appears logged in but authenticated API calls return `401`.

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
5. Run this in the Console:

```js
await fetch("/api/auth/me", { credentials: "include" }).then((response) =>
  response.json(),
);
```

Expected result:

```json
{ "ok": true, "data": { "user": { "handle": "thia" } } }
```

6. Run the same Console command again. The second call should still return the same authenticated user.
7. Like two different posts. If the first succeeds and the second fails with `401`, inspect whether the session cookie is still present under DevTools Application > Cookies > `https://thia.lol`.
8. While still logged in as an admin, check migration status with a server-only token:

```js
await fetch("/api/admin/migrations/status", {
  credentials: "include",
  headers: {
    "X-Migration-Token": "replace-with-token-from-server-config",
  },
}).then((response) => response.json());
```

Do not paste real migration tokens into committed files, tickets, docs, or chat.
