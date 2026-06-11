# Block, Mute, and Remove Follower Scope

Date: 2026-06-11

## Purpose

`thia.lol` now has the core social graph and interaction surfaces needed for public testing: follows, moots, moots-only chat, reports, public rooms, profile identity, replies, reblogs, and moderation review. That makes basic user control the next safety gap.

Block, mute, and remove-follower controls give members practical ways to reduce unwanted contact before the platform invites broader testing. These controls should be clear, boring, and honest. They should reduce exposure and interaction in the places the product controls, without claiming to be a perfect privacy or security wall for public content.

The first version should be small enough to verify against the current PHP/MySQL API on cPanel, but strong enough that chat, follows, feeds, profile actions, and report context behave consistently.

## Product Definitions

### Block

In v1, blocking another member should mean:

- The blocked user cannot follow the blocker while the block exists.
- Any existing follow relationship between blocker and blocked user is removed in both directions. This also breaks a moot relationship.
- Moots-only chat cannot be started between blocker and blocked user while the block exists.
- Existing direct-message conversations between blocker and blocked user remain retained for report/admin context, but normal send/create actions are disabled between them.
- Profile Message actions are hidden or disabled between blocker and blocked user.
- The blocked user is prevented from interacting with the blocker where practical, including follow, chat creation, replies to the blocker's posts, likes, and reblogs.
- Content by the blocked user is hidden from the blocker where practical in Home, Discover, profile follow panels, chat moot picker, and people recommendations.
- Content by the blocker is hidden from the blocked user where practical in logged-in personalized surfaces and direct interaction affordances.
- Blocking does not pretend to be a perfect privacy or security wall. Public profile pages, public posts, logged-out browsing, screenshots, and already-visible public content cannot be fully protected by a v1 block.

Recommended v1 stance: if either user has blocked the other, direct social actions between the pair should be rejected server-side.

### Mute

In v1, muting another member should mean:

- The muted user's posts, reblogs, and replies are hidden from the muting user's Home and Discover surfaces where practical.
- The muted user is not notified.
- Existing follows are not removed.
- Profile access is not blocked by mute alone.
- The muted user is not prevented from interacting unless moderation or block rules also apply.
- Mute is a personal feed preference, not a moderation action.

Mute should not change public counts or make promises about global visibility. It should only tune what the muting user sees.

### Remove Follower

In v1, removing a follower should mean:

- A logged-in user can remove another member from their follower list.
- The follower relationship from the removed follower to the current user is deleted.
- If the two users were moots, the moot relationship ends because mutual follow no longer exists.
- The removed follower is not blocked and can follow again unless the current user also blocks them.
- The action is quiet. It should not create a notification.

Remove follower should be treated as a relationship edit, not an enforcement action.

## Out of Scope for v1

The following should be explicitly deferred:

- Private accounts.
- Follower approval requests.
- Shadow bans.
- Keyword mutes.
- Room-level bans and mutes unless separately scoped through the room governance track.
- Federated or social graph import/export.
- Full trust-and-safety automation.
- Legal or appeal workflows.
- Message deletion or retention policy beyond the existing report/admin context.
- Group chat, message requests, non-moot chat, attachments, realtime chat, typing indicators, and read receipts.
- User-visible report status.
- Full account privacy controls.

## Data Model Options

### Current Storage Relevant to This Scope

The committed baseline schema already includes:

- `users` with `id`, `handle`, `role`, and `status`.
- `profiles` keyed by `user_id`.
- `user_follows` with primary key `(follower_id, following_id)` and `created_at`.
- Direct chat tables: `conversations`, `conversation_members`, and `messages`.
- `reports` with `target_type` values for `post`, `profile`, `room`, and `message`.
- `moderation_actions` for admin/moderator actions.

Remove follower can use existing `user_follows` storage. Blocking and muting need new tables because they are directional relationships with different semantics from follows.

### Recommended v1 Model

Add two directional tables:

```sql
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id BIGINT UNSIGNED NOT NULL,
  blocked_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id),
  KEY user_blocks_blocked_id_idx (blocked_id),
  KEY user_blocks_created_at_idx (created_at),
  CONSTRAINT user_blocks_blocker_id_fk
    FOREIGN KEY (blocker_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT user_blocks_blocked_id_fk
    FOREIGN KEY (blocked_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_mutes (
  muter_id BIGINT UNSIGNED NOT NULL,
  muted_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (muter_id, muted_id),
  KEY user_mutes_muted_id_idx (muted_id),
  KEY user_mutes_created_at_idx (created_at),
  CONSTRAINT user_mutes_muter_id_fk
    FOREIGN KEY (muter_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT user_mutes_muted_id_fk
    FOREIGN KEY (muted_id) REFERENCES users(id)
    ON DELETE CASCADE
);
```

Do not include reason fields in v1 user-controlled block/mute tables. Reasons create extra sensitivity, retention, privacy, export, and admin-access questions. Reports already capture structured reasons when a user wants moderator review.

Do not put block or mute state directly on `user_follows`. Blocks and mutes can exist without follows and must survive follow deletion.

Do not use `conversation_members.muted_at` for user mute. That field is conversation-specific and should remain available later for muting a chat thread, not a whole user across feeds.

### Indexes and Constraints

Recommended constraints:

- Primary key on the directional pair to make block/mute idempotent.
- Secondary index on `blocked_id` and `muted_id` for reverse lookup.
- `created_at` index for future account/privacy exports, admin diagnostics, or cleanup tooling.
- Foreign keys to `users(id)` with `ON DELETE CASCADE`.

Do not add a database-level self-block/self-mute check for MySQL compatibility. Reject self-targeting in API validation.

### Admin Visibility

Recommended v1:

- Admins/moderators should not get a general "view everyone's blocks and mutes" panel in v1.
- Report/admin context may include limited booleans for the report pair, such as `reporterBlockedReportedUser`, `reportedUserBlockedReporter`, `reporterMutedReportedUser`, and `reportedUserMutedReporter`.
- Do not expose full block or mute lists to admins in v1 unless a specific moderation workflow requires it later.

This keeps private user preferences private while still giving moderators useful context when a user files a report.

### Migration Shape

Likely migration filename:

```text
backend/database/migrations/20260611_0001_add_user_blocks_and_mutes.sql
```

Implementation should:

- Create `user_blocks` and `user_mutes` with `CREATE TABLE IF NOT EXISTS`.
- Add the same tables to `backend/database/schema.sql`.
- Use the migration runner documented in `docs/thia-migration-runner-guide.md`.
- Avoid backfilling any rows.
- Not modify auth/session tables.

If a future implementation needs extra indexes on existing tables for performance, add them in the same idempotent migration only if query plans show they are needed. The pair primary keys should be enough for first-pass `EXISTS` checks.

## API Shape Proposal

Keep the API handle-based and consistent with existing follow routes.

### `POST /api/profiles/:handle/block`

Creates a block from the current user to `:handle`.

- Auth: required.
- CSRF: required.
- Validation:
  - Normalize `:handle` with existing handle normalization.
  - Target must be an active profile.
  - Reject self-targeting with `422`.
  - Return `503` if block storage is not ready.
- Behavior:
  - Insert into `user_blocks` idempotently.
  - Delete both `user_follows` rows between the current user and target:
    - current user follows target.
    - target follows current user.
  - Do not delete messages or reports.
  - Do not create notifications.
- Response shape:

```json
{
  "isBlocked": true,
  "isMuted": false,
  "relationship": {
    "isFollowing": false,
    "isFollowedBy": false,
    "isMoot": false,
    "followerCount": 12,
    "followingCount": 8,
    "mootCount": 3
  }
}
```

Failure states:

- `401` unauthenticated.
- `403` invalid CSRF.
- `404` profile not found.
- `422` self-targeting.
- `503` storage not ready.

### `DELETE /api/profiles/:handle/block`

Removes the current user's block against `:handle`.

- Auth: required.
- CSRF: required.
- Validation:
  - Target must be an active profile.
  - Reject self-targeting with `422`.
  - Return `503` if block storage is not ready.
- Behavior:
  - Delete only the current user's `user_blocks` row.
  - Do not restore follows.
  - Do not create notifications.
- Response shape: same as block create, with `isBlocked: false`.

### `POST /api/profiles/:handle/mute`

Creates a mute from the current user to `:handle`.

- Auth: required.
- CSRF: required.
- Validation:
  - Target must be an active profile.
  - Reject self-targeting with `422`.
  - Return `503` if mute storage is not ready.
- Behavior:
  - Insert into `user_mutes` idempotently.
  - Do not change follows, moots, conversations, reports, or notifications.
  - Do not notify the muted user.
- Response shape:

```json
{
  "isMuted": true,
  "isBlocked": false
}
```

Failure states:

- `401` unauthenticated.
- `403` invalid CSRF.
- `404` profile not found.
- `422` self-targeting.
- `503` storage not ready.

### `DELETE /api/profiles/:handle/mute`

Removes the current user's mute against `:handle`.

- Auth: required.
- CSRF: required.
- Validation:
  - Target must be an active profile.
  - Reject self-targeting with `422`.
  - Return `503` if mute storage is not ready.
- Behavior:
  - Delete only the current user's `user_mutes` row.
  - Do not create notifications.
- Response shape: same as mute create, with `isMuted: false`.

### `DELETE /api/profiles/:handle/follower`

Removes `:handle` from the current user's followers.

- Auth: required.
- CSRF: required.
- Validation:
  - Target must be an active profile.
  - Reject self-targeting with `422`.
  - Return `503` if follow storage is not ready.
- Behavior:
  - Delete from `user_follows` where `follower_id = target_user_id` and `following_id = current_user_id`.
  - Do not delete the current user's follow of the target, if it exists.
  - Do not create notifications.
- Response shape:

```json
{
  "removedFollower": true,
  "relationship": {
    "isFollowing": true,
    "isFollowedBy": false,
    "isMoot": false,
    "followerCount": 11,
    "followingCount": 8,
    "mootCount": 2
  }
}
```

`removedFollower` can be `false` for idempotent success if the target was not following the current user.

### Alternative Route Considered

`DELETE /api/me/followers/:handle` is semantically cleaner for remove follower because the affected follower list belongs to the authenticated user. The current API already groups relationship actions under `/api/profiles/:handle/...`, so `DELETE /api/profiles/:handle/follower` is a better v1 fit unless the profile API is reorganized.

### Follow API Enforcement

`POST /api/profiles/:handle/follow` should reject the follow if either user has blocked the other:

- If current user blocked target: `409` with copy like `Unblock this member before following.`
- If target blocked current user: `403` with generic copy like `You cannot follow this member.`

Do not reveal detailed block state from the target. The current user's own block state can be named directly.

### Chat API Enforcement

`POST /api/chat/conversations` should reject conversation creation if either user has blocked the other, before checking or after checking moot state. Either order is acceptable, but use generic copy for target-blocked-current-user.

`POST /api/chat/conversations/:id/messages` should reject sending if either participant has blocked the other.

`GET /api/chat/moots` should exclude users where either side has blocked the other.

Existing conversation reads may remain allowed for report context, unless a later message retention policy says otherwise.

## Frontend UX Proposal

### Profile Action Menu

Add block, mute, unmute, and unblock to the profile action menu for other members.

Recommended controls:

- `Mute @handle`
- `Unmute @handle`
- `Block @handle`
- `Unblock @handle`
- `Report profile`

Block should require confirmation. Mute can be one-click with undo feedback.

Suggested block confirmation copy:

- Title: `Block @handle?`
- Body: `They will not be able to follow you or start a chat with you. Existing follows between you will be removed. This does not hide public content everywhere.`
- Confirm button: `Block`
- Cancel button: `Cancel`

Suggested unblock copy:

- Title: `Unblock @handle?`
- Body: `This will not restore follows or previous moot status.`
- Confirm button: `Unblock`

Suggested mute toast/copy:

- `Muted @handle. Their posts will be hidden from your feeds where possible.`
- `Unmuted @handle.`

### Follower, Following, and Moot Panels

Add controls in the focused profile panels:

- On own Followers panel:
  - `Remove follower`
  - `Block`
  - `Mute`
- On own Following panel:
  - Existing `Unfollow`
  - `Mute`
  - `Block`
- On Moots panel:
  - `Message`, if not blocked.
  - `Remove follower`, if viewing own profile and the other member follows the current user.
  - `Unfollow`, if current user follows the other member.
  - `Mute`
  - `Block`

Remove follower should require a lightweight confirmation because it changes social graph state:

- Title: `Remove @handle as a follower?`
- Body: `They will stop following you. They can follow you again unless you block them.`
- Confirm button: `Remove follower`

### Chat Header/Menu

Add controls in the selected conversation header:

- `View profile`
- `Report message`, already available per eligible message.
- `Mute profile`
- `Block profile`

When a block exists:

- Hide the composer or disable it.
- Show plain copy: `You cannot send messages in this chat.`
- If the current user created the block, optionally show `Unblock from their profile to message again.`
- Do not reveal if the other user blocked the current user.

### Report Confirmation Surfaces

After a successful profile, post, room, or message report, offer quiet next actions where appropriate:

- `Mute @handle`
- `Block @handle`

Do not make block/mute automatic after reporting. Reporting and personal controls are separate choices.

### Copy Guidelines

Use:

- Plain wording.
- Specific consequences.
- Short confirmations for destructive or relationship-changing actions.
- "where possible" for feed/content hiding.
- "This does not hide public content everywhere" for block.

Avoid:

- Claims that block makes a user invisible.
- Legalistic warnings unless needed.
- "Safety guaranteed", "privacy guaranteed", or "secure".
- Publicly revealing that another user blocked the current user.
- Shame-heavy or punitive copy for mute/remove follower.

## Feed and Chat Behavior Proposal

### Home Feed

For logged-in users:

- Exclude posts authored by users the viewer muted.
- Exclude posts authored by users the viewer blocked.
- Exclude posts authored by users who blocked the viewer where practical.
- Exclude followed-user reblog context from muted or blocked users.
- Exclude reblogged posts if the original author is muted or blocked.

For logged-out users:

- No viewer-specific block/mute filtering is possible.

### Discover Feed

For logged-in users:

- Apply the same author and reblog filtering as Home.
- Exclude muted or blocked users from `peopleToWatch`.
- Exclude users who blocked the viewer from `peopleToWatch` where practical.

For logged-out users:

- Keep current public behavior.

### Profile Pages

Recommended v1 behavior:

- If the viewer has blocked the profile, show the profile shell with blocked-state controls and hide direct social actions until unblocked.
- If the profile owner has blocked the viewer, show a generic limited state or omit direct interaction controls. Do not state "this user blocked you."
- Muted profiles remain accessible.
- The blocked user's posts/replies can be hidden on their profile for the viewer, or shown only after an explicit "View anyway" decision. v1 can choose the simpler hide state first.
- Public logged-out access remains public.

### Followers, Following, and Moot Panels

- Exclude users blocked by the viewer.
- Exclude users who blocked the viewer where practical.
- Show the viewer's own followers/following panels with management controls.
- Keep remove-follower idempotent and quiet.
- Recalculate moot state after block or remove-follower actions.

### Chat Conversation Creation

- Continue requiring moots.
- Add server-side block checks.
- Hide Message actions on profiles when either side has blocked the other.
- Exclude blocked pairs from the Chat page moot picker.

### Existing Conversations

- Do not delete conversations or messages when a block is created.
- Allow existing messages to remain visible for user memory and report/admin context.
- Disable sending if either participant has blocked the other.
- Suppress new message notifications across a blocked pair.

### Notifications

Block:

- Do not create a block notification.
- Do not create follow, moot, like, reblog, reply, or message notifications for blocked-pair interactions that the API rejects.
- Existing old notifications do not need a v1 cleanup pass.

Mute:

- Do not create a mute notification.
- Muting does not suppress direct notifications in v1 unless separately scoped as notification preferences. A muted user can still notify the muting user by interacting unless blocked or moderated.

Remove follower:

- Do not create a remove-follower notification.
- Existing follow/moot notifications do not need a v1 cleanup pass.

### Reports and Admin Context

- Reports should keep working even if the reporter has blocked or muted the reported user.
- Message reports should continue to require conversation membership.
- Admin report rows can include limited block/mute relationship booleans between reporter and reported user.
- Do not expose private block/mute lists in admin v1.

## Moderation and Admin Considerations

### Admin/Moderator Visibility

Recommended v1:

- Admins/moderators can see limited block/mute context only when reviewing a report involving the same two users.
- Admins/moderators do not get browseable block/mute lists.
- Admins/moderators can still suspend users, hide/remove posts, dismiss/review/action reports, and add notes through existing moderation flows.

### Report Context

When a report has both reporter and reported user:

- Include whether the reporter already blocked or muted the reported user.
- Include whether the reported user blocked the reporter, but show this only to admins/moderators.
- Do not include free-text reasons because v1 block/mute rows should not have reason fields.

### What Remains Private

- A user's full block list.
- A user's full mute list.
- The fact that user A blocked user B should not be directly exposed to user B.
- Mute state should be visible only to the muting user and, narrowly, to moderators in report context if needed.

## Implementation Plan

### 1. Data Model and API Foundation

Scope:

- Add `user_blocks` and `user_mutes` migration.
- Update `backend/database/schema.sql`.
- Add storage readiness helpers.
- Extend profile relationship payloads with current user's `isBlocked` and `isMuted`, plus careful handling for "blocked by target" without overexposing it.
- Add block/mute/remove-follower routes.
- Add follow API block enforcement.
- Add unit/source-inspection coverage where existing tests use that pattern.

Acceptance criteria:

- [ ] `POST /api/profiles/:handle/block` creates an idempotent block.
- [ ] Blocking deletes both follow rows between the two users.
- [ ] Blocking self returns `422`.
- [ ] Blocking a missing/inactive profile returns `404`.
- [ ] Block storage missing returns `503`.
- [ ] `DELETE /api/profiles/:handle/block` removes only the current user's block and does not restore follows.
- [ ] `POST /api/profiles/:handle/mute` creates an idempotent mute without changing follows.
- [ ] `DELETE /api/profiles/:handle/mute` removes only the current user's mute.
- [ ] `DELETE /api/profiles/:handle/follower` deletes only the target user's follow of the current user.
- [ ] Follow create is rejected if either side has blocked the other.
- [ ] No block, mute, or remove-follower action creates a notification.
- [ ] API responses do not reveal another user's block state with explicit copy.

### 2. Profile and Follower Panel Controls

Scope:

- Add action menu controls on profile pages.
- Add own-profile follower management controls in followers/following/moots panels.
- Add confirmation dialogs for block and remove follower.
- Add muted/blocked UI states without claiming complete invisibility.
- Add report-success next-action buttons if practical.

Acceptance criteria:

- [ ] Other-member profiles show Mute/Block controls to authenticated users.
- [ ] Own profile does not show self block/mute controls.
- [ ] Block confirmation clearly states follows will be removed and public content is not hidden everywhere.
- [ ] Remove-follower confirmation clearly states the removed follower can follow again unless blocked.
- [ ] Mute succeeds quietly and can be undone.
- [ ] Message action is hidden or disabled when either side has blocked the other.
- [ ] Follower, following, and moot panels refresh relationship state after actions.
- [ ] Copy is plain, non-legalistic, and does not overclaim safety.

### 3. Feed and Chat Enforcement

Scope:

- Centralize block/mute filtering in feed query helpers where practical.
- Filter Home and Discover posts, reblog context, and people recommendations for logged-in viewers.
- Filter chat moot picker results.
- Prevent conversation creation and message sending across blocked pairs.
- Keep existing conversations readable for report context.
- Suppress new blocked-pair message notifications by rejecting sends.

Acceptance criteria:

- [ ] Home hides muted and blocked authors for the logged-in viewer.
- [ ] Discover hides muted and blocked authors for the logged-in viewer.
- [ ] Reblog context does not surface muted or blocked rebloggers.
- [ ] People recommendations exclude muted/blocked users and users who blocked the viewer where practical.
- [ ] Chat moot picker excludes blocked pairs.
- [ ] Creating a chat across a blocked pair fails server-side.
- [ ] Sending a message in an existing blocked-pair conversation fails server-side.
- [ ] Existing messages remain available for report context.
- [ ] Logged-out public feeds keep normal public behavior.

### 4. Tests and Docs Update

Scope:

- Add focused mocked UI tests for profile/follower/chat controls.
- Add PHP/source-inspection tests or API smoke where the existing suite can support them.
- Update README/current planning docs to list block, mute, and remove-follower as implemented once shipped.
- Add migration runner instructions for the new migration.

Acceptance criteria:

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run optimize:assets` passes.
- [ ] `npm run build` passes.
- [ ] `git diff --check` passes.
- [ ] Changed PHP files pass `php -l` when PHP is available.
- [ ] API-backed behavior is verified against a working local PHP API or deployed base URL.
- [ ] If API-backed smoke is blocked, the blocker is documented with exact missing command/config/credentials.
- [ ] Docs list the exact migration filename and migration runner steps.

## Risks and Product Decisions Needed

- Decide whether blocking should hide the blocker's public profile/posts from the blocked user when the blocked user is logged in. Recommendation: hide direct actions and personalized surfaces in v1, but do not promise complete public invisibility.
- Decide whether a viewer who blocked someone can choose "view anyway" on the blocked user's profile. Recommendation: defer "view anyway" unless needed; simpler v1 can show a blocked-state shell.
- Decide exact API copy for "target blocked current user." Recommendation: generic `You cannot do that right now.` or `You cannot interact with this member.`
- Decide whether mute should also suppress notifications. Recommendation: no for v1; notification preferences should be a separate product scope.
- Decide whether block should remove likes/reblogs already created by either party. Recommendation: do not clean up historical interactions in v1; prevent new direct interactions where practical.
- Decide whether block should prevent replies to existing public threads by the blocked user. Recommendation: reject replies where the root or parent author has blocked the replier, and reject replies by users the author has blocked where practical.
- Decide whether admin report context should include both directions of block/mute state. Recommendation: yes, but only as booleans on reports involving the pair.
- Decide whether remove follower should be available from another user's profile when they follow the current user, or only from the current user's follower panel. Recommendation: follower panel first, profile action secondary if the relationship state is already loaded.
- Decide whether blocked users should remain visible in followers/following lists to the profile owner. Recommendation: hide them in public panels, but allow management through a future dedicated settings/privacy page.
- Decide whether block/mute lists need account settings UI in v1. Recommendation: not required for first implementation, but unblock/unmute should be available from the target profile. A settings list can follow if users need recovery from forgotten blocks.

## URLs to Test After Future Deployment

After implementation, test at least:

- `https://thia.lol/@thia`
- `https://thia.lol/chat`
- `https://thia.lol/discover`
- `https://thia.lol/`
- `https://thia.lol/api/health`
- `https://thia.lol/api/health?db=1`
- `https://thia.lol/api/profiles/thia`
- `https://thia.lol/api/feed/home`
- `https://thia.lol/api/feed/discover`
- `https://thia.lol/api/chat/conversations`
- `https://thia.lol/api/chat/moots`
