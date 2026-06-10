CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(30) NOT NULL DEFAULT 'direct',
  direct_user_one_id BIGINT UNSIGNED NULL,
  direct_user_two_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  last_message_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY conversations_direct_unique (type, direct_user_one_id, direct_user_two_id),
  KEY conversations_last_message_idx (last_message_at),
  KEY conversations_direct_user_one_idx (direct_user_one_id),
  KEY conversations_direct_user_two_idx (direct_user_two_id),
  CONSTRAINT conversations_direct_user_one_fk
    FOREIGN KEY (direct_user_one_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT conversations_direct_user_two_fk
    FOREIGN KEY (direct_user_two_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  last_read_at DATETIME NULL,
  muted_at DATETIME NULL,
  archived_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id),
  KEY conversation_members_user_id_idx (user_id),
  KEY conversation_members_conversation_id_idx (conversation_id),
  CONSTRAINT conversation_members_conversation_fk
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE,
  CONSTRAINT conversation_members_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY messages_conversation_id_idx (conversation_id),
  KEY messages_sender_id_idx (sender_id),
  KEY messages_created_at_idx (created_at),
  KEY messages_conversation_created_idx (conversation_id, created_at),
  CONSTRAINT messages_conversation_fk
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE,
  CONSTRAINT messages_sender_fk
    FOREIGN KEY (sender_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
