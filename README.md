# thia.lol

A static-first social platform frontend for cPanel/Pebblehost hosting.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Motion for React
- React Router
- PHP/MySQL skeleton for a future `/api`

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

Do not upload `src/`, `node_modules/`, `source-assets/`, or `backend/` as part of the static frontend deploy. When the API is ready, deploy it separately under `public_html/api`.

6. Visit:
   - `https://thia.lol/`
   - `https://thia.lol/discover`
   - `https://thia.lol/rooms`
   - `https://thia.lol/@thia`

The `.htaccess` file rewrites client-side routes to `index.html` while leaving `/api` alone for the future PHP backend. It also keeps `index.html` uncached, gives hashed Vite files under `assets/` long immutable caching, and gives top-level image assets a shorter cache window.

Vite preview serves the static bundle directly and does not simulate Apache `.htaccess`, so `/api` rewrite exclusion should be verified on cPanel/Apache or an Apache-equivalent local server.

If the ambient artwork changes, replace `source-assets/ambient-veil.png` and run `npm run build`. The build regenerates `public/ambient-veil.webp` before creating `dist/`.

## Post-Deploy Checklist

- Direct-refresh `/`, `/discover`, `/rooms`, `/@thia`, `/studio`, `/admin`, `/login`, and `/register`.
- Confirm `/api` does not return the React app. Before the backend exists, a `404` is fine; after deployment, `/api/health` should return JSON.
- Confirm `public_html/.htaccess` uploaded; cPanel often hides dotfiles by default.
- Confirm `/index.html` sends `Cache-Control: no-cache, no-store, must-revalidate`.
- Confirm `/assets/index-*.js` and `/assets/index-*.css` send `Cache-Control: public, max-age=31536000, immutable`.
- Confirm `/ambient-veil.webp` loads and no `/ambient-veil.png` request appears in the browser network panel.

## Backend Skeleton

The `backend/` folder is not required for the static frontend build. It contains a small PHP/MySQL starting point for a future API:

- `backend/api/index.php`
- `backend/api/health.php`
- `backend/config/config.example.php`
- `backend/database/schema.sql`

When the API is implemented, copy or deploy the PHP API files under `public_html/api` and create a private config file outside the web root when your host allows it.
