# Thia Migration Runner Guide

> **Status: Operational reference.** Use this when committed SQL migrations need
> to be checked or applied on the live VPS database. Do not run migrations
> silently, do not commit migration tokens, and do not mark API-backed smoke as
> passed without a working API path.

This is the practical version of running database migrations for `thia.lol`
without relying on manual database edits.

Use this when Codex adds a new SQL file under `backend/database/migrations/`
and you need to apply it on the live VPS MariaDB database.

## What the Runner Does

The Node runner checks SQL files deployed to:

```text
/srv/thia.lol/migrations/
```

Then it applies any migration that is not already listed in the database table:

```text
schema_migrations
```

Each migration should run once. If a migration is already applied with the same
checksum, it is skipped. If the checksum changed, the runner stops instead of
guessing.

Local development note: committed source migrations live under
`backend/database/migrations/`. Local Node API runs should set
`THIA_MIGRATIONS_DIR` to that directory, or to another local copy of those SQL
files. Do not run production migrations from local automation.

## Before Running It

Make sure the latest code is deployed.

For a normal feature that changes frontend, API, and migrations, deploy:

```text
dist/ contents -> /srv/thia.lol/www/
server/dist/ plus package files -> /srv/thia.lol/node-api/
backend/database/migrations/*.sql -> /srv/thia.lol/migrations/
```

For the current issue or deploy, use the migration filenames listed in the
issue, pull request, commit summary, or launch checklist.

Also make sure the server config has a migration token set in:

```text
/srv/thia.lol/config/node-api.env
```

The relevant values are:

```text
THIA_MIGRATION_TOKEN=<server-only-token>
THIA_MIGRATIONS_DIR=/srv/thia.lol/migrations
```

The token is server-only. Do not paste it into GitHub, docs, screenshots, or
chat.

## Authoring Migrations

- Put committed SQL files under `backend/database/migrations/`.
- Use timestamped filenames, for example
  `20260623_0001_add_example_column.sql`.
- Prefer small migrations that map to one feature or fix.
- Do not edit an already-applied migration. Add a new migration instead.
- Keep migrations compatible with MariaDB while production uses MariaDB.
- Include schema changes and safe backfills only when the task requires them.
- Do not put secrets, tokens, local dumps, or production data in migration files.
- After adding a migration, update related API/backend tests where practical and
  report whether the migration was deployed and run.

## Step 1: Log In As Admin

Open the live site and log in with an admin account:

```text
https://thia.lol/login
```

The runner expects admin access plus the migration token.

## Step 2: Check Status

Open DevTools on `https://thia.lol`, then run this in the browser console.

Replace `PASTE_TOKEN_HERE` locally in your browser only. Do not save it in the
repo.

```js
await fetch("/api/admin/migrations/status", {
  credentials: "include",
  headers: {
    "X-Migration-Token": "PASTE_TOKEN_HERE",
  },
}).then(async (response) => ({
  status: response.status,
  body: await response.json().catch(() => null),
}));
```

Look for the relevant migration file or files. If a required migration says
`applied: false`, it is pending and ready to run.

## Step 3: Run Pending Migrations

Run this in the same browser console:

```js
await fetch("/api/admin/migrations/run", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-Migration-Token": "PASTE_TOKEN_HERE",
  },
  body: JSON.stringify({}),
}).then(async (response) => ({
  status: response.status,
  body: await response.json().catch(() => null),
}));
```

A good result should show `ok: true` and list migrations as applied or skipped.

## Step 4: Check Status Again

Run the status command again and confirm every required migration reports
`applied: true`.

## Step 5: Test The Feature

After running migrations, test health first, then test URLs that match the
feature being enabled:

```text
https://thia.lol/api/health
https://thia.lol/api/health?db=1
https://thia.lol/api/profiles/thia
https://thia.lol/api/profiles/thia/followers
https://thia.lol/api/profiles/thia/following
https://thia.lol/api/profiles/thia/modules
https://thia.lol/api/chat/moots
https://thia.lol/@thia
```

Then test in the UI for the feature that needed the migration.

## If It Fails

### 401 or 403

Usually means one of these:

- you are not logged in as admin
- the migration token is missing
- the migration token is wrong
- cookies were not sent

Try logging in again, then rerun the command from `https://thia.lol` so
`credentials: "include"` sends the session cookie.

### 404

Usually means:

- the migration runner is disabled because `THIA_MIGRATION_TOKEN` is empty
- the Node API deploy is stale
- the endpoint path is wrong

Check:

```text
/srv/thia.lol/node-api/server/dist/
/srv/thia.lol/config/node-api.env
/srv/thia.lol/migrations/
```

### 500

Check Caddy, Node API, and MariaDB logs. Then check:

```text
https://thia.lol/api/health
https://thia.lol/api/health?db=1
```

If database health fails, the config or MariaDB connection is the problem, not
the migration file.

### Migration Checksum Mismatch

Do not edit an already-applied migration. Add a new migration instead. If this
happens, stop and inspect what changed.

## Manual Database Fallback

Only apply SQL manually if the runner is blocked.

For normal migrations, prefer the runner because it records the migration in
`schema_migrations`. If you manually apply SQL, you also need to carefully mark
the migration as applied with the correct checksum. Avoid this unless the runner
is blocked.

## Rule For Codex

If Codex adds a migration, it must report:

- migration filename
- whether it was deployed
- whether the runner was used
- whether API-backed smoke tests ran against a working API
- if blocked, exactly what was missing

Do not accept proxy warnings as a passed smoke test when database/API behavior
is involved.
