# Codex Handoff Workflow

Use this document to coordinate work between planning/review and Codex implementation.

## Operating model

Codex should be treated as the implementation worker, not the architect of the entire platform.

For each task, Codex should:

1. Read `AGENTS.md` first.
2. Read this handoff document if the task involves backend, deployment, or architecture.
3. Run `git pull --rebase` before editing so the local branch is current.
4. Make the smallest safe change that satisfies the task.
5. Run verification commands.
6. Commit the verified change.
7. Run `git push` after committing so GitHub Actions can deploy.
8. Return a clear implementation summary with the commit SHA and push result.

If pull, commit, or push fails, Codex should stop and report the exact error instead of leaving unpushed local changes.

## Standard task packet

Use this shape when giving Codex work:

```text
Context:
- thia.lol is hosted on Pebblehost/cPanel.
- Frontend is Vite/React static deployed to public_html/.
- PHP API is deployed to public_html/api/.
- Config is created manually on the server at public_html/config/config.php.
- Read AGENTS.md before changing files.
- Pull latest changes with git pull --rebase before editing.

Problem:
<what is wrong or what needs to be built>

Task:
<precise implementation request>

Constraints:
- Do not change frontend design unless required.
- Do not change deployment architecture.
- Do not commit secrets.
- Keep changes small and verifiable.

Verification:
Run:
- npm run typecheck
- npm run lint
- npm run optimize:assets
- npm run build

Git:
- Commit the verified changes.
- Push the commit with git push so GitHub Actions deploys it.
- If pull or push fails, report the error.

Output:
- Files changed.
- Commands run and results.
- Commit SHA.
- Whether git push succeeded.
- Exact files/folders to upload to cPanel if manual upload is needed.
- Exact URLs to test.
```

## Current urgent backend issue: cPanel 500

If the deployed API returns a generic 500 Internal Server Error, use this task packet.

```text
Context:
- thia.lol is hosted on Pebblehost/cPanel.
- Frontend is deployed to public_html/.
- API is deployed to public_html/api/.
- Config is intended at public_html/config/config.php.
- The deployed API currently returns a generic 500 Internal Server Error.
- Read AGENTS.md first.
- Pull latest changes with git pull --rebase before editing.

Problem:
The API needs safer cPanel diagnostics and should not depend on SetEnv/THIA_CONFIG_PATH for basic deployment.

Task:
Harden API bootstrap/config loading and add deployment diagnostics.

Requirements:
1. Keep /api/health able to respond without database access.
2. Keep /api/health?db=1 as the database connectivity check.
3. Do not require SetEnv for normal cPanel deployment.
4. Make config loading try safe fallback paths, including public_html/config/config.php when deployed under public_html/api/.
5. Ensure api/.htaccess contains only broadly compatible rewrite rules.
6. Ensure config/.htaccess denies direct web access.
7. Add README troubleshooting for cPanel 500 errors, including:
   - check cPanel Errors page and error_log files
   - remove SetEnv if Apache rejects it
   - verify PHP 8.2+ and pdo_mysql
   - verify config.php syntax and location
   - verify database credentials and user privileges
   - verify file/folder permissions
8. Hide raw exception details in production responses.
9. Do not change frontend design.

Verification:
Run available checks locally:
- npm run typecheck
- npm run lint
- npm run optimize:assets
- npm run build
If PHP is available, run PHP syntax checks on api/*.php and config/*.php. If PHP is not available, say that clearly.

Git:
- Commit verified changes.
- Push with git push.
- Report commit SHA and push result.

Output:
- Files changed.
- What to upload to public_html/api and public_html/config.
- URLs to test:
  - https://thia.lol/api/health
  - https://thia.lol/api/health?db=1
```

## Backend build sequence

Do backend work in this order:

1. API health and config loading.
2. Database schema import and seed data.
3. Read-only endpoints:
   - GET /api/profiles/{handle}
   - GET /api/rooms
   - GET /api/posts
   - GET /api/rooms/{slug}/posts
4. Frontend read integration with mock fallback.
5. Auth backend.
6. Frontend auth integration.
7. Authenticated post mutations.
8. Reactions.
9. Reports and moderation.
10. Media uploads.

Do not skip directly to public registration without moderation and rate limiting.

## Post-deploy test order

After uploading backend changes, test in this order:

```text
https://thia.lol/api/health
https://thia.lol/api/health?db=1
https://thia.lol/api/profiles/thia
https://thia.lol/api/rooms
https://thia.lol/api/posts
```

If `/api/health` fails, do not debug the database yet. Fix PHP, `.htaccess`, config loading, or server compatibility first.

If `/api/health` works but `/api/health?db=1` fails, debug database credentials, PHP extensions, schema import, and user privileges.

## Implementation summary template

Codex should finish every task with:

```text
Implemented:
- ...

Changed files:
- path: reason

Verification:
- npm run typecheck: pass/fail
- npm run lint: pass/fail
- npm run optimize:assets: pass/fail
- npm run build: pass/fail
- PHP syntax checks: pass/fail/not available

Git:
- git pull --rebase: pass/fail
- commit: <sha>
- git push: pass/fail

Deploy:
- Upload ... to ... if manual upload is needed

Test:
- URL 1
- URL 2

Notes/Risks:
- ...
```
