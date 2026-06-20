CREATE TABLE IF NOT EXISTS message_attachments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(30) NOT NULL,
  post_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY message_attachments_unique (message_id, type, post_id),
  KEY message_attachments_message_idx (message_id),
  KEY message_attachments_post_idx (post_id),
  CONSTRAINT message_attachments_message_fk
    FOREIGN KEY (message_id) REFERENCES messages(id)
    ON DELETE CASCADE,
  CONSTRAINT message_attachments_post_fk
    FOREIGN KEY (post_id) REFERENCES posts(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
