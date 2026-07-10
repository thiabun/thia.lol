UPDATE profiles
SET display_name = LEFT(display_name, 50)
WHERE CHAR_LENGTH(display_name) > 50;

ALTER TABLE profiles
  MODIFY COLUMN display_name VARCHAR(50) NOT NULL;

CREATE TABLE IF NOT EXISTS room_channels (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  slug VARCHAR(48) NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(240) NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  kind VARCHAR(30) NOT NULL DEFAULT 'chat',
  read_only TINYINT(1) NOT NULL DEFAULT 0,
  archived_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY room_channels_room_slug_unique (room_id, slug),
  KEY room_channels_room_position_idx (room_id, archived_at, position, id),
  KEY room_channels_created_by_idx (created_by),
  CONSTRAINT room_channels_room_fk
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE CASCADE,
  CONSTRAINT room_channels_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO room_channels (room_id, slug, name, description, position, kind, read_only, created_by)
SELECT
  rooms.id,
  'general',
  'general',
  'Room chat',
  0,
  'chat',
  0,
  rooms.created_by
FROM rooms
LEFT JOIN room_channels existing
  ON existing.room_id = rooms.id
 AND existing.slug = 'general'
WHERE existing.id IS NULL
  AND rooms.deleted_at IS NULL;

SET @add_conversations_room_id = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE conversations ADD COLUMN room_id BIGINT UNSIGNED NULL AFTER direct_user_two_id',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'conversations'
    AND COLUMN_NAME = 'room_id'
);
PREPARE add_conversations_room_id_statement FROM @add_conversations_room_id;
EXECUTE add_conversations_room_id_statement;
DEALLOCATE PREPARE add_conversations_room_id_statement;

SET @add_conversations_room_channel_id = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE conversations ADD COLUMN room_channel_id BIGINT UNSIGNED NULL AFTER room_id',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'conversations'
    AND COLUMN_NAME = 'room_channel_id'
);
PREPARE add_conversations_room_channel_id_statement FROM @add_conversations_room_channel_id;
EXECUTE add_conversations_room_channel_id_statement;
DEALLOCATE PREPARE add_conversations_room_channel_id_statement;

SET @add_conversations_room_idx = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE conversations ADD KEY conversations_room_idx (room_id, type, last_message_at)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'conversations'
    AND INDEX_NAME = 'conversations_room_idx'
);
PREPARE add_conversations_room_idx_statement FROM @add_conversations_room_idx;
EXECUTE add_conversations_room_idx_statement;
DEALLOCATE PREPARE add_conversations_room_idx_statement;

SET @add_conversations_room_channel_unique = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE conversations ADD UNIQUE KEY conversations_room_channel_unique (type, room_channel_id)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'conversations'
    AND INDEX_NAME = 'conversations_room_channel_unique'
);
PREPARE add_conversations_room_channel_unique_statement FROM @add_conversations_room_channel_unique;
EXECUTE add_conversations_room_channel_unique_statement;
DEALLOCATE PREPARE add_conversations_room_channel_unique_statement;

SET @add_conversations_room_fk = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE conversations ADD CONSTRAINT conversations_room_fk FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'conversations_room_fk'
);
PREPARE add_conversations_room_fk_statement FROM @add_conversations_room_fk;
EXECUTE add_conversations_room_fk_statement;
DEALLOCATE PREPARE add_conversations_room_fk_statement;

SET @add_conversations_room_channel_fk = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE conversations ADD CONSTRAINT conversations_room_channel_fk FOREIGN KEY (room_channel_id) REFERENCES room_channels(id) ON DELETE CASCADE',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'conversations_room_channel_fk'
);
PREPARE add_conversations_room_channel_fk_statement FROM @add_conversations_room_channel_fk;
EXECUTE add_conversations_room_channel_fk_statement;
DEALLOCATE PREPARE add_conversations_room_channel_fk_statement;

INSERT IGNORE INTO conversations (type, room_id, room_channel_id)
SELECT 'room_channel', room_id, id
FROM room_channels
WHERE archived_at IS NULL;

SET @add_message_attachments_url = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN url VARCHAR(500) NULL AFTER post_id', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'url'
);
PREPARE add_message_attachments_url_statement FROM @add_message_attachments_url;
EXECUTE add_message_attachments_url_statement;
DEALLOCATE PREPARE add_message_attachments_url_statement;

SET @add_message_attachments_mime = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN mime VARCHAR(80) NULL AFTER url', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'mime'
);
PREPARE add_message_attachments_mime_statement FROM @add_message_attachments_mime;
EXECUTE add_message_attachments_mime_statement;
DEALLOCATE PREPARE add_message_attachments_mime_statement;

SET @add_message_attachments_width = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN width INT UNSIGNED NULL AFTER mime', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'width'
);
PREPARE add_message_attachments_width_statement FROM @add_message_attachments_width;
EXECUTE add_message_attachments_width_statement;
DEALLOCATE PREPARE add_message_attachments_width_statement;

SET @add_message_attachments_height = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN height INT UNSIGNED NULL AFTER width', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'height'
);
PREPARE add_message_attachments_height_statement FROM @add_message_attachments_height;
EXECUTE add_message_attachments_height_statement;
DEALLOCATE PREPARE add_message_attachments_height_statement;

SET @add_message_attachments_provider = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN provider VARCHAR(40) NULL AFTER height', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'provider'
);
PREPARE add_message_attachments_provider_statement FROM @add_message_attachments_provider;
EXECUTE add_message_attachments_provider_statement;
DEALLOCATE PREPARE add_message_attachments_provider_statement;

SET @add_message_attachments_resource_type = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN resource_type VARCHAR(40) NULL AFTER provider', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'resource_type'
);
PREPARE add_message_attachments_resource_type_statement FROM @add_message_attachments_resource_type;
EXECUTE add_message_attachments_resource_type_statement;
DEALLOCATE PREPARE add_message_attachments_resource_type_statement;

SET @add_message_attachments_resource_id = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN resource_id VARCHAR(191) NULL AFTER resource_type', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'resource_id'
);
PREPARE add_message_attachments_resource_id_statement FROM @add_message_attachments_resource_id;
EXECUTE add_message_attachments_resource_id_statement;
DEALLOCATE PREPARE add_message_attachments_resource_id_statement;

SET @add_message_attachments_resource_key = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN resource_key VARCHAR(255) NULL AFTER resource_id', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'resource_key'
);
PREPARE add_message_attachments_resource_key_statement FROM @add_message_attachments_resource_key;
EXECUTE add_message_attachments_resource_key_statement;
DEALLOCATE PREPARE add_message_attachments_resource_key_statement;

SET @add_message_attachments_source_url = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN source_url VARCHAR(500) NULL AFTER resource_key', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'source_url'
);
PREPARE add_message_attachments_source_url_statement FROM @add_message_attachments_source_url;
EXECUTE add_message_attachments_source_url_statement;
DEALLOCATE PREPARE add_message_attachments_source_url_statement;

SET @add_message_attachments_card_json = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE message_attachments ADD COLUMN card_json JSON NULL AFTER source_url', 'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'message_attachments' AND COLUMN_NAME = 'card_json'
);
PREPARE add_message_attachments_card_json_statement FROM @add_message_attachments_card_json;
EXECUTE add_message_attachments_card_json_statement;
DEALLOCATE PREPARE add_message_attachments_card_json_statement;

SET @add_message_attachments_provider_resource_idx = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE message_attachments ADD KEY message_attachments_provider_resource_idx (provider, resource_key)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'message_attachments'
    AND INDEX_NAME = 'message_attachments_provider_resource_idx'
);
PREPARE add_message_attachments_provider_resource_idx_statement FROM @add_message_attachments_provider_resource_idx;
EXECUTE add_message_attachments_provider_resource_idx_statement;
DEALLOCATE PREPARE add_message_attachments_provider_resource_idx_statement;

SET @update_post_attachment_kind_gif = (
  SELECT IF(
    COLUMN_TYPE NOT LIKE "%'gif'%",
    "ALTER TABLE post_attachments MODIFY COLUMN kind ENUM('image', 'video', 'audio', 'integration', 'gif') NOT NULL",
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'post_attachments'
    AND COLUMN_NAME = 'kind'
  LIMIT 1
);
PREPARE update_post_attachment_kind_gif_statement FROM @update_post_attachment_kind_gif;
EXECUTE update_post_attachment_kind_gif_statement;
DEALLOCATE PREPARE update_post_attachment_kind_gif_statement;
