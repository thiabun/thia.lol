SET @add_messages_reaction_version = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE messages ADD COLUMN reaction_version BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER deleted_at',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND COLUMN_NAME = 'reaction_version'
);
PREPARE add_messages_reaction_version_statement FROM @add_messages_reaction_version;
EXECUTE add_messages_reaction_version_statement;
DEALLOCATE PREPARE add_messages_reaction_version_statement;

CREATE TABLE IF NOT EXISTS message_reactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  emoji VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY message_reactions_message_user_emoji_unique (message_id, user_id, emoji),
  KEY message_reactions_message_emoji_user_idx (message_id, emoji, user_id),
  KEY message_reactions_user_created_idx (user_id, created_at),
  CONSTRAINT message_reactions_message_fk
    FOREIGN KEY (message_id) REFERENCES messages(id)
    ON DELETE CASCADE,
  CONSTRAINT message_reactions_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
