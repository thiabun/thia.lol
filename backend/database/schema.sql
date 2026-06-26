-- thia.lol initial MySQL schema.
--
-- Import order:
-- 1. Import this file into an empty database first.
-- 2. Import backend/database/seed.sql after the schema succeeds.
--
-- This file is intended for first-time setup, not as a migration system for
-- existing production data.

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  handle VARCHAR(40) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NULL COMMENT 'Hashed password for login-capable users; NULL for seeded users without credentials.',
  role ENUM('member', 'moderator', 'admin') NOT NULL DEFAULT 'member',
  status ENUM('active', 'suspended', 'deactivated') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY users_handle_unique (handle),
  UNIQUE KEY users_email_unique (email),
  KEY users_role_idx (role),
  KEY users_status_idx (status),
  KEY users_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  bio TEXT NULL,
  location VARCHAR(120) NULL,
  avatar_url VARCHAR(255) NULL,
  banner_url VARCHAR(500) NULL,
  profile_accent VARCHAR(50) NULL,
  profile_background VARCHAR(500) NULL,
  profile_background_video_url VARCHAR(500) NULL,
  profile_background_video_poster_url VARCHAR(500) NULL,
  profile_background_blur VARCHAR(20) NOT NULL DEFAULT 'medium',
  profile_theme VARCHAR(50) NULL,
  profile_theme_config_json JSON NULL,
  profile_layout_preset VARCHAR(20) NOT NULL DEFAULT 'balanced',
  profile_canvas_version SMALLINT UNSIGNED NOT NULL DEFAULT 2,
  profile_canvas_glass_opacity TINYINT UNSIGNED NOT NULL DEFAULT 58,
  visibility ENUM('public', 'private') NOT NULL DEFAULT 'public',
  links JSON NULL,
  traits JSON NULL,
  featured_post_id BIGINT UNSIGNED NULL,
  featured_room_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY profiles_display_name_idx (display_name),
  KEY profiles_featured_post_idx (featured_post_id),
  KEY profiles_featured_room_idx (featured_room_id),
  KEY profiles_visibility_idx (visibility),
  CONSTRAINT profiles_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id BIGINT UNSIGNED NOT NULL,
  following_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  KEY user_follows_following_id_index (following_id),
  CONSTRAINT user_follows_follower_id_fk
    FOREIGN KEY (follower_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT user_follows_following_id_fk
    FOREIGN KEY (following_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id BIGINT UNSIGNED NOT NULL,
  blocked_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id),
  KEY user_blocks_blocked_id_idx (blocked_id),
  KEY user_blocks_created_at_idx (created_at),
  CONSTRAINT user_blocks_blocker_id_fk
    FOREIGN KEY (blocker_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT user_blocks_blocked_id_fk
    FOREIGN KEY (blocked_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_mutes (
  muter_id BIGINT UNSIGNED NOT NULL,
  muted_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (muter_id, muted_id),
  KEY user_mutes_muted_id_idx (muted_id),
  KEY user_mutes_created_at_idx (created_at),
  CONSTRAINT user_mutes_muter_id_fk
    FOREIGN KEY (muter_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT user_mutes_muted_id_fk
    FOREIGN KEY (muted_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profile_stars (
  starrer_id BIGINT UNSIGNED NOT NULL,
  starred_user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (starrer_id, starred_user_id),
  KEY profile_stars_starred_user_id_idx (starred_user_id),
  KEY profile_stars_created_at_idx (created_at),
  CONSTRAINT profile_stars_starrer_id_fk
    FOREIGN KEY (starrer_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT profile_stars_starred_user_id_fk
    FOREIGN KEY (starred_user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS badges (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  badge_key VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  rarity VARCHAR(30) NOT NULL DEFAULT 'common',
  source VARCHAR(40) NOT NULL DEFAULT 'system',
  icon VARCHAR(80) NULL,
  accent VARCHAR(50) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY badges_badge_key_unique (badge_key),
  KEY badges_active_rarity_idx (is_active, rarity),
  KEY badges_source_idx (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_badges (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  badge_id BIGINT UNSIGNED NOT NULL,
  granted_by BIGINT UNSIGNED NULL,
  reason VARCHAR(255) NULL,
  earned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  featured_order INT NULL,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY user_badges_unique (user_id, badge_id),
  KEY user_badges_user_id_idx (user_id),
  KEY user_badges_badge_id_idx (badge_id),
  KEY user_badges_featured_order_idx (featured_order),
  CONSTRAINT user_badges_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT user_badges_badge_id_fk
    FOREIGN KEY (badge_id) REFERENCES badges(id)
    ON DELETE CASCADE,
  CONSTRAINT user_badges_granted_by_fk
    FOREIGN KEY (granted_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profile_modules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(80) NULL,
  config_json JSON NOT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  position INT UNSIGNED NOT NULL DEFAULT 1,
  grid_column TINYINT UNSIGNED NULL,
  grid_row TINYINT UNSIGNED NULL,
  grid_col_span TINYINT UNSIGNED NULL,
  grid_row_span TINYINT UNSIGNED NULL,
  grid_pinned TINYINT(1) NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS profile_canvas_drafts (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  draft_json JSON NOT NULL,
  selected_module_id VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT profile_canvas_drafts_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS user_onboarding_state (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  completed_steps_json JSON NULL,
  skipped_steps_json JSON NULL,
  provider_links_json JSON NULL,
  finished_at DATETIME NULL,
  dismissed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT user_onboarding_state_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL,
  name VARCHAR(140) NOT NULL,
  summary TEXT NULL,
  mood VARCHAR(80) NULL,
  member_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_live TINYINT(1) NOT NULL DEFAULT 0,
  theme VARCHAR(80) NULL,
  theme_config_json JSON NULL,
  icon_url VARCHAR(500) NULL,
  banner_url VARCHAR(500) NULL,
  rules TEXT NULL,
  visibility ENUM('public', 'members', 'private') NOT NULL DEFAULT 'public',
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY rooms_slug_unique (slug),
  KEY rooms_visibility_live_idx (visibility, is_live),
  KEY rooms_created_by_idx (created_by),
  KEY rooms_created_at_idx (created_at),
  KEY rooms_deleted_at_idx (deleted_at),
  CONSTRAINT rooms_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_memberships (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  muted_at DATETIME NULL,
  banned_at DATETIME NULL,
  UNIQUE KEY room_memberships_room_user_unique (room_id, user_id),
  KEY room_memberships_room_id_idx (room_id),
  KEY room_memberships_user_id_idx (user_id),
  KEY room_memberships_role_idx (role),
  CONSTRAINT room_memberships_room_id_fk
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE CASCADE,
  CONSTRAINT room_memberships_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS posts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(16) NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  room_id BIGINT UNSIGNED NULL,
  parent_id BIGINT UNSIGNED NULL,
  body TEXT NOT NULL,
  body_format ENUM('plain', 'markdown') NOT NULL DEFAULT 'plain',
  content_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  mood VARCHAR(80) NULL,
  media_url VARCHAR(255) NULL,
  media_type ENUM('image', 'video') NULL,
  media_mime VARCHAR(80) NULL,
  media_poster_url VARCHAR(500) NULL,
  visibility ENUM('public', 'members', 'private') NOT NULL DEFAULT 'public',
  status ENUM('published', 'hidden', 'removed') NOT NULL DEFAULT 'published',
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY posts_feed_idx (status, visibility, created_at),
  UNIQUE KEY posts_public_id_unique (public_id),
  KEY posts_author_created_idx (author_id, created_at),
  KEY posts_room_created_idx (room_id, created_at),
  KEY posts_parent_created_idx (parent_id, created_at),
  KEY posts_status_idx (status),
  CONSTRAINT posts_author_fk
    FOREIGN KEY (author_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT posts_room_fk
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE SET NULL,
  CONSTRAINT posts_parent_fk
    FOREIGN KEY (parent_id) REFERENCES posts(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_attachments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT UNSIGNED NOT NULL,
  position TINYINT UNSIGNED NOT NULL,
  kind ENUM('image', 'video', 'audio', 'integration') NOT NULL,
  url VARCHAR(500) NULL,
  mime VARCHAR(80) NULL,
  size_bytes BIGINT UNSIGNED NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  duration_seconds DECIMAL(10,3) NULL,
  poster_url VARCHAR(500) NULL,
  provider VARCHAR(40) NULL,
  resource_type VARCHAR(40) NULL,
  resource_id VARCHAR(191) NULL,
  resource_key VARCHAR(255) NULL,
  source_url VARCHAR(500) NULL,
  card_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY post_attachments_post_position_unique (post_id, position),
  KEY post_attachments_post_kind_idx (post_id, kind),
  KEY post_attachments_provider_resource_idx (provider, resource_key),
  CONSTRAINT post_attachments_post_fk
    FOREIGN KEY (post_id) REFERENCES posts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_reactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('glow', 'echo', 'hush') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY post_reactions_unique_user_post_type (post_id, user_id, type),
  KEY post_reactions_user_created_idx (user_id, created_at),
  KEY post_reactions_post_type_idx (post_id, type),
  CONSTRAINT post_reactions_post_fk
    FOREIGN KEY (post_id) REFERENCES posts(id)
    ON DELETE CASCADE,
  CONSTRAINT post_reactions_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_reblogs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY post_reblogs_unique (post_id, user_id),
  KEY post_reblogs_user_id_index (user_id),
  KEY post_reblogs_created_at_index (created_at),
  CONSTRAINT post_reblogs_post_id_fk
    FOREIGN KEY (post_id) REFERENCES posts(id)
    ON DELETE CASCADE,
  CONSTRAINT post_reblogs_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS text_entities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  content_type VARCHAR(30) NOT NULL,
  content_id BIGINT UNSIGNED NOT NULL,
  field_name VARCHAR(40) NOT NULL DEFAULT 'body',
  entity_type VARCHAR(20) NOT NULL,
  entity_start INT UNSIGNED NOT NULL,
  entity_length INT UNSIGNED NOT NULL,
  text_value VARCHAR(1000) NOT NULL,
  target_user_id BIGINT UNSIGNED NULL,
  url VARCHAR(1000) NULL,
  card_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY text_entities_content_field_idx (content_type, content_id, field_name, entity_start),
  KEY text_entities_target_user_idx (target_user_id, created_at),
  KEY text_entities_type_idx (entity_type),
  CONSTRAINT text_entities_target_user_fk
    FOREIGN KEY (target_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  type VARCHAR(50) NOT NULL,
  post_id BIGINT UNSIGNED NULL,
  room_id BIGINT UNSIGNED NULL,
  data JSON NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY notifications_user_read_created_idx (user_id, read_at, created_at),
  KEY notifications_actor_idx (actor_id),
  KEY notifications_post_idx (post_id),
  KEY notifications_room_idx (room_id),
  CONSTRAINT notifications_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT notifications_actor_fk
    FOREIGN KEY (actor_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT notifications_post_fk
    FOREIGN KEY (post_id) REFERENCES posts(id)
    ON DELETE SET NULL,
  CONSTRAINT notifications_room_fk
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARBINARY(16) NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NULL DEFAULT NULL,
  UNIQUE KEY sessions_token_hash_unique (token_hash),
  KEY sessions_user_idx (user_id),
  KEY sessions_expires_at_idx (expires_at),
  CONSTRAINT sessions_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  action ENUM('login', 'register') NOT NULL,
  identifier_hash CHAR(64) NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  window_starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY auth_rate_limits_action_identifier_unique (action, identifier_hash),
  KEY auth_rate_limits_window_idx (action, window_starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  target_type ENUM('post', 'profile', 'room', 'message') NOT NULL DEFAULT 'post',
  target_id BIGINT UNSIGNED NULL,
  reporter_id BIGINT UNSIGNED NULL,
  reported_user_id BIGINT UNSIGNED NULL,
  post_id BIGINT UNSIGNED NULL,
  category ENUM('harassment', 'hate', 'sexual_content', 'non_consensual_content', 'private_info', 'spam_or_scam', 'impersonation', 'copyright', 'violence_or_threats', 'self_harm', 'illegal_content', 'other') NOT NULL DEFAULT 'other',
  details TEXT NULL,
  status ENUM('open', 'reviewed', 'dismissed', 'actioned') NOT NULL DEFAULT 'open',
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  action_taken VARCHAR(120) NULL,
  moderator_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY reports_queue_idx (status, created_at),
  KEY reports_target_idx (target_type, target_id),
  KEY reports_category_status_idx (category, status, created_at),
  KEY reports_reporter_idx (reporter_id),
  KEY reports_reported_user_idx (reported_user_id),
  KEY reports_post_idx (post_id),
  KEY reports_reviewed_by_idx (reviewed_by),
  CONSTRAINT reports_reporter_fk
    FOREIGN KEY (reporter_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT reports_reported_user_fk
    FOREIGN KEY (reported_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT reports_post_fk
    FOREIGN KEY (post_id) REFERENCES posts(id)
    ON DELETE SET NULL,
  CONSTRAINT reports_reviewed_by_fk
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS moderation_actions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  moderator_id BIGINT UNSIGNED NULL,
  report_id BIGINT UNSIGNED NULL,
  target_user_id BIGINT UNSIGNED NULL,
  target_post_id BIGINT UNSIGNED NULL,
  action ENUM('note', 'hide_post', 'remove_post', 'restore_post', 'warn_user', 'suspend_user', 'dismiss_report') NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY moderation_actions_moderator_created_idx (moderator_id, created_at),
  KEY moderation_actions_report_idx (report_id),
  KEY moderation_actions_target_user_idx (target_user_id, created_at),
  KEY moderation_actions_target_post_idx (target_post_id, created_at),
  CONSTRAINT moderation_actions_moderator_fk
    FOREIGN KEY (moderator_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT moderation_actions_report_fk
    FOREIGN KEY (report_id) REFERENCES reports(id)
    ON DELETE SET NULL,
  CONSTRAINT moderation_actions_target_user_fk
    FOREIGN KEY (target_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT moderation_actions_target_post_fk
    FOREIGN KEY (target_post_id) REFERENCES posts(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
