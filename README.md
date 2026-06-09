# thia.lol

A static-first social platform frontend for cPanel/Pebblehost hosting.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Motion for React
- React Router
- PHP/MySQL API foundation under `/api`

## Local Development

Use Node 20.19+ or Node 22.12+.

On this machine, Node 22 is available through Homebrew:

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`.

## Verification

```bash
npm run typecheck
npm run lint
npm run optimize:assets
npm run build
```

The production build is written to `dist/`.

## Deploying to cPanel

This app is configured for the domain root with Vite `base: "/"`, so deploy it directly to `public_html` for `https://thia.lol/`.

1. Run `npm run build`.
2. Open cPanel File Manager or use FTP/SFTP.
3. Upload the contents of `dist/` into `public_html`, not the `dist` folder itself.
4. Confirm hidden files are shown and `public_html/.htaccess` exists. It is copied from `public/.htaccess` during the Vite build.
5. Expected frontend upload structure:

```text
public_html/
  .htaccess
  index.html
  ambient-veil.webp
  assets/
    index-*.css
    index-*.js
```

Do not upload `src/`, `node_modules/`, `source-assets/`, or `backend/` as part of the static frontend deploy. Deploy the PHP API separately under `public_html/api`.

6. Visit:
   - `https://thia.lol/`
   - `https://thia.lol/discover`
   - `https://thia.lol/rooms`
   - `https://thia.lol/@thia`

The `.htaccess` file rewrites client-side routes to `index.html` while leaving `/api` alone for the PHP backend. It also keeps `index.html` uncached, gives hashed Vite files under `assets/` long immutable caching, and gives top-level image assets a shorter cache window.

Vite preview serves the static bundle directly and does not simulate Apache `.htaccess`, so `/api` rewrite exclusion should be verified on cPanel/Apache or an Apache-equivalent local server.

If the ambient artwork changes, replace `source-assets/ambient-veil.png` and run `npm run build`. The build regenerates `public/ambient-veil.webp` before creating `dist/`.

## API Setup on cPanel

The PHP API is deployed under `public_html/api` and currently exposes health checks, public content reads, auth endpoints, authenticated post mutations, and protected database migration endpoints.

1. In cPanel, create a MySQL database, create a database user, and grant that user access to the database.
2. Upload the repository `api/` directory to `public_html/api`.
3. Upload `backend/database/migrations/` to `public_html/api/migrations/`.
4. Upload the repository `config/` directory to `public_html/config`, or place a private config directory outside `public_html` if your host allows it.
5. Copy `config/config.example.php` to `config/config.php` on the server.
6. Edit `config/config.php` with the cPanel MySQL host, database name, username, password, a long random `security.csrf_secret`, and a server-only `security.migration_token` when migrations should be enabled.
7. Keep `config/config.php` private. It is gitignored and should not be committed.

If the config is outside the web root, set the `THIA_CONFIG_PATH` environment variable to the absolute path of `config.php`. On Apache/cPanel, that can be set in `api/.htaccess` with a line like:

```apache
SetEnv THIA_CONFIG_PATH /home/cpaneluser/thia-config/config.php
```

Health check URLs:

```text
https://thia.lol/api/health
https://thia.lol/api/health?db=1
```

`/api/health?db=1` runs a prepared `SELECT 1` through PDO to confirm database connectivity. Production responses hide raw exception details when `app.environment` is `production` and `app.debug` is `false`.

Authenticated post endpoints:

```text
POST /api/posts
PATCH /api/posts/{id}
DELETE /api/posts/{id}
POST /api/posts/{id}/like
DELETE /api/posts/{id}/like
```

Post mutation requests require a valid session cookie and the in-memory CSRF token from `/api/auth/me` in the `X-CSRF-Token` header. Deleted posts are soft-deleted with `status='removed'` and `deleted_at` set.

Likes use `POST /api/posts/{id}/like` and `DELETE /api/posts/{id}/like` because the route maps directly to the UI action. The current `post_reactions` table stores legacy reaction rows with `type ENUM('glow','echo','hush')`; likes are stored as `type='glow'` for compatibility with deployed cPanel databases. Like responses keep the standard envelope and return `postId`, `likeCount`, and `likedByCurrentUser`.

## Database Setup on cPanel

The initial MySQL setup lives in `backend/database/`. Import these files with cPanel phpMyAdmin after creating the database and database user.

1. Open cPanel phpMyAdmin and select the thia.lol database in the left sidebar.
2. Import `backend/database/schema.sql` first.
3. Import `backend/database/seed.sql` second.
4. Confirm these tables exist: `users`, `profiles`, `rooms`, `posts`, `post_reactions`, `sessions`, `auth_rate_limits`, `reports`, and `moderation_actions`.
5. Confirm the starter data exists: one Thia profile, four starter rooms, and four starter posts.
6. Confirm `sessions`, `auth_rate_limits`, `reports`, and `moderation_actions` are empty after seeding.

`schema.sql` is for initial empty-database setup only; it is not a migration system for existing production data. `seed.sql` creates starter public content but does not create login credentials or hardcode real passwords.

Committed migrations live in `backend/database/migrations/` and deploy to `public_html/api/migrations/`. They are applied through the protected `/api/admin/migrations/status` and `/api/admin/migrations/run` endpoints, which require an admin session and the `X-Migration-Token` header. Leave `security.migration_token` empty to disable the runner.

## Post-Deploy Checklist

- Direct-refresh `/`, `/discover`, `/rooms`, `/@thia`, `/studio`, `/admin`, `/login`, and `/register`.
- Confirm `/api` does not return the React app and `/api/health` returns JSON.
- Confirm `/api/health?db=1` returns JSON with `"database":{"ok":true}` after `config/config.php` is configured.
- Confirm `backend/database/schema.sql` was imported before `backend/database/seed.sql` in phpMyAdmin.
- Confirm `config/config.php` has a unique `security.csrf_secret` before using auth endpoints.
- Confirm `public_html/.htaccess` uploaded; cPanel often hides dotfiles by default.
- Confirm `public_html/api/.htaccess` uploaded so API routes rewrite to `api/index.php`.
- If `config/` is under `public_html`, confirm `public_html/config/.htaccess` uploaded to deny direct web access.
- Confirm `/index.html` sends `Cache-Control: no-cache, no-store, must-revalidate`.
- Confirm `/assets/index-*.js` and `/assets/index-*.css` send `Cache-Control: public, max-age=31536000, immutable`.
- Confirm `/ambient-veil.webp` loads and no `/ambient-veil.png` request appears in the browser network panel.

## API Foundation

The root-level API files are not required for the frontend build, but they should be deployed to cPanel for API traffic:

- `api/index.php`
- `api/bootstrap.php`
- `api/db.php`
- `api/migrations.php`
- `api/.htaccess`
- `backend/database/migrations/` to `public_html/api/migrations/`
- `config/config.example.php`
- `config/.htaccess`
- `backend/database/schema.sql`
- `backend/database/seed.sql`

`config/config.php` is intentionally absent from git. Create it from `config/config.example.php` in each environment.
