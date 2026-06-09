# cPanel Deployment Automation

This project deploys to Pebblehost/cPanel, where the production web root is `public_html/` and the PHP API lives under `public_html/api/`.

Use this document when changing the deploy pipeline. The goal is to make deploys boring, repeatable, cache-safe, and compatible with shared hosting constraints. Thrilling stuff, if your hobbies include not breaking production.

## Deployment goals

A good deploy should:

- Build the Vite frontend.
- Upload the contents of `dist/` directly into `public_html/`.
- Upload API files into `public_html/api/`.
- Never upload secrets.
- Never overwrite `public_html/config/config.php`.
- Keep `public_html/.htaccess` and `public_html/api/.htaccess` in place.
- Use hashed frontend assets from Vite for cache busting.
- Keep `index.html` uncached or revalidated so new builds are picked up quickly.
- Run verification before uploading.

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
    .htaccess
  config/
    config.php
    .htaccess
```

`public_html/config/config.php` is manually created on the server and must not be overwritten by automation.

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

Do not add manual CSS or JS version query strings unless a non-hashed asset is introduced. Hashed build files are cleaner than `style.css?v=final-final-please-work`, because civilization has suffered enough.

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
- Periodically clean old `public_html/assets/index-*` files manually or with a controlled cleanup task if needed.

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

The frontend can optionally expose this in `/studio` or `/admin` so you can confirm what version is live without guessing like a medieval peasant reading server smoke.

## Suggested Codex task: deploy workflow refresh

```text
Read AGENTS.md and docs/deployment-automation.md.

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

Output:
- Files changed.
- Workflow name and trigger.
- Required GitHub Secrets.
- Exact server directories used.
- Verification commands run.
```

## Suggested Codex task: live deploy indicator

```text
Read AGENTS.md and docs/deployment-automation.md.

Task:
Add a lightweight live deploy indicator for admin/studio debugging.

Requirements:
1. The deploy workflow should write `deploy-meta.json` into `dist/`.
2. The frontend should fetch `/deploy-meta.json` from `/studio` or `/admin`.
3. Show commit SHA, builtAt, and environment in a small diagnostics card.
4. If the file is missing, show a quiet fallback state.
5. Do not expose secrets or server paths.
6. Do not change public marketing copy.

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
https://thia.lol/api/health
https://thia.lol/api/health?db=1
https://thia.lol/deploy-meta.json
```

If frontend routes work but API routes fail, check `public_html/api/.htaccess` and PHP errors.

If API health works but database health fails, check `public_html/config/config.php`, MySQL credentials, privileges, and PHP extensions.
