# Public Testing Launch Checklist

## Purpose

This is the practical pre-launch and public-testing checklist for `thia.lol`. Use it before opening a wider testing window, after deploys, and when coordinating checks between Thia, Codex, and public testers.

This checklist does not replace the roadmap, readiness spec, deployment docs, migration runner guide, or product triage. It pulls the launch-critical steps into one place.

## Current Launch Position

- Public routes load and the app is static-first on Vite/React with the PHP API under `/api`.
- API health is available through `/api/health`, with database connectivity checked separately through `/api/health?db=1`.
- Public post-read APIs recovered after the Pass 3 SQL regression. The deployed `a22df6e` fix addressed the `/api/posts` SQL aliasing outage.
- Major public-testing cleanup passes are mostly complete: public profile cleanup, thread/reply pass, room v2 foundation, reports v2 for posts, route-level lazy loading, legal pages, uploads, badges, follows/moots, notifications, and moots-only chat foundation are present.
- Authenticated manual testing may still be needed for mutating flows such as profile saves, room edits, uploads, replies, reblogs, reports, chat, badge grants, and deletes.
- Authenticated smoke testing is no longer a planning blocker for docs work. Thia may run manual authenticated testing when needed.
- Remaining known work is tracked in `docs/public-testing-project-triage.md`.

## Pre-Launch Code Checklist

- [ ] Pull latest `main` before making or verifying changes:

  ```bash
  git pull --rebase
  ```

- [ ] Confirm the working tree is clean before deploy verification:

  ```bash
  git status --short
  ```

- [ ] Run verification commands:

  ```bash
  npm run typecheck
  npm run lint
  npm run optimize:assets
  npm run build
  git diff --check
  ```

- [ ] Confirm the latest deploy metadata after deployment:

  ```text
  https://thia.lol/deploy-meta.json
  ```

  Compare the reported commit with the expected deployed commit.

- [ ] Confirm no secrets are staged:

  ```bash
  git diff --cached --name-only
  git diff --cached
  ```

  Do not stage or commit `.env.local`, `config.php`, database credentials, FTP credentials, cookies, sessions, migration tokens, or private server config.

## Deployment Checklist

- [ ] Deploy the contents of `dist/` directly to `public_html/`.
- [ ] Deploy `api/` files to `public_html/api/`.
- [ ] Deploy migration SQL from `backend/database/migrations/` to `public_html/api/migrations/`.
- [ ] Preserve `public_html/config/`.
- [ ] Preserve `public_html/uploads/`.
- [ ] Never overwrite `public_html/config/config.php`.
- [ ] Never enable clean-slate deploy in a way that deletes server-only folders such as `public_html/config/`, `public_html/uploads/`, or server storage folders.
- [ ] Keep frontend `.htaccess` behavior compatible with the `/api` exclusion.
- [ ] Keep `index.html` uncached or revalidated so new builds are picked up quickly.

Expected production shape:

```text
public_html/
  .htaccess
  index.html
  ambient-veil.webp
  assets/
  api/
  config/
  uploads/
```

## Migration Checklist

- [ ] Check migration status through the documented runner in `docs/thia-migration-runner-guide.md`.
- [ ] Confirm whether this migration is present and applied:

  ```text
  20260610_0010_add_room_soft_delete.sql
  ```

- [ ] Do not run migrations silently. Record who ran them, when, what was pending, and what the runner reported.
- [ ] Do not paste the migration token into GitHub, public docs, chat, screenshots, recordings, or bug reports.
- [ ] Prefer the migration runner because it records applied files in `schema_migrations`.
- [ ] Use phpMyAdmin only as a fallback if the runner is blocked.
- [ ] After migrations, retest health and relevant feature paths:

  ```text
  https://thia.lol/api/health
  https://thia.lol/api/health?db=1
  https://thia.lol/rooms
  https://thia.lol/api/rooms
  https://thia.lol/api/rooms/general/posts
  ```

## Public Route Smoke Checklist

Open each route in a clean browser session and confirm it loads without a blank screen, broken shell, or public error details.

- [ ] https://thia.lol/
- [ ] https://thia.lol/discover
- [ ] https://thia.lol/rooms
- [ ] https://thia.lol/@thia
- [ ] https://thia.lol/legal
- [ ] https://thia.lol/terms
- [ ] https://thia.lol/privacy
- [ ] https://thia.lol/cookies
- [ ] https://thia.lol/community-guidelines
- [ ] https://thia.lol/copyright
- [ ] https://thia.lol/moderation

## API Smoke Checklist

Open or request each endpoint and confirm the response is valid JSON or the expected API response. Do not mark API-backed smoke as passed if the API path is unreachable.

- [ ] https://thia.lol/api/health
- [ ] https://thia.lol/api/health?db=1
- [ ] https://thia.lol/api/posts
- [ ] https://thia.lol/api/feed/discover
- [ ] https://thia.lol/api/feed/home
- [ ] https://thia.lol/api/profiles/thia
- [ ] https://thia.lol/api/profiles/thia/posts
- [ ] https://thia.lol/api/profiles/thia/replies
- [ ] https://thia.lol/api/profiles/thia/reblogs
- [ ] https://thia.lol/api/rooms
- [ ] https://thia.lol/api/rooms/general/posts
- [ ] https://thia.lol/api/rooms/updates/posts

## Manual Authenticated Testing Matrix

Use safe, disposable test content for mutating checks. Avoid posting private information, real credentials, sensitive screenshots, or content that would be harmful if left visible until cleanup.

| Area | Manual check | Result | Notes |
| --- | --- | --- | --- |
| Auth | Login works with a test account |  |  |
| Auth | Logout clears the session state |  |  |
| Posts | Create a disposable post |  |  |
| Posts | Delete the disposable post |  |  |
| Posts | Upload an image to a post |  |  |
| Threads | Open a thread by clicking a post body |  |  |
| Replies | Create a reply |  |  |
| Replies | Delete the reply |  |  |
| Replies | Reply to a reply |  |  |
| Replies | Upload an image to a reply |  |  |
| Engagement | Like and unlike a post or reply |  |  |
| Engagement | Reblog and unreblog a post or reply |  |  |
| Reports | Report a disposable post |  |  |
| Reports | Report a disposable reply |  |  |
| Profile | Save profile edits |  |  |
| Profile | Upload avatar image |  |  |
| Profile | Upload banner image |  |  |
| Profile | Save structured Connections |  |  |
| Social graph | Follow and unfollow another test profile |  |  |
| Social graph | Confirm moot state after mutual follow |  |  |
| Rooms | Create a disposable room |  |  |
| Rooms | Edit room metadata and images |  |  |
| Rooms | Join and leave a room |  |  |
| Rooms | Add and remove a room moderator |  |  |
| Rooms | Soft-delete a disposable room if `20260610_0010_add_room_soft_delete.sql` is applied |  |  |
| Notifications | Trigger and view notifications |  |  |
| Chat | Open Chat |  |  |
| Chat | Start chat from a moot profile |  |  |
| Admin | Review reported post/reply in admin reports |  |  |
| Admin | Grant and revoke a badge for a test profile |  |  |

## Public Tester Instructions

Testers should try normal public-testing behavior:

- Browse Home, Discover, Rooms, profiles, legal pages, and public posts.
- Create safe test posts, replies, rooms, follows, likes, reblogs, reports, and uploads if they have an account.
- Try the site on mobile and desktop.
- Check whether copy is confusing, layouts break, buttons fail, uploads error, counts look wrong, or navigation goes somewhere unexpected.
- Use screenshots or screen recordings when they help explain the problem.

Bug reports should include:

- The page or URL where the problem happened.
- What was clicked, typed, submitted, or uploaded.
- What the tester expected to happen.
- What actually happened.
- Browser, device, and screen size if relevant.
- Screenshot or recording if useful.

Public bug reports should not include:

- Passwords.
- Session cookies.
- CSRF tokens.
- Migration tokens.
- Database details.
- Private server config.
- Private messages.
- Other users' non-public personal information.

Report bugs through GitHub Issues when appropriate:

```text
https://github.com/thiabun/thia.lol/issues
```

For sensitive safety, privacy, account, or moderation concerns, avoid posting private details publicly. Use the site's legal/contact path or a private channel with Thia instead.

## Known Limitations

- Chat page still lacks a native moot picker or start-DM flow. Chat can start from a moot profile or direct supported flow, but the Chat page itself lists existing conversations only.
- Broader report targets are still incomplete. Post reporting exists; profile, room, and message reporting need additional product and moderation scope.
- Block, mute, and remove-follower controls are not yet scoped or implemented.
- Notification controls, grouping, pagination, and high-volume controls are deferred.
- The deeper thread root model is deferred. Current thread visibility filtering covers the rendered depth, but unbounded deep reply trees may need a `root_id` or `thread_id` model later.
- Some authenticated flows may still need manual verification against production.
- Legal pages are practical public-testing policy pages, not formal legal review.

## Go / No-Go Decision

Go for public testing if:

- [ ] Public routes load.
- [ ] `/api/health` works.
- [ ] `/api/health?db=1` works.
- [ ] Core post and feed APIs work, including `/api/posts`, `/api/feed/discover`, and `/api/feed/home`.
- [ ] Profile, room, and legal routes load.
- [ ] No secrets, config, cookies, tokens, or private server files are exposed.
- [ ] Deploy metadata is current and matches the expected commit.
- [ ] Known limitations are documented and acceptable for a public-testing window.

No-go if:

- [ ] `/api/health` fails.
- [ ] `/api/health?db=1` fails.
- [ ] `/api/posts` fails.
- [ ] Frontend routes are broken or blank.
- [ ] Migrations are partially applied or checksum-blocked.
- [ ] Uploads are broken for required launch flows.
- [ ] Secrets, config, cookies, tokens, or private server files are exposed.

## After Launch

- Triage incoming GitHub Issues.
- Label issues with the roadmap labels from `docs/public-testing-roadmap.md` and `docs/public-testing-project-triage.md`.
- Prioritize P0/P1 bugs that block loading, posting, profiles, rooms, auth, uploads, safety, moderation, or deploy confidence.
- Keep `docs/public-testing-project-triage.md` updated as launch reality changes.
- Avoid feature creep during public testing. Prefer fixing broken or confusing existing behavior before expanding scope.
