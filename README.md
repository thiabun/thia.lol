# thia.lol

`thia.lol` is a small, public-testing social platform built around profiles, posts, rooms, follows, moots, reblogs, notifications, badges, image uploads, and moots-only chat.

The goal is simple: make a fun, personal, slightly chaotic social space that still has the boring-but-important foundations in place: moderation, privacy pages, cookie clarity, copyright notices, and a deployment setup that does not require a whole cloud empire to run.

The live site is here:

```text
https://thia.lol
```

## Public testing

The platform is early and actively changing. Bugs, broken UI, confusing flows, awkward copy, and weird edge cases are expected. Please report them instead of politely suffering in silence like a Victorian ghost.

Useful things to report:

- pages that crash or show blank states
- profile editing bugs
- room creation/editing bugs
- upload problems
- posts, replies, reblogs, likes, or follows behaving strangely
- chat issues
- notification issues
- confusing copy or layout
- mobile layout problems
- anything that exposes technical/dev wording publicly
- anything that feels unsafe, unclear, or too easy to misuse

When reporting a bug, include:

- what page you were on
- what you clicked or submitted
- what you expected to happen
- what actually happened
- browser/device if relevant
- screenshot or screen recording if useful

Do not include passwords, session cookies, migration tokens, database details, or private messages in public bug reports.

## What works right now

Current foundation includes:

- accounts and sessions
- public profiles
- profile editing and image customization
- image uploads converted to WebP
- posts with media
- replies/thread foundations
- likes
- reblogs
- follows, followers, following, and moots
- rooms with creation, editing, joining, owners, and moderators foundation
- notifications
- moots-only chat foundation
- badges and featured badges
- report/moderation foundation
- legal, privacy, cookie, copyright, and community guideline pages

Some of these are still v1 foundations and need public testing before they can be called polished without lying to everyone, which is generally frowned upon.

## What is still being improved

Active v2 work is tracked in GitHub Issues and the project board, not in long
planning docs. Current focus areas include:

- cleaner profile layout
- better room settings and moderation tools
- stronger thread/reply behavior
- easier chat starting from the Chat page
- more compact, less duplicated UI
- better performance and route splitting
- more useful admin/moderation flows
- fewer awkward legacy words and generated-sounding copy
- better smoke tests against real API behavior

Use these docs for current context:

```text
docs/public-readiness-v2-plan.md
docs/product-audit-and-roadmap.md
docs/public-testing-launch-checklist.md
```

The older public-testing readiness spec, roadmap, triage, and audit docs are
historical records from v1 cleanup passes. They remain useful for context, but
GitHub Issues are the active tracker for new v2 work.

## How it works

The app is static-first on the frontend and uses a PHP/MySQL API on cPanel/Pebblehost.

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
- JPEG, PNG, and WebP accepted
- 10 MB max
- converted to WebP
- stored under the deployed server `uploads/` directory

## Contributing and testing

Contributions, bug reports, and careful testing are welcome. Keep changes small, verifiable, and honest about what was tested.

Before changing code, read:

```text
AGENTS.md
docs/public-readiness-v2-plan.md
docs/product-audit-and-roadmap.md
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

API-backed smoke tests require a real API target. If local `/api` proxy requests fail because no PHP API is running, that smoke test is blocked, not passed. Either run a local PHP API with config/database access, or test against a deployed base URL with test credentials.

Example production smoke shape:

```bash
THIA_BASE_URL=https://thia.lol \
THIA_TEST_EMAIL="test@example.com" \
THIA_TEST_PASSWORD="..." \
npm run test:smoke
```

Never commit real credentials, cookies, database passwords, migration tokens, or production config.

## Deployment notes

The live deployment is cPanel/Pebblehost-oriented:

- `dist/` contents go directly into `public_html/`
- `api/` files go into `public_html/api/`
- migrations go into `public_html/api/migrations/`
- `public_html/config/config.php` is server-only and must not be committed
- `public_html/uploads/` must be preserved

The detailed deployment guide lives here:

```text
docs/deployment-automation.md
docs/thia-migration-runner-guide.md
docs/media-uploads.md
```

The README is intentionally not a full recreate-the-platform tutorial. The detailed machinery is in `docs/`, because normal people deserve a front page that does not read like cPanel tax law.

## Safety and legal pages

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

They are practical policy pages for public testing, not a replacement for formal legal review.

## Copyright

© 2026 Thia Markussen. Alle rettigheter forbeholdt / All rights reserved.

Beskyttet etter norsk opphavsrett og internasjonal opphavsrett / Protected under Norwegian and international copyright law.
