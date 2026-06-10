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
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
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
  links JSON NULL,
  traits JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY profiles_display_name_idx (display_name),
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

CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL,
  name VARCHAR(140) NOT NULL,
  summary TEXT NULL,
  mood VARCHAR(80) NULL,
  member_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_live TINYINT(1) NOT NULL DEFAULT 0,
  accent VARCHAR(80) NULL,
  visibility ENUM('public', 'members', 'private') NOT NULL DEFAULT 'public',
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY rooms_slug_unique (slug),
  KEY rooms_visibility_live_idx (visibility, is_live),
  KEY rooms_created_by_idx (created_by),
  KEY rooms_created_at_idx (created_at),
  CONSTRAINT rooms_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS posts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  author_id BIGINT UNSIGNED NOT NULL,
  room_id BIGINT UNSIGNED NULL,
  parent_id BIGINT UNSIGNED NULL,
  body TEXT NOT NULL,
  mood VARCHAR(80) NULL,
  media_url VARCHAR(255) NULL,
  visibility ENUM('public', 'members', 'private') NOT NULL DEFAULT 'public',
  status ENUM('published', 'hidden', 'removed') NOT NULL DEFAULT 'published',
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY posts_feed_idx (status, visibility, created_at),
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
  reporter_id BIGINT UNSIGNED NULL,
  reported_user_id BIGINT UNSIGNED NULL,
  post_id BIGINT UNSIGNED NULL,
  reason ENUM('spam', 'harassment', 'abuse', 'self_harm', 'illegal', 'other') NOT NULL DEFAULT 'other',
  details TEXT NULL,
  status ENUM('open', 'reviewing', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY reports_queue_idx (status, created_at),
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
