# Thia migration runner guide

> **Status: Operational reference.** Use this when committed SQL migrations need
> to be checked or applied on the live cPanel database. Do not run migrations
> silently, do not commit migration tokens, and do not mark API-backed smoke as
> passed without a working API path.

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

Local development note: committed source migrations live under
`backend/database/migrations/`, but the PHP runner reads the deployed/runtime
copy under `api/migrations/` or `public_html/api/migrations/`. If a local API
returns a storage-readiness error and `api/migrations/` is missing, copy or
otherwise expose the committed SQL files to the runner path before claiming the
local endpoint works. Do not run production migrations from local automation.

## Before running it

Make sure the latest code is deployed.

For a normal feature that changes frontend, API, and migrations, upload:

```text
dist/ contents -> public_html/
api/ contents -> public_html/api/
backend/database/migrations/*.sql -> public_html/api/migrations/
```

For the current issue or deploy, use the migration filenames listed in the
issue, pull request, commit summary, or launch checklist. Recent feature-gating
migrations to check commonly include:

```text
public_html/api/migrations/20260610_0010_add_room_soft_delete.sql
public_html/api/migrations/20260611_0001_add_user_blocks_and_mutes.sql
public_html/api/migrations/20260612_0001_add_profile_modules.sql
public_html/api/migrations/20260613_0001_add_profile_featured_content.sql
public_html/api/migrations/20260615_0001_add_profile_layout_preset.sql
public_html/api/migrations/20260616_0001_add_profile_canvas_layout.sql
public_html/api/migrations/20260616_0002_add_profile_integrations_and_video_backgrounds.sql
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

Look for the relevant migration file or files. For example:

```text
20260610_0010_add_room_soft_delete.sql
20260611_0001_add_user_blocks_and_mutes.sql
20260612_0001_add_profile_modules.sql
20260613_0001_add_profile_featured_content.sql
20260616_0002_add_profile_integrations_and_video_backgrounds.sql
```

If a required migration says `applied: false`, it is pending and ready to run.

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

Run the status command again and confirm every required migration reports
`applied: true`. For example:

```text
20260610_0010_add_room_soft_delete.sql -> applied: true
20260611_0001_add_user_blocks_and_mutes.sql -> applied: true
20260612_0001_add_profile_modules.sql -> applied: true
20260613_0001_add_profile_featured_content.sql -> applied: true
20260616_0002_add_profile_integrations_and_video_backgrounds.sql -> applied: true
```

## Step 5: test the feature

After running migrations, test health first, then test the URLs that match the
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
