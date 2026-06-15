# Analytics, Revenue, And Ads Plan

> **Status: Planning document for issue [#19](https://github.com/thiabun/thia.lol/issues/19).**
> This document does not authorize analytics scripts, ad scripts, trackers,
> optional cookies, paid features, API changes, SQL migrations, or payment
> integrations.

Date: 2026-06-15

Related context:

- `AGENTS.md`
- `docs/public-readiness-v2-plan.md`
- `docs/product-ui-ux-guidelines.md`
- `docs/profile-personal-space-evolution.md`
- `docs/api-sql-product-maturity-audit.md`
- `docs/deployment-automation.md`
- `src/pages/LegalPage.tsx`

## Purpose

Public Readiness v2 asks `thia.lol` to start thinking about analytics,
revenue, and ads. The product should do that without damaging trust, privacy,
moderation quality, queer/trans user safety, or the clean social-platform
direction.

The current legal pages say the site uses necessary cookies and local
preferences, and does not currently use analytics, advertising, retargeting, or
marketing cookies. That posture should remain true until a future issue updates
policy, consent, settings, implementation, and verification together.

Core rule: revenue and measurement must serve the product. They must not turn
the platform into a tracking surface, pressure loop, ad inventory farm, or
pay-to-be-safe social graph.

## Non-Goals

This planning issue must not add:

- analytics scripts or SDKs
- ad scripts, pixels, beacons, or sponsored-placement code
- trackers or third-party marketing tags
- optional cookies or cookie-consent behavior changes
- paid features, feature gates, boosts, subscriptions, or payment processors
- affiliate links or revenue links
- API endpoints, database migrations, or schema changes
- legal/privacy compliance claims beyond the current documented state

## Product Guardrails

Any future measurement or revenue proposal must pass these rules before code is
approved:

- Minimize data collection before choosing a tool.
- Prefer aggregate operational insight over user-level behavior trails.
- Avoid cross-site tracking, retargeting, identity graphs, fingerprinting, or
  behavioral ad targeting.
- Never expose who viewed a profile, room, post, report, safety page, legal
  page, or queer/trans identity-related content.
- Do not infer, target, segment, or monetize users based on gender identity,
  sexual orientation, health, age, location sensitivity, vulnerability, reports,
  blocks, mutes, or safety actions.
- Keep moderation and safety decisions independent from revenue pressure.
- Keep basic participation useful without payment.
- Keep the interface calm, compact, and product-led rather than campaign-led.
- Document retention, deletion, admin access, consent, and public explanations
  before implementation.

## 1. Analytics Options

### Option Comparison

| Option | Data collected | Cookie impact | Privacy impact | Trust impact | Legal/cookie implications | Complexity | Moderation/product usefulness | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| No analytics | None beyond existing operational logs and security records. | No new cookies. | Best privacy posture; no added behavioral measurement. | Strong trust signal, especially during public testing. | Current policy can remain accurate if logs/security language stays current. | Lowest. | Weak product insight; relies on feedback, manual QA, support reports, and deploy checks. | Recommended for public testing. |
| Server-only aggregate counters | Counts events server-side, such as daily page/profile/room/post views, signups, posts created, reports submitted, active rooms, upload failures, and API errors. No visitor lists. | No new client cookies if implemented from existing authenticated/session or request context without optional identifiers. | Low if stored only as coarse aggregates with short retention and no raw IP/user-agent event trail. | Good if explained as operational/product health, not surveillance. | Privacy policy should describe aggregate metrics and retention. Cookie policy may not need optional-cookie changes if no non-essential cookie is used. | Medium because it needs careful API/schema design and admin reporting. | Useful for product health, abuse spikes, moderation load, and launch readiness. | Recommended first analytics implementation after explicit approval. |
| Privacy-preserving analytics | Page and route metrics through a privacy-focused tool or self-hosted approach, ideally without cookies, personal profiles, or cross-site tracking. | Depends on provider/config. Could be no-cookie, but must be verified. | Low to medium. Safer than conventional analytics, but still adds a measurement vendor/surface. | Acceptable only with clear public explanation and no hidden tracking. | Requires privacy-policy review, cookie-policy review, data-processing/vendor review, retention settings, and consent analysis. | Medium. Vendor setup is easy; responsible review is the work. | Useful for route usage, referrer trends, browser/device health, and performance priorities. | Possible later, not during public testing. Prefer after server aggregates prove insufficient. |
| Opt-in analytics | Collects client-side or account-level analytics only after a user enables it in settings or a consent control. | Optional cookie/local preference likely needed to store consent. | Lower for people who decline, but implementation complexity and edge cases are high. | Can build trust if honest and reversible; can damage trust if nudged or confusing. | Requires consent banner/settings changes, privacy/cookie updates, withdrawal flow, and proof that disabled means disabled. | High. Needs settings UI, consent storage, enforcement, and tests. | Limited usefulness because opt-in data may be biased, but useful for explicit beta feedback. | Defer. Consider only for narrow beta diagnostics or voluntary feedback programs. |
| Admin-only operational metrics | Health, errors, build/deploy metadata, queue sizes, upload failures, moderation queue counts, report counts, migration status, API latency buckets, and feature-readiness booleans. | No new cookies beyond admin session/security cookies. | Low if it avoids user-level behavior and secrets. | Strong if framed as reliability and safety operations. | Privacy policy may already cover logs/security; update if new retained metrics are added. | Medium. Fits existing admin/diagnostics direction. | Very useful for safety, deploys, moderation workload, and API health. | Recommended early, separate from public analytics. |
| Third-party analytics | Client-side vendor scripts can collect routes, referrers, device/browser data, IP-derived location, user identifiers, events, and possibly cross-site profiles depending on vendor. | Often adds optional analytics cookies or local identifiers. | Medium to high. Risks vendor tracking, cross-site correlation, consent mistakes, and data transfer issues. | High trust risk for a small queer/trans-friendly social platform. | Requires privacy/cookie policy updates, consent controls, vendor review, retention settings, DPA/processor review where applicable, and no overclaiming. | Low to install, high to govern safely. | Useful dashboards, but most value can be met with safer approaches first. | Not recommended unless a strict no-cookie, no-cross-site, minimal-retention setup is approved later. |

### Analytics Recommendation

For public testing, use no analytics beyond existing necessary logs, security
records, and manual product feedback. Do not add third-party analytics, pixels,
SDKs, or optional cookies.

For early growth, consider admin-only operational metrics and server-only
aggregate counters. The first useful metrics should answer product and safety
questions without identifying visitors:

- Are key public routes loading?
- Are people successfully signing in and posting?
- Are reports, blocks, mutes, and uploads functioning?
- Are rooms and profiles being used enough to prioritize polish?
- Are API errors, rate limits, or moderation queues rising?

Privacy-preserving external analytics can be reconsidered only after aggregate
server metrics are insufficient and Thia approves a policy/consent/vendor
decision. Conventional third-party analytics should be treated as a last resort.

## 2. Revenue Options

### Option Comparison

| Option | User trust impact | Moderation/safety risks | UX risks | Legal/privacy impact | Technical/API requirements | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Donations | Usually low risk if clearly optional and not tied to reach, safety, or status. | Low. Watch for donation claims that imply special moderation access. | Minimal if it is an external link in a quiet support/legal/about surface. | Donation processor privacy terms apply if external. Policy copy may need to explain outbound processor behavior. | None if it is only a plain outbound link later; no API needed. | Good first revenue option after product approval. |
| Ko-fi or similar support link | Similar to donations, with a recognizable third-party support flow. | Low to medium. Off-platform messages/perks must not bypass moderation promises. | Low if placed tastefully and not in every feed/action surface. | Third-party processor receives user data. Add outbound explanation and policy review before linking. | None for plain link; optional admin config only if link becomes configurable. | Recommended as a cautious early option if revenue is needed. |
| Optional memberships | Can be trusted if benefits are clear, non-essential, and do not create second-class safety. | Medium. Member perks can create entitlement, harassment pressure, or moderation bias. | Risk of clutter, upsells, badge/status confusion, and pressure loops. | Requires terms, privacy, cancellation/refund, payment processor, tax/VAT review, and account data retention decisions. | Payment integration, member status storage, webhook handling, admin tools, support process. | Defer until public testing validates the product. |
| Cosmetic profile upgrades | Potentially acceptable if purely expressive and not deceptive. | Medium. Cosmetics can imitate official, verified, moderator, founder, sponsor, or safety status if not constrained. | Risk of profile clutter, unreadable themes, creator pressure, and pay-to-look-legit status. | Payment and policy updates if sold. Accessibility and moderation rules are required. | Payment/member entitlements, allowlisted cosmetic tokens, admin/moderation visibility, refund handling. | Possible later only for safe, non-status cosmetics after profile customization rules mature. |
| Creator support/tipping | Can support creators, but changes the social contract. | High. Risks coercion, parasocial pressure, scams, adult-content ambiguity, chargebacks, sanctions, and moderation of off-platform rewards. | Risk of turning profiles/posts into fundraising funnels. | Strong payment, tax, privacy, KYC/processor, dispute, and content-policy implications. | Payment processor, creator accounts, payout records, moderation holds, support/refund flows, audit logs. | Defer. Needs separate product/legal/safety planning. |
| Sponsorships | Can be acceptable if rare, transparent, curated, and aligned with the community. | Medium. Sponsor fit matters; unsafe advertisers can damage user safety and trust. | Risk of making product surfaces feel bought or campaign-heavy. | Requires sponsorship disclosure, privacy review, placement policy, and no hidden trackers. | Could start as manual editorial placement with no tracking; later needs admin placement controls if repeated. | Possible later with strict policy and no tracking scripts. |
| Tasteful promoted spaces | A room/profile/project could be promoted in discovery if manually reviewed and clearly labeled. | Medium to high. Paid promotion can amplify unsafe communities, scams, or hostile spaces. | Risk of corrupting discovery, crowding organic spaces, and pressuring creators to pay for reach. | Requires disclosure, rules, review process, and no behavioral targeting. | Admin review workflow, placement records, audit trail, reporting path, maybe invoice/payment records. | Not for public testing. Consider only after moderation capacity is strong. |
| Ads | High trust risk. Ads can conflict with privacy, calm UI, queer/trans safety, and small-community feel. | High. Ad categories, targeting, scams, malware, harassment, and sensitive identity targeting are serious risks. | High. Feed/page ads can make the product feel ad-choked and less safe. | Major policy, consent, cookie, vendor, data transfer, disclosure, and retention implications. | Ad server/vendor, placement controls, consent enforcement, category blocking, reporting, audit, no-script fallback. | Not recommended. Revisit only with explicit ad policy, no behavioral targeting, and strong trust model. |
| Paid verification | Damages trust if verification means identity, safety, or legitimacy can be bought. | High. Impersonation, status abuse, harassment, scams, and moderation pressure. | Risk of confusing official badges with paid cosmetics. | Payment, identity, appeals, fraud, and policy obligations. | Verification system, identity review, payment, revocation, disputes, admin audit. | Discouraged. Do not sell verification. |
| Paid profile boosts | Strongly negative. Converts visibility into a paid pressure loop. | High. Amplifies spam, scams, harassment, and manipulative engagement. | High. Makes discovery less trustworthy and pushes users to pay for basic participation. | Advertising/disclosure and payment implications. | Ranking changes, payment entitlements, abuse controls, audit logs. | Discouraged. Do not sell reach or feed boosts. |

### Revenue Recommendation

The cleanest first revenue path is optional support that does not alter product
ranking, identity, moderation, safety, or access. Donations or a single Ko-fi
style support link can work later if Thia approves the placement, copy, and
privacy explanation.

Memberships and cosmetics are possible later, but only if benefits are
non-essential and do not imitate trust, verification, moderation, founder,
sponsor, or official status. Creator tipping and promoted spaces need separate
planning because they create payment, abuse, tax, disputes, and moderation
work. Ads are not recommended for public testing or early growth.

## 3. What Should Not Be Monetized

The platform should explicitly reject monetizing:

- reporting
- blocking
- muting
- remove-follower controls
- moderation tools
- admin or moderator review priority
- safety controls or safety education
- access to community guidelines, legal, privacy, cookies, copyright, or
  moderation information
- accessibility features
- basic identity fields, profile editing, avatar/banner basics, and normal
  profile controls
- visibility needed for basic participation
- ordinary posting, replying, reblogging, room participation, and reading
- queer/trans safety, identity expression, or community access
- recovery from harassment, spam, impersonation, doxxing, or abuse
- manipulative engagement boosts, paid reach, paid feed ranking, or paid
  discovery priority
- private information, sensitive identity segments, report history, blocks,
  mutes, or safety behavior

Paid features, if ever approved, should be additive and expressive. They must
not decide who is safer, heard, believed, protected, or visible enough to
participate.

## 4. Cookie And Consent Impact

Current state:

- Necessary session/security cookies support accounts, CSRF protection, and
  authenticated features.
- Local preferences may store theme and cookie notice acknowledgement.
- The cookie policy says there are no analytics, advertising, retargeting, or
  marketing cookies.
- This issue does not change cookie behavior.

Any future implementation that adds analytics, ads, sponsorship tracking,
payment processor embeds, third-party widgets, or optional identifiers must
settle the following before code lands:

- Privacy policy updates describing what data is collected, why, who receives
  it, retention, deletion, admin access, processor/vendor role, and user rights.
- Cookie policy updates naming cookie/local-storage categories, purpose,
  duration, provider, whether they are necessary or optional, and how to remove
  or reject them.
- Consent banner changes if non-essential cookies, local identifiers, SDKs, or
  third-party scripts load before consent.
- Settings controls to view, change, or withdraw optional analytics/marketing
  choices.
- User-facing explanations that are concise and not manipulative.
- Data retention decisions for raw events, aggregates, logs, payment records,
  support records, sponsorship placements, and admin audit trails.
- Verification that disabled consent actually prevents optional scripts,
  cookies, local identifiers, and network calls from loading.
- Documentation of data transfers and vendor/subprocessor responsibilities
  where applicable.

Do not claim GDPR, ePrivacy, CCPA/CPRA, DSA, or other compliance beyond what has
actually been reviewed and implemented. Legal copy should stay practical and
honest.

## 5. API/SQL Data Needs

No API or SQL changes should be created from this issue. The following are
future data needs only, and each would require a separate issue, schema/API
design, policy review, and working API smoke tests.

### Server Aggregate Metrics

Possible future server-only aggregate counters:

- daily route/page view counts
- profile view counts as totals only, never visitor identities
- room view and room activity counts
- post view/read counts as totals only, if product value is clear
- post/reply/create/delete/report counts
- follow, block, mute, and remove-follower action counts as aggregate product
  health signals, not user-visible counters
- upload success/failure counts by purpose and error category
- API error, rate-limit, and latency buckets
- moderation queue counts and report category counts

Guardrails:

- Store coarse totals, not per-user behavioral trails.
- Avoid raw IP/user-agent storage in analytics tables.
- Avoid visitor lists, profile-viewer identity, room-reader identity, or
  "who saw what" features.
- Use retention limits and aggregation windows before launch.
- Keep admin access scoped and audited where possible.

### Referrer Categories

If referrer insight is approved, use coarse categories instead of raw URLs where
possible:

- direct/unknown
- same-site internal
- search
- social
- known external platform
- other external

Avoid storing full referrer URLs because they can contain search terms, private
paths, invite codes, usernames, or sensitive off-platform context.

### Admin-Only Operational Metrics

Future admin diagnostics may include:

- `/api/health` and `/api/health?db=1` status, preserving the DB-free default
  health endpoint
- deploy metadata visibility
- schema-readiness booleans for feature tables/columns
- migration status summaries that do not expose secrets
- moderation queue counts
- report aging buckets
- upload/storage error summaries
- API error summaries

These are reliability and safety tools, not public analytics.

### Membership Or Donation Records

If memberships happen later, likely storage needs include:

- user membership status and tier
- payment processor customer/subscription references
- entitlement start/end timestamps
- cancellation and grace-period state
- webhook event audit records
- refund/dispute state
- admin support notes with access controls

If simple donations or Ko-fi links happen as outbound links only, no local
payment storage may be needed. Do not store payment card data.

### Creator Support Or Tipping Records

If creator support/tipping is approved later, likely storage needs include:

- creator eligibility/status
- support/tip records
- payout provider references
- dispute, refund, chargeback, and fraud status
- moderation holds or account restrictions
- tax/KYC processor references where applicable
- audit logs for admin actions

This is a high-risk product area and should not be bundled into profile
customization or analytics work.

### Moderation Audit Implications

Revenue and analytics can distort moderation if they are not separated
carefully. Future implementation should document:

- whether paid users receive no moderation advantage
- how sponsored/promoted content can be reported
- how paid cosmetics are revoked when abusive or deceptive
- whether support/tipping records are visible to moderators, admins, or only
  support/payment operators
- how analytics excludes report, block, mute, legal, privacy, and safety-action
  details from product dashboards unless strictly necessary for safety
- how admin access to metrics is logged or constrained

## 6. Product Recommendation

### Public Testing Phase

- No third-party analytics.
- No ads.
- No paid features.
- No optional cookies.
- Keep current legal/cookie posture true.
- Use feedback, manual QA, GitHub issues, deploy checks, API health, and
  moderation reports to guide priorities.

### Early Growth Phase

- Consider admin-only operational metrics.
- Consider server-only aggregate counters with short retention.
- Consider a quiet donation or Ko-fi style support link only after Thia approves
  placement, copy, and outbound privacy explanation.
- Do not add paid reach, sponsored feeds, ad scripts, or payment-gated safety.

### Later Phase

- Reconsider privacy-preserving analytics only if aggregate metrics are
  insufficient and policy/consent/vendor decisions are clear.
- Consider optional memberships or safe cosmetic profile upgrades only if they
  avoid fake status, ranking advantages, safety gaps, and accessibility harm.
- Consider creator support only after a dedicated payment, moderation, tax,
  dispute, and safety plan.

### Ads

Ads are not recommended. If ever reconsidered, the product needs a strict,
explicit policy before implementation:

- no behavioral targeting
- no sensitive-category targeting
- no retargeting pixels
- no unsafe ad categories
- clear labels
- reportable placements
- admin review
- consent/policy alignment
- performance budgets
- proof that optional scripts do not load without consent

Until that exists, ads should remain out of scope.

## 7. Follow-Up Issues

Do not create these automatically from this planning issue. Suggested future
issues:

- `[P2] Privacy-preserving metrics requirements`
  - Decide exact aggregate metrics, retention, admin access, no-go data, and
    verification requirements before any analytics code.
- `[P2] Donation/support link policy`
  - Decide whether a donation or Ko-fi style support link belongs on the site,
    where it appears, what it says, and how outbound privacy is explained.
- `[P2] Membership and cosmetic profile upgrade product decision`
  - Decide whether memberships or cosmetics fit the product without paid reach,
    fake trust markers, accessibility harm, or safety gaps.
- `[P2] Cookie/privacy policy update checklist`
  - Create the policy, consent, settings, retention, and verification checklist
    required before optional analytics, ads, embeds, or payment integrations.
- `[P2] Admin metrics dashboard scope`
  - Scope operational metrics for health, deploys, moderation queues, uploads,
    and API errors without user-level tracking.
- `[P2] Analytics schema/API plan if approved`
  - Design server-only aggregate storage and admin endpoints after the product
    decision, with no raw behavioral profile tables.
- `[P2] Sponsorship and promoted-space policy`
  - Decide whether sponsorships or promoted spaces can ever fit the product,
    with prohibited categories, disclosure, reporting, and admin review rules.
- `[P3] Creator support/tipping safety and payment plan`
  - Review creator eligibility, payouts, disputes, moderation holds, tax/KYC
    processor requirements, and abuse risks before any implementation.

## Closure Criteria For Issue #19

Issue #19 can be closed when:

- this planning document is committed and pushed
- standard verification passes
- no tracker, ad script, marketing cookie, optional cookie behavior,
  monetization code, API change, or migration was added
- the GitHub issue is updated with the commit SHA and verification status
- all follow-up implementation remains blocked on Thia's product decision
