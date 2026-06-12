CREATE TABLE IF NOT EXISTS profile_modules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(80) NULL,
  config_json JSON NOT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  position INT UNSIGNED NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  schema_version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY profile_modules_user_position_idx (user_id, position),
  KEY profile_modules_user_visibility_status_idx (user_id, visibility, status),
  KEY profile_modules_type_idx (type),
  CONSTRAINT profile_modules_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
