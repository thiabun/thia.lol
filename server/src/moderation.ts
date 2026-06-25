import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { type RoomPayload, type RoomRow, roomPayloadFromRow } from "./rooms.js";
import type { RequestSession } from "./sessions.js";

export class ModerationRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ModerationRouteError";
  }
}

export interface ModerationUserPayload {
  id: number;
  handle: string;
  displayName: string;
  role: string;
  status: string;
}

export interface ModerationReportPayload {
  id: number;
  targetType: string;
  targetId: number | null;
  category: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
  actionTaken: string | null;
  moderatorNote: string | null;
  reporter: ModerationUserPayload | null;
  reportedUser: ModerationUserPayload | null;
  reviewedBy: ModerationUserPayload | null;
  post: {
    id: number;
    body: string;
    status: string;
    visibility: string;
    createdAt: string | null;
    author: ModerationUserPayload | null;
  } | null;
  profile: ModerationUserPayload | null;
  room: {
    id: number;
    slug: string;
    name: string;
    summary: string;
    visibility: string;
    live: boolean;
    owner: ModerationUserPayload | null;
  } | null;
  message: {
    id: number;
    conversationId: number;
    body: string;
    deletedAt: string | null;
    createdAt: string | null;
    sender: ModerationUserPayload | null;
  } | null;
  actionCount: number;
}

export interface ModerationRepository {
  createReport(session: RequestSession, body: Record<string, unknown>): Promise<ModerationReportPayload>;
  listAdminReports(session: RequestSession): Promise<ModerationReportPayload[]>;
  listAdminRooms(session: RequestSession): Promise<RoomPayload[]>;
  hidePost(session: RequestSession, postId: number, body: Record<string, unknown>): Promise<{ id: number; status: "hidden" }>;
  removePost(session: RequestSession, postId: number, body: Record<string, unknown>): Promise<{ id: number; status: "removed" }>;
  suspendUser(session: RequestSession, userId: number, body: Record<string, unknown>): Promise<ModerationUserPayload>;
  resolveReport(session: RequestSession, reportId: number, body: Record<string, unknown>): Promise<ModerationReportPayload>;
}

interface CountRow extends RowDataPacket {
  value: number | string;
}

interface PostRecordRow extends RowDataPacket {
  id: number | string;
  author_id: number | string;
  visibility: string | null;
  status: string | null;
  deleted_at: string | null;
}

interface UserRecordRow extends RowDataPacket {
  target_user_id: number | string;
  target_handle: string | null;
  target_email: string | null;
  target_role: string | null;
  target_status: string | null;
  target_display_name: string | null;
  target_avatar_url: string | null;
}

interface RoomRecordRow extends RowDataPacket {
  room_id: number | string;
  room_created_by: number | string | null;
}

interface MessageRecordRow extends RowDataPacket {
  message_id: number | string;
  message_sender_id: number | string;
  message_deleted_at: string | null;
}

interface ReportRecordRow extends RowDataPacket {
  id: number | string;
  target_type: string | null;
  target_id: number | string | null;
  reported_user_id: number | string | null;
  post_id: number | string | null;
}

interface ReportRow extends RowDataPacket {
  report_id: number | string;
  report_target_type: string | null;
  report_target_id: number | string | null;
  report_category: string | null;
  report_details: string | null;
  report_status: string | null;
  report_created_at: string | null;
  report_updated_at: string | null;
  report_reviewed_at: string | null;
  report_action_taken: string | null;
  report_moderator_note: string | null;
  reporter_user_id: number | string | null;
  reporter_handle: string | null;
  reporter_role: string | null;
  reporter_status: string | null;
  reporter_display_name: string | null;
  reported_user_id: number | string | null;
  reported_handle: string | null;
  reported_role: string | null;
  reported_status: string | null;
  reported_display_name: string | null;
  reviewer_user_id: number | string | null;
  reviewer_handle: string | null;
  reviewer_role: string | null;
  reviewer_status: string | null;
  reviewer_display_name: string | null;
  post_id: number | string | null;
  post_body: string | null;
  post_status: string | null;
  post_visibility: string | null;
  post_created_at: string | null;
  post_author_user_id: number | string | null;
  post_author_handle: string | null;
  post_author_role: string | null;
  post_author_status: string | null;
  post_author_display_name: string | null;
  profile_user_id: number | string | null;
  profile_handle: string | null;
  profile_role: string | null;
  profile_status: string | null;
  profile_display_name: string | null;
  room_id: number | string | null;
  room_slug: string | null;
  room_name: string | null;
  room_summary: string | null;
  room_visibility: string | null;
  room_is_live: number | string | boolean | null;
  room_owner_user_id: number | string | null;
  room_owner_handle: string | null;
  room_owner_role: string | null;
  room_owner_status: string | null;
  room_owner_display_name: string | null;
  message_id: number | string | null;
  message_conversation_id: number | string | null;
  message_body: string | null;
  message_deleted_at: string | null;
  message_created_at: string | null;
  message_sender_user_id: number | string | null;
  message_sender_handle: string | null;
  message_sender_role: string | null;
  message_sender_status: string | null;
  message_sender_display_name: string | null;
  action_count: number | string | null;
}

export function createModerationRepository(pool: Pool): ModerationRepository {
  return new MariaDbModerationRepository(pool);
}

class MariaDbModerationRepository implements ModerationRepository {
  constructor(private readonly pool: Pool) {}

  async createReport(session: RequestSession, body: Record<string, unknown>): Promise<ModerationReportPayload> {
    const category = reportCategory(body.category ?? body.reason);
    const details = optionalText(body.details, 2000, "Report details");
    let targetType = targetTypeValue(body.targetType ?? body.target_type);
    let targetId = optionalId(body.targetId ?? body.target_id, "Target id");
    let postId = optionalId(body.postId ?? body.post_id, "Post id");
    let reportedUserId = optionalId(body.reportedUserId ?? body.reported_user_id, "Reported user id");

    if (targetType === null && postId !== null) {
      targetType = "post";
    }

    if (targetType === null && reportedUserId !== null) {
      targetType = "profile";
    }

    if (targetType === null) {
      throw new ModerationRouteError("Report target is required.", 422);
    }

    if (targetType === "post") {
      postId ??= targetId;

      if (postId === null) {
        throw new ModerationRouteError("Post id is required.", 422);
      }

      const post = await this.postRecord(postId);

      if (post === null || post.deleted_at !== null || stringValue(post.visibility) !== "public") {
        throw new ModerationRouteError("Post not found.", 404);
      }

      reportedUserId = numberValue(post.author_id);
      targetId = postId;
    } else if (targetType === "profile") {
      targetId ??= reportedUserId;

      if (targetId === null) {
        throw new ModerationRouteError("Profile id is required.", 422);
      }

      reportedUserId = targetId;

      if (reportedUserId === session.userId) {
        throw new ModerationRouteError("You cannot report your own profile.", 422);
      }

      if ((await this.userRecord(reportedUserId, true)) === null) {
        throw new ModerationRouteError("Profile not found.", 404);
      }
    } else if (targetType === "room") {
      if (targetId === null) {
        throw new ModerationRouteError("Room id is required.", 422);
      }

      const room = await this.roomRecord(targetId);

      if (room === null) {
        throw new ModerationRouteError("Room not found.", 404);
      }

      reportedUserId = nullableNumberValue(room.room_created_by);

      if (reportedUserId === session.userId) {
        throw new ModerationRouteError("You cannot report your own room.", 422);
      }
    } else if (targetType === "message") {
      if (targetId === null) {
        throw new ModerationRouteError("Message id is required.", 422);
      }

      const message = await this.messageRecord(targetId, session.userId);

      if (message === null || message.message_deleted_at !== null) {
        throw new ModerationRouteError("Message not found.", 404);
      }

      reportedUserId = numberValue(message.message_sender_id);

      if (reportedUserId === session.userId) {
        throw new ModerationRouteError("You cannot report your own message.", 422);
      }
    } else if (reportedUserId !== null && (await this.userRecord(reportedUserId, false)) === null) {
      throw new ModerationRouteError("Reported profile not found.", 404);
    }

    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO reports (target_type, target_id, reporter_id, reported_user_id, post_id, category, details, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
      [targetType, targetId, session.userId, reportedUserId, postId, category, details],
    );

    return this.reportById(result.insertId);
  }

  async listAdminReports(session: RequestSession): Promise<ModerationReportPayload[]> {
    requireModeratorSession(session);
    const [rows] = await this.pool.execute<ReportRow[]>(
      `${reportSelectSql()}
       ORDER BY FIELD(rep.status, 'open', 'reviewed', 'actioned', 'dismissed'), rep.created_at DESC
       LIMIT 100`,
    );

    return rows.map(reportPayloadFromRow);
  }

  async listAdminRooms(session: RequestSession): Promise<RoomPayload[]> {
    requireModeratorSession(session);
    const deletedSelect = await this.hasColumn("rooms", "deleted_at") ? "rooms.deleted_at IS NULL OR rooms.deleted_at IS NOT NULL" : "1 = 1";
    const [rows] = await this.pool.execute<RoomRow[]>(
      `SELECT
          rooms.id AS room_id,
          rooms.slug AS room_slug,
          rooms.name AS room_name,
          rooms.summary AS room_summary,
          rooms.mood AS room_mood,
          COALESCE(membership_counts.member_count, rooms.member_count, 0) AS room_member_count,
          rooms.is_live AS room_is_live,
          rooms.accent AS room_accent,
          rooms.icon_url AS room_icon_url,
          rooms.banner_url AS room_banner_url,
          rooms.rules AS room_rules,
          rooms.visibility AS room_visibility,
          rooms.created_by AS room_created_by,
          NULL AS current_room_role,
          0 AS current_room_joined,
          1 AS current_viewer_signed_in,
          1 AS current_viewer_is_admin,
          NULL AS current_room_access_request_status,
          owner.id AS owner_user_id,
          owner.handle AS owner_handle,
          owner_profile.display_name AS owner_display_name,
          owner_profile.avatar_url AS owner_avatar_url,
          NULL AS room_pending_access_request_count,
          COALESCE(room_posts.post_count, 0) AS room_post_count,
          room_posts.latest_activity_at AS room_latest_activity_at,
          rooms.created_at AS room_created_at,
          rooms.updated_at AS room_updated_at
       FROM rooms
       LEFT JOIN users owner ON owner.id = rooms.created_by
       LEFT JOIN profiles owner_profile ON owner_profile.user_id = owner.id
       LEFT JOIN (
          SELECT room_id, COUNT(*) AS member_count
          FROM room_memberships
          WHERE banned_at IS NULL
          GROUP BY room_id
       ) membership_counts ON membership_counts.room_id = rooms.id
       LEFT JOIN (
          SELECT room_id, SUM(parent_id IS NULL) AS post_count, MAX(created_at) AS latest_activity_at
          FROM posts
          WHERE room_id IS NOT NULL
            AND visibility = 'public'
            AND status = 'published'
            AND deleted_at IS NULL
          GROUP BY room_id
       ) room_posts ON room_posts.room_id = rooms.id
       WHERE ${deletedSelect}
       ORDER BY rooms.visibility ASC, room_posts.latest_activity_at DESC, rooms.name ASC
       LIMIT 200`,
    );

    return rows.map(roomPayloadFromRow);
  }

  async hidePost(session: RequestSession, postId: number, body: Record<string, unknown>): Promise<{ id: number; status: "hidden" }> {
    return this.moderatePost(session, postId, body, "hide_post", "hidden");
  }

  async removePost(session: RequestSession, postId: number, body: Record<string, unknown>): Promise<{ id: number; status: "removed" }> {
    return this.moderatePost(session, postId, body, "remove_post", "removed");
  }

  async suspendUser(session: RequestSession, userId: number, body: Record<string, unknown>): Promise<ModerationUserPayload> {
    requireModeratorSession(session);

    if (session.userId === userId) {
      throw new ModerationRouteError("You cannot suspend your own account.", 422);
    }

    const user = await this.userRecord(userId, false);

    if (user === null) {
      throw new ModerationRouteError("User not found.", 404);
    }

    if (stringValue(user.target_role) === "admin" && session.role !== "admin") {
      throw new ModerationRouteError("Only admins can suspend admin accounts.", 403);
    }

    const reportId = optionalId(body.reportId ?? body.report_id, "Report id");
    const notes = optionalText(body.notes, 2000, "Moderation notes");

    if (reportId !== null && !(await this.reportExists(reportId))) {
      throw new ModerationRouteError("Report not found.", 404);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE users
       SET status = 'suspended',
           updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      [userId],
    );
    await this.pool.execute<ResultSetHeader>(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
    await this.logAction(session, "suspend_user", reportId, userId, null, notes);

    if (reportId !== null) {
      await this.markReportActioned(reportId, session, "suspend_user", notes);
    }

    const updated = await this.userRecord(userId, false);

    if (updated === null) {
      throw new ModerationRouteError("User not found.", 404);
    }

    return moderationUserPayloadFromRecord(updated);
  }

  async resolveReport(session: RequestSession, reportId: number, body: Record<string, unknown>): Promise<ModerationReportPayload> {
    requireModeratorSession(session);

    if (!(await this.reportExists(reportId))) {
      throw new ModerationRouteError("Report not found.", 404);
    }

    const status = reportResolutionStatus(body.status);
    const notes = optionalText(body.notes, 2000, "Resolution notes");
    const actionTaken = optionalText(body.actionTaken ?? body.action_taken ?? (status === "dismissed" ? "dismiss_report" : "mark_reviewed"), 120, "Action taken")
      ?? (status === "dismissed" ? "dismiss_report" : "mark_reviewed");

    await this.pool.execute<ResultSetHeader>(
      `UPDATE reports
       SET status = ?,
           reviewed_by = ?,
           reviewed_at = CURRENT_TIMESTAMP(),
           action_taken = ?,
           moderator_note = ?
       WHERE id = ?`,
      [status, session.userId, actionTaken, notes, reportId],
    );

    const report = await this.reportRecord(reportId);
    await this.logAction(
      session,
      status === "dismissed" ? "dismiss_report" : "note",
      reportId,
      nullableNumberValue(report.reported_user_id),
      nullableNumberValue(report.post_id),
      notes ?? (status === "dismissed" ? "Report dismissed." : "Report reviewed."),
    );

    return this.reportById(reportId);
  }

  private async moderatePost<TStatus extends "hidden" | "removed">(
    session: RequestSession,
    postId: number,
    body: Record<string, unknown>,
    action: "hide_post" | "remove_post",
    status: TStatus,
  ): Promise<{ id: number; status: TStatus }> {
    requireModeratorSession(session);
    const post = await this.postRecord(postId);

    if (post === null) {
      throw new ModerationRouteError("Post not found.", 404);
    }

    const reportId = optionalId(body.reportId ?? body.report_id, "Report id");
    const notes = optionalText(body.notes, 2000, "Moderation notes");

    if (reportId !== null && !(await this.reportExists(reportId))) {
      throw new ModerationRouteError("Report not found.", 404);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE posts
       SET status = ?,
           deleted_at = ${status === "removed" ? "CURRENT_TIMESTAMP()" : "NULL"},
           updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      [status, postId],
    );
    await this.logAction(session, action, reportId, numberValue(post.author_id), postId, notes);

    if (reportId !== null) {
      await this.markReportActioned(reportId, session, action, notes);
    }

    return { id: postId, status };
  }

  private async postRecord(postId: number): Promise<PostRecordRow | null> {
    const [rows] = await this.pool.execute<PostRecordRow[]>(
      `SELECT id, author_id, room_id, visibility, status, deleted_at
       FROM posts
       WHERE id = ?
       LIMIT 1`,
      [postId],
    );

    return rows[0] ?? null;
  }

  private async userRecord(userId: number, requireActive: boolean): Promise<UserRecordRow | null> {
    const [rows] = await this.pool.execute<UserRecordRow[]>(
      `SELECT
          u.id AS target_user_id,
          u.handle AS target_handle,
          u.email AS target_email,
          u.role AS target_role,
          u.status AS target_status,
          p.display_name AS target_display_name,
          p.avatar_url AS target_avatar_url
       FROM users u
       INNER JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ?
         ${requireActive ? "AND u.status = 'active'" : ""}
       LIMIT 1`,
      [userId],
    );

    return rows[0] ?? null;
  }

  private async roomRecord(roomId: number): Promise<RoomRecordRow | null> {
    const deletedFilter = await this.hasColumn("rooms", "deleted_at") ? "AND r.deleted_at IS NULL" : "";
    const [rows] = await this.pool.execute<RoomRecordRow[]>(
      `SELECT r.id AS room_id, r.created_by AS room_created_by
       FROM rooms r
       WHERE r.id = ?
         AND r.visibility = 'public'
         ${deletedFilter}
       LIMIT 1`,
      [roomId],
    );

    return rows[0] ?? null;
  }

  private async messageRecord(messageId: number, viewerUserId: number): Promise<MessageRecordRow | null> {
    if (!(await this.hasTable("conversation_members")) || !(await this.hasTable("messages"))) {
      throw new ModerationRouteError("Chat storage is not ready. Run pending migrations.", 503);
    }

    const [rows] = await this.pool.execute<MessageRecordRow[]>(
      `SELECT
          m.id AS message_id,
          m.sender_id AS message_sender_id,
          m.deleted_at AS message_deleted_at
       FROM messages m
       INNER JOIN conversation_members viewer_member
          ON viewer_member.conversation_id = m.conversation_id
         AND viewer_member.user_id = ?
       WHERE m.id = ?
       LIMIT 1`,
      [viewerUserId, messageId],
    );

    return rows[0] ?? null;
  }

  private async reportById(reportId: number): Promise<ModerationReportPayload> {
    const [rows] = await this.pool.execute<ReportRow[]>(`${reportSelectSql()} WHERE rep.id = ? LIMIT 1`, [reportId]);
    const row = rows[0];

    if (row === undefined) {
      throw new ModerationRouteError("Report not found.", 404);
    }

    return reportPayloadFromRow(row);
  }

  private async reportRecord(reportId: number): Promise<ReportRecordRow> {
    const [rows] = await this.pool.execute<ReportRecordRow[]>(
      `SELECT id, target_type, target_id, reported_user_id, post_id
       FROM reports
       WHERE id = ?
       LIMIT 1`,
      [reportId],
    );
    const row = rows[0];

    if (row === undefined) {
      throw new ModerationRouteError("Report not found.", 404);
    }

    return row;
  }

  private async reportExists(reportId: number): Promise<boolean> {
    const [rows] = await this.pool.execute<CountRow[]>(`SELECT COUNT(*) AS value FROM reports WHERE id = ?`, [reportId]);

    return numberValue(rows[0]?.value ?? 0) > 0;
  }

  private async logAction(
    session: RequestSession,
    action: string,
    reportId: number | null,
    targetUserId: number | null,
    targetPostId: number | null,
    notes: string | null,
  ): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO moderation_actions (moderator_id, report_id, target_user_id, target_post_id, action, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [session.userId, reportId, targetUserId, targetPostId, action, notes],
    );
  }

  private async markReportActioned(reportId: number, session: RequestSession, actionTaken: string, notes: string | null): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `UPDATE reports
       SET status = 'actioned',
           reviewed_by = ?,
           reviewed_at = CURRENT_TIMESTAMP(),
           action_taken = ?,
           moderator_note = ?
       WHERE id = ?`,
      [session.userId, actionTaken, notes, reportId],
    );
  }

  private async hasTable(tableName: string): Promise<boolean> {
    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS value
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      [tableName],
    );

    return numberValue(rows[0]?.value ?? 0) > 0;
  }

  private async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS value
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName],
    );

    return numberValue(rows[0]?.value ?? 0) > 0;
  }
}

function requireModeratorSession(session: RequestSession): void {
  if (!["moderator", "admin"].includes(session.role)) {
    throw new ModerationRouteError("Moderator access is required.", 403);
  }
}

function reportSelectSql(): string {
  return `SELECT
      rep.id AS report_id,
      rep.target_type AS report_target_type,
      rep.target_id AS report_target_id,
      rep.category AS report_category,
      rep.details AS report_details,
      rep.status AS report_status,
      rep.created_at AS report_created_at,
      rep.updated_at AS report_updated_at,
      rep.reviewed_at AS report_reviewed_at,
      rep.action_taken AS report_action_taken,
      rep.moderator_note AS report_moderator_note,
      reporter.id AS reporter_user_id,
      reporter.handle AS reporter_handle,
      reporter.role AS reporter_role,
      reporter.status AS reporter_status,
      reporter_profile.display_name AS reporter_display_name,
      reported.id AS reported_user_id,
      reported.handle AS reported_handle,
      reported.role AS reported_role,
      reported.status AS reported_status,
      reported_profile.display_name AS reported_display_name,
      reviewer.id AS reviewer_user_id,
      reviewer.handle AS reviewer_handle,
      reviewer.role AS reviewer_role,
      reviewer.status AS reviewer_status,
      reviewer_profile.display_name AS reviewer_display_name,
      p.id AS post_id,
      p.body AS post_body,
      p.status AS post_status,
      p.visibility AS post_visibility,
      p.created_at AS post_created_at,
      post_author.id AS post_author_user_id,
      post_author.handle AS post_author_handle,
      post_author.role AS post_author_role,
      post_author.status AS post_author_status,
      post_author_profile.display_name AS post_author_display_name,
      report_profile_user.id AS profile_user_id,
      report_profile_user.handle AS profile_handle,
      report_profile_user.role AS profile_role,
      report_profile_user.status AS profile_status,
      report_profile.display_name AS profile_display_name,
      room.id AS room_id,
      room.slug AS room_slug,
      room.name AS room_name,
      room.summary AS room_summary,
      room.visibility AS room_visibility,
      room.is_live AS room_is_live,
      room_owner.id AS room_owner_user_id,
      room_owner.handle AS room_owner_handle,
      room_owner.role AS room_owner_role,
      room_owner.status AS room_owner_status,
      room_owner_profile.display_name AS room_owner_display_name,
      message.id AS message_id,
      message.conversation_id AS message_conversation_id,
      message.body AS message_body,
      message.deleted_at AS message_deleted_at,
      message.created_at AS message_created_at,
      message_sender.id AS message_sender_user_id,
      message_sender.handle AS message_sender_handle,
      message_sender.role AS message_sender_role,
      message_sender.status AS message_sender_status,
      message_sender_profile.display_name AS message_sender_display_name,
      COALESCE(actions.action_count, 0) AS action_count
    FROM reports rep
    LEFT JOIN users reporter ON reporter.id = rep.reporter_id
    LEFT JOIN profiles reporter_profile ON reporter_profile.user_id = reporter.id
    LEFT JOIN users reported ON reported.id = COALESCE(rep.reported_user_id, IF(rep.target_type = 'profile', rep.target_id, NULL))
    LEFT JOIN profiles reported_profile ON reported_profile.user_id = reported.id
    LEFT JOIN users reviewer ON reviewer.id = rep.reviewed_by
    LEFT JOIN profiles reviewer_profile ON reviewer_profile.user_id = reviewer.id
    LEFT JOIN posts p ON p.id = COALESCE(rep.post_id, IF(rep.target_type = 'post', rep.target_id, NULL))
    LEFT JOIN users post_author ON post_author.id = p.author_id
    LEFT JOIN profiles post_author_profile ON post_author_profile.user_id = post_author.id
    LEFT JOIN users report_profile_user ON report_profile_user.id = IF(rep.target_type = 'profile', rep.target_id, NULL)
    LEFT JOIN profiles report_profile ON report_profile.user_id = report_profile_user.id
    LEFT JOIN rooms room ON room.id = IF(rep.target_type = 'room', rep.target_id, NULL)
    LEFT JOIN users room_owner ON room_owner.id = room.created_by
    LEFT JOIN profiles room_owner_profile ON room_owner_profile.user_id = room_owner.id
    LEFT JOIN messages message ON message.id = IF(rep.target_type = 'message', rep.target_id, NULL)
    LEFT JOIN users message_sender ON message_sender.id = message.sender_id
    LEFT JOIN profiles message_sender_profile ON message_sender_profile.user_id = message_sender.id
    LEFT JOIN (
      SELECT report_id, COUNT(*) AS action_count
      FROM moderation_actions
      WHERE report_id IS NOT NULL
      GROUP BY report_id
    ) actions ON actions.report_id = rep.id`;
}

function reportPayloadFromRow(row: ReportRow): ModerationReportPayload {
  return {
    id: numberValue(row.report_id),
    targetType: stringValue(row.report_target_type),
    targetId: nullableNumberValue(row.report_target_id),
    category: stringValue(row.report_category),
    reason: stringValue(row.report_category),
    details: nullableStringValue(row.report_details),
    status: stringValue(row.report_status),
    createdAt: nullableStringValue(row.report_created_at),
    updatedAt: nullableStringValue(row.report_updated_at),
    reviewedAt: nullableStringValue(row.report_reviewed_at),
    actionTaken: nullableStringValue(row.report_action_taken),
    moderatorNote: nullableStringValue(row.report_moderator_note),
    reporter: userPayload(row, "reporter"),
    reportedUser: userPayload(row, "reported"),
    reviewedBy: userPayload(row, "reviewer"),
    post: row.post_id === null
      ? null
      : {
          id: numberValue(row.post_id),
          body: stringValue(row.post_body),
          status: stringValue(row.post_status),
          visibility: stringValue(row.post_visibility),
          createdAt: nullableStringValue(row.post_created_at),
          author: userPayload(row, "post_author"),
        },
    profile: userPayload(row, "profile"),
    room: row.room_id === null
      ? null
      : {
          id: numberValue(row.room_id),
          slug: stringValue(row.room_slug),
          name: stringValue(row.room_name),
          summary: stringValue(row.room_summary),
          visibility: stringValue(row.room_visibility, "public"),
          live: Boolean(row.room_is_live),
          owner: userPayload(row, "room_owner"),
        },
    message: row.message_id === null
      ? null
      : {
          id: numberValue(row.message_id),
          conversationId: numberValue(row.message_conversation_id ?? 0),
          body: row.message_deleted_at === null ? stringValue(row.message_body) : "",
          deletedAt: nullableStringValue(row.message_deleted_at),
          createdAt: nullableStringValue(row.message_created_at),
          sender: userPayload(row, "message_sender"),
        },
    actionCount: numberValue(row.action_count ?? 0),
  };
}

function userPayload(row: ReportRow, prefix: string): ModerationUserPayload | null {
  const id = row[`${prefix}_user_id` as keyof ReportRow];

  if (id === null || id === undefined) {
    return null;
  }

  return {
    id: numberValue(id as number | string),
    handle: stringValue(row[`${prefix}_handle` as keyof ReportRow] as string | null),
    displayName: stringValue(row[`${prefix}_display_name` as keyof ReportRow] as string | null),
    role: stringValue(row[`${prefix}_role` as keyof ReportRow] as string | null),
    status: stringValue(row[`${prefix}_status` as keyof ReportRow] as string | null, "active"),
  };
}

function moderationUserPayloadFromRecord(row: UserRecordRow): ModerationUserPayload {
  return {
    id: numberValue(row.target_user_id),
    handle: stringValue(row.target_handle),
    displayName: stringValue(row.target_display_name),
    role: stringValue(row.target_role),
    status: stringValue(row.target_status, "active"),
  };
}

function reportCategory(value: unknown): string {
  const legacy = new Map([
    ["spam", "spam_or_scam"],
    ["abuse", "harassment"],
    ["illegal", "illegal_content"],
  ]);
  const normalized = typeof value === "string" ? value : "";
  const mapped = legacy.get(normalized) ?? normalized;
  const allowed = new Set([
    "harassment",
    "hate",
    "sexual_content",
    "non_consensual_content",
    "private_info",
    "spam_or_scam",
    "impersonation",
    "copyright",
    "violence_or_threats",
    "self_harm",
    "illegal_content",
    "other",
  ]);

  if (!allowed.has(mapped)) {
    throw new ModerationRouteError("Report category is required.", 422);
  }

  return mapped;
}

function targetTypeValue(value: unknown): "post" | "profile" | "room" | "message" | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = value === "user" ? "profile" : value;

  if (normalized === "post" || normalized === "profile" || normalized === "room" || normalized === "message") {
    return normalized;
  }

  throw new ModerationRouteError("Report target is invalid.", 422);
}

function reportResolutionStatus(value: unknown): "reviewed" | "dismissed" | "actioned" {
  if (value === null || value === undefined || value === "") {
    return "reviewed";
  }

  if (value === "resolved") {
    return "reviewed";
  }

  if (value === "reviewed" || value === "dismissed" || value === "actioned") {
    return value;
  }

  throw new ModerationRouteError("Report status must be reviewed, dismissed, or actioned.", 422);
}

function optionalId(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "number" && !(typeof value === "string" && /^[0-9]+$/u.test(value))) {
    throw new ModerationRouteError(`${label} must be numeric.`, 422);
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 1) {
    throw new ModerationRouteError(`${label} must be numeric.`, 422);
  }

  return number;
}

function optionalText(value: unknown, maxLength: number, label: string): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ModerationRouteError(`${label} must be text.`, 422);
  }

  const text = value.trim();

  if (text === "") {
    return null;
  }

  if (text.length > maxLength) {
    throw new ModerationRouteError(`${label} is too long.`, 422);
  }

  return text;
}

function stringValue(value: string | number | null | undefined, fallback = ""): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function nullableStringValue(value: string | null | undefined): string | null {
  return value === undefined ? null : value;
}

function numberValue(value: string | number): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function nullableNumberValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}
