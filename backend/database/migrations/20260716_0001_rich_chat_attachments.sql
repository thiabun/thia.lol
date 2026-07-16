SET @add_message_attachments_position = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN position TINYINT UNSIGNED NULL AFTER message_id', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'position'
);
PREPARE add_message_attachments_position_statement FROM @add_message_attachments_position;
EXECUTE add_message_attachments_position_statement;
DEALLOCATE PREPARE add_message_attachments_position_statement;

SET @add_message_attachments_room_id = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN room_id BIGINT UNSIGNED NULL AFTER post_id', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'room_id'
);
PREPARE add_message_attachments_room_id_statement FROM @add_message_attachments_room_id;
EXECUTE add_message_attachments_room_id_statement;
DEALLOCATE PREPARE add_message_attachments_room_id_statement;

SET @add_message_attachments_size_bytes = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN size_bytes BIGINT UNSIGNED NULL AFTER mime', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'size_bytes'
);
PREPARE add_message_attachments_size_bytes_statement FROM @add_message_attachments_size_bytes;
EXECUTE add_message_attachments_size_bytes_statement;
DEALLOCATE PREPARE add_message_attachments_size_bytes_statement;

SET @add_message_attachments_duration_seconds = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN duration_seconds DECIMAL(10,3) NULL AFTER height', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'duration_seconds'
);
PREPARE add_message_attachments_duration_seconds_statement FROM @add_message_attachments_duration_seconds;
EXECUTE add_message_attachments_duration_seconds_statement;
DEALLOCATE PREPARE add_message_attachments_duration_seconds_statement;

SET @add_message_attachments_poster_url = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN poster_url VARCHAR(500) NULL AFTER duration_seconds', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'poster_url'
);
PREPARE add_message_attachments_poster_url_statement FROM @add_message_attachments_poster_url;
EXECUTE add_message_attachments_poster_url_statement;
DEALLOCATE PREPARE add_message_attachments_poster_url_statement;

UPDATE message_attachments target
INNER JOIN (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY id ASC) - 1 AS attachment_position
  FROM message_attachments
) ranked ON ranked.id = target.id
SET target.position = ranked.attachment_position
WHERE target.position IS NULL;

SET @add_message_attachments_message_position_unique = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE message_attachments ADD UNIQUE KEY message_attachments_message_position_unique (message_id, position)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'message_attachments'
    AND INDEX_NAME = 'message_attachments_message_position_unique'
);
PREPARE add_message_attachments_message_position_unique_statement FROM @add_message_attachments_message_position_unique;
EXECUTE add_message_attachments_message_position_unique_statement;
DEALLOCATE PREPARE add_message_attachments_message_position_unique_statement;

SET @add_message_attachments_room_idx = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE message_attachments ADD KEY message_attachments_room_idx (room_id)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'message_attachments'
    AND INDEX_NAME = 'message_attachments_room_idx'
);
PREPARE add_message_attachments_room_idx_statement FROM @add_message_attachments_room_idx;
EXECUTE add_message_attachments_room_idx_statement;
DEALLOCATE PREPARE add_message_attachments_room_idx_statement;

SET @add_message_attachments_room_fk = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE message_attachments ADD CONSTRAINT message_attachments_room_fk FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'message_attachments_room_fk'
);
PREPARE add_message_attachments_room_fk_statement FROM @add_message_attachments_room_fk;
EXECUTE add_message_attachments_room_fk_statement;
DEALLOCATE PREPARE add_message_attachments_room_fk_statement;
