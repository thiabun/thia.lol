# Contributing to thia.lol

Thanks for helping with `thia.lol`, a public-testing social platform built
around profiles, posts, rooms, follows, moots, reblogs, notifications, badges,
image uploads, and moots-only chat.

The project is early, buggy, and actively changing. Contributions are welcome,
but keep them small, safe, and easy to review.

## Good Ways To Help

Helpful contributions include:

- reproducing and reporting bugs
- improving confusing copy
- fixing mobile layout issues
- adding missing empty states
- improving accessibility labels and keyboard behavior
- polishing UI spacing and component consistency
- writing or improving docs
- adding focused tests
- fixing small frontend or API bugs

If you are new to the project, start with issues labeled `good first issue` or
`help wanted`.

## Before You Start

Read these first:

```text
README.md
AGENTS.md
docs/README.md
```

Important constraints:

- The frontend is Vite + React + TypeScript + Tailwind CSS.
- The production API is Node + TypeScript + MariaDB on a PebbleHost VPS.
- Do not migrate the project to Next.js, Vercel-only hosting, or a new server
  architecture.
- Do not commit secrets, cookies, database credentials, migration tokens, or
  production config.
- Do not use `dangerouslySetInnerHTML` for user content.
- Keep user safety, moderation, CSRF protection, and rate limiting in mind for
  accounts, posts, rooms, chat, uploads, reports, and settings.

## Local Setup

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Start the Node API:

```bash
npm run dev:api
```

Run basic verification:

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

Playwright tests:

```bash
npx playwright install chromium
npm run test:e2e
npm run test:smoke
```

API-backed smoke tests need a working API target. If local `/api` requests fail
because no Node API is running, report the smoke test as blocked instead of
claiming it passed.

## Choosing An Issue

Good starter issues should be small and specific. Examples:

- fix a mobile spacing issue on one page
- add an empty state to one component
- improve copy on one form
- add an accessibility label to one icon button group
- reproduce and document a reported bug

If an issue is vague, ask for scope before starting. If a change touches auth,
sessions, uploads, moderation, reports, privacy, or security, keep the change
minimal and verify the real behavior.

## Pull Request Expectations

Keep pull requests focused. One bug fix or one small improvement per PR is
ideal.

A good PR description includes:

1. What changed.
2. Why it changed.
3. Screenshots or recordings for UI changes.
4. Commands run.
5. Anything blocked or not tested.
6. Any follow-up work needed.

Use this checklist:

```md
## Summary
- 

## Screenshots / recordings

## Testing
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run optimize:assets`
- [ ] `npm run build`
- [ ] `npm run build:api`, if server TypeScript changed
- [ ] `npm run test:api`, if server TypeScript changed
- [ ] Smoke/e2e tests, if relevant

## Notes
- 
```

## Style Guidelines

- Prefer readable code over clever code.
- Keep components small and named clearly.
- Keep UI copy human, short, and specific.
- Avoid generated-sounding filler text.
- Respect the existing visual language unless the issue asks for a redesign.
- Do not introduce large dependencies for tiny problems.
- Do not expose internal implementation details in public UI.

## Reporting Security Or Privacy Issues

Do not open a public issue containing secrets, private messages, session
cookies, tokens, database details, exploit steps that could harm users, or
sensitive user data.

Open a minimal issue that says there is a security/privacy concern and ask for a
private contact path, or contact the maintainer directly if you already have
one.

## Community Expectations

Be useful, honest, and kind. Sharp feedback is fine. Cruelty, harassment, slurs,
outing, doxxing, or creeping on users is not.

This project especially welcomes queer, trans, student, beginner, and
chaotic-but-sincere contributors. Bring care. Leave the ego outside the work.
