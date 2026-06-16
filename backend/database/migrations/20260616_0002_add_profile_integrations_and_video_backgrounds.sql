SET @add_profile_background_video_url = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN profile_background_video_url VARCHAR(500) NULL AFTER profile_background',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'profile_background_video_url'
);
PREPARE add_profile_background_video_url_statement FROM @add_profile_background_video_url;
EXECUTE add_profile_background_video_url_statement;
DEALLOCATE PREPARE add_profile_background_video_url_statement;

SET @add_profile_background_video_poster_url = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN profile_background_video_poster_url VARCHAR(500) NULL AFTER profile_background_video_url',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'profile_background_video_poster_url'
);
PREPARE add_profile_background_video_poster_url_statement FROM @add_profile_background_video_poster_url;
EXECUTE add_profile_background_video_poster_url_statement;
DEALLOCATE PREPARE add_profile_background_video_poster_url_statement;

CREATE TABLE IF NOT EXISTS profile_integration_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL,
  provider_account_id VARCHAR(191) NOT NULL,
  provider_handle VARCHAR(191) NULL,
  display_name VARCHAR(191) NULL,
  avatar_url VARCHAR(500) NULL,
  scopes_json JSON NULL,
  access_token_cipher TEXT NULL,
  refresh_token_cipher TEXT NULL,
  token_expires_at DATETIME NULL,
  connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  refreshed_at DATETIME NULL,
  revoked_at DATETIME NULL,
  last_error VARCHAR(255) NULL,
  error_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY profile_integration_accounts_user_provider_unique (user_id, provider),
  KEY profile_integration_accounts_provider_idx (provider),
  CONSTRAINT profile_integration_accounts_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profile_integration_oauth_states (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL,
  state_hash CHAR(64) NOT NULL,
  code_verifier_cipher TEXT NULL,
  redirect_path VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY profile_integration_oauth_states_hash_unique (state_hash),
  KEY profile_integration_oauth_states_user_provider_idx (user_id, provider),
  KEY profile_integration_oauth_states_expires_idx (expires_at),
  CONSTRAINT profile_integration_oauth_states_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profile_integration_metadata_cache (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  resource_type VARCHAR(40) NOT NULL,
  resource_id VARCHAR(191) NOT NULL,
  resource_key VARCHAR(255) NOT NULL,
  source_url VARCHAR(500) NOT NULL,
  metadata_json JSON NOT NULL,
  embed_json JSON NULL,
  api_backed TINYINT(1) NOT NULL DEFAULT 0,
  fetched_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  stale_at DATETIME NOT NULL,
  error_message VARCHAR(255) NULL,
  error_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY profile_integration_metadata_cache_resource_unique (provider, resource_key),
  KEY profile_integration_metadata_cache_expires_idx (expires_at),
  KEY profile_integration_metadata_cache_stale_idx (stale_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
