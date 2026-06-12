# Thia migration runner guide

This is the practical version of running database migrations for `thia.lol` without turning phpMyAdmin into a ritual sacrifice.

Use this when Codex adds a new SQL file under `backend/database/migrations/` and you need to apply it on the live cPanel database.

## What the migration runner does

The runner checks SQL files deployed to:

```text
public_html/api/migrations/
```

Then it applies any migration that is not already listed in the database table:

```text
schema_migrations
```

Each migration should run once. If a migration is already applied with the same checksum, it is skipped. If the checksum changed, the runner stops instead of guessing. Good, because databases should not improvise.

## Before running it

Make sure the latest code is deployed.

For a normal feature that changes frontend, API, and migrations, upload:

```text
dist/ contents -> public_html/
api/ contents -> public_html/api/
backend/database/migrations/*.sql -> public_html/api/migrations/
```

For the block/mute/remove-follower foundation, make sure this file exists on the server:

```text
public_html/api/migrations/20260611_0001_add_user_blocks_and_mutes.sql
```

Also make sure the server config has a migration token set in:

```text
public_html/config/config.php
```

The token is server-only. Do not paste it into GitHub, docs, Discord, screenshots, or chat. Future-you deserves fewer disasters.

## Step 1: log in as admin

Open the live site and log in with an admin account:

```text
https://thia.lol/login
```

The runner expects admin access plus the migration token.

## Step 2: check status

Open DevTools on `https://thia.lol`, then run this in the browser console.

Replace `PASTE_TOKEN_HERE` locally in your browser only. Do not save it in the repo.

```js
await fetch('/api/admin/migrations/status', {
  credentials: 'include',
  headers: {
    'X-Migration-Token': 'PASTE_TOKEN_HERE'
  }
}).then(async (response) => ({
  status: response.status,
  body: await response.json().catch(() => null)
}))
```

Look for the new migration:

```text
20260611_0001_add_user_blocks_and_mutes.sql
```

If it says `applied: false`, it is pending and ready to run.

## Step 3: run pending migrations

Run this in the same browser console:

```js
await fetch('/api/admin/migrations/run', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-Migration-Token': 'PASTE_TOKEN_HERE'
  },
  body: JSON.stringify({})
}).then(async (response) => ({
  status: response.status,
  body: await response.json().catch(() => null)
}))
```

A good result should show `ok: true` and list the migration as applied or skipped.

## Step 4: check status again

Run the status command again and confirm:

```text
20260611_0001_add_user_blocks_and_mutes.sql -> applied: true
```

## Step 5: test the feature

After the block/mute/remove-follower migration, test these URLs:

```text
https://thia.lol/api/health
https://thia.lol/api/health?db=1
https://thia.lol/api/profiles/thia
https://thia.lol/api/profiles/thia/followers
https://thia.lol/api/profiles/thia/following
https://thia.lol/api/chat/moots
https://thia.lol/@thia
```

Then test in the UI:

1. Log in.
2. Open another user's profile.
3. Follow them.
4. Refresh the page.
5. Confirm the follow state and counts stay correct.
6. If both users follow each other, confirm the profile shows a moot marker.

## If it fails

### 401 or 403

Usually means one of these:

- you are not logged in as admin
- the migration token is missing
- the migration token is wrong
- cookies were not sent

Try logging in again, then rerun the command from `https://thia.lol` so `credentials: 'include'` sends the session cookie.

### 404

Usually means:

- the migration runner is disabled because the config token is empty
- the API files were not uploaded
- the endpoint path is wrong

Check:

```text
public_html/api/migrations.php
public_html/api/index.php
public_html/config/config.php
```

### 500

Check cPanel errors or `error_log`. Then check:

```text
https://thia.lol/api/health
https://thia.lol/api/health?db=1
```

If database health fails, the config or MySQL connection is the problem, not the migration file.

### Migration checksum mismatch

Do not edit an already-applied migration. Add a new migration instead. If this happens, stop and inspect what changed.

## Safer phpMyAdmin fallback

Only use phpMyAdmin manually if the runner is blocked.

For normal migrations, prefer the runner because it records the migration in `schema_migrations`. If you manually apply SQL, you also need to carefully mark the migration as applied with the correct checksum. That is how humans summon bugs, so avoid it unless necessary.

## Rule for Codex

If Codex adds a migration, it must report:

- migration filename
- whether it was deployed
- whether the runner was used
- whether API-backed smoke tests ran against a working API
- if blocked, exactly what was missing

Do not accept “proxy warning expected” as a passed smoke test when database/API behavior is involved.
