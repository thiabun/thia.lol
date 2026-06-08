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
npm run build
```

The production build is written to `dist/`.

## Deploying to cPanel

1. Run `npm run build`.
2. Open cPanel File Manager or use FTP/SFTP.
3. Upload the contents of `dist/` into `public_html`.
4. Confirm `public_html/.htaccess` exists. It is copied from `public/.htaccess` during the Vite build.
5. Visit:
   - `https://thia.lol/`
   - `https://thia.lol/discover`
   - `https://thia.lol/rooms`
   - `https://thia.lol/@thia`

The `.htaccess` file rewrites client-side routes to `index.html` while leaving `/api` alone for the future PHP backend.

## Backend Skeleton

The `backend/` folder is not required for the static frontend build. It contains a small PHP/MySQL starting point for a future API:

- `backend/api/index.php`
- `backend/api/health.php`
- `backend/config/config.example.php`
- `backend/database/schema.sql`

When the API is implemented, copy or deploy the PHP API files under `public_html/api` and create a private config file outside the web root when your host allows it.
