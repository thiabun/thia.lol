CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_secret VARCHAR(255) NOT NULL,
  content_encoding VARCHAR(20) NOT NULL DEFAULT 'aes128gcm',
  user_agent VARCHAR(500) NULL,
  last_success_at DATETIME NULL,
  last_error_at DATETIME NULL,
  last_error VARCHAR(255) NULL,
  failure_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  disabled_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY push_subscriptions_endpoint_hash_unique (endpoint_hash),
  KEY push_subscriptions_user_disabled_idx (user_id, disabled_at),
  KEY push_subscriptions_last_error_idx (last_error_at),
  CONSTRAINT push_subscriptions_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
