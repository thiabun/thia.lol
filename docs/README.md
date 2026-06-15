# Documentation Index

> **Status: Active docs map.** Start here after `AGENTS.md` when a task needs
> repository documentation context. GitHub Issues are the active implementation
> tracker; docs provide operating rules, product direction, operational
> procedures, and historical background.

Date: 2026-06-15

## Read Order For Future Codex Tasks

1. `AGENTS.md`: required repository operating rules.
2. The GitHub Issue driving the task, including acceptance criteria.
3. This index, to choose the right supporting docs.
4. `docs/public-readiness-v2-plan.md`: Public Readiness v2 orientation and issue map.
5. `docs/product-ui-ux-guidelines.md`: current product UI/UX rules from issue [#14](https://github.com/thiabun/thia.lol/issues/14), with the implemented overhaul tracked in [#32](https://github.com/thiabun/thia.lol/issues/32).
6. Relevant operational references for deploy, migration, upload, smoke, auth, safety, or legal context.

Do not use historical roadmap documents as current task queues. Remaining active
work belongs in GitHub Issues and the project workflow, not scattered roadmap
paragraphs.

## Active Product Direction

| Doc | Use For |
| --- | --- |
| `docs/public-readiness-v2-plan.md` | Public Readiness v2 orientation, issue links, docs classification, and project-board/label guidance. |
| `docs/product-ui-ux-guidelines.md` | Canonical UI/UX rules, component inventory, and future Codex UI checklist. |
| `docs/platform-ui-modernization.md` | Current UI modernization direction and bug-reporting/product-shell guidance. |
| `docs/product-audit-and-roadmap.md` | Product architecture, feature inventory, legal/compliance guardrails, and historical roadmap context. |
| `docs/api-sql-product-maturity-audit.md` | API/SQL readiness audit for Public Readiness v2 issue #20, including future migration/API sequencing and smoke requirements. |
| `docs/profile-personal-space-evolution.md` | Longer-term profile/personal-space product model. |
| `docs/profile-customization-experience.md` | Owner profile editor IA, preview, Connections, and customization experience direction. |
| `docs/profile-customization-safety-rules.md` | Safety guardrails for profile modules, media, links, customization, and future integrations. |
| `docs/profile-badges-plan.md` | Current profile and badge foundation reference. |
| `docs/block-mute-remove-follower-scope.md` | Safety-control behavior, API/data scope, and limitations for block, mute, and remove-follower work. |

## Operational References

| Doc | Use For |
| --- | --- |
| `docs/public-testing-launch-checklist.md` | Deploy, migration, API smoke, manual test, known limitation, and go/no-go checks. |
| `docs/deployment-automation.md` | cPanel/GitHub Actions/Web Disk deployment workflow and server-only file preservation. |
| `docs/thia-migration-runner-guide.md` | Practical live migration runner steps and production migration checks. |
| `docs/migration-runner.md` | Migration runner implementation brief and migration authoring rules. |
| `docs/media-uploads.md` | Image upload limits, conversion, cPanel storage, and deploy preservation. |
| `docs/admin-setup.md` | One-time admin activation procedure and setup-token handling. |
| `docs/auth-session-diagnostics.md` | Production auth/session diagnostics and migration-token protected checks. |
| `docs/codex-handoff.md` | Standard Codex work packet and backend/deploy handoff expectations. |

## Historical / Superseded References

| Doc | Why It Is Historical |
| --- | --- |
| `docs/public-testing-readiness-spec.md` | v1 public-testing cleanup implementation spec; safety and API-smoke rules remain useful. |
| `docs/public-testing-readiness-audit.md` | v1 cleanup audit trail and addenda; current work should be represented as issues. |
| `docs/public-testing-roadmap.md` | v1 public-testing priority list; many entries are implemented or superseded by GitHub Issues. |
| `docs/public-testing-project-triage.md` | v1 transition triage; useful provenance, not the active tracker. |
| `docs/platform-ui-modernization-audit.md` | UI audit snapshot that informed #14/#32 and later UI issues. |
| `docs/thread-experience-redesign.md` | Thread redesign research from the #13 track; current UI rules live in #14/#32 docs and issues. |

## Proposed Archive / Delete Candidates

No files are deleted by this pass. These are candidates to archive or merge only
after any unique operational or product value is copied into active docs or a
GitHub Issue:

| Candidate | Proposed Action | Reason |
| --- | --- | --- |
| `docs/public-testing-readiness-spec.md` | Archive under a future docs/archive path. | v1 implementation scope is complete or superseded; hard rules are preserved in `AGENTS.md`, launch checklist, and operational docs. |
| `docs/public-testing-readiness-audit.md` | Archive after deferred findings are represented in issues. | Completed audit report with useful provenance but stale live-verification framing. |
| `docs/public-testing-roadmap.md` | Archive after confirming no unique checklist text remains. | Active priorities now live in GitHub Issues and `docs/public-readiness-v2-plan.md`. |
| `docs/public-testing-project-triage.md` | Archive after any still-useful manual cards become issues or checklist items. | Transition triage recommendations are mostly implemented, superseded, or moved to operational docs. |
| `docs/thread-experience-redesign.md` | Merge unique thread UX details into `docs/product-ui-ux-guidelines.md` or issue follow-ups, then archive. | The #13 implementation track is closed; the doc is research/provenance, not active planning. |
| `docs/platform-ui-modernization-audit.md` | Archive after remaining findings are closed or represented as issues. | Snapshot audit that informed #14/#32 and follow-up UI issues. |
| `docs/migration-runner.md` | Merge with `docs/thia-migration-runner-guide.md` if they drift. | It overlaps with the practical live guide but still has useful migration authoring rules. |
