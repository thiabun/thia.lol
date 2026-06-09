# Migration Runner Brief

Use this file as the canonical Codex prompt for adding safe database migrations to `thia.lol`.

## Goal

Build a small, cPanel-friendly migration runner so schema changes can be deployed as code instead of manually copied into phpMyAdmin every time.

This project has no SSH requirement and no server-side Node/Composer requirement. The runner must work with the existing PHP API and MySQL/MariaDB setup.

## Operating rules for Codex

1. Read `AGENTS.md` first.
2. Run `git pull --rebase` before editing.
3. Keep the change small and reviewable.
4. Do not commit secrets.
5. Do not assume SSH, Composer, or server-side Node.
6. Use PDO through the existing `api/db.php` helpers where possible.
7. Commit verified changes.
8. Push with `git push` so GitHub Actions deploys.
9. Report commit SHA and push result.

## Product requirement

The site needs a safe way to apply schema changes for features like replies/comments, reblogs, room metadata, dynamic stats, and future moderation tables.

Migrations should be plain SQL files committed to the repo, applied exactly once, and tracked in the database.

## Required file structure

Create or use:

```text
backend/database/migrations/
  20260609_0001_example.sql
api/migrations.php
api/index.php
```

Migration filenames must be sortable and stable:

```text
YYYYMMDD_NNNN_short_description.sql
```

Examples:

```text
20260609_0001_add_post_replies.sql
20260609_0002_add_post_reblogs.sql
20260609_0003_add_room_activity_stats.sql
```

## Database tracking table

Add a migration tracking table if it does not exist:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  migration VARCHAR(191) NOT NULL UNIQUE,
  checksum CHAR(64) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Runner behavior

Add a protected endpoint:

```text
POST /api/admin/migrations/run
GET /api/admin/migrations/status
```

Use the existing API response envelope:

```json
{ "ok": true, "data": {} }
```

### `GET /api/admin/migrations/status`

Return:

- migration filename
- checksum
- applied: true/false
- applied_at if applied

### `POST /api/admin/migrations/run`

Apply all pending migrations in filename order.

For each migration:

1. Read SQL file from `backend/database/migrations/` or a deployed copy under the API-safe path chosen by Codex.
2. Calculate SHA-256 checksum of the file contents.
3. Check `schema_migrations`.
4. If already applied with the same checksum, skip.
5. If already applied with a different checksum, stop and return an error. Never silently re-run changed migrations.
6. Run the migration inside a transaction if MySQL supports the statements transactionally.
7. Insert a row into `schema_migrations` after success.
8. Return a summary of applied/skipped migrations.

## Security requirements

Use both protections:

1. Existing authenticated admin session where possible.
2. A server-only migration token from `public_html/config/config.php`.

Expected config shape:

```php
'security' => [
    'migration_token' => 'server-only-token-here',
]
```

The endpoint must require:

```text
X-Migration-Token: <token>
```

Rules:

- If the token is missing or invalid, return 403.
- If the config token is empty, return 404 or disabled response.
- Do not expose the token in frontend code.
- Do not commit real tokens.
- Do not expose raw SQL errors in production responses.

## Deployment requirement

GitHub Actions must deploy migration SQL files to a safe server path.

Recommended target:

```text
public_html/api/migrations/
```

Do not deploy `backend/` wholesale to `public_html/`.

If Codex chooses a different path, document it clearly and keep it outside public frontend assets.

## cPanel constraints

The runner must work by visiting/calling an HTTPS endpoint. Do not require:

- SSH
- cron
- Composer
- shell access
- server-side Node

## Migration authoring rules

Migrations must be forward-only. Do not edit already-applied migration files. Add a new migration instead.

Each migration should be safe to run once and should avoid destructive changes unless explicitly requested.

Prefer additive changes:

- add nullable columns
- add indexes
- add new tables
- backfill carefully

Avoid casual destructive changes:

- dropping tables
- dropping columns
- renaming columns without a fallback
- wiping seed data

## First useful migrations

After the runner exists, use it for comments/replies and reblogs.

### Replies/comments migration target

Add `parent_post_id` to `posts` if missing:

```sql
ALTER TABLE posts
  ADD COLUMN parent_post_id BIGINT UNSIGNED NULL AFTER room_id,
  ADD INDEX posts_parent_post_id_index (parent_post_id),
  ADD CONSTRAINT posts_parent_post_id_fk
    FOREIGN KEY (parent_post_id) REFERENCES posts(id)
    ON DELETE CASCADE;
```

Codex must check existing schema before deciding the exact SQL. If cPanel/MySQL rejects combined `ALTER TABLE`, split it into safe statements.

### Reblogs migration target

Preferred simple table:

```sql
CREATE TABLE IF NOT EXISTS post_reblogs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY post_reblogs_unique (post_id, user_id),
  KEY post_reblogs_user_id_index (user_id),
  CONSTRAINT post_reblogs_post_id_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT post_reblogs_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Verification

Run:

```bash
npm run typecheck
npm run lint
npm run optimize:assets
npm run build
```

If PHP is available locally, run:

```bash
find api -name '*.php' -print0 | xargs -0 -n1 php -l
```

Also test locally or by reasoning if local DB is unavailable.

## Manual production run

After deploy, the migration run should be triggerable with:

```bash
curl --fail-with-body \
  --request POST \
  --url "https://thia.lol/api/admin/migrations/run" \
  --header "Content-Type: application/json" \
  --header "X-Migration-Token: ${THIA_MIGRATION_TOKEN}"
```

Status:

```bash
curl --fail-with-body \
  --url "https://thia.lol/api/admin/migrations/status" \
  --header "X-Migration-Token: ${THIA_MIGRATION_TOKEN}"
```

Do not paste real tokens into docs, commits, or chat.

## Codex implementation task

```text
Read AGENTS.md and docs/migration-runner.md.
Run git pull --rebase before editing.

Task:
Implement the cPanel-friendly migration runner described in docs/migration-runner.md.

Requirements:
1. Add schema_migrations tracking support.
2. Add protected migration status and run endpoints.
3. Require a server-only X-Migration-Token from config.
4. Require admin authentication if feasible with the current auth helpers; if not feasible, keep token protection and document why.
5. Read committed SQL migration files from the deployed API migration path.
6. Apply pending migrations once in filename order.
7. Stop on checksum mismatch.
8. Return clear JSON summaries.
9. Add deploy documentation for migration SQL files.
10. Do not commit secrets.
11. Do not require SSH, Composer, cron, or server-side Node.

Verification:
- npm run typecheck
- npm run lint
- npm run optimize:assets
- npm run build
- PHP syntax checks if PHP is available

Git:
- Commit verified changes.
- Push with git push.
- Report commit SHA and push result.

Output:
- Files changed
- Endpoint summary
- Migration file path chosen
- Verification results
- Production run commands without real tokens
- Risks or manual follow-up
```
