# thia.lol

`thia.lol` is a small public-testing social platform built around profiles,
posts, rooms, follows, moots, reblogs, notifications, badges, media uploads,
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
- image, video, and audio uploads for supported profile/post surfaces
- posts with media
- replies/thread foundations
- likes and reblogs
- follows, followers, following, and moots
- rooms with creation, editing, joining, owners, and moderators
- notifications and Web Push foundations
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

The app is static-first on the frontend and uses a Node/MariaDB API on a
PebbleHost VPS. Product API traffic is served at same-origin `/api/*`; the old
`/api-next/*` preview path is retired.

Frontend:

- Vite
- React
- TypeScript
- Tailwind CSS
- Motion for React
- React Router

Backend/API:

- Node.js
- Fastify
- TypeScript
- MariaDB
- cookie sessions
- CSRF-protected mutations
- SQL migrations through a protected Node migration runner

Uploads:

- authenticated uploads only
- image, profile video, and profile audio endpoints
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
npm run dev:api
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

Playwright smoke tests:

```bash
npx playwright install chromium
npm run test:e2e
npm run test:smoke
```

API-backed smoke tests require a real API target. Local Vite proxies `/api/*`
to the Node API on `127.0.0.1:3100` and strips the `/api` prefix. If the Node
API is not running or configured, API-backed smoke is blocked, not passed.
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
- Node API build output goes into `/srv/thia.lol/node-api/`
- migrations go into `/srv/thia.lol/migrations/`
- `/srv/thia.lol/config/node-api.env` is server-only and must not be committed
- `/srv/thia.lol/www/uploads/` must be preserved
- Caddy, Node, MariaDB, SSH deploys, and daily DB backups are part of production

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

## Trust Center And Policy Pages

The public Trust Center is available on the live site:

```text
/legal
/terms
/privacy
/cookies
/community-guidelines
/copyright
/moderation
/data-export
/account-deletion
/refunds
/appeals
/safety
/content-ownership
/no-dark-patterns
/monetization-ethics
/ai-policy
/security
/vulnerability-disclosure
/transparency
/law-enforcement
/creator-marketplace
/accessibility
/incident-response
```

They are practical Trust Center and policy pages for public testing, not a
replacement for formal legal review.

## Copyright

Copyright 2026 Thia Markussen. Alle rettigheter forbeholdt / All rights
reserved.

Beskyttet etter norsk opphavsrett og internasjonal opphavsrett / Protected under
Norwegian and international copyright law.
