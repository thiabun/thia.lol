# cPanel Deployment Automation

This project deploys to Pebblehost/cPanel, where the production web root is `public_html/` and the PHP API lives under `public_html/api/`.

Use this document when changing the deploy pipeline. The goal is to make deploys repeatable, cache-safe, and compatible with shared hosting constraints.

## Deployment goals

A good deploy should:

- Build the Vite frontend.
- Upload the contents of `dist/` directly into `public_html/`.
- Upload API files into `public_html/api/`.
- Upload database migration SQL from `backend/database/migrations/` into `public_html/api/migrations/`.
- Never upload secrets.
- Never overwrite `public_html/config/config.php`.
- Keep `public_html/.htaccess` and `public_html/api/.htaccess` in place.
- Use hashed frontend assets from Vite for cache busting.
- Keep `index.html` uncached or revalidated so new builds are picked up quickly.
- Run verification before uploading.

## Codex git workflow

Codex should sync before deploy-related work and push after committing:

```bash
git pull --rebase
# make changes, verify, commit
git push
```

A pushed commit to `main` is expected to trigger GitHub Actions deployment. If push fails, the change is not deployed and Codex must report the failure.

## Important cPanel constraints

Pebblehost/cPanel may not provide SSH access. Assume deploys must work over FTP/SFTP or cPanel File Manager.

Do not require:

- SSH access.
- Server-side Node builds.
- Composer installs on the server.
- Long-running server processes.
- WebSockets as a required production dependency.

## Expected production layout

```text
public_html/
  .htaccess
  index.html
  ambient-veil.webp
  assets/
    index-[hash].css
    index-[hash].js
  api/
    index.php
    bootstrap.php
    db.php
    auth.php
    read.php
    posts.php
    moderation.php
    migrations.php
    .htaccess
    migrations/
      .htaccess
      20260609_0001_add_post_replies.sql
  config/
    config.php
    .htaccess
```

`public_html/config/config.php` is manually created on the server and must not be overwritten by automation.

## Local Web Disk deployment

GitHub Actions FTP deploy remains the normal automated path, but Web Disk can be used as a faster manual fallback when the cPanel `public_html/` folder is mounted locally. The local Web Disk destination is expected at:

```text
/Volumes/thia.lol/public_html
```

Use Web Disk only after the change is verified locally and committed. It deploys built files directly from this checkout; it does not replace git history, review, or GitHub Actions.

Build and verify first:

```bash
npm run typecheck
npm run lint
npm run optimize:assets
npm run build
```

Dry-run with the default mounted volume:

```bash
npm run deploy:webdisk:dry
```

Deploy with the default mounted volume:

```bash
npm run deploy:webdisk
```

You can still override the destination explicitly when needed:

```bash
npm run deploy:webdisk:dry -- "/Volumes/example/public_html"
npm run deploy:webdisk -- "/Volumes/example/public_html"
THIA_WEB_DISK_PATH="/Volumes/example/public_html" npm run deploy:webdisk:dry
```

The destination must be either the known Web Disk path `/Volumes/thia.lol/public_html` or a folder named `public_html`. Write mode also requires the destination to already exist and be writable.

What the script copies:

- `dist/` contents directly into `public_html/`.
- `api/` contents into `public_html/api/`.
- `backend/database/migrations/*.sql` into `public_html/api/migrations/`.

What the script may clean:

- `public_html/assets/` is removed before copying `dist/assets/`, so old hashed Vite assets do not pile up.
- Root frontend files from `dist/`, such as `index.html`, `.htaccess`, and `ambient-veil.webp`, are copied over the matching files in `public_html/`.

What the script skips or preserves:

- It skips `.env`, `.env.*`, `.DS_Store`, `config.php`, and any `config/` path.
- It never copies `config/config.php` from the repo.
- It does not remove `public_html/config/`, `public_html/uploads/`, or `public_html/storage/`.
- It preserves `public_html/.htaccess` unless `dist/.htaccess` exists, which is the intended frontend `.htaccess`.
- It copies `api/.htaccess` because that file belongs to the committed API deployment.

After a Web Disk deploy, test:

```text
https://thia.lol/
https://thia.lol/api/health
https://thia.lol/api/health?db=1
https://thia.lol/api/auth/me
```

Never commit or deploy production secrets. `public_html/config/config.php` must remain server-only.

## Cache-busting strategy

Vite already emits hashed JS/CSS asset filenames, for example:

```text
assets/index-Cq8a9x.js
assets/index-Bp4z7m.css
```

That means the best cache strategy is:

- `assets/*`: long cache, immutable.
- `index.html`: no-cache or must-revalidate.
- top-level images such as `ambient-veil.webp`: shorter cache unless renamed with a hash.

Do not add manual CSS or JS version query strings unless a non-hashed asset is introduced. Hashed build files are preferred because cache invalidation is handled by the filename.

## Recommended GitHub Actions workflow

If the repository uses GitHub Actions FTP deploy, it should do roughly this:

```yaml
name: Deploy to cPanel

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: cpanel-deploy
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Optimize assets
        run: npm run optimize:assets

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Build frontend
        run: npm run build

      - name: Deploy frontend to public_html
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          local-dir: dist/
          server-dir: public_html/
          dangerous-clean-slate: false
          exclude: |
            **/.git*
            **/.git*/**
            **/node_modules/**

      - name: Deploy API to public_html/api
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          local-dir: api/
          server-dir: public_html/api/
          dangerous-clean-slate: false
          exclude: |
            **/.git*
            **/.git*/**
            **/config.php
```

Secrets required:

```text
FTP_SERVER
FTP_USERNAME
FTP_PASSWORD
```

If Pebblehost requires FTPS or a specific port, configure the deploy action accordingly.

## Why dangerous-clean-slate should usually stay false

The server has files that should survive deploys, especially:

```text
public_html/config/config.php
```

A clean-slate deploy can delete files not present in the upload folder. That is useful for removing old hashed assets, but risky on cPanel unless the remote directories are very carefully separated.

Safer approach:

- Deploy frontend from `dist/` to `public_html/` without clean-slate.
- Deploy API from `api/` to `public_html/api/` without clean-slate.
- Deploy migration SQL from `backend/database/migrations/` to `public_html/api/migrations/` without clean-slate.
- Periodically clean old `public_html/assets/index-*` files manually or with a controlled cleanup task if needed.

## Database migrations

Committed migrations live in:

```text
backend/database/migrations/
```

GitHub Actions deploys that folder to:

```text
public_html/api/migrations/
```

The PHP runner reads from the deployed API path and tracks applied files in `schema_migrations`. Keep migrations forward-only, never commit real migration tokens, and do not deploy the entire `backend/` directory to `public_html/`.

## Version stamping

Use a generated deployment manifest rather than manually stamping asset URLs.

Recommended file:

```text
dist/deploy-meta.json
```

Example contents:

```json
{
  "commit": "abc1234",
  "builtAt": "2026-06-09T12:00:00Z",
  "app": "thia.lol"
}
```

The frontend can optionally expose this in `/admin` so you can confirm what version is live.

## Suggested Codex task: deploy workflow refresh

```text
Read AGENTS.md and docs/deployment-automation.md.
Pull latest changes with git pull --rebase before editing.

Task:
Audit and refresh the cPanel FTP deployment workflow.

Requirements:
1. If `.github/workflows/deploy.yml` or an equivalent workflow exists, update it. If none exists, create one.
2. Deploy frontend `dist/` contents directly to `public_html/`.
3. Deploy API files from `api/` to `public_html/api/`.
4. Never deploy or overwrite `config/config.php`.
5. Run `npm ci`, `npm run optimize:assets`, `npm run typecheck`, `npm run lint`, and `npm run build` before deploy.
6. Add `workflow_dispatch` so deploys can be triggered manually.
7. Add concurrency so two deploys do not run over each other.
8. Generate a `deploy-meta.json` file in `dist/` containing commit SHA and build time.
9. Do not require SSH.
10. Do not change frontend design.
11. Commit verified changes and push with git push so GitHub Actions deploys.

Output:
- Files changed.
- Workflow name and trigger.
- Required GitHub Secrets.
- Exact server directories used.
- Verification commands run.
- Commit SHA and push result.
```

## Suggested Codex task: live deploy indicator

```text
Read AGENTS.md and docs/deployment-automation.md.
Pull latest changes with git pull --rebase before editing.

Task:
Add a lightweight live deploy indicator for admin debugging.

Requirements:
1. The deploy workflow should write `deploy-meta.json` into `dist/`.
2. The frontend should fetch `/deploy-meta.json` from `/admin`.
3. Show commit SHA, builtAt, and environment in a small diagnostics card.
4. If the file is missing, show that deploy metadata is unavailable.
5. Do not expose secrets or server paths.
6. Do not change public product copy.
7. Commit verified changes and push with git push.

Verification:
- npm run typecheck
- npm run lint
- npm run build
```

## Post-deploy checks

After every deploy, test:

```text
https://thia.lol/
https://thia.lol/discover
https://thia.lol/rooms
https://thia.lol/@thia
https://thia.lol/admin
https://thia.lol/api/health
https://thia.lol/api/health?db=1
https://thia.lol/deploy-meta.json
```

If frontend routes work but API routes fail, check `public_html/api/.htaccess` and PHP errors.

If API health works but database health fails, check `public_html/config/config.php`, MySQL credentials, privileges, and PHP extensions.
