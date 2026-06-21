SET @update_users_status_enum = (
  SELECT IF(
    COLUMN_TYPE NOT LIKE "%'deactivated'%",
    "ALTER TABLE users MODIFY COLUMN status ENUM('active', 'suspended', 'deactivated') NOT NULL DEFAULT 'active'",
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'status'
  LIMIT 1
);
PREPARE update_users_status_enum_statement FROM @update_users_status_enum;
EXECUTE update_users_status_enum_statement;
DEALLOCATE PREPARE update_users_status_enum_statement;

SET @add_profiles_visibility = (
  SELECT IF(
    COUNT(*) = 0,
    "ALTER TABLE profiles ADD COLUMN visibility ENUM('public', 'private') NOT NULL DEFAULT 'public' AFTER profile_canvas_glass_opacity",
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'visibility'
);
PREPARE add_profiles_visibility_statement FROM @add_profiles_visibility;
EXECUTE add_profiles_visibility_statement;
DEALLOCATE PREPARE add_profiles_visibility_statement;

SET @add_profiles_visibility_idx = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD KEY profiles_visibility_idx (visibility)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND INDEX_NAME = 'profiles_visibility_idx'
);
PREPARE add_profiles_visibility_idx_statement FROM @add_profiles_visibility_idx;
EXECUTE add_profiles_visibility_idx_statement;
DEALLOCATE PREPARE add_profiles_visibility_idx_statement;

CREATE TABLE IF NOT EXISTS user_follow_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  requester_id BIGINT UNSIGNED NOT NULL,
  target_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'approved', 'denied', 'canceled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY user_follow_requests_pair_unique (requester_id, target_user_id),
  KEY user_follow_requests_target_status_idx (target_user_id, status, created_at),
  KEY user_follow_requests_requester_status_idx (requester_id, status),
  CONSTRAINT user_follow_requests_requester_fk
    FOREIGN KEY (requester_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT user_follow_requests_target_fk
    FOREIGN KEY (target_user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  analytics_consent TINYINT(1) NOT NULL DEFAULT 0,
  personalization_consent TINYINT(1) NOT NULL DEFAULT 1,
  rich_embeds_consent TINYINT(1) NOT NULL DEFAULT 1,
  autoplay_media_consent TINYINT(1) NOT NULL DEFAULT 0,
  sensitive_content_visible TINYINT(1) NOT NULL DEFAULT 0,
  notification_preferences_json JSON NULL,
  email_notification_preferences_json JSON NULL,
  push_notification_preferences_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT user_preferences_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_handle_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  old_handle VARCHAR(40) NOT NULL,
  new_handle VARCHAR(40) NOT NULL,
  reserved_until DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY user_handle_history_user_created_idx (user_id, created_at),
  KEY user_handle_history_old_reserved_idx (old_handle, reserved_until),
  KEY user_handle_history_new_handle_idx (new_handle),
  CONSTRAINT user_handle_history_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_two_factor (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  secret_cipher TEXT NULL,
  pending_secret_cipher TEXT NULL,
  enabled_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT user_two_factor_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_two_factor_backup_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY user_two_factor_backup_codes_user_used_idx (user_id, used_at),
  CONSTRAINT user_two_factor_backup_codes_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_two_factor_challenges (
  id CHAR(48) PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY auth_two_factor_challenges_user_idx (user_id),
  KEY auth_two_factor_challenges_expires_idx (expires_at),
  CONSTRAINT auth_two_factor_challenges_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  requested_at DATETIME NOT NULL,
  scheduled_for DATETIME NOT NULL,
  canceled_at DATETIME NULL,
  completed_at DATETIME NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY account_deletion_requests_scheduled_idx (scheduled_for),
  CONSTRAINT account_deletion_requests_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
