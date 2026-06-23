# thia.lol

`thia.lol` is a small public-testing social platform built around profiles,
posts, rooms, follows, moots, reblogs, notifications, badges, image uploads,
and moots-only chat.

The goal is simple: make a fun, personal, slightly chaotic social space with
the serious foundations in place: moderation, privacy pages, cookie clarity,
copyright notices, and a deploy setup that does not need a whole cloud empire.

Live site:

```text
https://thia.lol
```

## Public Testing

The platform is early and actively changing. Bugs, broken UI, confusing flows,
awkward copy, and edge cases are expected. Please report them.

Useful things to report:

- pages that crash or show blank states
- profile editing bugs
- room creation/editing bugs
- upload problems
- posts, replies, reblogs, likes, or follows behaving strangely
- chat or notification issues
- confusing copy or layout
- mobile layout problems
- anything that exposes technical/dev wording publicly
- anything that feels unsafe, unclear, or too easy to misuse

Do not include passwords, session cookies, migration tokens, database details,
or private messages in public bug reports.

## What Works

Current foundation includes:

- accounts and sessions
- public profiles and profile editing
- profile media customization
- image uploads with safe-original storage
- posts with media
- replies/thread foundations
- likes and reblogs
- follows, followers, following, and moots
- rooms with creation, editing, joining, owners, and moderators
- notifications
- moots-only chat foundation
- badges and featured badges
- reports and moderation foundation
- legal, privacy, cookie, copyright, and community guideline pages

## What Is Still Changing

Active work is tracked in GitHub Issues and the project board, not in sprawling
planning docs.

Current focus areas:

- cleaner profile layout and customization
- stronger room settings and moderation tools
- better thread/reply behavior
- easier chat starting from the Chat page
- more compact, less duplicated UI
- performance and route-splitting polish
- better admin/moderation workflows
- less generated-sounding copy
- honest smoke tests against real API behavior

Current docs:

```text
AGENTS.md
docs/README.md
docs/product-ui-ux-guidelines.md
docs/profile-customization-safety-rules.md
docs/brand-guidelines.md
docs/deployment-automation.md
docs/vps-ops.md
```

## How It Works

The app is static-first on the frontend and currently uses a PHP/MariaDB API on
a PebbleHost VPS. The next backend direction is a gradual TypeScript API and
PostgreSQL rewrite, but production stays on the current PHP API until routes are
moved safely one at a time.

Frontend:

- Vite
- React
- TypeScript
- Tailwind CSS
- Motion for React
- React Router

Backend/API:

- PHP
- MySQL/MariaDB
- PDO prepared statements
- cookie sessions
- CSRF-protected mutations
- SQL migrations through a protected migration runner

Uploads:

- authenticated image uploads only
- JPEG, PNG, WebP, and GIF accepted
- 10 MB image max
- stored as safe originals
- stored under `/srv/thia.lol/www/uploads/` on the VPS

## Contributing And Testing

Keep changes small, verifiable, and honest about what was tested.

Before changing code, read:

```text
AGENTS.md
docs/README.md
```

Basic local commands:

```bash
npm install
npm run dev
```

Verification commands:

```bash
npm run typecheck
npm run lint
npm run optimize:assets
npm run build
```

API TypeScript:

```bash
npm run build:api
npm run test:api
```

PHP syntax checks, when PHP is available:

```bash
find api -name '*.php' -print0 | xargs -0 -n1 php -l
```

Playwright smoke tests:

```bash
npx playwright install chromium
npm run test:e2e
npm run test:smoke
```

API-backed smoke tests require a real API target. If local `/api` proxy requests
fail because no PHP API is running, that smoke test is blocked, not passed.
`npm run test:smoke` uses the committed disposable smoke config in
`tests/test-config.ts` by default. You can override it with environment
variables for another deployed target.

Example production smoke shape:

```bash
THIA_BASE_URL=https://thia.lol \
THIA_TEST_EMAIL="test@example.com" \
THIA_TEST_PASSWORD="..." \
npm run test:smoke
```

Never commit real credentials, cookies, database passwords, migration tokens,
or production config.

## Deployment Notes

Production is VPS-oriented:

- `dist/` contents go directly into `/srv/thia.lol/www/`
- `api/` files go into `/srv/thia.lol/www/api/`
- migrations go into `/srv/thia.lol/www/api/migrations/`
- `/srv/thia.lol/config/config.php` is server-only and must not be committed
- `/srv/thia.lol/www/uploads/` must be preserved
- Caddy, PHP-FPM, MariaDB, SSH deploys, and daily DB backups are part of production

Detailed deployment docs:

```text
docs/deployment-automation.md
docs/vps-ops.md
docs/thia-migration-runner-guide.md
docs/media-uploads.md
docs/backend-rewrite-roadmap.md
```

The README is intentionally not the full operations manual. The machinery lives
in `docs/`.

## Safety And Legal Pages

Public policy pages are available on the live site:

```text
/terms
/privacy
/cookies
/community-guidelines
/copyright
/moderation
/legal
```

They are practical policy pages for public testing, not a replacement for formal
legal review.

## Copyright

© 2026 Thia Markussen. Alle rettigheter forbeholdt / All rights reserved.

Beskyttet etter norsk opphavsrett og internasjonal opphavsrett / Protected under
Norwegian and international copyright law.
