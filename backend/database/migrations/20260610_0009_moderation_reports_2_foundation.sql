SET @add_report_target_type = (
  SELECT IF(
    COUNT(*) = 0,
    "ALTER TABLE reports ADD COLUMN target_type ENUM('post', 'profile', 'room', 'message') NOT NULL DEFAULT 'post' AFTER id",
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reports'
    AND COLUMN_NAME = 'target_type'
);
PREPARE add_report_target_type_statement FROM @add_report_target_type;
EXECUTE add_report_target_type_statement;
DEALLOCATE PREPARE add_report_target_type_statement;

SET @add_report_target_id = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE reports ADD COLUMN target_id BIGINT UNSIGNED NULL AFTER target_type',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reports'
    AND COLUMN_NAME = 'target_id'
);
PREPARE add_report_target_id_statement FROM @add_report_target_id;
EXECUTE add_report_target_id_statement;
DEALLOCATE PREPARE add_report_target_id_statement;

SET @add_report_category = (
  SELECT IF(
    COUNT(*) = 0,
    "ALTER TABLE reports ADD COLUMN category ENUM('harassment', 'hate', 'sexual_content', 'non_consensual_content', 'private_info', 'spam_or_scam', 'impersonation', 'copyright', 'violence_or_threats', 'self_harm', 'illegal_content', 'other') NOT NULL DEFAULT 'other' AFTER post_id",
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reports'
    AND COLUMN_NAME = 'category'
);
PREPARE add_report_category_statement FROM @add_report_category;
EXECUTE add_report_category_statement;
DEALLOCATE PREPARE add_report_category_statement;

SET @add_report_action_taken = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE reports ADD COLUMN action_taken VARCHAR(120) NULL AFTER reviewed_at',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reports'
    AND COLUMN_NAME = 'action_taken'
);
PREPARE add_report_action_taken_statement FROM @add_report_action_taken;
EXECUTE add_report_action_taken_statement;
DEALLOCATE PREPARE add_report_action_taken_statement;

SET @add_report_moderator_note = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE reports ADD COLUMN moderator_note TEXT NULL AFTER action_taken',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reports'
    AND COLUMN_NAME = 'moderator_note'
);
PREPARE add_report_moderator_note_statement FROM @add_report_moderator_note;
EXECUTE add_report_moderator_note_statement;
DEALLOCATE PREPARE add_report_moderator_note_statement;

ALTER TABLE reports
  MODIFY COLUMN status ENUM('open', 'reviewing', 'resolved', 'reviewed', 'dismissed', 'actioned') NOT NULL DEFAULT 'open';

UPDATE reports
SET status = 'reviewed'
WHERE status = 'resolved';

UPDATE reports
SET status = 'open'
WHERE status = 'reviewing';

ALTER TABLE reports
  MODIFY COLUMN status ENUM('open', 'reviewed', 'dismissed', 'actioned') NOT NULL DEFAULT 'open';

SET @backfill_report_category = (
  SELECT IF(
    COUNT(*) = 1,
    "UPDATE reports SET category = CASE reason WHEN 'spam' THEN 'spam_or_scam' WHEN 'harassment' THEN 'harassment' WHEN 'abuse' THEN 'harassment' WHEN 'self_harm' THEN 'self_harm' WHEN 'illegal' THEN 'illegal_content' ELSE 'other' END WHERE category = 'other'",
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reports'
    AND COLUMN_NAME = 'reason'
);
PREPARE backfill_report_category_statement FROM @backfill_report_category;
EXECUTE backfill_report_category_statement;
DEALLOCATE PREPARE backfill_report_category_statement;

UPDATE reports
SET target_type = CASE
      WHEN post_id IS NOT NULL THEN 'post'
      WHEN reported_user_id IS NOT NULL THEN 'profile'
      ELSE target_type
    END,
    target_id = CASE
      WHEN post_id IS NOT NULL THEN post_id
      WHEN reported_user_id IS NOT NULL THEN reported_user_id
      ELSE target_id
    END
WHERE target_id IS NULL;

SET @add_reports_target_idx = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE reports ADD KEY reports_target_idx (target_type, target_id)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reports'
    AND INDEX_NAME = 'reports_target_idx'
);
PREPARE add_reports_target_idx_statement FROM @add_reports_target_idx;
EXECUTE add_reports_target_idx_statement;
DEALLOCATE PREPARE add_reports_target_idx_statement;

SET @add_reports_category_status_idx = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE reports ADD KEY reports_category_status_idx (category, status, created_at)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reports'
    AND INDEX_NAME = 'reports_category_status_idx'
);
PREPARE add_reports_category_status_idx_statement FROM @add_reports_category_status_idx;
EXECUTE add_reports_category_status_idx_statement;
DEALLOCATE PREPARE add_reports_category_status_idx_statement;
