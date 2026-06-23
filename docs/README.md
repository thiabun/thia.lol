# Documentation Index

> **Status: Active docs map.** Start here after `AGENTS.md` when a task needs
> repository context. GitHub Issues are the active tracker; docs are for rules,
> product guardrails, and operations.

Date: 2026-06-23

## Read Order

1. `AGENTS.md`: required operating rules.
2. The GitHub Issue driving the work, if there is one.
3. This index.
4. The relevant docs below.

Do not resurrect old planning docs as task queues. If work remains, put it in a
GitHub Issue with acceptance criteria.

## Product And Design

| Doc | Use For |
| --- | --- |
| `docs/product-ui-ux-guidelines.md` | Product feel, UI density, copy, component expectations, and current implementation guardrails. |
| `docs/brand-guidelines.md` | Logo, favicon, app icon, Open Graph image, and brand usage rules. |
| `docs/profile-customization-safety-rules.md` | Profile modules, media, links, integrations, customization safety, and the current profile-editing surface. |
| `docs/backend-rewrite-roadmap.md` | TypeScript API and PostgreSQL strangler-migration direction. |

## Operations

| Doc | Use For |
| --- | --- |
| `docs/deployment-automation.md` | GitHub Actions SSH deploy workflow, deploy paths, server-only files, and post-deploy checks. |
| `docs/vps-ops.md` | Production VPS paths, SSH, Caddy, PHP-FPM, MariaDB backups, restore, and incidents. |
| `docs/thia-migration-runner-guide.md` | Writing, deploying, checking, and running SQL migrations. |
| `docs/media-uploads.md` | Upload limits, storage paths, deploy preservation, and media troubleshooting. |
| `docs/admin-setup.md` | One-time seeded admin activation and setup-token handling. |
| `docs/auth-session-diagnostics.md` | Production auth/session debugging and safe rotation notes. |

## Current Cross-Cutting Rules

- Production stays VPS-first: Caddy, PHP-FPM, MariaDB, static Vite output, and
  SSH deploys.
- `dist/` contents deploy directly to `/srv/thia.lol/www/`.
- PHP API files deploy to `/srv/thia.lol/www/api/`.
- SQL migrations deploy to `/srv/thia.lol/www/api/migrations/`.
- Real config stays at `/srv/thia.lol/config/config.php`, outside the web root.
- Uploads stay at `/srv/thia.lol/www/uploads/` and must survive deploys.
- No third-party analytics, ads, trackers, payment features, optional cookies,
  public registration expansion, or broad backend migration without an explicit
  issue and product/security review.
- API-backed smoke tests require a working API path. Missing local PHP is a
  blocked smoke test, not a pass.
- Profile module data remains compatibility data unless a future issue defines
  a replacement editor and migration path.

## Removed Planning Artifacts

The repo used to contain several long planning/audit docs for closed issues and
v1/v2 cleanup tracks. Their active rules have been folded into the current docs
above; Git history is the archive.

Removed categories:

- public-readiness planning and issue maps
- broad product roadmap snapshots
- closed performance/API/analytics audits
- block/mute/remove-follower planning notes
- profile personal-space and badge planning notes
- old Codex handoff packets
- duplicate migration-runner implementation brief

If a removed doc had unique current value, reintroduce only that specific rule
inside the relevant current doc. Do not add a new archive folder.
